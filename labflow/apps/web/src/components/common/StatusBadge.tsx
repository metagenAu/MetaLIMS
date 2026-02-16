'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type StatusVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'secondary';

const statusColorMap: Record<string, StatusVariant> = {
  // Sample statuses
  registered: 'info',
  received: 'info',
  in_progress: 'warning',
  testing: 'warning',
  review: 'warning',
  approved: 'success',
  reported: 'success',
  completed: 'success',
  rejected: 'error',
  cancelled: 'secondary',
  disposed: 'secondary',

  // Order statuses
  draft: 'secondary',
  submitted: 'info',
  processing: 'warning',
  fulfilled: 'success',

  // Invoice statuses
  pending: 'warning',
  sent: 'info',
  paid: 'success',
  overdue: 'error',
  partial: 'warning',
  void: 'secondary',

  // Test result statuses
  pass: 'success',
  fail: 'error',
  inconclusive: 'warning',

  // Generic
  active: 'success',
  inactive: 'secondary',
  archived: 'secondary',
};

const variantStyles: Record<StatusVariant, string> = {
  default: 'bg-muted text-muted-foreground',
  success:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  secondary: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
}

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const resolvedVariant =
    variant || statusColorMap[status.toLowerCase()] || 'default';
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[resolvedVariant],
        className
      )}
    >
      {label}
    </span>
  );
}
