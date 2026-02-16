import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@labflow/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10',
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_CONNECT_WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || '';

const routes: FastifyPluginAsync = async (fastify) => {
  // POST / - Main Stripe webhook endpoint
  fastify.post('/', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;

    if (!sig) {
      return reply.status(400).send({
        error: { code: 'MISSING_SIGNATURE', message: 'Missing Stripe signature header', details: null },
      });
    }

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

    // Log the webhook event
    await prisma.webhookEvent.create({
      data: {
        provider: 'STRIPE',
        eventId: event.id,
        eventType: event.type,
        payload: event.data.object as Record<string, unknown>,
        processedAt: null,
      },
    });

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        }

        case 'payment_intent.payment_failed': {
          await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        }

        case 'charge.refunded': {
          await handleChargeRefunded(event.data.object as Stripe.Charge);
          break;
        }

        case 'charge.dispute.created': {
          await handleDisputeCreated(event.data.object as Stripe.Dispute);
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          await handleSubscriptionEvent(event.type, event.data.object as Stripe.Subscription);
          break;
        }

        case 'invoice.paid': {
          await handleStripeInvoicePaid(event.data.object as Stripe.Invoice);
          break;
        }

        case 'invoice.payment_failed': {
          await handleStripeInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        }

        default:
          fastify.log.info({ type: event.type }, 'Unhandled Stripe event type');
      }

      // Mark event as processed
      await prisma.webhookEvent.updateMany({
        where: { eventId: event.id },
        data: { processedAt: new Date() },
      });
    } catch (err) {
      fastify.log.error(err, 'Error processing Stripe webhook event');
      // Mark event as failed
      await prisma.webhookEvent.updateMany({
        where: { eventId: event.id },
        data: { error: (err as Error).message },
      });
    }

    return reply.send({ received: true });
  });

  // Handler functions for each event type

  async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const invoiceId = paymentIntent.metadata.invoiceId;
    const organizationId = paymentIntent.metadata.organizationId;

    if (!invoiceId || !organizationId) {
      fastify.log.warn({ paymentIntentId: paymentIntent.id }, 'Payment intent missing metadata');
      return;
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
    });

    if (!invoice) {
      fastify.log.warn({ invoiceId, organizationId }, 'Invoice not found for payment intent');
      return;
    }

    // Check if payment already recorded (idempotency)
    const existingPayment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (existingPayment) {
      fastify.log.info({ paymentIntentId: paymentIntent.id }, 'Payment already recorded, skipping');
      return;
    }

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
          paymentDate: new Date(paymentIntent.created * 1000),
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

      // Create notification for org admins
      const admins = await tx.user.findMany({
        where: { organizationId, role: 'ADMIN', isActive: true },
        select: { id: true },
      });

      for (const admin of admins) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            organizationId,
            type: 'PAYMENT_RECEIVED',
            title: 'Payment Received',
            message: `Payment of $${amount.toFixed(2)} received for invoice ${invoice.invoiceNumber}`,
            entityType: 'Invoice',
            entityId: invoiceId,
          },
        });
      }
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

  async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const invoiceId = paymentIntent.metadata.invoiceId;
    const organizationId = paymentIntent.metadata.organizationId;

    if (!invoiceId || !organizationId) return;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
    });

    if (!invoice) return;

    // Notify admins about the failed payment
    const admins = await prisma.user.findMany({
      where: { organizationId, role: 'ADMIN', isActive: true },
      select: { id: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          organizationId,
          type: 'PAYMENT_FAILED',
          title: 'Payment Failed',
          message: `Payment failed for invoice ${invoice.invoiceNumber}: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`,
          entityType: 'Invoice',
          entityId: invoiceId,
        },
      });
    }

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

  async function handleChargeRefunded(charge: Stripe.Charge) {
    const paymentIntentId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;

    if (!paymentIntentId) return;

    const payment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: { invoice: true },
    });

    if (!payment) return;

    const refundedAmount = (charge.amount_refunded || 0) / 100;

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: refundedAmount >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          refundedAmount,
          updatedAt: new Date(),
        },
      });

      // Update invoice
      const newAmountPaid = Math.max(0, payment.invoice.amountPaid - refundedAmount);
      const newAmountDue = payment.invoice.total - newAmountPaid;

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          amountDue: Math.max(0, newAmountDue),
          status: newAmountDue > 0 ? 'SENT' : 'PAID',
          paidAt: newAmountDue > 0 ? null : payment.invoice.paidAt,
          updatedAt: new Date(),
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        organizationId: payment.organizationId,
        action: 'STRIPE_REFUND_RECEIVED',
        entityType: 'Payment',
        entityId: payment.id,
        details: { chargeId: charge.id, refundedAmount, paymentIntentId },
      },
    });
  }

  async function handleDisputeCreated(dispute: Stripe.Dispute) {
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
    if (!chargeId) return;

    // Try to find associated payment via charge
    const charge = await stripe.charges.retrieve(chargeId);
    const paymentIntentId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;

    if (!paymentIntentId) return;

    const payment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: { invoice: true },
    });

    if (!payment) return;

    // Notify admins about the dispute
    const admins = await prisma.user.findMany({
      where: { organizationId: payment.organizationId, role: 'ADMIN', isActive: true },
      select: { id: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          organizationId: payment.organizationId,
          type: 'PAYMENT_DISPUTE',
          title: 'Payment Dispute Created',
          message: `A dispute of $${(dispute.amount / 100).toFixed(2)} has been created for invoice ${payment.invoice.invoiceNumber}. Reason: ${dispute.reason}`,
          entityType: 'Payment',
          entityId: payment.id,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        organizationId: payment.organizationId,
        action: 'STRIPE_DISPUTE_CREATED',
        entityType: 'Payment',
        entityId: payment.id,
        details: {
          disputeId: dispute.id,
          amount: dispute.amount / 100,
          reason: dispute.reason,
        },
      },
    });
  }

  async function handleSubscriptionEvent(eventType: string, subscription: Stripe.Subscription) {
    const organizationId = subscription.metadata?.organizationId;
    if (!organizationId) return;

    const action = eventType === 'customer.subscription.created'
      ? 'SUBSCRIPTION_CREATED'
      : eventType === 'customer.subscription.updated'
        ? 'SUBSCRIPTION_UPDATED'
        : 'SUBSCRIPTION_DELETED';

    await prisma.auditLog.create({
      data: {
        organizationId,
        action,
        entityType: 'Subscription',
        entityId: subscription.id,
        details: {
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      },
    });

    // Update organization subscription status if needed
    if (eventType === 'customer.subscription.deleted') {
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          subscriptionStatus: 'CANCELLED',
          subscriptionEndDate: new Date(subscription.current_period_end * 1000),
        },
      });
    }
  }

  async function handleStripeInvoicePaid(stripeInvoice: Stripe.Invoice) {
    const organizationId = stripeInvoice.metadata?.organizationId;
    if (!organizationId) return;

    await prisma.auditLog.create({
      data: {
        organizationId,
        action: 'STRIPE_INVOICE_PAID',
        entityType: 'StripeInvoice',
        entityId: stripeInvoice.id,
        details: {
          amountPaid: (stripeInvoice.amount_paid || 0) / 100,
          invoiceUrl: stripeInvoice.hosted_invoice_url,
        },
      },
    });
  }

  async function handleStripeInvoicePaymentFailed(stripeInvoice: Stripe.Invoice) {
    const organizationId = stripeInvoice.metadata?.organizationId;
    if (!organizationId) return;

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { organizationId, role: 'ADMIN', isActive: true },
      select: { id: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          organizationId,
          type: 'SUBSCRIPTION_PAYMENT_FAILED',
          title: 'Subscription Payment Failed',
          message: 'Your subscription payment has failed. Please update your payment method to avoid service interruption.',
          entityType: 'StripeInvoice',
          entityId: stripeInvoice.id,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        organizationId,
        action: 'STRIPE_INVOICE_PAYMENT_FAILED',
        entityType: 'StripeInvoice',
        entityId: stripeInvoice.id,
        details: {
          amountDue: (stripeInvoice.amount_due || 0) / 100,
        },
      },
    });
  }
};

export default routes;
