'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FlaskConical,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ArrowRight,
  Clock,
  Target,
  BarChart3,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { StagePipeline } from '@/components/sampleTracking/StagePipeline';
import { TATByStageChart } from '@/components/sampleTracking/TATByStageChart';
import { BatchOverviewTable } from '@/components/sampleTracking/BatchOverviewTable';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

// ------------------------------------------------------------------
// Types mirrored from API response shapes
// ------------------------------------------------------------------

interface TrackingSummary {
  activeSamples: number;
  samplesInProgress: number;
  openBatches: number;
  completedBatchesThisMonth: number;
  overdueItems: number;
  rerunCount: number;
}

interface PipelineStage {
  stageKey: string;
  label: string;
  color: string;
  sortOrder: number;
  sampleCount: number;
  expectedDurationHours: number | null;
}

interface CategoryPipeline {
  category: string;
  categoryLabel: string;
  stages: PipelineStage[];
  totalSamples: number;
}

interface TATStage {
  stageKey: string;
  label: string;
  avgDurationMinutes: number;
  medianDurationMinutes: number;
  p95DurationMinutes: number;
  expectedDurationMinutes: number | null;
  sampleCount: number;
  onTargetPercentage: number;
}

interface CategoryTAT {
  category: string;
  categoryLabel: string;
  stages: TATStage[];
  overallAvgDays: number;
  overallOnTimePercentage: number;
}

interface BatchOverview {
  id: string;
  batchNumber: string;
  category: string;
  status: string;
  itemCount: number;
  completedCount: number;
  failedCount: number;
  rerunCount: number;
  progressPercent: number;
  openedAt: string;
  dueDate: string | null;
  sequencingRunIdentifier: string | null;
}

// ------------------------------------------------------------------
// Fallback data (for when API is unavailable / no data yet)
// ------------------------------------------------------------------

const fallbackSummary: TrackingSummary = {
  activeSamples: 156,
  samplesInProgress: 89,
  openBatches: 4,
  completedBatchesThisMonth: 12,
  overdueItems: 3,
  rerunCount: 7,
};

const fallbackPipeline: CategoryPipeline[] = [
  {
    category: 'SOIL_HEALTH',
    categoryLabel: 'Soil Health',
    stages: [
      { stageKey: 'REGISTERED', label: 'Registered', color: '#6B7280', sortOrder: 0, sampleCount: 24, expectedDurationHours: 24 },
      { stageKey: 'RECEIVED', label: 'Received', color: '#3B82F6', sortOrder: 1, sampleCount: 18, expectedDurationHours: 4 },
      { stageKey: 'WEIGHING', label: 'Weighing', color: '#8B5CF6', sortOrder: 2, sampleCount: 12, expectedDurationHours: 8 },
      { stageKey: 'DNA_EXTRACTION', label: 'DNA Extraction', color: '#A855F7', sortOrder: 3, sampleCount: 32, expectedDurationHours: 24 },
      { stageKey: 'PCR', label: 'PCR', color: '#EC4899', sortOrder: 4, sampleCount: 28, expectedDurationHours: 12 },
      { stageKey: 'POOLING', label: 'Pooling', color: '#F59E0B', sortOrder: 5, sampleCount: 15, expectedDurationHours: 8 },
      { stageKey: 'SEQUENCING', label: 'Sequencing', color: '#EF4444', sortOrder: 6, sampleCount: 48, expectedDurationHours: 48 },
      { stageKey: 'BIOINFORMATICS', label: 'Bioinformatics', color: '#14B8A6', sortOrder: 7, sampleCount: 20, expectedDurationHours: 24 },
      { stageKey: 'RESULTS_READY', label: 'Results Ready', color: '#10B981', sortOrder: 8, sampleCount: 8, expectedDurationHours: 12 },
      { stageKey: 'REPORT_SENT', label: 'Report Sent', color: '#059669', sortOrder: 9, sampleCount: 0, expectedDurationHours: null },
    ],
    totalSamples: 205,
  },
];

const fallbackTAT: CategoryTAT[] = [
  {
    category: 'SOIL_HEALTH',
    categoryLabel: 'Soil Health',
    stages: [
      { stageKey: 'WEIGHING', label: 'Weighing', avgDurationMinutes: 420, medianDurationMinutes: 360, p95DurationMinutes: 720, expectedDurationMinutes: 480, sampleCount: 145, onTargetPercentage: 82.3 },
      { stageKey: 'DNA_EXTRACTION', label: 'DNA Extraction', avgDurationMinutes: 1320, medianDurationMinutes: 1200, p95DurationMinutes: 1800, expectedDurationMinutes: 1440, sampleCount: 132, onTargetPercentage: 76.5 },
      { stageKey: 'PCR', label: 'PCR', avgDurationMinutes: 660, medianDurationMinutes: 600, p95DurationMinutes: 960, expectedDurationMinutes: 720, sampleCount: 128, onTargetPercentage: 88.1 },
      { stageKey: 'SEQUENCING', label: 'Sequencing', avgDurationMinutes: 2640, medianDurationMinutes: 2520, p95DurationMinutes: 3600, expectedDurationMinutes: 2880, sampleCount: 115, onTargetPercentage: 71.2 },
      { stageKey: 'BIOINFORMATICS', label: 'Bioinformatics', avgDurationMinutes: 1200, medianDurationMinutes: 960, p95DurationMinutes: 2160, expectedDurationMinutes: 1440, sampleCount: 110, onTargetPercentage: 79.8 },
    ],
    overallAvgDays: 7.2,
    overallOnTimePercentage: 78.4,
  },
];

