'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Send, Eye, Loader2, Plus } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SearchInput } from '@/components/common/SearchInput';
import { formatDate } from '@/lib/formatters';
import api from '@/lib/api';

interface Report {
  id: string;
  reportNumber: string;
  sampleId: string;
  sampleDisplayId: string;
  clientName: string;
  type: string;
  status: string;
  generatedAt: string | null;
  sentAt: string | null;
}

const fallbackReports: Report[] = [
  { id: '1', reportNumber: 'RPT-2024-0451', sampleId: 's1', sampleDisplayId: 'S-2024-001840', clientName: 'Acme Environmental', type: 'Certificate of Analysis', status: 'sent', generatedAt: '2024-01-16T10:00:00Z', sentAt: '2024-01-16T10:30:00Z' },
  { id: '2', reportNumber: 'RPT-2024-0452', sampleId: 's2', sampleDisplayId: 'S-2024-001841', clientName: 'GreenTech Labs', type: 'Certificate of Analysis', status: 'generated', generatedAt: '2024-01-17T09:00:00Z', sentAt: null },
  { id: '3', reportNumber: 'RPT-2024-0453', sampleId: 's3', sampleDisplayId: 'S-2024-001842', clientName: 'Riverside Water Authority', type: 'Compliance Report', status: 'pending', generatedAt: null, sentAt: null },
  { id: '4', reportNumber: 'RPT-2024-0454', sampleId: 's4', sampleDisplayId: 'S-2024-001843', clientName: 'Acme Environmental', type: 'Certificate of Analysis', status: 'pending', generatedAt: null, sentAt: null },
  { id: '5', reportNumber: 'RPT-2024-0455', sampleId: 's5', sampleDisplayId: 'S-2024-001844', clientName: 'Metro Health Department', type: 'Summary Report', status: 'generated', generatedAt: '2024-01-17T14:00:00Z', sentAt: null },
];

export default function ReportsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', search, statusFilter],
    queryFn: async () => {
      const { data } = await api.get('/reports');
      return data as Report[];
    },
    retry: false,
  });

  const reports = data || fallbackReports;

  const filtered = reports.filter((r) => {
    if (search && !r.reportNumber.toLowerCase().includes(search.toLowerCase()) && !r.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  const columns: Column<Report>[] = [
    {
      key: 'reportNumber',
      header: 'Report #',
      sortable: true,
      cell: (row) => (
        <Link href={`/reports/${row.id}`} className="font-medium text-primary hover:underline">
          {row.reportNumber}
        </Link>
      ),
    },
    { key: 'sampleDisplayId', header: 'Sample', sortable: true },
    { key: 'clientName', header: 'Client', sortable: true },
    { key: 'type', header: 'Type' },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'generatedAt',
      header: 'Generated',
      cell: (row) => formatDate(row.generatedAt),
    },
    {
      key: 'sentAt',
      header: 'Sent',
      cell: (row) => formatDate(row.sentAt),
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex items-center gap-1">
          {row.status === 'pending' && (
            <button className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5">
              <FileText className="h-3 w-3" />
              Generate
            </button>
          )}
          {row.status === 'generated' && (
            <button className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5">
              <Send className="h-3 w-3" />
              Send
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reports</h1>
            <p className="text-muted-foreground">
              Generate and send analytical reports to clients
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search reports..." className="w-64" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="generated">Generated</option>
            <option value="sent">Sent</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          emptyMessage="No reports found."
        />
      </div>
    </MainLayout>
  );
}
