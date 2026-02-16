'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const data = [
  { month: 'Jan', revenue: 45000, invoiced: 52000 },
  { month: 'Feb', revenue: 48000, invoiced: 47000 },
  { month: 'Mar', revenue: 55000, invoiced: 60000 },
  { month: 'Apr', revenue: 51000, invoiced: 53000 },
  { month: 'May', revenue: 62000, invoiced: 58000 },
  { month: 'Jun', revenue: 58000, invoiced: 65000 },
  { month: 'Jul', revenue: 67000, invoiced: 63000 },
  { month: 'Aug', revenue: 72000, invoiced: 70000 },
  { month: 'Sep', revenue: 68000, invoiced: 72000 },
  { month: 'Oct', revenue: 75000, invoiced: 78000 },
  { month: 'Nov', revenue: 71000, invoiced: 74000 },
  { month: 'Dec', revenue: 80000, invoiced: 82000 },
];

const formatCurrency = (value: number) => {
  return `$${(value / 1000).toFixed(0)}k`;
};

interface RevenueChartProps {
  chartData?: { month: string; revenue: number; invoiced: number }[];
}

export function RevenueChart({ chartData }: RevenueChartProps) {
  const displayData = chartData || data;

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4">
        <h3 className="text-sm font-medium">Revenue Overview</h3>
        <p className="text-xs text-muted-foreground">
          Monthly revenue collected vs invoiced
        </p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="month"
              className="text-xs"
              tick={{ fill: 'hsl(215, 16%, 47%)' }}
            />
            <YAxis
              className="text-xs"
              tickFormatter={formatCurrency}
              tick={{ fill: 'hsl(215, 16%, 47%)' }}
            />
            <Tooltip
              formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(214, 32%, 91%)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Collected"
              stroke="hsl(142, 76%, 36%)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="invoiced"
              name="Invoiced"
              stroke="hsl(221, 83%, 53%)"
              strokeWidth={2}
              dot={{ r: 3 }}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
