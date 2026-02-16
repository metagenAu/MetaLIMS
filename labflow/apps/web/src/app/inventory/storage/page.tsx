'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, MapPin, Box, Thermometer, Plus } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { cn } from '@/lib/utils';

interface StorageNode {
  id: string;
  name: string;
  type: 'building' | 'room' | 'unit' | 'shelf' | 'position';
  temperature?: string;
  capacity?: number;
  used?: number;
  children?: StorageNode[];
}

const storageTree: StorageNode[] = [
  {
    id: 'bldg1', name: 'Main Laboratory', type: 'building',
    children: [
      {
        id: 'room1', name: 'Lab A - Inorganic Chemistry', type: 'room', temperature: '20-25 C',
        children: [
          { id: 'unit1', name: 'Refrigerator R-01', type: 'unit', temperature: '2-6 C', capacity: 100, used: 72,
            children: [
              { id: 'shelf1', name: 'Shelf 1', type: 'shelf', capacity: 25, used: 22 },
              { id: 'shelf2', name: 'Shelf 2', type: 'shelf', capacity: 25, used: 18 },
              { id: 'shelf3', name: 'Shelf 3', type: 'shelf', capacity: 25, used: 20 },
              { id: 'shelf4', name: 'Shelf 4', type: 'shelf', capacity: 25, used: 12 },
            ],
          },
          { id: 'unit2', name: 'Freezer F-01', type: 'unit', temperature: '-18 to -22 C', capacity: 50, used: 31 },
          { id: 'unit3', name: 'Bench Storage', type: 'unit', capacity: 30, used: 8 },
        ],
      },
      {
        id: 'room2', name: 'Lab B - Organic Chemistry', type: 'room', temperature: '20-25 C',
        children: [
          { id: 'unit4', name: 'Refrigerator R-02', type: 'unit', temperature: '2-6 C', capacity: 100, used: 45 },
          { id: 'unit5', name: 'VOC Cooler', type: 'unit', temperature: '2-6 C', capacity: 60, used: 38 },
        ],
      },
      {
        id: 'room3', name: 'Lab C - Microbiology', type: 'room', temperature: '20-25 C',
        children: [
          { id: 'unit6', name: 'Incubator I-01', type: 'unit', temperature: '35 C', capacity: 40, used: 15 },
          { id: 'unit7', name: 'Refrigerator R-03', type: 'unit', temperature: '2-6 C', capacity: 80, used: 52 },
        ],
      },
    ],
  },
  {
    id: 'bldg2', name: 'Sample Receiving', type: 'building',
    children: [
      {
        id: 'room4', name: 'Receiving Room', type: 'room',
        children: [
          { id: 'unit8', name: 'Walk-in Cooler', type: 'unit', temperature: '2-6 C', capacity: 200, used: 48 },
          { id: 'unit9', name: 'Ambient Storage', type: 'unit', capacity: 100, used: 15 },
        ],
      },
    ],
  },
];

function StorageTreeNode({ node, depth = 0 }: { node: StorageNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const usagePercent = node.capacity ? Math.round(((node.used || 0) / node.capacity) * 100) : null;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors',
          depth === 0 && 'font-semibold'
        )}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <div className="w-4" />
        )}

        {node.type === 'building' && <MapPin className="h-4 w-4 text-primary shrink-0" />}
        {node.type === 'room' && <Box className="h-4 w-4 text-blue-500 shrink-0" />}
        {(node.type === 'unit' || node.type === 'shelf') && <Box className="h-4 w-4 text-muted-foreground shrink-0" />}

        <span className="flex-1 text-sm">{node.name}</span>

        {node.temperature && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Thermometer className="h-3 w-3" />
            {node.temperature}
          </span>
        )}

        {usagePercent !== null && (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-16 text-right">
              {node.used}/{node.capacity}
            </span>
          </div>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <StorageTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StoragePage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Storage Locations</h1>
            <p className="text-muted-foreground">Manage sample storage hierarchy and capacity</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Add Location
          </button>
        </div>

        <div className="rounded-lg border bg-card">
          {storageTree.map((node) => (
            <StorageTreeNode key={node.id} node={node} />
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
