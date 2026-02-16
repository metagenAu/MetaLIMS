'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Building2, Mail, Phone, MapPin } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatusBadge } from '@/components/common/StatusBadge';
import { DataTable, Column } from '@/components/common/DataTable';
import { formatDate, formatCurrency, formatPhoneNumber } from '@/lib/formatters';

const fallbackClient = {
  id: 'c1',
  name: 'Acme Environmental',
  contactName: 'John Smith',
  email: 'jsmith@acme-env.com',
  phone: '5551234567',
  address: '123 Industrial Way, Suite 200, Springfield, IL 62701',
  status: 'active',
  accountNumber: 'ACT-001',
  paymentTerms: 'Net 30',
  notes: 'Preferred client. Quarterly monitoring program for 3 sites.',
  orders: [
    { id: 'o1', orderNumber: 'ORD-2024-0891', status: 'processing', sampleCount: 5, totalAmount: 3750, createdAt: '2024-01-14T09:00:00Z' },
    { id: 'o2', orderNumber: 'ORD-2024-0876', status: 'completed', sampleCount: 8, totalAmount: 5200, createdAt: '2024-01-08T11:00:00Z' },
    { id: 'o3', orderNumber: 'ORD-2024-0821', status: 'completed', sampleCount: 3, totalAmount: 1850, createdAt: '2023-12-20T10:00:00Z' },
  ],
  invoices: [
    { id: 'i1', invoiceNumber: 'INV-2024-0156', status: 'overdue', totalAmount: 5200, balanceDue: 5200, dueDate: '2024-01-08T00:00:00Z' },
    { id: 'i2', invoiceNumber: 'INV-2024-0142', status: 'paid', totalAmount: 1850, balanceDue: 0, dueDate: '2024-01-20T00:00:00Z' },
    { id: 'i3', invoiceNumber: 'INV-2023-0891', status: 'paid', totalAmount: 4100, balanceDue: 0, dueDate: '2023-12-15T00:00:00Z' },
  ],
};

export default function ClientDetailPage() {
  const params = useParams();
  const client = fallbackClient;

  const orderColumns: Column<any>[] = [
    {
      key: 'orderNumber', header: 'Order #', sortable: true,
      cell: (row: any) => <Link href={`/orders/${row.id}`} className="font-medium text-primary hover:underline">{row.orderNumber}</Link>,
    },
    { key: 'status', header: 'Status', cell: (row: any) => <StatusBadge status={row.status} /> },
    { key: 'sampleCount', header: 'Samples' },
    { key: 'totalAmount', header: 'Amount', cell: (row: any) => formatCurrency(row.totalAmount) },
    { key: 'createdAt', header: 'Created', cell: (row: any) => formatDate(row.createdAt) },
  ];

  const invoiceColumns: Column<any>[] = [
    {
      key: 'invoiceNumber', header: 'Invoice #', sortable: true,
      cell: (row: any) => <Link href={`/billing/invoices/${row.id}`} className="font-medium text-primary hover:underline">{row.invoiceNumber}</Link>,
    },
    { key: 'status', header: 'Status', cell: (row: any) => <StatusBadge status={row.status} /> },
    { key: 'totalAmount', header: 'Total', cell: (row: any) => formatCurrency(row.totalAmount) },
    {
      key: 'balanceDue', header: 'Balance',
      cell: (row: any) => <span className={row.balanceDue > 0 ? 'text-amber-600 font-medium' : ''}>{formatCurrency(row.balanceDue)}</span>,
    },
    { key: 'dueDate', header: 'Due Date', cell: (row: any) => formatDate(row.dueDate) },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Link href="/clients" className="inline-flex items-center justify-center rounded-md border bg-background p-2 hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{client.name}</h1>
                  <StatusBadge status={client.status} />
                </div>
                <p className="text-muted-foreground">Account #{client.accountNumber}</p>
              </div>
            </div>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
            <Edit className="h-4 w-4" />
            Edit
          </button>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Contact</h3>
            <div className="space-y-2 text-sm">
              <p className="font-medium">{client.contactName}</p>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <a href={`mailto:${client.email}`} className="text-primary hover:underline">{client.email}</a>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                {formatPhoneNumber(client.phone)}
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 mt-0.5" />
                {client.address}
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Account</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Payment Terms</dt>
                <dd className="font-medium">{client.paymentTerms}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Orders</dt>
                <dd className="font-medium">{client.orders.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Outstanding</dt>
                <dd className="font-medium text-amber-600">
                  {formatCurrency(client.invoices.reduce((sum: number, inv: any) => sum + inv.balanceDue, 0))}
                </dd>
              </div>
            </dl>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Notes</h3>
            <p className="text-sm">{client.notes}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs.Root defaultValue="orders">
          <Tabs.List className="flex border-b">
            <Tabs.Trigger value="orders" className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground">
              Orders ({client.orders.length})
            </Tabs.Trigger>
            <Tabs.Trigger value="invoices" className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground">
              Invoices ({client.invoices.length})
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="orders" className="mt-4">
            <DataTable columns={orderColumns} data={client.orders} emptyMessage="No orders for this client." />
          </Tabs.Content>
          <Tabs.Content value="invoices" className="mt-4">
            <DataTable columns={invoiceColumns} data={client.invoices} emptyMessage="No invoices for this client." />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </MainLayout>
  );
}
