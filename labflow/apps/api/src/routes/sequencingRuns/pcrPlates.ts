import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';
import { requireRole } from '../../middleware/auth.js';
import {
  parseBulkPCRWellCsv,
  autoPopulatePCRFromDNA,
  autoAssignIndices,
  getPCRPlateMap,
  validatePlateStatusTransition,
  uploadToS3,
} from '../../services/sequencingService.js';

// ----------------------------------------------------------------
// Zod Schemas
// ----------------------------------------------------------------

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const CreatePCRPlateSchema = z.object({
  plateIdentifier: z.string().min(1).max(255),
  plateBarcode: z.string().optional().nullable(),
  pcrAssay: z.enum(['ASSAY_16S', 'ASSAY_EUK2', 'ASSAY_ITS', 'ASSAY_COI']),
  datePerformed: z.coerce.date().optional().nullable(),
  sourceDnaPlateId: z.string().uuid().optional().nullable(),
  indexPlateReferenceId: z.string().uuid().optional().nullable(),
  isRedo: z.boolean().optional().default(false),
  redoOfPlateId: z.string().uuid().optional().nullable(),
  operatorId: z.string().uuid().optional().nullable(),
  gelNotes: z.string().optional().nullable(),
});

const UpdatePCRPlateSchema = z.object({
  plateIdentifier: z.string().min(1).max(255).optional(),
  plateBarcode: z.string().optional().nullable(),
  pcrAssay: z.enum(['ASSAY_16S', 'ASSAY_EUK2', 'ASSAY_ITS', 'ASSAY_COI']).optional(),
  datePerformed: z.coerce.date().optional().nullable(),
  sourceDnaPlateId: z.string().uuid().optional().nullable(),
  indexPlateReferenceId: z.string().uuid().optional().nullable(),
  isRedo: z.boolean().optional(),
  redoOfPlateId: z.string().uuid().optional().nullable(),
  operatorId: z.string().uuid().optional().nullable(),
  gelNotes: z.string().optional().nullable(),
});

const BulkCsvSchema = z.object({
  csvText: z.string().min(1),
});

const AssignIndicesSchema = z.object({
  indexPlateReferenceId: z.string().uuid(),
});

const BulkUpdateWellsSchema = z.object({
  updates: z.array(z.object({
    position: z.string().min(1),
    pcrResult: z.enum(['PCR_PENDING', 'PASS', 'FAIL', 'BORDERLINE']).optional(),
    poolingAction: z.enum(['POOL_NORMAL', 'POOL_DOUBLE', 'DO_NOT_POOL', 'POOL_SKIP']).optional(),
    notes: z.string().optional().nullable(),
  })).min(1),
});

const UpdateWellSchema = z.object({
  sampleLabel: z.string().optional().nullable(),
  assayType: z.string().optional().nullable(),
  wellType: z.string().optional(),
  indexI5Sequence: z.string().optional().nullable(),
  indexI7Sequence: z.string().optional().nullable(),
  mergedIndexSequence: z.string().optional().nullable(),
  pcrResult: z.enum(['PCR_PENDING', 'PASS', 'FAIL', 'BORDERLINE']).optional(),
  poolingAction: z.enum(['POOL_NORMAL', 'POOL_DOUBLE', 'DO_NOT_POOL', 'POOL_SKIP']).optional(),
  notes: z.string().optional().nullable(),
});

const StatusTransitionSchema = z.object({
  status: z.string().min(1),
});

