'use client';

import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpecComparisonBadgeProps {
  result: number;
  lowerLimit?: number | null;
  upperLimit?: number | null;
  className?: string;
}

export function SpecComparisonBadge({
  result,
  lowerLimit,
  upperLimit,
  className,
}: SpecComparisonBadgeProps) {
  const isAboveUpper = upperLimit !== null && upperLimit !== undefined && result > upperLimit;
  const isBelowLower = lowerLimit !== null && lowerLimit !== undefined && result < lowerLimit;
  const isOutOfSpec = isAboveUpper || isBelowLower;
  const isNearLimit =
    !isOutOfSpec &&
    ((upperLimit !== null && upperLimit !== undefined && result > upperLimit * 0.9) ||
      (lowerLimit !== null && lowerLimit !== undefined && result < lowerLimit * 1.1));

  if (isOutOfSpec) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400',
          className
        )}
      >
        <XCircle className="h-3 w-3" />
        Fail
      </span>
    );
  }

  if (isNearLimit) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          className
        )}
      >
        <AlertTriangle className="h-3 w-3" />
        Near Limit
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        className
      )}
    >
      <CheckCircle2 className="h-3 w-3" />
      Pass
    </span>
  );
}
