'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Clock, User, Filter, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SearchInput } from '@/components/common/SearchInput';
import { formatDate, formatRelativeTime } from '@/lib/formatters';
import api from '@/lib/api';

interface WorklistItem {
  id: string;
  sampleId: string;
  sampleDisplayId: string;
  testName: string;
  method: string;
  priority: string;
  assignedTo: string;
  dueDate: string;
  status: string;
}

const fallbackData: WorklistItem[] = [
  { id: '1', sampleId: 's1', sampleDisplayId: 'S-2024-001843', testName: 'Heavy Metals (ICP-MS)', method: 'EPA 200.8', priority: 'rush', assignedTo: 'Dr. Sarah Chen', dueDate: '2024-01-20T17:00:00Z', status: 'in_progress' },
  { id: '2', sampleId: 's2', sampleDisplayId: 'S-2024-001844', testName: 'Heavy Metals (ICP-MS)', method: 'EPA 200.8', priority: 'normal', assignedTo: 'Dr. Sarah Chen', dueDate: '2024-01-22T17:00:00Z', status: 'pending' },
  { id: '3', sampleId: 's3', sampleDisplayId: 'S-2024-001845', testName: 'VOCs', method: 'EPA 8260', priority: 'normal', assignedTo: 'James Wilson', dueDate: '2024-01-22T17:00:00Z', status: 'in_progress' },
  { id: '4', sampleId: 's4', sampleDisplayId: 'S-2024-001846', testName: 'Total Coliform / E. Coli', method: 'SM 9223B', priority: 'urgent', assignedTo: 'Maria Santos', dueDate: '2024-01-19T17:00:00Z', status: 'pending' },
  { id: '5', sampleId: 's5', sampleDisplayId: 'S-2024-001847', testName: 'Nutrients (N/P)', method: 'EPA 353.2', priority: 'normal', assignedTo: 'James Wilson', dueDate: '2024-01-24T17:00:00Z', status: 'pending' },
  { id: '6', sampleId: 's6', sampleDisplayId: 'S-2024-001848', testName: 'pH / Conductivity', method: 'SM 4500', priority: 'rush', assignedTo: 'Dr. Sarah Chen', dueDate: '2024-01-20T17:00:00Z', status: 'completed' },
];

export default function WorklistsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [analystFilter, setAnalystFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['worklists', search, statusFilter, analystFilter],
    queryFn: async () => {
      const { data } = await api.get('/testing/worklists');
      return data as WorklistItem[];
    },
    retry: false,
  });

  const items = data || fallbackData;

  const filtered = items.filter((item) => {
    if (search && !item.sampleDisplayId.toLowerCase().includes(search.toLowerCase()) && !item.testName.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && item.status !== statusFilter) return false;
    if (analystFilter && item.assignedTo !== analystFilter) return false;
    return true;
  });

  const analysts = [...new Set(items.map((i) => i.assignedTo))];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Worklists</h1>
          <p className="text-muted-foreground">
            Analyst work assignments and testing queue
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by sample or test..."
            className="w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={analystFilter}
            onChange={(e) => setAnalystFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">All Analysts</option>
            {analysts.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">No work items found</h3>
            <p className="text-muted-foreground mt-1">
              All tests are completed or no items match your filters.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/samples/${item.sampleId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.sampleDisplayId}
                      </Link>
                      <StatusBadge status={item.status} />
                      {item.priority !== 'normal' && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {item.priority.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{item.testName}</p>
                    <p className="text-xs text-muted-foreground">{item.method}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    {item.assignedTo}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Due {formatDate(item.dueDate)}
                  </div>
                  {item.status === 'pending' && (
                    <Link
                      href="/testing/results"
                      className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Enter Results
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
