import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';
import { requireRole } from '../../middleware/auth.js';
import { calculateReagentRequirements, calculatePCRReagentRequirements } from '../../services/sequencingService.js';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

const CreateReagentSchema = z.object({
  reagentName: z.string().min(1).max(255),
  amountOnHand: z.number().min(0).default(0),
  minimumRequired: z.number().min(0).default(0),
  amountToMake: z.number().min(0).default(0),
  unit: z.string().default('mL'),
  lotNumber: z.string().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const UpdateReagentSchema = z.object({
  reagentName: z.string().min(1).max(255).optional(),
  amountOnHand: z.number().min(0).optional(),
  minimumRequired: z.number().min(0).optional(),
  amountToMake: z.number().min(0).optional(),
  unit: z.string().optional(),
  lotNumber: z.string().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / — List reagents for a run
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

      const [reagents, total] = await Promise.all([
        prisma.runReagentInventory.findMany({
          where: { sequencingRunId: runId },
          skip,
          take: pageSize,
          orderBy: { reagentName: 'asc' },
        }),
        prisma.runReagentInventory.count({ where: { sequencingRunId: runId } }),
      ]);

      return reply.send({
        data: reagents,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: err.errors } });
      }
      throw err;
    }
  });

  // POST / — Add reagent record
  fastify.post('/', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params);
      const body = CreateReagentSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const reagent = await prisma.runReagentInventory.create({
        data: {
          sequencingRunId: runId,
          ...body,
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'RunReagentInventory',
          entityId: reagent.id,
          changes: { reagentName: body.reagentName, runId },
        },
      });

      return reply.status(201).send({ data: reagent });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      }
      throw err;
    }
  });

  // PATCH /:reagentId — Update reagent record
  fastify.patch('/:reagentId', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId, reagentId } = z.object({
        runId: z.string().uuid(),
        reagentId: z.string().uuid(),
      }).parse(request.params);
      const body = UpdateReagentSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const existing = await prisma.runReagentInventory.findFirst({
        where: { id: reagentId, sequencingRunId: runId },
      });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Reagent record not found', details: null } });
      }

      const reagent = await prisma.runReagentInventory.update({
        where: { id: reagentId },
        data: { ...body, updatedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'RunReagentInventory',
          entityId: reagentId,
          changes: { changes: body },
        },
      });

      return reply.send({ data: reagent });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      }
      throw err;
    }
  });

  // DELETE /:reagentId — Delete reagent record
  fastify.delete('/:reagentId', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    const { runId, reagentId } = z.object({
      runId: z.string().uuid(),
      reagentId: z.string().uuid(),
    }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    const existing = await prisma.runReagentInventory.findFirst({
      where: { id: reagentId, sequencingRunId: runId },
    });
    if (!existing) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Reagent record not found', details: null } });
    }

    await prisma.runReagentInventory.delete({ where: { id: reagentId } });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'DELETE',
        entityType: 'RunReagentInventory',
        entityId: reagentId,
        changes: { reagentName: existing.reagentName },
      },
    });

    return reply.status(204).send();
  });

  // GET /calculator — Calculate reagent requirements from sample count
  fastify.get('/calculator', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    // Count total samples across all DNA plates
    const dnaPlates = await prisma.dNAPlate.findMany({
      where: { sequencingRunId: runId },
      select: { id: true },
    });

    const sampleCount = await prisma.dNAPlateWell.count({
      where: {
        dnaPlateId: { in: dnaPlates.map((p) => p.id) },
        wellType: 'SAMPLE',
      },
    });

    const plateCount = dnaPlates.length;

    // Count PCR reactions
    const pcrPlates = await prisma.pCRPlate.findMany({
      where: { sequencingRunId: runId },
      select: { id: true },
    });

    const pcrReactionCount = await prisma.pCRPlateWell.count({
      where: {
        pcrPlateId: { in: pcrPlates.map((p) => p.id) },
        wellType: { not: 'EMPTY' },
      },
    });

    const extractionReagents = calculateReagentRequirements(sampleCount, plateCount);
    const pcrReagents = calculatePCRReagentRequirements(pcrReactionCount);

    return reply.send({
      data: {
        sampleCount,
        plateCount,
        pcrReactionCount,
        extractionReagents,
        pcrReagents,
      },
    });
  });
};

export default routes;
