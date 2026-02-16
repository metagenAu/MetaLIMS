// ============================================================
// Sample Zod Validation Schemas
// ============================================================

import { z } from 'zod';

export const SampleStatusEnum = z.enum([
  'REGISTERED',
  'RECEIVED',
  'IN_STORAGE',
  'IN_PROGRESS',
  'TESTING_COMPLETE',
  'APPROVED',
  'REPORTED',
  'ON_HOLD',
  'DISPOSED',
  'REJECTED',
  'CANCELLED',
]);

export const PriorityEnum = z.enum([
  'LOW',
  'NORMAL',
  'HIGH',
  'RUSH',
  'EMERGENCY',
]);

export const sampleAttachmentSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().min(1),
  fileKey: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  uploadedAt: z.string().datetime(),
  uploadedById: z.string().uuid(),
});

export const createSampleSchema = z.object({
  orderId: z.string().uuid(),
  clientSampleId: z.string().max(100).nullish(),
  name: z.string().max(255).nullish(),
  description: z.string().max(2000).nullish(),
  matrix: z.string().max(100).nullish(),
  sampleType: z.string().max(100).nullish(),
  collectedDate: z.coerce.date().nullish(),
  collectedBy: z.string().max(255).nullish(),
  collectionLocation: z.string().max(500).nullish(),
  collectionMethod: z.string().max(255).nullish(),
  conditionOnReceipt: z.string().max(500).nullish(),
  temperatureOnReceipt: z.number().min(-200).max(1000).nullish(),
  storageCondition: z.string().max(255).nullish(),
  parentSampleId: z.string().uuid().nullish(),
  quantity: z.number().positive().nullish(),
  quantityUnit: z.string().max(50).nullish(),
  lotNumber: z.string().max(100).nullish(),
  batchNumber: z.string().max(100).nullish(),
  expirationDate: z.coerce.date().nullish(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  customFields: z.record(z.string(), z.unknown()).optional().default({}),
  notes: z.string().max(5000).nullish(),
});

export const updateSampleSchema = z.object({
  clientSampleId: z.string().max(100).nullish(),
  name: z.string().max(255).nullish(),
  description: z.string().max(2000).nullish(),
  matrix: z.string().max(100).nullish(),
  sampleType: z.string().max(100).nullish(),
  collectedDate: z.coerce.date().nullish(),
  collectedBy: z.string().max(255).nullish(),
  collectionLocation: z.string().max(500).nullish(),
  collectionMethod: z.string().max(255).nullish(),
  conditionOnReceipt: z.string().max(500).nullish(),
  temperatureOnReceipt: z.number().min(-200).max(1000).nullish(),
  status: SampleStatusEnum.optional(),
  storageLocationId: z.string().uuid().nullish(),
  storageCondition: z.string().max(255).nullish(),
  disposalDate: z.coerce.date().nullish(),
  disposalMethod: z.string().max(255).nullish(),
  disposedById: z.string().uuid().nullish(),
  quantity: z.number().positive().nullish(),
  quantityUnit: z.string().max(50).nullish(),
  lotNumber: z.string().max(100).nullish(),
  batchNumber: z.string().max(100).nullish(),
  expirationDate: z.coerce.date().nullish(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(5000).nullish(),
});

export const receiveSampleSchema = z.object({
  receivedById: z.string().uuid(),
  receivedDate: z.coerce.date().optional(),
  conditionOnReceipt: z.string().max(500).nullish(),
  temperatureOnReceipt: z.number().min(-200).max(1000).nullish(),
  storageLocationId: z.string().uuid().nullish(),
  storageCondition: z.string().max(255).nullish(),
  notes: z.string().max(5000).nullish(),
});

export const sampleFilterSchema = z.object({
  organizationId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  status: z.union([SampleStatusEnum, z.array(SampleStatusEnum)]).optional(),
  sampleType: z.string().optional(),
  matrix: z.string().optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().max(255).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  receivedFrom: z.coerce.date().optional(),
  receivedTo: z.coerce.date().optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(25),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const createChainOfCustodySchema = z.object({
  sampleId: z.string().uuid(),
  action: z.string().min(1).max(255),
  fromLocation: z.string().max(500).nullish(),
  toLocation: z.string().max(500).nullish(),
  performedById: z.string().uuid(),
  notes: z.string().max(2000).nullish(),
  signatureUrl: z.string().url().nullish(),
  temperature: z.number().min(-200).max(1000).nullish(),
});

export type CreateSampleSchema = z.infer<typeof createSampleSchema>;
export type UpdateSampleSchema = z.infer<typeof updateSampleSchema>;
export type ReceiveSampleSchema = z.infer<typeof receiveSampleSchema>;
export type SampleFilterSchema = z.infer<typeof sampleFilterSchema>;
export type CreateChainOfCustodySchema = z.infer<typeof createChainOfCustodySchema>;
