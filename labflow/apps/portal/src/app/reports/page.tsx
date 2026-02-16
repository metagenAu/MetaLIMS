'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  FileText,
  Download,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
  File,
} from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import { usePortalReports } from '@/hooks/usePortalApi';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReportsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = usePortalReports({ page, pageSize: 20 });

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">
            View and download your laboratory reports.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Loading reports...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm font-medium text-destructive">Failed to load reports</p>
            <button
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}

        {data && data.data.length === 0 && (
          <div className="rounded-lg border border-border bg-white p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-base font-medium text-foreground">No reports available</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Reports will appear here once your orders are completed and results are approved.
            </p>
          </div>
        )}

        {data && data.data.length > 0 && (
          <>
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Report
                    </th>
                    <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground sm:table-cell">
                      Order
                    </th>
                    <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground md:table-cell">
                      Type
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Date
                    </th>
                    <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground lg:table-cell">
                      Size
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map((report) => (
                    <tr key={report.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <File className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {report.reportNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">{report.title}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-5 py-3 sm:table-cell">
                        <Link
                          href={`/orders/${report.orderId}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {report.orderNumber}
                        </Link>
                      </td>
                      <td className="hidden px-5 py-3 text-sm text-muted-foreground md:table-cell">
                        {report.type}
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        {format(new Date(report.generatedAt), 'MMM d, yyyy')}
                      </td>
                      <td className="hidden px-5 py-3 text-sm text-muted-foreground lg:table-cell">
                        {formatFileSize(report.fileSize)}
                      </td>
                      <td className="px-5 py-3">
                        <a
                          href={report.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(data.page - 1) * data.pageSize + 1} to{' '}
                  {Math.min(data.page * data.pageSize, data.total)} of {data.total} reports
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= data.totalPages}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}
