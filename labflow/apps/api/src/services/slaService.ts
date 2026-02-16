import { prisma } from '@labflow/db';
import { NotFoundError } from '../utils/errors';

// ============================================================
// Types
// ============================================================

/** SLA health indicator. */
export type SLALevel = 'ON_TRACK' | 'AT_RISK' | 'BREACHED';

/** Thresholds (percent of turnaround time elapsed) for each SLA level. */
const SLA_AT_RISK_THRESHOLD = 75;
const SLA_BREACHED_THRESHOLD = 100;

/** Result of an SLA calculation for a single order. */
export interface SLAStatus {
  orderId: string;
  orderNumber: string;
  level: SLALevel;
  percentElapsed: number;
  receivedDate: Date | null;
  dueDate: Date | null;
  turnaroundDays: number | null;
  hoursRemaining: number;
  isCompleted: boolean;
}

/** Aggregate SLA metrics for an organisation. */
export interface SLAMetrics {
  organizationId: string;
  dateRange: { from: Date; to: Date };
  totalOrders: number;
  completedOrders: number;
  onTrackOrders: number;
  atRiskOrders: number;
  breachedOrders: number;
  onTimeCompletionRate: number;
  averageCompletionHours: number;
}

// ============================================================
// Public API
// ============================================================

/**
 * Calculates the SLA status for a single order based on its received date,
 * due date, and current progress.
 *
 * Levels:
 *  - ON_TRACK:  less than 75% of turnaround time has elapsed
 *  - AT_RISK:   75%-99% of turnaround time has elapsed
 *  - BREACHED:  100% or more of turnaround time has elapsed (past due)
 *
 * @param order - The order to evaluate (must include receivedDate, dueDate,
 *                turnaroundDays, status, completedDate)
 * @returns The SLA status breakdown for the order
 */
export function calculateSLAStatus(order: {
  id: string;
  orderNumber: string;
  receivedDate: Date | null;
  dueDate: Date | null;
  turnaroundDays: number | null;
  completedDate: Date | null;
  status: string;
}): SLAStatus {
  const isCompleted = ['REPORTED', 'COMPLETED'].includes(order.status);

  // If there is no due date we cannot calculate SLA
  if (!order.dueDate) {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      level: 'ON_TRACK',
      percentElapsed: 0,
      receivedDate: order.receivedDate,
      dueDate: null,
      turnaroundDays: order.turnaroundDays,
      hoursRemaining: Infinity,
      isCompleted,
    };
  }

  const startDate = order.receivedDate ?? new Date();
  const endDate = order.dueDate;

  // Total window in hours
  const totalWindowMs = endDate.getTime() - startDate.getTime();
  const totalWindowHours = totalWindowMs / (1000 * 60 * 60);

  // How much time has elapsed
  const referenceDate = isCompleted && order.completedDate
    ? order.completedDate
    : new Date();
  const elapsedMs = referenceDate.getTime() - startDate.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  // Percent of turnaround window used
  const percentElapsed =
    totalWindowHours > 0
      ? Math.round((elapsedHours / totalWindowHours) * 10000) / 100
      : 0;

  // Hours remaining until due
  const remainingMs = endDate.getTime() - referenceDate.getTime();
  const hoursRemaining = Math.round((remainingMs / (1000 * 60 * 60)) * 100) / 100;

  let level: SLALevel;
  if (percentElapsed >= SLA_BREACHED_THRESHOLD) {
    level = 'BREACHED';
  } else if (percentElapsed >= SLA_AT_RISK_THRESHOLD) {
    level = 'AT_RISK';
  } else {
    level = 'ON_TRACK';
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    level,
    percentElapsed,
    receivedDate: order.receivedDate,
    dueDate: order.dueDate,
    turnaroundDays: order.turnaroundDays,
    hoursRemaining,
    isCompleted,
  };
}

/**
 * Checks the SLA status for all active (non-terminal) orders in an
 * organisation.
 *
 * @param orgId - The organisation ID
 * @returns Array of SLA status objects for every active order
 */
export async function checkAllSLAs(orgId: string): Promise<SLAStatus[]> {
  const activeStatuses = [
    'SUBMITTED',
    'RECEIVED',
    'IN_PROGRESS',
    'TESTING_COMPLETE',
    'IN_REVIEW',
    'APPROVED',
    'ON_HOLD',
  ];

  const orders = await prisma.order.findMany({
    where: {
      organizationId: orgId,
      status: { in: activeStatuses as any },
    },
    select: {
      id: true,
      orderNumber: true,
      receivedDate: true,
      dueDate: true,
      turnaroundDays: true,
      completedDate: true,
      status: true,
    },
    orderBy: { dueDate: 'asc' },
  });

  return orders.map((order) => calculateSLAStatus(order));
}

/**
 * Computes aggregate SLA performance metrics for an organisation within a
 * date range. Includes on-time completion rate, average completion time,
 * and a breakdown by SLA level.
 *
 * @param orgId - The organisation ID
 * @param dateRange - Start and end dates for the reporting period
 * @returns Aggregate SLA metrics
 */
export async function getSLAMetrics(
  orgId: string,
  dateRange: { from: Date; to: Date },
): Promise<SLAMetrics> {
  // Fetch all orders that were received within the date range
  const orders = await prisma.order.findMany({
    where: {
      organizationId: orgId,
      receivedDate: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
    },
    select: {
      id: true,
      orderNumber: true,
      receivedDate: true,
      dueDate: true,
      turnaroundDays: true,
      completedDate: true,
      status: true,
    },
  });

  const totalOrders = orders.length;
  let completedOrders = 0;
  let onTrackOrders = 0;
  let atRiskOrders = 0;
  let breachedOrders = 0;
  let onTimeCompletions = 0;
  let totalCompletionHours = 0;

  for (const order of orders) {
    const sla = calculateSLAStatus(order);

    switch (sla.level) {
      case 'ON_TRACK':
        onTrackOrders += 1;
        break;
      case 'AT_RISK':
        atRiskOrders += 1;
        break;
      case 'BREACHED':
        breachedOrders += 1;
        break;
    }

    if (sla.isCompleted) {
      completedOrders += 1;

      // Calculate actual completion time
      if (order.receivedDate && order.completedDate) {
        const completionMs =
          order.completedDate.getTime() - order.receivedDate.getTime();
        const completionHours = completionMs / (1000 * 60 * 60);
        totalCompletionHours += completionHours;
      }

      // On-time means completed without breaching
      if (sla.percentElapsed < SLA_BREACHED_THRESHOLD) {
        onTimeCompletions += 1;
      }
    }
  }

  const onTimeCompletionRate =
    completedOrders > 0
      ? Math.round((onTimeCompletions / completedOrders) * 10000) / 100
      : 0;

  const averageCompletionHours =
    completedOrders > 0
      ? Math.round((totalCompletionHours / completedOrders) * 100) / 100
      : 0;

  return {
    organizationId: orgId,
    dateRange,
    totalOrders,
    completedOrders,
    onTrackOrders,
    atRiskOrders,
    breachedOrders,
    onTimeCompletionRate,
    averageCompletionHours,
  };
}
