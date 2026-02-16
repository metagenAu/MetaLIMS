// ============================================================
// Report Generation Processor
// ============================================================
//
// Handles:
//   - "generate"   : create a fresh CoA / report PDF
//   - "regenerate"  : create an amended version of an existing report
//
// Flow:
//   1. Fetch order with samples, tests, results, client, org
//   2. Compile data for the CoA template
//   3. Generate PDF bytes (abstracted into buildPdf helper)
//   4. Upload the PDF to S3
//   5. Update the Report record with file key + GENERATED status
//   6. Optionally queue an email notification
// ============================================================

import { Worker, type Job, type ConnectionOptions } from 'bullmq';
import { prisma } from '@labflow/db';
import type { Logger } from 'pino';
import {
  REPORT_QUEUE_NAME,
  type GenerateReportJobData,
  type RegenerateReportJobData,
} from '../queues/reportQueue.js';
import { EMAIL_QUEUE_NAME } from '../queues/emailQueue.js';
import type { SendEmailJobData } from '../queues/emailQueue.js';
import { Queue } from 'bullmq';

// ----------------------------------------------------------------
// S3 upload helper
// ----------------------------------------------------------------

/**
 * Uploads a buffer to S3 and returns the object key.
 *
 * This uses a lightweight HTTP PUT against the S3-compatible endpoint
 * configured via environment variables. In production you would use the
 * AWS SDK, but this keeps the dependency set minimal.
 */
async function uploadToS3(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
  const bucket = process.env.S3_BUCKET || 'labflow';
  const accessKey = process.env.S3_ACCESS_KEY || 'minioadmin';
  const secretKey = process.env.S3_SECRET_KEY || 'minioadmin';

  const url = `${endpoint}/${bucket}/${key}`;

  // Build a simple date string for the authorization header.
  const dateStr = new Date().toUTCString();

  // For MinIO / S3 compatible stores in dev we use a simple PUT.
  // In production, swap this for @aws-sdk/client-s3 PutObjectCommand.
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.byteLength),
      Date: dateStr,
      // MinIO dev mode accepts basic auth-style headers when configured simply.
      // For production, use proper AWS Signature V4 via the SDK.
      Authorization: `AWS ${accessKey}:${secretKey}`,
    },
    body: buffer,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`S3 upload failed (${response.status}): ${body}`);
  }

  return key;
}

// ----------------------------------------------------------------
// PDF builder abstraction
// ----------------------------------------------------------------

interface CoaReportData {
  organization: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string | null;
    email: string | null;
    logoUrl: string | null;
    accreditations: string[];
  };
  client: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    contactFirstName: string | null;
    contactLastName: string | null;
    contactEmail: string | null;
  };
  order: {
    orderNumber: string;
    clientPO: string | null;
    receivedDate: Date | null;
    completedDate: Date | null;
    dueDate: Date | null;
    priority: string;
  };
  report: {
    reportNumber: string;
    version: number;
    isAmended: boolean;
    amendmentReason: string | null;
  };
  samples: Array<{
    sampleNumber: string;
    name: string | null;
    clientSampleId: string | null;
    matrix: string | null;
    collectedDate: Date | null;
    receivedDate: Date | null;
    tests: Array<{
      methodCode: string;
      methodName: string;
      overallResult: string | null;
      results: Array<{
        analyteName: string;
        finalValue: string | null;
        unit: string | null;
        passStatus: string | null;
        specMin: number | null;
        specMax: number | null;
      }>;
    }>;
  }>;
}

/**
 * Generates a PDF buffer from the compiled CoA data.
 *
 * This is the integration point for a PDF library such as
 * @react-pdf/renderer, puppeteer, pdfkit, or a reporting service.
 * The function builds a minimal text-based PDF as a working stub.
 * Replace the body with your preferred PDF generation library.
 */
