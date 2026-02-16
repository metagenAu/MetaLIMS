import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';
import { requireRole } from '../../middleware/auth.js';
import { parseBulkWellCsv, getDNAPlateMap, uploadToS3 } from '../../services/sequencingService.js';

// ----------------------------------------------------------------
// Zod Schemas
// ----------------------------------------------------------------

const RunIdParamsSchema = z.object({
  runId: z.string().uuid(),
});

const PlateParamsSchema = z.object({
  runId: z.string().uuid(),
  plateId: z.string().uuid(),
});

const WellParamsSchema = z.object({
  runId: z.string().uuid(),
  plateId: z.string().uuid(),
  wellId: z.string().uuid(),
});

const ImageParamsSchema = z.object({
  runId: z.string().uuid(),
  plateId: z.string().uuid(),
  imageId: z.string().uuid(),
});

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const CreateDNAPlateSchema = z.object({
  plateIdentifier: z.string().min(1),
  plateBarcode: z.string().optional().nullable(),
  extractionMethod: z.enum(['AUTOMATED', 'MANUAL', 'OTHER']),
  clientProject: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const UpdateDNAPlateSchema = z.object({
  plateIdentifier: z.string().min(1).optional(),
  plateBarcode: z.string().optional().nullable(),
  extractionMethod: z.enum(['AUTOMATED', 'MANUAL', 'OTHER']).optional(),
  clientProject: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const BulkWellImportSchema = z.object({
  csvText: z.string().min(1),
});

const UpdateWellSchema = z.object({
  position: z.string().optional(),
  sampleId: z.string().optional().nullable(),
  wellType: z.enum(['SAMPLE', 'MOCK_CONTROL', 'EXTRACTION_CONTROL', 'NTC', 'POSITIVE_CONTROL', 'EMPTY']).optional(),
  dnaConcentrationNgUl: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ----------------------------------------------------------------
// Plugin
// ----------------------------------------------------------------

const dnaPlatesRoutes: FastifyPluginAsync = async (fastify) => {
  // ================================================================
  // 1. GET / - List DNA plates for the run
  // ================================================================
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { runId } = RunIdParamsSchema.parse(request.params);
      const query = PaginationSchema.parse(request.query);
      const { page, pageSize, sort, order } = query;
      const skip = (page - 1) * pageSize;

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const where = { sequencingRunId: runId };

      const [plates, total] = await Promise.all([
        prisma.dNAPlate.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            _count: { select: { wells: true, images: true } },
          },
        }),
        prisma.dNAPlate.count({ where }),
      ]);

      return reply.send({
        data: plates,
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

  // ================================================================
  // 2. POST / - Create DNA plate (LAB_MANAGER+)
  // ================================================================
  fastify.post('/', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId } = RunIdParamsSchema.parse(request.params);
      const body = CreateDNAPlateSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const plate = await prisma.dNAPlate.create({
        data: {
          sequencingRunId: runId,
          plateIdentifier: body.plateIdentifier,
          plateBarcode: body.plateBarcode,
          extractionMethod: body.extractionMethod,
          clientProject: body.clientProject,
          notes: body.notes,
        },
        include: {
          _count: { select: { wells: true, images: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'DNAPlate',
          entityId: plate.id,
          changes: { plateIdentifier: body.plateIdentifier, sequencingRunId: runId },
        },
      });

      return reply.status(201).send({ data: plate });
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
  // 3. GET /:plateId - Get DNA plate with wells
  // ================================================================
  fastify.get('/:plateId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { runId, plateId } = PlateParamsSchema.parse(request.params);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const plate = await prisma.dNAPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
        include: {
          wells: {
            orderBy: { position: 'asc' },
          },
          images: {
            orderBy: { createdAt: 'desc' },
          },
          _count: { select: { wells: true, images: true } },
        },
      });

      if (!plate) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'DNA plate not found', details: null } });
      }

      return reply.send({ data: plate });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: err.errors },
        });
      }
      throw err;
    }
  });

  // ================================================================
  // 4. PATCH /:plateId - Update DNA plate metadata (LAB_MANAGER+)
  // ================================================================
  fastify.patch('/:plateId', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId, plateId } = PlateParamsSchema.parse(request.params);
      const body = UpdateDNAPlateSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const existing = await prisma.dNAPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'DNA plate not found', details: null } });
      }

      const plate = await prisma.dNAPlate.update({
        where: { id: plateId },
        data: { ...body },
        include: {
          _count: { select: { wells: true, images: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'DNAPlate',
          entityId: plateId,
          changes: body,
        },
      });

      return reply.send({ data: plate });
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
  // 5. DELETE /:plateId - Delete DNA plate (LAB_MANAGER+)
  // ================================================================
  fastify.delete('/:plateId', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId, plateId } = PlateParamsSchema.parse(request.params);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const existing = await prisma.dNAPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'DNA plate not found', details: null } });
      }

      await prisma.$transaction(async (tx) => {
        await tx.dNAPlateWell.deleteMany({ where: { dnaPlateId: plateId } });
        await tx.plateImage.deleteMany({ where: { dnaPlateId: plateId } });
        await tx.dNAPlate.delete({ where: { id: plateId } });
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'DELETE',
          entityType: 'DNAPlate',
          entityId: plateId,
          changes: { plateIdentifier: existing.plateIdentifier },
        },
      });

      return reply.send({ data: { id: plateId, deleted: true } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: err.errors },
        });
      }
      throw err;
    }
  });

  // ================================================================
  // 6. POST /:plateId/wells/bulk - Bulk import wells from CSV text
  // ================================================================
  fastify.post('/:plateId/wells/bulk', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId, plateId } = PlateParamsSchema.parse(request.params);
      const body = BulkWellImportSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const plate = await prisma.dNAPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!plate) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'DNA plate not found', details: null } });
      }

      const parsedWells = parseBulkWellCsv(body.csvText);

      const result = await prisma.dNAPlateWell.createMany({
        data: parsedWells.map((w) => ({
          dnaPlateId: plateId,
          position: w.position,
          sampleId: w.sampleId || null,
          wellType: (w.wellType || 'SAMPLE') as any,
          dnaConcentrationNgUl: w.dnaConcentrationNgUl ?? null,
          notes: w.notes || null,
        })),
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'BULK_IMPORT',
          entityType: 'DNAPlateWell',
          entityId: plateId,
          changes: { wellCount: result.count },
        },
      });

      return reply.status(201).send({ data: { imported: result.count } });
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
  // 7. PUT /:plateId/wells/:wellId - Update individual well
  // ================================================================
  fastify.put('/:plateId/wells/:wellId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { runId, plateId, wellId } = WellParamsSchema.parse(request.params);
      const body = UpdateWellSchema.parse(request.body);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const plate = await prisma.dNAPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!plate) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'DNA plate not found', details: null } });
      }

      const existingWell = await prisma.dNAPlateWell.findFirst({
        where: { id: wellId, dnaPlateId: plateId },
      });
      if (!existingWell) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Well not found', details: null } });
      }

      const well = await prisma.dNAPlateWell.update({
        where: { id: wellId },
        data: { ...body },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'DNAPlateWell',
          entityId: wellId,
          changes: body,
        },
      });

      return reply.send({ data: well });
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
  // 8. DELETE /:plateId/wells/:wellId - Delete well
  // ================================================================
  fastify.delete('/:plateId/wells/:wellId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { runId, plateId, wellId } = WellParamsSchema.parse(request.params);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const plate = await prisma.dNAPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!plate) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'DNA plate not found', details: null } });
      }

      const existingWell = await prisma.dNAPlateWell.findFirst({
        where: { id: wellId, dnaPlateId: plateId },
      });
      if (!existingWell) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Well not found', details: null } });
      }

      await prisma.dNAPlateWell.delete({ where: { id: wellId } });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'DELETE',
          entityType: 'DNAPlateWell',
          entityId: wellId,
          changes: { position: existingWell.position, plateId },
        },
      });

      return reply.send({ data: { id: wellId, deleted: true } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: err.errors },
        });
      }
      throw err;
    }
  });

  // ================================================================
  // 9. GET /:plateId/plate-map - Return 8x12 grid using getDNAPlateMap
  // ================================================================
  fastify.get('/:plateId/plate-map', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { runId, plateId } = PlateParamsSchema.parse(request.params);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const plate = await prisma.dNAPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!plate) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'DNA plate not found', details: null } });
      }

      const plateMap = await getDNAPlateMap(plateId);

      return reply.send({ data: plateMap });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: err.errors },
        });
      }
      throw err;
    }
  });

  // ================================================================
  // 10. POST /:plateId/images - Upload image (multipart)
  // ================================================================
  fastify.post('/:plateId/images', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { runId, plateId } = PlateParamsSchema.parse(request.params);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const plate = await prisma.dNAPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!plate) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'DNA plate not found', details: null } });
      }

      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'No file uploaded', details: null } });
      }

      const chunks: Buffer[] = [];
      for await (const chunk of file.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const fileName = file.filename;
      const mimeType = file.mimetype;
      const key = `sequencing/dna-plates/${plateId}/${Date.now()}-${fileName}`;

      await uploadToS3(buffer, key, mimeType);

      // Extract optional fields from multipart fields
      const imageType = (file.fields?.imageType as any)?.value || 'PLATE_IMAGE_OTHER';
      const caption = (file.fields?.caption as any)?.value || null;

      const image = await prisma.plateImage.create({
        data: {
          dnaPlateId: plateId,
          imageType: imageType as any,
          fileKey: key,
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
          action: 'CREATE',
          entityType: 'PlateImage',
          entityId: image.id,
          changes: { fileName, imageType, plateId },
        },
      });

      return reply.status(201).send({ data: image });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: err.errors },
        });
      }
      throw err;
    }
  });

  // ================================================================
  // 11. GET /:plateId/images - List images for the plate
  // ================================================================
  fastify.get('/:plateId/images', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { runId, plateId } = PlateParamsSchema.parse(request.params);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const plate = await prisma.dNAPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!plate) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'DNA plate not found', details: null } });
      }

      const images = await prisma.plateImage.findMany({
        where: { dnaPlateId: plateId },
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return reply.send({ data: images });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: err.errors },
        });
      }
      throw err;
    }
  });

  // ================================================================
  // 12. DELETE /:plateId/images/:imageId - Delete image (LAB_MANAGER+)
  // ================================================================
  fastify.delete('/:plateId/images/:imageId', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { runId, plateId, imageId } = ImageParamsSchema.parse(request.params);

      const run = await prisma.sequencingRun.findFirst({
        where: { id: runId, organizationId: request.user.organizationId },
      });
      if (!run) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Sequencing run not found', details: null } });
      }

      const plate = await prisma.dNAPlate.findFirst({
        where: { id: plateId, sequencingRunId: runId },
      });
      if (!plate) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'DNA plate not found', details: null } });
      }

      const image = await prisma.plateImage.findFirst({
        where: { id: imageId, dnaPlateId: plateId },
      });
      if (!image) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Image not found', details: null } });
      }

      await prisma.plateImage.delete({ where: { id: imageId } });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'DELETE',
          entityType: 'PlateImage',
          entityId: imageId,
          changes: { fileName: image.fileName, plateId },
        },
      });

      return reply.send({ data: { id: imageId, deleted: true } });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: err.errors },
        });
      }
      throw err;
    }
  });
};

export default dnaPlatesRoutes;
