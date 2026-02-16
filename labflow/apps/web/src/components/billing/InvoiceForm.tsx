'use client';

import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

const invoiceSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  notes: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1, 'Description is required'),
        quantity: z.number().min(1, 'Quantity must be at least 1'),
        unitPrice: z.number().min(0, 'Price must be positive'),
      })
    )
    .min(1, 'At least one line item is required'),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
  onSubmit: (data: InvoiceFormData) => void;
  isSubmitting?: boolean;
}

export function InvoiceForm({ onSubmit, isSubmitting = false }: InvoiceFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      lineItems: [{ description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const watchedItems = watch('lineItems');

  const total = watchedItems.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Client *</label>
          <select
            {...register('clientId')}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select a client</option>
            <option value="c1">Acme Environmental</option>
            <option value="c2">GreenTech Labs</option>
            <option value="c3">Riverside Water Authority</option>
            <option value="c4">Metro Health Department</option>
          </select>
          {errors.clientId && <p className="mt-1 text-xs text-destructive">{errors.clientId.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">Due Date *</label>
          <input type="date" {...register('dueDate')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          {errors.dueDate && <p className="mt-1 text-xs text-destructive">{errors.dueDate.message}</p>}
        </div>
      </div>

      {/* Line Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Line Items</h3>
          <button
            type="button"
            onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
            className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </button>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-center font-medium w-24">Qty</th>
                <th className="px-3 py-2 text-center font-medium w-32">Unit Price</th>
                <th className="px-3 py-2 text-right font-medium w-28">Amount</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {fields.map((field, index) => {
                const lineTotal = (watchedItems[index]?.quantity || 0) * (watchedItems[index]?.unitPrice || 0);
                return (
                  <tr key={field.id}>
                    <td className="px-3 py-1.5">
                      <input
                        {...register(`lineItems.${index}.description`)}
                        className="flex h-8 w-full rounded border border-input bg-background px-2 text-sm"
                        placeholder="Description"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        {...register(`lineItems.${index}.quantity`, { valueAsNumber: true })}
                        className="flex h-8 w-full rounded border border-input bg-background px-2 text-center text-sm"
                        min="1"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true })}
                        className="flex h-8 w-full rounded border border-input bg-background px-2 text-center text-sm"
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium">
                      {formatCurrency(lineTotal)}
                    </td>
                    <td className="px-3 py-1.5">
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(index)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td colSpan={3} className="px-3 py-2 text-right font-medium">Total</td>
                <td className="px-3 py-2 text-right font-bold">{formatCurrency(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-sm font-medium">Notes (Optional)</label>
        <textarea {...register('notes')} rows={2} className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Invoice notes..." />
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => window.history.back()} className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create Invoice'}
        </button>
      </div>
    </form>
  );
}
