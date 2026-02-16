// ============================================================
// Order Types & Interfaces
// ============================================================

import type { Priority } from './sample';

export const OrderStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  RECEIVED: 'RECEIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  TESTING_COMPLETE: 'TESTING_COMPLETE',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  REPORTED: 'REPORTED',
  COMPLETED: 'COMPLETED',
  ON_HOLD: 'ON_HOLD',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export interface OrderAttachment {
  id: string;
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedById: string;
}

export interface Order {
  id: string;
  organizationId: string;
  clientId: string;
  projectId: string | null;
  orderNumber: string;
  status: OrderStatus;
  priority: Priority;
  clientPO: string | null;
  clientReference: string | null;
  receivedDate: Date | null;
  dueDate: Date | null;
  completedDate: Date | null;
  turnaroundDays: number | null;
  rushRequested: boolean;
  rushApproved: boolean;
  rushSurchargePercent: number | null;
  shippingMethod: string | null;
  trackingNumber: string | null;
  temperature: string | null;
  conditionOnReceipt: string | null;
  notes: string | null;
  internalNotes: string | null;
  attachments: OrderAttachment[];
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderInput {
  clientId: string;
  projectId?: string | null;
  priority?: Priority;
  clientPO?: string | null;
  clientReference?: string | null;
  turnaroundDays?: number | null;
  rushRequested?: boolean;
  shippingMethod?: string | null;
  trackingNumber?: string | null;
  temperature?: string | null;
  conditionOnReceipt?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
}

export interface UpdateOrderInput {
  clientId?: string;
  projectId?: string | null;
  status?: OrderStatus;
  priority?: Priority;
  clientPO?: string | null;
  clientReference?: string | null;
  receivedDate?: Date | null;
  dueDate?: Date | null;
  turnaroundDays?: number | null;
  rushRequested?: boolean;
  rushApproved?: boolean;
  rushSurchargePercent?: number | null;
  shippingMethod?: string | null;
  trackingNumber?: string | null;
  temperature?: string | null;
  conditionOnReceipt?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
}

export interface ReceiveOrderInput {
  receivedDate?: Date;
  conditionOnReceipt?: string | null;
  temperature?: string | null;
  notes?: string | null;
}

export interface OrderFilterParams {
  organizationId: string;
  clientId?: string;
  projectId?: string;
  status?: OrderStatus | OrderStatus[];
  priority?: Priority | Priority[];
  search?: string;
  orderNumber?: string;
  clientPO?: string;
  createdFrom?: Date;
  createdTo?: Date;
  receivedFrom?: Date;
  receivedTo?: Date;
  dueFrom?: Date;
  dueTo?: Date;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  clientName: string;
  projectName: string | null;
  status: OrderStatus;
  priority: Priority;
  sampleCount: number;
  testCount: number;
  completedTestCount: number;
  receivedDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
}