const fallbackBatches: BatchOverview[] = [
  { id: '1', batchNumber: 'BATCH-20260214-0001', category: 'SOIL_HEALTH', status: 'IN_PROGRESS', itemCount: 48, completedCount: 32, failedCount: 2, rerunCount: 2, progressPercent: 67, openedAt: '2026-02-14T08:00:00Z', dueDate: '2026-02-21T17:00:00Z', sequencingRunIdentifier: 'RUN-2026-012' },
  { id: '2', batchNumber: 'BATCH-20260213-0002', category: 'SOIL_HEALTH', status: 'IN_PROGRESS', itemCount: 96, completedCount: 88, failedCount: 4, rerunCount: 4, progressPercent: 92, openedAt: '2026-02-13T10:00:00Z', dueDate: '2026-02-20T17:00:00Z', sequencingRunIdentifier: 'RUN-2026-011' },
  { id: '3', batchNumber: 'BATCH-20260212-0001', category: 'SOIL_HEALTH', status: 'COMPLETED', itemCount: 96, completedCount: 96, failedCount: 1, rerunCount: 1, progressPercent: 100, openedAt: '2026-02-12T09:00:00Z', dueDate: '2026-02-19T17:00:00Z', sequencingRunIdentifier: 'RUN-2026-010' },
  { id: '4', batchNumber: 'BATCH-20260215-0001', category: 'SOIL_HEALTH', status: 'OPEN', itemCount: 24, completedCount: 0, failedCount: 0, rerunCount: 0, progressPercent: 0, openedAt: '2026-02-15T14:00:00Z', dueDate: '2026-02-22T17:00:00Z', sequencingRunIdentifier: null },
];

// ------------------------------------------------------------------
// Page component
// ------------------------------------------------------------------

export default function SampleTrackingPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  // Fetch summary KPIs
  const { data: summaryData } = useQuery({
    queryKey: ['sample-tracking', 'summary'],
    queryFn: async () => {
      const { data } = await api.get('/v1/sample-tracking/summary');
      return data.data as TrackingSummary;
    },
    retry: false,
  });

  // Fetch pipeline view
  const { data: pipelineData } = useQuery({
    queryKey: ['sample-tracking', 'pipeline', selectedCategory],
    queryFn: async () => {
      const params = selectedCategory ? { category: selectedCategory } : {};
      const { data } = await api.get('/v1/sample-tracking/pipeline', { params });
      return data.data.categories as CategoryPipeline[];
    },
    retry: false,
  });

  // Fetch TAT metrics
  const { data: tatData } = useQuery({
    queryKey: ['sample-tracking', 'tat', selectedCategory],
    queryFn: async () => {
      const params = selectedCategory ? { category: selectedCategory } : {};
      const { data } = await api.get('/v1/sample-tracking/tat', { params });
      return data.data.categories as CategoryTAT[];
    },
    retry: false,
  });

  // Fetch batch overview
  const { data: batchData } = useQuery({
    queryKey: ['sample-tracking', 'batches', selectedCategory],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedCategory) params.category = selectedCategory;
      const { data } = await api.get('/v1/sample-tracking/batches', { params });
      return data.data as BatchOverview[];
    },
    retry: false,
  });

  const summary = summaryData ?? fallbackSummary;
  const pipeline = pipelineData ?? fallbackPipeline;
  const tat = tatData ?? fallbackTAT;
  const batches = batchData ?? fallbackBatches;

  // Collect unique categories from pipeline data for the filter
  const availableCategories = pipeline.map((p) => ({
    key: p.category,
    label: p.categoryLabel,
  }));

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page header with category filter */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sample Tracking</h1>
            <p className="text-muted-foreground">
              Track samples through workflow stages, monitor TAT, and manage batches
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border bg-card px-3 py-2 text-sm"
              value={selectedCategory ?? ''}
              onChange={(e) =>
                setSelectedCategory(e.target.value || undefined)
              }
            >
              <option value="">All Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KPICard
            title="Active Samples"
            value={String(summary.activeSamples)}
            icon={FlaskConical}
          />
          <KPICard
            title="In Processing"
            value={String(summary.samplesInProgress)}
            icon={Activity}
            iconColor="text-amber-600"
          />
          <KPICard
            title="Open Batches"
            value={String(summary.openBatches)}
            icon={Layers}
          />
          <KPICard
            title="Completed (Month)"
            value={String(summary.completedBatchesThisMonth)}
            icon={CheckCircle2}
            iconColor="text-emerald-600"
          />
          <KPICard
            title="Overdue Items"
            value={String(summary.overdueItems)}
            icon={AlertTriangle}
            iconColor="text-red-600"
          />
          <KPICard
            title="Re-runs (Month)"
            value={String(summary.rerunCount)}
            icon={RefreshCw}
            iconColor="text-violet-600"
          />
        </div>

        {/* Pipeline View */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Sample Pipeline</h2>
          </div>
          {pipeline.map((category) => (
            <StagePipeline key={category.category} category={category} />
          ))}
        </div>

        {/* TAT by Stage + Batch Overview side by side */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* TAT Chart */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Turnaround Time by Stage</h2>
            </div>
            {tat.map((category) => (
              <TATByStageChart key={category.category} data={category} />
            ))}
          </div>

          {/* Batch Overview */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Batch Overview</h2>
            </div>
            <BatchOverviewTable batches={batches} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
