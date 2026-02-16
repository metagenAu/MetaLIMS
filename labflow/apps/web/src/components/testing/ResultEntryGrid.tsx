'use client';

import React, { useState } from 'react';
import { Save, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResultRow {
  id: string;
  sampleId: string;
  testName: string;
  method: string;
  units: string;
  lowerLimit: number | null;
  upperLimit: number | null;
  result: string;
  status: 'pending' | 'entered' | 'flagged';
}

interface ResultEntryGridProps {
  rows: ResultRow[];
  onSave: (results: { id: string; result: string }[]) => void;
  isSaving?: boolean;
}

export function ResultEntryGrid({
  rows: initialRows,
  onSave,
  isSaving = false,
}: ResultEntryGridProps) {
  const [rows, setRows] = useState(initialRows);
  const [editedIds, setEditedIds] = useState<Set<string>>(new Set());

  const updateResult = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        let status: ResultRow['status'] = 'entered';
        const numVal = parseFloat(value);

        if (value && !isNaN(numVal)) {
          if (
            (row.lowerLimit !== null && numVal < row.lowerLimit) ||
            (row.upperLimit !== null && numVal > row.upperLimit)
          ) {
            status = 'flagged';
          }
        }

        return { ...row, result: value, status: value ? status : 'pending' };
      })
    );
    setEditedIds((prev) => new Set(prev).add(id));
  };

  const handleSave = () => {
    const results = rows
      .filter((r) => editedIds.has(r.id) && r.result)
      .map((r) => ({ id: r.id, result: r.result }));
    onSave(results);
    setEditedIds(new Set());
  };

  const editedCount = editedIds.size;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-32">
                  Sample ID
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Test
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-28">
                  Method
                </th>
                <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-24">
                  Lower Limit
                </th>
                <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-24">
                  Upper Limit
                </th>
                <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-32">
                  Result
                </th>
                <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-16">
                  Units
                </th>
                <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-16">
                  Flag
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'transition-colors',
                    row.status === 'flagged' && 'bg-red-50 dark:bg-red-900/10',
                    editedIds.has(row.id) && row.status !== 'flagged' && 'bg-blue-50 dark:bg-blue-900/10'
                  )}
                >
                  <td className="px-3 py-2 font-mono text-xs">
                    {row.sampleId}
                  </td>
                  <td className="px-3 py-2 font-medium">{row.testName}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.method}
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {row.lowerLimit !== null ? row.lowerLimit : '--'}
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {row.upperLimit !== null ? row.upperLimit : '--'}
                  </td>
                  <td className="px-3 py-1">
                    <input
                      type="text"
                      value={row.result}
                      onChange={(e) => updateResult(row.id, e.target.value)}
                      className={cn(
                        'flex h-8 w-full rounded border bg-background px-2 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        row.status === 'flagged' && 'border-red-300 dark:border-red-800'
                      )}
                      placeholder="--"
                    />
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                    {row.units}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.status === 'flagged' && (
                      <AlertTriangle className="h-4 w-4 text-red-500 mx-auto" />
                    )}
                    {row.status === 'entered' && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editedCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-card p-3">
          <p className="text-sm">
            <span className="font-medium">{editedCount}</span> result(s) modified
          </p>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Results
          </button>
        </div>
      )}
    </div>
  );
}
