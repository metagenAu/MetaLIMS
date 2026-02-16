'use client';

import React from 'react';
import Link from 'next/link';
import { DataTable, Column } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { Invoice } from '@/hooks/useInvoices';
import { cn } from '@/lib/utils';

interface InvoiceTableProps {
  data: Invoice[];
  isLoading?: boolean;
  error?: string | null;
  totalCount?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export function InvoiceTable({
  data,
  isLoading,
  error,
  totalCount,
  currentPage,
  onPageChange,
}: InvoiceTableProps) {
  const getDaysOverdue = (dueDate: string, status: string) => {
    if (status === 'paid' || status === 'void') return null;
    const due = new Date(dueDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  };

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      sortable: true,
      cell: (row) => (
        <Link href={`/billing/invoices/${row.id}`} className="font-medium text-primary hover:underline">
          {row.invoiceNumber}
        </Link>
      ),
    },
    { key: 'clientName', header: 'Client', sortable: true },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'totalAmount',
      header: 'Total',
      sortable: true,
      cell: (row) => formatCurrency(row.totalAmount),
    },
    {
      key: 'balanceDue',
      header: 'Balance Due',
      sortable: true,
      cell: (row) => (
        <span className={row.balanceDue > 0 ? 'font-medium text-amber-600' : ''}>
          {formatCurrency(row.balanceDue)}
        </span>
      ),
    },
    {
      key: 'issueDate',
      header: 'Issued',
      sortable: true,
      cell: (row) => formatDate(row.issueDate),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      cell: (row) => {
        const daysOverdue = getDaysOverdue(row.dueDate, row.status);
        return (
          <div>
            <span className={daysOverdue ? 'text-destructive' : ''}>
              {formatDate(row.dueDate)}
            </span>
            {daysOverdue && (
              <span className="ml-1 text-xs text-destructive">
                ({daysOverdue}d overdue)
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      error={error}
      emptyMessage="No invoices found."
      totalCount={totalCount}
      currentPage={currentPage}
      onPageChange={onPageChange}
      serverSide={!!onPageChange}
    />
  );
}
