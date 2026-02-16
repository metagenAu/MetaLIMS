/**
 * CORS plugin configuration for the LabFlow API.
 *
 * In development, allows all origins for convenience.
 * In production, restricts to the configured allowed origins.
 */

import { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';

async function corsPlugin(fastify: FastifyInstance): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';

  // Comma-separated list of allowed origins, e.g.:
  //   CORS_ORIGINS=https://app.labflow.io,https://portal.labflow.io
  const configuredOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : [];

  await fastify.register(cors, {
    origin: isProduction
      ? (origin, callback) => {
          // Allow requests with no origin (server-to-server, curl, etc.)
          if (!origin) {
            callback(null, true);
            return;
          }
          if (configuredOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`Origin ${origin} not allowed by CORS`), false);
          }
        }
      : true, // Allow all origins in development

    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Organization-Id',
      'Accept',
      'Origin',
      'Cache-Control',
    ],

    exposedHeaders: [
      'X-Request-Id',
      'X-Total-Count',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],

    credentials: true,

    // Cache preflight response for 24 hours
    maxAge: 86400,

    // Enable preflight pass-through to the next handler
    preflight: true,
    strictPreflight: true,
  });
}

export default fp(corsPlugin, {
  name: 'cors',
  fastify: '4.x',
});
