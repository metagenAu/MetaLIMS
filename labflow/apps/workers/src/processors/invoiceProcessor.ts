// ============================================================
// Invoice Generation Processor
// ============================================================
//
// Handles:
//   - "autoInvoice"  : generate an invoice for a single completed order
//   - "batchInvoice" : generate invoices for all uninvoiced completed
//                      orders belonging to a client
//
// Flow:
//   1. Resolve the client, price list, and completed order(s)
//   2. For each order, calculate line items from the price list
//   3. Apply discount, rush surcharge, and tax
//   4. Create the Invoice + InvoiceLineItems in a transaction
//   5. Queue an email notification for the invoice
// ============================================================

import { Worker, type Job, Queue, type ConnectionOptions } from 'bullmq';
import { prisma, Prisma } from '@labflow/db';
import type { Logger } from 'pino';
import {
  INVOICE_QUEUE_NAME,
  type AutoInvoiceJobData,
  type BatchInvoiceJobData,
} from '../queues/invoiceQueue.js';
import { EMAIL_QUEUE_NAME } from '../queues/emailQueue.js';
import type { SendEmailJobData } from '../queues/emailQueue.js';

// ----------------------------------------------------------------
// Sequence number generator
// ----------------------------------------------------------------

async function getNextInvoiceNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<string> {
  const year = new Date().getFullYear();

  const sequence = await tx.sequence.upsert({
    where: {
      organizationId_entityType_year: {
        organizationId,
        entityType: 'INVOICE',
        year,
      },
    },
    update: {
      currentValue: { increment: 1 },
    },
    create: {
      organizationId,
      entityType: 'INVOICE',
      year,
      currentValue: 1,
    },
  });

  const paddedSeq = String(sequence.currentValue).padStart(5, '0');
  return `INV-${year}-${paddedSeq}`;
}

// ----------------------------------------------------------------
// Payment terms to days mapping
// ----------------------------------------------------------------

const PAYMENT_TERMS_DAYS: Record<string, number> = {
  PREPAID: 0,
  COD: 0,
  NET_15: 15,
  NET_30: 30,
  NET_45: 45,
  NET_60: 60,
  NET_90: 90,
  CUSTOM: 30,
};

function calculateDueDate(issueDate: Date, paymentTerms: string): Date {
  const days = PAYMENT_TERMS_DAYS[paymentTerms] ?? 30;
  const due = new Date(issueDate);
  due.setDate(due.getDate() + days);
  return due;
}

// ----------------------------------------------------------------
// Invoice calculation
// ----------------------------------------------------------------

interface LineItemInput {
  orderId: string;
  orderNumber: string;
  description: string;
  testMethodCode: string;
  sampleCount: number;
  quantity: number;
  unitPrice: Prisma.Decimal;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
  sortOrder: number;
}

interface InvoiceCalculation {
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  rushSurcharge: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
}

function calculateInvoiceTotals(
  lineItems: LineItemInput[],
  discountPercent: number,
  taxRate: number,
  rushSurchargeAmount: number,
): InvoiceCalculation {
  const subtotalNum = lineItems.reduce(
    (sum, item) => sum + Number(item.total),
    0,
  );
  const subtotal = new Prisma.Decimal(subtotalNum.toFixed(2));

  const discountAmount = new Prisma.Decimal(
    (subtotalNum * (discountPercent / 100)).toFixed(2),
  );
  const afterDiscount = subtotalNum - Number(discountAmount);

  const rushSurcharge = new Prisma.Decimal(rushSurchargeAmount.toFixed(2));
  const taxableAmount = new Prisma.Decimal(
    (afterDiscount + rushSurchargeAmount).toFixed(2),
  );
  const taxAmount = new Prisma.Decimal(
    (Number(taxableAmount) * taxRate).toFixed(2),
  );
  const total = new Prisma.Decimal(
    (Number(taxableAmount) + Number(taxAmount)).toFixed(2),
  );

  return { subtotal, discountAmount, rushSurcharge, taxableAmount, taxAmount, total };
}

// ----------------------------------------------------------------
// Core invoice creation logic
// ----------------------------------------------------------------

