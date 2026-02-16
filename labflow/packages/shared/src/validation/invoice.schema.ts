// ============================================================
// Invoice Zod Validation Schemas
// ============================================================

import { z } from 'zod';

export const InvoiceStatusEnum = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT',
  'VIEWED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'VOID',
  'WRITTEN_OFF',
]);

export const PaymentTermsEnum = z.enum([
  'PREPAID',
  'COD',
  'NET_15',
  'NET_30',
  'NET_45',
  'NET_60',
  'NET_90',
  'CUSTOM',
]);

export const PaymentMethodEnum = z.enum([
  'CREDIT_CARD',
  'ACH',
  'WIRE_TRANSFER',
  'CHECK',
  'CASH',
  'STRIPE',
  'OTHER',
]);

export const PaymentStatusEnum = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'CANCELLED',
]);

export const createInvoiceLineItemSchema = z.object({
  orderId: z.string().uuid().nullish(),
  description: z.string().min(1).max(500),
  testMethodCode: z.string().max(50).nullish(),
  sampleCount: z.number().int().min(1).optional().default(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).optional().default(0),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  paymentTerms: PaymentTermsEnum,
  issueDate: z.coerce.date().nullish(),
  dueDate: z.coerce.date().nullish(),
  discountPercent: z.number().min(0).max(100).nullish(),
  taxRate: z.number().min(0).max(1).optional().default(0),
  clientPO: z.string().max(100).nullish(),
  notes: z.string().max(5000).nullish(),
  internalNotes: z.string().max(5000).nullish(),
  lineItems: z.array(createInvoiceLineItemSchema).min(1, 'At least one line item is required'),
});

export const updateInvoiceSchema = z.object({
  status: InvoiceStatusEnum.optional(),
  issueDate: z.coerce.date().nullish(),
  dueDate: z.coerce.date().nullish(),
  discountPercent: z.number().min(0).max(100).nullish(),
  taxRate: z.number().min(0).max(1).optional(),
  rushSurcharge: z.number().min(0).optional(),
  clientPO: z.string().max(100).nullish(),
  notes: z.string().max(5000).nullish(),
  internalNotes: z.string().max(5000).nullish(),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid().nullish(),
  clientId: z.string().uuid(),
  amount: z.number().positive('Payment amount must be positive'),
  method: PaymentMethodEnum,
  referenceNumber: z.string().max(255).nullish(),
  paymentDate: z.coerce.date(),
  notes: z.string().max(2000).nullish(),
  recordedById: z.string().uuid().nullish(),
});

export const voidInvoiceSchema = z.object({
  voidReason: z.string().min(1, 'Void reason is required').max(1000),
  voidedById: z.string().uuid(),
});

export const sendInvoiceSchema = z.object({
  toEmails: z.array(z.string().email()).min(1, 'At least one email address is required'),
  ccEmails: z.array(z.string().email()).optional().default([]),
  subject: z.string().min(1).max(500).optional(),
  message: z.string().max(5000).optional(),
});

export const invoiceFilterSchema = z.object({
  organizationId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  status: z.union([InvoiceStatusEnum, z.array(InvoiceStatusEnum)]).optional(),
  paymentTerms: PaymentTermsEnum.optional(),
  search: z.string().max(255).optional(),
  invoiceNumber: z.string().optional(),
  issuedFrom: z.coerce.date().optional(),
  issuedTo: z.coerce.date().optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(25),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const createCreditNoteSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive('Credit note amount must be positive'),
  reason: z.string().min(1, 'Reason is required').max(2000),
  issuedById: z.string().uuid().nullish(),
});

export type CreateInvoiceSchema = z.infer<typeof createInvoiceSchema>;
export type CreateInvoiceLineItemSchema = z.infer<typeof createInvoiceLineItemSchema>;
export type UpdateInvoiceSchema = z.infer<typeof updateInvoiceSchema>;
export type RecordPaymentSchema = z.infer<typeof recordPaymentSchema>;
export type VoidInvoiceSchema = z.infer<typeof voidInvoiceSchema>;
export type SendInvoiceSchema = z.infer<typeof sendInvoiceSchema>;
export type InvoiceFilterSchema = z.infer<typeof invoiceFilterSchema>;
export type CreateCreditNoteSchema = z.infer<typeof createCreditNoteSchema>;
