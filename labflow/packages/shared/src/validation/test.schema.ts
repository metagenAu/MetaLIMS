// ============================================================
// Test Zod Validation Schemas
// ============================================================

import { z } from 'zod';
import { PriorityEnum } from './sample.schema';

export const TestStatusEnum = z.enum([
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'IN_REVIEW',
  'REVIEW_REJECTED',
  'APPROVED',
  'CANCELLED',
  'ON_HOLD',
]);

export const OverallResultEnum = z.enum([
  'PASS',
  'FAIL',
  'INCONCLUSIVE',
  'NOT_DETECTED',
  'DETECTED',
]);

export const PassStatusEnum = z.enum([
  'PASS',
  'FAIL',
  'WARNING',
  'NOT_APPLICABLE',
]);

export const LimitTypeEnum = z.enum([
  'MAXIMUM',
  'MINIMUM',
  'RANGE',
  'EXACT',
  'INFORMATIONAL',
]);

export const createTestSchema = z.object({
  sampleId: z.string().uuid(),
  testMethodId: z.string().uuid(),
  priority: PriorityEnum.optional().default('NORMAL'),
  assignedToId: z.string().uuid().nullish(),
  instrumentId: z.string().uuid().nullish(),
  notes: z.string().max(5000).nullish(),
  internalNotes: z.string().max(5000).nullish(),
});

export const updateTestSchema = z.object({
  status: TestStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  assignedToId: z.string().uuid().nullish(),
  instrumentId: z.string().uuid().nullish(),
  batchId: z.string().uuid().nullish(),
  overallResult: OverallResultEnum.nullish(),
  notes: z.string().max(5000).nullish(),
  internalNotes: z.string().max(5000).nullish(),
  deviations: z.string().max(5000).nullish(),
});

export const assignTestSchema = z.object({
  assignedToId: z.string().uuid(),
  priority: PriorityEnum.optional(),
  notes: z.string().max(5000).nullish(),
});

export const reviewTestSchema = z.object({
  reviewedById: z.string().uuid(),
  approved: z.boolean(),
  reviewNotes: z.string().max(5000).nullish(),
});

export const approveTestSchema = z.object({
  approvedById: z.string().uuid(),
  approvalNotes: z.string().max(5000).nullish(),
});

export const createTestResultSchema = z.object({
  testId: z.string().uuid(),
  analyteId: z.string().uuid(),
  rawValue: z.string().max(500).nullish(),
  finalValue: z.string().max(500).nullish(),
  numericValue: z.number().nullish(),
  unit: z.string().max(50).nullish(),
  qualifier: z.string().max(20).nullish(),
  isDetected: z.boolean().nullish(),
  specificationId: z.string().uuid().nullish(),
  dilutionFactor: z.number().positive().nullish(),
  notes: z.string().max(2000).nullish(),
  enteredById: z.string().uuid().nullish(),
});

export const updateTestResultSchema = z.object({
  rawValue: z.string().max(500).nullish(),
  finalValue: z.string().max(500).nullish(),
  numericValue: z.number().nullish(),
  unit: z.string().max(50).nullish(),
  qualifier: z.string().max(20).nullish(),
  isDetected: z.boolean().nullish(),
  specificationId: z.string().uuid().nullish(),
  dilutionFactor: z.number().positive().nullish(),
  recoveryPercent: z.number().min(0).max(200).nullish(),
  rpdPercent: z.number().min(0).max(200).nullish(),
  notes: z.string().max(2000).nullish(),
});

export const testFilterSchema = z.object({
  organizationId: z.string().uuid(),
  sampleId: z.string().uuid().optional(),
  testMethodId: z.string().uuid().optional(),
  status: z.union([TestStatusEnum, z.array(TestStatusEnum)]).optional(),
  priority: z.union([PriorityEnum, z.array(PriorityEnum)]).optional(),
  assignedToId: z.string().uuid().optional(),
  instrumentId: z.string().uuid().optional(),
  overallResult: OverallResultEnum.optional(),
  search: z.string().max(255).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(25),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const createTestMethodSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  category: z.string().max(100).nullish(),
  subcategory: z.string().max(100).nullish(),
  description: z.string().max(2000).nullish(),
  methodology: z.string().max(500).nullish(),
  sampleMatrices: z.array(z.string().max(100)).optional().default([]),
  minimumSampleSize: z.number().positive().nullish(),
  sampleSizeUnit: z.string().max(50).nullish(),
  holdTime: z.number().int().positive().nullish(),
  defaultTurnaroundDays: z.number().int().min(1).max(365).optional().default(5),
  rushAvailable: z.boolean().optional().default(true),
  rushTurnaroundDays: z.number().int().min(1).max(365).nullish(),
  requiresCalibration: z.boolean().optional().default(false),
  qcRequirements: z.record(z.string(), z.unknown()).optional().default({}),
  accreditedMethod: z.boolean().optional().default(false),
  accreditationScope: z.string().max(255).nullish(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const createTestAnalyteSchema = z.object({
  testMethodId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  unit: z.string().min(1).max(50),
  decimalPlaces: z.number().int().min(0).max(10).optional().default(2),
  reportingLimit: z.number().positive().nullish(),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const createSpecificationSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().max(2000).nullish(),
  regulatoryBody: z.string().max(255).nullish(),
  effectiveDate: z.coerce.date().nullish(),
  expirationDate: z.coerce.date().nullish(),
  testMethodId: z.string().uuid(),
  isActive: z.boolean().optional().default(true),
});

export const createSpecificationLimitSchema = z.object({
  specificationId: z.string().uuid(),
  analyteId: z.string().uuid(),
  limitType: LimitTypeEnum,
  minValue: z.number().nullish(),
  maxValue: z.number().nullish(),
  targetValue: z.number().nullish(),
  warningMin: z.number().nullish(),
  warningMax: z.number().nullish(),
  unit: z.string().max(50).nullish(),
  actionOnFail: z.string().max(500).nullish(),
}).refine(
  (data) => {
    if (data.limitType === 'RANGE') {
      return data.minValue != null && data.maxValue != null;
    }
    if (data.limitType === 'MINIMUM') {
      return data.minValue != null;
    }
    if (data.limitType === 'MAXIMUM') {
      return data.maxValue != null;
    }
    if (data.limitType === 'EXACT') {
      return data.targetValue != null;
    }
    return true;
  },
  {
    message: 'Required limit values must be provided based on the limit type',
  }
);

export type CreateTestSchema = z.infer<typeof createTestSchema>;
export type UpdateTestSchema = z.infer<typeof updateTestSchema>;
export type AssignTestSchema = z.infer<typeof assignTestSchema>;
export type ReviewTestSchema = z.infer<typeof reviewTestSchema>;
export type ApproveTestSchema = z.infer<typeof approveTestSchema>;
export type CreateTestResultSchema = z.infer<typeof createTestResultSchema>;
export type UpdateTestResultSchema = z.infer<typeof updateTestResultSchema>;
export type TestFilterSchema = z.infer<typeof testFilterSchema>;
export type CreateTestMethodSchema = z.infer<typeof createTestMethodSchema>;
export type CreateTestAnalyteSchema = z.infer<typeof createTestAnalyteSchema>;
export type CreateSpecificationSchema = z.infer<typeof createSpecificationSchema>;
export type CreateSpecificationLimitSchema = z.infer<typeof createSpecificationLimitSchema>;
