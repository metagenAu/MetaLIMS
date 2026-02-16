'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Filter, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ApprovalCard } from '@/components/testing/ApprovalCard';
import { SearchInput } from '@/components/common/SearchInput';
import api from '@/lib/api';

const fallbackItems = [
  { id: '1', sampleId: 's1', sampleDisplayId: 'S-2024-001843', testName: 'Lead (Pb) - EPA 200.8', analyst: 'Dr. Sarah Chen', result: '3.2', units: 'ug/L', submittedAt: new Date(Date.now() - 3600000).toISOString(), flagged: false },
  { id: '2', sampleId: 's1', sampleDisplayId: 'S-2024-001843', testName: 'Arsenic (As) - EPA 200.8', analyst: 'Dr. Sarah Chen', result: '12.5', units: 'ug/L', submittedAt: new Date(Date.now() - 3600000).toISOString(), flagged: true },
  { id: '3', sampleId: 's2', sampleDisplayId: 'S-2024-001844', testName: 'Total Coliform - SM 9223B', analyst: 'Maria Santos', result: '<1', units: 'MPN/100mL', submittedAt: new Date(Date.now() - 7200000).toISOString(), flagged: false },
  { id: '4', sampleId: 's3', sampleDisplayId: 'S-2024-001845', testName: 'Benzene - EPA 8260', analyst: 'James Wilson', result: '0.8', units: 'ug/L', submittedAt: new Date(Date.now() - 14400000).toISOString(), flagged: false },
  { id: '5', sampleId: 's3', sampleDisplayId: 'S-2024-001845', testName: 'Toluene - EPA 8260', analyst: 'James Wilson', result: '2100', units: 'ug/L', submittedAt: new Date(Date.now() - 14400000).toISOString(), flagged: true },
  { id: '6', sampleId: 's4', sampleDisplayId: 'S-2024-001846', testName: 'pH - SM 4500', analyst: 'Dr. Sarah Chen', result: '7.4', units: 'SU', submittedAt: new Date(Date.now() - 21600000).toISOString(), flagged: false },
];

export default function ReviewPage() {
  const [search, setSearch] = useState('');
  const [showFlagged, setShowFlagged] = useState(false);
  const [items, setItems] = useState(fallbackItems);
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/testing/review/${id}/approve`);
    },
    onSuccess: (_, id) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/testing/review/${id}/reject`);
    },
    onSuccess: (_, id) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
  });

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    rejectMutation.mutate(id);
  };

  const filtered = items.filter((item) => {
    if (search && !item.sampleDisplayId.toLowerCase().includes(search.toLowerCase()) && !item.testName.toLowerCase().includes(search.toLowerCase())) return false;
    if (showFlagged && !item.flagged) return false;
    return true;
  });

  const flaggedCount = items.filter((i) => i.flagged).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Review Queue</h1>
            <p className="text-muted-foreground">
              Approve or reject submitted test results ({items.length} pending)
            </p>
          </div>
          {flaggedCount > 0 && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
              {flaggedCount} flagged result(s) require attention
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by sample or test..."
            className="w-64"
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showFlagged}
              onChange={(e) => setShowFlagged(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm">Show flagged only</span>
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold">All caught up!</h3>
            <p className="text-muted-foreground mt-1">
              No results pending review. Check back later.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <ApprovalCard
                key={item.id}
                item={item}
                onApprove={handleApprove}
                onReject={handleReject}
                isProcessing={approveMutation.isPending || rejectMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
