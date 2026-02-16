'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { InvoiceForm } from '@/components/billing/InvoiceForm';
import { useCreateInvoice } from '@/hooks/useInvoices';

export default function NewInvoicePage() {
  const router = useRouter();
  const createInvoice = useCreateInvoice();

  const handleSubmit = async (data: any) => {
    try {
      await createInvoice.mutateAsync(data);
      router.push('/billing/invoices');
    } catch {
      // Error handled by react-query
    }
  };

  return (
    <MainLayout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Create Invoice</h1>
          <p className="text-muted-foreground">Create a new invoice for a client</p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <InvoiceForm onSubmit={handleSubmit} isSubmitting={createInvoice.isPending} />
        </div>

        {createInvoice.isError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            Failed to create invoice. Please try again.
          </div>
        )}
      </div>
    </MainLayout>
  );
}
