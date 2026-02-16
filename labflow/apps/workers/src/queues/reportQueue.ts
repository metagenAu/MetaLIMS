// ============================================================
// Report Generation Queue
// ============================================================

import { Queue, type JobsOptions } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';

// ------------------------------------------------------------
// Job data types
// ------------------------------------------------------------

export interface GenerateReportJobData {
  reportId: string;
  orderId: string;
  organizationId: string;
  templateId: string | null;
  requestedById: string | null;
  /** When true, send the report to the client after generation. */
  autoSend: boolean;
}

export interface RegenerateReportJobData {
  reportId: string;
  orderId: string;
  organizationId: string;
  templateId: string | null;
  requestedById: string | null;
  amendmentReason: string | null;
}

export type ReportJobName = 'generate' | 'regenerate';

export type ReportJobData = {
  generate: GenerateReportJobData;
  regenerate: RegenerateReportJobData;
};

// ------------------------------------------------------------
// Default job options
// ------------------------------------------------------------

export const REPORT_JOB_DEFAULTS: JobsOptions = {
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

export const REPORT_QUEUE_NAME = 'labflow:reports';

// ------------------------------------------------------------
// Queue factory
// ------------------------------------------------------------

export function createReportQueue(connection: ConnectionOptions): Queue {
  return new Queue(REPORT_QUEUE_NAME, {
    connection,
    defaultJobOptions: REPORT_JOB_DEFAULTS,
  });
}
