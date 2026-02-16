'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

const paymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  paymentMethod: z.enum(['check', 'wire', 'credit_card', 'ach', 'cash']),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentFormProps {
  onSubmit: (data: PaymentFormData) => void;
  isSubmitting?: boolean;
  invoiceOptions?: { id: string; label: string; balance: number }[];
}

export function PaymentForm({
  onSubmit,
  isSubmitting = false,
  invoiceOptions = [],
}: PaymentFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentMethod: 'check' },
  });

  const selectedInvoice = watch('invoiceId');
  const selectedOption = invoiceOptions.find((o) => o.id === selectedInvoice);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Invoice *</label>
        <select
          {...register('invoiceId')}
          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select an invoice</option>
          {invoiceOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label} (Balance: ${opt.balance.toFixed(2)})
            </option>
          ))}
        </select>
        {errors.invoiceId && <p className="mt-1 text-xs text-destructive">{errors.invoiceId.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Amount *</label>
          <input
            type="number"
            step="0.01"
            {...register('amount', { valueAsNumber: true })}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="0.00"
          />
          {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount.message}</p>}
          {selectedOption && (
            <button
              type="button"
              onClick={() => setValue('amount', selectedOption.balance)}
              className="mt-1 text-xs text-primary hover:underline"
            >
              Pay full balance (${selectedOption.balance.toFixed(2)})
            </button>
          )}
        </div>
        <div>
          <label className="text-sm font-medium">Payment Method *</label>
          <select
            {...register('paymentMethod')}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="check">Check</option>
            <option value="wire">Wire Transfer</option>
            <option value="ach">ACH</option>
            <option value="credit_card">Credit Card</option>
            <option value="cash">Cash</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Reference Number</label>
        <input
          {...register('referenceNumber')}
          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Check #, Wire ref, etc."
        />
      </div>

      <div>
        <label className="text-sm font-medium">Notes</label>
        <textarea
          {...register('notes')}
          rows={2}
          className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Optional notes..."
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : 'Record Payment'}
      </button>
    </form>
  );
}
