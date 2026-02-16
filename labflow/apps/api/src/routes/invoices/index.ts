import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const InvoiceFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'VOID', 'CREDITED']).optional(),
  clientId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  dueDateFrom: z.coerce.date().optional(),
  dueDateTo: z.coerce.date().optional(),
});

const InvoiceLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  testId: z.string().uuid().optional().nullable(),
  testMethodId: z.string().uuid().optional().nullable(),
  orderId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const CreateInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  orderId: z.string().uuid().optional().nullable(),
  dueDate: z.coerce.date(),
  currency: z.string().default('USD'),
  taxRate: z.number().min(0).max(100).default(0),
  discount: z.number().min(0).default(0),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).default('FIXED'),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  purchaseOrderNumber: z.string().optional().nullable(),
  lineItems: z.array(InvoiceLineItemSchema).min(1),
});

const UpdateInvoiceSchema = z.object({
  dueDate: z.coerce.date().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  purchaseOrderNumber: z.string().optional().nullable(),
  lineItems: z.array(InvoiceLineItemSchema).optional(),
});

const AutoGenerateSchema = z.object({
  orderId: z.string().uuid(),
  dueDate: z.coerce.date().optional(),
  applyPriceList: z.boolean().default(true),
});

const CreditNoteSchema = z.object({
  reason: z.string().min(1),
  lineItems: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().min(0),
    unitPrice: z.number().min(0),
    notes: z.string().optional().nullable(),
  })).min(1),
  notes: z.string().optional().nullable(),
});

function calculateLineItemTotal(item: { quantity: number; unitPrice: number; discount: number; taxRate: number }) {
  const subtotal = item.quantity * item.unitPrice;
  const discountAmount = subtotal * (item.discount / 100);
  const afterDiscount = subtotal - discountAmount;
  const tax = afterDiscount * (item.taxRate / 100);
  return afterDiscount + tax;
}

