// ============================================================
// Invoice Status Constants
// ============================================================

import type { InvoiceStatus, PaymentTerms } from '../types/invoice';

export interface InvoiceStatusInfo {
  value: InvoiceStatus;
  label: string;
  description: string;
  color: string;
  isFinal: boolean;
  allowsEditing: boolean;
  allowsPayment: boolean;
}

export const INVOICE_STATUS_INFO: Record<InvoiceStatus, InvoiceStatusInfo> = {
  DRAFT: {
    value: 'DRAFT',
    label: 'Draft',
    description: 'Invoice is being prepared and has not been finalized',
    color: '#6B7280',
    isFinal: false,
    allowsEditing: true,
    allowsPayment: false,
  },
  PENDING_APPROVAL: {
    value: 'PENDING_APPROVAL',
    label: 'Pending Approval',
    description: 'Invoice is awaiting internal approval before being sent',
    color: '#F59E0B',
    isFinal: false,
    allowsEditing: false,
    allowsPayment: false,
  },
  APPROVED: {
    value: 'APPROVED',
    label: 'Approved',
    description: 'Invoice has been approved and is ready to be sent',
    color: '#10B981',
    isFinal: false,
    allowsEditing: false,
    allowsPayment: false,
  },
  SENT: {
    value: 'SENT',
    label: 'Sent',
    description: 'Invoice has been sent to the client',
    color: '#3B82F6',
    isFinal: false,
    allowsEditing: false,
    allowsPayment: true,
  },
  VIEWED: {
    value: 'VIEWED',
    label: 'Viewed',
    description: 'Client has viewed the invoice',
    color: '#8B5CF6',
    isFinal: false,
    allowsEditing: false,
    allowsPayment: true,
  },
  PARTIALLY_PAID: {
    value: 'PARTIALLY_PAID',
    label: 'Partially Paid',
    description: 'Client has made a partial payment on the invoice',
    color: '#F97316',
    isFinal: false,
    allowsEditing: false,
    allowsPayment: true,
  },
  PAID: {
    value: 'PAID',
    label: 'Paid',
    description: 'Invoice has been fully paid',
    color: '#059669',
    isFinal: true,
    allowsEditing: false,
    allowsPayment: false,
  },
  OVERDUE: {
    value: 'OVERDUE',
    label: 'Overdue',
    description: 'Invoice payment is past due',
    color: '#DC2626',
    isFinal: false,
    allowsEditing: false,
    allowsPayment: true,
  },
  VOID: {
    value: 'VOID',
    label: 'Void',
    description: 'Invoice has been voided and is no longer valid',
    color: '#9CA3AF',
    isFinal: true,
    allowsEditing: false,
    allowsPayment: false,
  },
  WRITTEN_OFF: {
    value: 'WRITTEN_OFF',
    label: 'Written Off',
    description: 'Invoice balance has been written off as uncollectible',
    color: '#6B7280',
    isFinal: true,
    allowsEditing: false,
    allowsPayment: false,
  },
};

/**
 * Maps each invoice status to the set of statuses it can transition to.
 */
export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'APPROVED', 'VOID'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT', 'VOID'],
  APPROVED: ['SENT', 'DRAFT', 'VOID'],
  SENT: ['VIEWED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'],
  VIEWED: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'],
  PARTIALLY_PAID: ['PAID', 'OVERDUE', 'VOID', 'WRITTEN_OFF'],
  PAID: [],
  OVERDUE: ['PARTIALLY_PAID', 'PAID', 'VOID', 'WRITTEN_OFF'],
  VOID: [],
  WRITTEN_OFF: [],
};

/**
 * Returns true if transitioning from `from` to `to` is a valid invoice status transition.
 */
export function isValidInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  const allowed = INVOICE_STATUS_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Returns the list of statuses an invoice can transition to from its current status.
 */
export function getAvailableInvoiceTransitions(current: InvoiceStatus): InvoiceStatus[] {
  return INVOICE_STATUS_TRANSITIONS[current];
}

/**
 * Returns the number of days for a given payment terms value.
 * Used for calculating due dates.
 */
export function getPaymentTermDays(terms: PaymentTerms): number {
  switch (terms) {
    case 'PREPAID':
      return 0;
    case 'COD':
      return 0;
    case 'NET_15':
      return 15;
    case 'NET_30':
      return 30;
    case 'NET_45':
      return 45;
    case 'NET_60':
      return 60;
    case 'NET_90':
      return 90;
    case 'CUSTOM':
      return 30; // default fallback for custom terms
    default:
      return 30;
  }
}

export interface PaymentTermInfo {
  value: PaymentTerms;
  label: string;
  days: number;
  description: string;
}

export const PAYMENT_TERMS_INFO: Record<PaymentTerms, PaymentTermInfo> = {
  PREPAID: {
    value: 'PREPAID',
    label: 'Prepaid',
    days: 0,
    description: 'Payment required before services are rendered',
  },
  COD: {
    value: 'COD',
    label: 'Cash on Delivery',
    days: 0,
    description: 'Payment due upon delivery of results',
  },
  NET_15: {
    value: 'NET_15',
    label: 'Net 15',
    days: 15,
    description: 'Payment due within 15 days of invoice date',
  },
  NET_30: {
    value: 'NET_30',
    label: 'Net 30',
    days: 30,
    description: 'Payment due within 30 days of invoice date',
  },
  NET_45: {
    value: 'NET_45',
    label: 'Net 45',
    days: 45,
    description: 'Payment due within 45 days of invoice date',
  },
  NET_60: {
    value: 'NET_60',
    label: 'Net 60',
    days: 60,
    description: 'Payment due within 60 days of invoice date',
  },
  NET_90: {
    value: 'NET_90',
    label: 'Net 90',
    days: 90,
    description: 'Payment due within 90 days of invoice date',
  },
  CUSTOM: {
    value: 'CUSTOM',
    label: 'Custom',
    days: 0,
    description: 'Custom payment terms as agreed with the client',
  },
};

/**
 * Returns all invoice statuses that allow accepting payments.
 */
export function getPayableInvoiceStatuses(): InvoiceStatus[] {
  return (Object.keys(INVOICE_STATUS_INFO) as InvoiceStatus[]).filter(
    (status) => INVOICE_STATUS_INFO[status].allowsPayment
  );
}

/**
 * Returns all invoice statuses that allow editing the invoice.
 */
export function getEditableInvoiceStatuses(): InvoiceStatus[] {
  return (Object.keys(INVOICE_STATUS_INFO) as InvoiceStatus[]).filter(
    (status) => INVOICE_STATUS_INFO[status].allowsEditing
  );
}

/**
 * Returns all terminal invoice statuses.
 */
export function getFinalInvoiceStatuses(): InvoiceStatus[] {
  return (Object.keys(INVOICE_STATUS_INFO) as InvoiceStatus[]).filter(
    (status) => INVOICE_STATUS_INFO[status].isFinal
  );
}

/**
 * Returns all outstanding (unpaid, non-void, non-written-off) invoice statuses.
 */
export function getOutstandingInvoiceStatuses(): InvoiceStatus[] {
  return ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'];
}
