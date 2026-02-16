'use client';

import React, { useState } from 'react';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SearchInput } from '@/components/common/SearchInput';
import { formatCurrency } from '@/lib/formatters';

interface PriceItem {
  id: string;
  testMethod: string;
  code: string;
  matrix: string;
  basePrice: number;
  rushMultiplier: number;
  urgentMultiplier: number;
  active: boolean;
}

const fallbackPrices: PriceItem[] = [
  { id: '1', testMethod: 'Heavy Metals (ICP-MS)', code: 'EPA 200.8', matrix: 'Water', basePrice: 350, rushMultiplier: 1.5, urgentMultiplier: 2.0, active: true },
  { id: '2', testMethod: 'VOCs', code: 'EPA 8260', matrix: 'Water', basePrice: 275, rushMultiplier: 1.5, urgentMultiplier: 2.0, active: true },
  { id: '3', testMethod: 'SVOCs', code: 'EPA 8270', matrix: 'Water', basePrice: 325, rushMultiplier: 1.5, urgentMultiplier: 2.0, active: true },
  { id: '4', testMethod: 'Total Coliform / E. Coli', code: 'SM 9223B', matrix: 'Water', basePrice: 180, rushMultiplier: 1.5, urgentMultiplier: 2.0, active: true },
  { id: '5', testMethod: 'Nutrients (N/P)', code: 'EPA 353.2', matrix: 'Water', basePrice: 125, rushMultiplier: 1.5, urgentMultiplier: 2.0, active: true },
  { id: '6', testMethod: 'pH / Conductivity / Turbidity', code: 'SM 4500', matrix: 'Water', basePrice: 75, rushMultiplier: 1.5, urgentMultiplier: 2.0, active: true },
  { id: '7', testMethod: 'Pesticides', code: 'EPA 8081', matrix: 'Water', basePrice: 450, rushMultiplier: 1.5, urgentMultiplier: 2.0, active: true },
  { id: '8', testMethod: 'BOD/COD', code: 'SM 5210/5220', matrix: 'Water', basePrice: 95, rushMultiplier: 1.5, urgentMultiplier: 2.0, active: true },
  { id: '9', testMethod: 'Heavy Metals (ICP-MS)', code: 'EPA 200.8', matrix: 'Soil', basePrice: 425, rushMultiplier: 1.5, urgentMultiplier: 2.0, active: true },
  { id: '10', testMethod: 'VOCs', code: 'EPA 8260', matrix: 'Soil', basePrice: 300, rushMultiplier: 1.5, urgentMultiplier: 2.0, active: true },
];

export default function PriceListsPage() {
  const [search, setSearch] = useState('');
  const [matrixFilter, setMatrixFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);

  const filtered = fallbackPrices.filter((p) => {
    if (search && !p.testMethod.toLowerCase().includes(search.toLowerCase()) && !p.code.toLowerCase().includes(search.toLowerCase())) return false;
    if (matrixFilter && p.matrix !== matrixFilter) return false;
    return true;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Price Lists</h1>
            <p className="text-muted-foreground">Manage test pricing and fee schedules</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Add Price
          </button>
        </div>

        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search tests..." className="w-64" />
          <select
            value={matrixFilter}
            onChange={(e) => setMatrixFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">All Matrices</option>
            <option value="Water">Water</option>
            <option value="Soil">Soil</option>
            <option value="Air">Air</option>
          </select>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Test Method</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Matrix</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Base Price</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Rush (1.5x)</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Urgent (2x)</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{item.testMethod}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.code}</td>
                  <td className="px-4 py-3">{item.matrix}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === item.id ? (
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(Number(e.target.value))}
                        className="w-24 h-7 rounded border border-input bg-background px-2 text-right text-sm"
                      />
                    ) : (
                      formatCurrency(item.basePrice)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {formatCurrency((editingId === item.id ? editPrice : item.basePrice) * item.rushMultiplier)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {formatCurrency((editingId === item.id ? editPrice : item.basePrice) * item.urgentMultiplier)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {editingId === item.id ? (
                        <>
                          <button onClick={() => setEditingId(null)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                            <Save className="h-4 w-4" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:bg-muted rounded">
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingId(item.id); setEditPrice(item.basePrice); }}
                            className="p-1 text-muted-foreground hover:bg-muted rounded"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button className="p-1 text-muted-foreground hover:text-destructive hover:bg-muted rounded">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
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
