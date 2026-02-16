'use client';

import { Check, Clock, FlaskConical, FileSearch, FileCheck, FileText, Package } from 'lucide-react';
import { clsx } from 'clsx';

const ORDER_STEPS = [
  { key: 'SUBMITTED', label: 'Submitted', icon: Package },
  { key: 'RECEIVED', label: 'Received', icon: Check },
  { key: 'IN_PROGRESS', label: 'In Progress', icon: FlaskConical },
  { key: 'TESTING_COMPLETE', label: 'Testing Done', icon: FileSearch },
  { key: 'IN_REVIEW', label: 'In Review', icon: FileCheck },
  { key: 'REPORTED', label: 'Reported', icon: FileText },
  { key: 'COMPLETED', label: 'Completed', icon: Check },
];

const STATUS_ORDER: Record<string, number> = {
  DRAFT: -1,
  SUBMITTED: 0,
  RECEIVED: 1,
  IN_PROGRESS: 2,
  TESTING_COMPLETE: 3,
  IN_REVIEW: 4,
  APPROVED: 5,
  REPORTED: 5,
  COMPLETED: 6,
  ON_HOLD: -2,
  CANCELLED: -3,
};

interface OrderStatusTrackerProps {
  status: string;
  className?: string;
}

export default function OrderStatusTracker({ status, className }: OrderStatusTrackerProps) {
  const currentIndex = STATUS_ORDER[status] ?? -1;
  const isHeld = status === 'ON_HOLD';
  const isCancelled = status === 'CANCELLED';

  if (isCancelled) {
    return (
      <div className={clsx('rounded-lg border border-destructive/20 bg-destructive/5 p-4', className)}>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-white">
            <span className="text-sm font-bold">X</span>
          </div>
          <div>
            <p className="text-sm font-medium text-destructive">Order Cancelled</p>
            <p className="text-xs text-muted-foreground">This order has been cancelled.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isHeld) {
    return (
      <div className={clsx('rounded-lg border border-warning/20 bg-warning/5 p-4', className)}>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning text-white">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-warning">Order On Hold</p>
            <p className="text-xs text-muted-foreground">
              This order is temporarily on hold. Please contact support for details.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('w-full', className)}>
      <div className="flex items-center justify-between">
        {ORDER_STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = currentIndex > index;
          const isCurrent = currentIndex === index;
          const isPending = currentIndex < index;

          return (
            <div key={step.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={clsx(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-primary/10 text-primary',
                    isPending && 'border-muted bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={clsx(
                    'mt-2 text-center text-xs font-medium',
                    isCompleted && 'text-primary',
                    isCurrent && 'text-primary',
                    isPending && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < ORDER_STEPS.length - 1 && (
                <div
                  className={clsx(
                    'mx-1 mt-[-1.25rem] h-0.5 flex-1',
                    currentIndex > index ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
