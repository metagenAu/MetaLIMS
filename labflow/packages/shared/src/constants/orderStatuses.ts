// ============================================================
// Order Status Constants & Allowed Transitions
// ============================================================

import type { OrderStatus } from '../types/order';

export interface OrderStatusInfo {
  value: OrderStatus;
  label: string;
  description: string;
  color: string;
  isFinal: boolean;
}

export const ORDER_STATUS_INFO: Record<OrderStatus, OrderStatusInfo> = {
  DRAFT: {
    value: 'DRAFT',
    label: 'Draft',
    description: 'Order has been created but not yet submitted',
    color: '#6B7280',
    isFinal: false,
  },
  SUBMITTED: {
    value: 'SUBMITTED',
    label: 'Submitted',
    description: 'Order has been submitted for processing',
    color: '#3B82F6',
    isFinal: false,
  },
  RECEIVED: {
    value: 'RECEIVED',
    label: 'Received',
    description: 'Samples for this order have been received',
    color: '#8B5CF6',
    isFinal: false,
  },
  IN_PROGRESS: {
    value: 'IN_PROGRESS',
    label: 'In Progress',
    description: 'Testing is actively being performed',
    color: '#F59E0B',
    isFinal: false,
  },
  TESTING_COMPLETE: {
    value: 'TESTING_COMPLETE',
    label: 'Testing Complete',
    description: 'All tests have been completed',
    color: '#10B981',
    isFinal: false,
  },
  IN_REVIEW: {
    value: 'IN_REVIEW',
    label: 'In Review',
    description: 'Results are being reviewed',
    color: '#8B5CF6',
    isFinal: false,
  },
  APPROVED: {
    value: 'APPROVED',
    label: 'Approved',
    description: 'All results have been approved',
    color: '#059669',
    isFinal: false,
  },
  REPORTED: {
    value: 'REPORTED',
    label: 'Reported',
    description: 'Results have been reported to the client',
    color: '#047857',
    isFinal: false,
  },
  COMPLETED: {
    value: 'COMPLETED',
    label: 'Completed',
    description: 'Order is fully completed',
    color: '#065F46',
    isFinal: true,
  },
  ON_HOLD: {
    value: 'ON_HOLD',
    label: 'On Hold',
    description: 'Order processing is temporarily paused',
    color: '#EF4444',
    isFinal: false,
  },
  CANCELLED: {
    value: 'CANCELLED',
    label: 'Cancelled',
    description: 'Order has been cancelled',
    color: '#6B7280',
    isFinal: true,
  },
};

/**
 * Maps each order status to the set of statuses it can transition to.
 * This is the single source of truth for order workflow transitions.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['RECEIVED', 'ON_HOLD', 'CANCELLED'],
  RECEIVED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['TESTING_COMPLETE', 'ON_HOLD'],
  TESTING_COMPLETE: ['IN_REVIEW', 'ON_HOLD'],
  IN_REVIEW: ['APPROVED', 'ON_HOLD'],
  APPROVED: ['REPORTED'],
  REPORTED: ['COMPLETED'],
  ON_HOLD: ['SUBMITTED', 'RECEIVED', 'IN_PROGRESS', 'TESTING_COMPLETE', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Returns true if transitioning from `from` to `to` is a valid order status transition.
 */
export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = ORDER_STATUS_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Returns the list of statuses an order can transition to from its current status.
 */
export function getAvailableOrderTransitions(current: OrderStatus): OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[current];
}

/**
 * Returns all order statuses that represent active (non-final) states.
 */
export function getActiveOrderStatuses(): OrderStatus[] {
  return (Object.keys(ORDER_STATUS_INFO) as OrderStatus[]).filter(
    (status) => !ORDER_STATUS_INFO[status].isFinal
  );
}

/**
 * Returns all order statuses that represent terminal (final) states.
 */
export function getFinalOrderStatuses(): OrderStatus[] {
  return (Object.keys(ORDER_STATUS_INFO) as OrderStatus[]).filter(
    (status) => ORDER_STATUS_INFO[status].isFinal
  );
}
