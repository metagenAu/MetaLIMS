import { prisma } from '@labflow/db';

// ============================================================
// Types
// ============================================================

/** The delivery channel for the notification. */
type NotificationChannel = 'IN_APP' | 'EMAIL' | 'BOTH';

/** Minimal entity reference to attach to a notification. */
interface EntityRef {
  entityType: string;
  entityId: string;
}

// ============================================================
// Core
// ============================================================

/**
 * Creates an in-app notification for a specific user. When the channel
 * includes EMAIL, the notification is flagged for later pickup by the
 * email delivery job (emailSentAt remains null until processed).
 *
 * @param orgId - Organisation ID
 * @param userId - Target user ID
 * @param type - Notification type (e.g. 'SAMPLE_RECEIVED', 'TEST_APPROVED')
 * @param title - Short human-readable title
 * @param message - Notification body
 * @param entity - Optional entity reference (entityType + entityId)
 * @param channel - Delivery channel: IN_APP, EMAIL, or BOTH (default BOTH)
 * @returns The created notification record
 */
export async function createNotification(
  orgId: string,
  userId: string,
  type: string,
  title: string,
  message: string,
  entity?: EntityRef,
  channel: NotificationChannel = 'BOTH',
) {
  const notification = await prisma.notification.create({
    data: {
      organizationId: orgId,
      userId,
      type,
      title,
      message,
      entityType: entity?.entityType ?? null,
      entityId: entity?.entityId ?? null,
      channel,
      isRead: false,
    },
  });

  return notification;
}

/**
 * Sends a notification to all users that should be notified about an entity
 * within a given organisation, filtered by role.
 */
async function notifyByRoles(
  orgId: string,
  roles: string[],
  type: string,
  title: string,
  message: string,
  entity?: EntityRef,
) {
  const users = await prisma.user.findMany({
    where: {
      organizationId: orgId,
      role: { in: roles as any },
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  const notifications = await Promise.all(
    users.map((u) =>
      createNotification(orgId, u.id, type, title, message, entity),
    ),
  );

  return notifications;
}

// ============================================================
// Domain-specific convenience methods
// ============================================================

/**
 * Notifies relevant lab staff that a sample has been received.
 *
 * @param sample - The received sample (must include organizationId, id, sampleNumber)
 */
export async function notifySampleReceived(sample: {
  organizationId: string;
  id: string;
  sampleNumber: string;
  orderId: string;
}) {
  const title = 'Sample Received';
  const message = `Sample ${sample.sampleNumber} has been received and is ready for processing.`;

  return notifyByRoles(
    sample.organizationId,
    ['LAB_DIRECTOR', 'LAB_MANAGER', 'SENIOR_ANALYST', 'ANALYST', 'SAMPLE_RECEIVER'],
    'SAMPLE_RECEIVED',
    title,
    message,
    { entityType: 'SAMPLE', entityId: sample.id },
  );
}

/**
 * Notifies the assigned analyst and lab managers that a test has been approved.
 *
 * @param test - The approved test (must include id, assignedToId, and sample info)
 */
export async function notifyTestApproved(test: {
  id: string;
  assignedToId: string | null;
  sample: {
    organizationId: string;
    sampleNumber: string;
  };
  testMethod: {
    code: string;
    name: string;
  };
}) {
  const title = 'Test Approved';
  const message = `Test ${test.testMethod.code} (${test.testMethod.name}) for sample ${test.sample.sampleNumber} has been approved.`;
  const entity: EntityRef = { entityType: 'TEST', entityId: test.id };

  const notifications = [];

  // Notify the assigned analyst directly
  if (test.assignedToId) {
    notifications.push(
      createNotification(
        test.sample.organizationId,
        test.assignedToId,
        'TEST_APPROVED',
        title,
        message,
        entity,
      ),
    );
  }

  // Notify lab managers
  const managerNotifs = await notifyByRoles(
    test.sample.organizationId,
    ['LAB_DIRECTOR', 'LAB_MANAGER'],
    'TEST_APPROVED',
    title,
    message,
    entity,
  );
  notifications.push(...managerNotifs);

  return Promise.all(notifications);
}

/**
 * Notifies relevant parties that a report is ready for delivery.
 *
 * @param report - The report record
 */
export async function notifyReportReady(report: {
  id: string;
  organizationId: string;
  reportNumber: string;
  orderId: string;
}) {
  const title = 'Report Ready';
  const message = `Report ${report.reportNumber} has been generated and is ready for review.`;

  return notifyByRoles(
    report.organizationId,
    ['LAB_DIRECTOR', 'LAB_MANAGER'],
    'REPORT_READY',
    title,
    message,
    { entityType: 'REPORT', entityId: report.id },
  );
}

/**
 * Notifies billing staff that an invoice has been sent to the client.
 *
 * @param invoice - The sent invoice
 */
export async function notifyInvoiceSent(invoice: {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  clientId: string;
  total: number | string;
}) {
  const title = 'Invoice Sent';
  const message = `Invoice ${invoice.invoiceNumber} has been sent to the client. Total: $${Number(invoice.total).toFixed(2)}`;

  return notifyByRoles(
    invoice.organizationId,
    ['LAB_DIRECTOR', 'LAB_MANAGER', 'BILLING_ADMIN', 'BILLING_VIEWER'],
    'INVOICE_SENT',
    title,
    message,
    { entityType: 'INVOICE', entityId: invoice.id },
  );
}

/**
 * Notifies billing staff that an invoice is overdue.
 *
 * @param invoice - The overdue invoice
 */
export async function notifyOverdueInvoice(invoice: {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  clientId: string;
  balanceDue: number | string;
  dueDate: Date | null;
}) {
  const dueDateStr = invoice.dueDate
    ? invoice.dueDate.toLocaleDateString()
    : 'N/A';
  const title = 'Invoice Overdue';
  const message = `Invoice ${invoice.invoiceNumber} is overdue (due ${dueDateStr}). Outstanding balance: $${Number(invoice.balanceDue).toFixed(2)}`;

  return notifyByRoles(
    invoice.organizationId,
    ['LAB_DIRECTOR', 'LAB_MANAGER', 'BILLING_ADMIN'],
    'INVOICE_OVERDUE',
    title,
    message,
    { entityType: 'INVOICE', entityId: invoice.id },
  );
}

/**
 * Notifies relevant lab staff that an order's SLA is at risk.
 *
 * @param order - The order at risk
 * @param percentUsed - Percentage of turnaround time that has elapsed (e.g. 85)
 */
export async function notifySLAWarning(
  order: {
    id: string;
    organizationId: string;
    orderNumber: string;
    dueDate: Date | null;
  },
  percentUsed: number,
) {
  const dueDateStr = order.dueDate
    ? order.dueDate.toLocaleDateString()
    : 'N/A';
  const title = 'SLA Warning';
  const message = `Order ${order.orderNumber} has used ${percentUsed.toFixed(0)}% of its turnaround time. Due date: ${dueDateStr}. Immediate attention required.`;

  return notifyByRoles(
    order.organizationId,
    ['LAB_DIRECTOR', 'LAB_MANAGER', 'SENIOR_ANALYST'],
    'SLA_WARNING',
    title,
    message,
    { entityType: 'ORDER', entityId: order.id },
  );
}
