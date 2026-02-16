'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { SearchInput } from '@/components/common/SearchInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { useOrders, Order, OrderFilters } from '@/hooks/useOrders';
import { formatDate, formatCurrency } from '@/lib/formatters';

export default function OrdersPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<OrderFilters>({
    page: 1,
    pageSize: 20,
  });

  const { data, isLoading, error } = useOrders(filters);

  const columns: Column<Order>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      sortable: true,
      cell: (row) => (
        <Link
          href={`/orders/${row.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.orderNumber}
        </Link>
      ),
    },
    {
      key: 'clientName',
      header: 'Client',
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'sampleCount',
      header: 'Samples',
      sortable: true,
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      sortable: true,
      cell: (row) => formatCurrency(row.totalAmount),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      cell: (row) => formatDate(row.dueDate),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      cell: (row) => formatDate(row.createdAt),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Orders</h1>
            <p className="text-muted-foreground">
              Manage client work orders and sample submissions
            </p>
          </div>
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Order
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={filters.search}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, search: value, page: 1 }))
            }
            placeholder="Search orders..."
            className="w-64"
          />

          <select
            value={filters.status || ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                status: e.target.value,
                page: 1,
              }))
            }
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <DateRangePicker
            value={
              filters.dateFrom && filters.dateTo
                ? { from: filters.dateFrom, to: filters.dateTo }
                : undefined
            }
            onChange={(range) =>
              setFilters((prev) => ({
                ...prev,
                dateFrom: range.from,
                dateTo: range.to,
                page: 1,
              }))
            }
            className="w-64"
          />
        </div>

        <DataTable
          columns={columns}
          data={data?.items || []}
          isLoading={isLoading}
          error={error ? 'Failed to load orders' : null}
          emptyMessage="No orders found. Create a new order to get started."
          onRowClick={(row) => router.push(`/orders/${row.id}`)}
          totalCount={data?.total}
          currentPage={filters.page}
          onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
          serverSide
        />
      </div>
    </MainLayout>
  );
}
