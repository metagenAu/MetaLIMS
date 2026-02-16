'use client';

import React, { useState } from 'react';
import { History, User, FileText, FlaskConical, CreditCard, Shield } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SearchInput } from '@/components/common/SearchInput';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  category: 'sample' | 'order' | 'billing' | 'user' | 'system' | 'report';
}

const fallbackEntries: AuditEntry[] = [
  { id: '1', timestamp: new Date(Date.now() - 300000).toISOString(), user: 'Dr. Sarah Chen', action: 'Result Entered', entity: 'Sample', entityId: 'S-2024-001843', details: 'Lead (Pb) result: 3.2 ug/L', category: 'sample' },
  { id: '2', timestamp: new Date(Date.now() - 600000).toISOString(), user: 'Lisa Park', action: 'Sample Received', entity: 'Sample', entityId: 'S-2024-001850', details: 'Batch receiving - 5 samples', category: 'sample' },
  { id: '3', timestamp: new Date(Date.now() - 1200000).toISOString(), user: 'Robert Kim', action: 'Result Approved', entity: 'Sample', entityId: 'S-2024-001840', details: 'All test results approved for reporting', category: 'sample' },
  { id: '4', timestamp: new Date(Date.now() - 1800000).toISOString(), user: 'Admin User', action: 'User Updated', entity: 'User', entityId: 'Karen White', details: 'Status changed from active to inactive', category: 'user' },
  { id: '5', timestamp: new Date(Date.now() - 3600000).toISOString(), user: 'System', action: 'Report Generated', entity: 'Report', entityId: 'RPT-2024-0452', details: 'Certificate of Analysis generated for S-2024-001841', category: 'report' },
  { id: '6', timestamp: new Date(Date.now() - 5400000).toISOString(), user: 'Admin User', action: 'Invoice Created', entity: 'Invoice', entityId: 'INV-2024-0156', details: 'Invoice for $5,200.00 - Acme Environmental', category: 'billing' },
  { id: '7', timestamp: new Date(Date.now() - 7200000).toISOString(), user: 'Dr. Sarah Chen', action: 'Sample Status Updated', entity: 'Sample', entityId: 'S-2024-001843', details: 'Status: received -> testing', category: 'sample' },
  { id: '8', timestamp: new Date(Date.now() - 10800000).toISOString(), user: 'Lisa Park', action: 'Order Created', entity: 'Order', entityId: 'ORD-2024-0891', details: 'New order from GreenTech Labs - 5 samples', category: 'order' },
  { id: '9', timestamp: new Date(Date.now() - 14400000).toISOString(), user: 'Admin User', action: 'Spec Limit Updated', entity: 'Specification', entityId: 'Lead (Pb) - Water', details: 'Upper limit changed from 15 to 10 ug/L', category: 'system' },
  { id: '10', timestamp: new Date(Date.now() - 18000000).toISOString(), user: 'James Wilson', action: 'Login', entity: 'Session', entityId: '', details: 'Successful login from 192.168.1.45', category: 'user' },
];

const categoryIcons: Record<string, React.ElementType> = {
  sample: FlaskConical,
  order: FileText,
  billing: CreditCard,
  user: User,
  system: Shield,
  report: FileText,
};

const categoryColors: Record<string, string> = {
  sample: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  order: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  billing: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  user: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  system: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  report: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
};

export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const filtered = fallbackEntries.filter((e) => {
    if (search && !e.user.toLowerCase().includes(search.toLowerCase()) && !e.details.toLowerCase().includes(search.toLowerCase()) && !e.entityId.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && e.category !== categoryFilter) return false;
    return true;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">Complete audit trail of system activities</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search audit log..." className="w-64" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">All Categories</option>
            <option value="sample">Samples</option>
            <option value="order">Orders</option>
            <option value="billing">Billing</option>
            <option value="user">Users</option>
            <option value="system">System</option>
            <option value="report">Reports</option>
          </select>
          <DateRangePicker onChange={() => {}} className="w-64" />
        </div>

        <div className="rounded-lg border bg-card divide-y">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No audit entries found</h3>
              <p className="text-muted-foreground mt-1">Try adjusting your filters.</p>
            </div>
          ) : (
            filtered.map((entry) => {
              const Icon = categoryIcons[entry.category] || History;
              const colorClass = categoryColors[entry.category] || categoryColors.system;
              return (
                <div key={entry.id} className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors">
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-full shrink-0', colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{entry.action}</span>
                      {entry.entityId && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {entry.entityId}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{entry.details}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium">{entry.user}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(entry.timestamp)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </MainLayout>
  );
}
