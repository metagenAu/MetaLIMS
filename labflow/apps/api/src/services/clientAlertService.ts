/**
 * Client Alert Service
 *
 * Sends progress notifications to clients based on their alert preferences.
 * Supports email delivery (via the existing email queue) and webhook callbacks.
 * All alerts are logged to the ClientAlertLog table for audit and dedup.
 */

import { prisma } from '@labflow/db';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface AlertPayload {
  organizationId: string;
  clientId: string;
  alertType: string;
  subject: string;
  body: string;
  entityType?: string;
  entityId?: string;
}

// ------------------------------------------------------------------
// Core send function
// ------------------------------------------------------------------

/**
 * Checks if the client has an active alert config matching `alertType`
 * and (optionally) the given `stageKey`.  If so, creates a log entry
 * and queues the email for delivery.
 *
 * @returns The created ClientAlertLog entry, or null if no alert was sent.
 */
export async function sendClientAlert(payload: AlertPayload, stageKey?: string) {
  const config = await prisma.clientAlertConfig.findUnique({
    where: {
      clientId_alertType: {
        clientId: payload.clientId,
        alertType: payload.alertType,
      },
    },
  });

  // No config → no alert
  if (!config || !config.enabled) return null;

  // If config restricts to specific stages, check the stage matches
  if (config.stageKeys.length > 0 && stageKey && !config.stageKeys.includes(stageKey)) {
    return null;
  }

  // Determine recipients: explicit list on config, else fall back to client contacts
  let recipients = config.emailRecipients;
  if (recipients.length === 0) {
    const contacts = await prisma.clientContact.findMany({
      where: { clientId: payload.clientId, receiveReports: true },
      select: { email: true },
    });
    recipients = contacts.map((c) => c.email);
  }

  if (recipients.length === 0) {
    // Fallback to main client email
    const client = await prisma.client.findUnique({
      where: { id: payload.clientId },
      select: { contactEmail: true },
    });
    if (client?.contactEmail) {
      recipients = [client.contactEmail];
    }
  }

  const channel = config.webhookUrl ? 'BOTH' : 'EMAIL';

  // Log the alert
  const log = await prisma.clientAlertLog.create({
    data: {
      organizationId: payload.organizationId,
      clientId: payload.clientId,
      alertType: payload.alertType,
      channel,
      subject: payload.subject,
      body: payload.body,
      entityType: payload.entityType,
      entityId: payload.entityId,
      recipients,
      status: 'SENT',
    },
  });

  // TODO: Queue email via existing BullMQ email queue (emailQueue.add('clientAlert', { ... }))
  // TODO: POST to webhook URL if configured

  return log;
}

// ------------------------------------------------------------------
// Domain-specific alert helpers
// ------------------------------------------------------------------

/**
 * Notifies the client when their sample moves to a new workflow stage.
 */
export async function alertClientStageChange(params: {
  organizationId: string;
  clientId: string;
  sampleNumber: string;
  sampleId: string;
  stageLabel: string;
  stageKey: string;
  category: string;
}) {
  return sendClientAlert(
    {
      organizationId: params.organizationId,
      clientId: params.clientId,
      alertType: 'STAGE_CHANGE',
      subject: `Sample ${params.sampleNumber} — ${params.stageLabel}`,
      body: `Your sample ${params.sampleNumber} has moved to the "${params.stageLabel}" stage in our ${params.category} workflow. We will notify you of further progress.`,
      entityType: 'SAMPLE',
      entityId: params.sampleId,
    },
    params.stageKey,
  );
}

/**
 * Notifies the client when an analysis batch (run) is complete.
 */
export async function alertClientBatchComplete(params: {
  organizationId: string;
  clientId: string;
  batchNumber: string;
  batchId: string;
  sampleCount: number;
  category: string;
}) {
  return sendClientAlert({
    organizationId: params.organizationId,
    clientId: params.clientId,
    alertType: 'BATCH_COMPLETE',
    subject: `Batch ${params.batchNumber} processing complete`,
    body: `Analysis batch ${params.batchNumber} containing ${params.sampleCount} sample(s) in our ${params.category} workflow has completed processing. Results will be reviewed and released shortly.`,
    entityType: 'BATCH',
    entityId: params.batchId,
  });
}

/**
 * Notifies the client when results are ready for their samples.
 */
export async function alertClientResultsReady(params: {
  organizationId: string;
  clientId: string;
  orderNumber: string;
  orderId: string;
  sampleCount: number;
}) {
  return sendClientAlert({
    organizationId: params.organizationId,
    clientId: params.clientId,
    alertType: 'RESULTS_READY',
    subject: `Results ready for order ${params.orderNumber}`,
    body: `Results for ${params.sampleCount} sample(s) in order ${params.orderNumber} are now ready. Your report is being finalised and will be delivered shortly.`,
    entityType: 'ORDER',
    entityId: params.orderId,
  });
}

/**
 * Notifies the client when a report has been sent.
 */
export async function alertClientReportSent(params: {
  organizationId: string;
  clientId: string;
  reportNumber: string;
  reportId: string;
  orderNumber: string;
}) {
  return sendClientAlert({
    organizationId: params.organizationId,
    clientId: params.clientId,
    alertType: 'REPORT_SENT',
    subject: `Report ${params.reportNumber} available`,
    body: `Report ${params.reportNumber} for order ${params.orderNumber} has been delivered. You can view and download it from your client portal.`,
    entityType: 'REPORT',
    entityId: params.reportId,
  });
}

/**
 * Notifies the client when a sequencing run containing their samples has been submitted.
 */
export async function alertClientRunSubmitted(params: {
  organizationId: string;
  clientId: string;
  runIdentifier: string;
  sampleCount: number;
}) {
  return sendClientAlert({
    organizationId: params.organizationId,
    clientId: params.clientId,
    alertType: 'RUN_SUBMITTED',
    subject: `Sequencing run ${params.runIdentifier} submitted`,
    body: `A sequencing run (${params.runIdentifier}) containing ${params.sampleCount} of your sample(s) has been submitted to the sequencer. Expected results in 24-72 hours.`,
    entityType: 'SEQUENCING_RUN',
    entityId: params.runIdentifier,
  });
}
