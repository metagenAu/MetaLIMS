// ============================================================
// User Types & Interfaces
// ============================================================

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  LAB_DIRECTOR: 'LAB_DIRECTOR',
  LAB_MANAGER: 'LAB_MANAGER',
  SENIOR_ANALYST: 'SENIOR_ANALYST',
  ANALYST: 'ANALYST',
  SAMPLE_RECEIVER: 'SAMPLE_RECEIVER',
  DATA_ENTRY: 'DATA_ENTRY',
  BILLING_ADMIN: 'BILLING_ADMIN',
  BILLING_VIEWER: 'BILLING_VIEWER',
  CLIENT_ADMIN: 'CLIENT_ADMIN',
  CLIENT_USER: 'CLIENT_USER',
  READONLY: 'READONLY',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface User {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  title: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  mfaEnabled: boolean;
  permissions: string[];
  signatureUrl: string | null;
  notificationPrefs: NotificationPrefs;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface NotificationPrefs {
  email?: boolean;
  inApp?: boolean;
  sampleReceived?: boolean;
  testCompleted?: boolean;
  testApproved?: boolean;
  reportReady?: boolean;
  invoiceCreated?: boolean;
  paymentReceived?: boolean;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  title?: string | null;
  phone?: string | null;
  permissions?: string[];
  notificationPrefs?: NotificationPrefs;
}

export interface UpdateUserInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  title?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
  permissions?: string[];
  signatureUrl?: string | null;
  notificationPrefs?: NotificationPrefs;
}

export interface UpdatePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface UserFilterParams {
  organizationId: string;
  role?: UserRole | UserRole[];
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  title: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
}

export interface AuthTokenPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: UserRole;
  permissions: string[];
}

export interface LoginInput {
  email: string;
  password: string;
  organizationSlug?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
  expiresAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  licenseNumber: string | null;
  accreditations: string[];
  timezone: string;
  dateFormat: string;
  currency: string;
  fiscalYearStart: number;
  defaultPaymentTerms: string;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  type: ClientType;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  billingEmail: string | null;
  billingAddress: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingZip: string | null;
  billingCountry: string | null;
  paymentTerms: string;
  creditLimit: number | null;
  taxExempt: boolean;
  taxExemptId: string | null;
  priceListId: string | null;
  stripeCustomerId: string | null;
  defaultPaymentMethodId: string | null;
  purchaseOrderRequired: boolean;
  autoInvoice: boolean;
  codHold: boolean;
  defaultTurnaroundDays: number;
  notes: string | null;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export const ClientType = {
  COMMERCIAL: 'COMMERCIAL',
  GOVERNMENT: 'GOVERNMENT',
  ACADEMIC: 'ACADEMIC',
  INTERNAL: 'INTERNAL',
  INDIVIDUAL: 'INDIVIDUAL',
} as const;

export type ClientType = (typeof ClientType)[keyof typeof ClientType];
