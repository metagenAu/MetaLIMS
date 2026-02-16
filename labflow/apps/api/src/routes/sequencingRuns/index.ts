import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';
import { requireRole } from '../../middleware/auth.js';
import { validateRunStatusTransition } from '../../services/sequencingService.js';

// ----------------------------------------------------------------
// Zod Schemas
// ----------------------------------------------------------------

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const RunFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  status: z.enum([
    'SETUP', 'DNA_EXTRACTED', 'PCR_IN_PROGRESS', 'POOLED', 'SUBMITTED', 'SEQUENCED',
  ]).optional(),
});

const CreateRunSchema = z.object({
  runIdentifier: z.string().min(1),
  dateStarted: z.coerce.date().optional().nullable(),
  poolConfig: z.any().optional(),
  notes: z.string().optional().nullable(),
});

const UpdateRunSchema = z.object({
  runIdentifier: z.string().min(1).optional(),
  dateStarted: z.coerce.date().optional().nullable(),
  poolConfig: z.any().optional(),
  notes: z.string().optional().nullable(),
});

const StatusTransitionSchema = z.object({
  status: z.string().min(1),
});

// ----------------------------------------------------------------
// Routes
// ----------------------------------------------------------------

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List sequencing runs with filters and pagination
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = RunFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, status } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { runIdentifier: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (status) where.status = status;

      const [runs, total] = await Promise.all([
        prisma.sequencingRun.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            _count: { select: { dnaPlates: true, pcrPlates: true, poolDefinitions: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        prisma.sequencingRun.count({ where }),
      ]);

      return reply.send({
        data: runs,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: err.errors },
        });
      }
      throw err;
    }
  });

  // POST / - Create a new sequencing run (LAB_MANAGER+)
  fastify.post('/', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const body = CreateRunSchema.parse(request.body);

      // Check for duplicate runIdentifier within the org
      const existing = await prisma.sequencingRun.findFirst({
        where: {
          organizationId: request.user.organizationId,
          runIdentifier: body.runIdentifier,
        },
      });

      if (existing) {
        return reply.status(409).send({
          error: { code: 'CONFLICT', message: `A run with identifier "${body.runIdentifier}" already exists`, details: null },
        });
      }

      const run = await prisma.sequencingRun.create({
        data: {
          organizationId: request.user.organizationId,
          runIdentifier: body.runIdentifier,
          status: 'SETUP',
          dateStarted: body.dateStarted ?? null,
          poolConfig: body.poolConfig ?? [],
          notes: body.notes ?? null,
          createdById: request.user.id,
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'SequencingRun',
          entityId: run.id,
          details: { runIdentifier: body.runIdentifier },
        },
      });

      return reply.status(201).send({ data: run });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:runId - Get a single sequencing run with counts
  fastify.get('/:runId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
      include: {
        _count: { select: { dnaPlates: true, pcrPlates: true, poolDefinitions: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!run) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null },
      });
    }

    return reply.send({ data: run });
  });

  // PATCH /:runId - Update sequencing run metadata (LAB_MANAGER+)
  fastify.patch('/:runId', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params);
      const body = UpdateRunSchema.parse(request.body);

      const existing = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null },
        });
      }

      // If runIdentifier is being changed, check for uniqueness within the org
      if (body.runIdentifier && body.runIdentifier !== existing.runIdentifier) {
        const duplicate = await prisma.sequencingRun.findFirst({
          where: {
            organizationId: request.user.organizationId,
            runIdentifier: body.runIdentifier,
            id: { not: runId },
          },
        });

        if (duplicate) {
          return reply.status(409).send({
            error: { code: 'CONFLICT', message: `A run with identifier "${body.runIdentifier}" already exists`, details: null },
          });
        }
      }

      const run = await prisma.sequencingRun.update({
        where: { id: runId },
        data: { ...body, updatedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'SequencingRun',
          entityId: runId,
          details: { changes: body },
        },
      });

      return reply.send({ data: run });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // DELETE /:runId - Delete a sequencing run (LAB_MANAGER+, only if SETUP status)
  fastify.delete('/:runId', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params);

    const existing = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });

    if (!existing) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null },
      });
    }

    if (existing.status !== 'SETUP') {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: 'Can only delete runs in SETUP status', details: null },
      });
    }

    await prisma.sequencingRun.delete({
      where: { id: runId },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'DELETE',
        entityType: 'SequencingRun',
        entityId: runId,
        details: { runIdentifier: existing.runIdentifier },
      },
    });

    return reply.status(204).send();
  });

  // POST /:runId/status - Transition run status
  fastify.post('/:runId/status', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params);
      const body = StatusTransitionSchema.parse(request.body);

      const existing = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null },
        });
      }

      // Validate the status transition (throws ConflictError if invalid)
      validateRunStatusTransition(existing.status, body.status);

      const run = await prisma.sequencingRun.update({
        where: { id: runId },
        data: {
          status: body.status as any,
          updatedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'STATUS_CHANGE',
          entityType: 'SequencingRun',
          entityId: runId,
          details: { changes: { previousStatus: existing.status, newStatus: body.status } },
        },
      });

      return reply.send({ data: run });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // ----------------------------------------------------------------
  // Register sub-route plugins
  // ----------------------------------------------------------------

  await fastify.register(import('./dnaPlates.js'), { prefix: '/:runId/dna-plates' });
  await fastify.register(import('./pcrPlates.js'), { prefix: '/:runId/pcr-plates' });
  await fastify.register(import('./pools.js'), { prefix: '/:runId/pools' });
  await fastify.register(import('./reagents.js'), { prefix: '/:runId/reagents' });
};

export default routes;
