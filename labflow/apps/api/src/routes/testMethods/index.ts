import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const TestMethodFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  category: z.string().optional(),
  matrix: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

const CreateTestMethodSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  matrix: z.array(z.string()).optional(),
  referenceStandard: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  turnaroundDays: z.number().int().min(0).optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
  requiresInstrument: z.boolean().default(false),
  instrumentTypeRequired: z.string().optional().nullable(),
  samplePreparation: z.string().optional().nullable(),
  procedureNotes: z.string().optional().nullable(),
  qualityControlRequirements: z.string().optional().nullable(),
  accreditations: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

const UpdateTestMethodSchema = CreateTestMethodSchema.partial();

const CreateAnalyteSchema = z.object({
  name: z.string().min(1).max(255),
  casNumber: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  defaultDetectionLimit: z.number().optional().nullable(),
  defaultQuantitationLimit: z.number().optional().nullable(),
  defaultMethod: z.string().optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().default(true),
});

const UpdateAnalyteSchema = CreateAnalyteSchema.partial();

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List test methods
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = TestMethodFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, category, matrix, isActive } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { referenceStandard: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (category) where.category = category;
      if (matrix) where.matrix = { has: matrix };
      if (isActive !== undefined) where.isActive = isActive;

      const [methods, total] = await Promise.all([
        prisma.testMethod.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            _count: { select: { analytes: true, tests: true } },
          },
        }),
        prisma.testMethod.count({ where }),
      ]);

      return reply.send({
        data: methods,
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

  // POST / - Create test method
  fastify.post('/', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const body = CreateTestMethodSchema.parse(request.body);

      // Check for duplicate code
      const existing = await prisma.testMethod.findFirst({
        where: { code: body.code, organizationId: request.user.organizationId },
      });

      if (existing) {
        return reply.status(409).send({
          error: { code: 'DUPLICATE', message: 'A test method with this code already exists', details: null },
        });
      }

      const method = await prisma.testMethod.create({
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
          entityType: 'TestMethod',
          entityId: method.id,
          details: { name: method.name, code: method.code },
        },
      });

      return reply.status(201).send({ data: method });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:id - Get test method by ID
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const method = await prisma.testMethod.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        analytes: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { tests: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!method) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Test method not found', details: null },
      });
    }

    return reply.send({ data: method });
  });

  // PATCH /:id - Update test method
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = UpdateTestMethodSchema.parse(request.body);

      const existing = await prisma.testMethod.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Test method not found', details: null },
        });
      }

      // Check code uniqueness if code is being changed
      if (body.code && body.code !== existing.code) {
        const duplicate = await prisma.testMethod.findFirst({
          where: { code: body.code, organizationId: request.user.organizationId, id: { not: id } },
        });
        if (duplicate) {
          return reply.status(409).send({
            error: { code: 'DUPLICATE', message: 'A test method with this code already exists', details: null },
          });
        }
      }

      const method = await prisma.testMethod.update({
        where: { id },
        data: { ...body, updatedAt: new Date() },
        include: { analytes: { orderBy: { sortOrder: 'asc' } } },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'TestMethod',
          entityId: id,
          details: { changes: body },
        },
      });

      return reply.send({ data: method });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // POST /:id/analytes - Add analyte to test method
  fastify.post('/:id/analytes', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = CreateAnalyteSchema.parse(request.body);

      const method = await prisma.testMethod.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!method) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Test method not found', details: null },
        });
      }

      const analyte = await prisma.analyte.create({
        data: {
          ...body,
          testMethodId: id,
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'Analyte',
          entityId: analyte.id,
          details: { testMethodId: id, analyteName: body.name },
        },
      });

      return reply.status(201).send({ data: analyte });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // PATCH /:id/analytes/:aid - Update analyte
  fastify.patch('/:id/analytes/:aid', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const params = z.object({
        id: z.string().uuid(),
        aid: z.string().uuid(),
      }).parse(request.params);
      const body = UpdateAnalyteSchema.parse(request.body);

      const method = await prisma.testMethod.findFirst({
        where: { id: params.id, organizationId: request.user.organizationId },
      });

      if (!method) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Test method not found', details: null },
        });
      }

      const existingAnalyte = await prisma.analyte.findFirst({
        where: { id: params.aid, testMethodId: params.id },
      });

      if (!existingAnalyte) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Analyte not found', details: null },
        });
      }

      const analyte = await prisma.analyte.update({
        where: { id: params.aid },
        data: { ...body, updatedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'Analyte',
          entityId: params.aid,
          details: { testMethodId: params.id, changes: body },
        },
      });

      return reply.send({ data: analyte });
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
