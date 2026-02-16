// ============================================================
// Accounting (QuickBooks / Xero) Sync Queue
// ============================================================

import { Queue, type JobsOptions } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';

// ------------------------------------------------------------
// Job data types
// ------------------------------------------------------------

export interface SyncInvoiceJobData {
  action: 'syncInvoice';
  organizationId: string;
  invoiceId: string;
  /** QuickBooks realm ID (company ID). */
  quickbooksRealmId: string;
}

export interface SyncPaymentJobData {
  action: 'syncPayment';
  organizationId: string;
  paymentId: string;
  invoiceId: string | null;
  /** QuickBooks realm ID (company ID). */
  quickbooksRealmId: string;
}

export interface SyncCreditNoteJobData {
  action: 'syncCreditNote';
  organizationId: string;
  creditNoteId: string;
  invoiceId: string;
  quickbooksRealmId: string;
}

export type AccountingSyncJobName = 'syncInvoice' | 'syncPayment' | 'syncCreditNote';

export type AccountingSyncJobData =
  | SyncInvoiceJobData
  | SyncPaymentJobData
  | SyncCreditNoteJobData;

// ------------------------------------------------------------
// Default job options
// ------------------------------------------------------------

export const ACCOUNTING_SYNC_JOB_DEFAULTS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 10_000,
  },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 2_000 },
};

// ------------------------------------------------------------
// Queue name constant
// ------------------------------------------------------------

export const ACCOUNTING_SYNC_QUEUE_NAME = 'labflow:accounting-sync';

// ------------------------------------------------------------
// Queue factory
// ------------------------------------------------------------

export function createAccountingSyncQueue(connection: ConnectionOptions): Queue {
  return new Queue(ACCOUNTING_SYNC_QUEUE_NAME, {
    connection,
    defaultJobOptions: ACCOUNTING_SYNC_JOB_DEFAULTS,
  });
}
