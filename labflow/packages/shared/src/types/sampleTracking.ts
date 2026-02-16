// ============================================================
// Sample Tracking Types - Workflow Stages, Batches, Alerts
// ============================================================

// ------------------------------------------------------------------
// Workflow Stage Definitions
// ------------------------------------------------------------------

/** Machine-readable workflow category identifiers. */
export const WorkflowCategory = {
  SOIL_HEALTH: 'SOIL_HEALTH',
  WATER_CHEMISTRY: 'WATER_CHEMISTRY',
  METABARCODING: 'METABARCODING',
  GENERAL_CHEMISTRY: 'GENERAL_CHEMISTRY',
  MICROBIOLOGY: 'MICROBIOLOGY',
  CUSTOM: 'CUSTOM',
} as const;

export type WorkflowCategory = (typeof WorkflowCategory)[keyof typeof WorkflowCategory];

/** A single stage definition in a workflow pipeline. */
export interface WorkflowStageDefinition {
  id: string;
  organizationId: string;
  category: string;
  stageKey: string;
  label: string;
  description?: string | null;
  sortOrder: number;
  color?: string | null;
  isTerminal: boolean;
  expectedDurationHours?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowStageInput {
  category: string;
  stageKey: string;
  label: string;
  description?: string;
  sortOrder?: number;
  color?: string;
  isTerminal?: boolean;
  expectedDurationHours?: number;
}

export interface UpdateWorkflowStageInput {
  label?: string;
  description?: string;
  sortOrder?: number;
  color?: string;
  isTerminal?: boolean;
  expectedDurationHours?: number;
  isActive?: boolean;
}

// ------------------------------------------------------------------
// Sample Stage Logs (audit trail of stage transitions)
// ------------------------------------------------------------------

export interface SampleStageLog {
  id: string;
  organizationId: string;
  sampleId: string;
  testId?: string | null;
  batchId?: string | null;
  stageDefinitionId: string;
  category: string;
  stageKey: string;
  enteredAt: string;
  exitedAt?: string | null;
  durationMinutes?: number | null;
  performedById?: string | null;
  notes?: string | null;
}

export interface CreateStageTransitionInput {
  sampleId: string;
  stageDefinitionId: string;
  category: string;
  stageKey: string;
  testId?: string;
  batchId?: string;
  performedById?: string;
  notes?: string;
}

// ------------------------------------------------------------------
// Analysis Batches
// ------------------------------------------------------------------

export const AnalysisBatchStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type AnalysisBatchStatus = (typeof AnalysisBatchStatus)[keyof typeof AnalysisBatchStatus];

export interface AnalysisBatch {
  id: string;
  organizationId: string;
  batchNumber: string;
  category: string;
  status: AnalysisBatchStatus;
  description?: string | null;
  sequencingRunId?: string | null;
  targetStageKey?: string | null;
  createdById?: string | null;
  openedAt: string;
  closedAt?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
  completedItemCount?: number;
}

export interface CreateAnalysisBatchInput {
  category: string;
  description?: string;
  sequencingRunId?: string;
  targetStageKey?: string;
  dueDate?: string;
  notes?: string;
}

export interface UpdateAnalysisBatchInput {
  status?: AnalysisBatchStatus;
  description?: string;
  sequencingRunId?: string;
  targetStageKey?: string;
  dueDate?: string;
  notes?: string;
}

export const AnalysisBatchItemStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type AnalysisBatchItemStatus = (typeof AnalysisBatchItemStatus)[keyof typeof AnalysisBatchItemStatus];

export interface AnalysisBatchItem {
  id: string;
  batchId: string;
  sampleId: string;
  testId?: string | null;
  position?: number | null;
  isRerun: boolean;
  rerunReason?: string | null;
  rerunOfItemId?: string | null;
  status: string;
  addedAt: string;
  completedAt?: string | null;
  notes?: string | null;
}

export interface AddBatchItemInput {
  sampleId: string;
  testId?: string;
  position?: number;
  isRerun?: boolean;
  rerunReason?: string;
  rerunOfItemId?: string;
  notes?: string;
}

export interface RerunBatchItemInput {
  originalItemId: string;
  targetBatchId?: string; // if omitted, add to same batch
  rerunReason: string;
  notes?: string;
}

// ------------------------------------------------------------------
// Client Alerts
// ------------------------------------------------------------------

export const ClientAlertType = {
  STAGE_CHANGE: 'STAGE_CHANGE',
  BATCH_COMPLETE: 'BATCH_COMPLETE',
  RESULTS_READY: 'RESULTS_READY',
  REPORT_SENT: 'REPORT_SENT',
  RUN_SUBMITTED: 'RUN_SUBMITTED',
  SAMPLE_RECEIVED: 'SAMPLE_RECEIVED',
} as const;

export type ClientAlertType = (typeof ClientAlertType)[keyof typeof ClientAlertType];

export interface ClientAlertConfig {
  id: string;
  clientId: string;
  alertType: string;
  enabled: boolean;
  emailRecipients: string[];
  webhookUrl?: string | null;
  stageKeys: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientAlertConfigInput {
  clientId: string;
  alertType: string;
  enabled?: boolean;
  emailRecipients?: string[];
  webhookUrl?: string;
  stageKeys?: string[];
}

export interface ClientAlertLog {
  id: string;
  organizationId: string;
  clientId: string;
  alertType: string;
  channel: string;
  subject: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  recipients: string[];
  sentAt: string;
  status: string;
  errorMessage?: string | null;
}

// ------------------------------------------------------------------
// Dashboard DTOs
// ------------------------------------------------------------------

/** A single column in the sample tracking pipeline view. */
export interface StagePipelineColumn {
  stageKey: string;
  label: string;
  color: string;
  sortOrder: number;
  sampleCount: number;
  expectedDurationHours?: number | null;
}

/** Pipeline grouped by test method category. */
export interface CategoryPipeline {
  category: string;
  categoryLabel: string;
  stages: StagePipelineColumn[];
  totalSamples: number;
}

/** TAT metrics for a specific stage within a category. */
export interface StageTATMetric {
  stageKey: string;
  label: string;
  avgDurationMinutes: number;
  medianDurationMinutes: number;
  p95DurationMinutes: number;
  expectedDurationMinutes?: number | null;
  sampleCount: number;
  onTargetPercentage: number;
}

/** TAT metrics grouped by category. */
export interface CategoryTATMetrics {
  category: string;
  categoryLabel: string;
  stages: StageTATMetric[];
  overallAvgDays: number;
  overallOnTimePercentage: number;
}

/** Batch overview for dashboard display. */
export interface BatchOverview {
  id: string;
  batchNumber: string;
  category: string;
  status: AnalysisBatchStatus;
  itemCount: number;
  completedCount: number;
  failedCount: number;
  rerunCount: number;
  progressPercent: number;
  openedAt: string;
  dueDate?: string | null;
  sequencingRunIdentifier?: string | null;
}

export interface AnalysisBatchFilterParams {
  category?: string;
  status?: AnalysisBatchStatus;
  page?: number;
  pageSize?: number;
}
