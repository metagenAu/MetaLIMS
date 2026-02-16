import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';
import { requireRole } from '../../middleware/auth.js';
import { parseBulkIndexWellCsv } from '../../services/sequencingService.js';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const IndexPlateFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
});

const CreateIndexPlateSchema = z.object({
  plateName: z.string().min(1),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const UpdateIndexPlateSchema = z.object({
  plateName: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const UpdateWellSchema = z.object({
  position: z.string().optional(),
  i5Name: z.string().optional(),
  i5Sequence: z.string().optional(),
  i7Name: z.string().optional(),
  i7Sequence: z.string().optional(),
  mergedSequence: z.string().optional().nullable(),
});

const BulkImportWellsSchema = z.object({
  csvText: z.string().min(1),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List index plates (paginated, search by plateName)
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = IndexPlateFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.plateName = { contains: search, mode: 'insensitive' };
      }

      const [plates, total] = await Promise.all([
        prisma.indexPlateReference.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            _count: { select: { wells: true } },
          },
        }),
        prisma.indexPlateReference.count({ where }),
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

  // POST / - Create index plate (LAB_MANAGER+)
  fastify.post('/', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const body = CreateIndexPlateSchema.parse(request.body);

      // Check for duplicate plateName within the organization
      const existing = await prisma.indexPlateReference.findFirst({
        where: {
          organizationId: request.user.organizationId,
          plateName: body.plateName,
        },
      });

      if (existing) {
        return reply.status(409).send({
          error: { code: 'CONFLICT', message: `Index plate with name "${body.plateName}" already exists`, details: null },
        });
      }

      const plate = await prisma.indexPlateReference.create({
        data: {
          organizationId: request.user.organizationId,
          plateName: body.plateName,
          description: body.description ?? null,
          isActive: body.isActive,
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'IndexPlateReference',
          entityId: plate.id,
          changes: { plateName: body.plateName },
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

  // GET /:id - Get index plate with wells
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const plate = await prisma.indexPlateReference.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        wells: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!plate) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Index plate not found', details: null },
      });
    }

    return reply.send({ data: plate });
  });

  // PATCH /:id - Update index plate (LAB_MANAGER+)
  fastify.patch('/:id', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = UpdateIndexPlateSchema.parse(request.body);

      const existing = await prisma.indexPlateReference.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Index plate not found', details: null },
        });
      }

      // If plateName is being changed, check for duplicates
      if (body.plateName && body.plateName !== existing.plateName) {
        const duplicate = await prisma.indexPlateReference.findFirst({
          where: {
            organizationId: request.user.organizationId,
            plateName: body.plateName,
            id: { not: id },
          },
        });

        if (duplicate) {
          return reply.status(409).send({
            error: { code: 'CONFLICT', message: `Index plate with name "${body.plateName}" already exists`, details: null },
          });
        }
      }

      const plate = await prisma.indexPlateReference.update({
        where: { id },
        data: { ...body, updatedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'IndexPlateReference',
          entityId: id,
          changes: { changes: body },
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

  // DELETE /:id - Delete index plate (LAB_MANAGER+), only if not referenced by any PCRPlate
  fastify.delete('/:id', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const existing = await prisma.indexPlateReference.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });

    if (!existing) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Index plate not found', details: null },
      });
    }

    // Check if any PCR plate references this index plate
    const referencingPcrPlate = await prisma.pCRPlate.findFirst({
      where: { indexPlateReferenceId: id },
    });

    if (referencingPcrPlate) {
      return reply.status(409).send({
        error: { code: 'CONFLICT', message: 'Cannot delete index plate that is referenced by a PCR plate', details: null },
      });
    }

    // Delete wells first, then the plate
    await prisma.$transaction(async (tx) => {
      await tx.indexWell.deleteMany({ where: { indexPlateReferenceId: id } });
      await tx.indexPlateReference.delete({ where: { id } });
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'DELETE',
        entityType: 'IndexPlateReference',
        entityId: id,
        changes: { plateName: existing.plateName },
      },
    });

    return reply.status(204).send();
  });

  // GET /:id/wells - List wells for a plate
  fastify.get('/:id/wells', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const plate = await prisma.indexPlateReference.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });

    if (!plate) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Index plate not found', details: null },
      });
    }

    const wells = await prisma.indexWell.findMany({
      where: { indexPlateReferenceId: id },
      orderBy: { position: 'asc' },
    });

    return reply.send({ data: wells });
  });

  // POST /:id/wells/bulk - Bulk import wells from CSV text (LAB_MANAGER+)
  fastify.post('/:id/wells/bulk', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = BulkImportWellsSchema.parse(request.body);

      const plate = await prisma.indexPlateReference.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!plate) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Index plate not found', details: null },
        });
      }

      const parsedWells = parseBulkIndexWellCsv(body.csvText);

      const wells = await prisma.$transaction(async (tx) => {
        // Delete existing wells for this plate
        await tx.indexWell.deleteMany({ where: { indexPlateReferenceId: id } });

        // Create new wells
        await tx.indexWell.createMany({
          data: parsedWells.map((w) => ({
            indexPlateReferenceId: id,
            position: w.position,
            i5Name: w.i5Name,
            i5Sequence: w.i5Sequence,
            i7Name: w.i7Name,
            i7Sequence: w.i7Sequence,
            mergedSequence: w.mergedSequence ?? `${w.i5Sequence}${w.i7Sequence}`,
          })),
        });

        return tx.indexWell.findMany({
          where: { indexPlateReferenceId: id },
          orderBy: { position: 'asc' },
        });
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'BULK_IMPORT_WELLS',
          entityType: 'IndexPlateReference',
          entityId: id,
          changes: { wellCount: wells.length },
        },
      });

      return reply.status(201).send({ data: wells });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // PUT /:id/wells/:wellId - Update individual well (LAB_MANAGER+)
  fastify.put('/:id/wells/:wellId', { preHandler: [fastify.authenticate, requireRole('LAB_MANAGER')] }, async (request, reply) => {
    try {
      const { id, wellId } = z.object({
        id: z.string().uuid(),
        wellId: z.string().uuid(),
      }).parse(request.params);
      const body = UpdateWellSchema.parse(request.body);

      // Verify the plate belongs to the user's organization
      const plate = await prisma.indexPlateReference.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!plate) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Index plate not found', details: null },
        });
      }

      // Verify the well belongs to this plate
      const existingWell = await prisma.indexWell.findFirst({
        where: { id: wellId, indexPlateReferenceId: id },
      });

      if (!existingWell) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Index well not found', details: null },
        });
      }

      // Build update data and compute mergedSequence if i5 or i7 sequences change
      const updateData: Record<string, unknown> = { ...body };
      const newI5Seq = body.i5Sequence ?? existingWell.i5Sequence;
      const newI7Seq = body.i7Sequence ?? existingWell.i7Sequence;
      if (body.i5Sequence !== undefined || body.i7Sequence !== undefined) {
        updateData.mergedSequence = body.mergedSequence ?? `${newI5Seq}${newI7Seq}`;
      }

      const well = await prisma.indexWell.update({
        where: { id: wellId },
        data: updateData,
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'IndexWell',
          entityId: wellId,
          changes: { changes: body, indexPlateReferenceId: id },
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
};

export default routes;
