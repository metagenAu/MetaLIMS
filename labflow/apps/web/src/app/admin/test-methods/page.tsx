'use client';

import React, { useState } from 'react';
import { Plus, Edit, Trash2, FlaskConical } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { SearchInput } from '@/components/common/SearchInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatCurrency } from '@/lib/formatters';

interface TestMethod {
  id: string;
  name: string;
  code: string;
  category: string;
  matrices: string[];
  turnaroundDays: number;
  basePrice: number;
  status: string;
  accredited: boolean;
}

const fallbackMethods: TestMethod[] = [
  { id: '1', name: 'Heavy Metals (ICP-MS)', code: 'EPA 200.8', category: 'Inorganic', matrices: ['Water', 'Soil'], turnaroundDays: 3, basePrice: 350, status: 'active', accredited: true },
  { id: '2', name: 'Volatile Organic Compounds', code: 'EPA 8260', category: 'Organic', matrices: ['Water', 'Soil'], turnaroundDays: 5, basePrice: 275, status: 'active', accredited: true },
  { id: '3', name: 'Semi-Volatile Organic Compounds', code: 'EPA 8270', category: 'Organic', matrices: ['Water', 'Soil'], turnaroundDays: 7, basePrice: 325, status: 'active', accredited: true },
  { id: '4', name: 'Total Coliform / E. Coli', code: 'SM 9223B', category: 'Microbiology', matrices: ['Water'], turnaroundDays: 2, basePrice: 180, status: 'active', accredited: true },
  { id: '5', name: 'Nutrients (Nitrogen, Phosphorus)', code: 'EPA 353.2', category: 'Wet Chemistry', matrices: ['Water'], turnaroundDays: 2, basePrice: 125, status: 'active', accredited: true },
  { id: '6', name: 'Pesticides', code: 'EPA 8081', category: 'Organic', matrices: ['Water', 'Soil', 'Food'], turnaroundDays: 7, basePrice: 450, status: 'active', accredited: true },
  { id: '7', name: 'pH / Conductivity / Turbidity', code: 'SM 4500', category: 'General', matrices: ['Water'], turnaroundDays: 1, basePrice: 75, status: 'active', accredited: true },
  { id: '8', name: 'BOD (5-Day)', code: 'SM 5210B', category: 'Wet Chemistry', matrices: ['Water'], turnaroundDays: 5, basePrice: 55, status: 'active', accredited: true },
  { id: '9', name: 'COD', code: 'SM 5220D', category: 'Wet Chemistry', matrices: ['Water'], turnaroundDays: 2, basePrice: 40, status: 'active', accredited: false },
  { id: '10', name: 'PFAS (Per-/Polyfluorinated)', code: 'EPA 533', category: 'Organic', matrices: ['Water'], turnaroundDays: 10, basePrice: 600, status: 'active', accredited: false },
];

export default function TestMethodsPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const filtered = fallbackMethods.filter((m) => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.code.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && m.category !== categoryFilter) return false;
    return true;
  });

  const categories = [...new Set(fallbackMethods.map((m) => m.category))];

  const columns: Column<TestMethod>[] = [
    {
      key: 'name', header: 'Method Name', sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.code}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', sortable: true },
    {
      key: 'matrices', header: 'Matrices',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.matrices.map((m) => (
            <span key={m} className="rounded-full bg-muted px-2 py-0.5 text-xs">{m}</span>
          ))}
        </div>
      ),
    },
    { key: 'turnaroundDays', header: 'TAT (Days)', sortable: true, cell: (row) => `${row.turnaroundDays} days` },
    { key: 'basePrice', header: 'Price', sortable: true, cell: (row) => formatCurrency(row.basePrice) },
    {
      key: 'accredited', header: 'Accredited',
      cell: (row) => row.accredited
        ? <span className="text-xs text-emerald-600 font-medium">ISO 17025</span>
        : <span className="text-xs text-muted-foreground">No</span>,
    },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', header: '',
      cell: () => (
        <div className="flex items-center gap-1">
          <button className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Edit className="h-4 w-4" /></button>
          <button className="p-1 text-muted-foreground hover:text-destructive hover:bg-muted rounded"><Trash2 className="h-4 w-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Test Methods</h1>
            <p className="text-muted-foreground">Manage analytical test method catalog</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Add Method
          </button>
        </div>

        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search methods..." className="w-64" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <DataTable columns={columns} data={filtered} emptyMessage="No test methods found." />
      </div>
    </MainLayout>
  );
}
