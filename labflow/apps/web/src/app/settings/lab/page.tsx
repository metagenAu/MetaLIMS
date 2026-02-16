'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, Upload, Beaker } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { FileUpload } from '@/components/common/FileUpload';
import api from '@/lib/api';

const labSettingsSchema = z.object({
  name: z.string().min(1, 'Lab name is required'),
  legalName: z.string().min(1, 'Legal name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(5, 'Zip code is required'),
  phone: z.string().min(10, 'Phone number is required'),
  email: z.string().email('Valid email required'),
  website: z.string().optional(),
  accreditationNumber: z.string().optional(),
  accreditationBody: z.string().optional(),
  timezone: z.string(),
  dateFormat: z.string(),
  currency: z.string(),
  defaultPaymentTerms: z.string(),
  reportHeader: z.string().optional(),
  reportFooter: z.string().optional(),
});

type LabSettingsFormData = z.infer<typeof labSettingsSchema>;

const defaultValues: LabSettingsFormData = {
  name: 'LabFlow Environmental Testing',
  legalName: 'LabFlow Environmental Testing, LLC',
  address: '456 Science Park Drive',
  city: 'Springfield',
  state: 'IL',
  zipCode: '62704',
  phone: '5559876543',
  email: 'info@labflow-testing.com',
  website: 'https://labflow-testing.com',
  accreditationNumber: 'IL-LAB-2024-001',
  accreditationBody: 'NELAP',
  timezone: 'America/Chicago',
  dateFormat: 'MM/dd/yyyy',
  currency: 'USD',
  defaultPaymentTerms: 'net_30',
  reportHeader: 'LabFlow Environmental Testing - Certified Analytical Laboratory',
  reportFooter: 'This report shall not be reproduced except in full without written approval.',
};

export default function LabSettingsPage() {
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<LabSettingsFormData>({
    resolver: zodResolver(labSettingsSchema),
    defaultValues,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: LabSettingsFormData) => {
      await api.put('/settings/lab', data);
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <MainLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lab Settings</h1>
            <p className="text-muted-foreground">Configure lab profile, branding, and preferences</p>
          </div>
          {saved && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
              Settings saved successfully
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
          {/* Lab Identity */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Lab Identity</h2>

            <div className="flex items-center gap-6 mb-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed bg-muted/50">
                <Beaker className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Lab Logo</p>
                <p className="text-xs text-muted-foreground mb-2">Upload your lab logo for reports and branding</p>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" />
                  Upload Logo
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Lab Name *</label>
                <input {...register('name')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Legal Name *</label>
                <input {...register('legalName')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                {errors.legalName && <p className="mt-1 text-xs text-destructive">{errors.legalName.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Phone *</label>
                <input {...register('phone')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Email *</label>
                <input type="email" {...register('email')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Website</label>
                <input {...register('website')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Address</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Street Address *</label>
                <input {...register('address')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium">City *</label>
                <input {...register('city')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">State *</label>
                  <input {...register('state')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium">Zip Code *</label>
                  <input {...register('zipCode')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
              </div>
            </div>
          </div>

          {/* Accreditation */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Accreditation</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Accreditation Number</label>
                <input {...register('accreditationNumber')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium">Accreditation Body</label>
                <select {...register('accreditationBody')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Select</option>
                  <option value="NELAP">NELAP</option>
                  <option value="A2LA">A2LA</option>
                  <option value="AIHA-LAP">AIHA-LAP</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Preferences</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-sm font-medium">Timezone</label>
                <select {...register('timezone')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="America/New_York">Eastern</option>
                  <option value="America/Chicago">Central</option>
                  <option value="America/Denver">Mountain</option>
                  <option value="America/Los_Angeles">Pacific</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Date Format</label>
                <select {...register('dateFormat')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="MM/dd/yyyy">MM/DD/YYYY</option>
                  <option value="dd/MM/yyyy">DD/MM/YYYY</option>
                  <option value="yyyy-MM-dd">YYYY-MM-DD</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Currency</label>
                <select {...register('currency')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Default Payment Terms</label>
                <select {...register('defaultPaymentTerms')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="prepaid">Prepaid</option>
                  <option value="net_15">Net 15</option>
                  <option value="net_30">Net 30</option>
                  <option value="net_45">Net 45</option>
                  <option value="net_60">Net 60</option>
                </select>
              </div>
            </div>
          </div>

          {/* Report Branding */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Report Branding</h2>
            <div>
              <label className="text-sm font-medium">Report Header Text</label>
              <textarea {...register('reportHeader')} rows={2} className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div>
              <label className="text-sm font-medium">Report Footer Text</label>
              <textarea {...register('reportFooter')} rows={2} className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saveMutation.isPending || !isDirty}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
              ) : (
                <><Save className="h-4 w-4" />Save Settings</>
              )}
            </button>
          </div>

          {saveMutation.isError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              Failed to save settings. Please try again.
            </div>
          )}
        </form>
      </div>
    </MainLayout>
  );
}
