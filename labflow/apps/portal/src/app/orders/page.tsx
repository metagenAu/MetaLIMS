'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ClipboardList,
  Search,
  Plus,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { clsx } from 'clsx';
import PortalLayout from '@/components/PortalLayout';
import { usePortalOrders } from '@/hooks/usePortalApi';

const STATUS_FILTERS = [
  { value: '', label: 'All Orders' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'TESTING_COMPLETE', label: 'Testing Complete' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'REPORTED', label: 'Reported' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700' },
  SUBMITTED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  RECEIVED: { bg: 'bg-sky-100', text: 'text-sky-700' },
  IN_PROGRESS: { bg: 'bg-amber-100', text: 'text-amber-700' },
  TESTING_COMPLETE: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  IN_REVIEW: { bg: 'bg-purple-100', text: 'text-purple-700' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-700' },
  REPORTED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700' },
  ON_HOLD: { bg: 'bg-orange-100', text: 'text-orange-700' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = usePortalOrders({
    status: statusFilter || undefined,
    search: search || undefined,
    page,
    pageSize: 20,
  });

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
            <p className="text-sm text-muted-foreground">
              View and track all your laboratory orders.
            </p>
          </div>
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Order
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by order number or PO..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-input bg-white pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
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
        </div>

        {/* Content */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Loading orders...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm font-medium text-destructive">Failed to load orders</p>
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
            <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-base font-medium text-foreground">No orders found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {search || statusFilter
                ? 'Try adjusting your filters.'
                : "You haven't submitted any orders yet."}
            </p>
            {!search && !statusFilter && (
              <Link
                href="/orders/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Submit Your First Order
              </Link>
            )}
          </div>
        )}

        {data && data.data.length > 0 && (
          <>
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Order
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Status
                    </th>
                    <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground sm:table-cell">
                      Samples
                    </th>
                    <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground md:table-cell">
                      Progress
                    </th>
                    <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground lg:table-cell">
                      Due Date
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Created
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map((order) => {
                    const colors = STATUS_COLORS[order.status] || {
                      bg: 'bg-gray-100',
                      text: 'text-gray-700',
                    };
                    const progress =
                      order.testCount > 0
                        ? Math.round((order.completedTestCount / order.testCount) * 100)
                        : 0;
                    return (
                      <tr key={order.id} className="hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <Link
                            href={`/orders/${order.id}`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                          {order.clientPO && (
                            <p className="text-xs text-muted-foreground">PO: {order.clientPO}</p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={clsx(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                              colors.bg,
                              colors.text
                            )}
                          >
                            {order.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="hidden px-5 py-3 text-sm text-muted-foreground sm:table-cell">
                          {order.sampleCount}
                        </td>
                        <td className="hidden px-5 py-3 md:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{progress}%</span>
                          </div>
                        </td>
                        <td className="hidden px-5 py-3 text-sm text-muted-foreground lg:table-cell">
                          {order.dueDate
                            ? format(new Date(order.dueDate), 'MMM d, yyyy')
                            : '-'}
                        </td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">
                          {format(new Date(order.createdAt), 'MMM d, yyyy')}
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            href={`/orders/${order.id}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(data.page - 1) * data.pageSize + 1} to{' '}
                  {Math.min(data.page * data.pageSize, data.total)} of {data.total} orders
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
