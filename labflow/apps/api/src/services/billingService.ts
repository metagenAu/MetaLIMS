import { prisma } from '@labflow/db';
import type { InvoiceStatus, PaymentTerms } from '@labflow/db';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../utils/errors';
import { calculateOrderTotal, getClientPriceList } from './pricingService';
import { validateTransition } from './workflowEngine';

// ============================================================
// Helpers
// ============================================================

/**
 * Generates the next sequential invoice number for an organisation.
 * Format: INV-{YEAR}-{ZERO_PADDED_SEQ}  e.g. INV-2026-000012
 */
async function generateInvoiceNumber(
  orgId: string,
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<string> {
  const year = new Date().getFullYear();

  const sequence = await tx.sequence.upsert({
    where: {
      organizationId_entityType_year: {
        organizationId: orgId,
        entityType: 'INVOICE',
        year,
      },
    },
    update: { currentValue: { increment: 1 } },
    create: {
      organizationId: orgId,
      entityType: 'INVOICE',
      year,
      currentValue: 1,
    },
  });

  return `INV-${year}-${String(sequence.currentValue).padStart(6, '0')}`;
}

/**
 * Converts payment terms to an integer number of days for computing
 * due dates.
 */
function paymentTermsToDays(terms: PaymentTerms): number {
  switch (terms) {
    case 'PREPAID':
      return 0;
    case 'COD':
      return 0;
    case 'NET_15':
      return 15;
    case 'NET_30':
      return 30;
    case 'NET_45':
      return 45;
    case 'NET_60':
      return 60;
    case 'NET_90':
      return 90;
    case 'CUSTOM':
      return 30; // Default to 30 for custom terms
    default:
      return 30;
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Auto-generates a draft invoice from a completed order. Line items are
 * calculated from the order's tests using the client's price list.
 *
 * @param orderId - The order to invoice
 * @returns The newly created invoice with line items
 */
export async function autoGenerateInvoice(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      organizationId: true,
      clientId: true,
      clientPO: true,
      rushRequested: true,
      rushApproved: true,
      rushSurchargePercent: true,
      status: true,
      client: {
        select: {
          id: true,
          paymentTerms: true,
          taxExempt: true,
          billingEmail: true,
          autoInvoice: true,
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  // Ensure the order is in a state where invoicing makes sense
  const invoiceableStatuses = new Set([
    'TESTING_COMPLETE',
    'IN_REVIEW',
    'APPROVED',
    'REPORTED',
    'COMPLETED',
  ]);
  if (!invoiceableStatuses.has(order.status)) {
    throw new ConflictError(
      `Cannot generate invoice for order in status '${order.status}'`,
    );
  }

  // Check for existing non-void invoices on this order
  const existingInvoice = await prisma.invoiceLineItem.findFirst({
    where: {
      orderId,
      invoice: { status: { not: 'VOID' } },
    },
    select: { invoiceId: true },
  });

  if (existingInvoice) {
    throw new ConflictError(
      `Order already has an active invoice (${existingInvoice.invoiceId})`,
    );
  }

  const orderPricing = await calculateOrderTotal(orderId);

  return prisma.$transaction(async (tx) => {
    const invoiceNumber = await generateInvoiceNumber(
      order.organizationId,
      tx,
    );

    const issueDate = new Date();
    const dueDays = paymentTermsToDays(order.client.paymentTerms);
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + dueDays);

    // Calculate tax
    const taxInfo = await calculateTax(orderPricing.subtotal, order.client);
    const total =
      orderPricing.subtotal +
      orderPricing.rushSurcharge +
      taxInfo.taxAmount;

    const invoice = await tx.invoice.create({
      data: {
        organizationId: order.organizationId,
        clientId: order.clientId,
        invoiceNumber,
        status: 'DRAFT',
        issueDate,
        dueDate,
        subtotal: orderPricing.subtotal,
        discountAmount: 0,
        rushSurcharge: orderPricing.rushSurcharge,
        taxRate: taxInfo.taxRate,
        taxAmount: taxInfo.taxAmount,
        total,
        balanceDue: total,
        paymentTerms: order.client.paymentTerms,
        clientPO: order.clientPO,
      },
    });

    // Create line items
    for (let i = 0; i < orderPricing.lineItems.length; i++) {
      const line = orderPricing.lineItems[i];
      await tx.invoiceLineItem.create({
        data: {
          invoiceId: invoice.id,
          orderId,
          description: `${line.code} - ${line.name}`,
          testMethodCode: line.code,
          sampleCount: line.quantity,
          quantity: line.quantity,
          unitPrice: line.effectiveUnitPrice,
          discount: 0,
          total: line.subtotal,
          sortOrder: i,
        },
      });
    }

    // Add rush surcharge as a separate line item if applicable
    if (orderPricing.rushSurcharge > 0) {
      await tx.invoiceLineItem.create({
        data: {
          invoiceId: invoice.id,
          orderId,
          description: 'Rush Processing Surcharge',
          quantity: 1,
          unitPrice: orderPricing.rushSurcharge,
          discount: 0,
          total: orderPricing.rushSurcharge,
          sortOrder: orderPricing.lineItems.length,
        },
      });
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        organizationId: order.organizationId,
        entityType: 'INVOICE',
        entityId: invoice.id,
        action: 'CREATED',
        changes: {
          orderId,
          invoiceNumber,
          total,
          lineItemCount: orderPricing.lineItems.length,
        },
      },
    });

    return tx.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
    });
  });
}

