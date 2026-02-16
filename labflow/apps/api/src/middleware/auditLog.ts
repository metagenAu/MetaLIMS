/**
 * Automatic audit trail middleware for the LabFlow API.
 *
 * Intercepts mutating HTTP methods (POST, PUT, PATCH, DELETE) and writes
 * an audit log entry capturing:
 *   - The authenticated user who performed the action
 *   - The HTTP method and URL (used to derive entity type / action)
 *   - The before-state (for updates/deletes)
 *   - The after-state (for creates/updates)
 *   - Client metadata (IP address, user agent)
 *
 * Audit entries are written asynchronously after the response is sent so
 * they do not add latency to the request.
 */

import {
  type FastifyInstance,
  type FastifyRequest,
  type FastifyReply,
} from 'fastify';
import fp from 'fastify-plugin';
import { prisma } from '@labflow/db';
import type { AuthUser } from './auth.js';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

interface AuditContext {
  entityType: string;
  entityId: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

declare module 'fastify' {
  interface FastifyRequest {
    auditContext?: AuditContext;
  }
}

// HTTP methods that represent mutations
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Routes that should not be audited (health checks, auth, etc.)
const EXCLUDED_PREFIXES = [
  '/health',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/metrics',
  '/docs',
];

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/**
 * Derive the entity type and action from the request method and URL.
 *
 * Examples:
 *   POST   /api/v1/samples          -> { entityType: 'Sample',  action: 'CREATE' }
 *   PATCH  /api/v1/samples/abc123   -> { entityType: 'Sample',  action: 'UPDATE' }
 *   DELETE /api/v1/orders/xyz       -> { entityType: 'Order',   action: 'DELETE' }
 */
function deriveAuditMeta(
  method: string,
  url: string,
): { entityType: string; action: string; entityId: string | null } {
  // Strip query string
  const pathname = url.split('?')[0];

  // Split segments and drop the api/v1 prefix
  const segments = pathname.split('/').filter(Boolean);
  const apiIndex = segments.indexOf('api');
  const resourceSegments =
    apiIndex !== -1 ? segments.slice(apiIndex + 2) : segments;

  // The first segment is the resource name (pluralised)
  const resourcePlural = resourceSegments[0] || 'unknown';
  const entityType = singularise(resourcePlural);

  // If there is a second segment it is likely the entity ID
  const entityId = resourceSegments[1] || null;

  let action: string;
  switch (method) {
    case 'POST':
      action = 'CREATE';
      break;
    case 'PUT':
    case 'PATCH':
      action = 'UPDATE';
      break;
    case 'DELETE':
      action = 'DELETE';
      break;
    default:
      action = method;
  }

  return { entityType, action, entityId };
}

/**
 * Naively singularise a resource name for the audit log.
 * Covers common LIMS entities; falls back to removing trailing 's'.
 */
function singularise(word: string): string {
  const irregulars: Record<string, string> = {
    analyses: 'Analysis',
    matrices: 'Matrix',
    entries: 'Entry',
    statuses: 'Status',
    companies: 'Company',
    categories: 'Category',
  };

  const lower = word.toLowerCase();
  if (irregulars[lower]) return irregulars[lower];

  // PascalCase the singular form
  const singular = lower.endsWith('s') ? lower.slice(0, -1) : lower;
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}

/**
 * Compute a shallow diff between two objects, returning only the changed fields.
 */
function computeChanges(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  if (!before && after) {
    // Entity was created, record all fields as new
    for (const [key, value] of Object.entries(after)) {
      changes[key] = { old: null, new: value };
    }
    return changes;
  }

  if (before && !after) {
    // Entity was deleted, record all fields as old
    for (const [key, value] of Object.entries(before)) {
      changes[key] = { old: value, new: null };
    }
    return changes;
  }

  if (before && after) {
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of allKeys) {
      const oldVal = before[key];
      const newVal = after[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[key] = { old: oldVal ?? null, new: newVal ?? null };
      }
    }
  }

  return changes;
}

/**
 * Get the client IP address, respecting X-Forwarded-For if behind a proxy.
 */
function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return request.ip;
}

// ----------------------------------------------------------------
// Plugin
// ----------------------------------------------------------------

async function auditLogPlugin(fastify: FastifyInstance): Promise<void> {
  /**
   * Decorator to allow route handlers to set the audit context explicitly.
   *
   * Usage inside a handler:
   *   request.auditContext = {
   *     entityType: 'Sample',
   *     entityId: sample.id,
   *     action: 'CREATE',
   *     before: undefined,
   *     after: sampleRecord,
   *   };
   */
  fastify.decorateRequest('auditContext', undefined);

  // ---- onResponse hook: write the audit log entry ----
  fastify.addHook(
    'onResponse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Only audit mutating requests that succeeded (2xx / 3xx)
      if (!MUTATING_METHODS.has(request.method)) return;
      if (reply.statusCode >= 400) return;

      // Skip excluded routes
      const pathname = request.url.split('?')[0];
      if (EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;

      // We need an authenticated user to attribute the action
      const user = (request as FastifyRequest & { user?: AuthUser }).user;
      if (!user) return;

      try {
        let entityType: string;
        let entityId: string;
        let action: string;
        let changes: Record<string, unknown>;

        if (request.auditContext) {
          // Handler explicitly set the audit context
          entityType = request.auditContext.entityType;
          entityId = request.auditContext.entityId;
          action = request.auditContext.action;
          changes = computeChanges(
            request.auditContext.before,
            request.auditContext.after,
          );
        } else {
          // Fall back to deriving from the URL
          const meta = deriveAuditMeta(request.method, request.url);
          entityType = meta.entityType;
          entityId = meta.entityId || 'unknown';
          action = meta.action;
          changes = {};

          // Try to extract the entity ID from the response body
          // (Fastify does not expose the serialized body in onResponse,
          //  so we rely on the auditContext decoration for detailed diffs)
        }

        await prisma.auditLog.create({
          data: {
            organizationId: user.organizationId,
            userId: user.id,
            entityType,
            entityId,
            action,
            changes,
            metadata: {
              method: request.method,
              url: request.url,
              statusCode: reply.statusCode,
            },
            ipAddress: getClientIp(request),
            userAgent: request.headers['user-agent'] || null,
          },
        });
      } catch (err) {
        // Audit logging must never cause a request to fail
        request.log.error(
          { err, method: request.method, url: request.url },
          'Failed to write audit log entry',
        );
      }
    },
  );
}

export default fp(auditLogPlugin, {
  name: 'auditLog',
  fastify: '4.x',
  dependencies: ['auth'],
});

export { computeChanges, deriveAuditMeta, getClientIp };
