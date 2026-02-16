'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  Receipt,
  Search,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Filter,
  DollarSign,
} from 'lucide-react';
import { clsx } from 'clsx';
import PortalLayout from '@/components/PortalLayout';
import InvoiceCard from '@/components/InvoiceCard';
import { usePortalInvoices } from '@/hooks/usePortalApi';

const STATUS_FILTERS = [
  { value: '', label: 'All Invoices' },
  { value: 'SENT', label: 'Sent' },
  { value: 'VIEWED', label: 'Viewed' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700' },
  PENDING_APPROVAL: { bg: 'bg-blue-100', text: 'text-blue-700' },
  APPROVED: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  SENT: { bg: 'bg-sky-100', text: 'text-sky-700' },
  VIEWED: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  PARTIALLY_PAID: { bg: 'bg-amber-100', text: 'text-amber-700' },
  PAID: { bg: 'bg-green-100', text: 'text-green-700' },
  OVERDUE: { bg: 'bg-red-100', text: 'text-red-700' },
  VOID: { bg: 'bg-gray-100', text: 'text-gray-500' },
  WRITTEN_OFF: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

export default function InvoicesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = usePortalInvoices({
    status: statusFilter || undefined,
    page,
    pageSize: 20,
  });

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            View your invoices and manage payments.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-input bg-white px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Loading invoices...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm font-medium text-destructive">Failed to load invoices</p>
            <button
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}

        {data && data.data.length === 0 && (
          <div className="rounded-lg border border-border bg-white p-12 text-center">
            <Receipt className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-base font-medium text-foreground">No invoices found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter
                ? 'Try adjusting your filters.'
                : 'Invoices will appear here once they are generated.'}
            </p>
          </div>
        )}

        {data && data.data.length > 0 && (
          <>
            {/* Table view */}
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Invoice
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Status
                    </th>
                    <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground sm:table-cell">
                      Issue Date
                    </th>
                    <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground md:table-cell">
                      Due Date
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                      Total
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                      Balance
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map((invoice) => {
                    const displayStatus =
                      invoice.isOverdue && invoice.status !== 'PAID' ? 'OVERDUE' : invoice.status;
                    const colors = STATUS_COLORS[displayStatus] || {
                      bg: 'bg-gray-100',
                      text: 'text-gray-700',
                    };
                    const canPay =
                      invoice.balanceDue > 0 &&
                      !['DRAFT', 'VOID', 'WRITTEN_OFF', 'PAID'].includes(invoice.status);

                    return (
                      <tr key={invoice.id} className="hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {invoice.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={clsx(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                              colors.bg,
                              colors.text
                            )}
                          >
                            {displayStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="hidden px-5 py-3 text-sm text-muted-foreground sm:table-cell">
                          {invoice.issueDate
                            ? format(new Date(invoice.issueDate), 'MMM d, yyyy')
                            : '-'}
                        </td>
                        <td className="hidden px-5 py-3 text-sm text-muted-foreground md:table-cell">
                          {invoice.dueDate
                            ? format(new Date(invoice.dueDate), 'MMM d, yyyy')
                            : '-'}
                        </td>
                        <td className="px-5 py-3 text-right text-sm font-medium text-foreground">
                          ${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span
                            className={clsx(
                              'text-sm font-medium',
                              invoice.balanceDue > 0 ? 'text-destructive' : 'text-green-600'
                            )}
                          >
                            ${invoice.balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {canPay && (
                              <Link
                                href={`/invoices/${invoice.id}`}
                                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                              >
                                <DollarSign className="h-3 w-3" />
                                Pay
                              </Link>
                            )}
                            <Link
                              href={`/invoices/${invoice.id}`}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(data.page - 1) * data.pageSize + 1} to{' '}
                  {Math.min(data.page * data.pageSize, data.total)} of {data.total} invoices
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= data.totalPages}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}
