// ============================================================
// Sample Status Constants & Allowed Transitions
// ============================================================

import type { SampleStatus } from '../types/sample';

export interface StatusInfo {
  value: SampleStatus;
  label: string;
  description: string;
  color: string;
  isFinal: boolean;
}

export const SAMPLE_STATUS_INFO: Record<SampleStatus, StatusInfo> = {
  REGISTERED: {
    value: 'REGISTERED',
    label: 'Registered',
    description: 'Sample has been logged into the system but not yet physically received',
    color: '#6B7280',
    isFinal: false,
  },
  RECEIVED: {
    value: 'RECEIVED',
    label: 'Received',
    description: 'Sample has been physically received and inspected',
    color: '#3B82F6',
    isFinal: false,
  },
  IN_STORAGE: {
    value: 'IN_STORAGE',
    label: 'In Storage',
    description: 'Sample has been placed in a designated storage location',
    color: '#8B5CF6',
    isFinal: false,
  },
  IN_PROGRESS: {
    value: 'IN_PROGRESS',
    label: 'In Progress',
    description: 'Testing is actively being performed on the sample',
    color: '#F59E0B',
    isFinal: false,
  },
  TESTING_COMPLETE: {
    value: 'TESTING_COMPLETE',
    label: 'Testing Complete',
    description: 'All assigned tests have been completed',
    color: '#10B981',
    isFinal: false,
  },
  APPROVED: {
    value: 'APPROVED',
    label: 'Approved',
    description: 'All results have been reviewed and approved',
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
  ON_HOLD: {
    value: 'ON_HOLD',
    label: 'On Hold',
    description: 'Sample processing is temporarily paused',
    color: '#EF4444',
    isFinal: false,
  },
  DISPOSED: {
    value: 'DISPOSED',
    label: 'Disposed',
    description: 'Sample has been disposed of according to protocol',
    color: '#9CA3AF',
    isFinal: true,
  },
  REJECTED: {
    value: 'REJECTED',
    label: 'Rejected',
    description: 'Sample was rejected due to quality or compliance issues',
    color: '#DC2626',
    isFinal: true,
  },
  CANCELLED: {
    value: 'CANCELLED',
    label: 'Cancelled',
    description: 'Sample processing was cancelled',
    color: '#6B7280',
    isFinal: true,
  },
};

/**
 * Maps each sample status to the set of statuses it can transition to.
 * Used for enforcing valid workflow transitions.
 */
export const SAMPLE_STATUS_TRANSITIONS: Record<SampleStatus, SampleStatus[]> = {
  REGISTERED: ['RECEIVED', 'REJECTED', 'CANCELLED'],
  RECEIVED: ['IN_STORAGE', 'IN_PROGRESS', 'ON_HOLD', 'REJECTED', 'CANCELLED'],
  IN_STORAGE: ['IN_PROGRESS', 'ON_HOLD', 'DISPOSED', 'CANCELLED'],
  IN_PROGRESS: ['TESTING_COMPLETE', 'ON_HOLD', 'CANCELLED'],
  TESTING_COMPLETE: ['APPROVED', 'IN_PROGRESS', 'ON_HOLD'],
  APPROVED: ['REPORTED', 'ON_HOLD'],
  REPORTED: ['DISPOSED'],
  ON_HOLD: ['RECEIVED', 'IN_STORAGE', 'IN_PROGRESS', 'TESTING_COMPLETE', 'CANCELLED'],
  DISPOSED: [],
  REJECTED: [],
  CANCELLED: [],
};

/**
 * Returns true if transitioning from `from` to `to` is a valid sample status transition.
 */
export function isValidSampleTransition(from: SampleStatus, to: SampleStatus): boolean {
  const allowed = SAMPLE_STATUS_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Returns the list of statuses a sample can transition to from its current status.
 */
export function getAvailableSampleTransitions(current: SampleStatus): SampleStatus[] {
  return SAMPLE_STATUS_TRANSITIONS[current];
}

/**
 * Returns all sample statuses that represent active (non-final) states.
 */
export function getActiveSampleStatuses(): SampleStatus[] {
  return (Object.keys(SAMPLE_STATUS_INFO) as SampleStatus[]).filter(
    (status) => !SAMPLE_STATUS_INFO[status].isFinal
  );
}

/**
 * Returns all sample statuses that represent terminal (final) states.
 */
export function getFinalSampleStatuses(): SampleStatus[] {
  return (Object.keys(SAMPLE_STATUS_INFO) as SampleStatus[]).filter(
    (status) => SAMPLE_STATUS_INFO[status].isFinal
  );
}
