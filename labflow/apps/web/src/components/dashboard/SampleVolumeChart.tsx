'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const data = [
  { date: 'Mon', samples: 42 },
  { date: 'Tue', samples: 58 },
  { date: 'Wed', samples: 65 },
  { date: 'Thu', samples: 48 },
  { date: 'Fri', samples: 73 },
  { date: 'Sat', samples: 22 },
  { date: 'Sun', samples: 15 },
  { date: 'Mon', samples: 55 },
  { date: 'Tue', samples: 67 },
  { date: 'Wed', samples: 71 },
  { date: 'Thu', samples: 62 },
  { date: 'Fri', samples: 80 },
  { date: 'Sat', samples: 30 },
  { date: 'Sun', samples: 18 },
];

interface SampleVolumeChartProps {
  chartData?: { date: string; samples: number }[];
}

export function SampleVolumeChart({ chartData }: SampleVolumeChartProps) {
  const displayData = chartData || data;

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4">
        <h3 className="text-sm font-medium">Sample Volume Trend</h3>
        <p className="text-xs text-muted-foreground">
          Samples received over the last 14 days
        </p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayData}>
            <defs>
              <linearGradient id="sampleGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: 'hsl(215, 16%, 47%)' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'hsl(215, 16%, 47%)' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(214, 32%, 91%)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="samples"
              stroke="hsl(221, 83%, 53%)"
              fill="url(#sampleGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
