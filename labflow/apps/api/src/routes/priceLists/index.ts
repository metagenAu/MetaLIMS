import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const PriceListFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

const CreatePriceListSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional().nullable(),
  currency: z.string().default('USD'),
  effectiveDate: z.coerce.date().optional().nullable(),
  expirationDate: z.coerce.date().optional().nullable(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  discountPercentage: z.number().min(0).max(100).default(0),
  notes: z.string().optional().nullable(),
});

const UpdatePriceListSchema = CreatePriceListSchema.partial();

const CreatePriceListItemSchema = z.object({
  testMethodId: z.string().uuid(),
  price: z.number().min(0),
  minQuantity: z.number().int().min(1).default(1),
  maxQuantity: z.number().int().optional().nullable(),
  discountPercentage: z.number().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});

const CalculateSchema = z.object({
  items: z.array(z.object({
    testMethodId: z.string().uuid(),
    quantity: z.number().int().min(1).default(1),
  })).min(1),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List price lists
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = PriceListFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, isActive } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (isActive !== undefined) where.isActive = isActive;

      const [priceLists, total] = await Promise.all([
        prisma.priceList.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            _count: { select: { items: true, clients: true } },
          },
        }),
        prisma.priceList.count({ where }),
      ]);

      return reply.send({
        data: priceLists,
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

  // POST / - Create price list
  fastify.post('/', {
    preHandler: [fastify.authenticate, fastify.requireRole('BILLING_ADMIN')],
  }, async (request, reply) => {
    try {
      const body = CreatePriceListSchema.parse(request.body);

      const existing = await prisma.priceList.findFirst({
        where: { code: body.code, organizationId: request.user.organizationId },
      });

      if (existing) {
        return reply.status(409).send({
          error: { code: 'DUPLICATE', message: 'A price list with this code already exists', details: null },
        });
      }

      // If setting as default, unset other defaults
      if (body.isDefault) {
        await prisma.priceList.updateMany({
          where: { organizationId: request.user.organizationId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const priceList = await prisma.priceList.create({
        data: {
          ...body,
          organizationId: request.user.organizationId,
          createdById: request.user.id,
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'PriceList',
          entityId: priceList.id,
          details: { name: priceList.name, code: priceList.code },
        },
      });

      return reply.status(201).send({ data: priceList });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:id - Get price list by ID
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const priceList = await prisma.priceList.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        items: {
          include: {
            testMethod: { select: { id: true, name: true, code: true, price: true } },
          },
          orderBy: { testMethod: { name: 'asc' } },
        },
        clients: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!priceList) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Price list not found', details: null },
      });
    }

    return reply.send({ data: priceList });
  });

  // PATCH /:id - Update price list
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate, fastify.requireRole('BILLING_ADMIN')],
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = UpdatePriceListSchema.parse(request.body);

      const existing = await prisma.priceList.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Price list not found', details: null },
        });
      }

      if (body.code && body.code !== existing.code) {
        const duplicate = await prisma.priceList.findFirst({
          where: { code: body.code, organizationId: request.user.organizationId, id: { not: id } },
        });
        if (duplicate) {
          return reply.status(409).send({
            error: { code: 'DUPLICATE', message: 'A price list with this code already exists', details: null },
          });
        }
      }

      if (body.isDefault) {
        await prisma.priceList.updateMany({
          where: { organizationId: request.user.organizationId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      const priceList = await prisma.priceList.update({
        where: { id },
        data: { ...body, updatedAt: new Date() },
        include: {
          items: {
            include: { testMethod: { select: { id: true, name: true, code: true } } },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'PriceList',
          entityId: id,
          details: { changes: body },
        },
      });

      return reply.send({ data: priceList });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // POST /:id/items - Add item to price list
  fastify.post('/:id/items', {
    preHandler: [fastify.authenticate, fastify.requireRole('BILLING_ADMIN')],
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = CreatePriceListItemSchema.parse(request.body);

      const priceList = await prisma.priceList.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!priceList) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Price list not found', details: null },
        });
      }

      // Verify test method exists
      const testMethod = await prisma.testMethod.findFirst({
        where: { id: body.testMethodId, organizationId: request.user.organizationId },
      });

      if (!testMethod) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Test method not found', details: null },
        });
      }

      // Check for existing item with same test method in this price list
      const existingItem = await prisma.priceListItem.findFirst({
        where: { priceListId: id, testMethodId: body.testMethodId },
      });

      if (existingItem) {
        return reply.status(409).send({
          error: { code: 'DUPLICATE', message: 'This test method already has a price in this price list', details: null },
        });
      }

      const item = await prisma.priceListItem.create({
        data: {
          ...body,
          priceListId: id,
        },
        include: {
          testMethod: { select: { id: true, name: true, code: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'ADD_ITEM',
          entityType: 'PriceList',
          entityId: id,
          details: { testMethodId: body.testMethodId, testMethodName: testMethod.name, price: body.price },
        },
      });

      return reply.status(201).send({ data: item });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:id/calculate - Calculate pricing for a list of tests
  fastify.get('/:id/calculate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = CalculateSchema.parse(request.body || request.query);

      const priceList = await prisma.priceList.findFirst({
        where: { id, organizationId: request.user.organizationId },
        include: {
          items: {
            include: {
              testMethod: { select: { id: true, name: true, code: true, price: true } },
            },
          },
        },
      });

      if (!priceList) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Price list not found', details: null },
        });
      }

      const lineItems = body.items.map(item => {
        const priceListItem = priceList.items.find(
          pli => pli.testMethodId === item.testMethodId
        );

        const basePrice = priceListItem?.price ?? 0;
        const itemDiscount = priceListItem?.discountPercentage ?? 0;
        const listDiscount = priceList.discountPercentage;

        const effectiveDiscount = Math.min(100, itemDiscount + listDiscount);
        const unitPrice = basePrice * (1 - effectiveDiscount / 100);
        const subtotal = unitPrice * item.quantity;

        return {
          testMethodId: item.testMethodId,
          testMethodName: priceListItem?.testMethod.name ?? 'Unknown',
          testMethodCode: priceListItem?.testMethod.code ?? 'N/A',
          quantity: item.quantity,
          basePrice,
          itemDiscount,
          listDiscount,
          effectiveDiscount,
          unitPrice,
          subtotal,
          found: !!priceListItem,
        };
      });

      const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);

      return reply.send({
        data: {
          priceListId: priceList.id,
          priceListName: priceList.name,
          currency: priceList.currency,
          lineItems,
          subtotal,
          notFound: lineItems.filter(item => !item.found).map(item => item.testMethodId),
        },
      });
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
