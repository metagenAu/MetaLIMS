'use client';

import { useCallback, useMemo } from 'react';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const PORTAL_PREFIX = '/api/portal';

interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('portal_access_token');
}

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}${PORTAL_PREFIX}`,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('portal_access_token');
        localStorage.removeItem('portal_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function usePortalApi() {
  const queryClient = useQueryClient();

  const get = useCallback(async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await apiClient.get<T>(url, config);
    return response.data;
  }, []);

  const post = useCallback(async <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    const response = await apiClient.post<T>(url, data, config);
    return response.data;
  }, []);

  const put = useCallback(async <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    const response = await apiClient.put<T>(url, data, config);
    return response.data;
  }, []);

  const patch = useCallback(async <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    const response = await apiClient.patch<T>(url, data, config);
    return response.data;
  }, []);

  const del = useCallback(async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await apiClient.delete<T>(url, config);
    return response.data;
  }, []);

  const upload = useCallback(async <T>(url: string, formData: FormData): Promise<T> => {
    const response = await apiClient.post<T>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }, []);

  const invalidate = useCallback(
    (keys: string[]) => {
      queryClient.invalidateQueries({ queryKey: keys });
    },
    [queryClient]
  );

  return useMemo(
    () => ({ get, post, put, patch, del, upload, invalidate, queryClient }),
    [get, post, put, patch, del, upload, invalidate, queryClient]
  );
}

// ---- Orders ----

export function usePortalOrders(params?: { status?: string; search?: string; page?: number; pageSize?: number }) {
  const api = usePortalApi();
  return useQuery({
    queryKey: ['portal-orders', params],
    queryFn: () =>
      api.get<PaginatedResponse<PortalOrder>>('/orders', {
        params,
      }),
  });
}

export function usePortalOrder(id: string) {
  const api = usePortalApi();
  return useQuery({
    queryKey: ['portal-order', id],
    queryFn: () => api.get<PortalOrderDetail>(`/orders/${id}`),
    enabled: !!id,
  });
}

export function useCreatePortalOrder() {
  const api = usePortalApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePortalOrderInput) => api.post<PortalOrder>('/orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-orders'] });
    },
  });
}

// ---- Samples ----

export function usePortalSamples(params?: { status?: string; search?: string; page?: number; pageSize?: number }) {
  const api = usePortalApi();
  return useQuery({
    queryKey: ['portal-samples', params],
    queryFn: () =>
      api.get<PaginatedResponse<PortalSample>>('/samples', {
        params,
      }),
  });
}

export function usePortalSample(id: string) {
  const api = usePortalApi();
  return useQuery({
    queryKey: ['portal-sample', id],
    queryFn: () => api.get<PortalSampleDetail>(`/samples/${id}`),
    enabled: !!id,
  });
}

// ---- Reports ----

export function usePortalReports(params?: { page?: number; pageSize?: number }) {
  const api = usePortalApi();
  return useQuery({
    queryKey: ['portal-reports', params],
    queryFn: () =>
      api.get<PaginatedResponse<PortalReport>>('/reports', {
        params,
      }),
  });
}

// ---- Invoices ----

export function usePortalInvoices(params?: { status?: string; page?: number; pageSize?: number }) {
  const api = usePortalApi();
  return useQuery({
    queryKey: ['portal-invoices', params],
    queryFn: () =>
      api.get<PaginatedResponse<PortalInvoice>>('/invoices', {
        params,
      }),
  });
}

export function usePortalInvoice(id: string) {
  const api = usePortalApi();
  return useQuery({
    queryKey: ['portal-invoice', id],
    queryFn: () => api.get<PortalInvoiceDetail>(`/invoices/${id}`),
    enabled: !!id,
  });
}

export function useCreatePaymentIntent() {
  const api = usePortalApi();
  return useMutation({
    mutationFn: (invoiceId: string) =>
      api.post<{ clientSecret: string; paymentIntentId: string }>(`/invoices/${invoiceId}/pay`),
  });
}

// ---- Test Methods ----

export function usePortalTestMethods() {
  const api = usePortalApi();
  return useQuery({
    queryKey: ['portal-test-methods'],
    queryFn: () => api.get<PortalTestMethod[]>('/test-methods'),
  });
}

// ---- Dashboard ----

export function usePortalDashboard() {
  const api = usePortalApi();
  return useQuery({
    queryKey: ['portal-dashboard'],
    queryFn: () => api.get<PortalDashboardData>('/dashboard'),
  });
}

// ---- Account ----

export function usePortalProfile() {
  const api = usePortalApi();
  return useQuery({
    queryKey: ['portal-profile'],
    queryFn: () => api.get<PortalProfile>('/account/profile'),
  });
}

export function useUpdatePortalProfile() {
  const api = usePortalApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePortalProfileInput) => api.put<PortalProfile>('/account/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-profile'] });
    },
  });
}

export function usePortalTeamMembers() {
  const api = usePortalApi();
  return useQuery({
    queryKey: ['portal-team'],
    queryFn: () => api.get<PortalTeamMember[]>('/account/team'),
  });
}

export function useInviteTeamMember() {
  const api = usePortalApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteTeamMemberInput) => api.post<PortalTeamMember>('/account/team/invite', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-team'] });
    },
  });
}

export function useRemoveTeamMember() {
  const api = usePortalApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => api.del(`/account/team/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-team'] });
    },
  });
}

