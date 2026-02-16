// ============================================================
// Invoice Generation Queue
// ============================================================

import { Queue, type JobsOptions } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';

// ------------------------------------------------------------
// Job data types
// ------------------------------------------------------------

/**
 * Automatically generate an invoice for a completed order.
 * Triggered when all tests on an order are approved and the
 * client has autoInvoice enabled.
 */
export interface AutoInvoiceJobData {
  orderId: string;
  organizationId: string;
  clientId: string;
}

/**
 * Batch-generate invoices for all uninvoiced completed orders
 * belonging to a specific client. Useful for month-end billing runs.
 */
export interface BatchInvoiceJobData {
  organizationId: string;
  clientId: string;
  /** Optional list of order IDs. When omitted, all uninvoiced completed orders are included. */
  orderIds?: string[];
}

export type InvoiceJobName = 'autoInvoice' | 'batchInvoice';

export type InvoiceJobDataMap = {
  autoInvoice: AutoInvoiceJobData;
  batchInvoice: BatchInvoiceJobData;
};

// ------------------------------------------------------------
// Default job options
// ------------------------------------------------------------

export const INVOICE_JOB_DEFAULTS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5_000,
  },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1_000 },
};

// ------------------------------------------------------------
// Queue name constant
// ------------------------------------------------------------

export const INVOICE_QUEUE_NAME = 'labflow:invoices';

// ------------------------------------------------------------
// Queue factory
// ------------------------------------------------------------

export function createInvoiceQueue(connection: ConnectionOptions): Queue {
  return new Queue(INVOICE_QUEUE_NAME, {
    connection,
    defaultJobOptions: INVOICE_JOB_DEFAULTS,
  });
}
