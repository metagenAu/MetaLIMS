// ============================================================
// Constants - Barrel Export
// ============================================================

export {
  SAMPLE_STATUS_INFO,
  SAMPLE_STATUS_TRANSITIONS,
  isValidSampleTransition,
  getAvailableSampleTransitions,
  getActiveSampleStatuses,
  getFinalSampleStatuses,
  type StatusInfo,
} from './sampleStatuses';

export {
  TEST_STATUS_INFO,
  TEST_STATUS_TRANSITIONS,
  isValidTestTransition,
  getAvailableTestTransitions,
  getActiveTestStatuses,
  getFinalTestStatuses,
  requiresReview,
  getRequiredRoleForTransition,
  type TestStatusInfo,
} from './testStatuses';

export {
  INVOICE_STATUS_INFO,
  INVOICE_STATUS_TRANSITIONS,
  PAYMENT_TERMS_INFO,
  isValidInvoiceTransition,
  getAvailableInvoiceTransitions,
  getPaymentTermDays,
  getPayableInvoiceStatuses,
  getEditableInvoiceStatuses,
  getFinalInvoiceStatuses,
  getOutstandingInvoiceStatuses,
  type InvoiceStatusInfo,
  type PaymentTermInfo,
} from './invoiceStatuses';

export {
  Permission,
  ALL_PERMISSIONS,
  ROLE_INFO,
  ROLE_PERMISSIONS,
  getDefaultPermissions,
  roleHasPermission,
  hasPermission,
  getInternalRoles,
  getExternalRoles,
  isRoleAtLeast,
  type RoleInfo,
} from './roles';
