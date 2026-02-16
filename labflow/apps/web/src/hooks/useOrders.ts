import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Order {
  id: string;
  orderNumber: string;
  clientId: string;
  clientName: string;
  status: string;
  sampleCount: number;
  totalAmount: number;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetail extends Order {
  samples: any[];
  timeline: { event: string; timestamp: string; user: string }[];
  notes: string;
  contactName: string;
  contactEmail: string;
}

export interface OrderFilters {
  status?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateOrderData {
  clientId: string;
  contactName: string;
  contactEmail: string;
  dueDate: string;
  priority: string;
  notes?: string;
  samples: {
    matrix: string;
    description: string;
    collectionDate: string;
    tests: string[];
  }[];
}

export function useOrders(filters: OrderFilters = {}) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.set(key, String(value));
        }
      });
      const { data } = await api.get(`/orders?${params.toString()}`);
      return data as { items: Order[]; total: number; page: number; pageSize: number };
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data as OrderDetail;
    },
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: CreateOrderData) => {
      const { data } = await api.post('/orders', orderData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: string;
    }) => {
      const { data } = await api.patch(`/orders/${id}/status`, { status });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders', variables.id] });
    },
  });
}
