'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Building2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { SearchInput } from '@/components/common/SearchInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate, formatCurrency, formatPhoneNumber } from '@/lib/formatters';
import api from '@/lib/api';

interface Client {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  status: string;
  totalOrders: number;
  outstandingBalance: number;
  lastOrderDate: string | null;
}

const fallbackClients: Client[] = [
  { id: 'c1', name: 'Acme Environmental', contactName: 'John Smith', email: 'jsmith@acme-env.com', phone: '5551234567', status: 'active', totalOrders: 42, outstandingBalance: 12500, lastOrderDate: '2024-01-15T10:00:00Z' },
  { id: 'c2', name: 'GreenTech Labs', contactName: 'Michael Torres', email: 'mtorres@greentech.com', phone: '5552345678', status: 'active', totalOrders: 28, outstandingBalance: 4200, lastOrderDate: '2024-01-14T09:00:00Z' },
  { id: 'c3', name: 'Riverside Water Authority', contactName: 'Emily Johnson', email: 'ejohnson@riverside.gov', phone: '5553456789', status: 'active', totalOrders: 156, outstandingBalance: 0, lastOrderDate: '2024-01-17T08:00:00Z' },
  { id: 'c4', name: 'Metro Health Department', contactName: 'David Lee', email: 'dlee@metrohd.gov', phone: '5554567890', status: 'active', totalOrders: 67, outstandingBalance: 8900, lastOrderDate: '2024-01-10T14:00:00Z' },
  { id: 'c5', name: 'Pacific Agriculture Co.', contactName: 'Sarah Williams', email: 'swilliams@pacag.com', phone: '5555678901', status: 'inactive', totalOrders: 12, outstandingBalance: 0, lastOrderDate: '2023-11-05T10:00:00Z' },
];

export default function ClientsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search, statusFilter],
    queryFn: async () => {
      const { data } = await api.get('/clients');
      return data as Client[];
    },
    retry: false,
  });

  const clients = data || fallbackClients;

  const filtered = clients.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.contactName.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    return true;
  });

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Company',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <Link href={`/clients/${row.id}`} className="font-medium text-primary hover:underline">
              {row.name}
            </Link>
          </div>
        </div>
      ),
    },
    { key: 'contactName', header: 'Contact', sortable: true },
    { key: 'email', header: 'Email' },
    {
      key: 'phone',
      header: 'Phone',
      cell: (row) => formatPhoneNumber(row.phone),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    { key: 'totalOrders', header: 'Orders', sortable: true },
    {
      key: 'outstandingBalance',
      header: 'Balance',
      sortable: true,
      cell: (row) => (
        <span className={row.outstandingBalance > 0 ? 'text-amber-600 font-medium' : ''}>
          {formatCurrency(row.outstandingBalance)}
        </span>
      ),
    },
    {
      key: 'lastOrderDate',
      header: 'Last Order',
      sortable: true,
      cell: (row) => formatDate(row.lastOrderDate),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Clients</h1>
            <p className="text-muted-foreground">Manage laboratory clients and contacts</p>
          </div>
          <Link
            href="/clients/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Client
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search clients..." className="w-64" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          emptyMessage="No clients found."
          onRowClick={(row) => router.push(`/clients/${row.id}`)}
        />
      </div>
    </MainLayout>
  );
}
