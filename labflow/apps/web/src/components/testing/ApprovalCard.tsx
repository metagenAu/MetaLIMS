'use client';

import React from 'react';
import { CheckCircle2, XCircle, Eye, Clock } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatRelativeTime } from '@/lib/formatters';

interface ApprovalItem {
  id: string;
  sampleId: string;
  sampleDisplayId: string;
  testName: string;
  analyst: string;
  result: string;
  units: string;
  submittedAt: string;
  flagged: boolean;
}

interface ApprovalCardProps {
  item: ApprovalItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isProcessing?: boolean;
}

export function ApprovalCard({
  item,
  onApprove,
  onReject,
  isProcessing = false,
}: ApprovalCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/samples/${item.sampleId}`}
              className="font-medium text-primary hover:underline"
            >
              {item.sampleDisplayId}
            </Link>
            {item.flagged && <StatusBadge status="flagged" variant="error" />}
          </div>
          <p className="text-sm">{item.testName}</p>
          <p className="text-xs text-muted-foreground">
            Analyst: {item.analyst}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">
            {item.result}{' '}
            <span className="text-xs font-normal text-muted-foreground">
              {item.units}
            </span>
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(item.submittedAt)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-3 border-t">
        <button
          onClick={() => onApprove(item.id)}
          disabled={isProcessing}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          Approve
        </button>
        <button
          onClick={() => onReject(item.id)}
          disabled={isProcessing}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/50 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" />
          Reject
        </button>
        <Link
          href={`/samples/${item.sampleId}`}
          className="inline-flex items-center justify-center rounded-md border bg-background p-1.5 hover:bg-muted"
        >
          <Eye className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
