// ============================================================
// Test Types & Interfaces
// ============================================================

import type { Priority } from './sample';

export const TestStatus = {
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  IN_REVIEW: 'IN_REVIEW',
  REVIEW_REJECTED: 'REVIEW_REJECTED',
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
  ON_HOLD: 'ON_HOLD',
} as const;

export type TestStatus = (typeof TestStatus)[keyof typeof TestStatus];

export const OverallResult = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  INCONCLUSIVE: 'INCONCLUSIVE',
  NOT_DETECTED: 'NOT_DETECTED',
  DETECTED: 'DETECTED',
} as const;

export type OverallResult = (typeof OverallResult)[keyof typeof OverallResult];

export const PassStatus = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  WARNING: 'WARNING',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const;

export type PassStatus = (typeof PassStatus)[keyof typeof PassStatus];

export const LimitType = {
  MAXIMUM: 'MAXIMUM',
  MINIMUM: 'MINIMUM',
  RANGE: 'RANGE',
  EXACT: 'EXACT',
  INFORMATIONAL: 'INFORMATIONAL',
} as const;

export type LimitType = (typeof LimitType)[keyof typeof LimitType];

export interface Test {
  id: string;
  sampleId: string;
  testMethodId: string;
  status: TestStatus;
  priority: Priority;
  assignedToId: string | null;
  assignedDate: Date | null;
  startedDate: Date | null;
  completedDate: Date | null;
  instrumentId: string | null;
  batchId: string | null;
  reviewedById: string | null;
  reviewedDate: Date | null;
  reviewNotes: string | null;
  approvedById: string | null;
  approvedDate: Date | null;
  approvalNotes: string | null;
  overallResult: OverallResult | null;
  notes: string | null;
  internalNotes: string | null;
  deviations: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestResult {
  id: string;
  testId: string;
  analyteId: string;
  rawValue: string | null;
  finalValue: string | null;
  numericValue: number | null;
  unit: string | null;
  qualifier: string | null;
  isDetected: boolean | null;
  specificationId: string | null;
  passStatus: PassStatus | null;
  specMin: number | null;
  specMax: number | null;
  specTarget: number | null;
  dilutionFactor: number | null;
  recoveryPercent: number | null;
  rpdPercent: number | null;
  notes: string | null;
  enteredById: string | null;
  enteredAt: Date;
  modifiedAt: Date;
}

export interface TestMethod {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  methodology: string | null;
  sampleMatrices: string[];
  minimumSampleSize: number | null;
  sampleSizeUnit: string | null;
  holdTime: number | null;
  defaultTurnaroundDays: number;
  rushAvailable: boolean;
  rushTurnaroundDays: number | null;
  requiresCalibration: boolean;
  qcRequirements: Record<string, unknown>;
  accreditedMethod: boolean;
  accreditationScope: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestAnalyte {
  id: string;
  testMethodId: string;
  name: string;
  code: string;
  unit: string;
  decimalPlaces: number;
  reportingLimit: number | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Specification {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description: string | null;
  regulatoryBody: string | null;
  effectiveDate: Date | null;
  expirationDate: Date | null;
  isActive: boolean;
  testMethodId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpecificationLimit {
  id: string;
  specificationId: string;
  analyteId: string;
  limitType: LimitType;
  minValue: number | null;
  maxValue: number | null;
  targetValue: number | null;
  warningMin: number | null;
  warningMax: number | null;
  unit: string | null;
  actionOnFail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTestInput {
  sampleId: string;
  testMethodId: string;
  priority?: Priority;
  assignedToId?: string | null;
  instrumentId?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
}

export interface UpdateTestInput {
  status?: TestStatus;
  priority?: Priority;
  assignedToId?: string | null;
  instrumentId?: string | null;
  batchId?: string | null;
  overallResult?: OverallResult | null;
  notes?: string | null;
  internalNotes?: string | null;
  deviations?: string | null;
}

export interface AssignTestInput {
  assignedToId: string;
  priority?: Priority;
  notes?: string | null;
}

export interface ReviewTestInput {
  reviewedById: string;
  approved: boolean;
  reviewNotes?: string | null;
}

export interface ApproveTestInput {
  approvedById: string;
  approvalNotes?: string | null;
}

export interface CreateTestResultInput {
  testId: string;
  analyteId: string;
  rawValue?: string | null;
  finalValue?: string | null;
  numericValue?: number | null;
  unit?: string | null;
  qualifier?: string | null;
  isDetected?: boolean | null;
  specificationId?: string | null;
  dilutionFactor?: number | null;
  notes?: string | null;
  enteredById?: string | null;
}

export interface UpdateTestResultInput {
  rawValue?: string | null;
  finalValue?: string | null;
  numericValue?: number | null;
  unit?: string | null;
  qualifier?: string | null;
  isDetected?: boolean | null;
  specificationId?: string | null;
  dilutionFactor?: number | null;
  recoveryPercent?: number | null;
  rpdPercent?: number | null;
  notes?: string | null;
}

export interface TestFilterParams {
  organizationId: string;
  sampleId?: string;
  testMethodId?: string;
  status?: TestStatus | TestStatus[];
  priority?: Priority | Priority[];
  assignedToId?: string;
  instrumentId?: string;
  overallResult?: OverallResult;
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
