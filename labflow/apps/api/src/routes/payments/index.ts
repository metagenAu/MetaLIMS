import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10',
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const PaymentFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(),
  invoiceId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  method: z.enum(['CASH', 'CHECK', 'BANK_TRANSFER', 'CREDIT_CARD', 'STRIPE', 'OTHER']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

const CreatePaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().min(0.01),
  method: z.enum(['CASH', 'CHECK', 'BANK_TRANSFER', 'CREDIT_CARD', 'STRIPE', 'OTHER']),
  referenceNumber: z.string().optional().nullable(),
  paymentDate: z.coerce.date().default(() => new Date()),
  notes: z.string().optional().nullable(),
});

const RefundSchema = z.object({
  amount: z.number().min(0.01),
  reason: z.string().min(1),
  notes: z.string().optional().nullable(),
});

const CreateIntentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().min(0.01).optional(),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List payments
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = PaymentFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, status, invoiceId, clientId, method, dateFrom, dateTo } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { referenceNumber: { contains: search, mode: 'insensitive' } },
          { invoice: { invoiceNumber: { contains: search, mode: 'insensitive' } } },
          { invoice: { client: { name: { contains: search, mode: 'insensitive' } } } },
        ];
      }
      if (status) where.status = status;
      if (invoiceId) where.invoiceId = invoiceId;
      if (clientId) where.invoice = { clientId };
      if (method) where.method = method;
      if (dateFrom || dateTo) {
        where.paymentDate = {};
        if (dateFrom) (where.paymentDate as Record<string, unknown>).gte = dateFrom;
        if (dateTo) (where.paymentDate as Record<string, unknown>).lte = dateTo;
      }

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                total: true,
                client: { select: { id: true, name: true } },
              },
            },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        prisma.payment.count({ where }),
      ]);

      return reply.send({
        data: payments,
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

  // POST / - Record payment
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = CreatePaymentSchema.parse(request.body);

      const invoice = await prisma.invoice.findFirst({
        where: { id: body.invoiceId, organizationId: request.user.organizationId },
      });

      if (!invoice) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Invoice not found', details: null },
        });
      }

      if (['VOID', 'CREDITED'].includes(invoice.status)) {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: `Cannot record payment for ${invoice.status} invoice`, details: null },
        });
      }

      if (body.amount > invoice.amountDue) {
        return reply.status(400).send({
          error: {
            code: 'OVERPAYMENT',
            message: `Payment amount (${body.amount}) exceeds amount due (${invoice.amountDue})`,
            details: null,
          },
        });
      }

      const payment = await prisma.$transaction(async (tx) => {
        const pmt = await tx.payment.create({
          data: {
            invoiceId: body.invoiceId,
            organizationId: request.user.organizationId,
            amount: body.amount,
            method: body.method,
            referenceNumber: body.referenceNumber,
            paymentDate: body.paymentDate,
            status: 'COMPLETED',
            notes: body.notes,
            createdById: request.user.id,
          },
        });

        const newAmountPaid = invoice.amountPaid + body.amount;
        const newAmountDue = invoice.total - newAmountPaid;
        const newStatus = newAmountDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

        await tx.invoice.update({
          where: { id: body.invoiceId },
          data: {
            amountPaid: newAmountPaid,
            amountDue: Math.max(0, newAmountDue),
            status: newStatus,
            paidAt: newStatus === 'PAID' ? new Date() : null,
            updatedAt: new Date(),
          },
        });

        return pmt;
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'RECORD_PAYMENT',
          entityType: 'Payment',
          entityId: payment.id,
          details: {
            invoiceId: body.invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            amount: body.amount,
            method: body.method,
          },
        },
      });

      return reply.status(201).send({ data: payment });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:id - Get payment by ID
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const payment = await prisma.payment.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        invoice: {
          include: {
            client: { select: { id: true, name: true, code: true } },
          },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        refunds: true,
      },
    });

    if (!payment) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Payment not found', details: null },
      });
    }

    return reply.send({ data: payment });
  });

  // POST /:id/refund - Refund a payment
  fastify.post('/:id/refund', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = RefundSchema.parse(request.body);

      const payment = await prisma.payment.findFirst({
        where: { id, organizationId: request.user.organizationId },
        include: { invoice: true, refunds: true },
      });

      if (!payment) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Payment not found', details: null },
        });
      }

      if (payment.status === 'REFUNDED') {
        return reply.status(400).send({
          error: { code: 'ALREADY_REFUNDED', message: 'Payment has already been fully refunded', details: null },
        });
      }

      const totalRefunded = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
      const refundable = payment.amount - totalRefunded;

      if (body.amount > refundable) {
        return reply.status(400).send({
          error: {
            code: 'EXCESSIVE_REFUND',
            message: `Refund amount (${body.amount}) exceeds refundable amount (${refundable})`,
            details: null,
          },
        });
      }

      const refund = await prisma.$transaction(async (tx) => {
        const ref = await tx.paymentRefund.create({
          data: {
            paymentId: id,
            amount: body.amount,
            reason: body.reason,
            notes: body.notes,
            createdById: request.user.id,
          },
        });

        const newTotalRefunded = totalRefunded + body.amount;
        const isFullyRefunded = newTotalRefunded >= payment.amount;

        await tx.payment.update({
          where: { id },
          data: {
            status: isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            refundedAmount: newTotalRefunded,
            updatedAt: new Date(),
          },
        });

        // Update invoice amounts
        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            amountPaid: { decrement: body.amount },
            amountDue: { increment: body.amount },
            status: 'SENT', // Reset to sent since payment has been (partially) refunded
            paidAt: null,
            updatedAt: new Date(),
          },
        });

        // If Stripe payment, process refund through Stripe
        if (payment.stripePaymentIntentId) {
          try {
            await stripe.refunds.create({
              payment_intent: payment.stripePaymentIntentId,
              amount: Math.round(body.amount * 100),
            });
          } catch (stripeErr) {
            fastify.log.error(stripeErr, 'Stripe refund failed');
            // Still record in our system, flag for manual follow-up
          }
        }

        return ref;
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'REFUND',
          entityType: 'Payment',
          entityId: id,
          details: {
            refundId: refund.id,
            amount: body.amount,
            reason: body.reason,
            invoiceId: payment.invoiceId,
          },
        },
      });

      return reply.status(201).send({ data: refund });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // POST /stripe/create-intent - Create a Stripe payment intent
  fastify.post('/stripe/create-intent', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const body = CreateIntentSchema.parse(request.body);

      const invoice = await prisma.invoice.findFirst({
        where: { id: body.invoiceId, organizationId: request.user.organizationId },
        include: {
          client: { select: { id: true, name: true, email: true } },
        },
      });

      if (!invoice) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Invoice not found', details: null },
        });
      }

      if (['VOID', 'PAID', 'CREDITED'].includes(invoice.status)) {
        return reply.status(400).send({
          error: { code: 'INVALID_STATUS', message: `Cannot create payment for ${invoice.status} invoice`, details: null },
        });
      }

      const amount = body.amount || invoice.amountDue;
      if (amount <= 0) {
        return reply.status(400).send({
          error: { code: 'INVALID_AMOUNT', message: 'Payment amount must be greater than zero', details: null },
        });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: invoice.currency.toLowerCase(),
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          organizationId: request.user.organizationId,
          clientId: invoice.clientId,
        },
        description: `Payment for Invoice ${invoice.invoiceNumber}`,
      });

      return reply.send({
        data: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount,
          currency: invoice.currency,
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      if (err instanceof Stripe.errors.StripeError) {
        return reply.status(400).send({
          error: { code: 'STRIPE_ERROR', message: err.message, details: null },
        });
      }
      throw err;
    }
  });

  // POST /stripe/webhook - Handle Stripe webhook events
  fastify.post('/stripe/webhook', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        (request as unknown as { rawBody: string }).rawBody,
        sig,
        STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      fastify.log.error(err, 'Stripe webhook signature verification failed');
      return reply.status(400).send({
        error: { code: 'WEBHOOK_SIGNATURE_INVALID', message: 'Invalid webhook signature', details: null },
      });
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata.invoiceId;
        const organizationId = paymentIntent.metadata.organizationId;

        if (invoiceId && organizationId) {
          const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, organizationId },
          });

          if (invoice) {
            const amount = paymentIntent.amount / 100;

            await prisma.$transaction(async (tx) => {
              await tx.payment.create({
                data: {
                  invoiceId,
                  organizationId,
                  amount,
                  method: 'STRIPE',
                  status: 'COMPLETED',
                  stripePaymentIntentId: paymentIntent.id,
                  paymentDate: new Date(),
                  referenceNumber: paymentIntent.id,
                },
              });

              const newAmountPaid = invoice.amountPaid + amount;
              const newAmountDue = Math.max(0, invoice.total - newAmountPaid);
              const newStatus = newAmountDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

              await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                  amountPaid: newAmountPaid,
                  amountDue: newAmountDue,
                  status: newStatus,
                  paidAt: newStatus === 'PAID' ? new Date() : null,
                  updatedAt: new Date(),
                },
              });
            });

            await prisma.auditLog.create({
              data: {
                organizationId,
                action: 'STRIPE_PAYMENT_RECEIVED',
                entityType: 'Invoice',
                entityId: invoiceId,
                details: {
                  paymentIntentId: paymentIntent.id,
                  amount,
                  invoiceNumber: invoice.invoiceNumber,
                },
              },
            });
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata.invoiceId;
        const organizationId = paymentIntent.metadata.organizationId;

        if (invoiceId && organizationId) {
          await prisma.auditLog.create({
            data: {
              organizationId,
              action: 'STRIPE_PAYMENT_FAILED',
              entityType: 'Invoice',
              entityId: invoiceId,
              details: {
                paymentIntentId: paymentIntent.id,
                error: paymentIntent.last_payment_error?.message,
              },
            },
          });
        }
        break;
      }

      default:
        fastify.log.info({ type: event.type }, 'Unhandled Stripe event type');
    }

    return reply.send({ received: true });
  });
};

export default routes;
