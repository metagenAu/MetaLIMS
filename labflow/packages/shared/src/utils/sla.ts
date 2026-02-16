// ============================================================
// SLA / Due Date Calculators
// ============================================================

import type { Priority } from '../types/sample';
import type { PaymentTerms } from '../types/invoice';
import { getPaymentTermDays } from '../constants/invoiceStatuses';

/**
 * Default turnaround days by priority level.
 * These can be overridden by test method or client configuration.
 */
export const DEFAULT_TURNAROUND_DAYS: Record<Priority, number> = {
  LOW: 10,
  NORMAL: 5,
  HIGH: 3,
  RUSH: 1,
  EMERGENCY: 0,
};

/**
 * Rush surcharge percentages by priority level (default values).
 */
export const DEFAULT_RUSH_SURCHARGE_PERCENT: Record<Priority, number> = {
  LOW: 0,
  NORMAL: 0,
  HIGH: 0,
  RUSH: 50,
  EMERGENCY: 100,
};

/**
 * Adds a number of business days to a given date, skipping weekends.
 * Does not account for holidays.
 *
 * @param startDate - The start date
 * @param businessDays - Number of business days to add (can be 0)
 * @returns The resulting date after adding business days
 */
export function addBusinessDays(startDate: Date, businessDays: number): Date {
  const result = new Date(startDate);
  let daysAdded = 0;

  if (businessDays === 0) {
    return result;
  }

  while (daysAdded < businessDays) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }

  return result;
}

/**
 * Adds calendar days to a date.
 *
 * @param startDate - The start date
 * @param days - Number of calendar days to add
 * @returns The resulting date
 */
export function addCalendarDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculates the due date for an order based on priority and turnaround days.
 *
 * @param receivedDate - The date the order was received
 * @param priority - The order priority
 * @param turnaroundDaysOverride - Optional custom turnaround days (overrides default)
 * @param useBusinessDays - Whether to count business days only (default: true)
 * @returns The calculated due date
 */
export function calculateOrderDueDate(
  receivedDate: Date,
  priority: Priority,
  turnaroundDaysOverride?: number | null,
  useBusinessDays: boolean = true
): Date {
  const turnaroundDays = turnaroundDaysOverride ?? DEFAULT_TURNAROUND_DAYS[priority];

  if (useBusinessDays) {
    return addBusinessDays(receivedDate, turnaroundDays);
  }
  return addCalendarDays(receivedDate, turnaroundDays);
}

/**
 * Calculates the due date for an invoice based on payment terms and issue date.
 *
 * @param issueDate - The date the invoice was issued
 * @param paymentTerms - The payment terms
 * @param customDays - Custom number of days (used when paymentTerms is CUSTOM)
 * @returns The calculated due date
 */
export function calculateInvoiceDueDate(
  issueDate: Date,
  paymentTerms: PaymentTerms,
  customDays?: number
): Date {
  const days = paymentTerms === 'CUSTOM' && customDays != null
    ? customDays
    : getPaymentTermDays(paymentTerms);
  return addCalendarDays(issueDate, days);
}

/**
 * Calculates the number of business days between two dates.
 *
 * @param startDate - The start date
 * @param endDate - The end date
 * @returns Number of business days between the two dates
 */
export function getBusinessDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normalize to start of day
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (end <= start) {
    return 0;
  }

  let count = 0;
  const current = new Date(start);

  while (current < end) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }

  return count;
}

/**
 * Calculates how many days past due an item is.
 *
 * @param dueDate - The due date
 * @param currentDate - The current date (defaults to now)
 * @returns Number of days past due (0 if not overdue)
 */
