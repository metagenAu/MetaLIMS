'use client';

import React, { useState } from 'react';
import { Plus, Settings, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { SearchInput } from '@/components/common/SearchInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate } from '@/lib/formatters';

interface Instrument {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  location: string;
  status: string;
  lastCalibration: string;
  nextCalibration: string;
  maintenanceStatus: 'ok' | 'due_soon' | 'overdue';
}

const fallbackInstruments: Instrument[] = [
  { id: '1', name: 'ICP-MS', model: 'Agilent 7900', serialNumber: 'JP18200451', location: 'Lab A', status: 'active', lastCalibration: '2024-01-10T00:00:00Z', nextCalibration: '2024-04-10T00:00:00Z', maintenanceStatus: 'ok' },
  { id: '2', name: 'GC-MS', model: 'Agilent 7890B/5977B', serialNumber: 'US18432109', location: 'Lab B', status: 'active', lastCalibration: '2024-01-05T00:00:00Z', nextCalibration: '2024-02-20T00:00:00Z', maintenanceStatus: 'due_soon' },
  { id: '3', name: 'HPLC', model: 'Waters Alliance e2695', serialNumber: 'G15QC08741', location: 'Lab B', status: 'active', lastCalibration: '2024-01-12T00:00:00Z', nextCalibration: '2024-07-12T00:00:00Z', maintenanceStatus: 'ok' },
  { id: '4', name: 'UV-Vis Spectrophotometer', model: 'Hach DR6000', serialNumber: '1886420', location: 'Lab A', status: 'active', lastCalibration: '2024-01-08T00:00:00Z', nextCalibration: '2024-03-08T00:00:00Z', maintenanceStatus: 'ok' },
  { id: '5', name: 'Turbidimeter', model: 'Hach TL2310', serialNumber: '1890123', location: 'Lab A', status: 'maintenance', lastCalibration: '2023-11-15T00:00:00Z', nextCalibration: '2024-01-15T00:00:00Z', maintenanceStatus: 'overdue' },
  { id: '6', name: 'Autoclave', model: 'Steris Amsco 3013', serialNumber: '2301A-5590', location: 'Lab C', status: 'active', lastCalibration: '2024-01-02T00:00:00Z', nextCalibration: '2024-04-02T00:00:00Z', maintenanceStatus: 'ok' },
  { id: '7', name: 'Incubator', model: 'Fisher Isotemp', serialNumber: 'TH21005432', location: 'Lab C', status: 'active', lastCalibration: '2024-01-15T00:00:00Z', nextCalibration: '2024-07-15T00:00:00Z', maintenanceStatus: 'ok' },
  { id: '8', name: 'Analytical Balance', model: 'Mettler Toledo XPR225DR', serialNumber: 'B923481201', location: 'Lab A', status: 'active', lastCalibration: '2024-01-14T00:00:00Z', nextCalibration: '2024-02-14T00:00:00Z', maintenanceStatus: 'due_soon' },
];

export default function InstrumentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = fallbackInstruments.filter((i) => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.model.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && i.status !== statusFilter) return false;
    return true;
  });

  const maintenanceIcon = (status: string) => {
    switch (status) {
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'due_soon':
        return <Clock className="h-4 w-4 text-amber-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    }
  };

  const columns: Column<Instrument>[] = [
    { key: 'name', header: 'Instrument', sortable: true, cell: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'model', header: 'Model', cell: (row) => <span className="text-muted-foreground">{row.model}</span> },
    { key: 'serialNumber', header: 'Serial #', cell: (row) => <span className="font-mono text-xs">{row.serialNumber}</span> },
    { key: 'location', header: 'Location' },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    { key: 'lastCalibration', header: 'Last Calibration', sortable: true, cell: (row) => formatDate(row.lastCalibration) },
    {
      key: 'nextCalibration', header: 'Next Calibration', sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          {maintenanceIcon(row.maintenanceStatus)}
          <span className={row.maintenanceStatus === 'overdue' ? 'text-destructive font-medium' : row.maintenanceStatus === 'due_soon' ? 'text-amber-600' : ''}>
            {formatDate(row.nextCalibration)}
          </span>
        </div>
      ),
    },
  ];

  const overdueCount = fallbackInstruments.filter((i) => i.maintenanceStatus === 'overdue').length;
  const dueSoonCount = fallbackInstruments.filter((i) => i.maintenanceStatus === 'due_soon').length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Instruments</h1>
            <p className="text-muted-foreground">Manage laboratory instruments and calibrations</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Add Instrument
          </button>
        </div>

        {(overdueCount > 0 || dueSoonCount > 0) && (
          <div className="flex items-center gap-4 rounded-lg border bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 p-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="text-sm">
              {overdueCount > 0 && <span className="text-red-600 font-medium">{overdueCount} overdue</span>}
              {overdueCount > 0 && dueSoonCount > 0 && <span> and </span>}
              {dueSoonCount > 0 && <span className="text-amber-600 font-medium">{dueSoonCount} due soon</span>}
              <span className="text-muted-foreground"> for calibration/maintenance</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search instruments..." className="w-64" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <DataTable columns={columns} data={filtered} emptyMessage="No instruments found." />
      </div>
    </MainLayout>
  );
}