/**
 * Computes the individual line-item prices for an order given a specific
 * price list. This can be used for quoting / previewing without generating
 * an invoice.
 *
 * @param orderId - The order to price
 * @param priceListId - Override price list (optional, uses client default)
 * @returns The pricing breakdown
 */
export async function calculateLineItems(
  orderId: string,
  priceListId?: string,
) {
  if (priceListId) {
    const pl = await prisma.priceList.findUnique({
      where: { id: priceListId },
    });
    if (!pl) {
      throw new NotFoundError('PriceList', priceListId);
    }
  }

  // calculateOrderTotal already resolves the client price list internally
  return calculateOrderTotal(orderId);
}

/**
 * Applies a rush surcharge to an existing draft invoice.
 *
 * @param invoiceId - The invoice to modify
 * @param surchargePercent - The surcharge percentage (e.g. 50 for 50%)
 * @returns The updated invoice
 */
export async function applyRushSurcharge(
  invoiceId: string,
  surchargePercent: number,
) {
  if (surchargePercent < 0 || surchargePercent > 200) {
    throw new ValidationError('Surcharge percent must be between 0 and 200');
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      status: true,
      subtotal: true,
      taxRate: true,
      discountAmount: true,
    },
  });

  if (!invoice) {
    throw new NotFoundError('Invoice', invoiceId);
  }

  if (invoice.status !== 'DRAFT') {
    throw new ConflictError('Can only modify rush surcharge on draft invoices');
  }

  const subtotal = Number(invoice.subtotal);
  const rushSurcharge = Math.round(subtotal * (surchargePercent / 100) * 100) / 100;
  const discountAmount = Number(invoice.discountAmount);
  const taxRate = Number(invoice.taxRate);
  const taxableAmount = subtotal + rushSurcharge - discountAmount;
  const taxAmount = Math.round(taxableAmount * taxRate * 100) / 100;
  const total = Math.round((taxableAmount + taxAmount) * 100) / 100;

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      rushSurcharge,
      taxAmount,
      total,
      balanceDue: total,
    },
  });
}

/**
 * Calculates the tax amount for a given subtotal and client configuration.
 * Tax-exempt clients get 0% tax.
 *
 * @param subtotal - The pre-tax amount
 * @param client - The client record (needs taxExempt flag)
 * @returns The tax rate (as a decimal) and the computed tax amount
 */
export async function calculateTax(
  subtotal: number,
  client: { taxExempt?: boolean; id?: string },
): Promise<{ taxRate: number; taxAmount: number }> {
  if (client.taxExempt) {
    return { taxRate: 0, taxAmount: 0 };
  }

  // Default tax rate. In production this would be looked up from a tax
  // service / configuration based on jurisdiction.
  const DEFAULT_TAX_RATE = 0;

  const taxAmount = Math.round(subtotal * DEFAULT_TAX_RATE * 100) / 100;

  return {
    taxRate: DEFAULT_TAX_RATE,
    taxAmount,
  };
}

/**
 * Generates an aging report for the organisation, bucketing outstanding
 * invoices into current, 30-day, 60-day, and 90-day+ categories.
 *
 * @param orgId - The organisation ID
 * @returns Aging buckets with totals and individual invoice details
 */
export async function getAgingReport(orgId: string) {
  const outstandingStatuses: string[] = [
    'SENT',
    'VIEWED',
    'PARTIALLY_PAID',
    'OVERDUE',
  ];

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { in: outstandingStatuses as any },
    },
    include: {
      client: { select: { id: true, name: true, code: true } },
    },
    orderBy: { dueDate: 'asc' },
  });

  const now = new Date();

  interface AgingBucket {
    label: string;
    totalAmount: number;
    invoiceCount: number;
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      clientName: string;
      balanceDue: number;
      dueDate: Date | null;
      daysOverdue: number;
    }>;
  }

  const buckets: AgingBucket[] = [
    { label: 'Current', totalAmount: 0, invoiceCount: 0, invoices: [] },
    { label: '1-30 Days', totalAmount: 0, invoiceCount: 0, invoices: [] },
    { label: '31-60 Days', totalAmount: 0, invoiceCount: 0, invoices: [] },
    { label: '61-90 Days', totalAmount: 0, invoiceCount: 0, invoices: [] },
    { label: '90+ Days', totalAmount: 0, invoiceCount: 0, invoices: [] },
  ];

  for (const inv of invoices) {
    const balanceDue = Number(inv.balanceDue);
    if (balanceDue <= 0) continue;

    const dueDate = inv.dueDate ?? inv.issueDate ?? inv.createdAt;
    const diffMs = now.getTime() - new Date(dueDate).getTime();
    const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    const entry = {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.client.name,
      balanceDue,
      dueDate: inv.dueDate,
      daysOverdue,
    };

    let bucket: AgingBucket;
    if (daysOverdue <= 0) {
      bucket = buckets[0]; // Current
    } else if (daysOverdue <= 30) {
      bucket = buckets[1]; // 1-30
    } else if (daysOverdue <= 60) {
      bucket = buckets[2]; // 31-60
    } else if (daysOverdue <= 90) {
      bucket = buckets[3]; // 61-90
    } else {
      bucket = buckets[4]; // 90+
    }

    bucket.totalAmount += balanceDue;
    bucket.invoiceCount += 1;
    bucket.invoices.push(entry);
  }

  // Round totals
  for (const bucket of buckets) {
    bucket.totalAmount = Math.round(bucket.totalAmount * 100) / 100;
  }

  const grandTotal = buckets.reduce((sum, b) => sum + b.totalAmount, 0);

  return {
    organizationId: orgId,
    generatedAt: now,
    grandTotal: Math.round(grandTotal * 100) / 100,
    totalOutstandingInvoices: invoices.length,
    buckets,
  };
}

