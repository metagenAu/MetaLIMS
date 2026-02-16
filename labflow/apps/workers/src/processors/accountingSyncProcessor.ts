// ============================================================
// Accounting Sync Processor (QuickBooks Online)
// ============================================================
//
// Syncs invoices, payments, and credit notes to QuickBooks Online
// via their REST API. This processor handles:
//
//   - syncInvoice    : create or update an invoice in QBO
//   - syncPayment    : create a payment record in QBO
//   - syncCreditNote : create a credit memo in QBO
//
// Each job carries the QuickBooks realm ID (company ID) which is
// stored on the Organization record when the OAuth connection is
// established.
//
// Authentication tokens are refreshed from the database as needed.
// The processor stores the QBO ID back on the local record so
// subsequent syncs become updates rather than creates.
// ============================================================

import { Worker, type Job, type ConnectionOptions } from 'bullmq';
import { prisma } from '@labflow/db';
import type { Logger } from 'pino';
import {
  ACCOUNTING_SYNC_QUEUE_NAME,
  type AccountingSyncJobData,
  type SyncInvoiceJobData,
  type SyncPaymentJobData,
  type SyncCreditNoteJobData,
} from '../queues/accountingSyncQueue.js';

// ----------------------------------------------------------------
// QuickBooks API client
// ----------------------------------------------------------------

interface QBOTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Retrieves the current QuickBooks OAuth tokens from the organization
 * settings. In production, tokens should be stored encrypted.
 */
async function getQBOTokens(organizationId: string): Promise<QBOTokens> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { settings: true },
  });

  const settings = org.settings as Record<string, unknown>;
  const qboTokens = settings.quickbooksTokens as
    | {
        accessToken: string;
        refreshToken: string;
        expiresAt: string;
      }
    | undefined;

  if (!qboTokens?.accessToken) {
    throw new Error(
      `QuickBooks tokens not configured for organization ${organizationId}`,
    );
  }

  return {
    accessToken: qboTokens.accessToken,
    refreshToken: qboTokens.refreshToken,
    expiresAt: new Date(qboTokens.expiresAt),
  };
}

/**
 * Refreshes the QuickBooks access token using the refresh token
 * and persists the new tokens back to the database.
 */
async function refreshQBOTokens(
  organizationId: string,
  refreshToken: string,
  logger: Logger,
): Promise<QBOTokens> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('QuickBooks client credentials not configured');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64',
  );

  const response = await fetch(
    'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error(
      { status: response.status, body: errorBody },
      'Failed to refresh QuickBooks token',
    );
    throw new Error(`QuickBooks token refresh failed: ${response.status}`);
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  // Persist tokens
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { settings: true },
  });

  const settings = org.settings as Record<string, unknown>;
  settings.quickbooksTokens = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: expiresAt.toISOString(),
  };

  await prisma.organization.update({
    where: { id: organizationId },
    data: { settings: settings as object },
  });

  logger.info('QuickBooks tokens refreshed and persisted');

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
  };
}

/**
 * Gets a valid access token, refreshing if necessary.
 */
async function getValidAccessToken(
  organizationId: string,
  logger: Logger,
): Promise<string> {
  let tokens = await getQBOTokens(organizationId);

  // Refresh if token expires within the next 5 minutes
  const fiveMinutes = 5 * 60 * 1000;
  if (tokens.expiresAt.getTime() - Date.now() < fiveMinutes) {
    logger.info('QuickBooks token expiring soon, refreshing');
    tokens = await refreshQBOTokens(
      organizationId,
      tokens.refreshToken,
      logger,
    );
  }

  return tokens.accessToken;
}

/**
 * Makes an authenticated request to the QuickBooks Online API.
 */
