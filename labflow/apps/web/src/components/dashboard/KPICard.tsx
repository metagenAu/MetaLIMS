'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  iconColor?: string;
}

export function KPICard({
  title,
  value,
  change,
  changeLabel = 'vs last period',
  icon: Icon,
  iconColor = 'text-primary',
}: KPICardProps) {
  const getTrend = () => {
    if (change === undefined || change === 0)
      return { icon: Minus, color: 'text-muted-foreground', label: 'No change' };
    if (change > 0)
      return { icon: TrendingUp, color: 'text-emerald-600', label: `+${change}%` };
    return { icon: TrendingDown, color: 'text-red-600', label: `${change}%` };
  };

  const trend = getTrend();
  const TrendIcon = trend.icon;

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10',
            iconColor
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold">{value}</p>
        {change !== undefined && (
          <div className="mt-1 flex items-center gap-1">
            <TrendIcon className={cn('h-3.5 w-3.5', trend.color)} />
            <span className={cn('text-xs font-medium', trend.color)}>
              {trend.label}
            </span>
            <span className="text-xs text-muted-foreground">{changeLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
