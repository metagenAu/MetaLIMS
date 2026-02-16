import { prisma } from '@labflow/db';
import type { ReportType, ReportStatus } from '@labflow/db';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from '../utils/errors';

// ============================================================
// Helpers
// ============================================================

/**
 * Generates the next sequential report number for an organisation.
 * Format: RPT-{YEAR}-{ZERO_PADDED_SEQ}  e.g. RPT-2026-000007
 */
async function generateReportNumber(
  orgId: string,
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<string> {
  const year = new Date().getFullYear();

  const sequence = await tx.sequence.upsert({
    where: {
      organizationId_entityType_year: {
        organizationId: orgId,
        entityType: 'REPORT',
        year,
      },
    },
    update: { currentValue: { increment: 1 } },
    create: {
      organizationId: orgId,
      entityType: 'REPORT',
      year,
      currentValue: 1,
    },
  });

  return `RPT-${year}-${String(sequence.currentValue).padStart(6, '0')}`;
}

/** Valid report status transitions. */
const REPORT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['GENERATED'],
  GENERATED: ['IN_REVIEW'],
  IN_REVIEW: ['APPROVED', 'DRAFT'],
  APPROVED: ['SENT'],
  SENT: ['VIEWED', 'AMENDED'],
  VIEWED: ['AMENDED'],
};

function validateReportTransition(current: string, target: string): void {
  const allowed = REPORT_TRANSITIONS[current];
  if (!allowed || !allowed.includes(target)) {
    throw new ConflictError(
      `Cannot transition report from '${current}' to '${target}'`,
      {
        currentStatus: current,
        targetStatus: target,
        allowedTargets: allowed ?? [],
      },
    );
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Creates a report record for an order, optionally attaching a template,
 * and queues PDF generation. The report starts in DRAFT status and moves
 * to GENERATED once the PDF is produced (handled asynchronously by a
 * background job).
 *
 * @param orderId - The order to generate a report for
 * @param templateId - Optional report template ID
 * @param type - Report type (COA, PARTIAL, SUMMARY, etc.)
 * @returns The newly created report record
 */
export async function generateReport(
  orderId: string,
  templateId?: string,
  type: ReportType = 'COA',
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      organizationId: true,
      orderNumber: true,
      status: true,
    },
  });

  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  // Only allow reporting on approved or later orders
  const reportableStatuses = new Set([
    'APPROVED',
    'REPORTED',
    'COMPLETED',
  ]);
  if (!reportableStatuses.has(order.status)) {
    throw new ConflictError(
      `Cannot generate report for order in status '${order.status}'. Order must be approved first.`,
    );
  }

  // Validate template if provided
  if (templateId) {
    const template = await prisma.reportTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, organizationId: true, isActive: true },
    });
    if (!template || template.organizationId !== order.organizationId) {
      throw new NotFoundError('ReportTemplate', templateId);
    }
    if (!template.isActive) {
      throw new ValidationError('Report template is not active');
    }
  }

  return prisma.$transaction(async (tx) => {
    const reportNumber = await generateReportNumber(
      order.organizationId,
      tx,
    );

    const report = await tx.report.create({
      data: {
        organizationId: order.organizationId,
        orderId: order.id,
        reportNumber,
        type,
        status: 'DRAFT',
        templateId: templateId ?? null,
        version: 1,
        isAmended: false,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: order.organizationId,
        entityType: 'REPORT',
        entityId: report.id,
        action: 'CREATED',
        changes: {
          reportNumber,
          orderId: order.id,
          type,
          templateId: templateId ?? null,
        },
      },
    });

    // In a real system, the PDF generation would be enqueued here.
    // The background job would later call updateReportStatus(reportId, 'GENERATED')
    // after the PDF is rendered and uploaded.

    return report;
  });
}

/**
 * Approves a report that is currently in IN_REVIEW status.
 * The approver's signature is recorded, and the report advances to APPROVED.
 *
 * @param reportId - ID of the report to approve
 * @param userId - ID of the approving user
 * @returns The updated report record
 */
