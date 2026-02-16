/**
 * Fastify plugin that registers @fastify/jwt and decorates the request
 * with a `jwtVerify` method and an `authenticate` preHandler hook.
 *
 * After this plugin is registered, route handlers can use:
 *   - `request.jwtVerify()` to manually verify a token
 *   - The `authenticate` decorator as a preHandler to protect routes
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import { UnauthorizedError } from '../utils/errors.js';

export interface JwtPayload {
  sub: string;          // userId
  orgId: string;        // organizationId
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

async function authPlugin(fastify: FastifyInstance): Promise<void> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  await fastify.register(fjwt, {
    secret,
    sign: {
      algorithm: 'HS256',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
    verify: {
      algorithms: ['HS256'],
    },
    decoratorName: 'jwt',
  });

  /**
   * Decorate the Fastify instance with an `authenticate` method that can be
   * used as a preHandler on individual routes or route groups.
   *
   * Usage:
   *   fastify.get('/protected', { preHandler: [fastify.authenticate] }, handler)
   */
  fastify.decorate(
    'authenticate',
    async function authenticateHandler(
      request: FastifyRequest,
      _reply: FastifyReply,
    ): Promise<void> {
      try {
        await request.jwtVerify();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Invalid or expired token';
        throw new UnauthorizedError(message);
      }
    },
  );
}

export default fp(authPlugin, {
  name: 'auth',
  fastify: '4.x',
});
