import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50).optional(),
  description: z.string().optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).default('ACTIVE'),
  managerId: z.string().uuid().optional().nullable(),
  budget: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

const UpdateProjectSchema = CreateProjectSchema.partial();

const routes: FastifyPluginAsync = async (fastify) => {
  // GET /clients/:clientId/projects - List projects for a client
  fastify.get('/clients/:clientId/projects', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { clientId } = z.object({ clientId: z.string().uuid() }).parse(request.params);
      const query = PaginationSchema.extend({
        search: z.string().optional(),
        status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).optional(),
      }).parse(request.query);

      const { page, pageSize, sort, order, search, status } = query;
      const skip = (page - 1) * pageSize;

      // Verify client belongs to org
      const client = await prisma.client.findFirst({
        where: { id: clientId, organizationId: request.user.organizationId, deletedAt: null },
      });

      if (!client) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Client not found', details: null },
        });
      }

      const where: Record<string, unknown> = {
        clientId,
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (status) where.status = status;

      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            manager: { select: { id: true, firstName: true, lastName: true, email: true } },
            _count: { select: { orders: true } },
          },
        }),
        prisma.project.count({ where }),
      ]);

      return reply.send({
        data: projects,
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

  // POST /clients/:clientId/projects - Create project for a client
  fastify.post('/clients/:clientId/projects', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { clientId } = z.object({ clientId: z.string().uuid() }).parse(request.params);
      const body = CreateProjectSchema.parse(request.body);

      const client = await prisma.client.findFirst({
        where: { id: clientId, organizationId: request.user.organizationId, deletedAt: null },
      });

      if (!client) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Client not found', details: null },
        });
      }

      const project = await prisma.project.create({
        data: {
          ...body,
          clientId,
          organizationId: request.user.organizationId,
          createdById: request.user.id,
        },
        include: {
          manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'Project',
          entityId: project.id,
          details: { name: project.name, clientId },
        },
      });

      return reply.status(201).send({ data: project });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // PATCH /:id - Update project
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = UpdateProjectSchema.parse(request.body);

      const existing = await prisma.project.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Project not found', details: null },
        });
      }

      const project = await prisma.project.update({
        where: { id },
        data: { ...body, updatedAt: new Date() },
        include: {
          manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'Project',
          entityId: project.id,
          details: { changes: body },
        },
      });

      return reply.send({ data: project });
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
