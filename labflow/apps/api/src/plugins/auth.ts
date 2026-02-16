/**
 * Fastify plugin that registers @fastify/jwt and decorates the Fastify instance
 * with authentication and authorization helpers:
 *
 *   - `fastify.authenticate` — preHandler that verifies JWT and loads user from DB
 *   - `fastify.requireRole(role)` — preHandler factory that enforces a minimum role
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply, type preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import { prisma } from '@labflow/db';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export interface JwtPayload {
  sub: string;          // userId
  orgId: string;        // organizationId
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// ----------------------------------------------------------------
// Role hierarchy (ordered from highest privilege to lowest)
// ----------------------------------------------------------------

const ROLE_HIERARCHY = [
  'SUPER_ADMIN',
  'LAB_DIRECTOR',
  'LAB_MANAGER',
  'BILLING_ADMIN',
  'SENIOR_ANALYST',
  'ANALYST',
  'SAMPLE_RECEIVER',
  'DATA_ENTRY',
  'BILLING_VIEWER',
  'CLIENT_ADMIN',
  'CLIENT_USER',
  'READONLY',
] as const;

type AppRole = (typeof ROLE_HIERARCHY)[number];

function roleRank(role: string): number {
  const index = ROLE_HIERARCHY.indexOf(role as AppRole);
  return index === -1 ? Infinity : index;
}

function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  return roleRank(userRole) <= roleRank(requiredRole);
}

// ----------------------------------------------------------------
// Augmented Fastify types
// ----------------------------------------------------------------

export interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  permissions: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
    organizationId: string;
  }

  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
    requireRole: (minimumRole: string) => preHandlerHookHandler;
  }
}

// ----------------------------------------------------------------
// Plugin
// ----------------------------------------------------------------

async function authPlugin(fastify: FastifyInstance): Promise<void> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  await fastify.register(fjwt, {
    secret,
    sign: {
      algorithm: 'HS256',
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    },
    verify: {
      algorithms: ['HS256'],
    },
    decoratorName: 'jwt',
  });

  /**
   * Full authentication preHandler:
   * 1. Verifies the JWT from the Authorization header
   * 2. Loads the user from the database
   * 3. Checks the user is active and not deleted
   * 4. Sets `request.user` and `request.organizationId`
   */
  fastify.decorate(
    'authenticate',
    async function authenticateHandler(
      request: FastifyRequest,
      _reply: FastifyReply,
    ): Promise<void> {
      // 1. Verify JWT
      let payload: JwtPayload;
      try {
        await request.jwtVerify();
        payload = request.user as unknown as JwtPayload;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Invalid or expired token';
        throw new UnauthorizedError(message);
      }

      // 2. Load user from database
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          organizationId: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          isActive: true,
          permissions: true,
          deletedAt: true,
        },
      });

      if (!dbUser) {
        throw new UnauthorizedError('User account not found');
      }

      // 3. Ensure user is active and not soft-deleted
      if (!dbUser.isActive || dbUser.deletedAt !== null) {
        throw new UnauthorizedError('User account is deactivated');
      }

      // Verify the organisation claim in the token matches the database
      if (dbUser.organizationId !== payload.orgId) {
        throw new UnauthorizedError('Organisation mismatch');
      }

      // 4. Decorate the request with full user record
      const authUser: AuthUser = {
        id: dbUser.id,
        organizationId: dbUser.organizationId,
        email: dbUser.email,
        role: dbUser.role,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        isActive: dbUser.isActive,
        permissions: dbUser.permissions,
      };

      request.user = authUser;
      request.organizationId = dbUser.organizationId;
    },
  );

  /**
   * Role-checking preHandler factory.
   * Enforces that the authenticated user has at least the specified role
   * in the hierarchical role model.
   *
   * Must be used after `fastify.authenticate` in the preHandler chain.
   *
   * Usage:
   *   fastify.get('/admin', {
   *     preHandler: [fastify.authenticate, fastify.requireRole('LAB_MANAGER')],
   *   }, handler);
   */
  fastify.decorate(
    'requireRole',
    function requireRoleFactory(minimumRole: string): preHandlerHookHandler {
      return async function checkRole(
        request: FastifyRequest,
        _reply: FastifyReply,
      ): Promise<void> {
        if (!request.user) {
          throw new UnauthorizedError('Authentication required');
        }

        if (!hasMinimumRole(request.user.role, minimumRole)) {
          throw new ForbiddenError(
            `This action requires at least the ${minimumRole} role`,
          );
        }
      };
    },
  );
}

export default fp(authPlugin, {
  name: 'auth',
  fastify: '4.x',
});
