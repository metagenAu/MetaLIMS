// ============================================================
// SLA Monitoring Queue (Repeatable)
// ============================================================

import { Queue, type JobsOptions } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';

// ------------------------------------------------------------
// Job data types
// ------------------------------------------------------------

/**
 * Payload for the repeatable SLA check. The job does not need
 * external data -- it scans the database for all active orders.
 */
export interface SlaCheckJobData {
  /** Timestamp when the check was scheduled. Set automatically. */
  triggeredAt: string;
}

/** Thresholds (percent of TAT elapsed) at which we send alerts. */
export const SLA_THRESHOLDS = [50, 75, 90, 100] as const;
export type SlaThreshold = (typeof SLA_THRESHOLDS)[number];

// ------------------------------------------------------------
// Default job options
// ------------------------------------------------------------

export const SLA_JOB_DEFAULTS: JobsOptions = {
  attempts: 2,
  backoff: {
    type: 'fixed',
    delay: 30_000,
  },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 500 },
};

// ------------------------------------------------------------
// Queue name constant
// ------------------------------------------------------------

export const SLA_QUEUE_NAME = 'labflow:sla';

// ------------------------------------------------------------
// Repeatable schedule (every 15 minutes)
// ------------------------------------------------------------

export const SLA_REPEAT_OPTIONS = {
  pattern: '*/15 * * * *', // cron: every 15 minutes
} as const;

// ------------------------------------------------------------
// Queue factory
// ------------------------------------------------------------

export function createSlaQueue(connection: ConnectionOptions): Queue {
  return new Queue(SLA_QUEUE_NAME, {
    connection,
    defaultJobOptions: SLA_JOB_DEFAULTS,
  });
}
