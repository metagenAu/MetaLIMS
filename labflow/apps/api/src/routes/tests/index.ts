import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const TestFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  status: z.enum([
    'PENDING', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED',
    'APPROVED', 'REJECTED', 'CANCELLED',
  ]).optional(),
  sampleId: z.string().uuid().optional(),
  testMethodId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'RUSH', 'EMERGENCY']).optional(),
});

const CreateTestSchema = z.object({
  sampleId: z.string().uuid(),
  testMethodId: z.string().uuid(),
  assignedToId: z.string().uuid().optional().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'RUSH', 'EMERGENCY']).default('NORMAL'),
  dueDate: z.coerce.date().optional().nullable(),
  instrumentId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const UpdateTestSchema = z.object({
  assignedToId: z.string().uuid().optional().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'RUSH', 'EMERGENCY']).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  instrumentId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const TestResultSchema = z.object({
  analyte: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional().nullable(),
  qualifier: z.string().optional().nullable(),
  detectionLimit: z.number().optional().nullable(),
  quantitationLimit: z.number().optional().nullable(),
  dilutionFactor: z.number().optional().nullable(),
  methodReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const SubmitResultsSchema = z.object({
  results: z.array(TestResultSchema).min(1),
  completedAt: z.coerce.date().default(() => new Date()),
  notes: z.string().optional().nullable(),
});

const UpdateResultSchema = z.object({
  value: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional().nullable(),
  qualifier: z.string().optional().nullable(),
  detectionLimit: z.number().optional().nullable(),
  quantitationLimit: z.number().optional().nullable(),
  dilutionFactor: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const ReviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  comments: z.string().optional().nullable(),
});

const BatchAssignSchema = z.object({
  testIds: z.array(z.string().uuid()).min(1),
  assignedToId: z.string().uuid(),
});

const WorklistFilterSchema = PaginationSchema.extend({
  assignedToId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'RUSH', 'EMERGENCY']).optional(),
  dueDate: z.enum(['overdue', 'today', 'this_week']).optional(),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List tests with filters
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = TestFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, status, sampleId, testMethodId, assignedToId, priority } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { testMethod: { name: { contains: search, mode: 'insensitive' } } },
          { testMethod: { code: { contains: search, mode: 'insensitive' } } },
          { sample: { sampleNumber: { contains: search, mode: 'insensitive' } } },
        ];
      }
      if (status) where.status = status;
      if (sampleId) where.sampleId = sampleId;
      if (testMethodId) where.testMethodId = testMethodId;
      if (assignedToId) where.assignedToId = assignedToId;
      if (priority) where.priority = priority;

      const [tests, total] = await Promise.all([
        prisma.test.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            sample: { select: { id: true, sampleNumber: true, name: true, order: { select: { id: true, orderNumber: true, client: { select: { id: true, name: true } } } } } },
            testMethod: { select: { id: true, name: true, code: true } },
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
            instrument: { select: { id: true, name: true } },
            _count: { select: { results: true } },
          },
        }),
        prisma.test.count({ where }),
      ]);

      return reply.send({
        data: tests,
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

  // POST / - Create test (assign test to sample)
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = CreateTestSchema.parse(request.body);

      // Verify sample belongs to org
      const sample = await prisma.sample.findFirst({
        where: { id: body.sampleId, organizationId: request.user.organizationId },
      });

      if (!sample) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Sample not found', details: null },
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

      const test = await prisma.test.create({
        data: {
          ...body,
          organizationId: request.user.organizationId,
          status: 'PENDING',
          assignedById: request.user.id,
        },
        include: {
          testMethod: true,
          sample: { select: { id: true, sampleNumber: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'Test',
          entityId: test.id,
          details: { sampleId: body.sampleId, testMethodId: body.testMethodId },
        },
      });

      return reply.status(201).send({ data: test });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:id - Get test by ID
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const test = await prisma.test.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        sample: {
          select: {
            id: true,
            sampleNumber: true,
            name: true,
            matrix: true,
            order: { select: { id: true, orderNumber: true, client: { select: { id: true, name: true } } } },
          },
        },
        testMethod: {
          include: { analytes: true },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        instrument: true,
        results: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!test) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Test not found', details: null },
      });
    }

    return reply.send({ data: test });
  });

  // PATCH /:id - Update test
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = UpdateTestSchema.parse(request.body);

      const existing = await prisma.test.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Test not found', details: null },
        });
      }

      if (['APPROVED', 'CANCELLED'].includes(existing.status)) {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: 'Cannot update an approved or cancelled test', details: null },
        });
      }

      const test = await prisma.test.update({
        where: { id },
        data: { ...body, updatedAt: new Date() },
        include: {
          testMethod: { select: { id: true, name: true, code: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'Test',
          entityId: id,
          details: { changes: body },
        },
      });

      return reply.send({ data: test });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // POST /:id/start - Start a test
  fastify.post('/:id/start', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const test = await prisma.test.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });

    if (!test) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Test not found', details: null },
      });
    }

    if (test.status !== 'PENDING') {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: `Cannot start test in ${test.status} status`, details: null },
      });
    }

    const updated = await prisma.test.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        assignedToId: test.assignedToId || request.user.id,
        updatedAt: new Date(),
      },
    });

    // Update sample status to IN_PROGRESS if needed
    await prisma.sample.updateMany({
      where: {
        id: test.sampleId,
        status: { in: ['RECEIVED', 'IN_STORAGE', 'REGISTERED'] },
      },
      data: { status: 'IN_PROGRESS' },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'START',
        entityType: 'Test',
        entityId: id,
        details: { previousStatus: test.status },
      },
    });

    return reply.send({ data: updated });
  });

  // POST /:id/results - Submit test results
  fastify.post('/:id/results', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = SubmitResultsSchema.parse(request.body);

      const test = await prisma.test.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!test) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Test not found', details: null },
        });
      }

      if (!['PENDING', 'IN_PROGRESS'].includes(test.status)) {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: `Cannot submit results for test in ${test.status} status`, details: null },
        });
      }

      const results = await prisma.$transaction(async (tx) => {
        const createdResults = [];
        for (const result of body.results) {
          const created = await tx.testResult.create({
            data: {
              testId: id,
              analyte: result.analyte,
              value: String(result.value),
              numericValue: typeof result.value === 'number' ? result.value : parseFloat(String(result.value)) || null,
              unit: result.unit,
              qualifier: result.qualifier,
              detectionLimit: result.detectionLimit,
              quantitationLimit: result.quantitationLimit,
              dilutionFactor: result.dilutionFactor,
              methodReference: result.methodReference,
              notes: result.notes,
              enteredById: request.user.id,
              enteredAt: new Date(),
            },
          });
          createdResults.push(created);
        }

        // Update test status if not already in progress
        await tx.test.update({
          where: { id },
          data: {
            status: 'IN_PROGRESS',
            startedAt: test.startedAt || new Date(),
            updatedAt: new Date(),
          },
        });

        return createdResults;
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'SUBMIT_RESULTS',
          entityType: 'Test',
          entityId: id,
          details: { resultCount: body.results.length },
        },
      });

      return reply.status(201).send({ data: results });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // PATCH /:id/results/:rid - Update a specific result
  fastify.patch('/:id/results/:rid', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const params = z.object({
        id: z.string().uuid(),
        rid: z.string().uuid(),
      }).parse(request.params);
      const body = UpdateResultSchema.parse(request.body);

      const test = await prisma.test.findFirst({
        where: { id: params.id, organizationId: request.user.organizationId },
      });

      if (!test) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Test not found', details: null },
        });
      }

      if (['APPROVED', 'CANCELLED'].includes(test.status)) {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: 'Cannot modify results for an approved or cancelled test', details: null },
        });
      }

      const existingResult = await prisma.testResult.findFirst({
        where: { id: params.rid, testId: params.id },
      });

      if (!existingResult) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Result not found', details: null },
        });
      }

      const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };
      if (body.value !== undefined) {
        updateData.value = String(body.value);
        updateData.numericValue = typeof body.value === 'number' ? body.value : parseFloat(String(body.value)) || null;
      }

      const result = await prisma.testResult.update({
        where: { id: params.rid },
        data: updateData,
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE_RESULT',
          entityType: 'TestResult',
          entityId: params.rid,
          details: { testId: params.id, changes: body, previousValue: existingResult.value },
        },
      });

      return reply.send({ data: result });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // POST /:id/complete - Mark test as completed (analyst done)
  fastify.post('/:id/complete', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ notes: z.string().optional().nullable() }).parse(request.body || {});

    const test = await prisma.test.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: { _count: { select: { results: true } } },
    });

    if (!test) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Test not found', details: null },
      });
    }

    if (test.status !== 'IN_PROGRESS') {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: `Cannot complete test in ${test.status} status`, details: null },
      });
    }

    if (test._count.results === 0) {
      return reply.status(400).send({
        error: { code: 'NO_RESULTS', message: 'Test must have at least one result before completing', details: null },
      });
    }

    const updated = await prisma.test.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        notes: body.notes || test.notes,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'COMPLETE',
        entityType: 'Test',
        entityId: id,
        details: { resultCount: test._count.results },
      },
    });

    return reply.send({ data: updated });
  });

  // POST /:id/submit-review - Submit test for review
  fastify.post('/:id/submit-review', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const test = await prisma.test.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });

    if (!test) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Test not found', details: null },
      });
    }

    if (test.status !== 'COMPLETED') {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: 'Test must be completed before submitting for review', details: null },
      });
    }

    const updated = await prisma.test.update({
      where: { id },
      data: {
        status: 'PENDING_REVIEW',
        submittedForReviewAt: new Date(),
        submittedForReviewById: request.user.id,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'SUBMIT_FOR_REVIEW',
        entityType: 'Test',
        entityId: id,
        details: {},
      },
    });

    return reply.send({ data: updated });
  });

  // POST /:id/review - Review test results (approve/reject)
  fastify.post('/:id/review', {
    preHandler: [fastify.authenticate, fastify.requireRole('SENIOR_ANALYST')],
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = ReviewSchema.parse(request.body);

      const test = await prisma.test.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!test) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Test not found', details: null },
        });
      }

      if (!['COMPLETED', 'PENDING_REVIEW'].includes(test.status)) {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: 'Test must be completed or pending review to be reviewed', details: null },
        });
      }

      const newStatus = body.decision === 'APPROVE' ? 'REVIEWED' : 'REJECTED';

      const updated = await prisma.test.update({
        where: { id },
        data: {
          status: newStatus,
          reviewedById: request.user.id,
          reviewedAt: new Date(),
          reviewComments: body.comments,
          updatedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: body.decision === 'APPROVE' ? 'REVIEW_APPROVE' : 'REVIEW_REJECT',
          entityType: 'Test',
          entityId: id,
          details: { decision: body.decision, comments: body.comments },
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

  // POST /:id/approve - Final approval of test results
  fastify.post('/:id/approve', {
    preHandler: [fastify.authenticate, fastify.requireRole('LAB_DIRECTOR')],
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ comments: z.string().optional().nullable() }).parse(request.body || {});

    const test = await prisma.test.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });

    if (!test) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Test not found', details: null },
      });
    }

    if (test.status !== 'REVIEWED') {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: 'Test must be reviewed before approval', details: null },
      });
    }

    const updated = await prisma.test.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: request.user.id,
        approvedAt: new Date(),
        approvalComments: body.comments,
        updatedAt: new Date(),
      },
    });

    // Check if all tests for the sample are approved
    const sampleTests = await prisma.test.findMany({
      where: { sampleId: test.sampleId },
    });

    const allApproved = sampleTests.every(t =>
      t.id === id ? true : t.status === 'APPROVED'
    );

    if (allApproved) {
      await prisma.sample.update({
        where: { id: test.sampleId },
        data: { status: 'APPROVED' },
      });
    }

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'APPROVE',
        entityType: 'Test',
        entityId: id,
        details: { comments: body.comments, allSampleTestsApproved: allApproved },
      },
    });

    return reply.send({ data: updated });
  });

  // POST /:id/reject - Reject test results (send back for re-testing)
  fastify.post('/:id/reject', {
    preHandler: [fastify.authenticate, fastify.requireRole('SENIOR_ANALYST')],
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = z.object({
        reason: z.string().min(1),
        comments: z.string().optional().nullable(),
      }).parse(request.body);

      const test = await prisma.test.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!test) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Test not found', details: null },
        });
      }

      if (!['COMPLETED', 'PENDING_REVIEW', 'REVIEWED'].includes(test.status)) {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: `Cannot reject test in ${test.status} status`, details: null },
        });
      }

      const updated = await prisma.test.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedById: request.user.id,
          reviewedAt: new Date(),
          reviewComments: `Rejected: ${body.reason}. ${body.comments || ''}`.trim(),
          updatedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'REJECT',
          entityType: 'Test',
          entityId: id,
          details: { reason: body.reason, comments: body.comments },
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

  // GET /worklist - Get analyst worklist
  fastify.get('/worklist', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = WorklistFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, assignedToId, status, priority, dueDate } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      };

      if (assignedToId) {
        where.assignedToId = assignedToId;
      } else {
        // Default to current user's worklist
        where.assignedToId = request.user.id;
      }

      if (status) where.status = status;
      if (priority) where.priority = priority;

      if (dueDate === 'overdue') {
        where.dueDate = { lt: new Date() };
      } else if (dueDate === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        where.dueDate = { gte: startOfDay, lte: endOfDay };
      } else if (dueDate === 'this_week') {
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        where.dueDate = { gte: startOfWeek, lte: endOfWeek };
      }

      const [tests, total] = await Promise.all([
        prisma.test.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [
            { priority: 'desc' },
            { dueDate: 'asc' },
            { [sort]: order },
          ],
          include: {
            sample: {
              select: {
                id: true,
                sampleNumber: true,
                name: true,
                matrix: true,
                order: { select: { id: true, orderNumber: true, client: { select: { id: true, name: true } }, priority: true } },
              },
            },
            testMethod: { select: { id: true, name: true, code: true } },
            instrument: { select: { id: true, name: true } },
            _count: { select: { results: true } },
          },
        }),
        prisma.test.count({ where }),
      ]);

      return reply.send({
        data: tests,
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

  // POST /batch-assign - Batch assign tests to an analyst
  fastify.post('/batch-assign', {
    preHandler: [fastify.authenticate, fastify.requireRole('LAB_MANAGER')],
  }, async (request, reply) => {
    try {
      const body = BatchAssignSchema.parse(request.body);

      // Verify the assignee exists and belongs to org
      const assignee = await prisma.user.findFirst({
        where: { id: body.assignedToId, organizationId: request.user.organizationId, isActive: true },
      });

      if (!assignee) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Assignee not found', details: null },
        });
      }

      // Verify all tests belong to org and are assignable
      const tests = await prisma.test.findMany({
        where: {
          id: { in: body.testIds },
          organizationId: request.user.organizationId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      });

      if (tests.length !== body.testIds.length) {
        const foundIds = tests.map(t => t.id);
        const missingIds = body.testIds.filter(id => !foundIds.includes(id));
        return reply.status(400).send({
          error: {
            code: 'INVALID_TESTS',
            message: 'Some tests were not found or are not in an assignable status',
            details: { missingOrInvalidIds: missingIds },
          },
        });
      }

      await prisma.test.updateMany({
        where: { id: { in: body.testIds } },
        data: {
          assignedToId: body.assignedToId,
          assignedById: request.user.id,
          updatedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'BATCH_ASSIGN',
          entityType: 'Test',
          entityId: body.testIds[0],
          details: {
            testIds: body.testIds,
            assignedToId: body.assignedToId,
            assigneeName: `${assignee.firstName} ${assignee.lastName}`,
            count: body.testIds.length,
          },
        },
      });

      return reply.send({
        data: {
          assigned: body.testIds.length,
          assignedToId: body.assignedToId,
          assigneeName: `${assignee.firstName} ${assignee.lastName}`,
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
