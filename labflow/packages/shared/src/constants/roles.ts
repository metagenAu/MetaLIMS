// ============================================================
// User Roles & Permissions Map
// ============================================================

import type { UserRole } from '../types/user';

/**
 * All available permissions in the LabFlow system.
 * Each permission follows the pattern: resource:action
 */
export const Permission = {
  // Organization
  ORG_VIEW: 'org:view',
  ORG_EDIT: 'org:edit',
  ORG_MANAGE_SETTINGS: 'org:manage_settings',

  // Users
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_EDIT: 'users:edit',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE_ROLES: 'users:manage_roles',

  // Clients
  CLIENTS_VIEW: 'clients:view',
  CLIENTS_CREATE: 'clients:create',
  CLIENTS_EDIT: 'clients:edit',
  CLIENTS_DELETE: 'clients:delete',

  // Orders
  ORDERS_VIEW: 'orders:view',
  ORDERS_CREATE: 'orders:create',
  ORDERS_EDIT: 'orders:edit',
  ORDERS_DELETE: 'orders:delete',
  ORDERS_RECEIVE: 'orders:receive',
  ORDERS_APPROVE: 'orders:approve',

  // Samples
  SAMPLES_VIEW: 'samples:view',
  SAMPLES_CREATE: 'samples:create',
  SAMPLES_EDIT: 'samples:edit',
  SAMPLES_DELETE: 'samples:delete',
  SAMPLES_RECEIVE: 'samples:receive',
  SAMPLES_DISPOSE: 'samples:dispose',

  // Tests
  TESTS_VIEW: 'tests:view',
  TESTS_CREATE: 'tests:create',
  TESTS_EDIT: 'tests:edit',
  TESTS_DELETE: 'tests:delete',
  TESTS_ASSIGN: 'tests:assign',
  TESTS_PERFORM: 'tests:perform',
  TESTS_ENTER_RESULTS: 'tests:enter_results',
  TESTS_REVIEW: 'tests:review',
  TESTS_APPROVE: 'tests:approve',

  // Test Methods
  TEST_METHODS_VIEW: 'test_methods:view',
  TEST_METHODS_CREATE: 'test_methods:create',
  TEST_METHODS_EDIT: 'test_methods:edit',
  TEST_METHODS_DELETE: 'test_methods:delete',

  // Instruments
  INSTRUMENTS_VIEW: 'instruments:view',
  INSTRUMENTS_CREATE: 'instruments:create',
  INSTRUMENTS_EDIT: 'instruments:edit',
  INSTRUMENTS_DELETE: 'instruments:delete',

  // Reports
  REPORTS_VIEW: 'reports:view',
  REPORTS_CREATE: 'reports:create',
  REPORTS_APPROVE: 'reports:approve',
  REPORTS_SEND: 'reports:send',

  // Invoices
  INVOICES_VIEW: 'invoices:view',
  INVOICES_CREATE: 'invoices:create',
  INVOICES_EDIT: 'invoices:edit',
  INVOICES_APPROVE: 'invoices:approve',
  INVOICES_SEND: 'invoices:send',
  INVOICES_VOID: 'invoices:void',
  INVOICES_WRITE_OFF: 'invoices:write_off',

  // Payments
  PAYMENTS_VIEW: 'payments:view',
  PAYMENTS_RECORD: 'payments:record',
  PAYMENTS_REFUND: 'payments:refund',

  // Audit
  AUDIT_VIEW: 'audit:view',

  // Storage
  STORAGE_VIEW: 'storage:view',
  STORAGE_MANAGE: 'storage:manage',

  // Specifications
  SPECS_VIEW: 'specs:view',
  SPECS_CREATE: 'specs:create',
  SPECS_EDIT: 'specs:edit',
  SPECS_DELETE: 'specs:delete',

  // Workflow
  WORKFLOW_VIEW: 'workflow:view',
  WORKFLOW_MANAGE: 'workflow:manage',

  // Price Lists
  PRICE_LISTS_VIEW: 'price_lists:view',
  PRICE_LISTS_MANAGE: 'price_lists:manage',

  // Sequencing / Metabarcoding
  SEQUENCING_VIEW: 'sequencing:view',
  SEQUENCING_CREATE: 'sequencing:create',
  SEQUENCING_EDIT: 'sequencing:edit',
  SEQUENCING_DELETE: 'sequencing:delete',
  SEQUENCING_ENTER_RESULTS: 'sequencing:enter_results',
  SEQUENCING_EXPORT: 'sequencing:export',
  INDEX_PLATES_VIEW: 'index_plates:view',
  INDEX_PLATES_MANAGE: 'index_plates:manage',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

/**
 * All permission values as an array, useful for validation.
 */
export const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

export interface RoleInfo {
  value: UserRole;
  label: string;
  description: string;
  isInternal: boolean;
  level: number;
}

/**
 * Metadata for each user role.
 * `level` indicates hierarchy: higher means more access. Used for comparison.
 */
export const ROLE_INFO: Record<UserRole, RoleInfo> = {
  SUPER_ADMIN: {
    value: 'SUPER_ADMIN',
    label: 'Super Admin',
    description: 'Full system access with ability to manage all organization settings',
    isInternal: true,
    level: 100,
  },
  LAB_DIRECTOR: {
    value: 'LAB_DIRECTOR',
    label: 'Lab Director',
    description: 'Overall lab operations management with approval authority',
    isInternal: true,
    level: 90,
  },
  LAB_MANAGER: {
    value: 'LAB_MANAGER',
    label: 'Lab Manager',
    description: 'Day-to-day lab management including test assignment and review',
    isInternal: true,
    level: 80,
  },
  SENIOR_ANALYST: {
    value: 'SENIOR_ANALYST',
    label: 'Senior Analyst',
    description: 'Performs testing with review and approval capabilities',
    isInternal: true,
    level: 70,
  },
  ANALYST: {
    value: 'ANALYST',
    label: 'Analyst',
    description: 'Performs assigned tests and enters results',
    isInternal: true,
    level: 60,
  },
  SAMPLE_RECEIVER: {
    value: 'SAMPLE_RECEIVER',
    label: 'Sample Receiver',
    description: 'Receives and logs incoming samples',
    isInternal: true,
    level: 50,
  },
  DATA_ENTRY: {
    value: 'DATA_ENTRY',
    label: 'Data Entry',
    description: 'Enters data such as orders and sample information',
    isInternal: true,
    level: 40,
  },
  BILLING_ADMIN: {
    value: 'BILLING_ADMIN',
    label: 'Billing Admin',
    description: 'Manages invoices, payments, and billing operations',
    isInternal: true,
    level: 50,
  },
  BILLING_VIEWER: {
    value: 'BILLING_VIEWER',
    label: 'Billing Viewer',
    description: 'View-only access to billing and invoice information',
    isInternal: true,
    level: 30,
  },
  CLIENT_ADMIN: {
    value: 'CLIENT_ADMIN',
    label: 'Client Admin',
    description: 'Client-side administrator who can manage orders and view reports for their organization',
    isInternal: false,
    level: 20,
  },
  CLIENT_USER: {
    value: 'CLIENT_USER',
    label: 'Client User',
    description: 'Client-side user with view access to their orders and reports',
    isInternal: false,
    level: 10,
  },
  READONLY: {
    value: 'READONLY',
    label: 'Read Only',
    description: 'View-only access to the system',
    isInternal: true,
    level: 5,
  },
};

/**
 * Default permissions assigned to each role.
 * These can be overridden on a per-user basis via the permissions array on the User model.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,

  LAB_DIRECTOR: [
    Permission.ORG_VIEW,
    Permission.ORG_EDIT,
    Permission.ORG_MANAGE_SETTINGS,
    Permission.USERS_VIEW,
    Permission.USERS_CREATE,
    Permission.USERS_EDIT,
    Permission.USERS_DELETE,
    Permission.USERS_MANAGE_ROLES,
    Permission.CLIENTS_VIEW,
    Permission.CLIENTS_CREATE,
    Permission.CLIENTS_EDIT,
    Permission.CLIENTS_DELETE,
    Permission.ORDERS_VIEW,
    Permission.ORDERS_CREATE,
    Permission.ORDERS_EDIT,
    Permission.ORDERS_DELETE,
    Permission.ORDERS_RECEIVE,
    Permission.ORDERS_APPROVE,
    Permission.SAMPLES_VIEW,
    Permission.SAMPLES_CREATE,
    Permission.SAMPLES_EDIT,
    Permission.SAMPLES_DELETE,
    Permission.SAMPLES_RECEIVE,
    Permission.SAMPLES_DISPOSE,
    Permission.TESTS_VIEW,
    Permission.TESTS_CREATE,
    Permission.TESTS_EDIT,
    Permission.TESTS_DELETE,
    Permission.TESTS_ASSIGN,
    Permission.TESTS_PERFORM,
    Permission.TESTS_ENTER_RESULTS,
    Permission.TESTS_REVIEW,
    Permission.TESTS_APPROVE,
    Permission.TEST_METHODS_VIEW,
    Permission.TEST_METHODS_CREATE,
    Permission.TEST_METHODS_EDIT,
    Permission.TEST_METHODS_DELETE,
    Permission.INSTRUMENTS_VIEW,
    Permission.INSTRUMENTS_CREATE,
    Permission.INSTRUMENTS_EDIT,
    Permission.INSTRUMENTS_DELETE,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_CREATE,
    Permission.REPORTS_APPROVE,
    Permission.REPORTS_SEND,
    Permission.INVOICES_VIEW,
    Permission.INVOICES_CREATE,
    Permission.INVOICES_EDIT,
    Permission.INVOICES_APPROVE,
    Permission.INVOICES_SEND,
    Permission.INVOICES_VOID,
    Permission.INVOICES_WRITE_OFF,
    Permission.PAYMENTS_VIEW,
    Permission.PAYMENTS_RECORD,
    Permission.PAYMENTS_REFUND,
    Permission.AUDIT_VIEW,
    Permission.STORAGE_VIEW,
    Permission.STORAGE_MANAGE,
    Permission.SPECS_VIEW,
    Permission.SPECS_CREATE,
    Permission.SPECS_EDIT,
    Permission.SPECS_DELETE,
    Permission.WORKFLOW_VIEW,
    Permission.WORKFLOW_MANAGE,
    Permission.PRICE_LISTS_VIEW,
    Permission.PRICE_LISTS_MANAGE,
    Permission.SEQUENCING_VIEW,
    Permission.SEQUENCING_CREATE,
    Permission.SEQUENCING_EDIT,
    Permission.SEQUENCING_DELETE,
    Permission.SEQUENCING_ENTER_RESULTS,
    Permission.SEQUENCING_EXPORT,
    Permission.INDEX_PLATES_VIEW,
    Permission.INDEX_PLATES_MANAGE,
  ],

  LAB_MANAGER: [
    Permission.ORG_VIEW,
    Permission.USERS_VIEW,
    Permission.USERS_CREATE,
    Permission.USERS_EDIT,
    Permission.CLIENTS_VIEW,
    Permission.CLIENTS_CREATE,
    Permission.CLIENTS_EDIT,
    Permission.ORDERS_VIEW,
    Permission.ORDERS_CREATE,
    Permission.ORDERS_EDIT,
    Permission.ORDERS_RECEIVE,
    Permission.ORDERS_APPROVE,
    Permission.SAMPLES_VIEW,
    Permission.SAMPLES_CREATE,
    Permission.SAMPLES_EDIT,
    Permission.SAMPLES_RECEIVE,
    Permission.SAMPLES_DISPOSE,
    Permission.TESTS_VIEW,
    Permission.TESTS_CREATE,
    Permission.TESTS_EDIT,
    Permission.TESTS_ASSIGN,
    Permission.TESTS_PERFORM,
    Permission.TESTS_ENTER_RESULTS,
    Permission.TESTS_REVIEW,
    Permission.TESTS_APPROVE,
    Permission.TEST_METHODS_VIEW,
    Permission.TEST_METHODS_CREATE,
    Permission.TEST_METHODS_EDIT,
    Permission.INSTRUMENTS_VIEW,
    Permission.INSTRUMENTS_CREATE,
    Permission.INSTRUMENTS_EDIT,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_CREATE,
    Permission.REPORTS_APPROVE,
    Permission.REPORTS_SEND,
    Permission.INVOICES_VIEW,
    Permission.PAYMENTS_VIEW,
    Permission.AUDIT_VIEW,
    Permission.STORAGE_VIEW,
    Permission.STORAGE_MANAGE,
    Permission.SPECS_VIEW,
    Permission.SPECS_CREATE,
    Permission.SPECS_EDIT,
    Permission.WORKFLOW_VIEW,
    Permission.PRICE_LISTS_VIEW,
    Permission.SEQUENCING_VIEW,
    Permission.SEQUENCING_CREATE,
    Permission.SEQUENCING_EDIT,
    Permission.SEQUENCING_DELETE,
    Permission.SEQUENCING_ENTER_RESULTS,
    Permission.SEQUENCING_EXPORT,
    Permission.INDEX_PLATES_VIEW,
    Permission.INDEX_PLATES_MANAGE,
  ],

  SENIOR_ANALYST: [
    Permission.ORG_VIEW,
    Permission.CLIENTS_VIEW,
    Permission.ORDERS_VIEW,
    Permission.SAMPLES_VIEW,
    Permission.SAMPLES_EDIT,
    Permission.TESTS_VIEW,
    Permission.TESTS_CREATE,
    Permission.TESTS_EDIT,
    Permission.TESTS_ASSIGN,
    Permission.TESTS_PERFORM,
    Permission.TESTS_ENTER_RESULTS,
    Permission.TESTS_REVIEW,
    Permission.TESTS_APPROVE,
    Permission.TEST_METHODS_VIEW,
    Permission.INSTRUMENTS_VIEW,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_CREATE,
    Permission.STORAGE_VIEW,
    Permission.SPECS_VIEW,
    Permission.SEQUENCING_VIEW,
    Permission.SEQUENCING_EDIT,
    Permission.SEQUENCING_ENTER_RESULTS,
    Permission.SEQUENCING_EXPORT,
    Permission.INDEX_PLATES_VIEW,
  ],

  ANALYST: [
    Permission.ORG_VIEW,
    Permission.ORDERS_VIEW,
    Permission.SAMPLES_VIEW,
    Permission.TESTS_VIEW,
    Permission.TESTS_PERFORM,
    Permission.TESTS_ENTER_RESULTS,
    Permission.TEST_METHODS_VIEW,
    Permission.INSTRUMENTS_VIEW,
    Permission.STORAGE_VIEW,
    Permission.SPECS_VIEW,
    Permission.SEQUENCING_VIEW,
    Permission.SEQUENCING_ENTER_RESULTS,
    Permission.SEQUENCING_EXPORT,
    Permission.INDEX_PLATES_VIEW,
  ],

  SAMPLE_RECEIVER: [
    Permission.ORG_VIEW,
    Permission.CLIENTS_VIEW,
    Permission.ORDERS_VIEW,
    Permission.ORDERS_RECEIVE,
    Permission.SAMPLES_VIEW,
    Permission.SAMPLES_CREATE,
    Permission.SAMPLES_EDIT,
    Permission.SAMPLES_RECEIVE,
    Permission.STORAGE_VIEW,
    Permission.STORAGE_MANAGE,
  ],

  DATA_ENTRY: [
    Permission.ORG_VIEW,
    Permission.CLIENTS_VIEW,
    Permission.CLIENTS_CREATE,
    Permission.ORDERS_VIEW,
    Permission.ORDERS_CREATE,
    Permission.ORDERS_EDIT,
    Permission.SAMPLES_VIEW,
    Permission.SAMPLES_CREATE,
    Permission.SAMPLES_EDIT,
    Permission.TESTS_VIEW,
    Permission.TESTS_CREATE,
  ],

  BILLING_ADMIN: [
    Permission.ORG_VIEW,
    Permission.CLIENTS_VIEW,
    Permission.CLIENTS_EDIT,
    Permission.ORDERS_VIEW,
    Permission.INVOICES_VIEW,
    Permission.INVOICES_CREATE,
    Permission.INVOICES_EDIT,
    Permission.INVOICES_APPROVE,
    Permission.INVOICES_SEND,
    Permission.INVOICES_VOID,
    Permission.INVOICES_WRITE_OFF,
    Permission.PAYMENTS_VIEW,
    Permission.PAYMENTS_RECORD,
    Permission.PAYMENTS_REFUND,
    Permission.PRICE_LISTS_VIEW,
    Permission.PRICE_LISTS_MANAGE,
  ],

  BILLING_VIEWER: [
    Permission.ORG_VIEW,
    Permission.CLIENTS_VIEW,
    Permission.ORDERS_VIEW,
    Permission.INVOICES_VIEW,
    Permission.PAYMENTS_VIEW,
    Permission.PRICE_LISTS_VIEW,
  ],

  CLIENT_ADMIN: [
    Permission.ORDERS_VIEW,
    Permission.ORDERS_CREATE,
    Permission.SAMPLES_VIEW,
    Permission.TESTS_VIEW,
    Permission.REPORTS_VIEW,
    Permission.INVOICES_VIEW,
    Permission.PAYMENTS_VIEW,
  ],

  CLIENT_USER: [
    Permission.ORDERS_VIEW,
    Permission.SAMPLES_VIEW,
    Permission.TESTS_VIEW,
    Permission.REPORTS_VIEW,
    Permission.INVOICES_VIEW,
  ],

  READONLY: [
    Permission.ORG_VIEW,
    Permission.ORDERS_VIEW,
    Permission.SAMPLES_VIEW,
    Permission.TESTS_VIEW,
    Permission.TEST_METHODS_VIEW,
    Permission.INSTRUMENTS_VIEW,
    Permission.REPORTS_VIEW,
    Permission.INVOICES_VIEW,
    Permission.PAYMENTS_VIEW,
    Permission.STORAGE_VIEW,
    Permission.SPECS_VIEW,
    Permission.SEQUENCING_VIEW,
    Permission.INDEX_PLATES_VIEW,
  ],
};

/**
 * Returns the default permissions for a given role.
 */
export function getDefaultPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Checks whether a role has a specific permission by default.
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Checks if a user (with role + optional extra permissions) has a specific permission.
 * Extra permissions override the defaults by adding to them.
 */
export function hasPermission(
  role: UserRole,
  permission: Permission,
  extraPermissions: string[] = []
): boolean {
  if (ROLE_PERMISSIONS[role].includes(permission)) {
    return true;
  }
  return extraPermissions.includes(permission);
}

/**
 * Returns all internal (lab staff) roles.
 */
export function getInternalRoles(): UserRole[] {
  return (Object.keys(ROLE_INFO) as UserRole[]).filter(
    (role) => ROLE_INFO[role].isInternal
  );
}

/**
 * Returns all external (client-facing) roles.
 */
export function getExternalRoles(): UserRole[] {
  return (Object.keys(ROLE_INFO) as UserRole[]).filter(
    (role) => !ROLE_INFO[role].isInternal
  );
}

/**
 * Returns true if roleA has a higher or equal level than roleB.
 */
export function isRoleAtLeast(roleA: UserRole, roleB: UserRole): boolean {
  return ROLE_INFO[roleA].level >= ROLE_INFO[roleB].level;
}
