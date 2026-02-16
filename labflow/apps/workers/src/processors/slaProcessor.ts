// ============================================================
// SLA Monitoring Processor
// ============================================================
//
// Runs as a repeatable job every 15 minutes. For each active order
// that has a dueDate set, we calculate the percentage of turnaround
// time that has elapsed and fire notifications at 50%, 75%, 90%,
// and 100% thresholds.
//
// Flow:
//   1. Fetch all active orders with due dates
//   2. For each order, compute elapsed % of TAT
//   3. Determine which threshold(s) have been crossed
//   4. Check if a notification was already sent for that threshold
//   5. Create notification records for newly crossed thresholds
//   6. For breached orders (>=100%), also queue an email alert
// ============================================================

import { Worker, type Job, Queue, type ConnectionOptions } from 'bullmq';
import { prisma } from '@labflow/db';
import type { Logger } from 'pino';
import {
  SLA_QUEUE_NAME,
  SLA_THRESHOLDS,
  type SlaCheckJobData,
  type SlaThreshold,
} from '../queues/slaQueue.js';
import { EMAIL_QUEUE_NAME } from '../queues/emailQueue.js';

// ----------------------------------------------------------------
// Active order statuses that need SLA monitoring
// ----------------------------------------------------------------

const ACTIVE_STATUSES = [
  'SUBMITTED',
  'RECEIVED',
  'IN_PROGRESS',
  'TESTING_COMPLETE',
  'IN_REVIEW',
] as const;

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/**
 * Calculates what percentage of the turnaround time has elapsed.
 * Returns a number between 0 and Infinity (if past due).
 */
function calculateElapsedPercent(
  receivedDate: Date | null,
  dueDate: Date,
  now: Date,
): number {
  // Use receivedDate as the start of the TAT window; fall back to createdAt
  const start = receivedDate ?? dueDate; // fallback should not happen in practice
  const totalMs = dueDate.getTime() - start.getTime();
  if (totalMs <= 0) return 100; // due date is in the past relative to received

  const elapsedMs = now.getTime() - start.getTime();
  return Math.round((elapsedMs / totalMs) * 100);
}

/**
 * Returns the highest threshold that has been crossed.
 */
function getThresholdsCrossed(elapsedPercent: number): SlaThreshold[] {
  return SLA_THRESHOLDS.filter((t) => elapsedPercent >= t);
}

/**
 * Builds a human-readable SLA status label.
 */
function getSlaLabel(elapsedPercent: number): string {
  if (elapsedPercent >= 100) return 'BREACHED';
  if (elapsedPercent >= 90) return 'CRITICAL';
  if (elapsedPercent >= 75) return 'AT_RISK';
  if (elapsedPercent >= 50) return 'WARNING';
  return 'ON_TRACK';
}

// ----------------------------------------------------------------
// Notification type helper
// ----------------------------------------------------------------

function slaNotificationType(threshold: SlaThreshold): string {
  return `sla:${threshold}pct`;
}

// ----------------------------------------------------------------
// Processor
// ----------------------------------------------------------------

