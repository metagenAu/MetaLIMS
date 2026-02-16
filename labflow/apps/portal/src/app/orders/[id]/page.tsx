'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
  FileText,
  Download,
  Clock,
  TestTubes,
  CheckCircle2,
  FlaskConical,
} from 'lucide-react';
import { clsx } from 'clsx';
import PortalLayout from '@/components/PortalLayout';
import OrderStatusTracker from '@/components/OrderStatusTracker';
import { usePortalOrder } from '@/hooks/usePortalApi';

const TEST_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-gray-100', text: 'text-gray-700' },
  ASSIGNED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  IN_PROGRESS: { bg: 'bg-amber-100', text: 'text-amber-700' },
  COMPLETED: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  IN_REVIEW: { bg: 'bg-purple-100', text: 'text-purple-700' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-700' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },
  ON_HOLD: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

const SAMPLE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  REGISTERED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  RECEIVED: { bg: 'bg-sky-100', text: 'text-sky-700' },
  IN_STORAGE: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  IN_PROGRESS: { bg: 'bg-amber-100', text: 'text-amber-700' },
  TESTING_COMPLETE: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-700' },
  REPORTED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  ON_HOLD: { bg: 'bg-orange-100', text: 'text-orange-700' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const { data: order, isLoading, error, refetch } = usePortalOrder(orderId);

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Loading order details...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm font-medium text-destructive">Failed to load order</p>
            <button
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}

        {order && (
          <>
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">{order.orderNumber}</h1>
                  {order.rushRequested && (
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                      RUSH
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>Created {format(new Date(order.createdAt), 'MMM d, yyyy')}</span>
                  {order.clientPO && <span>PO: {order.clientPO}</span>}
                  {order.clientReference && <span>Ref: {order.clientReference}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {order.dueDate && (
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-2">
                    <Clock className="h-4 w-4" />
                    <span>Due {format(new Date(order.dueDate), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status Tracker */}
            <div className="rounded-lg border border-border bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Order Progress</h2>
              <OrderStatusTracker status={order.status} />
            </div>

            {/* Order Info Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-white p-4">
                <div className="flex items-center gap-2">
                  <TestTubes className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-foreground">Samples</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-foreground">{order.sampleCount}</p>
              </div>
              <div className="rounded-lg border border-border bg-white p-4">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-medium text-foreground">Tests</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {order.completedTestCount}/{order.testCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  {order.testCount > 0
                    ? `${Math.round((order.completedTestCount / order.testCount) * 100)}% complete`
                    : 'No tests assigned'}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-white p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-medium text-foreground">Attachments</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {order.attachments.length}
                </p>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="rounded-lg border border-border bg-white p-5">
                <h2 className="text-sm font-semibold text-foreground">Notes</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {order.notes}
                </p>
              </div>
            )}

            {/* Shipping info */}
            {(order.shippingMethod || order.trackingNumber) && (
              <div className="rounded-lg border border-border bg-white p-5">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Shipping Information</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {order.shippingMethod && (
                    <div>
                      <p className="text-xs text-muted-foreground">Shipping Method</p>
                      <p className="text-sm font-medium text-foreground">{order.shippingMethod}</p>
                    </div>
                  )}
                  {order.trackingNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">Tracking Number</p>
                      <p className="text-sm font-medium text-foreground">{order.trackingNumber}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Samples */}
            <div className="rounded-lg border border-border bg-white">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-foreground">
                  Samples ({order.samples.length})
                </h2>
              </div>
              {order.samples.length === 0 ? (
                <div className="p-8 text-center">
                  <TestTubes className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No samples registered for this order yet.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {order.samples.map((sample) => {
                    const sColors = SAMPLE_STATUS_COLORS[sample.status] || {
                      bg: 'bg-gray-100',
                      text: 'text-gray-700',
                    };
                    return (
                      <div key={sample.id} className="p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <Link
                              href={`/samples/${sample.id}`}
                              className="text-sm font-semibold text-primary hover:underline"
                            >
                              {sample.sampleNumber}
                            </Link>
                            {sample.name && (
                              <span className="ml-2 text-sm text-muted-foreground">
                                - {sample.name}
                              </span>
                            )}
                            <div className="mt-1 flex flex-wrap gap-2">
                              {sample.sampleType && (
                                <span className="text-xs text-muted-foreground">
                                  Type: {sample.sampleType}
                                </span>
                              )}
                              {sample.matrix && (
                                <span className="text-xs text-muted-foreground">
                                  Matrix: {sample.matrix}
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className={clsx(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                              sColors.bg,
                              sColors.text
                            )}
                          >
                            {sample.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Tests for this sample */}
                        {sample.tests.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {sample.tests.map((test) => {
                              const tColors = TEST_STATUS_COLORS[test.status] || {
                                bg: 'bg-gray-100',
                                text: 'text-gray-700',
                              };
                              return (
                                <div
                                  key={test.id}
                                  className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm text-foreground">
                                      {test.methodName}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      ({test.methodCode})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {test.overallResult && (
                                      <span
                                        className={clsx(
                                          'text-xs font-medium',
                                          test.overallResult === 'PASS'
                                            ? 'text-green-600'
                                            : test.overallResult === 'FAIL'
                                              ? 'text-red-600'
                                              : 'text-amber-600'
                                        )}
                                      >
                                        {test.overallResult}
                                      </span>
                                    )}
                                    <span
                                      className={clsx(
                                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                        tColors.bg,
                                        tColors.text
                                      )}
                                    >
                                      {test.status.replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Attachments */}
            {order.attachments.length > 0 && (
              <div className="rounded-lg border border-border bg-white">
                <div className="border-b border-border px-5 py-4">
                  <h2 className="text-base font-semibold text-foreground">
                    Attachments ({order.attachments.length})
                  </h2>
                </div>
                <div className="divide-y divide-border">
                  {order.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between px-5 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {attachment.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(attachment.fileSize / 1024).toFixed(1)} KB &middot;{' '}
                            {format(new Date(attachment.uploadedAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <button className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}
