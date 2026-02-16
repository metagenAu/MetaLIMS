// ============================================================
// Invoice Types & Interfaces
// ============================================================

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  VOID: 'VOID',
  WRITTEN_OFF: 'WRITTEN_OFF',
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PaymentTerms = {
  PREPAID: 'PREPAID',
  COD: 'COD',
  NET_15: 'NET_15',
  NET_30: 'NET_30',
  NET_45: 'NET_45',
  NET_60: 'NET_60',
  NET_90: 'NET_90',
  CUSTOM: 'CUSTOM',
} as const;

export type PaymentTerms = (typeof PaymentTerms)[keyof typeof PaymentTerms];

export const PaymentMethod = {
  CREDIT_CARD: 'CREDIT_CARD',
  ACH: 'ACH',
  WIRE_TRANSFER: 'WIRE_TRANSFER',
  CHECK: 'CHECK',
  CASH: 'CASH',
  STRIPE: 'STRIPE',
  OTHER: 'OTHER',
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  CANCELLED: 'CANCELLED',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export interface Invoice {
  id: string;
  organizationId: string;
  clientId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: Date | null;
  dueDate: Date | null;
  paidDate: Date | null;
  subtotal: number;
  discountAmount: number;
  discountPercent: number | null;
  taxRate: number;
  taxAmount: number;
  rushSurcharge: number;
  total: number;
  balanceDue: number;
  paymentTerms: PaymentTerms;
  clientPO: string | null;
  stripeInvoiceId: string | null;
  quickbooksInvoiceId: string | null;
  notes: string | null;
  internalNotes: string | null;
  sentAt: Date | null;
  sentToEmails: string[];
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  voidedAt: Date | null;
  voidedById: string | null;
  voidReason: string | null;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  orderId: string | null;
  description: string;
  testMethodCode: string | null;
  sampleCount: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  sortOrder: number;
  createdAt: Date;
}

export interface Payment {
  id: string;
  organizationId: string;
  invoiceId: string | null;
  clientId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  referenceNumber: string | null;
  stripePaymentId: string | null;
  stripeChargeId: string | null;
  paymentDate: Date;
  processedAt: Date | null;
  notes: string | null;
  recordedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditNote {
  id: string;
  invoiceId: string;
  creditNumber: string;
  amount: number;
  reason: string;
  status: string;
  issuedById: string | null;
  createdAt: Date;
}

export interface CreateInvoiceInput {
  clientId: string;
  paymentTerms: PaymentTerms;
  issueDate?: Date | null;
  dueDate?: Date | null;
  discountPercent?: number | null;
  taxRate?: number;
  clientPO?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  lineItems: CreateInvoiceLineItemInput[];
}

export interface CreateInvoiceLineItemInput {
  orderId?: string | null;
  description: string;
  testMethodCode?: string | null;
  sampleCount?: number;
  quantity: number;
  unitPrice: number;
  discount?: number;
  sortOrder?: number;
}

export interface UpdateInvoiceInput {
  status?: InvoiceStatus;
  issueDate?: Date | null;
  dueDate?: Date | null;
  discountPercent?: number | null;
  taxRate?: number;
  rushSurcharge?: number;
  clientPO?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
}

export interface RecordPaymentInput {
  invoiceId?: string | null;
  clientId: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string | null;
  paymentDate: Date;
  notes?: string | null;
  recordedById?: string | null;
}

export interface InvoiceFilterParams {
  organizationId: string;
  clientId?: string;
  status?: InvoiceStatus | InvoiceStatus[];
  paymentTerms?: PaymentTerms;
  search?: string;
  invoiceNumber?: string;
  issuedFrom?: Date;
  issuedTo?: Date;
  dueFrom?: Date;
  dueTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  clientName: string;
  status: InvoiceStatus;
  issueDate: Date | null;
  dueDate: Date | null;
  total: number;
  balanceDue: number;
  paymentTerms: PaymentTerms;
  isOverdue: boolean;
  daysPastDue: number;
}

export interface InvoiceCalculation {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  rushSurcharge: number;
  total: number;
}