function calculateInvoiceTotals(lineItems: Array<{ quantity: number; unitPrice: number; discount: number; taxRate: number }>, invoiceDiscount: number, invoiceDiscountType: string) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lineDiscounts = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (item.discount / 100)), 0);
  const afterLineDiscounts = subtotal - lineDiscounts;

  let invoiceDiscountAmount = 0;
  if (invoiceDiscountType === 'PERCENTAGE') {
    invoiceDiscountAmount = afterLineDiscounts * (invoiceDiscount / 100);
  } else {
    invoiceDiscountAmount = invoiceDiscount;
  }

  const afterAllDiscounts = afterLineDiscounts - invoiceDiscountAmount;
  const taxTotal = lineItems.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.unitPrice * (1 - item.discount / 100);
    return sum + itemSubtotal * (item.taxRate / 100);
  }, 0);

  return {
    subtotal,
    discountTotal: lineDiscounts + invoiceDiscountAmount,
    taxTotal,
    total: afterAllDiscounts + taxTotal,
  };
}

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List invoices
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = InvoiceFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, status, clientId, dateFrom, dateTo, dueDateFrom, dueDateTo } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
          { purchaseOrderNumber: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (status) where.status = status;
      if (clientId) where.clientId = clientId;
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) (where.createdAt as Record<string, unknown>).gte = dateFrom;
        if (dateTo) (where.createdAt as Record<string, unknown>).lte = dateTo;
      }
      if (dueDateFrom || dueDateTo) {
        where.dueDate = {};
        if (dueDateFrom) (where.dueDate as Record<string, unknown>).gte = dueDateFrom;
        if (dueDateTo) (where.dueDate as Record<string, unknown>).lte = dueDateTo;
      }

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            client: { select: { id: true, name: true, code: true } },
            _count: { select: { lineItems: true, payments: true } },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      return reply.send({
        data: invoices,
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

  // POST / - Create invoice
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = CreateInvoiceSchema.parse(request.body);

      const client = await prisma.client.findFirst({
        where: { id: body.clientId, organizationId: request.user.organizationId, deletedAt: null },
      });

      if (!client) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Client not found', details: null },
        });
      }

      const invoiceCount = await prisma.invoice.count({
        where: { organizationId: request.user.organizationId },
      });
      const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(6, '0')}`;

      const totals = calculateInvoiceTotals(body.lineItems, body.discount, body.discountType);

      const invoice = await prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.create({
          data: {
            invoiceNumber,
            clientId: body.clientId,
            orderId: body.orderId,
            organizationId: request.user.organizationId,
            status: 'DRAFT',
            issueDate: new Date(),
            dueDate: body.dueDate,
            currency: body.currency,
            subtotal: totals.subtotal,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            total: totals.total,
            amountPaid: 0,
            amountDue: totals.total,
            taxRate: body.taxRate,
            discount: body.discount,
            discountType: body.discountType,
            notes: body.notes,
            termsAndConditions: body.termsAndConditions,
            purchaseOrderNumber: body.purchaseOrderNumber,
            createdById: request.user.id,
          },
        });

        for (const item of body.lineItems) {
          const lineTotal = calculateLineItemTotal(item);
          await tx.invoiceLineItem.create({
            data: {
              invoiceId: inv.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              taxRate: item.taxRate,
              total: lineTotal,
              testId: item.testId,
              testMethodId: item.testMethodId,
              orderId: item.orderId,
              notes: item.notes,
            },
          });
        }

        return tx.invoice.findUnique({
          where: { id: inv.id },
          include: {
            lineItems: true,
            client: { select: { id: true, name: true } },
          },
        });
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'Invoice',
          entityId: invoice!.id,
          details: { invoiceNumber, clientId: body.clientId, total: totals.total },
        },
      });

      return reply.status(201).send({ data: invoice });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // POST /auto-generate - Auto-generate invoice from order
  fastify.post('/auto-generate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = AutoGenerateSchema.parse(request.body);

      const order = await prisma.order.findFirst({
        where: { id: body.orderId, organizationId: request.user.organizationId },
        include: {
          client: {
            include: { priceList: { include: { items: true } } },
          },
          samples: {
            include: {
              tests: {
                where: { status: 'APPROVED' },
                include: { testMethod: true },
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

      // Build line items from approved tests
      const lineItems: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        taxRate: number;
        testId: string | null;
        testMethodId: string;
        orderId: string;
      }> = [];

      for (const sample of order.samples) {
        for (const test of sample.tests) {
          let unitPrice = test.testMethod.price || 0;

          // Apply price list if available
          if (body.applyPriceList && order.client.priceList) {
            const priceListItem = order.client.priceList.items.find(
              (item: { testMethodId: string }) => item.testMethodId === test.testMethodId
            );
            if (priceListItem) {
              unitPrice = priceListItem.price;
            }
          }

          lineItems.push({
            description: `${test.testMethod.name} (${test.testMethod.code}) - Sample ${sample.sampleNumber}`,
            quantity: 1,
            unitPrice,
            discount: 0,
            taxRate: 0,
            testId: test.id,
            testMethodId: test.testMethodId,
            orderId: order.id,
          });
        }
      }

      if (lineItems.length === 0) {
        return reply.status(400).send({
          error: { code: 'NO_APPROVED_TESTS', message: 'No approved tests found for this order', details: null },
        });
      }

      const invoiceCount = await prisma.invoice.count({
        where: { organizationId: request.user.organizationId },
      });
      const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(6, '0')}`;

      const defaultDueDate = new Date();
      defaultDueDate.setDate(defaultDueDate.getDate() + (order.client.paymentTerms || 30));

      const totals = calculateInvoiceTotals(lineItems, 0, 'FIXED');

      const invoice = await prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.create({
          data: {
            invoiceNumber,
            clientId: order.clientId,
            orderId: order.id,
            organizationId: request.user.organizationId,
            status: 'DRAFT',
            issueDate: new Date(),
            dueDate: body.dueDate || defaultDueDate,
            currency: 'USD',
            subtotal: totals.subtotal,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            total: totals.total,
            amountPaid: 0,
            amountDue: totals.total,
            taxRate: 0,
            discount: 0,
            discountType: 'FIXED',
            purchaseOrderNumber: order.purchaseOrderNumber,
            createdById: request.user.id,
          },
        });

        for (const item of lineItems) {
          const lineTotal = calculateLineItemTotal(item);
          await tx.invoiceLineItem.create({
            data: {
              invoiceId: inv.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              taxRate: item.taxRate,
              total: lineTotal,
              testId: item.testId,
              testMethodId: item.testMethodId,
              orderId: item.orderId,
            },
          });
        }

        return tx.invoice.findUnique({
          where: { id: inv.id },
          include: { lineItems: true, client: { select: { id: true, name: true } } },
        });
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'AUTO_GENERATE',
          entityType: 'Invoice',
          entityId: invoice!.id,
          details: { invoiceNumber, orderId: body.orderId, total: totals.total, lineItemCount: lineItems.length },
        },
      });

      return reply.status(201).send({ data: invoice });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:id - Get invoice by ID
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        client: true,
        order: { select: { id: true, orderNumber: true } },
        lineItems: {
          include: {
            testMethod: { select: { id: true, name: true, code: true } },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        creditNotes: {
          orderBy: { createdAt: 'desc' },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!invoice) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Invoice not found', details: null },
      });
    }

    return reply.send({ data: invoice });
  });

  // PATCH /:id - Update invoice (only drafts)
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = UpdateInvoiceSchema.parse(request.body);

      const existing = await prisma.invoice.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Invoice not found', details: null },
        });
      }

      if (existing.status !== 'DRAFT') {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: 'Only draft invoices can be edited', details: null },
        });
      }

      const { lineItems: newLineItems, ...invoiceData } = body;

      const invoice = await prisma.$transaction(async (tx) => {
        if (newLineItems) {
          // Delete existing line items and recreate
          await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });

          for (const item of newLineItems) {
            const lineTotal = calculateLineItemTotal(item);
            await tx.invoiceLineItem.create({
              data: {
                invoiceId: id,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                taxRate: item.taxRate,
                total: lineTotal,
                testId: item.testId,
                testMethodId: item.testMethodId,
                orderId: item.orderId,
                notes: item.notes,
              },
            });
          }

          const totals = calculateInvoiceTotals(
            newLineItems,
            body.discount ?? existing.discount,
            body.discountType ?? existing.discountType,
          );

          return tx.invoice.update({
            where: { id },
            data: {
              ...invoiceData,
              subtotal: totals.subtotal,
              discountTotal: totals.discountTotal,
              taxTotal: totals.taxTotal,
              total: totals.total,
              amountDue: totals.total - existing.amountPaid,
              updatedAt: new Date(),
            },
            include: { lineItems: true, client: { select: { id: true, name: true } } },
          });
        }

        return tx.invoice.update({
          where: { id },
          data: { ...invoiceData, updatedAt: new Date() },
          include: { lineItems: true, client: { select: { id: true, name: true } } },
        });
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'Invoice',
          entityId: id,
          details: { changes: body },
        },
      });

      return reply.send({ data: invoice });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // POST /:id/approve - Approve invoice
  fastify.post('/:id/approve', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });

    if (!invoice) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Invoice not found', details: null },
      });
    }

    if (!['DRAFT', 'PENDING_APPROVAL'].includes(invoice.status)) {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: `Cannot approve invoice in ${invoice.status} status`, details: null },
      });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: request.user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'APPROVE',
        entityType: 'Invoice',
        entityId: id,
        details: { invoiceNumber: invoice.invoiceNumber },
      },
    });

    return reply.send({ data: updated });
  });

  // POST /:id/send - Send invoice to client
  fastify.post('/:id/send', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = z.object({
        recipientEmails: z.array(z.string().email()).min(1),
        subject: z.string().optional().nullable(),
        message: z.string().optional().nullable(),
      }).parse(request.body);

      const invoice = await prisma.invoice.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!invoice) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Invoice not found', details: null },
        });
      }

      if (invoice.status !== 'APPROVED') {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: 'Invoice must be approved before sending', details: null },
        });
      }

      fastify.log.info({
        invoiceId: id,
        recipients: body.recipientEmails,
      }, 'Invoice send requested (queue email in production)');

      const updated = await prisma.invoice.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          sentById: request.user.id,
          updatedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'SEND',
          entityType: 'Invoice',
          entityId: id,
          details: { invoiceNumber: invoice.invoiceNumber, recipients: body.recipientEmails },
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

  // POST /:id/void - Void an invoice
  fastify.post('/:id/void', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      reason: z.string().min(1),
    }).parse(request.body);

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });

    if (!invoice) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Invoice not found', details: null },
      });
    }

    if (['VOID', 'PAID'].includes(invoice.status)) {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: `Cannot void invoice in ${invoice.status} status`, details: null },
      });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'VOID',
        voidedAt: new Date(),
        voidedById: request.user.id,
        voidReason: body.reason,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'VOID',
        entityType: 'Invoice',
        entityId: id,
        details: { invoiceNumber: invoice.invoiceNumber, reason: body.reason },
      },
    });

    return reply.send({ data: updated });
  });

  // GET /:id/pdf - Get invoice PDF
  fastify.get('/:id/pdf', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        client: true,
        lineItems: true,
        organization: true,
      },
    });

    if (!invoice) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Invoice not found', details: null },
      });
    }

    if (invoice.pdfUrl) {
      return reply.redirect(invoice.pdfUrl);
    }

    return reply.send({
      data: {
        invoice,
        generatedAt: new Date().toISOString(),
        message: 'PDF generation pending. Use the invoice data to generate PDF client-side or configure a PDF generation service.',
      },
    });
  });

  // POST /:id/credit-note - Issue credit note
  fastify.post('/:id/credit-note', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = CreditNoteSchema.parse(request.body);

      const invoice = await prisma.invoice.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!invoice) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Invoice not found', details: null },
        });
      }

      if (!['SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status)) {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: 'Credit notes can only be issued for sent, paid, or overdue invoices', details: null },
        });
      }

      const creditTotal = body.lineItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice, 0
      );

      const creditNoteCount = await prisma.creditNote.count({
        where: { organizationId: request.user.organizationId },
      });
      const creditNoteNumber = `CN-${String(creditNoteCount + 1).padStart(6, '0')}`;

      const creditNote = await prisma.$transaction(async (tx) => {
        const cn = await tx.creditNote.create({
          data: {
            creditNoteNumber,
            invoiceId: id,
            organizationId: request.user.organizationId,
            reason: body.reason,
            total: creditTotal,
            notes: body.notes,
            lineItems: body.lineItems,
            createdById: request.user.id,
          },
        });

        // Update invoice
        const newAmountDue = Math.max(0, invoice.amountDue - creditTotal);
        const newStatus = newAmountDue <= 0 ? 'CREDITED' : invoice.status;

        await tx.invoice.update({
          where: { id },
          data: {
            amountDue: newAmountDue,
            status: newStatus,
            updatedAt: new Date(),
          },
        });

        return cn;
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREDIT_NOTE',
          entityType: 'Invoice',
          entityId: id,
          details: {
            creditNoteNumber,
            creditNoteId: creditNote.id,
            total: creditTotal,
            reason: body.reason,
          },
        },
      });

      return reply.status(201).send({ data: creditNote });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /aging - Get accounts receivable aging report
  fastify.get('/aging', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: request.user.organizationId,
        status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        amountDue: { gt: 0 },
      },
      include: {
        client: { select: { id: true, name: true, code: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    const aging = {
      current: [] as typeof invoices,
      days1to30: [] as typeof invoices,
      days31to60: [] as typeof invoices,
      days61to90: [] as typeof invoices,
      over90: [] as typeof invoices,
    };

    for (const inv of invoices) {
      const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue <= 0) {
        aging.current.push(inv);
      } else if (daysOverdue <= 30) {
        aging.days1to30.push(inv);
      } else if (daysOverdue <= 60) {
        aging.days31to60.push(inv);
      } else if (daysOverdue <= 90) {
        aging.days61to90.push(inv);
      } else {
        aging.over90.push(inv);
      }
    }

    const summary = {
      current: aging.current.reduce((sum, inv) => sum + inv.amountDue, 0),
      days1to30: aging.days1to30.reduce((sum, inv) => sum + inv.amountDue, 0),
      days31to60: aging.days31to60.reduce((sum, inv) => sum + inv.amountDue, 0),
      days61to90: aging.days61to90.reduce((sum, inv) => sum + inv.amountDue, 0),
      over90: aging.over90.reduce((sum, inv) => sum + inv.amountDue, 0),
      totalOutstanding: invoices.reduce((sum, inv) => sum + inv.amountDue, 0),
    };

    return reply.send({ data: { aging, summary } });
  });

  // GET /overdue - Get overdue invoices
  fastify.get('/overdue', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = PaginationSchema.parse(request.query);
      const { page, pageSize, sort, order } = query;
      const skip = (page - 1) * pageSize;

      const where = {
        organizationId: request.user.organizationId,
        dueDate: { lt: new Date() },
        status: { in: ['SENT', 'PARTIALLY_PAID'] as string[] },
        amountDue: { gt: 0 },
      };

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            client: { select: { id: true, name: true, code: true, email: true } },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      const enriched = invoices.map(inv => ({
        ...inv,
        daysOverdue: Math.floor((new Date().getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      }));

      return reply.send({
        data: enriched,
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
};

export default routes;
