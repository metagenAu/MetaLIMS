/**
 * Structured pino logger for the LabFlow API.
 *
 * - Assigns a unique request ID to every incoming request.
 * - Uses pino-pretty in development for human-readable output.
 * - Produces structured JSON logs in production for log aggregation.
 */

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

/**
 * Root logger instance. Import this directly for non-request-scoped logging
 * (e.g., startup messages, background job logs).
 */
export const logger = pino({
  level: logLevel,
  ...(isProduction
    ? {
        // Structured JSON in production
        formatters: {
          level(label: string) {
            return { level: label };
          },
          bindings(bindings: pino.Bindings) {
            return {
              pid: bindings.pid,
              host: bindings.hostname,
              service: 'labflow-api',
            };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {
        // Pretty-print in development
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        },
      }),
  // Redact sensitive fields from logs
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.passwordHash',
      'body.mfaSecret',
      'body.stripeAccountId',
      'body.stripeCustomerId',
    ],
    censor: '[REDACTED]',
  },
});

/**
 * Fastify-compatible logger options. Pass this to the Fastify constructor
 * so that every request gets a child logger with a unique `reqId`.
 */
export const fastifyLoggerOptions = {
  logger: {
    level: logLevel,
    ...(isProduction
      ? {
          formatters: {
            level(label: string) {
              return { level: label };
            },
          },
          timestamp: pino.stdTimeFunctions.isoTime,
        }
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
              singleLine: false,
            },
          },
        }),
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      req(request: { method: string; url: string; id: string }) {
        return {
          method: request.method,
          url: request.url,
          reqId: request.id,
        };
      },
      res(reply: { statusCode: number }) {
        return {
          statusCode: reply.statusCode,
        };
      },
    },
  },
  // Custom request ID generator
  genReqId: (request: { headers: Record<string, string | string[] | undefined> }) => {
    // Honour an incoming X-Request-Id if present (e.g., from an API gateway),
    // otherwise generate a new one.
    const incoming = request.headers['x-request-id'];
    if (typeof incoming === 'string' && incoming.length > 0) {
      return incoming;
    }
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  },
};

export default logger;