async function qboRequest(
  method: 'GET' | 'POST',
  realmId: string,
  endpoint: string,
  accessToken: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const baseUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

  const url = `${baseUrl}/v3/company/${realmId}/${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `QuickBooks API error (${response.status}) at ${endpoint}: ${errorText}`,
    );
  }

  return (await response.json()) as Record<string, unknown>;
}

// ----------------------------------------------------------------
// Sync handlers
// ----------------------------------------------------------------

async function syncInvoice(
  data: SyncInvoiceJobData,
  logger: Logger,
): Promise<void> {
  const log = logger.child({
    action: 'syncInvoice',
    invoiceId: data.invoiceId,
  });

  const accessToken = await getValidAccessToken(data.organizationId, log);

  // Fetch the invoice with line items and client
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: data.invoiceId },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      client: true,
    },
  });

  // Build the QBO Invoice object
  const qboInvoice: Record<string, unknown> = {
    CustomerRef: {
      value: invoice.client.stripeCustomerId || invoice.clientId,
      name: invoice.client.name,
    },
    DocNumber: invoice.invoiceNumber,
    TxnDate: invoice.issueDate
      ? invoice.issueDate.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    DueDate: invoice.dueDate
      ? invoice.dueDate.toISOString().split('T')[0]
      : undefined,
    Line: invoice.lineItems.map((item, index) => ({
      LineNum: index + 1,
      Amount: Number(item.total),
      DetailType: 'SalesItemLineDetail',
      Description: item.description,
      SalesItemLineDetail: {
        Qty: Number(item.quantity),
        UnitPrice: Number(item.unitPrice),
      },
    })),
    CustomerMemo: {
      value: invoice.notes || '',
    },
  };

  // If discount
  if (Number(invoice.discountAmount) > 0) {
    (qboInvoice.Line as Array<Record<string, unknown>>).push({
      Amount: Number(invoice.discountAmount),
      DetailType: 'DiscountLineDetail',
      DiscountLineDetail: {
        PercentBased: invoice.discountPercent != null,
        ...(invoice.discountPercent != null
          ? { DiscountPercent: Number(invoice.discountPercent) }
          : {}),
      },
    });
  }

  let result: Record<string, unknown>;

  if (invoice.quickbooksInvoiceId) {
    // Update existing QBO invoice - need to fetch current SyncToken first
    log.info(
      { qboInvoiceId: invoice.quickbooksInvoiceId },
      'Updating existing QBO invoice',
    );

    const existing = await qboRequest(
      'GET',
      data.quickbooksRealmId,
      `invoice/${invoice.quickbooksInvoiceId}`,
      accessToken,
    );

    const existingInvoice = (existing as { Invoice: { SyncToken: string } })
      .Invoice;

    qboInvoice.Id = invoice.quickbooksInvoiceId;
    qboInvoice.SyncToken = existingInvoice.SyncToken;
    qboInvoice.sparse = true;

    result = await qboRequest(
      'POST',
      data.quickbooksRealmId,
      'invoice',
      accessToken,
      qboInvoice,
    );
  } else {
    // Create new QBO invoice
    log.info('Creating new QBO invoice');
    result = await qboRequest(
      'POST',
      data.quickbooksRealmId,
      'invoice',
      accessToken,
      qboInvoice,
    );
  }

  // Extract the QBO invoice ID and store it
  const qboInvoiceResult = (result as { Invoice: { Id: string } }).Invoice;
  const qboInvoiceId = qboInvoiceResult.Id;

  await prisma.invoice.update({
    where: { id: data.invoiceId },
    data: { quickbooksInvoiceId: qboInvoiceId },
  });

  log.info({ qboInvoiceId }, 'Invoice synced to QuickBooks');
}

async function syncPayment(
  data: SyncPaymentJobData,
  logger: Logger,
): Promise<void> {
  const log = logger.child({
    action: 'syncPayment',
    paymentId: data.paymentId,
  });

  const accessToken = await getValidAccessToken(data.organizationId, log);

  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: data.paymentId },
    include: {
      client: true,
      invoice: true,
    },
  });

  // Map our payment methods to QBO payment method names
  const qboPaymentMethodMap: Record<string, string> = {
    CREDIT_CARD: 'Credit Card',
    ACH: 'ACH',
    WIRE_TRANSFER: 'Wire Transfer',
    CHECK: 'Check',
    CASH: 'Cash',
    STRIPE: 'Credit Card',
    OTHER: 'Other',
  };

  const qboPayment: Record<string, unknown> = {
    CustomerRef: {
      value: payment.client.stripeCustomerId || payment.clientId,
      name: payment.client.name,
    },
    TotalAmt: Number(payment.amount),
    TxnDate: payment.paymentDate.toISOString().split('T')[0],
    PaymentMethodRef: {
      value: qboPaymentMethodMap[payment.method] || 'Other',
    },
    PrivateNote: payment.notes || '',
  };

  // Link to QBO invoice if available
  if (
    data.invoiceId &&
    payment.invoice?.quickbooksInvoiceId
  ) {
    qboPayment.Line = [
      {
        Amount: Number(payment.amount),
        LinkedTxn: [
          {
            TxnId: payment.invoice.quickbooksInvoiceId,
            TxnType: 'Invoice',
          },
        ],
      },
    ];
  }

  log.info('Creating payment in QuickBooks');

  const result = await qboRequest(
    'POST',
    data.quickbooksRealmId,
    'payment',
    accessToken,
    qboPayment,
  );

  const qboPaymentResult = (result as { Payment: { Id: string } }).Payment;
  log.info({ qboPaymentId: qboPaymentResult.Id }, 'Payment synced to QuickBooks');

  // Store the QBO payment reference on the local record
  await prisma.payment.update({
    where: { id: data.paymentId },
    data: {
      referenceNumber: payment.referenceNumber
        ? `${payment.referenceNumber} (QBO: ${qboPaymentResult.Id})`
        : `QBO: ${qboPaymentResult.Id}`,
    },
  });
}

async function syncCreditNote(
  data: SyncCreditNoteJobData,
  logger: Logger,
): Promise<void> {
  const log = logger.child({
    action: 'syncCreditNote',
    creditNoteId: data.creditNoteId,
  });

  const accessToken = await getValidAccessToken(data.organizationId, log);

  const creditNote = await prisma.creditNote.findUniqueOrThrow({
    where: { id: data.creditNoteId },
    include: {
      invoice: {
        include: { client: true },
      },
    },
  });

  const qboCreditMemo: Record<string, unknown> = {
    CustomerRef: {
      value:
        creditNote.invoice.client.stripeCustomerId ||
        creditNote.invoice.clientId,
      name: creditNote.invoice.client.name,
    },
    DocNumber: creditNote.creditNumber,
    Line: [
      {
        Amount: Number(creditNote.amount),
        DetailType: 'SalesItemLineDetail',
        Description: `Credit: ${creditNote.reason}`,
        SalesItemLineDetail: {
          Qty: 1,
          UnitPrice: Number(creditNote.amount),
        },
      },
    ],
    PrivateNote: creditNote.reason,
  };

  log.info('Creating credit memo in QuickBooks');

  const result = await qboRequest(
    'POST',
    data.quickbooksRealmId,
    'creditmemo',
    accessToken,
    qboCreditMemo,
  );

  const qboCreditResult = (result as { CreditMemo: { Id: string } })
    .CreditMemo;
  log.info(
    { qboCreditMemoId: qboCreditResult.Id },
    'Credit memo synced to QuickBooks',
  );
}

// ----------------------------------------------------------------
// Processor function
// ----------------------------------------------------------------

async function processAccountingSyncJob(
  job: Job<AccountingSyncJobData>,
  logger: Logger,
): Promise<void> {
  const log = logger.child({
    jobId: job.id,
    action: job.data.action,
    organizationId: job.data.organizationId,
  });

  log.info('Processing accounting sync job');

  // Create an audit log for the sync attempt
  const auditData = {
    organizationId: job.data.organizationId,
    entityType: 'AccountingSync',
    entityId: '',
    action: job.data.action,
    changes: job.data as unknown as object,
  };

  try {
    switch (job.data.action) {
      case 'syncInvoice': {
        const data = job.data as SyncInvoiceJobData;
        auditData.entityId = data.invoiceId;
        await syncInvoice(data, log);
        break;
      }
      case 'syncPayment': {
        const data = job.data as SyncPaymentJobData;
        auditData.entityId = data.paymentId;
        await syncPayment(data, log);
        break;
      }
      case 'syncCreditNote': {
        const data = job.data as SyncCreditNoteJobData;
        auditData.entityId = data.creditNoteId;
        await syncCreditNote(data, log);
        break;
      }
      default:
        throw new Error(`Unknown accounting sync action: ${(job.data as { action: string }).action}`);
    }

    // Log successful sync
    await prisma.auditLog.create({
      data: {
        ...auditData,
        changes: { ...auditData.changes, status: 'SUCCESS' } as unknown as object,
      },
    });

    await job.updateProgress(100);
    log.info('Accounting sync completed successfully');
  } catch (err) {
    // Log failed sync
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error';

    await prisma.auditLog.create({
      data: {
        ...auditData,
        changes: {
          ...auditData.changes,
          status: 'FAILED',
          error: errorMessage,
        } as unknown as object,
      },
    });

    log.error({ err: errorMessage }, 'Accounting sync failed');
    throw err; // Re-throw so BullMQ handles retries
  }
}

// ----------------------------------------------------------------
// Worker factory
// ----------------------------------------------------------------

export function createAccountingSyncWorker(
  connection: ConnectionOptions,
  logger: Logger,
): Worker {
  const worker = new Worker(
    ACCOUNTING_SYNC_QUEUE_NAME,
    async (job: Job<AccountingSyncJobData>) => {
      await processAccountingSyncJob(job, logger);
    },
    {
      connection,
      concurrency: 2,
      limiter: {
        max: 10,
        duration: 60_000,
      },
    },
  );

  worker.on('completed', (job) => {
    logger.info(
      { jobId: job.id, action: (job.data as AccountingSyncJobData).action },
      'Accounting sync job completed',
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      {
        jobId: job?.id,
        action: job ? (job.data as AccountingSyncJobData).action : 'unknown',
        err: err.message,
        attemptsMade: job?.attemptsMade,
      },
      'Accounting sync job failed',
    );
  });

  return worker;
}
