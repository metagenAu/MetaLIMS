'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Loader2,
  AlertCircle,
  X,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { clsx } from 'clsx';
import PortalLayout from '@/components/PortalLayout';
import {
  usePortalTestMethods,
  useCreatePortalOrder,
  useUploadOrderFile,
} from '@/hooks/usePortalApi';

const sampleSchema = z.object({
  name: z.string().min(1, 'Sample name is required').max(255),
  sampleType: z.string().optional(),
  matrix: z.string().optional(),
  description: z.string().optional(),
  collectedDate: z.string().optional(),
  collectionLocation: z.string().optional(),
});

const orderSchema = z.object({
  testMethodIds: z.array(z.string()).min(1, 'Select at least one test method'),
  samples: z.array(sampleSchema).min(1, 'Add at least one sample'),
  priority: z.string().optional(),
  clientPO: z.string().max(100).optional(),
  clientReference: z.string().max(255).optional(),
  rushRequested: z.boolean().optional(),
  turnaroundDays: z.coerce.number().int().min(1).max(365).optional(),
  notes: z.string().max(5000).optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

interface UploadedFile {
  fileId: string;
  fileName: string;
}

export default function NewOrderPage() {
  const router = useRouter();
  const { data: testMethods, isLoading: loadingMethods } = usePortalTestMethods();
  const createOrder = useCreatePortalOrder();
  const uploadFile = useUploadOrderFile();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(new Set());

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      testMethodIds: [],
      samples: [{ name: '', sampleType: '', matrix: '', description: '' }],
      priority: 'NORMAL',
      rushRequested: false,
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'samples',
  });

  const rushRequested = watch('rushRequested');

  function toggleTestMethod(methodId: string) {
    const newSelected = new Set(selectedMethods);
    if (newSelected.has(methodId)) {
      newSelected.delete(methodId);
    } else {
      newSelected.add(methodId);
    }
    setSelectedMethods(newSelected);
    setValue('testMethodIds', Array.from(newSelected));
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);

    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) {
        setUploadError(`File "${file.name}" exceeds 50MB limit.`);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        const result = await uploadFile.mutateAsync({ formData });
        setUploadedFiles((prev) => [
          ...prev,
          { fileId: result.fileId, fileName: result.fileName },
        ]);
      } catch {
        setUploadError(`Failed to upload "${file.name}". Please try again.`);
      }
    }

    event.target.value = '';
  }

  function removeFile(fileId: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.fileId !== fileId));
  }

  async function onSubmit(data: OrderFormData) {
    try {
      const result = await createOrder.mutateAsync({
        ...data,
        fileIds: uploadedFiles.map((f) => f.fileId),
      });
      router.push(`/orders/${result.id}`);
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <PortalLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Submit New Order</h1>
          <p className="text-sm text-muted-foreground">
            Select tests, describe your samples, and submit your order.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {createOrder.error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Failed to submit order. Please check your inputs and try again.
            </div>
          )}

          {/* Test Method Selection */}
          <div className="rounded-lg border border-border bg-white p-5">
            <h2 className="text-base font-semibold text-foreground">
              1. Select Test Methods
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the tests you need performed on your samples.
            </p>
            {errors.testMethodIds && (
              <p className="mt-2 text-sm text-destructive">{errors.testMethodIds.message}</p>
            )}

            {loadingMethods ? (
              <div className="mt-4 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading available tests...</span>
              </div>
            ) : !testMethods || testMethods.length === 0 ? (
              <div className="mt-4 text-sm text-muted-foreground">
                No test methods available. Please contact support.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {testMethods.map((method) => {
                  const isSelected = selectedMethods.has(method.id);
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => toggleTestMethod(method.id)}
                      className={clsx(
                        'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      )}
                    >
                      <div
                        className={clsx(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                          isSelected
                            ? 'border-primary bg-primary text-white'
                            : 'border-input'
                        )}
                      >
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{method.name}</p>
                        <p className="text-xs text-muted-foreground">{method.code}</p>
                        {method.description && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {method.description}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{method.defaultTurnaroundDays} day TAT</span>
                          {method.rushAvailable && (
                            <span className="text-amber-600">Rush available</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Samples */}
          <div className="rounded-lg border border-border bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  2. Describe Your Samples
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Provide details about each sample you are submitting.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  append({ name: '', sampleType: '', matrix: '', description: '' })
                }
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                <Plus className="h-4 w-4" />
                Add Sample
              </button>
            </div>

            {errors.samples && typeof errors.samples === 'object' && 'message' in errors.samples && (
              <p className="mt-2 text-sm text-destructive">
                {(errors.samples as { message?: string }).message}
              </p>
            )}

            <div className="mt-4 space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-lg border border-border bg-muted/30 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">
                      Sample {index + 1}
                    </h3>
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

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Sample Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Water Sample A"
                        className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        {...register(`samples.${index}.name`)}
                      />
                      {errors.samples?.[index]?.name && (
                        <p className="mt-1 text-xs text-destructive">
                          {errors.samples[index]?.name?.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Sample Type
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Water, Soil, Food"
                        className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        {...register(`samples.${index}.sampleType`)}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Matrix
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Drinking Water, Soil"
                        className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        {...register(`samples.${index}.matrix`)}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Collection Date
                      </label>
                      <input
                        type="date"
                        className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        {...register(`samples.${index}.collectedDate`)}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Collection Location
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Site A, Tap 1"
                        className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        {...register(`samples.${index}.collectionLocation`)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Description
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Additional details about this sample..."
                        className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        {...register(`samples.${index}.description`)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Details */}
          <div className="rounded-lg border border-border bg-white p-5">
            <h2 className="text-base font-semibold text-foreground">3. Order Details</h2>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Client PO Number
                </label>
                <input
                  type="text"
                  placeholder="Your purchase order number"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register('clientPO')}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Client Reference
                </label>
                <input
                  type="text"
                  placeholder="Your internal reference"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register('clientReference')}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Priority
                </label>
                <select
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register('priority')}
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Requested Turnaround (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  placeholder="e.g., 5"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register('turnaroundDays')}
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center gap-3">
                  <input
                    id="rushRequested"
                    type="checkbox"
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20"
                    {...register('rushRequested')}
                  />
                  <label htmlFor="rushRequested" className="text-sm font-medium text-foreground">
                    Request Rush Processing
                  </label>
                </div>
                {rushRequested && (
                  <p className="mt-1 ml-7 text-xs text-amber-600">
                    Rush processing may incur additional surcharges. Our team will confirm
                    availability and pricing.
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Any special instructions or additional information..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register('notes')}
                />
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="rounded-lg border border-border bg-white p-5">
            <h2 className="text-base font-semibold text-foreground">
              4. Upload Files{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Attach chain of custody forms, sampling data sheets, or other documents.
            </p>

            <div className="mt-4">
              <label className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-border py-8 hover:border-primary/50 hover:bg-muted/50">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground">
                  Click to upload files
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF, DOC, XLSX, CSV, images up to 50MB each
                </p>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                />
              </label>

              {uploadFile.isPending && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </div>
              )}

              {uploadError && (
                <p className="mt-2 text-sm text-destructive">{uploadError}</p>
              )}

              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.fileId}
                      className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{file.fileName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(file.fileId)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <Link
              href="/orders"
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || createOrder.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {(isSubmitting || createOrder.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Submit Order
            </button>
          </div>
        </form>
      </div>
    </PortalLayout>
  );
}
