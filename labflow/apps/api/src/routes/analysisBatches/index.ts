/**
 * Analysis Batches Routes
 *
 * CRUD for analysis batches with rerun support.  A batch groups samples
 * for joint processing and billing — for sequencing workflows it maps
 * to a SequencingRun, for chemistry it groups instrument runs.
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';
import { generateBatchId } from '@labflow/shared';

const routes: FastifyPluginAsync = async (fastify) => {
  // ================================================================
  // GET / - List batches
  // ================================================================
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = z
      .object({
        category: z.string().optional(),
        status: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(request.query);

    const orgId = request.user.organizationId;
    const where: Record<string, unknown> = { organizationId: orgId };
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;

    const [batches, total] = await Promise.all([
      prisma.analysisBatch.findMany({
        where,
        orderBy: { openedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          items: {
            select: { id: true, status: true, isRerun: true },
          },
          sequencingRun: {
            select: { id: true, runIdentifier: true, status: true },
          },
        },
      }),
      prisma.analysisBatch.count({ where }),
    ]);

    return reply.send({
      data: batches.map((b) => ({
        ...b,
        itemCount: b.items.length,
        completedCount: b.items.filter((i) => i.status === 'COMPLETED').length,
        failedCount: b.items.filter((i) => i.status === 'FAILED').length,
        rerunCount: b.items.filter((i) => i.isRerun).length,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  });

  // ================================================================
  // GET /:id - Get batch detail
  // ================================================================
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const orgId = request.user.organizationId;

    const batch = await prisma.analysisBatch.findFirst({
      where: { id, organizationId: orgId },
      include: {
        items: {
          include: {
            sample: {
              select: {
                id: true,
                sampleNumber: true,
                name: true,
                matrix: true,
                status: true,
                order: { select: { id: true, orderNumber: true, client: { select: { id: true, name: true } } } },
              },
            },
            rerunOfItem: {
              select: { id: true, status: true, notes: true },
            },
            reruns: {
              select: { id: true, status: true, batchId: true, notes: true },
            },
          },
          orderBy: { position: 'asc' },
        },
        sequencingRun: {
          select: { id: true, runIdentifier: true, status: true },
        },
      },
    });

    if (!batch) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Analysis batch not found' },
      });
    }

    return reply.send({ data: batch });
  });

  // ================================================================
  // POST / - Create a new batch
  // ================================================================
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = z
        .object({
          category: z.string(),
          description: z.string().optional(),
          sequencingRunId: z.string().uuid().optional(),
          targetStageKey: z.string().optional(),
          dueDate: z.coerce.date().optional(),
          notes: z.string().optional(),
        })
        .parse(request.body);

      const orgId = request.user.organizationId;
      const userId = request.user.id;

      // Generate batch number
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const existingToday = await prisma.analysisBatch.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: todayStart },
        },
      });
      const batchNumber = generateBatchId(now, existingToday + 1);

      const batch = await prisma.analysisBatch.create({
        data: {
          organizationId: orgId,
          batchNumber,
          category: body.category,
          description: body.description,
          sequencingRunId: body.sequencingRunId,
          targetStageKey: body.targetStageKey,
          dueDate: body.dueDate,
          notes: body.notes,
          createdById: userId,
        },
      });

      return reply.status(201).send({ data: batch });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // ================================================================
  // PATCH /:id - Update batch
  // ================================================================
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = z
        .object({
          status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
          description: z.string().optional(),
          sequencingRunId: z.string().uuid().nullable().optional(),
          targetStageKey: z.string().optional(),
          dueDate: z.coerce.date().nullable().optional(),
          notes: z.string().optional(),
        })
        .parse(request.body);

      const orgId = request.user.organizationId;

      const existing = await prisma.analysisBatch.findFirst({
        where: { id, organizationId: orgId },
      });
      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Analysis batch not found' },
        });
      }

      // If closing the batch, set closedAt
      const updateData: Record<string, unknown> = { ...body };
      if (body.status && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(body.status)) {
        updateData.closedAt = new Date();
      }
      if (body.status === 'OPEN' || body.status === 'IN_PROGRESS') {
        updateData.closedAt = null;
      }

      const updated = await prisma.analysisBatch.update({
        where: { id },
        data: updateData,
      });

      return reply.send({ data: updated });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // ================================================================
  // POST /:id/items - Add sample(s) to batch
  // ================================================================
  fastify.post('/:id/items', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = z
        .object({
          items: z.array(
            z.object({
              sampleId: z.string().uuid(),
              testId: z.string().uuid().optional(),
              position: z.number().int().optional(),
              notes: z.string().optional(),
            }),
          ),
        })
        .parse(request.body);

      const orgId = request.user.organizationId;

      const batch = await prisma.analysisBatch.findFirst({
        where: { id, organizationId: orgId },
      });
      if (!batch) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Analysis batch not found' },
        });
      }
      if (['COMPLETED', 'CANCELLED'].includes(batch.status)) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_STATE',
            message: `Cannot add items to a ${batch.status} batch`,
          },
        });
      }

      const items = await prisma.$transaction(
        body.items.map((item) =>
          prisma.analysisBatchItem.create({
            data: {
              batchId: id,
              sampleId: item.sampleId,
              testId: item.testId,
              position: item.position,
              notes: item.notes,
            },
          }),
        ),
      );

      return reply.status(201).send({ data: items });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // ================================================================
  // POST /:id/items/:itemId/rerun - Create a rerun for a batch item
  // ================================================================
  fastify.post(
    '/:id/items/:itemId/rerun',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const params = z
          .object({
            id: z.string().uuid(),
            itemId: z.string().uuid(),
          })
          .parse(request.params);

        const body = z
          .object({
            rerunReason: z.string(),
            targetBatchId: z.string().uuid().optional(),
            notes: z.string().optional(),
          })
          .parse(request.body);

        const orgId = request.user.organizationId;

        // Validate original item exists
        const originalItem = await prisma.analysisBatchItem.findFirst({
          where: { id: params.itemId, batchId: params.id },
          include: {
            batch: { select: { organizationId: true, category: true } },
          },
        });

        if (!originalItem || originalItem.batch.organizationId !== orgId) {
          return reply.status(404).send({
            error: { code: 'NOT_FOUND', message: 'Batch item not found' },
          });
        }

        // Determine target batch (same or different)
        const targetBatchId = body.targetBatchId ?? params.id;

        // If targeting a different batch, validate it
        if (targetBatchId !== params.id) {
          const targetBatch = await prisma.analysisBatch.findFirst({
            where: { id: targetBatchId, organizationId: orgId },
          });
          if (!targetBatch) {
            return reply.status(404).send({
              error: { code: 'NOT_FOUND', message: 'Target batch not found' },
            });
          }
          if (['COMPLETED', 'CANCELLED'].includes(targetBatch.status)) {
            return reply.status(400).send({
              error: {
                code: 'INVALID_STATE',
                message: `Cannot add rerun to a ${targetBatch.status} batch`,
              },
            });
          }
        }

        // Mark original as FAILED if not already
        if (originalItem.status !== 'FAILED') {
          await prisma.analysisBatchItem.update({
            where: { id: params.itemId },
            data: { status: 'FAILED' },
          });
        }

        // Create the rerun item
        const rerunItem = await prisma.analysisBatchItem.create({
          data: {
            batchId: targetBatchId,
            sampleId: originalItem.sampleId,
            testId: originalItem.testId,
            isRerun: true,
            rerunReason: body.rerunReason,
            rerunOfItemId: params.itemId,
            notes: body.notes,
          },
        });

        return reply.status(201).send({ data: rerunItem });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: err.errors,
            },
          });
        }
        throw err;
      }
    },
  );

  // ================================================================
  // PATCH /:id/items/:itemId - Update a batch item status
  // ================================================================
  fastify.patch(
    '/:id/items/:itemId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const params = z
          .object({
            id: z.string().uuid(),
            itemId: z.string().uuid(),
          })
          .parse(request.params);

        const body = z
          .object({
            status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']).optional(),
            position: z.number().int().optional(),
            notes: z.string().optional(),
          })
          .parse(request.body);

        const orgId = request.user.organizationId;

        const item = await prisma.analysisBatchItem.findFirst({
          where: { id: params.itemId, batchId: params.id },
          include: { batch: { select: { organizationId: true } } },
        });

        if (!item || item.batch.organizationId !== orgId) {
          return reply.status(404).send({
            error: { code: 'NOT_FOUND', message: 'Batch item not found' },
          });
        }

        const updateData: Record<string, unknown> = { ...body };
        if (body.status === 'COMPLETED') {
          updateData.completedAt = new Date();
        }

        const updated = await prisma.analysisBatchItem.update({
          where: { id: params.itemId },
          data: updateData,
        });

        return reply.send({ data: updated });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: err.errors,
            },
          });
        }
        throw err;
      }
    },
  );

  // ================================================================
  // DELETE /:id/items/:itemId - Remove item from batch
  // ================================================================
  fastify.delete(
    '/:id/items/:itemId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const params = z
        .object({
          id: z.string().uuid(),
          itemId: z.string().uuid(),
        })
        .parse(request.params);

      const orgId = request.user.organizationId;

      const item = await prisma.analysisBatchItem.findFirst({
        where: { id: params.itemId, batchId: params.id },
        include: { batch: { select: { organizationId: true } } },
      });

      if (!item || item.batch.organizationId !== orgId) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Batch item not found' },
        });
      }

      await prisma.analysisBatchItem.delete({
        where: { id: params.itemId },
      });

      return reply.status(204).send();
    },
  );
};

export default routes;