async function buildPdf(data: CoaReportData): Promise<Buffer> {
  // -----------------------------------------------------------
  // Minimal PDF generation using raw PDF operators.
  // This produces a valid, single-page PDF with the CoA content
  // rendered as plain text. Swap this out for a rich HTML-based
  // renderer (Puppeteer, Playwright, etc.) in production.
  // -----------------------------------------------------------
  const lines: string[] = [];
  lines.push(`Certificate of Analysis`);
  lines.push(`Report: ${data.report.reportNumber} (v${data.report.version})`);
  if (data.report.isAmended) {
    lines.push(`AMENDED - Reason: ${data.report.amendmentReason ?? 'N/A'}`);
  }
  lines.push(``);
  lines.push(`Laboratory: ${data.organization.name}`);
  if (data.organization.address) {
    lines.push(
      `Address: ${data.organization.address}, ${data.organization.city ?? ''} ${data.organization.state ?? ''} ${data.organization.zip ?? ''}`,
    );
  }
  if (data.organization.accreditations.length > 0) {
    lines.push(`Accreditations: ${data.organization.accreditations.join(', ')}`);
  }
  lines.push(``);
  lines.push(`Client: ${data.client.name}`);
  if (data.client.contactFirstName || data.client.contactLastName) {
    lines.push(`Contact: ${data.client.contactFirstName ?? ''} ${data.client.contactLastName ?? ''}`);
  }
  lines.push(``);
  lines.push(`Order: ${data.order.orderNumber}`);
  if (data.order.clientPO) lines.push(`Client PO: ${data.order.clientPO}`);
  if (data.order.receivedDate)
    lines.push(`Received: ${data.order.receivedDate.toISOString().split('T')[0]}`);
  if (data.order.completedDate)
    lines.push(`Completed: ${data.order.completedDate.toISOString().split('T')[0]}`);
  lines.push(``);
  lines.push(`--- Samples & Results ---`);

  for (const sample of data.samples) {
    lines.push(``);
    lines.push(
      `Sample: ${sample.sampleNumber}${sample.name ? ` - ${sample.name}` : ''}${sample.clientSampleId ? ` (Client ID: ${sample.clientSampleId})` : ''}`,
    );
    if (sample.matrix) lines.push(`  Matrix: ${sample.matrix}`);

    for (const test of sample.tests) {
      lines.push(`  Test: ${test.methodCode} - ${test.methodName}`);
      lines.push(`  Overall: ${test.overallResult ?? 'Pending'}`);

      for (const result of test.results) {
        const spec =
          result.specMin != null || result.specMax != null
            ? ` [Spec: ${result.specMin ?? '-'} - ${result.specMax ?? '-'}]`
            : '';
        const pass = result.passStatus ? ` (${result.passStatus})` : '';
        lines.push(
          `    ${result.analyteName}: ${result.finalValue ?? 'N/A'} ${result.unit ?? ''}${spec}${pass}`,
        );
      }
    }
  }

  lines.push(``);
  lines.push(`--- End of Report ---`);

  const textContent = lines.join('\n');

  // Encode the text content as a stream inside a minimal valid PDF.
  const stream = `BT\n/F1 10 Tf\n12 TL\n50 750 Td\n${textContent
    .split('\n')
    .map((l) => `(${l.replace(/[()\\]/g, '\\$&')}) Tj T*`)
    .join('\n')}\nET`;

  const streamBytes = Buffer.from(stream, 'utf-8');

  const pdf = [
    `%PDF-1.4`,
    `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj`,
    `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj`,
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj`,
    `4 0 obj<</Length ${streamBytes.byteLength}>>\nstream\n${stream}\nendstream\nendobj`,
    `5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Courier>>endobj`,
    `xref`,
    `0 6`,
    `0000000000 65535 f `,
    `0000000009 00000 n `,
    `0000000058 00000 n `,
    `0000000115 00000 n `,
    `trailer<</Size 6/Root 1 0 R>>`,
    `startxref`,
    `0`,
    `%%EOF`,
  ].join('\n');

  return Buffer.from(pdf, 'utf-8');
}

// ----------------------------------------------------------------
// Data fetching
// ----------------------------------------------------------------

async function fetchCoaData(
  orderId: string,
  reportId: string,
): Promise<CoaReportData> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      client: true,
      samples: {
        include: {
          tests: {
            include: {
              testMethod: true,
              results: {
                include: {
                  analyte: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: order.organizationId },
  });

  const report = await prisma.report.findUniqueOrThrow({
    where: { id: reportId },
  });

  return {
    organization: {
      name: org.name,
      address: org.address,
      city: org.city,
      state: org.state,
      zip: org.zip,
      phone: org.phone,
      email: org.email,
      logoUrl: org.logoUrl,
      accreditations: org.accreditations,
    },
    client: {
      name: order.client.name,
      address: order.client.address,
      city: order.client.city,
      state: order.client.state,
      zip: order.client.zip,
      contactFirstName: order.client.contactFirstName,
      contactLastName: order.client.contactLastName,
      contactEmail: order.client.contactEmail,
    },
    order: {
      orderNumber: order.orderNumber,
      clientPO: order.clientPO,
      receivedDate: order.receivedDate,
      completedDate: order.completedDate,
      dueDate: order.dueDate,
      priority: order.priority,
    },
    report: {
      reportNumber: report.reportNumber,
      version: report.version,
      isAmended: report.isAmended,
      amendmentReason: report.amendmentReason,
    },
    samples: order.samples.map((sample) => ({
      sampleNumber: sample.sampleNumber,
      name: sample.name,
      clientSampleId: sample.clientSampleId,
      matrix: sample.matrix,
      collectedDate: sample.collectedDate,
      receivedDate: sample.receivedDate,
      tests: sample.tests.map((test) => ({
        methodCode: test.testMethod.code,
        methodName: test.testMethod.name,
        overallResult: test.overallResult,
        results: test.results.map((r) => ({
          analyteName: r.analyte.name,
          finalValue: r.finalValue,
          unit: r.unit,
          passStatus: r.passStatus,
          specMin: r.specMin ? Number(r.specMin) : null,
          specMax: r.specMax ? Number(r.specMax) : null,
        })),
      })),
    })),
  };
}

// ----------------------------------------------------------------
// Processor function
// ----------------------------------------------------------------

async function processReportJob(
  job: Job<GenerateReportJobData | RegenerateReportJobData>,
  logger: Logger,
  emailQueue: Queue,
): Promise<void> {
  const log = logger.child({ jobId: job.id, jobName: job.name });
  const data = job.data;

  log.info({ reportId: data.reportId, orderId: data.orderId }, 'Starting report generation');

  // Step 1 & 2: Fetch and compile data
  await job.updateProgress(10);
  const coaData = await fetchCoaData(data.orderId, data.reportId);
  log.info(
    { sampleCount: coaData.samples.length },
    'Fetched order data for report',
  );

  // Step 3: Generate PDF
  await job.updateProgress(40);
  const pdfBuffer = await buildPdf(coaData);
  log.info({ pdfSize: pdfBuffer.byteLength }, 'Generated PDF');

  // Step 4: Upload to S3
  await job.updateProgress(70);
  const fileKey = `reports/${data.organizationId}/${data.reportId}/${coaData.report.reportNumber}-v${coaData.report.version}.pdf`;
  await uploadToS3(pdfBuffer, fileKey, 'application/pdf');
  log.info({ fileKey }, 'Uploaded PDF to S3');

  // Step 5: Update report record
  await job.updateProgress(90);
  await prisma.report.update({
    where: { id: data.reportId },
    data: {
      generatedFileKey: fileKey,
      status: 'GENERATED',
      ...(job.name === 'regenerate'
        ? {
            isAmended: true,
            amendmentReason:
              (data as RegenerateReportJobData).amendmentReason ?? null,
          }
        : {}),
    },
  });

  log.info({ reportId: data.reportId }, 'Report record updated to GENERATED');

  // Step 6: If autoSend, queue an email
  if (job.name === 'generate' && (data as GenerateReportJobData).autoSend) {
    // Find client contacts who should receive reports
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: data.orderId },
      include: {
        client: {
          include: {
            contacts: {
              where: { receiveReports: true },
            },
          },
        },
      },
    });

    const recipientEmails = order.client.contacts
      .map((c) => c.email)
      .filter(Boolean);

    if (order.client.contactEmail) {
      recipientEmails.push(order.client.contactEmail);
    }

    const uniqueEmails = [...new Set(recipientEmails)];

    if (uniqueEmails.length > 0) {
      const emailPayload: SendEmailJobData = {
        to: uniqueEmails,
        payload: {
          type: 'reportReady',
          organizationId: data.organizationId,
          reportId: data.reportId,
          orderId: data.orderId,
          orderNumber: coaData.order.orderNumber,
          reportNumber: coaData.report.reportNumber,
          clientName: coaData.client.name,
          downloadUrl: `${process.env.PORTAL_URL || 'http://localhost:3001'}/reports/${data.reportId}/download`,
        },
      };

      await emailQueue.add('send', emailPayload);
      log.info(
        { recipientCount: uniqueEmails.length },
        'Queued report-ready email',
      );
    }
  }

  await job.updateProgress(100);
  log.info({ reportId: data.reportId }, 'Report generation complete');
}

// ----------------------------------------------------------------
// Worker factory
// ----------------------------------------------------------------

export function createReportWorker(
  connection: ConnectionOptions,
  logger: Logger,
  emailQueue: Queue,
): Worker {
  const worker = new Worker(
    REPORT_QUEUE_NAME,
    async (job: Job) => {
      await processReportJob(job, logger, emailQueue);
    },
    {
      connection,
      concurrency: 2,
      limiter: {
        max: 5,
        duration: 60_000,
      },
    },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'Report job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, err: err.message },
      'Report job failed',
    );
  });

  return worker;
}
