'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import {
  ClipboardList,
  TestTubes,
  FileText,
  Receipt,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import PortalLayout from '@/components/PortalLayout';
import SampleStatusCard from '@/components/SampleStatusCard';
import InvoiceCard from '@/components/InvoiceCard';
import { usePortalDashboard } from '@/hooks/usePortalApi';

const ORDER_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700' },
  SUBMITTED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  RECEIVED: { bg: 'bg-sky-100', text: 'text-sky-700' },
  IN_PROGRESS: { bg: 'bg-amber-100', text: 'text-amber-700' },
  TESTING_COMPLETE: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  IN_REVIEW: { bg: 'bg-purple-100', text: 'text-purple-700' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-700' },
  REPORTED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700' },
  ON_HOLD: { bg: 'bg-orange-100', text: 'text-orange-700' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function DashboardPage() {
  const { data: dashboard, isLoading, error, refetch } = usePortalDashboard();

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back. Here&apos;s an overview of your account.
            </p>
          </div>
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <ClipboardList className="h-4 w-4" />
            New Order
          </Link>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Loading dashboard...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm font-medium text-destructive">Failed to load dashboard</p>
            <p className="mt-1 text-xs text-muted-foreground">
              There was a problem loading your dashboard data.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}

        {dashboard && (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      {dashboard.stats.totalOrders}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Orders</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      {dashboard.stats.activeOrders}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Samples</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      {dashboard.stats.totalSamples}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100">
                    <TestTubes className="h-5 w-5 text-cyan-600" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Outstanding</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      ${dashboard.invoiceSummary.outstandingTotal.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    {dashboard.invoiceSummary.overdueCount > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        {dashboard.invoiceSummary.overdueCount} overdue
                      </p>
                    )}
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="rounded-lg border border-border bg-white">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-foreground">Recent Orders</h2>
                <Link
                  href="/orders"
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {dashboard.recentOrders.length === 0 ? (
                <div className="p-8 text-center">
                  <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">No orders yet</p>
                  <Link
                    href="/orders/new"
                    className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    Submit your first order
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {dashboard.recentOrders.map((order) => {
                    const statusColor = ORDER_STATUS_COLORS[order.status] || {
                      bg: 'bg-gray-100',
                      text: 'text-gray-700',
                    };
                    return (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="flex items-center justify-between px-5 py-3 hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {order.orderNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(order.createdAt), 'MMM d, yyyy')} &middot;{' '}
                              {order.sampleCount} sample{order.sampleCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={clsx(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                              statusColor.bg,
                              statusColor.text
                            )}
                          >
                            {order.status.replace(/_/g, ' ')}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pending Samples + Recent Reports side by side */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Pending Samples */}
              <div className="rounded-lg border border-border bg-white">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h2 className="text-base font-semibold text-foreground">Pending Samples</h2>
                  <Link
                    href="/samples"
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    View all
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {dashboard.pendingSamples.length === 0 ? (
                  <div className="p-8 text-center">
                    <TestTubes className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">No pending samples</p>
                  </div>
                ) : (
                  <div className="space-y-3 p-4">
                    {dashboard.pendingSamples.slice(0, 5).map((sample) => (
                      <SampleStatusCard key={sample.id} sample={sample} />
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Reports */}
              <div className="rounded-lg border border-border bg-white">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h2 className="text-base font-semibold text-foreground">Recent Reports</h2>
                  <Link
                    href="/reports"
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    View all
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {dashboard.recentReports.length === 0 ? (
                  <div className="p-8 text-center">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">No reports available yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {dashboard.recentReports.slice(0, 5).map((report) => (
                      <div
                        key={report.id}
                        className="flex items-center justify-between px-5 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {report.reportNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {report.title} &middot; Order {report.orderNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(report.generatedAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <a
                          href={report.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Outstanding Invoices */}
            {dashboard.invoiceSummary.outstandingCount > 0 && (
              <div className="rounded-lg border border-border bg-white">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">
                      Outstanding Invoices
                    </h2>
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      {dashboard.invoiceSummary.outstandingCount}
                    </span>
                  </div>
                  <Link
                    href="/invoices"
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    View all
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-4 rounded-lg bg-amber-50 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                      <Receipt className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        You have {dashboard.invoiceSummary.outstandingCount} outstanding invoice
                        {dashboard.invoiceSummary.outstandingCount !== 1 ? 's' : ''} totaling{' '}
                        <span className="font-semibold">
                          $
                          {dashboard.invoiceSummary.outstandingTotal.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </p>
                      {dashboard.invoiceSummary.overdueCount > 0 && (
                        <p className="mt-0.5 text-xs text-destructive">
                          {dashboard.invoiceSummary.overdueCount} overdue ($
                          {dashboard.invoiceSummary.overdueTotal.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}
                          )
                        </p>
                      )}
                    </div>
                    <Link
                      href="/invoices"
                      className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Pay Now
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}
