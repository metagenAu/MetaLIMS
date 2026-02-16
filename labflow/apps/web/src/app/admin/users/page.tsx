'use client';

import React, { useState } from 'react';
import { Plus, Edit, Trash2, Shield, MoreVertical } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { SearchInput } from '@/components/common/SearchInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatDate } from '@/lib/formatters';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string | null;
  createdAt: string;
}

const fallbackUsers: User[] = [
  { id: '1', name: 'Dr. Sarah Chen', email: 'schen@labflow.com', role: 'Lab Manager', status: 'active', lastLogin: '2024-01-17T09:00:00Z', createdAt: '2023-06-01T00:00:00Z' },
  { id: '2', name: 'James Wilson', email: 'jwilson@labflow.com', role: 'Analyst', status: 'active', lastLogin: '2024-01-17T08:30:00Z', createdAt: '2023-07-15T00:00:00Z' },
  { id: '3', name: 'Maria Santos', email: 'msantos@labflow.com', role: 'Analyst', status: 'active', lastLogin: '2024-01-16T16:00:00Z', createdAt: '2023-08-01T00:00:00Z' },
  { id: '4', name: 'Lisa Park', email: 'lpark@labflow.com', role: 'Receptionist', status: 'active', lastLogin: '2024-01-17T07:45:00Z', createdAt: '2023-09-15T00:00:00Z' },
  { id: '5', name: 'Robert Kim', email: 'rkim@labflow.com', role: 'Reviewer', status: 'active', lastLogin: '2024-01-16T17:00:00Z', createdAt: '2023-06-15T00:00:00Z' },
  { id: '6', name: 'Admin User', email: 'admin@labflow.com', role: 'Admin', status: 'active', lastLogin: '2024-01-17T10:00:00Z', createdAt: '2023-01-01T00:00:00Z' },
  { id: '7', name: 'Karen White', email: 'kwhite@labflow.com', role: 'Billing Clerk', status: 'inactive', lastLogin: '2023-12-20T00:00:00Z', createdAt: '2023-04-01T00:00:00Z' },
];

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const filtered = fallbackUsers.filter((u) => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    return true;
  });

  const columns: Column<User>[] = [
    {
      key: 'name', header: 'User', sortable: true,
      cell: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role', header: 'Role',
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{row.role}</span>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    { key: 'lastLogin', header: 'Last Login', sortable: true, cell: (row) => formatDate(row.lastLogin) },
    { key: 'createdAt', header: 'Created', sortable: true, cell: (row) => formatDate(row.createdAt) },
    {
      key: 'actions', header: '',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <button className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded">
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedUser(row); setDeleteDialogOpen(true); }}
            className="p-1 text-muted-foreground hover:text-destructive hover:bg-muted rounded"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Manage staff accounts and access</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Add User
          </button>
        </div>

        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search users..." className="w-64" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Lab Manager">Lab Manager</option>
            <option value="Analyst">Analyst</option>
            <option value="Reviewer">Reviewer</option>
            <option value="Receptionist">Receptionist</option>
            <option value="Billing Clerk">Billing Clerk</option>
          </select>
        </div>

        <DataTable columns={columns} data={filtered} emptyMessage="No users found." />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Deactivate User"
          description={`Are you sure you want to deactivate ${selectedUser?.name}? They will no longer be able to sign in.`}
          confirmLabel="Deactivate"
          variant="destructive"
          onConfirm={() => setSelectedUser(null)}
        />
      </div>
    </MainLayout>
  );
}
