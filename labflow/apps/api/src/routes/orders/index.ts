import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const OrderFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  status: z.enum([
    'DRAFT', 'SUBMITTED', 'RECEIVED', 'IN_PROGRESS',
    'COMPLETED', 'REPORTED', 'ON_HOLD', 'CANCELLED',
  ]).optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'RUSH', 'EMERGENCY']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

const CreateOrderSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'RUSH', 'EMERGENCY']).default('NORMAL'),
  dueDate: z.coerce.date().optional().nullable(),
  purchaseOrderNumber: z.string().optional().nullable(),
  quotationId: z.string().uuid().optional().nullable(),
  instructions: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
  samples: z.array(z.object({
    clientSampleId: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    matrix: z.string().optional().nullable(),
    sampleType: z.string().optional().nullable(),
    collectedDate: z.coerce.date().optional().nullable(),
    collectedBy: z.string().optional().nullable(),
    quantity: z.number().optional().nullable(),
    quantityUnit: z.string().optional().nullable(),
    testMethodIds: z.array(z.string().uuid()).optional(),
  })).optional(),
});

const UpdateOrderSchema = z.object({
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'RUSH', 'EMERGENCY']).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  purchaseOrderNumber: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List orders with filters
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = OrderFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, status, clientId, projectId, priority, dateFrom, dateTo } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { purchaseOrderNumber: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
        ];
      }
      if (status) where.status = status;
      if (clientId) where.clientId = clientId;
      if (projectId) where.projectId = projectId;
      if (priority) where.priority = priority;
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) (where.createdAt as Record<string, unknown>).gte = dateFrom;
        if (dateTo) (where.createdAt as Record<string, unknown>).lte = dateTo;
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            client: { select: { id: true, name: true, code: true } },
            project: { select: { id: true, name: true } },
            _count: { select: { samples: true } },
          },
        }),
        prisma.order.count({ where }),
      ]);

      return reply.send({
        data: orders,
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

  // POST / - Create order
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = CreateOrderSchema.parse(request.body);

      // Verify client belongs to org
      const client = await prisma.client.findFirst({
        where: { id: body.clientId, organizationId: request.user.organizationId, deletedAt: null },
      });

      if (!client) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Client not found', details: null },
        });
      }

      // Generate order number
      const orderCount = await prisma.order.count({
        where: { organizationId: request.user.organizationId },
      });
      const orderNumber = `ORD-${String(orderCount + 1).padStart(6, '0')}`;

      const { samples: sampleInputs, ...orderData } = body;

      const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            ...orderData,
            orderNumber,
            organizationId: request.user.organizationId,
            createdById: request.user.id,
            status: 'DRAFT',
          },
        });

        // Create samples if provided
        if (sampleInputs && sampleInputs.length > 0) {
          const sampleCount = await tx.sample.count({
            where: { organizationId: request.user.organizationId },
          });

          for (let i = 0; i < sampleInputs.length; i++) {
            const { testMethodIds, ...sampleData } = sampleInputs[i];
            const sampleNumber = `SMP-${String(sampleCount + i + 1).padStart(6, '0')}`;
            const barcodeValue = `LF-${sampleNumber}`;

            const sample = await tx.sample.create({
              data: {
                ...sampleData,
                orderId: newOrder.id,
                organizationId: request.user.organizationId,
                sampleNumber,
                barcodeValue,
                barcodeFormat: 'CODE128',
                status: 'REGISTERED',
                createdById: request.user.id,
              },
            });

            // Assign test methods to sample
            if (testMethodIds && testMethodIds.length > 0) {
              for (const testMethodId of testMethodIds) {
                await tx.test.create({
                  data: {
                    sampleId: sample.id,
                    testMethodId,
                    organizationId: request.user.organizationId,
                    status: 'PENDING',
                    assignedById: request.user.id,
                  },
                });
              }
            }
          }
        }

        return tx.order.findUnique({
          where: { id: newOrder.id },
          include: {
            client: { select: { id: true, name: true } },
            samples: {
              include: { tests: { include: { testMethod: true } } },
            },
          },
        });
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'Order',
          entityId: order!.id,
          details: { orderNumber, clientId: body.clientId },
        },
      });

      return reply.status(201).send({ data: order });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:id - Get order by ID
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const order = await prisma.order.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        client: { select: { id: true, name: true, code: true, email: true } },
        project: { select: { id: true, name: true } },
        samples: {
          include: {
            tests: {
              include: {
                testMethod: { select: { id: true, name: true, code: true } },
                assignedTo: { select: { id: true, firstName: true, lastName: true } },
              },
            },
            storageLocation: true,
          },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!order) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Order not found', details: null },
      });
    }

    return reply.send({ data: order });
  });

  // PATCH /:id - Update order
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = UpdateOrderSchema.parse(request.body);

      const existing = await prisma.order.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Order not found', details: null },
        });
      }

      if (['COMPLETED', 'CANCELLED'].includes(existing.status)) {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: 'Cannot update a completed or cancelled order', details: null },
        });
      }

      const order = await prisma.order.update({
        where: { id },
        data: { ...body, updatedAt: new Date() },
        include: {
          client: { select: { id: true, name: true } },
          _count: { select: { samples: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'Order',
          entityId: id,
          details: { changes: body },
        },
      });

      return reply.send({ data: order });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // POST /:id/receive - Mark order as received
  fastify.post('/:id/receive', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      receivedDate: z.coerce.date().default(() => new Date()),
      notes: z.string().optional().nullable(),
    }).parse(request.body);

    const order = await prisma.order.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });

    if (!order) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Order not found', details: null },
      });
    }

    if (!['DRAFT', 'SUBMITTED'].includes(order.status)) {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: `Cannot receive order in ${order.status} status`, details: null },
      });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: 'RECEIVED',
        receivedAt: body.receivedDate,
        receivedById: request.user.id,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'RECEIVE',
        entityType: 'Order',
        entityId: id,
        details: { previousStatus: order.status, notes: body.notes },
      },
    });

    return reply.send({ data: updated });
  });

  // POST /:id/submit - Submit order for processing
  fastify.post('/:id/submit', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const order = await prisma.order.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: { _count: { select: { samples: true } } },
    });

    if (!order) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Order not found', details: null },
      });
    }

    if (order.status !== 'DRAFT') {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: `Cannot submit order in ${order.status} status`, details: null },
      });
    }

    if (order._count.samples === 0) {
      return reply.status(400).send({
        error: { code: 'NO_SAMPLES', message: 'Order must have at least one sample before submitting', details: null },
      });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'SUBMIT',
        entityType: 'Order',
        entityId: id,
        details: { previousStatus: order.status },
      },
    });

    return reply.send({ data: updated });
  });

  // POST /:id/hold - Place order on hold
  fastify.post('/:id/hold', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      reason: z.string().min(1),
    }).parse(request.body);

    const order = await prisma.order.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });

    if (!order) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Order not found', details: null },
      });
    }

    if (['COMPLETED', 'CANCELLED', 'ON_HOLD'].includes(order.status)) {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: `Cannot hold order in ${order.status} status`, details: null },
      });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: 'ON_HOLD',
        holdReason: body.reason,
        previousStatus: order.status,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'HOLD',
        entityType: 'Order',
        entityId: id,
        details: { previousStatus: order.status, reason: body.reason },
      },
    });

    return reply.send({ data: updated });
  });

  // POST /:id/cancel - Cancel order
  fastify.post('/:id/cancel', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      reason: z.string().min(1),
    }).parse(request.body);

    const order = await prisma.order.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });

    if (!order) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Order not found', details: null },
      });
    }

    if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: `Cannot cancel order in ${order.status} status`, details: null },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Cancel all pending tests
      await tx.test.updateMany({
        where: {
          sample: { orderId: id },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        data: { status: 'CANCELLED' },
      });

      return tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: body.reason,
          updatedAt: new Date(),
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'CANCEL',
        entityType: 'Order',
        entityId: id,
        details: { previousStatus: order.status, reason: body.reason },
      },
    });

    return reply.send({ data: updated });
  });

  // GET /:id/timeline - Get order timeline / activity history
  fastify.get('/:id/timeline', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const order = await prisma.order.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });

    if (!order) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Order not found', details: null },
      });
    }

    const timeline = await prisma.auditLog.findMany({
      where: {
        organizationId: request.user.organizationId,
        entityType: 'Order',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return reply.send({ data: timeline });
  });
};

export default routes;
