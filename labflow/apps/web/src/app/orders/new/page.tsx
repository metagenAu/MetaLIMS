'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useCreateOrder } from '@/hooks/useOrders';

const orderSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  contactName: z.string().min(1, 'Contact name is required'),
  contactEmail: z.string().email('Valid email required'),
  dueDate: z.string().min(1, 'Due date is required'),
  priority: z.enum(['normal', 'rush', 'urgent']),
  notes: z.string().optional(),
  samples: z
    .array(
      z.object({
        matrix: z.string().min(1, 'Matrix is required'),
        description: z.string().min(1, 'Description is required'),
        collectionDate: z.string().min(1, 'Collection date is required'),
        tests: z.array(z.string()).min(1, 'Select at least one test'),
      })
    )
    .min(1, 'At least one sample is required'),
});

type OrderFormData = z.infer<typeof orderSchema>;

const matrices = [
  'Drinking Water', 'Wastewater', 'Groundwater', 'Surface Water', 'Soil', 'Air',
];

const testOptions = [
  { id: 'metals', label: 'Heavy Metals' },
  { id: 'vocs', label: 'VOCs' },
  { id: 'svocs', label: 'SVOCs' },
  { id: 'nutrients', label: 'Nutrients' },
  { id: 'micro', label: 'Microbiology' },
  { id: 'ph', label: 'pH / Conductivity' },
  { id: 'tss', label: 'TSS / TDS' },
];

export default function NewOrderPage() {
  const router = useRouter();
  const createOrder = useCreateOrder();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
    setValue,
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      priority: 'normal',
      samples: [{ matrix: '', description: '', collectionDate: '', tests: [] }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'samples',
  });

  const watchedSamples = watch('samples');

  const toggleTest = (sampleIndex: number, testId: string) => {
    const current = watchedSamples[sampleIndex]?.tests || [];
    if (current.includes(testId)) {
      setValue(
        `samples.${sampleIndex}.tests`,
        current.filter((t) => t !== testId)
      );
    } else {
      setValue(`samples.${sampleIndex}.tests`, [...current, testId]);
    }
  };

  const onSubmit = async (data: OrderFormData) => {
    try {
      await createOrder.mutateAsync(data);
      router.push('/orders');
    } catch {
      // Error handled by react-query
    }
  };

  return (
    <MainLayout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Create New Order</h1>
          <p className="text-muted-foreground">
            Create a work order with one or more samples
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Client & Contact */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Client Information
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Client *</label>
                <select
                  {...register('clientId')}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select a client</option>
                  <option value="client-1">Acme Environmental</option>
                  <option value="client-2">GreenTech Labs</option>
                  <option value="client-3">Riverside Water Authority</option>
                  <option value="client-4">Metro Health Department</option>
                </select>
                {errors.clientId && (
                  <p className="mt-1 text-xs text-destructive">{errors.clientId.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Contact Name *</label>
                <input
                  {...register('contactName')}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Contact person name"
                />
                {errors.contactName && (
                  <p className="mt-1 text-xs text-destructive">{errors.contactName.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Contact Email *</label>
                <input
                  type="email"
                  {...register('contactEmail')}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="email@company.com"
                />
                {errors.contactEmail && (
                  <p className="mt-1 text-xs text-destructive">{errors.contactEmail.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Due Date *</label>
                <input
                  type="date"
                  {...register('dueDate')}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {errors.dueDate && (
                  <p className="mt-1 text-xs text-destructive">{errors.dueDate.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Priority</label>
                <select
                  {...register('priority')}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="normal">Normal</option>
                  <option value="rush">Rush</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <input
                  {...register('notes')}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Optional notes..."
                />
              </div>
            </div>
          </div>

          {/* Samples */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Samples ({fields.length})
              </h2>
              <button
                type="button"
                onClick={() =>
                  append({
                    matrix: '',
                    description: '',
                    collectionDate: '',
                    tests: [],
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                <Plus className="h-4 w-4" />
                Add Sample
              </button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Sample {index + 1}</h3>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium">Matrix *</label>
                    <select
                      {...register(`samples.${index}.matrix`)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select</option>
                      {matrices.map((m) => (
                        <option key={m} value={m.toLowerCase().replace(/\s+/g, '_')}>
                          {m}
                        </option>
                      ))}
                    </select>
                    {errors.samples?.[index]?.matrix && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.samples[index]?.matrix?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium">Description *</label>
                    <input
                      {...register(`samples.${index}.description`)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Sample description"
                    />
                    {errors.samples?.[index]?.description && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.samples[index]?.description?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium">Collection Date *</label>
                    <input
                      type="date"
                      {...register(`samples.${index}.collectionDate`)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {errors.samples?.[index]?.collectionDate && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.samples[index]?.collectionDate?.message}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium">Tests *</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {testOptions.map((test) => {
                      const selected = (watchedSamples[index]?.tests || []).includes(test.id);
                      return (
                        <button
                          key={test.id}
                          type="button"
                          onClick={() => toggleTest(index, test.id)}
                          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                            selected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'hover:bg-muted'
                          }`}
                        >
                          {test.label}
                        </button>
                      );
                    })}
                  </div>
                  {errors.samples?.[index]?.tests && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.samples[index]?.tests?.message}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {errors.samples?.message && (
              <p className="text-xs text-destructive">{errors.samples.message}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createOrder.isPending}
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createOrder.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Order'
              )}
            </button>
          </div>

          {createOrder.isError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              Failed to create order. Please check the form and try again.
            </div>
          )}
        </form>
      </div>
    </MainLayout>
  );
}
