/**
 * LabFlow API - Main Fastify server entry point.
 *
 * Bootstraps the Fastify instance with all plugins, middleware, and routes,
 * then starts listening on the configured port.
 */

import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';

import { fastifyLoggerOptions } from './utils/logger.js';
import { isAppError, AppError, ValidationError } from './utils/errors.js';

// Plugins
import authPlugin from './plugins/auth.js';
import corsPlugin from './plugins/cors.js';

// Middleware
import rateLimiterPlugin from './middleware/rateLimiter.js';
import auditLogPlugin from './middleware/auditLog.js';

// ----------------------------------------------------------------
// Server factory
// ----------------------------------------------------------------

export async function buildServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    ...fastifyLoggerOptions,
    // Trust the first proxy (e.g., nginx, ALB) only when explicitly configured
    trustProxy: process.env.TRUST_PROXY === 'true',
    // Increase default body limit to 10MB for file uploads
    bodyLimit: 10 * 1024 * 1024,
    // Case-insensitive routing
    caseSensitive: false,
    // Request ID header
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
  });

  // ---------------------------------------------------------------
  // 1. Core plugins
  // ---------------------------------------------------------------

  // CORS - must be registered first
  await fastify.register(corsPlugin);

  // Cookie support (used for refresh tokens)
  const cookieSecret = process.env.COOKIE_SECRET;
  if (!cookieSecret && process.env.NODE_ENV === 'production') {
    throw new Error('COOKIE_SECRET environment variable is required in production');
  }
  await fastify.register(cookie, {
    secret: cookieSecret || process.env.JWT_SECRET || 'labflow-dev-cookie-secret',
    parseOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    },
  });

  // Multipart support for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max file size
      files: 10,                   // Max 10 files per request
      fields: 20,                  // Max 20 non-file fields
    },
    attachFieldsToBody: false,
  });

  // ---------------------------------------------------------------
  // 2. Security plugins
  // ---------------------------------------------------------------

  // Rate limiting
  await fastify.register(rateLimiterPlugin);

  // JWT authentication
  await fastify.register(authPlugin);

  // ---------------------------------------------------------------
  // 3. Audit log (depends on auth plugin)
  // ---------------------------------------------------------------

  await fastify.register(auditLogPlugin);

  // ---------------------------------------------------------------
  // 4. Request / response decorations
  // ---------------------------------------------------------------

  // Decorate request with default user and organizationId
  fastify.decorateRequest('user', undefined);
  fastify.decorateRequest('organizationId', '');

  // Add X-Request-Id and security headers to every response
  fastify.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('x-xss-protection', '0');
    reply.header('referrer-policy', 'strict-origin-when-cross-origin');
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
    }
  });

  // ---------------------------------------------------------------
  // 5. Health check (unprotected)
  // ---------------------------------------------------------------

  fastify.get('/health', async (_request, _reply) => {
    return {
      status: 'ok',
      service: 'labflow-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.1.0',
    };
  });

  fastify.get('/health/ready', async (_request, _reply) => {
    // Check critical dependencies
    const checks: Record<string, string> = {};

    // Database connectivity
    try {
      const { prisma } = await import('@labflow/db');
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');

    return {
      status: allOk ? 'ok' : 'degraded',
      service: 'labflow-api',
      timestamp: new Date().toISOString(),
      checks,
    };
  });

  // ---------------------------------------------------------------
  // 6. API routes (v1)
  // ---------------------------------------------------------------

  // All v1 routes are registered under the /api/v1 prefix.
  // Each route module is responsible for its own auth preHandlers.
  await fastify.register(
    async function v1Routes(v1: FastifyInstance) {
      await v1.register(import('./routes/auth/index.js'), { prefix: '/auth' });
      await v1.register(import('./routes/samples/index.js'), { prefix: '/samples' });
      await v1.register(import('./routes/tests/index.js'), { prefix: '/tests' });
      await v1.register(import('./routes/orders/index.js'), { prefix: '/orders' });
      await v1.register(import('./routes/clients/index.js'), { prefix: '/clients' });
      await v1.register(import('./routes/invoices/index.js'), { prefix: '/invoices' });
      await v1.register(import('./routes/payments/index.js'), { prefix: '/payments' });
      await v1.register(import('./routes/reports/index.js'), { prefix: '/reports' });
      await v1.register(import('./routes/users/index.js'), { prefix: '/users' });
      await v1.register(import('./routes/instruments/index.js'), { prefix: '/instruments' });
      await v1.register(import('./routes/specifications/index.js'), { prefix: '/specifications' });
      await v1.register(import('./routes/testMethods/index.js'), { prefix: '/test-methods' });
      await v1.register(import('./routes/storage/index.js'), { prefix: '/storage' });
      await v1.register(import('./routes/priceLists/index.js'), { prefix: '/price-lists' });
      await v1.register(import('./routes/projects/index.js'), { prefix: '/projects' });
      await v1.register(import('./routes/dashboard/index.js'), { prefix: '/dashboard' });
      await v1.register(import('./routes/notifications/index.js'), { prefix: '/notifications' });
      await v1.register(import('./routes/audit/index.js'), { prefix: '/audit' });
      await v1.register(import('./routes/webhooks/index.js'), { prefix: '/webhooks' });

      // Sample Tracking & Analysis Batches
      await v1.register((await import('./routes/sampleTracking/index.js')).default, { prefix: '/sample-tracking' });
      await v1.register((await import('./routes/analysisBatches/index.js')).default, { prefix: '/analysis-batches' });

      // Metabarcoding / Sequencing module
      await v1.register((await import('./routes/sequencingRuns/index.js')).default, { prefix: '/sequencing-runs' });
      await v1.register((await import('./routes/indexPlates/index.js')).default, { prefix: '/index-plates' });

      // Default 404 for the v1 scope
      v1.setNotFoundHandler(async (request, _reply) => {
        return {
          statusCode: 404,
          error: 'NotFoundError',
          code: 'ROUTE_NOT_FOUND',
          message: `Route ${request.method} ${request.url} not found`,
        };
      });
    },
    { prefix: '/api/v1' },
  );

  // ---------------------------------------------------------------
  // 7. Global error handler
  // ---------------------------------------------------------------

  fastify.setErrorHandler(async (error: FastifyError | Error, request, reply) => {
    // Handle our custom AppError subclasses
    if (isAppError(error)) {
      request.log.warn(
        { err: error, statusCode: error.statusCode },
        error.message,
      );
      return reply.status(error.statusCode).send(error.toJSON());
    }

    // Handle Zod validation errors
    if (error.name === 'ZodError' && 'issues' in error) {
      const validationError = new ValidationError('Request validation failed', (error as unknown as { issues: unknown }).issues);
      request.log.warn(
        { err: error, statusCode: 400 },
        'Validation error',
      );
      return reply.status(400).send(validationError.toJSON());
    }

    // Handle Fastify-native validation errors (JSON schema)
    if ('validation' in error && (error as FastifyError).validation) {
      const validationError = new ValidationError(
        error.message,
        (error as FastifyError).validation,
      );
      request.log.warn(
        { err: error, statusCode: 400 },
        'Schema validation error',
      );
      return reply.status(400).send(validationError.toJSON());
    }

    // Handle rate-limit errors from @fastify/rate-limit
    if ((error as FastifyError).statusCode === 429) {
      return reply.status(429).send({
        statusCode: 429,
        error: 'RateLimitError',
        code: 'RATE_LIMIT_EXCEEDED',
        message: error.message,
      });
    }

    // Handle Prisma known errors
    if (error.name === 'PrismaClientKnownRequestError') {
      const prismaError = error as Error & { code: string; meta?: { target?: string[]; field_name?: string; cause?: string } };
      if (prismaError.code === 'P2002') {
        request.log.warn({ err: error }, 'Unique constraint violation');
        return reply.status(409).send({
          statusCode: 409,
          error: 'ConflictError',
          code: 'CONFLICT',
          message: 'A record with this value already exists',
          details: { fields: prismaError.meta?.target },
        });
      }
      if (prismaError.code === 'P2003') {
        request.log.warn({ err: error }, 'Foreign key constraint violation');
        return reply.status(400).send({
          statusCode: 400,
          error: 'ValidationError',
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'Referenced record does not exist',
          details: { field: prismaError.meta?.field_name },
        });
      }
      if (prismaError.code === 'P2025') {
        request.log.warn({ err: error }, 'Record not found');
        return reply.status(404).send({
          statusCode: 404,
          error: 'NotFoundError',
          code: 'NOT_FOUND',
          message: 'The requested record was not found',
        });
      }
    }

    // Unhandled / unexpected errors
    const statusCode = (error as FastifyError).statusCode || 500;
    request.log.error(
      { err: error, statusCode },
      'Unhandled error',
    );

    // Only leak internal error details in development (not staging or production)
    const isDevelopment = process.env.NODE_ENV === 'development';
    return reply.status(statusCode).send({
      statusCode,
      error: 'InternalError',
      code: 'INTERNAL_ERROR',
      message: isDevelopment
        ? error.message
        : 'An internal server error occurred',
      ...(isDevelopment ? { stack: error.stack } : {}),
    });
  });

  // ---------------------------------------------------------------
  // 8. Graceful shutdown
  // ---------------------------------------------------------------

  const shutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}. Starting graceful shutdown...`);

    try {
      await fastify.close();
      fastify.log.info('Server closed successfully');

      // Close Prisma connection
      try {
        const { prisma } = await import('@labflow/db');
        await prisma.$disconnect();
        fastify.log.info('Database connection closed');
      } catch {
        // Already disconnected
      }

      process.exit(0);
    } catch (err) {
      fastify.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return fastify;
}

// ----------------------------------------------------------------
// Start the server
// ----------------------------------------------------------------

async function main(): Promise<void> {
  const server = await buildServer();

  const port = Number(process.env.API_PORT) || 4000;
  const host = process.env.API_HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    server.log.info(
      `LabFlow API server listening on http://${host}:${port}`,
    );
    server.log.info(
      `Environment: ${process.env.NODE_ENV || 'development'}`,
    );
  } catch (err) {
    server.log.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

main();
