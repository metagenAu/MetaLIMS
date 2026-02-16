import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const ClientFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  type: z.string().optional(),
});

const CreateClientSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50).optional(),
  type: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().nullable(),
  taxId: z.string().optional().nullable(),
  billingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  shippingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  paymentTerms: z.number().int().optional(),
  creditLimit: z.number().optional().nullable(),
  priceListId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

const UpdateClientSchema = CreateClientSchema.partial();

const CreateContactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  isPrimary: z.boolean().optional().default(false),
  receiveReports: z.boolean().optional().default(false),
  receiveInvoices: z.boolean().optional().default(false),
  notes: z.string().optional().nullable(),
});

const UpdateContactSchema = CreateContactSchema.partial();

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List clients with search and filters
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = ClientFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, status, type } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
        deletedAt: null,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (status) where.status = status;
      if (type) where.type = type;

      const [clients, total] = await Promise.all([
        prisma.client.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            _count: { select: { orders: true, contacts: true } },
          },
        }),
        prisma.client.count({ where }),
      ]);

      return reply.send({
        data: clients,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
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

  // POST / - Create client
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = CreateClientSchema.parse(request.body);

      const client = await prisma.client.create({
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
          entityType: 'Client',
          entityId: client.id,
          details: { name: client.name },
        },
      });

      return reply.status(201).send({ data: client });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:id - Get client by ID
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const client = await prisma.client.findFirst({
      where: {
        id,
        organizationId: request.user.organizationId,
        deletedAt: null,
      },
      include: {
        contacts: true,
        priceList: true,
        _count: { select: { orders: true, invoices: true } },
      },
    });

    if (!client) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Client not found', details: null },
      });
    }

    return reply.send({ data: client });
  });

  // PATCH /:id - Update client
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = UpdateClientSchema.parse(request.body);

      const existing = await prisma.client.findFirst({
        where: { id, organizationId: request.user.organizationId, deletedAt: null },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Client not found', details: null },
        });
      }

      const client = await prisma.client.update({
        where: { id },
        data: { ...body, updatedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'Client',
          entityId: client.id,
          details: { changes: body },
        },
      });

      return reply.send({ data: client });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // DELETE /:id - Soft delete client
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const existing = await prisma.client.findFirst({
      where: { id, organizationId: request.user.organizationId, deletedAt: null },
    });

    if (!existing) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Client not found', details: null },
      });
    }

    await prisma.client.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'DELETE',
        entityType: 'Client',
        entityId: id,
        details: { name: existing.name },
      },
    });

    return reply.status(204).send();
  });

  // GET /:id/orders - List orders for a client
  fastify.get('/:id/orders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const query = PaginationSchema.parse(request.query);
    const { page, pageSize, sort, order } = query;
    const skip = (page - 1) * pageSize;

    const client = await prisma.client.findFirst({
      where: { id, organizationId: request.user.organizationId, deletedAt: null },
    });

    if (!client) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Client not found', details: null },
      });
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { clientId: id, organizationId: request.user.organizationId },
        skip,
        take: pageSize,
        orderBy: { [sort]: order },
        include: { _count: { select: { samples: true } } },
      }),
      prisma.order.count({
        where: { clientId: id, organizationId: request.user.organizationId },
      }),
    ]);

    return reply.send({
      data: orders,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  });

  // GET /:id/invoices - List invoices for a client
  fastify.get('/:id/invoices', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const query = PaginationSchema.parse(request.query);
    const { page, pageSize, sort, order } = query;
    const skip = (page - 1) * pageSize;

    const client = await prisma.client.findFirst({
      where: { id, organizationId: request.user.organizationId, deletedAt: null },
    });

    if (!client) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Client not found', details: null },
      });
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { clientId: id, organizationId: request.user.organizationId },
        skip,
        take: pageSize,
        orderBy: { [sort]: order },
      }),
      prisma.invoice.count({
        where: { clientId: id, organizationId: request.user.organizationId },
      }),
    ]);

    return reply.send({
      data: invoices,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  });

  // GET /:id/contacts - List contacts for a client
  fastify.get('/:id/contacts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const client = await prisma.client.findFirst({
      where: { id, organizationId: request.user.organizationId, deletedAt: null },
    });

    if (!client) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Client not found', details: null },
      });
    }

    const contacts = await prisma.clientContact.findMany({
      where: { clientId: id },
      orderBy: { isPrimary: 'desc' },
    });

    return reply.send({ data: contacts });
  });

  // POST /:id/contacts - Create contact for a client
  fastify.post('/:id/contacts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = CreateContactSchema.parse(request.body);

      const client = await prisma.client.findFirst({
        where: { id, organizationId: request.user.organizationId, deletedAt: null },
      });

      if (!client) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Client not found', details: null },
        });
      }

      // If setting as primary, unset other primary contacts
      if (body.isPrimary) {
        await prisma.clientContact.updateMany({
          where: { clientId: id, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const contact = await prisma.clientContact.create({
        data: {
          ...body,
          clientId: id,
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'ClientContact',
          entityId: contact.id,
          details: { clientId: id, name: `${body.firstName} ${body.lastName}` },
        },
      });

      return reply.status(201).send({ data: contact });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // PATCH /:id/contacts/:cid - Update contact
  fastify.patch('/:id/contacts/:cid', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const params = z.object({
        id: z.string().uuid(),
        cid: z.string().uuid(),
      }).parse(request.params);
      const body = UpdateContactSchema.parse(request.body);

      const client = await prisma.client.findFirst({
        where: { id: params.id, organizationId: request.user.organizationId, deletedAt: null },
      });

      if (!client) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Client not found', details: null },
        });
      }

      const existingContact = await prisma.clientContact.findFirst({
        where: { id: params.cid, clientId: params.id },
      });

      if (!existingContact) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Contact not found', details: null },
        });
      }

      if (body.isPrimary) {
        await prisma.clientContact.updateMany({
          where: { clientId: params.id, isPrimary: true, id: { not: params.cid } },
          data: { isPrimary: false },
        });
      }

      const contact = await prisma.clientContact.update({
        where: { id: params.cid },
        data: body,
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'ClientContact',
          entityId: contact.id,
          details: { clientId: params.id, changes: body },
        },
      });

      return reply.send({ data: contact });
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
