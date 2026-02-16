'use client';

import React from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';

interface BatchOverview {
  id: string;
  batchNumber: string;
  category: string;
  status: string;
  itemCount: number;
  completedCount: number;
  failedCount: number;
  rerunCount: number;
  progressPercent: number;
  openedAt: string;
  dueDate: string | null;
  sequencingRunIdentifier: string | null;
}

interface BatchOverviewTableProps {
  batches: BatchOverview[];
}

const statusVariantMap: Record<string, 'success' | 'warning' | 'error' | 'info' | 'secondary'> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  FAILED: 'error',
  CANCELLED: 'secondary',
};

export function BatchOverviewTable({ batches }: BatchOverviewTableProps) {
  if (batches.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No batches found. Create a batch to start tracking samples.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="max-h-[480px] overflow-y-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Batch</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Progress</th>
              <th className="px-4 py-3 font-medium">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {batches.map((batch) => {
              const isOverdue =
                batch.dueDate &&
                new Date(batch.dueDate) < new Date() &&
                !['COMPLETED', 'CANCELLED'].includes(batch.status);

              return (
                <tr
                  key={batch.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {batch.batchNumber}
                      </p>
                      {batch.sequencingRunIdentifier && (
                        <p className="text-xs text-muted-foreground">
                          Run: {batch.sequencingRunIdentifier}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <StatusBadge
                        status={batch.status}
                        variant={statusVariantMap[batch.status]}
                      />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {batch.failedCount > 0 && (
                          <span className="flex items-center gap-0.5 text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            {batch.failedCount}
                          </span>
                        )}
                        {batch.rerunCount > 0 && (
                          <span className="flex items-center gap-0.5 text-violet-600">
                            <RefreshCw className="h-3 w-3" />
                            {batch.rerunCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span>
                          {batch.completedCount}/{batch.itemCount}
                        </span>
                        <span className="font-medium">
                          {batch.progressPercent}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-1.5 rounded-full transition-all',
                            batch.progressPercent === 100
                              ? 'bg-emerald-500'
                              : batch.progressPercent >= 50
                                ? 'bg-blue-500'
                                : 'bg-amber-500',
                          )}
                          style={{
                            width: `${batch.progressPercent}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-xs',
                        isOverdue
                          ? 'font-medium text-red-600'
                          : 'text-muted-foreground',
                      )}
                    >
                      {batch.dueDate ? formatDate(batch.dueDate) : '--'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
