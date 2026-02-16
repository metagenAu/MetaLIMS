'use client';

import React, { useState } from 'react';
import { Plus, Edit, Save, X } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SearchInput } from '@/components/common/SearchInput';

interface SpecLimit {
  id: string;
  analyte: string;
  method: string;
  matrix: string;
  regulation: string;
  lowerLimit: number | null;
  upperLimit: number | null;
  units: string;
}

const fallbackSpecs: SpecLimit[] = [
  { id: '1', analyte: 'Lead (Pb)', method: 'EPA 200.8', matrix: 'Drinking Water', regulation: 'EPA MCL', lowerLimit: null, upperLimit: 15, units: 'ug/L' },
  { id: '2', analyte: 'Copper (Cu)', method: 'EPA 200.8', matrix: 'Drinking Water', regulation: 'EPA Action Level', lowerLimit: null, upperLimit: 1300, units: 'ug/L' },
  { id: '3', analyte: 'Arsenic (As)', method: 'EPA 200.8', matrix: 'Drinking Water', regulation: 'EPA MCL', lowerLimit: null, upperLimit: 10, units: 'ug/L' },
  { id: '4', analyte: 'Mercury (Hg)', method: 'EPA 200.8', matrix: 'Drinking Water', regulation: 'EPA MCL', lowerLimit: null, upperLimit: 2, units: 'ug/L' },
  { id: '5', analyte: 'Benzene', method: 'EPA 8260', matrix: 'Drinking Water', regulation: 'EPA MCL', lowerLimit: null, upperLimit: 5, units: 'ug/L' },
  { id: '6', analyte: 'Toluene', method: 'EPA 8260', matrix: 'Drinking Water', regulation: 'EPA MCL', lowerLimit: null, upperLimit: 1000, units: 'ug/L' },
  { id: '7', analyte: 'Total Coliform', method: 'SM 9223B', matrix: 'Drinking Water', regulation: 'EPA MCL', lowerLimit: null, upperLimit: 0, units: 'MPN/100mL' },
  { id: '8', analyte: 'pH', method: 'SM 4500', matrix: 'Drinking Water', regulation: 'EPA SMCL', lowerLimit: 6.5, upperLimit: 8.5, units: 'SU' },
  { id: '9', analyte: 'Turbidity', method: 'SM 2130', matrix: 'Drinking Water', regulation: 'EPA TT', lowerLimit: null, upperLimit: 1, units: 'NTU' },
  { id: '10', analyte: 'Nitrate (as N)', method: 'EPA 353.2', matrix: 'Drinking Water', regulation: 'EPA MCL', lowerLimit: null, upperLimit: 10, units: 'mg/L' },
  { id: '11', analyte: 'Lead (Pb)', method: 'EPA 200.8', matrix: 'Soil', regulation: 'EPA RSL', lowerLimit: null, upperLimit: 400, units: 'mg/kg' },
  { id: '12', analyte: 'Arsenic (As)', method: 'EPA 200.8', matrix: 'Soil', regulation: 'EPA RSL', lowerLimit: null, upperLimit: 0.68, units: 'mg/kg' },
];

export default function SpecificationsPage() {
  const [search, setSearch] = useState('');
  const [matrixFilter, setMatrixFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLower, setEditLower] = useState<string>('');
  const [editUpper, setEditUpper] = useState<string>('');

  const filtered = fallbackSpecs.filter((s) => {
    if (search && !s.analyte.toLowerCase().includes(search.toLowerCase())) return false;
    if (matrixFilter && s.matrix !== matrixFilter) return false;
    return true;
  });

  const matrices = [...new Set(fallbackSpecs.map((s) => s.matrix))];

  const startEdit = (spec: SpecLimit) => {
    setEditingId(spec.id);
    setEditLower(spec.lowerLimit?.toString() || '');
    setEditUpper(spec.upperLimit?.toString() || '');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Specification Limits</h1>
            <p className="text-muted-foreground">Manage regulatory and specification limits for analytes</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Add Specification
          </button>
        </div>

        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search analytes..." className="w-64" />
          <select
            value={matrixFilter}
            onChange={(e) => setMatrixFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">All Matrices</option>
            {matrices.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Analyte</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Method</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Matrix</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Regulation</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Lower Limit</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Upper Limit</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Units</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((spec) => (
                <tr key={spec.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{spec.analyte}</td>
                  <td className="px-4 py-3 text-muted-foreground">{spec.method}</td>
                  <td className="px-4 py-3">{spec.matrix}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {spec.regulation}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === spec.id ? (
                      <input type="number" step="any" value={editLower} onChange={(e) => setEditLower(e.target.value)} className="w-20 h-7 rounded border text-center text-sm" placeholder="--" />
                    ) : (
                      spec.lowerLimit !== null ? spec.lowerLimit : '--'
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === spec.id ? (
                      <input type="number" step="any" value={editUpper} onChange={(e) => setEditUpper(e.target.value)} className="w-20 h-7 rounded border text-center text-sm" placeholder="--" />
                    ) : (
                      spec.upperLimit !== null ? spec.upperLimit : '--'
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{spec.units}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {editingId === spec.id ? (
                        <>
                          <button onClick={() => setEditingId(null)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Save className="h-4 w-4" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:bg-muted rounded"><X className="h-4 w-4" /></button>
                        </>
                      ) : (
                        <button onClick={() => startEdit(spec)} className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Edit className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