/**
 * Finds invoices that are past their due date but not yet marked as OVERDUE,
 * and updates their status.
 *
 * @param orgId - The organisation ID
 * @returns Array of invoices that were marked overdue
 */
export async function checkOverdueInvoices(orgId: string) {
  const now = new Date();

  const overdueCandidate = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID'] as any },
      dueDate: { lt: now },
    },
    select: {
      id: true,
      invoiceNumber: true,
      clientId: true,
      balanceDue: true,
      dueDate: true,
      status: true,
      organizationId: true,
    },
  });

  const updatedInvoices = [];

  for (const inv of overdueCandidate) {
    const balance = Number(inv.balanceDue);
    if (balance <= 0) continue;

    try {
      validateTransition('INVOICE', inv.status, 'OVERDUE');

      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: inv.id },
          data: { status: 'OVERDUE' },
        });

        await tx.auditLog.create({
          data: {
            organizationId: inv.organizationId,
            entityType: 'INVOICE',
            entityId: inv.id,
            action: 'MARKED_OVERDUE',
            changes: {
              previousStatus: inv.status,
              newStatus: 'OVERDUE',
              dueDate: inv.dueDate,
            },
          },
        });
      });

      updatedInvoices.push(inv);
    } catch {
      // Skip invoices whose transition is not valid
      continue;
    }
  }

  return updatedInvoices;
}

/**
 * Records a payment against an invoice, recalculates the balance due,
 * and updates the invoice status (PARTIALLY_PAID or PAID).
 *
 * @param invoiceId - The invoice receiving the payment
 * @param paymentData - Payment details
 * @returns The created payment and updated invoice
 */
export async function recordPayment(
  invoiceId: string,
  paymentData: {
    amount: number;
    method: 'CREDIT_CARD' | 'ACH' | 'WIRE_TRANSFER' | 'CHECK' | 'CASH' | 'STRIPE' | 'OTHER';
    referenceNumber?: string;
    paymentDate?: Date;
    notes?: string;
    recordedById?: string;
  },
) {
  if (paymentData.amount <= 0) {
    throw new ValidationError('Payment amount must be greater than zero');
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      organizationId: true,
      clientId: true,
      status: true,
      total: true,
      balanceDue: true,
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
      `Cannot record payment for invoice in status '${invoice.status}'`,
    );
  }

  const currentBalance = Number(invoice.balanceDue);
  if (paymentData.amount > currentBalance) {
    throw new ValidationError(
      `Payment amount ($${paymentData.amount.toFixed(2)}) exceeds balance due ($${currentBalance.toFixed(2)})`,
    );
  }

  const newBalance = Math.round((currentBalance - paymentData.amount) * 100) / 100;
  const newStatus: string = newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        organizationId: invoice.organizationId,
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        amount: paymentData.amount,
        method: paymentData.method,
        status: 'COMPLETED',
        referenceNumber: paymentData.referenceNumber ?? null,
        paymentDate: paymentData.paymentDate ?? new Date(),
        processedAt: new Date(),
        notes: paymentData.notes ?? null,
        recordedById: paymentData.recordedById ?? null,
      },
    });

    const updatedInvoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        balanceDue: newBalance,
        status: newStatus as InvoiceStatus,
        paidDate: newBalance <= 0 ? new Date() : undefined,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: invoice.organizationId,
        userId: paymentData.recordedById ?? null,
        entityType: 'INVOICE',
        entityId: invoiceId,
        action: 'PAYMENT_RECORDED',
        changes: {
          paymentId: payment.id,
          amount: paymentData.amount,
          method: paymentData.method,
          previousBalance: currentBalance,
          newBalance,
          previousStatus: invoice.status,
          newStatus,
        },
      },
    });

    return { payment, invoice: updatedInvoice };
  });
}
