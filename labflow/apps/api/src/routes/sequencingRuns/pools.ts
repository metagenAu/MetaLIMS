import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';
import { requireRole } from '../../middleware/auth.js';
import {
  detectIndexCollisions,
  validateControlPlacement,
  generateOpentronsCsv,
  generateIlluminaSampleSheet,
} from '../../services/sequencingService.js';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const CreatePoolSchema = z.object({
  poolName: z.string().min(1).max(255),
  assayRatios: z.record(z.number()).optional(),
  notes: z.string().optional().nullable(),
});

const UpdatePoolSchema = z.object({
  poolName: z.string().min(1).max(255).optional(),
  assayRatios: z.record(z.number()).optional(),
  notes: z.string().optional().nullable(),
});

const AssignPlateSchema = z.object({
  pcrPlateId: z.string().uuid(),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / — List pools for a run
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params);
      const query = PaginationSchema.parse(request.query);
      const { page, pageSize } = query;
      const skip = (page - 1) * pageSize;

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const [pools, total] = await Promise.all([
        prisma.poolDefinition.findMany({
          where: { sequencingRunId: runId },
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            plateAssignments: {
              include: { pcrPlate: { select: { id: true, plateIdentifier: true, pcrAssay: true } } },
            },
          },
        }),
        prisma.poolDefinition.count({ where: { sequencingRunId: runId } }),
      ]);

      return reply.send({
        data: pools,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: err.errors } });
      }
      throw err;
    }
  });

  // POST / — Create pool
  fastify.post('/', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params);
      const body = CreatePoolSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      // Check for duplicate pool name
      const existing = await prisma.poolDefinition.findFirst({
        where: { sequencingRunId: runId, poolName: body.poolName },
      });
      if (existing) {
        return reply.status(409).send({ error: { code: 'DUPLICATE', message: `Pool "${body.poolName}" already exists for this run`, details: null } });
      }

      const pool = await prisma.poolDefinition.create({
        data: {
          sequencingRunId: runId,
          poolName: body.poolName,
          assayRatios: body.assayRatios || {},
          notes: body.notes,
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'PoolDefinition',
          entityId: pool.id,
          changes: { poolName: body.poolName, runId },
        },
      });

      return reply.status(201).send({ data: pool });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      }
      throw err;
    }
  });

  // GET /:poolId — Get pool with plates and collision summary
  fastify.get('/:poolId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { runId, poolId } = z.object({ runId: z.string().uuid(), poolId: z.string().uuid() }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    const pool = await prisma.poolDefinition.findFirst({
      where: { id: poolId, sequencingRunId: runId },
      include: {
        plateAssignments: {
          include: {
            pcrPlate: {
              select: { id: true, plateIdentifier: true, pcrAssay: true, status: true },
            },
          },
        },
      },
    });

    if (!pool) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Pool not found', details: null } });
    }

    return reply.send({ data: pool });
  });

  // PATCH /:poolId — Update pool
  fastify.patch('/:poolId', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId, poolId } = z.object({ runId: z.string().uuid(), poolId: z.string().uuid() }).parse(request.params);
      const body = UpdatePoolSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const existing = await prisma.poolDefinition.findFirst({
        where: { id: poolId, sequencingRunId: runId },
      });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Pool not found', details: null } });
      }

      const pool = await prisma.poolDefinition.update({
        where: { id: poolId },
        data: { ...body, updatedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'PoolDefinition',
          entityId: poolId,
          changes: { changes: body },
        },
      });

      return reply.send({ data: pool });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      }
      throw err;
    }
  });

  // DELETE /:poolId — Delete pool
  fastify.delete('/:poolId', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    const { runId, poolId } = z.object({ runId: z.string().uuid(), poolId: z.string().uuid() }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    const existing = await prisma.poolDefinition.findFirst({
      where: { id: poolId, sequencingRunId: runId },
    });
    if (!existing) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Pool not found', details: null } });
    }

    await prisma.poolDefinition.delete({ where: { id: poolId } });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'DELETE',
        entityType: 'PoolDefinition',
        entityId: poolId,
        changes: { poolName: existing.poolName },
      },
    });

    return reply.status(204).send();
  });

  // POST /:poolId/plates — Assign PCR plate to pool
  fastify.post('/:poolId/plates', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId, poolId } = z.object({ runId: z.string().uuid(), poolId: z.string().uuid() }).parse(request.params);
      const body = AssignPlateSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const pool = await prisma.poolDefinition.findFirst({
        where: { id: poolId, sequencingRunId: runId },
      });
      if (!pool) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Pool not found', details: null } });
      }

      // Verify PCR plate belongs to this run
      const pcrPlate = await prisma.pCRPlate.findFirst({
        where: { id: body.pcrPlateId, sequencingRunId: runId },
      });
      if (!pcrPlate) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'PCR plate not found in this run', details: null } });
      }

      // Check for duplicate assignment
      const existingAssignment = await prisma.poolPlateAssignment.findFirst({
        where: { poolDefinitionId: poolId, pcrPlateId: body.pcrPlateId },
      });
      if (existingAssignment) {
        return reply.status(409).send({ error: { code: 'DUPLICATE', message: 'PCR plate is already assigned to this pool', details: null } });
      }

      const assignment = await prisma.poolPlateAssignment.create({
        data: {
          poolDefinitionId: poolId,
          pcrPlateId: body.pcrPlateId,
        },
        include: {
          pcrPlate: { select: { id: true, plateIdentifier: true, pcrAssay: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'ASSIGN_PLATE',
          entityType: 'PoolDefinition',
          entityId: poolId,
          changes: { pcrPlateId: body.pcrPlateId, plateIdentifier: pcrPlate.plateIdentifier },
        },
      });

      return reply.status(201).send({ data: assignment });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      }
      throw err;
    }
  });

  // DELETE /:poolId/plates/:pcrPlateId — Remove PCR plate from pool
  fastify.delete('/:poolId/plates/:pcrPlateId', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    const { runId, poolId, pcrPlateId } = z.object({
      runId: z.string().uuid(),
      poolId: z.string().uuid(),
      pcrPlateId: z.string().uuid(),
    }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    const assignment = await prisma.poolPlateAssignment.findFirst({
      where: { poolDefinitionId: poolId, pcrPlateId },
    });
    if (!assignment) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Plate assignment not found', details: null } });
    }

    await prisma.poolPlateAssignment.delete({ where: { id: assignment.id } });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'REMOVE_PLATE',
        entityType: 'PoolDefinition',
        entityId: poolId,
        changes: { pcrPlateId },
      },
    });

    return reply.status(204).send();
  });

  // GET /:poolId/collisions — Check index collisions
  fastify.get('/:poolId/collisions', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { runId, poolId } = z.object({ runId: z.string().uuid(), poolId: z.string().uuid() }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    const pool = await prisma.poolDefinition.findFirst({
      where: { id: poolId, sequencingRunId: runId },
    });
    if (!pool) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Pool not found', details: null } });
    }

    const collisions = await detectIndexCollisions(poolId);

    return reply.send({
      data: {
        hasCollisions: collisions.length > 0,
        collisionCount: collisions.length,
        collisions,
      },
    });
  });

  // GET /:poolId/warnings — Check control placement warnings
  fastify.get('/:poolId/warnings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { runId, poolId } = z.object({ runId: z.string().uuid(), poolId: z.string().uuid() }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    const pool = await prisma.poolDefinition.findFirst({
      where: { id: poolId, sequencingRunId: runId },
    });
    if (!pool) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Pool not found', details: null } });
    }

    const warnings = await validateControlPlacement(poolId);

    return reply.send({
      data: {
        hasWarnings: warnings.length > 0,
        warningCount: warnings.length,
        warnings,
      },
    });
  });

  // GET /:poolId/opentrons-csv — Generate Opentrons pooling CSV
  fastify.get('/:poolId/opentrons-csv', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { runId, poolId } = z.object({ runId: z.string().uuid(), poolId: z.string().uuid() }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    const pool = await prisma.poolDefinition.findFirst({
      where: { id: poolId, sequencingRunId: runId },
    });
    if (!pool) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Pool not found', details: null } });
    }

    const csv = await generateOpentronsCsv(poolId);

    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="${run.runIdentifier}_${pool.poolName}_opentrons.csv"`)
      .send(csv);
  });

  // GET /:poolId/illumina-sample-sheet — Generate Illumina sample sheet
  fastify.get('/:poolId/illumina-sample-sheet', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { runId, poolId } = z.object({ runId: z.string().uuid(), poolId: z.string().uuid() }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    const pool = await prisma.poolDefinition.findFirst({
      where: { id: poolId, sequencingRunId: runId },
    });
    if (!pool) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Pool not found', details: null } });
    }

    const csv = await generateIlluminaSampleSheet(runId);

    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="${run.runIdentifier}_SampleSheet.csv"`)
      .send(csv);
  });
};

export default routes;
