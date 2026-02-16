/**
 * Rate limiting configuration for the LabFlow API.
 *
 * Uses @fastify/rate-limit with optional Redis backing for distributed
 * deployments. Falls back to an in-memory store when Redis is not configured.
 *
 * Rate limits are tiered:
 *   - Global default:  100 requests / minute
 *   - Auth endpoints:   10 requests / minute  (to prevent brute-force)
 *   - File uploads:     20 requests / minute
 *   - Reporting:        30 requests / minute
 */

import { type FastifyInstance, type FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';

// ----------------------------------------------------------------
// Redis store (optional)
// ----------------------------------------------------------------

function createRedisStore(): Redis | undefined {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return undefined;

  try {
    return new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  } catch {
    return undefined;
  }
}

// ----------------------------------------------------------------
// Key generator
// ----------------------------------------------------------------

/**
 * Generate a rate-limit key from the authenticated user ID or, for
 * unauthenticated requests, from the client IP address.
 */
function keyGenerator(request: FastifyRequest): string {
  const user = (request as FastifyRequest & { user?: { id: string } }).user;
  if (user?.id) {
    return `rl:user:${user.id}`;
  }
  // Respect X-Forwarded-For when behind a reverse proxy
  const forwarded = request.headers['x-forwarded-for'];
  const ip =
    typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : request.ip;
  return `rl:ip:${ip}`;
}

// ----------------------------------------------------------------
// Plugin
// ----------------------------------------------------------------

async function rateLimiterPlugin(fastify: FastifyInstance): Promise<void> {
  const redis = createRedisStore();

  const globalMax = Number(process.env.RATE_LIMIT_MAX) || 100;
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000; // 1 minute

  await fastify.register(rateLimit, {
    global: true,
    max: globalMax,
    timeWindow: windowMs,
    keyGenerator,
    ...(redis
      ? {
          redis,
        }
      : {}),
    // Custom error response to match our standard error envelope
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'RateLimitError',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded. You can make ${context.max} requests per ${Math.round(context.ttl / 1000)}s. Please retry after ${Math.round(context.ttl / 1000)} seconds.`,
    }),
    // Add standard rate-limit headers
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    // Exempt health checks and documentation
    allowList: (request: FastifyRequest) => {
      const url = request.url.split('?')[0];
      return url === '/health' || url.startsWith('/docs');
    },
  });
}

export default fp(rateLimiterPlugin, {
  name: 'rateLimiter',
  fastify: '4.x',
});

// ----------------------------------------------------------------
// Per-route rate limit configs (used as route options)
// ----------------------------------------------------------------

/**
 * Stricter rate limit for authentication endpoints (login, register, etc.).
 * 10 requests per minute to slow down brute-force attacks.
 */
export const authRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: 60_000,
      keyGenerator,
    },
  },
};

/**
 * Rate limit for file upload endpoints.
 * 20 uploads per minute.
 */
export const uploadRateLimit = {
  config: {
    rateLimit: {
      max: 20,
      timeWindow: 60_000,
      keyGenerator,
    },
  },
};

/**
 * Rate limit for report generation endpoints (PDF, export, etc.).
 * 30 requests per minute.
 */
export const reportRateLimit = {
  config: {
    rateLimit: {
      max: 30,
      timeWindow: 60_000,
      keyGenerator,
    },
  },
};
