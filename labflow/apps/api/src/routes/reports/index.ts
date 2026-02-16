import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const ReportFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'AMENDED', 'CANCELLED']).optional(),
  clientId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

const GenerateReportSchema = z.object({
  orderId: z.string().uuid(),
  reportType: z.enum(['CERTIFICATE_OF_ANALYSIS', 'TEST_REPORT', 'SUMMARY', 'CUSTOM']).default('CERTIFICATE_OF_ANALYSIS'),
  title: z.string().optional().nullable(),
  includeMethodDetails: z.boolean().default(true),
  includeSpecifications: z.boolean().default(true),
  includeChainOfCustody: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  sampleIds: z.array(z.string().uuid()).optional(),
});

const AmendSchema = z.object({
  reason: z.string().min(1),
  changes: z.string().min(1),
  notes: z.string().optional().nullable(),
});

const SendSchema = z.object({
  recipientEmails: z.array(z.string().email()).min(1),
  subject: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  includePdf: z.boolean().default(true),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List reports
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = ReportFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, status, clientId, orderId, dateFrom, dateTo } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { reportNumber: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { order: { client: { name: { contains: search, mode: 'insensitive' } } } },
        ];
      }
      if (status) where.status = status;
      if (clientId) where.order = { clientId };
      if (orderId) where.orderId = orderId;
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) (where.createdAt as Record<string, unknown>).gte = dateFrom;
        if (dateTo) (where.createdAt as Record<string, unknown>).lte = dateTo;
      }

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                client: { select: { id: true, name: true } },
              },
            },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            approvedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        prisma.report.count({ where }),
      ]);

      return reply.send({
        data: reports,
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

  // POST /generate - Generate a new report
  fastify.post('/generate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = GenerateReportSchema.parse(request.body);

      // Verify order exists and belongs to org
      const order = await prisma.order.findFirst({
        where: { id: body.orderId, organizationId: request.user.organizationId },
        include: {
          client: { select: { id: true, name: true } },
          samples: {
            where: body.sampleIds ? { id: { in: body.sampleIds } } : undefined,
            include: {
              tests: {
                where: { status: 'APPROVED' },
                include: {
                  testMethod: true,
                  results: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Order not found', details: null },
        });
      }

      // Generate report number
      const reportCount = await prisma.report.count({
        where: { organizationId: request.user.organizationId },
      });
      const reportNumber = `RPT-${String(reportCount + 1).padStart(6, '0')}`;

      // Build report content from order data
      const reportContent = {
        reportType: body.reportType,
        order: {
          orderNumber: order.orderNumber,
          clientName: order.client.name,
        },
        samples: order.samples.map(sample => ({
          sampleNumber: sample.sampleNumber,
          name: sample.name,
          matrix: sample.matrix,
          sampleType: sample.sampleType,
          receivedDate: sample.receivedDate,
          tests: sample.tests.map(test => ({
            testMethodName: test.testMethod.name,
            testMethodCode: test.testMethod.code,
            results: test.results.map(r => ({
              analyte: r.analyte,
              value: r.value,
              unit: r.unit,
              qualifier: r.qualifier,
            })),
          })),
        })),
        includeMethodDetails: body.includeMethodDetails,
        includeSpecifications: body.includeSpecifications,
        includeChainOfCustody: body.includeChainOfCustody,
      };

      const report = await prisma.report.create({
        data: {
          reportNumber,
          orderId: body.orderId,
          organizationId: request.user.organizationId,
          reportType: body.reportType,
          title: body.title || `${body.reportType.replace(/_/g, ' ')} - ${order.orderNumber}`,
          status: 'DRAFT',
          content: reportContent,
          notes: body.notes,
          templateId: body.templateId,
          version: 1,
          createdById: request.user.id,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'GENERATE',
          entityType: 'Report',
          entityId: report.id,
          details: { reportNumber, orderId: body.orderId, reportType: body.reportType },
        },
      });

      return reply.status(201).send({ data: report });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:id - Get report by ID
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const report = await prisma.report.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            client: { select: { id: true, name: true, code: true, email: true } },
          },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        amendments: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!report) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Report not found', details: null },
      });
    }

    return reply.send({ data: report });
  });

  // GET /:id/pdf - Get report PDF
  fastify.get('/:id/pdf', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const report = await prisma.report.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        order: {
          include: {
            client: true,
            samples: {
              include: {
                tests: {
                  include: { testMethod: true, results: true },
                },
              },
            },
          },
        },
      },
    });

    if (!report) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Report not found', details: null },
      });
    }

    if (report.pdfUrl) {
      return reply.redirect(report.pdfUrl);
    }

    // Return report data for client-side PDF generation
    return reply.send({
      data: {
        report,
        generatedAt: new Date().toISOString(),
        message: 'PDF generation pending. Use the report data to generate PDF client-side or configure a PDF generation service.',
      },
    });
  });

  // POST /:id/approve - Approve report
  fastify.post('/:id/approve', {
    preHandler: [fastify.authenticate, fastify.requireRole('APPROVER')],
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ comments: z.string().optional().nullable() }).parse(request.body || {});

    const report = await prisma.report.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });

    if (!report) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Report not found', details: null },
      });
    }

    if (!['DRAFT', 'PENDING_APPROVAL'].includes(report.status)) {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: `Cannot approve report in ${report.status} status`, details: null },
      });
    }

    const updated = await prisma.report.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: request.user.id,
        approvedAt: new Date(),
        approvalComments: body.comments,
        updatedAt: new Date(),
      },
    });

    // Update order status to REPORTED
    await prisma.order.update({
      where: { id: report.orderId },
      data: { status: 'REPORTED' },
    });

    // Update samples to REPORTED
    await prisma.sample.updateMany({
      where: { orderId: report.orderId, status: 'APPROVED' },
      data: { status: 'REPORTED' },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'APPROVE',
        entityType: 'Report',
        entityId: id,
        details: { reportNumber: report.reportNumber, comments: body.comments },
      },
    });

    return reply.send({ data: updated });
  });

  // POST /:id/send - Send report to client
  fastify.post('/:id/send', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = SendSchema.parse(request.body);

      const report = await prisma.report.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!report) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Report not found', details: null },
        });
      }

      if (report.status !== 'APPROVED') {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: 'Report must be approved before sending', details: null },
        });
      }

      // In production, queue email sending
      fastify.log.info({
        reportId: id,
        recipients: body.recipientEmails,
        subject: body.subject,
      }, 'Report send requested (queue email in production)');

      const updated = await prisma.report.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          sentById: request.user.id,
          sentTo: body.recipientEmails,
          updatedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'SEND',
          entityType: 'Report',
          entityId: id,
          details: {
            reportNumber: report.reportNumber,
            recipients: body.recipientEmails,
            subject: body.subject,
          },
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

  // POST /:id/amend - Amend a sent report
  fastify.post('/:id/amend', {
    preHandler: [fastify.authenticate, fastify.requireRole('APPROVER')],
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = AmendSchema.parse(request.body);

      const report = await prisma.report.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!report) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Report not found', details: null },
        });
      }

      if (!['APPROVED', 'SENT'].includes(report.status)) {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: 'Only approved or sent reports can be amended', details: null },
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        // Create amendment record
        await tx.reportAmendment.create({
          data: {
            reportId: id,
            version: report.version + 1,
            reason: body.reason,
            changes: body.changes,
            notes: body.notes,
            createdById: request.user.id,
          },
        });

        // Update report
        return tx.report.update({
          where: { id },
          data: {
            status: 'AMENDED',
            version: report.version + 1,
            updatedAt: new Date(),
          },
        });
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'AMEND',
          entityType: 'Report',
          entityId: id,
          details: {
            reportNumber: report.reportNumber,
            previousVersion: report.version,
            newVersion: report.version + 1,
            reason: body.reason,
          },
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
};

export default routes;
