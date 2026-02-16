import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Sample {
  id: string;
  sampleId: string;
  clientId: string;
  clientName: string;
  matrix: string;
  description: string;
  status: string;
  collectionDate: string;
  receivedDate: string | null;
  dueDate: string;
  priority: 'normal' | 'rush' | 'urgent';
  location: string;
  assignedTo: string | null;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SampleFilters {
  status?: string;
  matrix?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateSampleData {
  clientId: string;
  matrix: string;
  description: string;
  collectionDate: string;
  dueDate: string;
  priority: string;
  tests: string[];
  notes?: string;
}

export function useSamples(filters: SampleFilters = {}) {
  return useQuery({
    queryKey: ['samples', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.set(key, String(value));
        }
      });
      const { data } = await api.get(`/samples?${params.toString()}`);
      return data as { items: Sample[]; total: number; page: number; pageSize: number };
    },
  });
}

export function useSample(id: string) {
  return useQuery({
    queryKey: ['samples', id],
    queryFn: async () => {
      const { data } = await api.get(`/samples/${id}`);
      return data as Sample & {
        tests: any[];
        chainOfCustody: any[];
        notes: string;
      };
    },
    enabled: !!id,
  });
}

export function useCreateSample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sampleData: CreateSampleData) => {
      const { data } = await api.post('/samples', sampleData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
    },
  });
}

export function useUpdateSampleStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: string;
    }) => {
      const { data } = await api.patch(`/samples/${id}/status`, { status });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      queryClient.invalidateQueries({ queryKey: ['samples', variables.id] });
    },
  });
}

export function useReceiveSamples() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sampleIds: string[]) => {
      const { data } = await api.post('/samples/receive', { sampleIds });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
    },
  });
}
