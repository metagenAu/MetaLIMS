'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Download, Trash2, PackageCheck } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SampleTable } from '@/components/samples/SampleTable';
import { SearchInput } from '@/components/common/SearchInput';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useSamples, SampleFilters } from '@/hooks/useSamples';

export default function SamplesPage() {
  const [filters, setFilters] = useState<SampleFilters>({
    page: 1,
    pageSize: 20,
  });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data, isLoading, error } = useSamples(filters);

  const updateFilter = (key: keyof SampleFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Samples</h1>
            <p className="text-muted-foreground">
              Manage and track laboratory samples
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/samples/receive"
              className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <PackageCheck className="h-4 w-4" />
              Receive
            </Link>
            <Link
              href="/samples/new"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Register Sample
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={filters.search}
            onChange={(value) => updateFilter('search', value)}
            placeholder="Search samples..."
            className="w-64"
          />

          <select
            value={filters.status || ''}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="registered">Registered</option>
            <option value="received">Received</option>
            <option value="in_progress">In Progress</option>
            <option value="testing">Testing</option>
            <option value="review">Review</option>
            <option value="approved">Approved</option>
            <option value="reported">Reported</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={filters.matrix || ''}
            onChange={(e) => updateFilter('matrix', e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">All Matrices</option>
            <option value="drinking_water">Drinking Water</option>
            <option value="wastewater">Wastewater</option>
            <option value="groundwater">Groundwater</option>
            <option value="soil">Soil</option>
            <option value="air">Air</option>
          </select>

          <DateRangePicker
            value={
              filters.dateFrom && filters.dateTo
                ? { from: filters.dateFrom, to: filters.dateTo }
                : undefined
            }
            onChange={(range) => {
              setFilters((prev) => ({
                ...prev,
                dateFrom: range.from,
                dateTo: range.to,
                page: 1,
              }));
            }}
            className="w-64"
          />
        </div>

        {/* Bulk actions */}
        {selectedRows.size > 0 && (
          <div className="flex items-center gap-3 rounded-md border bg-muted/50 p-3">
            <span className="text-sm font-medium">
              {selectedRows.size} selected
            </span>
            <button className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/50 bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        )}

        {/* Table */}
        <SampleTable
          data={data?.items || []}
          isLoading={isLoading}
          error={error ? 'Failed to load samples' : null}
          selectable
          selectedRows={selectedRows}
          onSelectionChange={setSelectedRows}
          totalCount={data?.total}
          currentPage={filters.page}
          onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Samples"
          description={`Are you sure you want to delete ${selectedRows.size} selected samples? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() => {
            setSelectedRows(new Set());
          }}
        />
      </div>
    </MainLayout>
  );
}
