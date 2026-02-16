'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
  TestTubes,
  FlaskConical,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  MapPin,
  Calendar,
} from 'lucide-react';
import { clsx } from 'clsx';
import PortalLayout from '@/components/PortalLayout';
import { usePortalSample } from '@/hooks/usePortalApi';

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

const PASS_STATUS_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  PASS: { icon: CheckCircle2, color: 'text-green-600' },
  FAIL: { icon: XCircle, color: 'text-red-600' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-600' },
  NOT_APPLICABLE: { icon: Clock, color: 'text-gray-400' },
};

export default function SampleDetailPage() {
  const params = useParams();
  const sampleId = params.id as string;
  const { data: sample, isLoading, error, refetch } = usePortalSample(sampleId);

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/samples"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Samples
          </Link>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Loading sample details...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm font-medium text-destructive">Failed to load sample</p>
            <button
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}

        {sample && (
          <>
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">{sample.sampleNumber}</h1>
                  {(() => {
                    const colors = SAMPLE_STATUS_COLORS[sample.status] || {
                      bg: 'bg-gray-100',
                      text: 'text-gray-700',
                    };
                    return (
                      <span
                        className={clsx(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                          colors.bg,
                          colors.text
                        )}
                      >
                        {sample.status.replace(/_/g, ' ')}
                      </span>
                    );
                  })()}
                </div>
                {sample.name && (
                  <p className="mt-1 text-sm text-muted-foreground">{sample.name}</p>
                )}
              </div>
              <Link
                href={`/orders/${sample.orderId}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Order {sample.orderNumber}
              </Link>
            </div>

            {/* Sample Info */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {sample.sampleType && (
                <div className="rounded-lg border border-border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Sample Type</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{sample.sampleType}</p>
                </div>
              )}
              {sample.matrix && (
                <div className="rounded-lg border border-border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Matrix</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{sample.matrix}</p>
                </div>
              )}
              {sample.collectedDate && (
                <div className="rounded-lg border border-border bg-white p-4">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Collected</p>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {format(new Date(sample.collectedDate), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {sample.collectionLocation && (
                <div className="rounded-lg border border-border bg-white p-4">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Location</p>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {sample.collectionLocation}
                  </p>
                </div>
              )}
              {sample.receivedDate && (
                <div className="rounded-lg border border-border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Received at Lab</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {format(new Date(sample.receivedDate), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            {sample.description && (
              <div className="rounded-lg border border-border bg-white p-5">
                <h2 className="text-sm font-semibold text-foreground">Description</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {sample.description}
                </p>
              </div>
            )}

            {/* Progress */}
            {sample.testCount > 0 && (
              <div className="rounded-lg border border-border bg-white p-5">
                <h2 className="text-sm font-semibold text-foreground">Testing Progress</h2>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.round((sample.completedTestCount / sample.testCount) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {sample.completedTestCount}/{sample.testCount}
                  </span>
                </div>
              </div>
            )}

            {/* Test Results */}
            <div className="rounded-lg border border-border bg-white">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-foreground">
                  Test Results ({sample.tests.length})
                </h2>
              </div>

              {sample.tests.length === 0 ? (
                <div className="p-8 text-center">
                  <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No tests assigned to this sample yet.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {sample.tests.map((test) => {
                    const showResults =
                      test.results.length > 0 &&
                      ['APPROVED', 'COMPLETED', 'IN_REVIEW'].includes(test.status);
                    return (
                      <div key={test.id} className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold text-foreground">
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
                                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                                  test.overallResult === 'PASS' && 'bg-green-100 text-green-700',
                                  test.overallResult === 'FAIL' && 'bg-red-100 text-red-700',
                                  test.overallResult === 'DETECTED' && 'bg-amber-100 text-amber-700',
                                  test.overallResult === 'NOT_DETECTED' && 'bg-green-100 text-green-700',
                                  test.overallResult === 'INCONCLUSIVE' && 'bg-orange-100 text-orange-700'
                                )}
                              >
                                {test.overallResult.replace(/_/g, ' ')}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {test.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>

                        {test.completedDate && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Completed: {format(new Date(test.completedDate), 'MMM d, yyyy')}
                          </p>
                        )}

                        {/* Results table */}
                        {showResults && (
                          <div className="mt-3 overflow-hidden rounded-md border border-border">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-muted/50">
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                                    Analyte
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                                    Result
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                                    Unit
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                                    Spec Range
                                  </th>
                                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                                    Status
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {test.results.map((result, idx) => {
                                  const passConfig = result.passStatus
                                    ? PASS_STATUS_ICONS[result.passStatus]
                                    : null;
                                  const PassIcon = passConfig?.icon;
                                  return (
                                    <tr key={idx}>
                                      <td className="px-3 py-2">
                                        <p className="text-sm text-foreground">
                                          {result.analyteName}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {result.analyteCode}
                                        </p>
                                      </td>
                                      <td className="px-3 py-2 text-sm font-medium text-foreground">
                                        {result.finalValue ?? '-'}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-muted-foreground">
                                        {result.unit ?? '-'}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-muted-foreground">
                                        {result.specMin != null && result.specMax != null
                                          ? `${result.specMin} - ${result.specMax}`
                                          : result.specMin != null
                                            ? `>= ${result.specMin}`
                                            : result.specMax != null
                                              ? `<= ${result.specMax}`
                                              : '-'}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {PassIcon && passConfig ? (
                                          <PassIcon
                                            className={clsx('mx-auto h-4 w-4', passConfig.color)}
                                          />
                                        ) : (
                                          <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {!showResults && test.status !== 'CANCELLED' && (
                          <div className="mt-3 rounded-md bg-muted/50 p-3 text-center text-xs text-muted-foreground">
                            Results will be available once testing is complete and approved.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
