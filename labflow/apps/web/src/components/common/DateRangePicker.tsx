'use client';

import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DateRange {
  from: string;
  to: string;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const presets = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This year', days: -1 },
];

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const applyPreset = (days: number) => {
    const to = new Date();
    let from: Date;

    if (days === -1) {
      from = new Date(to.getFullYear(), 0, 1);
    } else if (days === 0) {
      from = new Date(to);
      from.setHours(0, 0, 0, 0);
    } else {
      from = new Date(to);
      from.setDate(from.getDate() - days);
    }

    onChange({
      from: format(from, 'yyyy-MM-dd'),
      to: format(to, 'yyyy-MM-dd'),
    });
    setOpen(false);
  };

  const displayLabel =
    value?.from && value?.to
      ? `${format(new Date(value.from), 'MMM d, yyyy')} - ${format(new Date(value.to), 'MMM d, yyyy')}`
      : 'Select date range';

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm hover:bg-muted"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className={cn(!value?.from && 'text-muted-foreground')}>
            {displayLabel}
          </span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border bg-card p-4 shadow-lg">
            <div className="space-y-1 mb-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Quick select
              </p>
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset.days)}
                  className="block w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-muted"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Custom range
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">From</label>
                  <input
                    type="date"
                    value={value?.from || ''}
                    onChange={(e) =>
                      onChange({
                        from: e.target.value,
                        to: value?.to || e.target.value,
                      })
                    }
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">To</label>
                  <input
                    type="date"
                    value={value?.to || ''}
                    onChange={(e) =>
                      onChange({
                        from: value?.from || e.target.value,
                        to: e.target.value,
                      })
                    }
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                  />
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