export function usePortalPaymentMethods() {
  const api = usePortalApi();
  return useQuery({
    queryKey: ['portal-payment-methods'],
    queryFn: () => api.get<PortalPaymentMethod[]>('/account/payment-methods'),
  });
}

export function usePortalPaymentHistory(params?: { page?: number; pageSize?: number }) {
  const api = usePortalApi();
  return useQuery({
    queryKey: ['portal-payment-history', params],
    queryFn: () =>
      api.get<PaginatedResponse<PortalPaymentRecord>>('/account/payments', {
        params,
      }),
  });
}

// ---- Support ----

export function useSubmitSupportRequest() {
  const api = usePortalApi();
  return useMutation({
    mutationFn: (data: SupportRequestInput) => api.post('/support', data),
  });
}

// ---- File Upload ----

export function useUploadOrderFile() {
  const api = usePortalApi();
  return useMutation({
    mutationFn: ({ orderId, formData }: { orderId?: string; formData: FormData }) =>
      api.upload<{ fileId: string; fileName: string; url: string }>(
        orderId ? `/orders/${orderId}/files` : '/orders/files',
        formData
      ),
  });
}

// ---- Portal Types ----

export interface PortalOrder {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  sampleCount: number;
  testCount: number;
  completedTestCount: number;
  clientPO: string | null;
  clientReference: string | null;
  receivedDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortalOrderSample {
  id: string;
  sampleNumber: string;
  name: string | null;
  status: string;
  sampleType: string | null;
  matrix: string | null;
  tests: PortalOrderTest[];
}

export interface PortalOrderTest {
  id: string;
  methodName: string;
  methodCode: string;
  status: string;
  overallResult: string | null;
}

export interface PortalOrderDetail extends PortalOrder {
  samples: PortalOrderSample[];
  attachments: { id: string; fileName: string; fileSize: number; uploadedAt: string }[];
  notes: string | null;
  shippingMethod: string | null;
  trackingNumber: string | null;
  rushRequested: boolean;
}

export interface CreatePortalOrderInput {
  testMethodIds: string[];
  samples: {
    name: string;
    sampleType?: string;
    matrix?: string;
    description?: string;
    collectedDate?: string;
    collectionLocation?: string;
  }[];
  priority?: string;
  clientPO?: string;
  clientReference?: string;
  rushRequested?: boolean;
  turnaroundDays?: number;
  notes?: string;
  fileIds?: string[];
}

export interface PortalSample {
  id: string;
  sampleNumber: string;
  name: string | null;
  orderId: string;
  orderNumber: string;
  status: string;
  sampleType: string | null;
  matrix: string | null;
  testCount: number;
  completedTestCount: number;
  createdAt: string;
}

export interface PortalSampleTest {
  id: string;
  methodName: string;
  methodCode: string;
  status: string;
  overallResult: string | null;
  completedDate: string | null;
  results: PortalTestResult[];
}

export interface PortalTestResult {
  analyteName: string;
  analyteCode: string;
  finalValue: string | null;
  unit: string | null;
  passStatus: string | null;
  specMin: number | null;
  specMax: number | null;
}

export interface PortalSampleDetail extends PortalSample {
  description: string | null;
  collectedDate: string | null;
  collectionLocation: string | null;
  receivedDate: string | null;
  tests: PortalSampleTest[];
}

export interface PortalReport {
  id: string;
  reportNumber: string;
  orderNumber: string;
  orderId: string;
  title: string;
  type: string;
  generatedAt: string;
  downloadUrl: string;
  fileSize: number;
}

export interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string | null;
  dueDate: string | null;
  total: number;
  balanceDue: number;
  isOverdue: boolean;
}

export interface PortalInvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface PortalInvoiceDetail extends PortalInvoice {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  rushSurcharge: number;
  paymentTerms: string;
  clientPO: string | null;
  notes: string | null;
  lineItems: PortalInvoiceLineItem[];
  payments: { id: string; amount: number; method: string; paymentDate: string; status: string }[];
}

export interface PortalTestMethod {
  id: string;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  defaultTurnaroundDays: number;
  rushAvailable: boolean;
  rushTurnaroundDays: number | null;
  sampleMatrices: string[];
}

export interface PortalDashboardData {
  recentOrders: PortalOrder[];
  pendingSamples: PortalSample[];
  recentReports: PortalReport[];
  invoiceSummary: {
    outstandingCount: number;
    outstandingTotal: number;
    overdueCount: number;
    overdueTotal: number;
  };
  stats: {
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    totalSamples: number;
  };
}

export interface PortalProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  title: string | null;
  companyName: string;
  companyCode: string;
  role: string;
  notificationPrefs: {
    email: boolean;
    sampleReceived: boolean;
    testCompleted: boolean;
    reportReady: boolean;
    invoiceCreated: boolean;
    paymentReceived: boolean;
  };
}

export interface UpdatePortalProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  title?: string;
  notificationPrefs?: PortalProfile['notificationPrefs'];
  currentPassword?: string;
  newPassword?: string;
}

export interface PortalTeamMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface InviteTeamMemberInput {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface PortalPaymentMethod {
  id: string;
  type: string;
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

export interface PortalPaymentRecord {
  id: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  amount: number;
  method: string;
  status: string;
  paymentDate: string;
  referenceNumber: string | null;
}

export interface SupportRequestInput {
  subject: string;
  category: string;
  message: string;
  orderId?: string;
  priority?: string;
}
