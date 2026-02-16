'use client';

import React, { useState } from 'react';
import { DollarSign, Plus } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { MainLayout } from '@/components/layout/MainLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { PaymentForm } from '@/components/billing/PaymentForm';
import { useRecordPayment } from '@/hooks/useInvoices';
import { formatDate, formatCurrency } from '@/lib/formatters';

interface Payment {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string;
  date: string;
}

const fallbackPayments: Payment[] = [
  { id: 'p1', invoiceNumber: 'INV-2024-0154', clientName: 'Riverside Water Authority', amount: 8400, paymentMethod: 'Wire Transfer', referenceNumber: 'WT-44521', date: '2024-01-20T00:00:00Z' },
  { id: 'p2', invoiceNumber: 'INV-2024-0153', clientName: 'Metro Health Department', amount: 3000, paymentMethod: 'Check', referenceNumber: '#8842', date: '2024-01-18T00:00:00Z' },
  { id: 'p3', invoiceNumber: 'INV-2024-0142', clientName: 'Acme Environmental', amount: 1850, paymentMethod: 'ACH', referenceNumber: 'ACH-22091', date: '2024-01-15T00:00:00Z' },
  { id: 'p4', invoiceNumber: 'INV-2023-0891', clientName: 'Acme Environmental', amount: 4100, paymentMethod: 'Check', referenceNumber: '#8791', date: '2024-01-05T00:00:00Z' },
];

const invoiceOptions = [
  { id: 'i1', label: 'INV-2024-0156 - Acme Environmental', balance: 5200 },
  { id: 'i2', label: 'INV-2024-0155 - GreenTech Labs', balance: 3750 },
  { id: 'i4', label: 'INV-2024-0153 - Metro Health Dept.', balance: 3100 },
  { id: 'i5', label: 'INV-2024-0152 - Acme Environmental', balance: 2400 },
];

export default function PaymentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const recordPayment = useRecordPayment();

  const columns: Column<Payment>[] = [
    { key: 'invoiceNumber', header: 'Invoice', sortable: true },
    { key: 'clientName', header: 'Client', sortable: true },
    { key: 'amount', header: 'Amount', sortable: true, cell: (row) => formatCurrency(row.amount) },
    { key: 'paymentMethod', header: 'Method' },
    { key: 'referenceNumber', header: 'Reference' },
    { key: 'date', header: 'Date', sortable: true, cell: (row) => formatDate(row.date) },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Payments</h1>
            <p className="text-muted-foreground">Payment history and recording</p>
          </div>
          <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
            <Dialog.Trigger asChild>
              <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Record Payment
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
              <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-lg border bg-card p-6 shadow-lg">
                <Dialog.Title className="text-lg font-semibold mb-4">Record Payment</Dialog.Title>
                <PaymentForm
                  invoiceOptions={invoiceOptions}
                  onSubmit={(data) => {
                    recordPayment.mutate(data);
                    setDialogOpen(false);
                  }}
                  isSubmitting={recordPayment.isPending}
                />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>

        <DataTable columns={columns} data={fallbackPayments} emptyMessage="No payments recorded." />
      </div>
    </MainLayout>
  );
}
