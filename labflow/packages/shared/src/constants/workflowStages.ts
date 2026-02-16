// ============================================================
// Default Workflow Stage Definitions & Utilities
// ============================================================
//
// Each workflow category has an ordered list of stages that samples
// pass through.  These defaults can be customised per-organisation
// via the WorkflowStageDefinition table.
// ============================================================

import type { AnalysisBatchStatus } from '../types/sampleTracking';

// ------------------------------------------------------------------
// Stage definition shape
// ------------------------------------------------------------------

export interface DefaultStageDefinition {
  stageKey: string;
  label: string;
  description: string;
  color: string;
  isTerminal: boolean;
  expectedDurationHours?: number;
}

// ------------------------------------------------------------------
// Category metadata
// ------------------------------------------------------------------

export interface WorkflowCategoryInfo {
  key: string;
  label: string;
  description: string;
}

export const WORKFLOW_CATEGORIES: WorkflowCategoryInfo[] = [
  {
    key: 'SOIL_HEALTH',
    label: 'Soil Health',
    description: 'Soil health testing via DNA metabarcoding (16S, ITS, 18S, COI)',
  },
  {
    key: 'WATER_CHEMISTRY',
    label: 'Water Chemistry',
    description: 'Chemical analysis of water samples',
  },
  {
    key: 'METABARCODING',
    label: 'Metabarcoding',
    description: 'Generic metabarcoding pipeline (non-soil)',
  },
  {
    key: 'GENERAL_CHEMISTRY',
    label: 'General Chemistry',
    description: 'General wet chemistry and instrumental analysis',
  },
  {
    key: 'MICROBIOLOGY',
    label: 'Microbiology',
    description: 'Culture-based microbiological testing',
  },
];

export function getCategoryLabel(category: string): string {
  return WORKFLOW_CATEGORIES.find((c) => c.key === category)?.label ?? category;
}

// ------------------------------------------------------------------
// Default stages per category
// ------------------------------------------------------------------

/** Soil health testing pipeline (primary workflow). */
export const SOIL_HEALTH_STAGES: DefaultStageDefinition[] = [
  {
    stageKey: 'REGISTERED',
    label: 'Registered',
    description: 'Sample logged into system, awaiting receipt',
    color: '#6B7280',
    isTerminal: false,
    expectedDurationHours: 24,
  },
  {
    stageKey: 'RECEIVED',
    label: 'Received',
    description: 'Sample physically received and condition verified',
    color: '#3B82F6',
    isTerminal: false,
    expectedDurationHours: 4,
  },
  {
    stageKey: 'WEIGHING',
    label: 'Weighing',
    description: 'Sub-sampling and weighing for extraction',
    color: '#8B5CF6',
    isTerminal: false,
    expectedDurationHours: 8,
  },
  {
    stageKey: 'DNA_EXTRACTION',
    label: 'DNA Extraction',
    description: 'DNA extracted from soil sub-sample',
    color: '#A855F7',
    isTerminal: false,
    expectedDurationHours: 24,
  },
  {
    stageKey: 'PCR',
    label: 'PCR',
    description: 'PCR amplification of target gene regions',
    color: '#EC4899',
    isTerminal: false,
    expectedDurationHours: 12,
  },
  {
    stageKey: 'POOLING',
    label: 'Pooling',
    description: 'Amplicons pooled and normalised for sequencing',
    color: '#F59E0B',
    isTerminal: false,
    expectedDurationHours: 8,
  },
  {
    stageKey: 'SEQUENCING',
    label: 'Sequencing',
    description: 'Sequencing run on instrument (e.g. Illumina MiSeq)',
    color: '#EF4444',
    isTerminal: false,
    expectedDurationHours: 48,
  },
  {
    stageKey: 'BIOINFORMATICS',
    label: 'Bioinformatics',
    description: 'Sequence data processing, OTU/ASV assignment',
    color: '#14B8A6',
    isTerminal: false,
    expectedDurationHours: 24,
  },
  {
    stageKey: 'RESULTS_READY',
    label: 'Results Ready',
    description: 'Results generated and ready for QA review',
    color: '#10B981',
    isTerminal: false,
    expectedDurationHours: 12,
  },
  {
    stageKey: 'REPORT_SENT',
    label: 'Report Sent',
    description: 'Final report delivered to client',
    color: '#059669',
    isTerminal: true,
  },
];

