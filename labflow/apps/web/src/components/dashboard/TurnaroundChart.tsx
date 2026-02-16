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
  ReferenceLine,
} from 'recharts';

const data = [
  { method: 'Metals', avgDays: 2.1, target: 3 },
  { method: 'VOCs', avgDays: 3.5, target: 5 },
  { method: 'SVOCs', avgDays: 4.2, target: 5 },
  { method: 'Nutrients', avgDays: 1.8, target: 2 },
  { method: 'Micro', avgDays: 2.5, target: 3 },
  { method: 'Pesticides', avgDays: 5.1, target: 7 },
  { method: 'General', avgDays: 1.2, target: 2 },
];

interface TurnaroundChartProps {
  chartData?: { method: string; avgDays: number; target: number }[];
}

export function TurnaroundChart({ chartData }: TurnaroundChartProps) {
  const displayData = chartData || data;

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4">
        <h3 className="text-sm font-medium">Turnaround Time by Method</h3>
        <p className="text-xs text-muted-foreground">
          Average days to complete vs target
        </p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="method"
              className="text-xs"
              tick={{ fill: 'hsl(215, 16%, 47%)' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'hsl(215, 16%, 47%)' }}
              label={{
                value: 'Days',
                angle: -90,
                position: 'insideLeft',
                style: { fill: 'hsl(215, 16%, 47%)', fontSize: 12 },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(214, 32%, 91%)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar
              dataKey="avgDays"
              name="Avg Days"
              fill="hsl(221, 83%, 53%)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="target"
              name="Target"
              fill="hsl(215, 16%, 87%)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
