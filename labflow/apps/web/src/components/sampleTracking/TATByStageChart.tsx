'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';

interface TATStage {
  stageKey: string;
  label: string;
  avgDurationMinutes: number;
  medianDurationMinutes: number;
  p95DurationMinutes: number;
  expectedDurationMinutes: number | null;
  sampleCount: number;
  onTargetPercentage: number;
}

interface CategoryTAT {
  category: string;
  categoryLabel: string;
  stages: TATStage[];
  overallAvgDays: number;
  overallOnTimePercentage: number;
}

interface TATByStageChartProps {
  data: CategoryTAT;
}

function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

export function TATByStageChart({ data }: TATByStageChartProps) {
  const chartData = data.stages.map((stage) => ({
    name: stage.label,
    avgHours: minutesToHours(stage.avgDurationMinutes),
    targetHours: stage.expectedDurationMinutes
      ? minutesToHours(stage.expectedDurationMinutes)
      : null,
    onTarget: stage.onTargetPercentage,
    samples: stage.sampleCount,
  }));

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">{data.categoryLabel}</h3>
          <p className="text-xs text-muted-foreground">
            Avg {data.overallAvgDays}d end-to-end &middot;{' '}
            {data.overallOnTimePercentage}% on target
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
            <span className="text-muted-foreground">Avg Hours</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded-sm bg-gray-300" />
            <span className="text-muted-foreground">Target</span>
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="name"
              className="text-xs"
              tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 10 }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'hsl(215, 16%, 47%)' }}
              label={{
                value: 'Hours',
                angle: -90,
                position: 'insideLeft',
                style: { fill: 'hsl(215, 16%, 47%)', fontSize: 11 },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(214, 32%, 91%)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'avgHours') return [`${value}h`, 'Avg Duration'];
                if (name === 'targetHours') return [`${value}h`, 'Target'];
                return [value, name];
              }}
            />
            <Bar dataKey="avgHours" name="avgHours" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.onTarget >= 80
                      ? 'hsl(221, 83%, 53%)'
                      : entry.onTarget >= 60
                        ? 'hsl(38, 92%, 50%)'
                        : 'hsl(0, 72%, 51%)'
                  }
                />
              ))}
            </Bar>
            <Bar
              dataKey="targetHours"
              name="targetHours"
              fill="hsl(215, 16%, 87%)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-stage on-target pills */}
      <div className="mt-3 flex flex-wrap gap-2">
        {data.stages.map((stage) => (
          <div
            key={stage.stageKey}
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              stage.onTargetPercentage >= 80
                ? 'bg-emerald-100 text-emerald-800'
                : stage.onTargetPercentage >= 60
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800',
            )}
          >
            <span>{stage.label}</span>
            <span className="font-bold">{stage.onTargetPercentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