// ----------------------------------------------------------------
// Routes
// ----------------------------------------------------------------

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / — List PCR plates for the run
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

      const [plates, total] = await Promise.all([
        prisma.pCRPlate.findMany({
          where: { sequencingRunId: runId },
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: { select: { wells: true } },
            operator: { select: { id: true, firstName: true, lastName: true } },
            sourceDnaPlate: { select: { id: true, plateIdentifier: true } },
            indexPlateReference: { select: { id: true, name: true } },
          },
        }),
        prisma.pCRPlate.count({ where: { sequencingRunId: runId } }),
      ]);

      return reply.send({
        data: plates,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: err.errors } });
      }
      throw err;
    }
  });

  // POST / — Create PCR plate (LAB_MANAGER+)
  fastify.post('/', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params);
      const body = CreatePCRPlateSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      // Check for duplicate plateIdentifier within the run
      const existing = await prisma.pCRPlate.findFirst({
        where: { sequencingRunId: runId, plateIdentifier: body.plateIdentifier },
      });
      if (existing) {
        return reply.status(409).send({ error: { code: 'DUPLICATE', message: `PCR plate "${body.plateIdentifier}" already exists for this run`, details: null } });
      }

      const plate = await prisma.pCRPlate.create({
        data: {
          sequencingRunId: runId,
          plateIdentifier: body.plateIdentifier,
          plateBarcode: body.plateBarcode ?? null,
          pcrAssay: body.pcrAssay as any,
          datePerformed: body.datePerformed ?? null,
          sourceDnaPlateId: body.sourceDnaPlateId ?? null,
          indexPlateReferenceId: body.indexPlateReferenceId ?? null,
          isRedo: body.isRedo,
          redoOfPlateId: body.redoOfPlateId ?? null,
          operatorId: body.operatorId ?? null,
          gelNotes: body.gelNotes ?? null,
          status: 'PLATE_SETUP',
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'PCRPlate',
          entityId: plate.id,
          changes: { plateIdentifier: body.plateIdentifier, pcrAssay: body.pcrAssay, runId },
        },
      });

      return reply.status(201).send({ data: plate });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      }
      throw err;
    }
  });

  // GET /:plateId — Get PCR plate with wells and source DNA plate info
  fastify.get('/:plateId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { runId, plateId } = z.object({ runId: z.string().uuid(), plateId: z.string().uuid() }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    const plate = await prisma.pCRPlate.findFirst({
      where: { id: plateId, sequencingRunId: runId },
      include: {
        wells: { orderBy: { position: 'asc' } },
        operator: { select: { id: true, firstName: true, lastName: true } },
        sourceDnaPlate: {
          select: {
            id: true,
            plateIdentifier: true,
            plateBarcode: true,
            status: true,
          },
        },
        indexPlateReference: { select: { id: true, name: true } },
        images: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!plate) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'PCR plate not found', details: null } });
    }

    return reply.send({ data: plate });
  });

  // PATCH /:plateId — Update PCR plate metadata (LAB_MANAGER+)
  fastify.patch('/:plateId', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId, plateId } = z.object({ runId: z.string().uuid(), plateId: z.string().uuid() }).parse(request.params);
      const body = UpdatePCRPlateSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const existing = await prisma.pCRPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'PCR plate not found', details: null } });
      }

      // If plateIdentifier is being changed, check for uniqueness within the run
      if (body.plateIdentifier && body.plateIdentifier !== existing.plateIdentifier) {
        const duplicate = await prisma.pCRPlate.findFirst({
          where: {
            sequencingRunId: runId,
            plateIdentifier: body.plateIdentifier,
            id: { not: plateId },
          },
        });
        if (duplicate) {
          return reply.status(409).send({ error: { code: 'DUPLICATE', message: `PCR plate "${body.plateIdentifier}" already exists for this run`, details: null } });
        }
      }

      const plate = await prisma.pCRPlate.update({
        where: { id: plateId },
        data: { ...body, updatedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'PCRPlate',
          entityId: plateId,
          changes: { changes: body },
        },
      });

      return reply.send({ data: plate });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      }
      throw err;
    }
  });

  // DELETE /:plateId — Delete PCR plate (LAB_MANAGER+)
  fastify.delete('/:plateId', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    const { runId, plateId } = z.object({ runId: z.string().uuid(), plateId: z.string().uuid() }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    const existing = await prisma.pCRPlate.findFirst({
      where: { id: plateId, sequencingRunId: runId },
    });
    if (!existing) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'PCR plate not found', details: null } });
    }

    await prisma.pCRPlate.delete({ where: { id: plateId } });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'DELETE',
        entityType: 'PCRPlate',
        entityId: plateId,
        changes: { plateIdentifier: existing.plateIdentifier, pcrAssay: existing.pcrAssay },
      },
    });

    return reply.status(204).send();
  });

  // POST /:plateId/populate-from-dna-plate — Auto-populate wells from source DNA plate
  fastify.post('/:plateId/populate-from-dna-plate', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    const { runId, plateId } = z.object({ runId: z.string().uuid(), plateId: z.string().uuid() }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    const plate = await prisma.pCRPlate.findFirst({
      where: { id: plateId, sequencingRunId: runId },
    });
    if (!plate) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'PCR plate not found', details: null } });
    }

    if (!plate.sourceDnaPlateId) {
      return reply.status(400).send({ error: { code: 'MISSING_SOURCE', message: 'PCR plate has no source DNA plate assigned', details: null } });
    }

    const wellsCreated = await prisma.$transaction(async (tx) => {
      return autoPopulatePCRFromDNA(plateId, plate.sourceDnaPlateId!, plate.pcrAssay, tx);
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'POPULATE_FROM_DNA',
        entityType: 'PCRPlate',
        entityId: plateId,
        changes: { sourceDnaPlateId: plate.sourceDnaPlateId, wellsCreated },
      },
    });

    return reply.send({ data: { wellsCreated } });
  });

  // POST /:plateId/assign-indices — Assign index sequences from an IndexPlateReference
  fastify.post('/:plateId/assign-indices', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId, plateId } = z.object({ runId: z.string().uuid(), plateId: z.string().uuid() }).parse(request.params);
      const body = AssignIndicesSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const plate = await prisma.pCRPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!plate) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'PCR plate not found', details: null } });
      }

      const wellsUpdated = await prisma.$transaction(async (tx) => {
        return autoAssignIndices(plateId, body.indexPlateReferenceId, tx);
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'ASSIGN_INDICES',
          entityType: 'PCRPlate',
          entityId: plateId,
          changes: { indexPlateReferenceId: body.indexPlateReferenceId, wellsUpdated },
        },
      });

      return reply.send({ data: { wellsUpdated } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      }
      throw err;
    }
  });

  // POST /:plateId/wells/bulk — Bulk import PCR wells from CSV text
  fastify.post('/:plateId/wells/bulk', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId, plateId } = z.object({ runId: z.string().uuid(), plateId: z.string().uuid() }).parse(request.params);
      const body = BulkCsvSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const plate = await prisma.pCRPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!plate) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'PCR plate not found', details: null } });
      }

      const parsedWells = parseBulkPCRWellCsv(body.csvText);

      // Delete existing wells and create new ones
      await prisma.$transaction(async (tx) => {
        await tx.pCRPlateWell.deleteMany({ where: { pcrPlateId: plateId } });
        await tx.pCRPlateWell.createMany({
          data: parsedWells.map((w) => ({
            pcrPlateId: plateId,
            position: w.position,
            sampleLabel: w.sampleLabel ?? null,
            assayType: w.assayType ?? null,
            wellType: (w.wellType as any) || 'SAMPLE',
            notes: w.notes ?? null,
            pcrResult: 'PCR_PENDING' as const,
            poolingAction: 'POOL_NORMAL' as const,
          })),
        });
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'BULK_IMPORT_WELLS',
          entityType: 'PCRPlate',
          entityId: plateId,
          changes: { wellsImported: parsedWells.length },
        },
      });

      return reply.status(201).send({ data: { wellsCreated: parsedWells.length } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      }
      throw err;
    }
  });

  // PUT /:plateId/wells/bulk-update — Bulk update PCR results and/or pooling actions
  fastify.put('/:plateId/wells/bulk-update', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId, plateId } = z.object({ runId: z.string().uuid(), plateId: z.string().uuid() }).parse(request.params);
      const body = BulkUpdateWellsSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const plate = await prisma.pCRPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!plate) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'PCR plate not found', details: null } });
      }

      // Fetch all existing wells for this plate keyed by position
      const existingWells = await prisma.pCRPlateWell.findMany({
        where: { pcrPlateId: plateId },
      });
      const wellByPosition = new Map(existingWells.map((w) => [w.position, w]));

      const updatedWells = [];

      for (const update of body.updates) {
        const well = wellByPosition.get(update.position);
        if (!well) {
          return reply.status(404).send({ error: { code: 'NOT_FOUND', message: `Well at position "${update.position}" not found`, details: null } });
        }

        const oldValues: Record<string, unknown> = {};
        const newValues: Record<string, unknown> = {};
        const data: Record<string, unknown> = {};

        if (update.pcrResult !== undefined) {
          oldValues.pcrResult = well.pcrResult;
          newValues.pcrResult = update.pcrResult;
          data.pcrResult = update.pcrResult;
        }
        if (update.poolingAction !== undefined) {
          oldValues.poolingAction = well.poolingAction;
          newValues.poolingAction = update.poolingAction;
          data.poolingAction = update.poolingAction;
        }
        if (update.notes !== undefined) {
          oldValues.notes = well.notes;
          newValues.notes = update.notes;
          data.notes = update.notes;
        }

        if (Object.keys(data).length > 0) {
          data.updatedAt = new Date();

          const updatedWell = await prisma.pCRPlateWell.update({
            where: { id: well.id },
            data,
          });
          updatedWells.push(updatedWell);

          // Write an audit log entry for each well updated
          await prisma.auditLog.create({
            data: {
              organizationId: request.user.organizationId,
              userId: request.user.id,
              action: 'UPDATE_WELL',
              entityType: 'PCRPlateWell',
              entityId: well.id,
              changes: { position: update.position, pcrPlateId: plateId, old: oldValues, new: newValues },
            },
          });
        }
      }

      return reply.send({ data: { wellsUpdated: updatedWells.length } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      }
      throw err;
    }
  });

  // PUT /:plateId/wells/:wellId — Update individual well
  fastify.put('/:plateId/wells/:wellId', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId, plateId, wellId } = z.object({
        runId: z.string().uuid(),
        plateId: z.string().uuid(),
        wellId: z.string().uuid(),
      }).parse(request.params);
      const body = UpdateWellSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const plate = await prisma.pCRPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!plate) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'PCR plate not found', details: null } });
      }

      const existing = await prisma.pCRPlateWell.findFirst({
        where: { id: wellId, pcrPlateId: plateId },
      });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'PCR plate well not found', details: null } });
      }

      const well = await prisma.pCRPlateWell.update({
        where: { id: wellId },
        data: { ...body, updatedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE_WELL',
          entityType: 'PCRPlateWell',
          entityId: wellId,
          changes: { position: existing.position, pcrPlateId: plateId, changes: body },
        },
      });

      return reply.send({ data: well });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      }
      throw err;
    }
  });

  // GET /:plateId/plate-map — Return 8x12 grid using getPCRPlateMap
  fastify.get('/:plateId/plate-map', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { runId, plateId } = z.object({ runId: z.string().uuid(), plateId: z.string().uuid() }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    const plate = await prisma.pCRPlate.findFirst({
      where: { id: plateId, sequencingRunId: runId },
    });
    if (!plate) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'PCR plate not found', details: null } });
    }

    const grid = await getPCRPlateMap(plateId);

    return reply.send({ data: grid });
  });

  // POST /:plateId/status — Transition plate status
  fastify.post('/:plateId/status', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId, plateId } = z.object({ runId: z.string().uuid(), plateId: z.string().uuid() }).parse(request.params);
      const body = StatusTransitionSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const existing = await prisma.pCRPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'PCR plate not found', details: null } });
      }

      // Validate the status transition (throws ConflictError if invalid)
      validatePlateStatusTransition(existing.status, body.status);

      const plate = await prisma.pCRPlate.update({
        where: { id: plateId },
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
          entityType: 'PCRPlate',
          entityId: plateId,
          changes: { previousStatus: existing.status, newStatus: body.status },
        },
      });

      return reply.send({ data: plate });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors } });
      }
      throw err;
    }
  });

  // POST /:plateId/images — Upload gel photo (multipart)
  fastify.post('/:plateId/images', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    const { runId, plateId } = z.object({ runId: z.string().uuid(), plateId: z.string().uuid() }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    const plate = await prisma.pCRPlate.findFirst({
      where: { id: plateId, sequencingRunId: runId },
    });
    if (!plate) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'PCR plate not found', details: null } });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: { code: 'MISSING_FILE', message: 'No file uploaded', details: null } });
    }

    const buffer = await data.toBuffer();
    const fileName = data.filename;
    const mimeType = data.mimetype || 'image/jpeg';
    const fileKey = `sequencing-runs/${runId}/pcr-plates/${plateId}/images/${Date.now()}-${fileName}`;

    await uploadToS3(buffer, fileKey, mimeType);

    // Extract imageType and caption from fields if provided
    const fields = data.fields as Record<string, any>;
    const imageType = fields?.imageType?.value || 'GEL';
    const caption = fields?.caption?.value || null;

    const image = await prisma.plateImage.create({
      data: {
        pcrPlateId: plateId,
        imageType: imageType as any,
        fileKey,
        fileName,
        mimeType,
        caption,
        uploadedById: request.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'UPLOAD_IMAGE',
        entityType: 'PCRPlate',
        entityId: plateId,
        changes: { imageId: image.id, fileName, imageType },
      },
    });

    return reply.status(201).send({ data: image });
  });

  // GET /:plateId/images — List images for the plate
  fastify.get('/:plateId/images', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { runId, plateId } = z.object({ runId: z.string().uuid(), plateId: z.string().uuid() }).parse(request.params);

    const run = await prisma.sequencingRun.findFirst({
      where: { id: runId, organizationId: request.user.organizationId },
    });
    if (!run) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
    }

    const plate = await prisma.pCRPlate.findFirst({
      where: { id: plateId, sequencingRunId: runId },
    });
    if (!plate) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'PCR plate not found', details: null } });
    }

    const images = await prisma.plateImage.findMany({
      where: { pcrPlateId: plateId },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ data: images });
  });
};

export default routes;
