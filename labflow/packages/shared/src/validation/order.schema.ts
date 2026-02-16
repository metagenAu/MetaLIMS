// ============================================================
// Order Zod Validation Schemas
// ============================================================

import { z } from 'zod';
import { PriorityEnum } from './sample.schema';

export const OrderStatusEnum = z.enum([
  'DRAFT',
  'SUBMITTED',
  'RECEIVED',
  'IN_PROGRESS',
  'TESTING_COMPLETE',
  'IN_REVIEW',
  'APPROVED',
  'REPORTED',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
]);

export const createOrderSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().nullish(),
  priority: PriorityEnum.optional().default('NORMAL'),
  clientPO: z.string().max(100).nullish(),
  clientReference: z.string().max(255).nullish(),
  turnaroundDays: z.number().int().min(1).max(365).nullish(),
  rushRequested: z.boolean().optional().default(false),
  shippingMethod: z.string().max(100).nullish(),
  trackingNumber: z.string().max(255).nullish(),
  temperature: z.string().max(50).nullish(),
  conditionOnReceipt: z.string().max(500).nullish(),
  notes: z.string().max(5000).nullish(),
  internalNotes: z.string().max(5000).nullish(),
});

export const updateOrderSchema = z.object({
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().nullish(),
  status: OrderStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  clientPO: z.string().max(100).nullish(),
  clientReference: z.string().max(255).nullish(),
  receivedDate: z.coerce.date().nullish(),
  dueDate: z.coerce.date().nullish(),
  turnaroundDays: z.number().int().min(1).max(365).nullish(),
  rushRequested: z.boolean().optional(),
  rushApproved: z.boolean().optional(),
  rushSurchargePercent: z.number().min(0).max(100).nullish(),
  shippingMethod: z.string().max(100).nullish(),
  trackingNumber: z.string().max(255).nullish(),
  temperature: z.string().max(50).nullish(),
  conditionOnReceipt: z.string().max(500).nullish(),
  notes: z.string().max(5000).nullish(),
  internalNotes: z.string().max(5000).nullish(),
});

export const receiveOrderSchema = z.object({
  receivedDate: z.coerce.date().optional(),
  conditionOnReceipt: z.string().max(500).nullish(),
  temperature: z.string().max(50).nullish(),
  notes: z.string().max(5000).nullish(),
});

export const orderFilterSchema = z.object({
  organizationId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z.union([OrderStatusEnum, z.array(OrderStatusEnum)]).optional(),
  priority: z.union([PriorityEnum, z.array(PriorityEnum)]).optional(),
  search: z.string().max(255).optional(),
  orderNumber: z.string().optional(),
  clientPO: z.string().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  receivedFrom: z.coerce.date().optional(),
  receivedTo: z.coerce.date().optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(25),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateOrderSchema = z.infer<typeof createOrderSchema>;
export type UpdateOrderSchema = z.infer<typeof updateOrderSchema>;
export type ReceiveOrderSchema = z.infer<typeof receiveOrderSchema>;
export type OrderFilterSchema = z.infer<typeof orderFilterSchema>;
