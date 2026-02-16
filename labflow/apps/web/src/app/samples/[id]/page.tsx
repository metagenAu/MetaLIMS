'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  Printer,
  MoreVertical,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import * as Tabs from '@radix-ui/react-tabs';
import { MainLayout } from '@/components/layout/MainLayout';
import { SampleStatusBadge } from '@/components/samples/SampleStatusBadge';
import { SampleTimeline } from '@/components/samples/SampleTimeline';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useSample, useUpdateSampleStatus } from '@/hooks/useSamples';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';

// Fallback data
const fallbackSample = {
  id: '1',
  sampleId: 'S-2024-001847',
  clientId: 'client-1',
  clientName: 'Acme Environmental',
  matrix: 'drinking_water',
  description: 'Municipal water supply - Main St. distribution point',
  status: 'testing',
  collectionDate: '2024-01-15T10:30:00Z',
  receivedDate: '2024-01-15T14:00:00Z',
  dueDate: '2024-01-22T17:00:00Z',
  priority: 'rush' as const,
  location: 'Lab A - Shelf 3',
  assignedTo: 'Dr. Sarah Chen',
  orderId: 'ORD-2024-0891',
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-17T09:15:00Z',
  notes: 'Priority analysis requested by client. Possible contamination reported.',
  tests: [
    { id: 't1', name: 'Heavy Metals (ICP-MS)', status: 'completed', result: 'Pass', analyst: 'Dr. Chen', completedAt: '2024-01-16T11:00:00Z' },
    { id: 't2', name: 'Volatile Organic Compounds', status: 'in_progress', result: null, analyst: 'James Wilson', completedAt: null },
    { id: 't3', name: 'Total Coliform', status: 'completed', result: 'Pass', analyst: 'Maria Santos', completedAt: '2024-01-16T15:30:00Z' },
    { id: 't4', name: 'E. coli', status: 'completed', result: 'Pass', analyst: 'Maria Santos', completedAt: '2024-01-16T15:30:00Z' },
    { id: 't5', name: 'pH', status: 'completed', result: '7.2', analyst: 'Dr. Chen', completedAt: '2024-01-15T16:00:00Z' },
    { id: 't6', name: 'Turbidity', status: 'pending', result: null, analyst: null, completedAt: null },
  ],
  chainOfCustody: [
    { id: 'e1', event: 'registered', description: 'Sample registered in system', user: 'John Smith', timestamp: '2024-01-15T10:30:00Z' },
    { id: 'e2', event: 'received', description: 'Sample received at laboratory', user: 'Lisa Park', timestamp: '2024-01-15T14:00:00Z' },
    { id: 'e3', event: 'testing_started', description: 'Testing initiated - assigned to Lab A', user: 'Dr. Sarah Chen', timestamp: '2024-01-15T15:30:00Z' },
    { id: 'e4', event: 'result_entered', description: 'pH result entered: 7.2', user: 'Dr. Sarah Chen', timestamp: '2024-01-15T16:00:00Z' },
    { id: 'e5', event: 'result_entered', description: 'Metals analysis completed - all within limits', user: 'Dr. Sarah Chen', timestamp: '2024-01-16T11:00:00Z' },
    { id: 'e6', event: 'result_entered', description: 'Microbiology results entered', user: 'Maria Santos', timestamp: '2024-01-16T15:30:00Z' },
  ],
};

export default function SampleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: sample, isLoading, error } = useSample(id);
  const updateStatus = useUpdateSampleStatus();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState('');

  const displaySample = sample || fallbackSample;

  const handleStatusChange = (status: string) => {
    setNextStatus(status);
    setStatusDialogOpen(true);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (error && !fallbackSample) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-24">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-lg font-semibold">Sample not found</h2>
          <p className="text-muted-foreground mt-1">
            The sample you are looking for does not exist or you lack access.
          </p>
          <Link
            href="/samples"
            className="mt-4 text-sm text-primary hover:underline"
          >
            Back to samples
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/samples"
              className="inline-flex items-center justify-center rounded-md border bg-background p-2 hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">
                  {displaySample.sampleId}
                </h1>
                <SampleStatusBadge status={displaySample.status} />
                {displaySample.priority !== 'normal' && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      displaySample.priority === 'urgent'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    )}
                  >
                    {displaySample.priority.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-1">
                {displaySample.clientName} - {displaySample.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              <Printer className="h-4 w-4" />
              Print Label
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              <Edit className="h-4 w-4" />
              Edit
            </button>
            {displaySample.status === 'testing' && (
              <button
                onClick={() => handleStatusChange('review')}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Submit for Review
              </button>
            )}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Sample Information
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Matrix</dt>
                <dd className="font-medium capitalize">
                  {displaySample.matrix.replace(/_/g, ' ')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Collection Date</dt>
                <dd className="font-medium">
                  {formatDate(displaySample.collectionDate)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Received</dt>
                <dd className="font-medium">
                  {formatDateTime(displaySample.receivedDate)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Due Date</dt>
                <dd className="font-medium">
                  {formatDate(displaySample.dueDate)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Location</dt>
                <dd className="font-medium">{displaySample.location}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Assignment
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Assigned To</dt>
                <dd className="font-medium">
                  {displaySample.assignedTo || '--'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Order</dt>
                <dd>
                  {displaySample.orderId ? (
                    <Link
                      href={`/orders/${displaySample.orderId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {displaySample.orderId}
                    </Link>
                  ) : (
                    '--'
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Client</dt>
                <dd>
                  <Link
                    href={`/clients/${displaySample.clientId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {displaySample.clientName}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Priority</dt>
                <dd className="font-medium capitalize">
                  {displaySample.priority}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Progress
            </h3>
            <div className="space-y-3">
              {(() => {
                const tests = displaySample.tests || [];
                const completed = tests.filter(
                  (t: any) => t.status === 'completed'
                ).length;
                const total = tests.length;
                const pct = total > 0 ? (completed / total) * 100 : 0;
                return (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tests Completed</span>
                      <span className="font-medium">
                        {completed} / {total}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(pct)}% complete
                    </p>
                  </>
                );
              })()}
              {displaySample.notes && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Notes
                  </p>
                  <p className="text-sm">{displaySample.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs.Root defaultValue="results">
          <Tabs.List className="flex border-b">
            <Tabs.Trigger
              value="results"
              className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              Test Results
            </Tabs.Trigger>
            <Tabs.Trigger
              value="custody"
              className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              Chain of Custody
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="results" className="mt-4">
            <div className="rounded-lg border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Test
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Result
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Analyst
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(displaySample.tests || []).map((test: any) => (
                    <tr key={test.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{test.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={test.status} />
                      </td>
                      <td className="px-4 py-3">
                        {test.result ? (
                          <div className="flex items-center gap-1.5">
                            {test.result === 'Pass' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : test.result === 'Fail' ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : null}
                            <span>{test.result}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {test.analyst || (
                          <span className="text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {formatDateTime(test.completedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tabs.Content>

          <Tabs.Content value="custody" className="mt-4">
            <div className="rounded-lg border bg-card p-6">
              <SampleTimeline
                events={displaySample.chainOfCustody || []}
              />
            </div>
          </Tabs.Content>
        </Tabs.Root>

        <ConfirmDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          title="Update Sample Status"
          description={`Are you sure you want to change the status to "${nextStatus.replace(/_/g, ' ')}"?`}
          confirmLabel="Update Status"
          onConfirm={() => {
            updateStatus.mutate({ id, status: nextStatus });
          }}
          isLoading={updateStatus.isPending}
        />
      </div>
    </MainLayout>
  );
}
