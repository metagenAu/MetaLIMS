import { prisma } from '@labflow/db';
import {
  NotFoundError,
  ConflictError,
  InternalError,
  ValidationError,
} from '../utils/errors';
import { recordPayment } from './billingService';

// ============================================================
// Stripe SDK initialisation
// ============================================================

/**
 * Lazy-loaded Stripe instance. The SDK is loaded at runtime to avoid
 * hard failures in environments where the stripe package may not be
 * installed (e.g. during type-checking or test builds).
 */
let _stripe: any | null = null;

function getStripe(): any {
  if (_stripe) return _stripe;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new InternalError(
      'STRIPE_SECRET_KEY environment variable is not configured',
    );
  }

  try {
    // Dynamic require so that the module is optional at build-time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require('stripe');
    _stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
    return _stripe;
  } catch {
    throw new InternalError(
      'Failed to initialise Stripe SDK. Ensure the "stripe" package is installed.',
    );
  }
}

// ============================================================
// Types
// ============================================================

/** Subset of the Stripe Event object we consume in webhooks. */
interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, any>;
  };
}

// ============================================================
// Public API
// ============================================================

/**
 * Creates a Stripe PaymentIntent for an outstanding invoice, enabling the
 * client to pay via credit card or other Stripe-supported methods.
 *
 * The PaymentIntent ID is stored on the invoice for reconciliation.
 *
 * @param invoiceId - The LabFlow invoice to create a payment intent for
 * @returns The created PaymentIntent's client secret and metadata
 */
export async function createPaymentIntent(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      organizationId: true,
      clientId: true,
      invoiceNumber: true,
      status: true,
      balanceDue: true,
      stripeInvoiceId: true,
      client: {
        select: {
          id: true,
          name: true,
          billingEmail: true,
          stripeCustomerId: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new NotFoundError('Invoice', invoiceId);
  }

  const payableStatuses = new Set([
    'SENT',
    'VIEWED',
    'PARTIALLY_PAID',
    'OVERDUE',
  ]);
  if (!payableStatuses.has(invoice.status)) {
    throw new ConflictError(
      `Cannot create payment intent for invoice in status '${invoice.status}'`,
    );
  }

  const balanceDue = Number(invoice.balanceDue);
  if (balanceDue <= 0) {
    throw new ConflictError('Invoice has no outstanding balance');
  }

  // Ensure the client has a Stripe customer record
  let stripeCustomerId = invoice.client.stripeCustomerId;
  if (!stripeCustomerId) {
    const synced = await syncCustomer(invoice.clientId);
    stripeCustomerId = synced.stripeCustomerId;
  }

  const stripe = getStripe();

  // Convert dollars to cents for Stripe
  const amountInCents = Math.round(balanceDue * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    customer: stripeCustomerId,
    metadata: {
      labflow_invoice_id: invoice.id,
      labflow_invoice_number: invoice.invoiceNumber,
      labflow_organization_id: invoice.organizationId,
      labflow_client_id: invoice.clientId,
    },
    description: `Payment for invoice ${invoice.invoiceNumber}`,
    receipt_email: invoice.client.billingEmail ?? undefined,
    automatic_payment_methods: {
      enabled: true,
    },
  });

  // Store the Stripe reference on the invoice
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { stripeInvoiceId: paymentIntent.id },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: invoice.organizationId,
      entityType: 'INVOICE',
      entityId: invoiceId,
      action: 'STRIPE_PAYMENT_INTENT_CREATED',
      changes: {
        stripePaymentIntentId: paymentIntent.id,
        amount: balanceDue,
        amountInCents,
        stripeCustomerId,
      },
    },
  });

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret as string,
    amount: balanceDue,
    currency: 'usd',
    stripeCustomerId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
  };
}

/**
 * Processes a Stripe webhook event. Supported event types:
 *
 *  - `payment_intent.succeeded` : Records a payment against the matching invoice
 *  - `payment_intent.payment_failed` : Logs the failure
 *  - `charge.refunded` : Records a refund (creates a credit note)
 *
 * @param event - The Stripe event object (already verified by signature)
 * @returns A summary of the action taken
 */
