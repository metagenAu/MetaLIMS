'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FlaskConical,
  Clock,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/MainLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { SampleVolumeChart } from '@/components/dashboard/SampleVolumeChart';
import { TurnaroundChart } from '@/components/dashboard/TurnaroundChart';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatCurrency, formatRelativeTime } from '@/lib/formatters';
import api from '@/lib/api';

interface DashboardData {
  kpis: {
    samplesToday: number;
    samplesTodayChange: number;
    pendingTests: number;
    pendingTestsChange: number;
    overdueInvoices: number;
    overdueAmount: number;
    monthlyRevenue: number;
    revenueChange: number;
  };
  pendingActions: {
    id: string;
    type: string;
    title: string;
    description: string;
    priority: string;
    timestamp: string;
  }[];
}

// Fallback data for when API is unavailable
const fallbackData: DashboardData = {
  kpis: {
    samplesToday: 47,
    samplesTodayChange: 12,
    pendingTests: 128,
    pendingTestsChange: -5,
    overdueInvoices: 8,
    overdueAmount: 24350,
    monthlyRevenue: 72400,
    revenueChange: 8,
  },
  pendingActions: [
    {
      id: '1',
      type: 'review',
      title: 'Batch #B-2024-0342 ready for review',
      description: '15 samples awaiting QA approval',
      priority: 'high',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: '2',
      type: 'overdue',
      title: 'Sample S-2024-1847 past due date',
      description: 'Client: Acme Environmental - Rush order',
      priority: 'urgent',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: '3',
      type: 'receiving',
      title: '12 samples pending receiving',
      description: 'Order #ORD-2024-0891 from GreenTech Labs',
      priority: 'normal',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: '4',
      type: 'invoice',
      title: 'Invoice INV-2024-0156 is 30 days overdue',
      description: 'Client: Riverside Water Authority - $4,200.00',
      priority: 'high',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '5',
      type: 'calibration',
      title: 'ICP-MS due for calibration',
      description: 'Scheduled maintenance required by Feb 20',
      priority: 'normal',
      timestamp: new Date(Date.now() - 172800000).toISOString(),
    },
  ],
};

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard');
      return data as DashboardData;
    },
    retry: false,
  });

  const dashboardData = data || fallbackData;

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your laboratory operations
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Samples Today"
            value={String(dashboardData.kpis.samplesToday)}
            change={dashboardData.kpis.samplesTodayChange}
            changeLabel="vs yesterday"
            icon={FlaskConical}
          />
          <KPICard
            title="Pending Tests"
            value={String(dashboardData.kpis.pendingTests)}
            change={dashboardData.kpis.pendingTestsChange}
            changeLabel="vs last week"
            icon={Clock}
          />
          <KPICard
            title="Overdue Invoices"
            value={`${dashboardData.kpis.overdueInvoices} (${formatCurrency(dashboardData.kpis.overdueAmount)})`}
            icon={AlertTriangle}
            iconColor="text-amber-600"
          />
          <KPICard
            title="Monthly Revenue"
            value={formatCurrency(dashboardData.kpis.monthlyRevenue)}
            change={dashboardData.kpis.revenueChange}
            changeLabel="vs last month"
            icon={DollarSign}
            iconColor="text-emerald-600"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SampleVolumeChart />
          <TurnaroundChart />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RevenueChart />
          </div>

          {/* Pending Actions */}
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h3 className="text-sm font-medium">Pending Actions</h3>
                <p className="text-xs text-muted-foreground">
                  Items requiring your attention
                </p>
              </div>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {dashboardData.pendingActions.length}
              </span>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto scrollbar-thin">
              {dashboardData.pendingActions.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No pending actions. You are all caught up!
                </div>
              ) : (
                dashboardData.pendingActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="mt-0.5">
                      {getPriorityIcon(action.priority)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {action.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {action.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatRelativeTime(action.timestamp)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                ))
              )}
            </div>
            <div className="border-t p-3">
              <Link
                href="/testing/review"
                className="flex items-center justify-center gap-1 text-xs text-primary hover:underline"
              >
                View all actions
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