/** Metabarcoding pipeline (generic). */
export const METABARCODING_STAGES: DefaultStageDefinition[] = [
  {
    stageKey: 'REGISTERED',
    label: 'Registered',
    description: 'Sample logged',
    color: '#6B7280',
    isTerminal: false,
    expectedDurationHours: 24,
  },
  {
    stageKey: 'RECEIVED',
    label: 'Received',
    description: 'Sample received at lab',
    color: '#3B82F6',
    isTerminal: false,
    expectedDurationHours: 4,
  },
  {
    stageKey: 'SAMPLE_PREP',
    label: 'Sample Prep',
    description: 'Pre-extraction preparation',
    color: '#8B5CF6',
    isTerminal: false,
    expectedDurationHours: 12,
  },
  {
    stageKey: 'DNA_EXTRACTION',
    label: 'DNA Extraction',
    description: 'DNA/RNA extraction',
    color: '#A855F7',
    isTerminal: false,
    expectedDurationHours: 24,
  },
  {
    stageKey: 'PCR',
    label: 'PCR',
    description: 'Target amplification',
    color: '#EC4899',
    isTerminal: false,
    expectedDurationHours: 12,
  },
  {
    stageKey: 'SEQUENCING',
    label: 'Sequencing',
    description: 'Library prep and sequencing',
    color: '#F59E0B',
    isTerminal: false,
    expectedDurationHours: 48,
  },
  {
    stageKey: 'BIOINFORMATICS',
    label: 'Bioinformatics',
    description: 'Data analysis pipeline',
    color: '#14B8A6',
    isTerminal: false,
    expectedDurationHours: 24,
  },
  {
    stageKey: 'RESULTS_READY',
    label: 'Results Ready',
    description: 'Results ready for review',
    color: '#10B981',
    isTerminal: false,
    expectedDurationHours: 12,
  },
  {
    stageKey: 'REPORT_SENT',
    label: 'Report Sent',
    description: 'Report delivered',
    color: '#059669',
    isTerminal: true,
  },
];

/** General chemistry pipeline. */
export const GENERAL_CHEMISTRY_STAGES: DefaultStageDefinition[] = [
  {
    stageKey: 'REGISTERED',
    label: 'Registered',
    description: 'Sample logged into system',
    color: '#6B7280',
    isTerminal: false,
    expectedDurationHours: 24,
  },
  {
    stageKey: 'RECEIVED',
    label: 'Received',
    description: 'Sample received and inspected',
    color: '#3B82F6',
    isTerminal: false,
    expectedDurationHours: 4,
  },
  {
    stageKey: 'SAMPLE_PREP',
    label: 'Sample Prep',
    description: 'Digestion, dilution, or preparation',
    color: '#8B5CF6',
    isTerminal: false,
    expectedDurationHours: 12,
  },
  {
    stageKey: 'ANALYSIS',
    label: 'Analysis',
    description: 'Instrumental or wet chemistry analysis',
    color: '#F59E0B',
    isTerminal: false,
    expectedDurationHours: 24,
  },
  {
    stageKey: 'QC_REVIEW',
    label: 'QC Review',
    description: 'Quality control and data review',
    color: '#14B8A6',
    isTerminal: false,
    expectedDurationHours: 8,
  },
  {
    stageKey: 'RESULTS_READY',
    label: 'Results Ready',
    description: 'Results finalised',
    color: '#10B981',
    isTerminal: false,
    expectedDurationHours: 4,
  },
  {
    stageKey: 'REPORT_SENT',
    label: 'Report Sent',
    description: 'Report delivered to client',
    color: '#059669',
    isTerminal: true,
  },
];

/** Lookup of default stages by category key. */
export const DEFAULT_STAGES_BY_CATEGORY: Record<string, DefaultStageDefinition[]> = {
  SOIL_HEALTH: SOIL_HEALTH_STAGES,
  METABARCODING: METABARCODING_STAGES,
  GENERAL_CHEMISTRY: GENERAL_CHEMISTRY_STAGES,
  WATER_CHEMISTRY: GENERAL_CHEMISTRY_STAGES, // shares same pipeline
  MICROBIOLOGY: GENERAL_CHEMISTRY_STAGES,
};

/**
 * Returns the default stage definitions for a category, falling back to
 * GENERAL_CHEMISTRY if the category is unknown.
 */
export function getDefaultStages(category: string): DefaultStageDefinition[] {
  return DEFAULT_STAGES_BY_CATEGORY[category] ?? GENERAL_CHEMISTRY_STAGES;
}

// ------------------------------------------------------------------
// Batch status info
// ------------------------------------------------------------------

export interface BatchStatusInfo {
  value: AnalysisBatchStatus;
  label: string;
  description: string;
  color: string;
  isFinal: boolean;
}

export const BATCH_STATUS_INFO: Record<string, BatchStatusInfo> = {
  OPEN: {
    value: 'OPEN',
    label: 'Open',
    description: 'Batch is accepting samples',
    color: '#3B82F6',
    isFinal: false,
  },
  IN_PROGRESS: {
    value: 'IN_PROGRESS',
    label: 'In Progress',
    description: 'Batch processing has started',
    color: '#F59E0B',
    isFinal: false,
  },
  COMPLETED: {
    value: 'COMPLETED',
    label: 'Completed',
    description: 'All items in batch successfully processed',
    color: '#10B981',
    isFinal: true,
  },
  FAILED: {
    value: 'FAILED',
    label: 'Failed',
    description: 'Batch processing failed — items may need re-run',
    color: '#EF4444',
    isFinal: true,
  },
  CANCELLED: {
    value: 'CANCELLED',
    label: 'Cancelled',
    description: 'Batch was cancelled before completion',
    color: '#6B7280',
    isFinal: true,
  },
};

export const BATCH_STATUS_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: ['OPEN'], // allow reopening a failed batch for reruns
  CANCELLED: [],
};

export function isValidBatchTransition(from: string, to: string): boolean {
  return (BATCH_STATUS_TRANSITIONS[from] ?? []).includes(to);
}