export async function handleWebhook(event: StripeWebhookEvent) {
  const { type, data } = event;
  const obj = data.object;

  switch (type) {
    // ----------------------------------------------------------
    // Payment succeeded
    // ----------------------------------------------------------
    case 'payment_intent.succeeded': {
      const invoiceId = obj.metadata?.labflow_invoice_id as string | undefined;
      if (!invoiceId) {
        return {
          action: 'IGNORED',
          reason: 'No labflow_invoice_id in metadata',
        };
      }

      const amountReceived = (obj.amount_received as number) / 100;

      const result = await recordPayment(invoiceId, {
        amount: amountReceived,
        method: 'STRIPE',
        referenceNumber: obj.id as string,
        paymentDate: new Date(),
        notes: `Stripe PaymentIntent ${obj.id}`,
      });

      // Update the payment record with the Stripe charge ID
      if (obj.latest_charge) {
        await prisma.payment.update({
          where: { id: result.payment.id },
          data: {
            stripePaymentId: obj.id as string,
            stripeChargeId: obj.latest_charge as string,
          },
        });
      }

      return {
        action: 'PAYMENT_RECORDED',
        invoiceId,
        paymentId: result.payment.id,
        amount: amountReceived,
      };
    }

    // ----------------------------------------------------------
    // Payment failed
    // ----------------------------------------------------------
    case 'payment_intent.payment_failed': {
      const invoiceId = obj.metadata?.labflow_invoice_id as string | undefined;
      if (!invoiceId) {
        return { action: 'IGNORED', reason: 'No labflow_invoice_id in metadata' };
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, organizationId: true },
      });

      if (invoice) {
        await prisma.auditLog.create({
          data: {
            organizationId: invoice.organizationId,
            entityType: 'INVOICE',
            entityId: invoiceId,
            action: 'STRIPE_PAYMENT_FAILED',
            changes: {
              stripePaymentIntentId: obj.id,
              failureCode: obj.last_payment_error?.code ?? null,
              failureMessage: obj.last_payment_error?.message ?? null,
            },
          },
        });
      }

      return {
        action: 'PAYMENT_FAILURE_LOGGED',
        invoiceId,
        failureCode: obj.last_payment_error?.code ?? null,
      };
    }

    // ----------------------------------------------------------
    // Charge refunded
    // ----------------------------------------------------------
    case 'charge.refunded': {
      const paymentIntentId = obj.payment_intent as string | undefined;
      if (!paymentIntentId) {
        return { action: 'IGNORED', reason: 'No payment_intent on charge' };
      }

      // Find the matching LabFlow payment
      const payment = await prisma.payment.findFirst({
        where: { stripePaymentId: paymentIntentId },
        select: {
          id: true,
          invoiceId: true,
          organizationId: true,
          invoice: { select: { id: true, organizationId: true, invoiceNumber: true } },
        },
      });

      if (!payment || !payment.invoice) {
        return {
          action: 'IGNORED',
          reason: `No matching payment found for PaymentIntent ${paymentIntentId}`,
        };
      }

      const refundedAmountCents = obj.amount_refunded as number;
      const refundedAmount = refundedAmountCents / 100;

      // Create a credit note
      const year = new Date().getFullYear();
      const sequence = await prisma.sequence.upsert({
        where: {
          organizationId_entityType_year: {
            organizationId: payment.organizationId,
            entityType: 'CREDIT_NOTE',
            year,
          },
        },
        update: { currentValue: { increment: 1 } },
        create: {
          organizationId: payment.organizationId,
          entityType: 'CREDIT_NOTE',
          year,
          currentValue: 1,
        },
      });

      const creditNumber = `CN-${year}-${String(sequence.currentValue).padStart(6, '0')}`;

      await prisma.creditNote.create({
        data: {
          invoiceId: payment.invoice.id,
          creditNumber,
          amount: refundedAmount,
          reason: `Stripe refund for charge ${obj.id}`,
          status: 'ISSUED',
        },
      });

      // Update invoice balance
      await prisma.invoice.update({
        where: { id: payment.invoice.id },
        data: {
          balanceDue: { increment: refundedAmount },
        },
      });

      // Mark payment as refunded
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status:
            refundedAmountCents >= (obj.amount as number)
              ? 'REFUNDED'
              : 'PARTIALLY_REFUNDED',
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: payment.organizationId,
          entityType: 'INVOICE',
          entityId: payment.invoice.id,
          action: 'STRIPE_REFUND_PROCESSED',
          changes: {
            chargeId: obj.id,
            refundedAmount,
            creditNumber,
          },
        },
      });

      return {
        action: 'REFUND_PROCESSED',
        invoiceId: payment.invoice.id,
        creditNumber,
        refundedAmount,
      };
    }

    // ----------------------------------------------------------
    // Unhandled event types
    // ----------------------------------------------------------
    default:
      return { action: 'IGNORED', reason: `Unhandled event type: ${type}` };
  }
}

/**
 * Synchronises a LabFlow client to Stripe as a Customer object.
 * If the client already has a stripeCustomerId, the existing Stripe Customer
 * is updated. Otherwise a new Stripe Customer is created and the ID is
 * stored on the client record.
 *
 * @param clientId - The LabFlow client ID
 * @returns The client record with the updated stripeCustomerId
 */
export async function syncCustomer(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      code: true,
      contactEmail: true,
      contactPhone: true,
      billingEmail: true,
      billingAddress: true,
      billingCity: true,
      billingState: true,
      billingZip: true,
      billingCountry: true,
      stripeCustomerId: true,
    },
  });

  if (!client) {
    throw new NotFoundError('Client', clientId);
  }

  const stripe = getStripe();

  const customerData = {
    name: client.name,
    email: client.billingEmail ?? client.contactEmail ?? undefined,
    phone: client.contactPhone ?? undefined,
    metadata: {
      labflow_client_id: client.id,
      labflow_organization_id: client.organizationId,
      labflow_client_code: client.code,
    },
    address: client.billingAddress
      ? {
          line1: client.billingAddress,
          city: client.billingCity ?? undefined,
          state: client.billingState ?? undefined,
          postal_code: client.billingZip ?? undefined,
          country: client.billingCountry ?? undefined,
        }
      : undefined,
  };

  let stripeCustomerId: string;

  if (client.stripeCustomerId) {
    // Update existing customer
    await stripe.customers.update(client.stripeCustomerId, customerData);
    stripeCustomerId = client.stripeCustomerId;
  } else {
    // Create new customer
    const customer = await stripe.customers.create(customerData);
    stripeCustomerId = customer.id;

    await prisma.client.update({
      where: { id: clientId },
      data: { stripeCustomerId },
    });
  }

  await prisma.auditLog.create({
    data: {
      organizationId: client.organizationId,
      entityType: 'CLIENT',
      entityId: clientId,
      action: client.stripeCustomerId
        ? 'STRIPE_CUSTOMER_UPDATED'
        : 'STRIPE_CUSTOMER_CREATED',
      changes: { stripeCustomerId },
    },
  });

  return {
    clientId: client.id,
    stripeCustomerId,
  };
}
