import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const SampleFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  status: z.enum([
    'REGISTERED', 'RECEIVED', 'IN_STORAGE', 'IN_PROGRESS',
    'TESTING_COMPLETE', 'APPROVED', 'REPORTED', 'ON_HOLD',
    'DISPOSED', 'REJECTED', 'CANCELLED',
  ]).optional(),
  orderId: z.string().uuid().optional(),
  sampleType: z.string().optional(),
  matrix: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  receivedFrom: z.coerce.date().optional(),
  receivedTo: z.coerce.date().optional(),
});

const CreateSampleSchema = z.object({
  orderId: z.string().uuid(),
  clientSampleId: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  matrix: z.string().optional().nullable(),
  sampleType: z.string().optional().nullable(),
  collectedDate: z.coerce.date().optional().nullable(),
  collectedBy: z.string().optional().nullable(),
  collectionLocation: z.string().optional().nullable(),
  collectionMethod: z.string().optional().nullable(),
  conditionOnReceipt: z.string().optional().nullable(),
  temperatureOnReceipt: z.number().optional().nullable(),
  storageCondition: z.string().optional().nullable(),
  parentSampleId: z.string().uuid().optional().nullable(),
  quantity: z.number().optional().nullable(),
  quantityUnit: z.string().optional().nullable(),
  lotNumber: z.string().optional().nullable(),
  batchNumber: z.string().optional().nullable(),
  expirationDate: z.coerce.date().optional().nullable(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
  notes: z.string().optional().nullable(),
  testMethodIds: z.array(z.string().uuid()).optional(),
});

const UpdateSampleSchema = z.object({
  clientSampleId: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  matrix: z.string().optional().nullable(),
  sampleType: z.string().optional().nullable(),
  collectedDate: z.coerce.date().optional().nullable(),
  collectedBy: z.string().optional().nullable(),
  collectionLocation: z.string().optional().nullable(),
  collectionMethod: z.string().optional().nullable(),
  conditionOnReceipt: z.string().optional().nullable(),
  temperatureOnReceipt: z.number().optional().nullable(),
  storageCondition: z.string().optional().nullable(),
  quantity: z.number().optional().nullable(),
  quantityUnit: z.string().optional().nullable(),
  lotNumber: z.string().optional().nullable(),
  batchNumber: z.string().optional().nullable(),
  expirationDate: z.coerce.date().optional().nullable(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
  notes: z.string().optional().nullable(),
});

const ReceiveSampleSchema = z.object({
  receivedDate: z.coerce.date().default(() => new Date()),
  conditionOnReceipt: z.string().optional().nullable(),
  temperatureOnReceipt: z.number().optional().nullable(),
  storageLocationId: z.string().uuid().optional().nullable(),
  storageCondition: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const StoreSampleSchema = z.object({
  storageLocationId: z.string().uuid(),
  storageCondition: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const RetrieveSampleSchema = z.object({
  reason: z.string().min(1),
  notes: z.string().optional().nullable(),
});

const DisposeSampleSchema = z.object({
  disposalMethod: z.string().min(1),
  disposalDate: z.coerce.date().default(() => new Date()),
  notes: z.string().optional().nullable(),
});

const AliquotSchema = z.object({
  numberOfAliquots: z.number().int().min(1).max(50),
  quantityPerAliquot: z.number().optional().nullable(),
  quantityUnit: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const ChainOfCustodySchema = z.object({
  action: z.string().min(1),
  fromLocation: z.string().optional().nullable(),
  toLocation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  signatureUrl: z.string().url().optional().nullable(),
  temperature: z.number().optional().nullable(),
});

const ScanSchema = z.object({
  barcodeValue: z.string().min(1),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List samples with filters
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = SampleFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, status, orderId, sampleType, matrix, tags, createdFrom, createdTo, receivedFrom, receivedTo } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { sampleNumber: { contains: search, mode: 'insensitive' } },
          { clientSampleId: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { barcodeValue: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (status) where.status = status;
      if (orderId) where.orderId = orderId;
      if (sampleType) where.sampleType = sampleType;
      if (matrix) where.matrix = matrix;
      if (tags) where.tags = { hasSome: tags.split(',') };
      if (createdFrom || createdTo) {
        where.createdAt = {};
        if (createdFrom) (where.createdAt as Record<string, unknown>).gte = createdFrom;
        if (createdTo) (where.createdAt as Record<string, unknown>).lte = createdTo;
      }
      if (receivedFrom || receivedTo) {
        where.receivedDate = {};
        if (receivedFrom) (where.receivedDate as Record<string, unknown>).gte = receivedFrom;
        if (receivedTo) (where.receivedDate as Record<string, unknown>).lte = receivedTo;
      }

      const [samples, total] = await Promise.all([
        prisma.sample.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            order: { select: { id: true, orderNumber: true, client: { select: { id: true, name: true } } } },
            storageLocation: { select: { id: true, name: true, path: true } },
            _count: { select: { tests: true, childSamples: true } },
          },
        }),
        prisma.sample.count({ where }),
      ]);

      return reply.send({
        data: samples,
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

  // POST / - Create sample
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = CreateSampleSchema.parse(request.body);
      const { testMethodIds, ...sampleData } = body;

      // Verify order belongs to org
      const order = await prisma.order.findFirst({
        where: { id: body.orderId, organizationId: request.user.organizationId },
      });

      if (!order) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Order not found', details: null },
        });
      }

      const sampleCount = await prisma.sample.count({
        where: { organizationId: request.user.organizationId },
      });
      const sampleNumber = `SMP-${String(sampleCount + 1).padStart(6, '0')}`;
      const barcodeValue = `LF-${sampleNumber}`;

      const sample = await prisma.$transaction(async (tx) => {
        const newSample = await tx.sample.create({
          data: {
            ...sampleData,
            organizationId: request.user.organizationId,
            sampleNumber,
            barcodeValue,
            barcodeFormat: 'CODE128',
            status: 'REGISTERED',
            createdById: request.user.id,
          },
        });

        if (testMethodIds && testMethodIds.length > 0) {
          for (const testMethodId of testMethodIds) {
            await tx.test.create({
              data: {
                sampleId: newSample.id,
                testMethodId,
                organizationId: request.user.organizationId,
                status: 'PENDING',
                assignedById: request.user.id,
              },
            });
          }
        }

        // Create initial chain of custody entry
        await tx.chainOfCustody.create({
          data: {
            sampleId: newSample.id,
            action: 'REGISTERED',
            performedById: request.user.id,
            performedAt: new Date(),
            notes: 'Sample registered in the system',
          },
        });

        return tx.sample.findUnique({
          where: { id: newSample.id },
          include: {
            tests: { include: { testMethod: true } },
            order: { select: { id: true, orderNumber: true } },
          },
        });
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'Sample',
          entityId: sample!.id,
          details: { sampleNumber, orderId: body.orderId },
        },
      });

      return reply.status(201).send({ data: sample });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:id - Get sample by ID
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const sample = await prisma.sample.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            client: { select: { id: true, name: true, code: true } },
          },
        },
        tests: {
          include: {
            testMethod: true,
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
            results: true,
          },
        },
        storageLocation: true,
        parentSample: { select: { id: true, sampleNumber: true } },
        childSamples: { select: { id: true, sampleNumber: true, status: true } },
        chainOfCustody: {
          orderBy: { performedAt: 'desc' },
          include: {
            performedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!sample) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Sample not found', details: null },
      });
    }

    return reply.send({ data: sample });
  });

  // PATCH /:id - Update sample
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = UpdateSampleSchema.parse(request.body);

      const existing = await prisma.sample.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Sample not found', details: null },
        });
      }

      if (['DISPOSED', 'CANCELLED'].includes(existing.status)) {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: 'Cannot update a disposed or cancelled sample', details: null },
        });
      }

      const sample = await prisma.sample.update({
        where: { id },
        data: { ...body, updatedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'Sample',
          entityId: id,
          details: { changes: body },
        },
      });

      return reply.send({ data: sample });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // POST /:id/receive - Receive sample
  fastify.post('/:id/receive', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = ReceiveSampleSchema.parse(request.body);

      const sample = await prisma.sample.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!sample) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Sample not found', details: null },
        });
      }

      if (sample.status !== 'REGISTERED') {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: `Cannot receive sample in ${sample.status} status`, details: null },
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const s = await tx.sample.update({
          where: { id },
          data: {
            status: body.storageLocationId ? 'IN_STORAGE' : 'RECEIVED',
            receivedDate: body.receivedDate,
            receivedById: request.user.id,
            conditionOnReceipt: body.conditionOnReceipt,
            temperatureOnReceipt: body.temperatureOnReceipt,
            storageLocationId: body.storageLocationId,
            storageCondition: body.storageCondition,
            updatedAt: new Date(),
          },
        });

        await tx.chainOfCustody.create({
          data: {
            sampleId: id,
            action: 'RECEIVED',
            toLocation: body.storageLocationId || null,
            performedById: request.user.id,
            performedAt: body.receivedDate,
            temperature: body.temperatureOnReceipt,
            notes: body.notes,
          },
        });

        return s;
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'RECEIVE',
          entityType: 'Sample',
          entityId: id,
          details: { conditionOnReceipt: body.conditionOnReceipt, temperature: body.temperatureOnReceipt },
        },
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

  // POST /:id/store - Store sample
  fastify.post('/:id/store', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = StoreSampleSchema.parse(request.body);

      const sample = await prisma.sample.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!sample) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Sample not found', details: null },
        });
      }

      // Verify storage location belongs to org
      const location = await prisma.storageLocation.findFirst({
        where: { id: body.storageLocationId, organizationId: request.user.organizationId },
      });

      if (!location) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Storage location not found', details: null },
        });
      }

      const previousLocationId = sample.storageLocationId;

      const updated = await prisma.$transaction(async (tx) => {
        const s = await tx.sample.update({
          where: { id },
          data: {
            status: 'IN_STORAGE',
            storageLocationId: body.storageLocationId,
            storageCondition: body.storageCondition,
            updatedAt: new Date(),
          },
        });

        await tx.chainOfCustody.create({
          data: {
            sampleId: id,
            action: 'STORED',
            fromLocation: previousLocationId,
            toLocation: body.storageLocationId,
            performedById: request.user.id,
            performedAt: new Date(),
            notes: body.notes,
          },
        });

        return s;
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'STORE',
          entityType: 'Sample',
          entityId: id,
          details: { storageLocationId: body.storageLocationId, previousLocationId },
        },
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

  // POST /:id/retrieve - Retrieve sample from storage
  fastify.post('/:id/retrieve', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = RetrieveSampleSchema.parse(request.body);

      const sample = await prisma.sample.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!sample) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Sample not found', details: null },
        });
      }

      if (sample.status !== 'IN_STORAGE') {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: 'Sample is not in storage', details: null },
        });
      }

      const previousLocationId = sample.storageLocationId;

      const updated = await prisma.$transaction(async (tx) => {
        const s = await tx.sample.update({
          where: { id },
          data: {
            status: 'RECEIVED',
            storageLocationId: null,
            updatedAt: new Date(),
          },
        });

        await tx.chainOfCustody.create({
          data: {
            sampleId: id,
            action: 'RETRIEVED',
            fromLocation: previousLocationId,
            toLocation: null,
            performedById: request.user.id,
            performedAt: new Date(),
            notes: `Reason: ${body.reason}. ${body.notes || ''}`.trim(),
          },
        });

        return s;
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'RETRIEVE',
          entityType: 'Sample',
          entityId: id,
          details: { reason: body.reason, previousLocationId },
        },
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

  // POST /:id/dispose - Dispose sample
  fastify.post('/:id/dispose', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = DisposeSampleSchema.parse(request.body);

      const sample = await prisma.sample.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!sample) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Sample not found', details: null },
        });
      }

      if (['DISPOSED', 'CANCELLED'].includes(sample.status)) {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: `Cannot dispose sample in ${sample.status} status`, details: null },
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const s = await tx.sample.update({
          where: { id },
          data: {
            status: 'DISPOSED',
            disposalDate: body.disposalDate,
            disposalMethod: body.disposalMethod,
            disposedById: request.user.id,
            storageLocationId: null,
            updatedAt: new Date(),
          },
        });

        await tx.chainOfCustody.create({
          data: {
            sampleId: id,
            action: 'DISPOSED',
            fromLocation: sample.storageLocationId,
            performedById: request.user.id,
            performedAt: body.disposalDate,
            notes: `Method: ${body.disposalMethod}. ${body.notes || ''}`.trim(),
          },
        });

        return s;
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'DISPOSE',
          entityType: 'Sample',
          entityId: id,
          details: { disposalMethod: body.disposalMethod },
        },
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

  // POST /:id/aliquot - Create aliquots from a sample
  fastify.post('/:id/aliquot', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = AliquotSchema.parse(request.body);

      const sample = await prisma.sample.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!sample) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Sample not found', details: null },
        });
      }

      if (['DISPOSED', 'CANCELLED'].includes(sample.status)) {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: `Cannot aliquot a ${sample.status} sample`, details: null },
        });
      }

      const sampleCount = await prisma.sample.count({
        where: { organizationId: request.user.organizationId },
      });

      const aliquots = await prisma.$transaction(async (tx) => {
        const created = [];
        for (let i = 0; i < body.numberOfAliquots; i++) {
          const sampleNumber = `SMP-${String(sampleCount + i + 1).padStart(6, '0')}`;
          const barcodeValue = `LF-${sampleNumber}`;

          const aliquot = await tx.sample.create({
            data: {
              organizationId: request.user.organizationId,
              orderId: sample.orderId,
              sampleNumber,
              barcodeValue,
              barcodeFormat: 'CODE128',
              status: sample.status,
              parentSampleId: id,
              name: `${sample.name || sample.sampleNumber} - Aliquot ${i + 1}`,
              matrix: sample.matrix,
              sampleType: sample.sampleType,
              storageCondition: sample.storageCondition,
              storageLocationId: sample.storageLocationId,
              quantity: body.quantityPerAliquot,
              quantityUnit: body.quantityUnit || sample.quantityUnit,
              lotNumber: sample.lotNumber,
              batchNumber: sample.batchNumber,
              tags: sample.tags as string[],
              createdById: request.user.id,
            },
          });

          await tx.chainOfCustody.create({
            data: {
              sampleId: aliquot.id,
              action: 'ALIQUOTED',
              performedById: request.user.id,
              performedAt: new Date(),
              notes: `Aliquot ${i + 1} of ${body.numberOfAliquots} from ${sample.sampleNumber}. ${body.notes || ''}`.trim(),
            },
          });

          created.push(aliquot);
        }
        return created;
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'ALIQUOT',
          entityType: 'Sample',
          entityId: id,
          details: {
            numberOfAliquots: body.numberOfAliquots,
            aliquotIds: aliquots.map(a => a.id),
          },
        },
      });

      return reply.status(201).send({ data: aliquots });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:id/chain-of-custody - Get chain of custody for a sample
  fastify.get('/:id/chain-of-custody', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const sample = await prisma.sample.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });

    if (!sample) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Sample not found', details: null },
      });
    }

    const entries = await prisma.chainOfCustody.findMany({
      where: { sampleId: id },
      orderBy: { performedAt: 'asc' },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return reply.send({ data: entries });
  });

  // POST /:id/chain-of-custody - Add chain of custody entry
  fastify.post('/:id/chain-of-custody', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = ChainOfCustodySchema.parse(request.body);

      const sample = await prisma.sample.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!sample) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Sample not found', details: null },
        });
      }

      const entry = await prisma.chainOfCustody.create({
        data: {
          sampleId: id,
          action: body.action,
          fromLocation: body.fromLocation,
          toLocation: body.toLocation,
          performedById: request.user.id,
          performedAt: new Date(),
          notes: body.notes,
          signatureUrl: body.signatureUrl,
          temperature: body.temperature,
        },
        include: {
          performedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CHAIN_OF_CUSTODY_ENTRY',
          entityType: 'Sample',
          entityId: id,
          details: { cocAction: body.action },
        },
      });

      return reply.status(201).send({ data: entry });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:id/label - Get label data for a sample
  fastify.get('/:id/label', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const sample = await prisma.sample.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        order: {
          select: {
            orderNumber: true,
            client: { select: { name: true, code: true } },
          },
        },
      },
    });

    if (!sample) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Sample not found', details: null },
      });
    }

    const labelData = {
      sampleNumber: sample.sampleNumber,
      barcodeValue: sample.barcodeValue,
      barcodeFormat: sample.barcodeFormat,
      clientSampleId: sample.clientSampleId,
      name: sample.name,
      matrix: sample.matrix,
      sampleType: sample.sampleType,
      collectedDate: sample.collectedDate,
      receivedDate: sample.receivedDate,
      orderNumber: sample.order.orderNumber,
      clientName: sample.order.client.name,
      clientCode: sample.order.client.code,
      storageCondition: sample.storageCondition,
      lotNumber: sample.lotNumber,
      batchNumber: sample.batchNumber,
      expirationDate: sample.expirationDate,
    };

    return reply.send({ data: labelData });
  });

  // POST /scan - Lookup sample by barcode
  fastify.post('/scan', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = ScanSchema.parse(request.body);

      const sample = await prisma.sample.findFirst({
        where: {
          barcodeValue: body.barcodeValue,
          organizationId: request.user.organizationId,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              client: { select: { id: true, name: true } },
            },
          },
          storageLocation: { select: { id: true, name: true, path: true } },
          tests: {
            include: {
              testMethod: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });

      if (!sample) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'No sample found for this barcode', details: null },
        });
      }

      return reply.send({ data: sample });
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
