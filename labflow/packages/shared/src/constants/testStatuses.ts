// ============================================================
// Test Status Constants & Allowed Transitions
// ============================================================

import type { TestStatus } from '../types/test';

export interface TestStatusInfo {
  value: TestStatus;
  label: string;
  description: string;
  color: string;
  isFinal: boolean;
}

export const TEST_STATUS_INFO: Record<TestStatus, TestStatusInfo> = {
  PENDING: {
    value: 'PENDING',
    label: 'Pending',
    description: 'Test has been created but not yet assigned to an analyst',
    color: '#6B7280',
    isFinal: false,
  },
  ASSIGNED: {
    value: 'ASSIGNED',
    label: 'Assigned',
    description: 'Test has been assigned to an analyst but work has not started',
    color: '#3B82F6',
    isFinal: false,
  },
  IN_PROGRESS: {
    value: 'IN_PROGRESS',
    label: 'In Progress',
    description: 'Analyst is actively performing the test',
    color: '#F59E0B',
    isFinal: false,
  },
  COMPLETED: {
    value: 'COMPLETED',
    label: 'Completed',
    description: 'Test has been completed and results entered',
    color: '#10B981',
    isFinal: false,
  },
  IN_REVIEW: {
    value: 'IN_REVIEW',
    label: 'In Review',
    description: 'Results are being reviewed by a senior analyst or manager',
    color: '#8B5CF6',
    isFinal: false,
  },
  REVIEW_REJECTED: {
    value: 'REVIEW_REJECTED',
    label: 'Review Rejected',
    description: 'Reviewer has rejected the results and sent them back for correction',
    color: '#EF4444',
    isFinal: false,
  },
  APPROVED: {
    value: 'APPROVED',
    label: 'Approved',
    description: 'Results have been approved and are ready for reporting',
    color: '#059669',
    isFinal: true,
  },
  CANCELLED: {
    value: 'CANCELLED',
    label: 'Cancelled',
    description: 'Test has been cancelled and will not be performed',
    color: '#6B7280',
    isFinal: true,
  },
  ON_HOLD: {
    value: 'ON_HOLD',
    label: 'On Hold',
    description: 'Test is temporarily paused pending resolution of an issue',
    color: '#EF4444',
    isFinal: false,
  },
};

/**
 * Maps each test status to the set of statuses it can transition to.
 * Used for enforcing valid workflow transitions.
 */
export const TEST_STATUS_TRANSITIONS: Record<TestStatus, TestStatus[]> = {
  PENDING: ['ASSIGNED', 'CANCELLED', 'ON_HOLD'],
  ASSIGNED: ['IN_PROGRESS', 'PENDING', 'CANCELLED', 'ON_HOLD'],
  IN_PROGRESS: ['COMPLETED', 'ON_HOLD', 'CANCELLED'],
  COMPLETED: ['IN_REVIEW', 'IN_PROGRESS', 'ON_HOLD'],
  IN_REVIEW: ['APPROVED', 'REVIEW_REJECTED', 'ON_HOLD'],
  REVIEW_REJECTED: ['IN_PROGRESS', 'CANCELLED', 'ON_HOLD'],
  APPROVED: [],
  CANCELLED: [],
  ON_HOLD: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'IN_REVIEW', 'CANCELLED'],
};

/**
 * Returns true if transitioning from `from` to `to` is a valid test status transition.
 */
export function isValidTestTransition(from: TestStatus, to: TestStatus): boolean {
  const allowed = TEST_STATUS_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Returns the list of statuses a test can transition to from its current status.
 */
export function getAvailableTestTransitions(current: TestStatus): TestStatus[] {
  return TEST_STATUS_TRANSITIONS[current];
}

/**
 * Returns all test statuses that represent active (non-final) states.
 */
export function getActiveTestStatuses(): TestStatus[] {
  return (Object.keys(TEST_STATUS_INFO) as TestStatus[]).filter(
    (status) => !TEST_STATUS_INFO[status].isFinal
  );
}

/**
 * Returns all test statuses that represent terminal (final) states.
 */
export function getFinalTestStatuses(): TestStatus[] {
  return (Object.keys(TEST_STATUS_INFO) as TestStatus[]).filter(
    (status) => TEST_STATUS_INFO[status].isFinal
  );
}

/**
 * Returns true if the given test status requires a review step before approval.
 */
export function requiresReview(status: TestStatus): boolean {
  return status === 'COMPLETED';
}

/**
 * Returns the minimum role level needed to transition a test to the given status.
 * Useful for authorization checks.
 */
export function getRequiredRoleForTransition(
  targetStatus: TestStatus
): string[] {
  switch (targetStatus) {
    case 'ASSIGNED':
      return ['LAB_MANAGER', 'LAB_DIRECTOR', 'SUPER_ADMIN'];
    case 'IN_PROGRESS':
      return ['ANALYST', 'SENIOR_ANALYST', 'LAB_MANAGER', 'LAB_DIRECTOR', 'SUPER_ADMIN'];
    case 'COMPLETED':
      return ['ANALYST', 'SENIOR_ANALYST', 'LAB_MANAGER', 'LAB_DIRECTOR', 'SUPER_ADMIN'];
    case 'IN_REVIEW':
      return ['ANALYST', 'SENIOR_ANALYST', 'LAB_MANAGER', 'LAB_DIRECTOR', 'SUPER_ADMIN'];
    case 'APPROVED':
      return ['SENIOR_ANALYST', 'LAB_MANAGER', 'LAB_DIRECTOR', 'SUPER_ADMIN'];
    case 'REVIEW_REJECTED':
      return ['SENIOR_ANALYST', 'LAB_MANAGER', 'LAB_DIRECTOR', 'SUPER_ADMIN'];
    case 'CANCELLED':
      return ['LAB_MANAGER', 'LAB_DIRECTOR', 'SUPER_ADMIN'];
    case 'ON_HOLD':
      return ['LAB_MANAGER', 'LAB_DIRECTOR', 'SUPER_ADMIN'];
    case 'PENDING':
      return ['LAB_MANAGER', 'LAB_DIRECTOR', 'SUPER_ADMIN'];
    default:
      return ['SUPER_ADMIN'];
  }
}
