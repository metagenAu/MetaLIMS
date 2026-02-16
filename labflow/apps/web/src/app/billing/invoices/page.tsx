'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { InvoiceTable } from '@/components/billing/InvoiceTable';
import { SearchInput } from '@/components/common/SearchInput';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { useInvoices, InvoiceFilters, Invoice } from '@/hooks/useInvoices';
import { formatCurrency } from '@/lib/formatters';

const fallbackInvoices: Invoice[] = [
  { id: 'i1', invoiceNumber: 'INV-2024-0156', clientId: 'c1', clientName: 'Acme Environmental', status: 'overdue', totalAmount: 5200, paidAmount: 0, balanceDue: 5200, issueDate: '2024-01-08T00:00:00Z', dueDate: '2024-01-08T00:00:00Z', paidDate: null, lineItems: [], createdAt: '2024-01-08T00:00:00Z' },
  { id: 'i2', invoiceNumber: 'INV-2024-0155', clientId: 'c2', clientName: 'GreenTech Labs', status: 'sent', totalAmount: 3750, paidAmount: 0, balanceDue: 3750, issueDate: '2024-01-14T00:00:00Z', dueDate: '2024-02-14T00:00:00Z', paidDate: null, lineItems: [], createdAt: '2024-01-14T00:00:00Z' },
  { id: 'i3', invoiceNumber: 'INV-2024-0154', clientId: 'c3', clientName: 'Riverside Water Authority', status: 'paid', totalAmount: 8400, paidAmount: 8400, balanceDue: 0, issueDate: '2024-01-05T00:00:00Z', dueDate: '2024-02-05T00:00:00Z', paidDate: '2024-01-20T00:00:00Z', lineItems: [], createdAt: '2024-01-05T00:00:00Z' },
  { id: 'i4', invoiceNumber: 'INV-2024-0153', clientId: 'c4', clientName: 'Metro Health Department', status: 'partial', totalAmount: 6100, paidAmount: 3000, balanceDue: 3100, issueDate: '2024-01-02T00:00:00Z', dueDate: '2024-02-02T00:00:00Z', paidDate: null, lineItems: [], createdAt: '2024-01-02T00:00:00Z' },
  { id: 'i5', invoiceNumber: 'INV-2024-0152', clientId: 'c1', clientName: 'Acme Environmental', status: 'overdue', totalAmount: 2400, paidAmount: 0, balanceDue: 2400, issueDate: '2023-12-20T00:00:00Z', dueDate: '2024-01-20T00:00:00Z', paidDate: null, lineItems: [], createdAt: '2023-12-20T00:00:00Z' },
];

export default function InvoicesPage() {
  const [filters, setFilters] = useState<InvoiceFilters>({ page: 1, pageSize: 20 });
  const { data, isLoading, error } = useInvoices(filters);

  const invoices = data?.items || fallbackInvoices;
  const overdueAmount = invoices.filter((i) => i.status === 'overdue').reduce((sum, i) => sum + i.balanceDue, 0);
  const totalOutstanding = invoices.reduce((sum, i) => sum + i.balanceDue, 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Invoices</h1>
            <p className="text-muted-foreground">
              Manage billing and track payments
            </p>
          </div>
          <Link href="/billing/invoices/new" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Create Invoice
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Outstanding</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(totalOutstanding)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Overdue Amount</p>
            <p className="text-xl font-bold mt-1 text-destructive">{formatCurrency(overdueAmount)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Overdue Invoices</p>
            <p className="text-xl font-bold mt-1">{invoices.filter((i) => i.status === 'overdue').length}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={filters.search}
            onChange={(value) => setFilters((prev) => ({ ...prev, search: value, page: 1 }))}
            placeholder="Search invoices..."
            className="w-64"
          />
          <select
            value={filters.status || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="void">Void</option>
          </select>
          <DateRangePicker
            value={filters.dateFrom && filters.dateTo ? { from: filters.dateFrom, to: filters.dateTo } : undefined}
            onChange={(range) => setFilters((prev) => ({ ...prev, dateFrom: range.from, dateTo: range.to, page: 1 }))}
            className="w-64"
          />
        </div>

        <InvoiceTable
          data={invoices}
          isLoading={isLoading}
          error={error ? 'Failed to load invoices' : null}
          totalCount={data?.total}
          currentPage={filters.page}
          onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
        />
      </div>
    </MainLayout>
  );
}