export function getDaysPastDue(dueDate: Date, currentDate?: Date): number {
  const now = currentDate ?? new Date();
  const due = new Date(dueDate);

  // Normalize to start of day
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  if (now <= due) {
    return 0;
  }

  const diffMs = now.getTime() - due.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculates the number of days remaining until a due date.
 *
 * @param dueDate - The due date
 * @param currentDate - The current date (defaults to now)
 * @returns Number of days remaining (negative if overdue)
 */
export function getDaysRemaining(dueDate: Date, currentDate?: Date): number {
  const now = currentDate ?? new Date();
  const due = new Date(dueDate);

  // Normalize to start of day
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determines the urgency level based on days remaining and turnaround time.
 *
 * @param dueDate - The due date
 * @param currentDate - The current date (defaults to now)
 * @returns Urgency level: 'overdue', 'critical', 'warning', 'normal'
 */
export function getUrgencyLevel(
  dueDate: Date,
  currentDate?: Date
): 'overdue' | 'critical' | 'warning' | 'normal' {
  const daysRemaining = getDaysRemaining(dueDate, currentDate);

  if (daysRemaining < 0) {
    return 'overdue';
  }
  if (daysRemaining === 0) {
    return 'critical';
  }
  if (daysRemaining <= 2) {
    return 'warning';
  }
  return 'normal';
}

/**
 * Determines the color code for an urgency level (for UI display).
 *
 * @param urgency - The urgency level
 * @returns Hex color code
 */
export function getUrgencyColor(
  urgency: 'overdue' | 'critical' | 'warning' | 'normal'
): string {
  switch (urgency) {
    case 'overdue':
      return '#DC2626';
    case 'critical':
      return '#EF4444';
    case 'warning':
      return '#F59E0B';
    case 'normal':
      return '#10B981';
  }
}

/**
 * Checks if a sample's hold time has been exceeded.
 * Hold time is the maximum number of hours a sample can be stored
 * before it must be analyzed.
 *
 * @param receivedDate - The date the sample was received
 * @param holdTimeHours - Maximum hold time in hours
 * @param currentDate - The current date (defaults to now)
 * @returns Object with isExceeded flag and remaining/exceeded hours
 */
export function checkHoldTime(
  receivedDate: Date,
  holdTimeHours: number,
  currentDate?: Date
): { isExceeded: boolean; hoursRemaining: number; hoursElapsed: number } {
  const now = currentDate ?? new Date();
  const received = new Date(receivedDate);

  const elapsedMs = now.getTime() - received.getTime();
  const hoursElapsed = elapsedMs / (1000 * 60 * 60);
  const hoursRemaining = holdTimeHours - hoursElapsed;

  return {
    isExceeded: hoursElapsed > holdTimeHours,
    hoursRemaining: Math.max(0, hoursRemaining),
    hoursElapsed: Math.max(0, hoursElapsed),
  };
}

/**
 * Calculates the expected completion date for a test based on method turnaround.
 *
 * @param startDate - When the test was started
 * @param turnaroundDays - Method-specific turnaround days
 * @param priority - Priority level (rush/emergency may override)
 * @param rushTurnaroundDays - Optional rush turnaround days for the method
 * @returns Expected completion date
 */
export function calculateTestDueDate(
  startDate: Date,
  turnaroundDays: number,
  priority: Priority,
  rushTurnaroundDays?: number | null
): Date {
  let days: number;

  if ((priority === 'RUSH' || priority === 'EMERGENCY') && rushTurnaroundDays != null) {
    days = rushTurnaroundDays;
  } else {
    days = turnaroundDays;
  }

  return addBusinessDays(startDate, days);
}

/**
 * Generates a summary of SLA metrics for a set of orders.
 *
 * @param orders - Array of orders with due dates and completion dates
 * @returns SLA performance summary
 */
export function calculateSLAMetrics(
  orders: Array<{
    dueDate: Date | null;
    completedDate: Date | null;
    status: string;
  }>
): {
  totalOrders: number;
  completedOnTime: number;
  completedLate: number;
  pendingOnTrack: number;
  pendingAtRisk: number;
  pendingOverdue: number;
  onTimePercentage: number;
} {
  let completedOnTime = 0;
  let completedLate = 0;
  let pendingOnTrack = 0;
  let pendingAtRisk = 0;
  let pendingOverdue = 0;

  const now = new Date();

  for (const order of orders) {
    if (order.dueDate == null) {
      continue;
    }

    if (order.completedDate != null) {
      // Completed order: check if it was on time
      const due = new Date(order.dueDate);
      const completed = new Date(order.completedDate);
      due.setHours(23, 59, 59, 999);

      if (completed <= due) {
        completedOnTime++;
      } else {
        completedLate++;
      }
    } else if (
      order.status !== 'CANCELLED' &&
      order.status !== 'COMPLETED'
    ) {
      // Pending order: check urgency
      const urgency = getUrgencyLevel(order.dueDate, now);
      if (urgency === 'overdue') {
        pendingOverdue++;
      } else if (urgency === 'critical' || urgency === 'warning') {
        pendingAtRisk++;
      } else {
        pendingOnTrack++;
      }
    }
  }

  const totalCompleted = completedOnTime + completedLate;
  const onTimePercentage =
    totalCompleted > 0
      ? Math.round((completedOnTime / totalCompleted) * 1000) / 10
      : 100;

  return {
    totalOrders: orders.length,
    completedOnTime,
    completedLate,
    pendingOnTrack,
    pendingAtRisk,
    pendingOverdue,
    onTimePercentage,
  };
}
