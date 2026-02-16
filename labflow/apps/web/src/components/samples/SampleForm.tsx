'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

const sampleSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  matrix: z.string().min(1, 'Matrix is required'),
  description: z.string().min(1, 'Description is required'),
  collectionDate: z.string().min(1, 'Collection date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  priority: z.enum(['normal', 'rush', 'urgent']),
  tests: z.array(z.string()).min(1, 'At least one test is required'),
  notes: z.string().optional(),
});

type SampleFormData = z.infer<typeof sampleSchema>;

interface SampleFormProps {
  onSubmit: (data: SampleFormData) => void;
  isSubmitting?: boolean;
  defaultValues?: Partial<SampleFormData>;
}

const matrices = [
  'Drinking Water',
  'Wastewater',
  'Groundwater',
  'Surface Water',
  'Soil',
  'Air',
  'Solid Waste',
  'Food',
  'Other',
];

const availableTests = [
  { id: 'metals', label: 'Heavy Metals (ICP-MS)' },
  { id: 'vocs', label: 'Volatile Organic Compounds' },
  { id: 'svocs', label: 'Semi-Volatile Organic Compounds' },
  { id: 'nutrients', label: 'Nutrients (N, P)' },
  { id: 'micro', label: 'Microbiology (Total Coliform, E. Coli)' },
  { id: 'pesticides', label: 'Pesticides' },
  { id: 'ph', label: 'pH' },
  { id: 'conductivity', label: 'Conductivity' },
  { id: 'turbidity', label: 'Turbidity' },
  { id: 'tds', label: 'Total Dissolved Solids' },
  { id: 'tss', label: 'Total Suspended Solids' },
  { id: 'bod', label: 'BOD' },
  { id: 'cod', label: 'COD' },
];

export function SampleForm({
  onSubmit,
  isSubmitting = false,
  defaultValues,
}: SampleFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<SampleFormData>({
    resolver: zodResolver(sampleSchema),
    defaultValues: {
      priority: 'normal',
      tests: [],
      ...defaultValues,
    },
  });

  const selectedTests = watch('tests') || [];

  const toggleTest = (testId: string) => {
    const current = selectedTests;
    if (current.includes(testId)) {
      setValue(
        'tests',
        current.filter((t) => t !== testId)
      );
    } else {
      setValue('tests', [...current, testId]);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Client */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Client *</label>
          <select
            {...register('clientId')}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select a client</option>
            <option value="client-1">Acme Environmental</option>
            <option value="client-2">GreenTech Labs</option>
            <option value="client-3">Riverside Water Authority</option>
            <option value="client-4">Metro Health Department</option>
            <option value="client-5">Pacific Agriculture Co.</option>
          </select>
          {errors.clientId && (
            <p className="mt-1 text-xs text-destructive">
              {errors.clientId.message}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Matrix *</label>
          <select
            {...register('matrix')}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select matrix type</option>
            {matrices.map((m) => (
              <option key={m} value={m.toLowerCase().replace(/\s+/g, '_')}>
                {m}
              </option>
            ))}
          </select>
          {errors.matrix && (
            <p className="mt-1 text-xs text-destructive">
              {errors.matrix.message}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-sm font-medium">Description *</label>
        <textarea
          {...register('description')}
          rows={3}
          className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Describe the sample, collection point, or other identifying information..."
        />
        {errors.description && (
          <p className="mt-1 text-xs text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Dates & Priority */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Collection Date *</label>
          <input
            type="date"
            {...register('collectionDate')}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {errors.collectionDate && (
            <p className="mt-1 text-xs text-destructive">
              {errors.collectionDate.message}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Due Date *</label>
          <input
            type="date"
            {...register('dueDate')}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {errors.dueDate && (
            <p className="mt-1 text-xs text-destructive">
              {errors.dueDate.message}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Priority</label>
          <select
            {...register('priority')}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="normal">Normal</option>
            <option value="rush">Rush (+50% fee)</option>
            <option value="urgent">Urgent (+100% fee)</option>
          </select>
        </div>
      </div>

      {/* Test Selection */}
      <div>
        <label className="text-sm font-medium">Tests *</label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">
          Select the analyses to perform on this sample
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {availableTests.map((test) => (
            <label
              key={test.id}
              className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer transition-colors ${
                selectedTests.includes(test.id)
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedTests.includes(test.id)}
                onChange={() => toggleTest(test.id)}
                className="rounded border-input"
              />
              <span className="text-sm">{test.label}</span>
            </label>
          ))}
        </div>
        {errors.tests && (
          <p className="mt-1 text-xs text-destructive">
            {errors.tests.message}
          </p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="text-sm font-medium">Notes (Optional)</label>
        <textarea
          {...register('notes')}
          rows={2}
          className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Any additional notes or special instructions..."
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Registering...
            </>
          ) : (
            'Register Sample'
          )}
        </button>
      </div>
    </form>
  );
}
