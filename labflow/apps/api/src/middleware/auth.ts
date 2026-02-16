/**
 * Auth middleware for the LabFlow API.
 *
 * Provides:
 *   - JWT verification that loads the full user record from the database
 *   - Organisation extraction and scoping
 *   - Role-based access control (RBAC) with a hierarchical role model
 *   - Reusable preHandler hooks for route protection
 */

import {
  type FastifyRequest,
  type FastifyReply,
  type preHandlerHookHandler,
} from 'fastify';
import { prisma } from '@labflow/db';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import type { JwtPayload } from '../plugins/auth.js';

// ----------------------------------------------------------------
// Role hierarchy
// ----------------------------------------------------------------

/**
 * All application roles ordered from highest privilege to lowest.
 * A user with a higher-ranked role implicitly satisfies checks for
 * any lower-ranked role.
 */
export const ROLE_HIERARCHY = [
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

export type AppRole = (typeof ROLE_HIERARCHY)[number];

/**
 * Returns the numeric rank of a role (lower index = higher privilege).
 * Returns Infinity for unknown roles so they fail every check.
 */
function roleRank(role: string): number {
  const index = ROLE_HIERARCHY.indexOf(role as AppRole);
  return index === -1 ? Infinity : index;
}

/**
 * Returns `true` when `userRole` is equal to or higher than `requiredRole`
 * in the privilege hierarchy.
 */
export function hasMinimumRole(userRole: string, requiredRole: AppRole): boolean {
  return roleRank(userRole) <= roleRank(requiredRole);
}

// ----------------------------------------------------------------
// Augmented request type
// ----------------------------------------------------------------

export interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  role: AppRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  permissions: string[];
}

/**
 * Extend FastifyRequest with the authenticated user and org context.
 *
 * Route handlers can access `request.user` and `request.organizationId`
 * after the `authenticate` preHandler has run.
 */
declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
    organizationId: string;
  }

  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
  }
}

// ----------------------------------------------------------------
// Core authentication preHandler
// ----------------------------------------------------------------

/**
 * Full authentication preHandler.
 *
 * 1. Extracts the JWT from the Authorization header.
 * 2. Verifies and decodes the token.
 * 3. Loads the user from the database.
 * 4. Verifies the user is active and belongs to the claimed organisation.
 * 5. Decorates `request.user` and `request.organizationId`.
 */
export async function authenticateRequest(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  // 1. Extract the Bearer token
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  // 2. Verify the JWT (uses the @fastify/jwt plugin registered on the instance)
  let payload: JwtPayload;
  try {
    await request.jwtVerify();
    payload = request.user as unknown as JwtPayload;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Invalid or expired token';
    throw new UnauthorizedError(message);
  }

  // 3. Load the full user record from the database
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

  // 4. Ensure the user is active and not soft-deleted
  if (!dbUser.isActive || dbUser.deletedAt !== null) {
    throw new UnauthorizedError('User account is deactivated');
  }

  // Verify the organisation claim in the token matches the database
  if (dbUser.organizationId !== payload.orgId) {
    throw new UnauthorizedError('Organisation mismatch');
  }

  // 5. Decorate the request
  const authUser: AuthUser = {
    id: dbUser.id,
    organizationId: dbUser.organizationId,
    email: dbUser.email,
    role: dbUser.role as AppRole,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    isActive: dbUser.isActive,
    permissions: dbUser.permissions,
  };

  request.user = authUser;
  request.organizationId = dbUser.organizationId;
}

// ----------------------------------------------------------------
// Role-checking preHandler factory
// ----------------------------------------------------------------

/**
 * Creates a preHandler hook that enforces a minimum role requirement.
 *
 * Must be used *after* `authenticateRequest` in the preHandler chain so
 * that `request.user` is populated.
 *
 * Usage:
 *   fastify.get('/admin', {
 *     preHandler: [authenticateRequest, requireRole('LAB_MANAGER')],
 *   }, handler);
 */
export function requireRole(
  minimumRole: AppRole,
): preHandlerHookHandler {
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
}

/**
 * Creates a preHandler hook that enforces the user has one of the listed roles
 * (exact match, not hierarchical).
 *
 * Usage:
 *   fastify.post('/billing', {
 *     preHandler: [authenticateRequest, requireAnyRole(['BILLING_ADMIN', 'LAB_DIRECTOR'])],
 *   }, handler);
 */
export function requireAnyRole(
  allowedRoles: AppRole[],
): preHandlerHookHandler {
  return async function checkAnyRole(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError(
        `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      );
    }
  };
}

/**
 * Creates a preHandler hook that enforces the user has a specific permission
 * string in their `permissions` array.
 *
 * Usage:
 *   fastify.delete('/samples/:id', {
 *     preHandler: [authenticateRequest, requirePermission('samples:delete')],
 *   }, handler);
 */
export function requirePermission(
  permission: string,
): preHandlerHookHandler {
  return async function checkPermission(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Super admins and lab directors bypass permission checks
    if (hasMinimumRole(request.user.role, 'LAB_DIRECTOR')) {
      return;
    }

    if (!request.user.permissions.includes(permission)) {
      throw new ForbiddenError(
        `Missing required permission: ${permission}`,
      );
    }
  };
}

/**
 * A preHandler hook that ensures the request carries an organisation scope,
 * either from the authenticated user or from the X-Organization-Id header
 * (for super admins operating across orgs).
 */
export async function requireOrganization(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (!request.user) {
    throw new UnauthorizedError('Authentication required');
  }

  // Super admins can optionally scope to a different org via header
  if (request.user.role === 'SUPER_ADMIN') {
    const headerOrgId = request.headers['x-organization-id'];
    if (typeof headerOrgId === 'string' && headerOrgId.length > 0) {
      request.organizationId = headerOrgId;
      return;
    }
  }

  if (!request.organizationId) {
    throw new ForbiddenError('Organisation context is required');
  }
}
