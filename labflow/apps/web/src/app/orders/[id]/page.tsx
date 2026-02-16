'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit,
  Printer,
  Loader2,
  AlertCircle,
  Clock,
  User,
  Mail,
} from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SampleStatusBadge } from '@/components/samples/SampleStatusBadge';
import { useOrder, useUpdateOrderStatus } from '@/hooks/useOrders';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/formatters';

const fallbackOrder = {
  id: '1',
  orderNumber: 'ORD-2024-0891',
  clientId: 'client-2',
  clientName: 'GreenTech Labs',
  status: 'processing',
  sampleCount: 5,
  totalAmount: 3750,
  dueDate: '2024-01-25T17:00:00Z',
  createdAt: '2024-01-14T09:00:00Z',
  updatedAt: '2024-01-16T11:00:00Z',
  contactName: 'Michael Torres',
  contactEmail: 'mtorres@greentech.com',
  notes: 'Quarterly monitoring samples from Site B. Standard TAT applies.',
  samples: [
    { id: 's1', sampleId: 'S-2024-001843', matrix: 'groundwater', status: 'testing', description: 'Well MW-01' },
    { id: 's2', sampleId: 'S-2024-001844', matrix: 'groundwater', status: 'testing', description: 'Well MW-02' },
    { id: 's3', sampleId: 'S-2024-001845', matrix: 'groundwater', status: 'received', description: 'Well MW-03' },
    { id: 's4', sampleId: 'S-2024-001846', matrix: 'soil', status: 'received', description: 'Boring B-01' },
    { id: 's5', sampleId: 'S-2024-001847', matrix: 'soil', status: 'registered', description: 'Boring B-02' },
  ],
  timeline: [
    { event: 'Order created', timestamp: '2024-01-14T09:00:00Z', user: 'Michael Torres (Client Portal)' },
    { event: 'Order submitted for processing', timestamp: '2024-01-14T09:05:00Z', user: 'System' },
    { event: 'Samples registered (5)', timestamp: '2024-01-14T10:30:00Z', user: 'Lisa Park' },
    { event: '3 samples received at lab', timestamp: '2024-01-15T14:00:00Z', user: 'Lisa Park' },
    { event: 'Testing initiated on MW-01, MW-02', timestamp: '2024-01-16T08:00:00Z', user: 'Dr. Sarah Chen' },
  ],
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: order, isLoading, error } = useOrder(id);
  const updateStatus = useUpdateOrderStatus();

  const displayOrder = order || fallbackOrder;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (error && !fallbackOrder) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-24">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-lg font-semibold">Order not found</h2>
          <Link href="/orders" className="mt-4 text-sm text-primary hover:underline">
            Back to orders
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
              href="/orders"
              className="inline-flex items-center justify-center rounded-md border bg-background p-2 hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{displayOrder.orderNumber}</h1>
                <StatusBadge status={displayOrder.status} />
              </div>
              <p className="text-muted-foreground mt-1">
                {displayOrder.clientName} - {displayOrder.sampleCount} samples
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              <Edit className="h-4 w-4" />
              Edit
            </button>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Order Details
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-medium">{formatDate(displayOrder.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Due Date</dt>
                <dd className="font-medium">{formatDate(displayOrder.dueDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Amount</dt>
                <dd className="font-medium">{formatCurrency(displayOrder.totalAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Samples</dt>
                <dd className="font-medium">{displayOrder.sampleCount}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Contact
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{displayOrder.contactName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${displayOrder.contactEmail}`} className="text-primary hover:underline">
                  {displayOrder.contactEmail}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Client:</span>
                <Link href={`/clients/${displayOrder.clientId}`} className="text-primary hover:underline">
                  {displayOrder.clientName}
                </Link>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Notes
            </h3>
            <p className="text-sm">
              {displayOrder.notes || 'No notes for this order.'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs.Root defaultValue="samples">
          <Tabs.List className="flex border-b">
            <Tabs.Trigger
              value="samples"
              className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              Samples ({displayOrder.samples?.length || 0})
            </Tabs.Trigger>
            <Tabs.Trigger
              value="timeline"
              className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              Timeline
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="samples" className="mt-4">
            <div className="rounded-lg border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sample ID</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Matrix</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(displayOrder.samples || []).map((sample: any) => (
                    <tr key={sample.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/samples/${sample.id}`} className="font-medium text-primary hover:underline">
                          {sample.sampleId}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{sample.description}</td>
                      <td className="px-4 py-3 capitalize">{sample.matrix.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">
                        <SampleStatusBadge status={sample.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tabs.Content>

          <Tabs.Content value="timeline" className="mt-4">
            <div className="rounded-lg border bg-card p-6">
              <div className="space-y-4">
                {(displayOrder.timeline || []).map((event: any, index: number) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      {index < (displayOrder.timeline || []).length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium">{event.event}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {event.user} - {formatDateTime(event.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </MainLayout>
  );
}