async function createInvoiceForOrders(
  organizationId: string,
  clientId: string,
  orderIds: string[],
  logger: Logger,
  emailQueue: Queue,
): Promise<string> {
  const log = logger.child({ organizationId, clientId, orderCount: orderIds.length });

  // Fetch client with price list
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    include: {
      priceList: {
        include: {
          items: {
            include: {
              testMethod: true,
            },
          },
        },
      },
    },
  });

  // Fetch the organization for default price list fallback
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });

  // If client has no price list, try the default one for the org
  let priceListItems = client.priceList?.items ?? [];
  if (priceListItems.length === 0) {
    const defaultPriceList = await prisma.priceList.findFirst({
      where: {
        organizationId,
        isDefault: true,
        isActive: true,
      },
      include: {
        items: {
          include: {
            testMethod: true,
          },
        },
      },
    });
    priceListItems = defaultPriceList?.items ?? [];
  }

  // Build a lookup map: testMethodId -> PriceListItem
  const priceMap = new Map(
    priceListItems.map((item) => [item.testMethodId, item]),
  );

  // Fetch all orders with their samples and tests
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: {
      samples: {
        include: {
          tests: {
            include: {
              testMethod: true,
            },
          },
        },
      },
    },
  });

  // Build line items: one line per unique test method per order
  const lineItems: LineItemInput[] = [];
  let sortOrder = 0;
  let totalRushSurcharge = 0;

  for (const order of orders) {
    // Group tests by test method within this order
    const methodGroups = new Map<
      string,
      { methodId: string; methodCode: string; methodName: string; sampleCount: number }
    >();

    for (const sample of order.samples) {
      for (const test of sample.tests) {
        const existing = methodGroups.get(test.testMethodId);
        if (existing) {
          existing.sampleCount += 1;
        } else {
          methodGroups.set(test.testMethodId, {
            methodId: test.testMethodId,
            methodCode: test.testMethod.code,
            methodName: test.testMethod.name,
            sampleCount: 1,
          });
        }
      }
    }

    for (const [methodId, group] of methodGroups) {
      const priceItem = priceMap.get(methodId);
      const unitPrice = priceItem
        ? priceItem.unitPrice
        : new Prisma.Decimal('0.00');

      // Check for volume-tier pricing
      let effectiveUnitPrice = Number(unitPrice);
      if (priceItem) {
        const volumeTiers = priceItem.volumeTiers as Array<{
          minQty: number;
          maxQty: number | null;
          price: number;
        }>;
        if (Array.isArray(volumeTiers) && volumeTiers.length > 0) {
          for (const tier of volumeTiers) {
            if (
              group.sampleCount >= tier.minQty &&
              (tier.maxQty === null || group.sampleCount <= tier.maxQty)
            ) {
              effectiveUnitPrice = tier.price;
              break;
            }
          }
        }

        // Check minimum charge
        const lineTotal = effectiveUnitPrice * group.sampleCount;
        if (priceItem.minimumCharge && lineTotal < Number(priceItem.minimumCharge)) {
          effectiveUnitPrice = Number(priceItem.minimumCharge) / group.sampleCount;
        }
      }

      const itemDiscount = new Prisma.Decimal('0.00');
      const itemTotal = new Prisma.Decimal(
        (effectiveUnitPrice * group.sampleCount).toFixed(2),
      );

      lineItems.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        description: `${group.methodCode} - ${group.methodName}`,
        testMethodCode: group.methodCode,
        sampleCount: group.sampleCount,
        quantity: new Prisma.Decimal(group.sampleCount) as unknown as number,
        unitPrice: new Prisma.Decimal(effectiveUnitPrice.toFixed(2)),
        discount: itemDiscount,
        total: itemTotal,
        sortOrder: sortOrder++,
      });
    }

    // Calculate rush surcharge for this order
    if (order.rushApproved && order.rushSurchargePercent) {
      const orderSubtotal = lineItems
        .filter((li) => li.orderId === order.id)
        .reduce((sum, li) => sum + Number(li.total), 0);
      totalRushSurcharge += orderSubtotal * (Number(order.rushSurchargePercent) / 100);
    }
  }

  if (lineItems.length === 0) {
    log.warn('No line items generated - no tests found on orders');
    throw new Error('Cannot create invoice with no line items');
  }

  // Determine discount and tax
  const discountPercent = 0; // Client-level discounts can be extended here
  const taxRate = client.taxExempt ? 0 : Number(org.settings && typeof org.settings === 'object' && 'defaultTaxRate' in (org.settings as Record<string, unknown>) ? (org.settings as Record<string, unknown>).defaultTaxRate : 0) || 0;

  const totals = calculateInvoiceTotals(
    lineItems,
    discountPercent,
    taxRate,
    totalRushSurcharge,
  );

  // Create the invoice in a transaction
  const invoiceId = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await getNextInvoiceNumber(tx, organizationId);
    const issueDate = new Date();
    const dueDate = calculateDueDate(issueDate, client.paymentTerms);

    const invoice = await tx.invoice.create({
      data: {
        organizationId,
        clientId,
        invoiceNumber,
        status: 'DRAFT',
        issueDate,
        dueDate,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        discountPercent: discountPercent > 0 ? new Prisma.Decimal(discountPercent) : null,
        taxRate: new Prisma.Decimal(taxRate.toFixed(4)),
        taxAmount: totals.taxAmount,
        rushSurcharge: totals.rushSurcharge,
        total: totals.total,
        balanceDue: totals.total,
        paymentTerms: client.paymentTerms,
        lineItems: {
          createMany: {
            data: lineItems.map((item) => ({
              orderId: item.orderId,
              description: item.description,
              testMethodCode: item.testMethodCode,
              sampleCount: item.sampleCount,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              total: item.total,
              sortOrder: item.sortOrder,
            })),
          },
        },
      },
    });

    return invoice.id;
  });

  log.info(
    { invoiceId, lineItemCount: lineItems.length, total: totals.total.toString() },
    'Invoice created successfully',
  );

  // Queue email notification
  const billingEmail = client.billingEmail || client.contactEmail;
  if (billingEmail) {
    // Fetch the created invoice for email data
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });

    const emailPayload: SendEmailJobData = {
      to: [billingEmail],
      payload: {
        type: 'invoiceSent',
        organizationId,
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        clientName: client.name,
        total: Number(invoice.total),
        currency: org.currency,
        dueDate: invoice.dueDate?.toISOString().split('T')[0] ?? 'N/A',
      },
    };

    await emailQueue.add('send', emailPayload);
    log.info({ billingEmail }, 'Queued invoice notification email');
  }

  return invoiceId;
}

