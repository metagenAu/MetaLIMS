'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { ResultEntryGrid } from '@/components/testing/ResultEntryGrid';
import api from '@/lib/api';

const fallbackRows = [
  { id: 'r1', sampleId: 'S-2024-001843', testName: 'Lead (Pb)', method: 'EPA 200.8', units: 'ug/L', lowerLimit: null, upperLimit: 15, result: '', status: 'pending' as const },
  { id: 'r2', sampleId: 'S-2024-001843', testName: 'Copper (Cu)', method: 'EPA 200.8', units: 'ug/L', lowerLimit: null, upperLimit: 1300, result: '', status: 'pending' as const },
  { id: 'r3', sampleId: 'S-2024-001843', testName: 'Arsenic (As)', method: 'EPA 200.8', units: 'ug/L', lowerLimit: null, upperLimit: 10, result: '', status: 'pending' as const },
  { id: 'r4', sampleId: 'S-2024-001843', testName: 'Mercury (Hg)', method: 'EPA 200.8', units: 'ug/L', lowerLimit: null, upperLimit: 2, result: '', status: 'pending' as const },
  { id: 'r5', sampleId: 'S-2024-001844', testName: 'Lead (Pb)', method: 'EPA 200.8', units: 'ug/L', lowerLimit: null, upperLimit: 15, result: '', status: 'pending' as const },
  { id: 'r6', sampleId: 'S-2024-001844', testName: 'Copper (Cu)', method: 'EPA 200.8', units: 'ug/L', lowerLimit: null, upperLimit: 1300, result: '', status: 'pending' as const },
  { id: 'r7', sampleId: 'S-2024-001844', testName: 'Arsenic (As)', method: 'EPA 200.8', units: 'ug/L', lowerLimit: null, upperLimit: 10, result: '', status: 'pending' as const },
  { id: 'r8', sampleId: 'S-2024-001845', testName: 'Benzene', method: 'EPA 8260', units: 'ug/L', lowerLimit: null, upperLimit: 5, result: '', status: 'pending' as const },
  { id: 'r9', sampleId: 'S-2024-001845', testName: 'Toluene', method: 'EPA 8260', units: 'ug/L', lowerLimit: null, upperLimit: 1000, result: '', status: 'pending' as const },
  { id: 'r10', sampleId: 'S-2024-001845', testName: 'Xylenes', method: 'EPA 8260', units: 'ug/L', lowerLimit: null, upperLimit: 10000, result: '', status: 'pending' as const },
];

export default function ResultEntryPage() {
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (results: { id: string; result: string }[]) => {
      const { data } = await api.post('/testing/results', { results });
      return data;
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSave = (results: { id: string; result: string }[]) => {
    saveMutation.mutate(results);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Result Entry</h1>
            <p className="text-muted-foreground">
              Enter and validate test results for assigned samples
            </p>
          </div>
          {saved && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
              Results saved successfully
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <select className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
            <option value="">All Methods</option>
            <option value="epa200">EPA 200.8 - Metals</option>
            <option value="epa8260">EPA 8260 - VOCs</option>
            <option value="sm9223">SM 9223B - Coliform</option>
          </select>
          <select className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
            <option value="">All Batches</option>
            <option value="b1">Batch B-2024-0342</option>
            <option value="b2">Batch B-2024-0343</option>
          </select>
        </div>

        <ResultEntryGrid
          rows={fallbackRows}
          onSave={handleSave}
          isSaving={saveMutation.isPending}
        />

        {saveMutation.isError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            Failed to save results. Please try again.
          </div>
        )}
      </div>
    </MainLayout>
  );
}
