'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import api from '@/lib/api';

const clientSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  contactName: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(10, 'Valid phone number required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(5, 'Valid zip code required'),
  paymentTerms: z.enum(['net_15', 'net_30', 'net_45', 'net_60', 'prepaid']),
  notes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

export default function NewClientPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const createClient = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const { data: result } = await api.post('/clients', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      router.push('/clients');
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: { paymentTerms: 'net_30' },
  });

  return (
    <MainLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Add New Client</h1>
          <p className="text-muted-foreground">Register a new client account</p>
        </div>

        <form onSubmit={handleSubmit((data) => createClient.mutate(data))} className="space-y-6">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Company Details</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Company Name *</label>
                <input {...register('name')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Company name" />
                {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Contact Name *</label>
                <input {...register('contactName')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Primary contact" />
                {errors.contactName && <p className="mt-1 text-xs text-destructive">{errors.contactName.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Email *</label>
                <input type="email" {...register('email')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="email@company.com" />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Phone *</label>
                <input {...register('phone')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="(555) 123-4567" />
                {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Payment Terms</label>
                <select {...register('paymentTerms')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="prepaid">Prepaid</option>
                  <option value="net_15">Net 15</option>
                  <option value="net_30">Net 30</option>
                  <option value="net_45">Net 45</option>
                  <option value="net_60">Net 60</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Address</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Street Address *</label>
                <input {...register('address')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="123 Main St" />
                {errors.address && <p className="mt-1 text-xs text-destructive">{errors.address.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">City *</label>
                <input {...register('city')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="City" />
                {errors.city && <p className="mt-1 text-xs text-destructive">{errors.city.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">State *</label>
                  <input {...register('state')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="State" />
                  {errors.state && <p className="mt-1 text-xs text-destructive">{errors.state.message}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">Zip Code *</label>
                  <input {...register('zipCode')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="12345" />
                  {errors.zipCode && <p className="mt-1 text-xs text-destructive">{errors.zipCode.message}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <label className="text-sm font-medium">Notes (Optional)</label>
            <textarea {...register('notes')} rows={3} className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Any additional notes about this client..." />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => router.back()} className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
              Cancel
            </button>
            <button type="submit" disabled={createClient.isPending} className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {createClient.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Add Client'}
            </button>
          </div>

          {createClient.isError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              Failed to create client. Please try again.
            </div>
          )}
        </form>
      </div>
    </MainLayout>
  );
}