// ----------------------------------------------------------------
// Processor function
// ----------------------------------------------------------------

async function processInvoiceJob(
  job: Job<AutoInvoiceJobData | BatchInvoiceJobData>,
  logger: Logger,
  emailQueue: Queue,
): Promise<void> {
  const log = logger.child({ jobId: job.id, jobName: job.name });

  if (job.name === 'autoInvoice') {
    const data = job.data as AutoInvoiceJobData;
    log.info(
      { orderId: data.orderId, clientId: data.clientId },
      'Processing auto-invoice',
    );

    // Verify the order is in a completed/approved state and not yet invoiced
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: data.orderId },
    });

    const completedStatuses = [
      'TESTING_COMPLETE',
      'IN_REVIEW',
      'APPROVED',
      'REPORTED',
      'COMPLETED',
    ];

    if (!completedStatuses.includes(order.status)) {
      log.warn(
        { orderStatus: order.status },
        'Order not in a completed state, skipping auto-invoice',
      );
      return;
    }

    // Check if this order already has invoice line items
    const existingLineItems = await prisma.invoiceLineItem.findFirst({
      where: { orderId: data.orderId },
    });

    if (existingLineItems) {
      log.info('Order already has invoice line items, skipping');
      return;
    }

    await job.updateProgress(20);

    const invoiceId = await createInvoiceForOrders(
      data.organizationId,
      data.clientId,
      [data.orderId],
      log,
      emailQueue,
    );

    await job.updateProgress(100);
    log.info({ invoiceId }, 'Auto-invoice created');
  } else if (job.name === 'batchInvoice') {
    const data = job.data as BatchInvoiceJobData;
    log.info({ clientId: data.clientId }, 'Processing batch invoice');

    let orderIds = data.orderIds;

    if (!orderIds || orderIds.length === 0) {
      // Find all uninvoiced completed orders for this client
      const completedOrders = await prisma.order.findMany({
        where: {
          organizationId: data.organizationId,
          clientId: data.clientId,
          status: {
            in: ['TESTING_COMPLETE', 'APPROVED', 'REPORTED', 'COMPLETED'],
          },
        },
        select: { id: true },
      });

      // Filter out orders that already have invoice line items
      const ordersWithInvoices = await prisma.invoiceLineItem.findMany({
        where: {
          orderId: { in: completedOrders.map((o) => o.id) },
        },
        select: { orderId: true },
        distinct: ['orderId'],
      });

      const invoicedOrderIds = new Set(
        ordersWithInvoices.map((o) => o.orderId).filter(Boolean),
      );
      orderIds = completedOrders
        .map((o) => o.id)
        .filter((id) => !invoicedOrderIds.has(id));
    }

    if (orderIds.length === 0) {
      log.info('No uninvoiced completed orders found for client');
      return;
    }

    await job.updateProgress(20);

    const invoiceId = await createInvoiceForOrders(
      data.organizationId,
      data.clientId,
      orderIds,
      log,
      emailQueue,
    );

    await job.updateProgress(100);
    log.info(
      { invoiceId, orderCount: orderIds.length },
      'Batch invoice created',
    );
  }
}

// ----------------------------------------------------------------
// Worker factory
// ----------------------------------------------------------------

export function createInvoiceWorker(
  connection: ConnectionOptions,
  logger: Logger,
  emailQueue: Queue,
): Worker {
  const worker = new Worker(
    INVOICE_QUEUE_NAME,
    async (job: Job) => {
      await processInvoiceJob(job, logger, emailQueue);
    },
    {
      connection,
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 60_000,
      },
    },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'Invoice job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, err: err.message },
      'Invoice job failed',
    );
  });

  return worker;
}
