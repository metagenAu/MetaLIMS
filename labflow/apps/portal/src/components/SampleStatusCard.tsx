'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import {
  TestTubes,
  Clock,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
  FileCheck,
  Package,
  XCircle,
  Pause,
} from 'lucide-react';

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  REGISTERED: { label: 'Registered', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Package },
  RECEIVED: { label: 'Received', color: 'text-sky-600', bgColor: 'bg-sky-50', icon: CheckCircle2 },
  IN_STORAGE: { label: 'In Storage', color: 'text-cyan-600', bgColor: 'bg-cyan-50', icon: Package },
  IN_PROGRESS: { label: 'In Progress', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: FlaskConical },
  TESTING_COMPLETE: { label: 'Testing Complete', color: 'text-indigo-600', bgColor: 'bg-indigo-50', icon: FileCheck },
  APPROVED: { label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle2 },
  REPORTED: { label: 'Reported', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: FileCheck },
  ON_HOLD: { label: 'On Hold', color: 'text-orange-600', bgColor: 'bg-orange-50', icon: Pause },
  DISPOSED: { label: 'Disposed', color: 'text-gray-600', bgColor: 'bg-gray-50', icon: XCircle },
  REJECTED: { label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-50', icon: AlertCircle },
  CANCELLED: { label: 'Cancelled', color: 'text-gray-500', bgColor: 'bg-gray-50', icon: XCircle },
};

interface SampleStatusCardProps {
  sample: {
    id: string;
    sampleNumber: string;
    name: string | null;
    status: string;
    sampleType: string | null;
    matrix: string | null;
    testCount: number;
    completedTestCount: number;
    orderNumber?: string;
  };
}

export default function SampleStatusCard({ sample }: SampleStatusCardProps) {
  const config = STATUS_CONFIG[sample.status] || {
    label: sample.status,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    icon: Clock,
  };
  const StatusIcon = config.icon;
  const progressPercent =
    sample.testCount > 0 ? Math.round((sample.completedTestCount / sample.testCount) * 100) : 0;

  return (
    <Link
      href={`/samples/${sample.id}`}
      className="block rounded-lg border border-border bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{sample.sampleNumber}</p>
            {sample.orderNumber && (
              <span className="text-xs text-muted-foreground">({sample.orderNumber})</span>
            )}
          </div>
          {sample.name && (
            <p className="mt-0.5 text-sm text-muted-foreground">{sample.name}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {sample.sampleType && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {sample.sampleType}
              </span>
            )}
            {sample.matrix && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {sample.matrix}
              </span>
            )}
          </div>
        </div>
        <div
          className={clsx(
            'flex items-center gap-1 rounded-full px-2.5 py-1',
            config.bgColor,
            config.color
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{config.label}</span>
        </div>
      </div>

      {sample.testCount > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {sample.completedTestCount} of {sample.testCount} tests complete
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  );
}
