// ============================================================
// Email Sending Processor
// ============================================================
//
// Uses nodemailer to deliver transactional emails. Each email
// type maps to a subject line and HTML body builder so the
// processor is a single entry point for all outbound email.
//
// Sent emails are logged to the Notification table for audit.
// ============================================================

import { Worker, type Job, type ConnectionOptions } from 'bullmq';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { prisma } from '@labflow/db';
import type { Logger } from 'pino';
import {
  EMAIL_QUEUE_NAME,
  type SendEmailJobData,
  type EmailJobData,
  type EmailType,
} from '../queues/emailQueue.js';

// ----------------------------------------------------------------
// Transporter singleton
// ----------------------------------------------------------------

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT) || 1025,
    secure: process.env.SMTP_SECURE === 'true',
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || '',
          },
        }
      : {}),
  });

  return transporter;
}

// ----------------------------------------------------------------
// Email template builders
// ----------------------------------------------------------------

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function buildSampleReceivedEmail(
  payload: Extract<EmailJobData, { type: 'sampleReceived' }>,
): EmailTemplate {
  const subject = `Samples Received - Order ${payload.orderNumber}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a56db;">Samples Received</h2>
      <p>Dear ${payload.clientName},</p>
      <p>We have received your samples for <strong>Order ${payload.orderNumber}</strong>.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr style="background: #f3f4f6;">
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Order Number</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${payload.orderNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Samples Received</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${payload.sampleCount}</td>
        </tr>
        <tr style="background: #f3f4f6;">
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Date Received</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${payload.receivedDate}</td>
        </tr>
      </table>
      <p>Testing will commence shortly. You will be notified when results are ready.</p>
      <p>Thank you for choosing our laboratory services.</p>
    </div>`;
  const text = `Samples Received - Order ${payload.orderNumber}\n\nDear ${payload.clientName},\n\nWe have received ${payload.sampleCount} sample(s) for Order ${payload.orderNumber} on ${payload.receivedDate}.\n\nTesting will commence shortly. You will be notified when results are ready.\n\nThank you.`;
  return { subject, html, text };
}

