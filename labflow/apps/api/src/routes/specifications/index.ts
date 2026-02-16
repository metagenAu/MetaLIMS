import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const SpecFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  category: z.string().optional(),
  matrix: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  clientId: z.string().uuid().optional(),
});

const CreateSpecificationSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  matrix: z.string().optional().nullable(),
  regulatoryBody: z.string().optional().nullable(),
  referenceDocument: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  effectiveDate: z.coerce.date().optional().nullable(),
  expirationDate: z.coerce.date().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

const UpdateSpecificationSchema = CreateSpecificationSchema.partial();

const CreateLimitSchema = z.object({
  analyteId: z.string().uuid().optional().nullable(),
  analyteName: z.string().min(1),
  testMethodId: z.string().uuid().optional().nullable(),
  unit: z.string().optional().nullable(),
  lowerLimit: z.number().optional().nullable(),
  upperLimit: z.number().optional().nullable(),
  targetValue: z.number().optional().nullable(),
  limitType: z.enum(['RANGE', 'MAX', 'MIN', 'TARGET', 'PASS_FAIL', 'INFORMATIONAL']).default('RANGE'),
  passCondition: z.string().optional().nullable(),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().optional().default(0),
  notes: z.string().optional().nullable(),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List specifications
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = SpecFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, category, matrix, isActive, clientId } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { regulatoryBody: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (category) where.category = category;
      if (matrix) where.matrix = matrix;
      if (isActive !== undefined) where.isActive = isActive;
      if (clientId) where.clientId = clientId;

      const [specs, total] = await Promise.all([
        prisma.specification.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            client: { select: { id: true, name: true } },
            _count: { select: { limits: true } },
          },
        }),
        prisma.specification.count({ where }),
      ]);

      return reply.send({
        data: specs,
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

  // POST / - Create specification
  fastify.post('/', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const body = CreateSpecificationSchema.parse(request.body);

      const existing = await prisma.specification.findFirst({
        where: { code: body.code, organizationId: request.user.organizationId },
      });

      if (existing) {
        return reply.status(409).send({
          error: { code: 'DUPLICATE', message: 'A specification with this code already exists', details: null },
        });
      }

      const spec = await prisma.specification.create({
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
          entityType: 'Specification',
          entityId: spec.id,
          details: { name: spec.name, code: spec.code },
        },
      });

      return reply.status(201).send({ data: spec });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:id - Get specification by ID
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const spec = await prisma.specification.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        limits: {
          orderBy: { sortOrder: 'asc' },
          include: {
            analyte: { select: { id: true, name: true, casNumber: true } },
            testMethod: { select: { id: true, name: true, code: true } },
          },
        },
        client: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!spec) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Specification not found', details: null },
      });
    }

    return reply.send({ data: spec });
  });

  // PATCH /:id - Update specification
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = UpdateSpecificationSchema.parse(request.body);

      const existing = await prisma.specification.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Specification not found', details: null },
        });
      }

      if (body.code && body.code !== existing.code) {
        const duplicate = await prisma.specification.findFirst({
          where: { code: body.code, organizationId: request.user.organizationId, id: { not: id } },
        });
        if (duplicate) {
          return reply.status(409).send({
            error: { code: 'DUPLICATE', message: 'A specification with this code already exists', details: null },
          });
        }
      }

      const spec = await prisma.specification.update({
        where: { id },
        data: { ...body, updatedAt: new Date() },
        include: {
          limits: { orderBy: { sortOrder: 'asc' } },
          client: { select: { id: true, name: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'Specification',
          entityId: id,
          details: { changes: body },
        },
      });

      return reply.send({ data: spec });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // POST /:id/limits - Add specification limit
  fastify.post('/:id/limits', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = CreateLimitSchema.parse(request.body);

      const spec = await prisma.specification.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!spec) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Specification not found', details: null },
        });
      }

      const limit = await prisma.specificationLimit.create({
        data: {
          ...body,
          specificationId: id,
        },
        include: {
          analyte: { select: { id: true, name: true } },
          testMethod: { select: { id: true, name: true, code: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'SpecificationLimit',
          entityId: limit.id,
          details: { specificationId: id, analyteName: body.analyteName, limitType: body.limitType },
        },
      });

      return reply.status(201).send({ data: limit });
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
