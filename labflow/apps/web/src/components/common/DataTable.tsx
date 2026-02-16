'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  pageSize?: number;
  selectable?: boolean;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  getRowId?: (row: T) => string;
  onRowClick?: (row: T) => void;
  totalCount?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  serverSide?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  error = null,
  emptyMessage = 'No data found.',
  pageSize = 10,
  selectable = false,
  selectedRows = new Set(),
  onSelectionChange,
  getRowId = (row: any) => row.id,
  onRowClick,
  totalCount,
  currentPage = 1,
  onPageChange,
  serverSide = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [localPage, setLocalPage] = useState(1);

  const page = serverSide ? currentPage : localPage;
  const setPage = serverSide
    ? onPageChange || (() => {})
    : setLocalPage;

  const sortedData = useMemo(() => {
    if (!sortKey || serverSide) return data;
    return [...data].sort((a: any, b: any) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp =
        typeof aVal === 'string'
          ? aVal.localeCompare(bVal)
          : aVal - bVal;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, serverSide]);

  const paginatedData = useMemo(() => {
    if (serverSide) return sortedData;
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize, serverSide]);

  const total = serverSide ? (totalCount || data.length) : sortedData.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const toggleAll = () => {
    if (!onSelectionChange) return;
    const allIds = new Set(paginatedData.map((row) => getRowId(row)));
    const allSelected = [...allIds].every((id) => selectedRows.has(id));
    if (allSelected) {
      const next = new Set(selectedRows);
      allIds.forEach((id) => next.delete(id));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedRows);
      allIds.forEach((id) => next.add(id));
      onSelectionChange(next);
    }
  };

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
        <p className="text-destructive font-medium">Error loading data</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {selectable && (
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-input"
                      onChange={toggleAll}
                      checked={
                        paginatedData.length > 0 &&
                        paginatedData.every((row) =>
                          selectedRows.has(getRowId(row))
                        )
                      }
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-left font-medium text-muted-foreground',
                      col.sortable && 'cursor-pointer select-none hover:text-foreground',
                      col.className
                    )}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      {col.sortable && (
                        <span className="ml-1">
                          {sortKey === col.key ? (
                            sortDir === 'asc' ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="px-4 py-12 text-center"
                  >
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, i) => {
                  const rowId = getRowId(row);
                  return (
                    <tr
                      key={rowId || i}
                      className={cn(
                        'border-b transition-colors hover:bg-muted/50',
                        onRowClick && 'cursor-pointer',
                        selectedRows.has(rowId) && 'bg-primary/5'
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {selectable && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-input"
                            checked={selectedRows.has(rowId)}
                            onChange={() => toggleRow(rowId)}
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td key={col.key} className={cn('px-4 py-3', col.className)}>
                          {col.cell
                            ? col.cell(row)
                            : (row as any)[col.key] ?? '--'}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, total)} of {total} results
          </p>
          <div className="flex items-center gap-1">
            <button
              className="inline-flex items-center justify-center rounded-md border bg-card px-2 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
              onClick={() => setPage(1)}
              disabled={page <= 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              className="inline-flex items-center justify-center rounded-md border bg-card px-2 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              className="inline-flex items-center justify-center rounded-md border bg-card px-2 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              className="inline-flex items-center justify-center rounded-md border bg-card px-2 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
