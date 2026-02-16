import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  issueDate: string;
  dueDate: string;
  paidDate: string | null;
  lineItems: InvoiceLineItem[];
  createdAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sampleId?: string;
  testMethodId?: string;
}

export interface InvoiceFilters {
  status?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateInvoiceData {
  clientId: string;
  dueDate: string;
  notes?: string;
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    sampleId?: string;
    testMethodId?: string;
  }[];
}

export interface RecordPaymentData {
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
}

export function useInvoices(filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.set(key, String(value));
        }
      });
      const { data } = await api.get(`/billing/invoices?${params.toString()}`);
      return data as { items: Invoice[]; total: number; page: number; pageSize: number };
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: async () => {
      const { data } = await api.get(`/billing/invoices/${id}`);
      return data as Invoice;
    },
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceData: CreateInvoiceData) => {
      const { data } = await api.post('/billing/invoices', invoiceData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentData: RecordPaymentData) => {
      const { data } = await api.post('/billing/payments', paymentData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

export function usePayments(filters: { page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, String(value));
      });
      const { data } = await api.get(`/billing/payments?${params.toString()}`);
      return data as { items: any[]; total: number };
    },
  });
}

export function useAgingReport() {
  return useQuery({
    queryKey: ['aging-report'],
    queryFn: async () => {
      const { data } = await api.get('/billing/aging');
      return data as {
        current: number;
        days30: number;
        days60: number;
        days90: number;
        over90: number;
        total: number;
        clients: any[];
      };
    },
  });
}
