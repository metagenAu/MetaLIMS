'use client';

import React from 'react';
import {
  ClipboardList,
  PackageCheck,
  Microscope,
  CheckCircle2,
  FileText,
  Send,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/formatters';

interface TimelineEvent {
  id: string;
  event: string;
  description: string;
  user: string;
  timestamp: string;
}

interface SampleTimelineProps {
  events: TimelineEvent[];
}

const eventIcons: Record<string, React.ElementType> = {
  registered: ClipboardList,
  received: PackageCheck,
  testing_started: Microscope,
  result_entered: Microscope,
  reviewed: CheckCircle2,
  approved: CheckCircle2,
  report_generated: FileText,
  report_sent: Send,
  default: User,
};

const eventColors: Record<string, string> = {
  registered: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  received: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  testing_started: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  result_entered: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  reviewed: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  approved: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  report_generated: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  report_sent: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  default: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export function SampleTimeline({ events }: SampleTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No chain of custody events recorded yet.
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {events.map((event, index) => {
        const Icon = eventIcons[event.event] || eventIcons.default;
        const colorClass = eventColors[event.event] || eventColors.default;
        const isLast = index === events.length - 1;

        return (
          <div key={event.id} className="flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                  colorClass
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-border mt-1" />
              )}
            </div>
            <div className="flex-1 pb-2">
              <p className="text-sm font-medium">
                {event.description || event.event.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {event.user}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(event.timestamp)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