function buildReportReadyEmail(
  payload: Extract<EmailJobData, { type: 'reportReady' }>,
): EmailTemplate {
  const subject = `Report Ready - ${payload.reportNumber} (Order ${payload.orderNumber})`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a56db;">Report Ready for Download</h2>
      <p>Dear ${payload.clientName},</p>
      <p>The Certificate of Analysis for <strong>Order ${payload.orderNumber}</strong> is now available.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr style="background: #f3f4f6;">
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Report Number</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${payload.reportNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Order Number</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${payload.orderNumber}</td>
        </tr>
      </table>
      <p style="margin: 24px 0;">
        <a href="${payload.downloadUrl}" style="background: #1a56db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Download Report
        </a>
      </p>
      <p>You can also view this report by logging into the client portal.</p>
    </div>`;
  const text = `Report Ready - ${payload.reportNumber}\n\nDear ${payload.clientName},\n\nThe Certificate of Analysis for Order ${payload.orderNumber} is now available.\n\nDownload: ${payload.downloadUrl}\n\nThank you.`;
  return { subject, html, text };
}

function buildInvoiceSentEmail(
  payload: Extract<EmailJobData, { type: 'invoiceSent' }>,
): EmailTemplate {
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: payload.currency,
  }).format(payload.total);

  const subject = `Invoice ${payload.invoiceNumber} - ${formattedTotal}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a56db;">Invoice</h2>
      <p>Dear ${payload.clientName},</p>
      <p>Please find your invoice details below.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr style="background: #f3f4f6;">
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Invoice Number</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${payload.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Total</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${formattedTotal}</td>
        </tr>
        <tr style="background: #f3f4f6;">
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Due Date</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${payload.dueDate}</td>
        </tr>
      </table>
      <p>Please remit payment by the due date. If you have any questions, please contact us.</p>
    </div>`;
  const text = `Invoice ${payload.invoiceNumber}\n\nDear ${payload.clientName},\n\nTotal: ${formattedTotal}\nDue Date: ${payload.dueDate}\n\nPlease remit payment by the due date.\n\nThank you.`;
  return { subject, html, text };
}

function buildPaymentReceivedEmail(
  payload: Extract<EmailJobData, { type: 'paymentReceived' }>,
): EmailTemplate {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: payload.currency,
  }).format(payload.amount);

  const invoiceRef = payload.invoiceNumber
    ? ` for Invoice ${payload.invoiceNumber}`
    : '';
  const subject = `Payment Received - ${formattedAmount}${invoiceRef}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Payment Received</h2>
      <p>Dear ${payload.clientName},</p>
      <p>We have received your payment. Thank you!</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr style="background: #f3f4f6;">
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Amount</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Method</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${payload.method.replace(/_/g, ' ')}</td>
        </tr>
        ${payload.invoiceNumber ? `<tr style="background: #f3f4f6;"><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Invoice</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${payload.invoiceNumber}</td></tr>` : ''}
      </table>
      <p>A receipt is available in your client portal.</p>
    </div>`;
  const text = `Payment Received - ${formattedAmount}${invoiceRef}\n\nDear ${payload.clientName},\n\nWe have received your payment of ${formattedAmount} via ${payload.method.replace(/_/g, ' ')}.\n\nThank you.`;
  return { subject, html, text };
}

function buildOverdueReminderEmail(
  payload: Extract<EmailJobData, { type: 'overdueReminder' }>,
): EmailTemplate {
  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: payload.currency,
  }).format(payload.balanceDue);

  const subject = `OVERDUE: Invoice ${payload.invoiceNumber} - ${payload.daysPastDue} days past due`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Payment Overdue</h2>
      <p>Dear ${payload.clientName},</p>
      <p>This is a reminder that the following invoice is <strong>${payload.daysPastDue} day(s) past due</strong>.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr style="background: #fef2f2;">
          <td style="padding: 8px; border: 1px solid #fecaca; font-weight: bold;">Invoice Number</td>
          <td style="padding: 8px; border: 1px solid #fecaca;">${payload.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #fecaca; font-weight: bold;">Balance Due</td>
          <td style="padding: 8px; border: 1px solid #fecaca;">${formattedBalance}</td>
        </tr>
        <tr style="background: #fef2f2;">
          <td style="padding: 8px; border: 1px solid #fecaca; font-weight: bold;">Due Date</td>
          <td style="padding: 8px; border: 1px solid #fecaca;">${payload.dueDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #fecaca; font-weight: bold;">Days Past Due</td>
          <td style="padding: 8px; border: 1px solid #fecaca;">${payload.daysPastDue}</td>
        </tr>
      </table>
      <p>Please submit payment at your earliest convenience. If you have already sent payment, please disregard this notice.</p>
    </div>`;
  const text = `OVERDUE: Invoice ${payload.invoiceNumber}\n\nDear ${payload.clientName},\n\nInvoice ${payload.invoiceNumber} is ${payload.daysPastDue} day(s) past due.\nBalance Due: ${formattedBalance}\nDue Date: ${payload.dueDate}\n\nPlease submit payment at your earliest convenience.\n\nThank you.`;
  return { subject, html, text };
}

function buildWelcomeClientEmail(
  payload: Extract<EmailJobData, { type: 'welcomeClient' }>,
): EmailTemplate {
  const subject = `Welcome to LabFlow - ${payload.clientName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a56db;">Welcome to LabFlow!</h2>
      <p>Dear ${payload.contactFirstName},</p>
      <p>Your organization <strong>${payload.clientName}</strong> has been set up in our laboratory information management system.</p>
      <p>You can access the client portal to:</p>
      <ul>
        <li>Submit new sample orders</li>
        <li>Track testing progress in real time</li>
        <li>Download Certificates of Analysis</li>
        <li>View and pay invoices</li>
      </ul>
      <p style="margin: 24px 0;">
        <a href="${payload.portalUrl}" style="background: #1a56db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Access Client Portal
        </a>
      </p>
      <p>If you have any questions, please do not hesitate to contact us.</p>
    </div>`;
  const text = `Welcome to LabFlow!\n\nDear ${payload.contactFirstName},\n\nYour organization ${payload.clientName} has been set up in our system.\n\nAccess the client portal at: ${payload.portalUrl}\n\nThank you.`;
  return { subject, html, text };
}

// ----------------------------------------------------------------
// Template dispatcher
// ----------------------------------------------------------------

const templateBuilders: Record<EmailType, (payload: never) => EmailTemplate> = {
  sampleReceived: buildSampleReceivedEmail as (payload: never) => EmailTemplate,
  reportReady: buildReportReadyEmail as (payload: never) => EmailTemplate,
  invoiceSent: buildInvoiceSentEmail as (payload: never) => EmailTemplate,
  paymentReceived: buildPaymentReceivedEmail as (payload: never) => EmailTemplate,
  overdueReminder: buildOverdueReminderEmail as (payload: never) => EmailTemplate,
  welcomeClient: buildWelcomeClientEmail as (payload: never) => EmailTemplate,
};

function buildEmailFromPayload(payload: EmailJobData): EmailTemplate {
  const builder = templateBuilders[payload.type];
  if (!builder) {
    throw new Error(`Unknown email type: ${payload.type}`);
  }
  return builder(payload as never);
}

// ----------------------------------------------------------------
// Processor function
// ----------------------------------------------------------------

async function processEmailJob(
  job: Job<SendEmailJobData>,
  logger: Logger,
): Promise<void> {
  const log = logger.child({ jobId: job.id, emailType: job.data.payload.type });
  const { to, cc, payload } = job.data;

  log.info({ to, emailType: payload.type }, 'Processing email job');

  // Build template
  const template = buildEmailFromPayload(payload);

  // Send via nodemailer
  const transport = getTransporter();
  const fromAddress = process.env.SMTP_FROM || 'noreply@labflow.dev';

  const info = await transport.sendMail({
    from: fromAddress,
    to: to.join(', '),
    cc: cc ? cc.join(', ') : undefined,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  log.info(
    { messageId: info.messageId, accepted: info.accepted },
    'Email sent successfully',
  );

  // Log sent email as notification for audit
  // Look up user IDs for the recipients (best effort - some may be external)
  const recipientUsers = await prisma.user.findMany({
    where: {
      email: { in: to },
      isActive: true,
    },
    select: { id: true, organizationId: true },
  });

  if (recipientUsers.length > 0) {
    await prisma.notification.createMany({
      data: recipientUsers.map((user) => ({
        organizationId: user.organizationId,
        userId: user.id,
        type: `email:${payload.type}`,
        title: template.subject,
        message: `Email sent to ${to.join(', ')}`,
        channel: 'email',
        emailSentAt: new Date(),
      })),
    });

    log.info(
      { notificationCount: recipientUsers.length },
      'Created notification records for email recipients',
    );
  }

  await job.updateProgress(100);
}

// ----------------------------------------------------------------
// Worker factory
// ----------------------------------------------------------------

export function createEmailWorker(
  connection: ConnectionOptions,
  logger: Logger,
): Worker {
  const worker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job: Job<SendEmailJobData>) => {
      await processEmailJob(job, logger);
    },
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 20,
        duration: 60_000,
      },
    },
  );

  worker.on('completed', (job) => {
    logger.info(
      { jobId: job.id, emailType: (job.data as SendEmailJobData).payload.type },
      'Email job completed',
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      {
        jobId: job?.id,
        emailType: job ? (job.data as SendEmailJobData).payload.type : 'unknown',
        err: err.message,
      },
      'Email job failed',
    );
  });

  return worker;
}
