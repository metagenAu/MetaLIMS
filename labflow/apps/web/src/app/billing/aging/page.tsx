'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { AgingChart } from '@/components/billing/AgingChart';
import { DataTable, Column } from '@/components/common/DataTable';
import { formatCurrency } from '@/lib/formatters';
import api from '@/lib/api';

interface AgingClient {
  id: string;
  name: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

const fallbackAging = {
  current: 12500,
  days30: 8750,
  days60: 4200,
  days90: 2400,
  over90: 1850,
  total: 29700,
  clients: [
    { id: 'c1', name: 'Acme Environmental', current: 3750, days30: 5200, days60: 2400, days90: 0, over90: 0, total: 11350 },
    { id: 'c2', name: 'GreenTech Labs', current: 3750, days30: 0, days60: 0, days90: 0, over90: 0, total: 3750 },
    { id: 'c4', name: 'Metro Health Department', current: 3100, days30: 3550, days60: 1800, days90: 2400, over90: 1850, total: 12700 },
    { id: 'c5', name: 'Pacific Agriculture Co.', current: 1900, days30: 0, days60: 0, days90: 0, over90: 0, total: 1900 },
  ] as AgingClient[],
};

export default function AgingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['aging-report'],
    queryFn: async () => {
      const { data } = await api.get('/billing/aging');
      return data;
    },
    retry: false,
  });

  const aging = data || fallbackAging;

  const columns: Column<AgingClient>[] = [
    {
      key: 'name', header: 'Client', sortable: true,
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    { key: 'current', header: 'Current', sortable: true, cell: (row) => formatCurrency(row.current) },
    { key: 'days30', header: '1-30 Days', sortable: true, cell: (row) => <span className={row.days30 > 0 ? 'text-amber-600' : ''}>{formatCurrency(row.days30)}</span> },
    { key: 'days60', header: '31-60 Days', sortable: true, cell: (row) => <span className={row.days60 > 0 ? 'text-orange-600' : ''}>{formatCurrency(row.days60)}</span> },
    { key: 'days90', header: '61-90 Days', sortable: true, cell: (row) => <span className={row.days90 > 0 ? 'text-red-500' : ''}>{formatCurrency(row.days90)}</span> },
    { key: 'over90', header: '90+ Days', sortable: true, cell: (row) => <span className={row.over90 > 0 ? 'text-red-700 font-medium' : ''}>{formatCurrency(row.over90)}</span> },
    { key: 'total', header: 'Total', sortable: true, cell: (row) => <span className="font-bold">{formatCurrency(row.total)}</span> },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">AR Aging Report</h1>
          <p className="text-muted-foreground">Accounts receivable aging analysis</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-lg font-bold mt-1">{formatCurrency(aging.current)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">1-30 Days</p>
            <p className="text-lg font-bold mt-1 text-amber-600">{formatCurrency(aging.days30)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">31-60 Days</p>
            <p className="text-lg font-bold mt-1 text-orange-600">{formatCurrency(aging.days60)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">61-90 Days</p>
            <p className="text-lg font-bold mt-1 text-red-500">{formatCurrency(aging.days90)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">90+ Days</p>
            <p className="text-lg font-bold mt-1 text-red-700">{formatCurrency(aging.over90)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AgingChart data={aging} />
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-sm font-medium mb-4">Total Outstanding</h3>
            <p className="text-4xl font-bold">{formatCurrency(aging.total)}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Across {aging.clients?.length || 0} clients with outstanding balances
            </p>
            {aging.over90 > 0 && (
              <div className="flex items-center gap-2 mt-4 p-3 rounded-md bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-red-700 dark:text-red-400">
                  {formatCurrency(aging.over90)} is over 90 days past due
                </p>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3">Client Breakdown</h3>
          <DataTable
            columns={columns}
            data={aging.clients || []}
            isLoading={isLoading}
            emptyMessage="No outstanding balances."
          />
        </div>
      </div>
    </MainLayout>
  );
}
