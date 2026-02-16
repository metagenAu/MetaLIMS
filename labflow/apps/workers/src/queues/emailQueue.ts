// ============================================================
// Email Sending Queue
// ============================================================

import { Queue, type JobsOptions } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';

// ------------------------------------------------------------
// Email type definitions
// ------------------------------------------------------------

export type EmailType =
  | 'sampleReceived'
  | 'reportReady'
  | 'invoiceSent'
  | 'paymentReceived'
  | 'overdueReminder'
  | 'welcomeClient';

export interface SampleReceivedData {
  type: 'sampleReceived';
  organizationId: string;
  orderId: string;
  orderNumber: string;
  clientName: string;
  sampleCount: number;
  receivedDate: string;
}

export interface ReportReadyData {
  type: 'reportReady';
  organizationId: string;
  reportId: string;
  orderId: string;
  orderNumber: string;
  reportNumber: string;
  clientName: string;
  downloadUrl: string;
}

export interface InvoiceSentData {
  type: 'invoiceSent';
  organizationId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  total: number;
  currency: string;
  dueDate: string;
}

export interface PaymentReceivedData {
  type: 'paymentReceived';
  organizationId: string;
  paymentId: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  clientName: string;
  amount: number;
  currency: string;
  method: string;
}

export interface OverdueReminderData {
  type: 'overdueReminder';
  organizationId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  total: number;
  balanceDue: number;
  currency: string;
  dueDate: string;
  daysPastDue: number;
}

export interface WelcomeClientData {
  type: 'welcomeClient';
  organizationId: string;
  clientId: string;
  clientName: string;
  contactFirstName: string;
  portalUrl: string;
}

export type EmailJobData =
  | SampleReceivedData
  | ReportReadyData
  | InvoiceSentData
  | PaymentReceivedData
  | OverdueReminderData
  | WelcomeClientData;

export interface SendEmailJobData {
  /** Recipient email addresses. */
  to: string[];
  /** CC email addresses. */
  cc?: string[];
  /** The typed payload used to render the email template. */
  payload: EmailJobData;
}

// ------------------------------------------------------------
// Default job options
// ------------------------------------------------------------

export const EMAIL_JOB_DEFAULTS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 3_000,
  },
  removeOnComplete: { count: 1_000 },
  removeOnFail: { count: 2_000 },
};

// ------------------------------------------------------------
// Queue name constant
// ------------------------------------------------------------

export const EMAIL_QUEUE_NAME = 'labflow:emails';

// ------------------------------------------------------------
// Queue factory
// ------------------------------------------------------------

export function createEmailQueue(connection: ConnectionOptions): Queue {
  return new Queue(EMAIL_QUEUE_NAME, {
    connection,
    defaultJobOptions: EMAIL_JOB_DEFAULTS,
  });
}