export async function approveReport(reportId: string, userId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      organizationId: true,
      status: true,
    },
  });

  if (!report) {
    throw new NotFoundError('Report', reportId);
  }

  validateReportTransition(report.status, 'APPROVED');

  // Verify the user has an approval role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true, signatureUrl: true },
  });

  if (!user || !user.isActive) {
    throw new NotFoundError('User', userId);
  }

  const approverRoles = new Set(['LAB_DIRECTOR', 'LAB_MANAGER']);
  if (!approverRoles.has(user.role)) {
    throw new ForbiddenError(
      `User role '${user.role}' is not authorized to approve reports`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.report.update({
      where: { id: reportId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
        signatureUrl: user.signatureUrl ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: report.organizationId,
        userId,
        entityType: 'REPORT',
        entityId: reportId,
        action: 'APPROVED',
        changes: {
          previousStatus: report.status,
          newStatus: 'APPROVED',
        },
      },
    });

    return updated;
  });
}

/**
 * Marks a report as sent and records the recipient email addresses.
 * The actual email delivery is handled by a background job that picks up
 * reports in SENT status with non-empty sentToEmails.
 *
 * @param reportId - ID of the report to send
 * @param emails - Array of email addresses to deliver the report to
 * @returns The updated report record
 */
export async function sendReport(reportId: string, emails: string[]) {
  if (!emails || emails.length === 0) {
    throw new ValidationError(
      'At least one email address is required to send a report',
    );
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmails = emails.filter((e) => !emailRegex.test(e));
  if (invalidEmails.length > 0) {
    throw new ValidationError(
      `Invalid email address(es): ${invalidEmails.join(', ')}`,
    );
  }

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      organizationId: true,
      orderId: true,
      status: true,
      reportNumber: true,
    },
  });

  if (!report) {
    throw new NotFoundError('Report', reportId);
  }

  validateReportTransition(report.status, 'SENT');

  return prisma.$transaction(async (tx) => {
    const now = new Date();

    const updated = await tx.report.update({
      where: { id: reportId },
      data: {
        status: 'SENT',
        sentAt: now,
        sentToEmails: emails,
      },
    });

    // Also update the parent order status to REPORTED if not already
    const order = await tx.order.findUnique({
      where: { id: report.orderId },
      select: { id: true, status: true },
    });

    if (order && order.status === 'APPROVED') {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'REPORTED' },
      });
    }

    await tx.auditLog.create({
      data: {
        organizationId: report.organizationId,
        entityType: 'REPORT',
        entityId: reportId,
        action: 'SENT',
        changes: {
          previousStatus: report.status,
          newStatus: 'SENT',
          sentToEmails: emails,
          sentAt: now.toISOString(),
        },
      },
    });

    return updated;
  });
}

/**
 * Creates an amended version of a previously sent/viewed report.
 * The original report is marked as AMENDED, and a new report record is
 * created with an incremented version number and the amendment reason.
 *
 * @param reportId - ID of the original report to amend
 * @param reason - Explanation for the amendment (required for compliance)
 * @returns The newly created amended report record
 */
export async function amendReport(reportId: string, reason: string) {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationError('Amendment reason is required');
  }

  const original = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      organizationId: true,
      orderId: true,
      reportNumber: true,
      type: true,
      status: true,
      templateId: true,
      version: true,
    },
  });

  if (!original) {
    throw new NotFoundError('Report', reportId);
  }

  // Only sent or viewed reports can be amended
  const amendableStatuses = new Set(['SENT', 'VIEWED']);
  if (!amendableStatuses.has(original.status)) {
    throw new ConflictError(
      `Cannot amend report in status '${original.status}'. Only sent or viewed reports can be amended.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    // Mark the original as amended
    await tx.report.update({
      where: { id: reportId },
      data: {
        status: 'AMENDED',
        isAmended: true,
      },
    });

    const reportNumber = await generateReportNumber(
      original.organizationId,
      tx,
    );

    // Create the new amended version
    const amendedReport = await tx.report.create({
      data: {
        organizationId: original.organizationId,
        orderId: original.orderId,
        reportNumber,
        type: 'AMENDED',
        status: 'DRAFT',
        templateId: original.templateId,
        version: original.version + 1,
        previousVersionId: original.id,
        isAmended: false,
        amendmentReason: reason.trim(),
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: original.organizationId,
        entityType: 'REPORT',
        entityId: amendedReport.id,
        action: 'AMENDMENT_CREATED',
        changes: {
          originalReportId: original.id,
          originalReportNumber: original.reportNumber,
          newReportNumber: reportNumber,
          previousVersion: original.version,
          newVersion: original.version + 1,
          reason: reason.trim(),
        },
      },
    });

    return amendedReport;
  });
}
