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
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';

interface AgingData {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
}

interface AgingChartProps {
  data: AgingData;
}

const COLORS = [
  'hsl(221, 83%, 53%)',
  'hsl(38, 92%, 50%)',
  'hsl(25, 95%, 53%)',
  'hsl(0, 84%, 60%)',
  'hsl(0, 72%, 51%)',
];

export function AgingChart({ data }: AgingChartProps) {
  const chartData = [
    { bucket: 'Current', amount: data.current },
    { bucket: '1-30 Days', amount: data.days30 },
    { bucket: '31-60 Days', amount: data.days60 },
    { bucket: '61-90 Days', amount: data.days90 },
    { bucket: '90+ Days', amount: data.over90 },
  ];

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4">
        <h3 className="text-sm font-medium">Accounts Receivable Aging</h3>
        <p className="text-xs text-muted-foreground">
          Outstanding invoice balances by age
        </p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="bucket"
              className="text-xs"
              tick={{ fill: 'hsl(215, 16%, 47%)' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'hsl(215, 16%, 47%)' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), 'Amount']}
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(214, 32%, 91%)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