async function processSlaCheck(
  job: Job<SlaCheckJobData>,
  logger: Logger,
  emailQueue: Queue,
): Promise<void> {
  const log = logger.child({ jobId: job.id });
  const now = new Date();

  log.info('Starting SLA monitoring check');

  // Step 1: Fetch all active orders with due dates
  const activeOrders = await prisma.order.findMany({
    where: {
      status: { in: [...ACTIVE_STATUSES] },
      dueDate: { not: null },
    },
    include: {
      client: {
        select: {
          name: true,
          contactEmail: true,
        },
      },
    },
  });

  log.info({ orderCount: activeOrders.length }, 'Found active orders with due dates');

  if (activeOrders.length === 0) {
    await job.updateProgress(100);
    return;
  }

  let newNotifications = 0;
  let breachedCount = 0;
  let atRiskCount = 0;

  const totalOrders = activeOrders.length;

  for (let i = 0; i < activeOrders.length; i++) {
    const order = activeOrders[i]!;
    const dueDate = order.dueDate!;
    const elapsedPercent = calculateElapsedPercent(
      order.receivedDate,
      dueDate,
      now,
    );

    const crossedThresholds = getThresholdsCrossed(elapsedPercent);
    if (crossedThresholds.length === 0) continue;

    const slaLabel = getSlaLabel(elapsedPercent);
    if (slaLabel === 'BREACHED') breachedCount++;
    else if (slaLabel === 'AT_RISK' || slaLabel === 'CRITICAL') atRiskCount++;

    // Step 3-4: Check which thresholds already have notifications
    const existingNotifications = await prisma.notification.findMany({
      where: {
        organizationId: order.organizationId,
        entityType: 'Order',
        entityId: order.id,
        type: {
          in: crossedThresholds.map(slaNotificationType),
        },
      },
      select: { type: true },
    });

    const existingTypes = new Set(existingNotifications.map((n) => n.type));

    // Find thresholds that need new notifications
    const newThresholds = crossedThresholds.filter(
      (t) => !existingTypes.has(slaNotificationType(t)),
    );

    if (newThresholds.length === 0) continue;

    // Step 5: Get lab managers and directors to notify
    const managers = await prisma.user.findMany({
      where: {
        organizationId: order.organizationId,
        role: { in: ['LAB_DIRECTOR', 'LAB_MANAGER'] },
        isActive: true,
      },
      select: { id: true, email: true },
    });

    if (managers.length === 0) continue;

    // Create notification records
    for (const threshold of newThresholds) {
      const title =
        threshold >= 100
          ? `SLA BREACHED: Order ${order.orderNumber}`
          : `SLA ${slaLabel}: Order ${order.orderNumber} at ${elapsedPercent}%`;

      const daysRemaining = Math.ceil(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const message =
        threshold >= 100
          ? `Order ${order.orderNumber} for ${order.client.name} has exceeded its due date (${dueDate.toISOString().split('T')[0]}). Elapsed: ${elapsedPercent}%. Overdue by ${Math.abs(daysRemaining)} day(s).`
          : `Order ${order.orderNumber} for ${order.client.name} is ${elapsedPercent}% through its turnaround time. Due: ${dueDate.toISOString().split('T')[0]}. ${daysRemaining > 0 ? `${daysRemaining} day(s) remaining.` : 'Due today.'}`;

      await prisma.notification.createMany({
        data: managers.map((manager) => ({
          organizationId: order.organizationId,
          userId: manager.id,
          type: slaNotificationType(threshold),
          title,
          message,
          entityType: 'Order',
          entityId: order.id,
          channel: threshold >= 90 ? 'email' : 'in_app',
        })),
      });

      newNotifications += managers.length;

      // Step 6: For critical and breached thresholds, also email
      if (threshold >= 90) {
        const managerEmails = managers.map((m) => m.email);

        // Also include client contact for 100% breach
        const clientEmail =
          threshold >= 100 ? order.client.contactEmail : null;

        await emailQueue.add('send', {
          to: managerEmails,
          ...(clientEmail ? { cc: [clientEmail] } : {}),
          payload: {
            type: 'overdueReminder' as const,
            organizationId: order.organizationId,
            invoiceId: '', // SLA notifications use the same template structure
            invoiceNumber: order.orderNumber,
            clientName: order.client.name,
            total: 0,
            balanceDue: 0,
            currency: 'USD',
            dueDate: dueDate.toISOString().split('T')[0]!,
            daysPastDue: Math.max(0, Math.abs(daysRemaining)),
          },
        });
      }
    }

    // Update progress proportionally
    const progress = Math.round(((i + 1) / totalOrders) * 100);
    await job.updateProgress(progress);
  }

  log.info(
    {
      totalOrders: activeOrders.length,
      breachedCount,
      atRiskCount,
      newNotifications,
    },
    'SLA monitoring check complete',
  );
}

// ----------------------------------------------------------------
// Worker factory
// ----------------------------------------------------------------

export function createSlaWorker(
  connection: ConnectionOptions,
  logger: Logger,
  emailQueue: Queue,
): Worker {
  const worker = new Worker(
    SLA_QUEUE_NAME,
    async (job: Job<SlaCheckJobData>) => {
      await processSlaCheck(job, logger, emailQueue);
    },
    {
      connection,
      concurrency: 1, // Only one SLA check at a time
    },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'SLA check completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err: err.message },
      'SLA check failed',
    );
  });

  return worker;
}
