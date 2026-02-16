'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, Send, Printer, FileText, Loader2, CheckCircle2, Mail } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate, formatDateTime } from '@/lib/formatters';
import api from '@/lib/api';

const fallbackReport = {
  id: '1',
  reportNumber: 'RPT-2024-0452',
  sampleId: 's2',
  sampleDisplayId: 'S-2024-001841',
  clientName: 'GreenTech Labs',
  clientEmail: 'reports@greentech.com',
  type: 'Certificate of Analysis',
  status: 'generated',
  generatedAt: '2024-01-17T09:00:00Z',
  sentAt: null,
  results: [
    { test: 'Lead (Pb)', method: 'EPA 200.8', result: '2.1', units: 'ug/L', limit: '15', status: 'pass' },
    { test: 'Copper (Cu)', method: 'EPA 200.8', result: '45.3', units: 'ug/L', limit: '1300', status: 'pass' },
    { test: 'Arsenic (As)', method: 'EPA 200.8', result: '1.8', units: 'ug/L', limit: '10', status: 'pass' },
    { test: 'Mercury (Hg)', method: 'EPA 200.8', result: '<0.2', units: 'ug/L', limit: '2', status: 'pass' },
    { test: 'pH', method: 'SM 4500', result: '7.2', units: 'SU', limit: '6.5-8.5', status: 'pass' },
    { test: 'Turbidity', method: 'SM 2130', result: '0.4', units: 'NTU', limit: '1', status: 'pass' },
  ],
};

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [sent, setSent] = useState(false);

  const sendMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/reports/${id}/send`);
    },
    onSuccess: () => setSent(true),
  });

  const report = fallbackReport;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Link href="/reports" className="inline-flex items-center justify-center rounded-md border bg-background p-2 hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{report.reportNumber}</h1>
                <StatusBadge status={sent ? 'sent' : report.status} />
              </div>
              <p className="text-muted-foreground mt-1">
                {report.type} - {report.clientName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              <Download className="h-4 w-4" />
              Download PDF
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              <Printer className="h-4 w-4" />
              Print
            </button>
            {!sent && report.status !== 'sent' && (
              <button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send to Client
              </button>
            )}
          </div>
        </div>

        {sent && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 p-3 dark:bg-emerald-900/20 dark:border-emerald-800">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Report sent successfully</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">
                Sent to {report.clientEmail}
              </p>
            </div>
          </div>
        )}

        {/* Report Preview */}
        <div className="rounded-lg border bg-white dark:bg-card p-8 max-w-3xl mx-auto shadow-sm">
          {/* Report Header */}
          <div className="text-center border-b pb-6 mb-6">
            <h2 className="text-xl font-bold">Certificate of Analysis</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Report #{report.reportNumber}
            </p>
          </div>

          {/* Report Meta */}
          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Client</p>
              <p className="font-medium">{report.clientName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Sample ID</p>
              <p className="font-medium">{report.sampleDisplayId}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Report Date</p>
              <p className="font-medium">{formatDate(report.generatedAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Report Type</p>
              <p className="font-medium">{report.type}</p>
            </div>
          </div>

          {/* Results Table */}
          <div className="border rounded-md overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium">Parameter</th>
                  <th className="px-3 py-2 text-left font-medium">Method</th>
                  <th className="px-3 py-2 text-center font-medium">Result</th>
                  <th className="px-3 py-2 text-center font-medium">Units</th>
                  <th className="px-3 py-2 text-center font-medium">Limit</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.results.map((result, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium">{result.test}</td>
                    <td className="px-3 py-2 text-muted-foreground">{result.method}</td>
                    <td className="px-3 py-2 text-center">{result.result}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{result.units}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{result.limit}</td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={result.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="border-t pt-4 text-xs text-muted-foreground text-center">
            <p>This report is generated by LabFlow LIMS and represents the analytical results as determined by the laboratory.</p>
            <p className="mt-1">Results relate only to the samples as received. This report shall not be reproduced except in full without written approval.</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
