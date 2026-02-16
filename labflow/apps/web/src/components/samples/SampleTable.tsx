'use client';

import React from 'react';
import Link from 'next/link';
import { DataTable, Column } from '@/components/common/DataTable';
import { SampleStatusBadge } from './SampleStatusBadge';
import { formatDate } from '@/lib/formatters';
import { Sample } from '@/hooks/useSamples';

interface SampleTableProps {
  data: Sample[];
  isLoading?: boolean;
  error?: string | null;
  selectable?: boolean;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  totalCount?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export function SampleTable({
  data,
  isLoading,
  error,
  selectable = false,
  selectedRows,
  onSelectionChange,
  totalCount,
  currentPage,
  onPageChange,
}: SampleTableProps) {
  const columns: Column<Sample>[] = [
    {
      key: 'sampleId',
      header: 'Sample ID',
      sortable: true,
      cell: (row) => (
        <Link
          href={`/samples/${row.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.sampleId}
        </Link>
      ),
    },
    {
      key: 'clientName',
      header: 'Client',
      sortable: true,
    },
    {
      key: 'matrix',
      header: 'Matrix',
      sortable: true,
      cell: (row) => (
        <span className="capitalize">{row.matrix}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <SampleStatusBadge status={row.status} />,
    },
    {
      key: 'priority',
      header: 'Priority',
      cell: (row) => (
        <span
          className={
            row.priority === 'urgent'
              ? 'text-red-600 font-medium'
              : row.priority === 'rush'
                ? 'text-amber-600 font-medium'
                : 'text-muted-foreground'
          }
        >
          {row.priority.charAt(0).toUpperCase() + row.priority.slice(1)}
        </span>
      ),
    },
    {
      key: 'receivedDate',
      header: 'Received',
      sortable: true,
      cell: (row) => formatDate(row.receivedDate),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      cell: (row) => {
        const isOverdue =
          row.dueDate &&
          new Date(row.dueDate) < new Date() &&
          !['completed', 'reported', 'approved'].includes(row.status);
        return (
          <span className={isOverdue ? 'text-destructive font-medium' : ''}>
            {formatDate(row.dueDate)}
          </span>
        );
      },
    },
    {
      key: 'location',
      header: 'Location',
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      error={error}
      emptyMessage="No samples found. Register a new sample to get started."
      selectable={selectable}
      selectedRows={selectedRows}
      onSelectionChange={onSelectionChange}
      totalCount={totalCount}
      currentPage={currentPage}
      onPageChange={onPageChange}
      serverSide={!!onPageChange}
    />
  );
}
