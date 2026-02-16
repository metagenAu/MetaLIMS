// ============================================================
// Sequencing / Metabarcoding Types & Interfaces
// ============================================================

import type { SequencingRunStatus, PcrPlateStatus } from '../constants/sequencingStatuses';
import type { PcrAssay, PcrResult, PoolingAction, WellType, ExtractionMethod } from '../constants/pcrAssays';

// ----------------------------------------------------------------
// Sequencing Run
// ----------------------------------------------------------------

export interface SequencingRun {
  id: string;
  organizationId: string;
  runIdentifier: string;
  status: SequencingRunStatus;
  dateStarted: Date | null;
  poolConfig: PoolConfigEntry[];
  notes: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PoolConfigEntry {
  assay: string;
  ratio: number;
  sampleCount: number;
  volumeUl: number;
}

export interface CreateSequencingRunInput {
  runIdentifier: string;
  dateStarted?: Date | null;
  poolConfig?: PoolConfigEntry[];
  notes?: string | null;
}

export interface UpdateSequencingRunInput {
  runIdentifier?: string;
  dateStarted?: Date | null;
  poolConfig?: PoolConfigEntry[];
  notes?: string | null;
}

export interface SequencingRunFilterParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  status?: SequencingRunStatus;
}

// ----------------------------------------------------------------
// DNA Plate
// ----------------------------------------------------------------

export interface DNAPlate {
  id: string;
  sequencingRunId: string;
  plateIdentifier: string;
  plateBarcode: string | null;
  extractionMethod: ExtractionMethod;
  clientProject: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDNAPlateInput {
  plateIdentifier: string;
  plateBarcode?: string | null;
  extractionMethod: ExtractionMethod;
  clientProject?: string | null;
  notes?: string | null;
}

export interface UpdateDNAPlateInput {
  plateIdentifier?: string;
  plateBarcode?: string | null;
  extractionMethod?: ExtractionMethod;
  clientProject?: string | null;
  notes?: string | null;
}

// ----------------------------------------------------------------
// DNA Plate Well
// ----------------------------------------------------------------

export interface DNAPlateWell {
  id: string;
  dnaPlateId: string;
  position: string;
  sampleId: string | null;
  wellType: WellType;
  dnaConcentrationNgUl: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkWellImportRow {
  position: string;
  sampleId?: string | null;
  wellType?: WellType;
  dnaConcentrationNgUl?: number | null;
  notes?: string | null;
}

// ----------------------------------------------------------------
// PCR Plate
// ----------------------------------------------------------------

export interface PCRPlate {
  id: string;
  sequencingRunId: string;
  plateIdentifier: string;
  plateBarcode: string | null;
  pcrAssay: PcrAssay;
  datePerformed: Date | null;
  sourceDnaPlateId: string | null;
  indexPlateReferenceId: string | null;
  isRedo: boolean;
  redoOfPlateId: string | null;
  operatorId: string | null;
  gelNotes: string | null;
  status: PcrPlateStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePCRPlateInput {
  plateIdentifier: string;
  plateBarcode?: string | null;
  pcrAssay: PcrAssay;
  datePerformed?: Date | null;
  sourceDnaPlateId: string;
  indexPlateReferenceId?: string | null;
  isRedo?: boolean;
  redoOfPlateId?: string | null;
  operatorId?: string | null;
  gelNotes?: string | null;
}

export interface UpdatePCRPlateInput {
  plateIdentifier?: string;
  plateBarcode?: string | null;
  pcrAssay?: PcrAssay;
  datePerformed?: Date | null;
  indexPlateReferenceId?: string | null;
  isRedo?: boolean;
  redoOfPlateId?: string | null;
  operatorId?: string | null;
  gelNotes?: string | null;
}

// ----------------------------------------------------------------
// PCR Plate Well
// ----------------------------------------------------------------

export interface PCRPlateWell {
  id: string;
  pcrPlateId: string;
  position: string;
  sampleLabel: string | null;
  assayType: string | null;
  wellType: WellType;
  indexI5Sequence: string | null;
  indexI7Sequence: string | null;
  mergedIndexSequence: string | null;
  pcrResult: PcrResult;
  poolingAction: PoolingAction;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkPCRWellImportRow {
  position: string;
  sampleLabel?: string | null;
  assayType?: string | null;
  wellType?: WellType;
  notes?: string | null;
}

export interface BulkPCRResultUpdate {
  wellId?: string;
  position?: string;
  pcrResult?: PcrResult;
  poolingAction?: PoolingAction;
  notes?: string | null;
}

// ----------------------------------------------------------------
// Index Plate Reference
// ----------------------------------------------------------------

export interface IndexPlateReference {
  id: string;
  organizationId: string;
  plateName: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIndexPlateInput {
  plateName: string;
  description?: string | null;
}

export interface IndexWell {
  id: string;
  indexPlateReferenceId: string;
  position: string;
  i5Name: string;
  i5Sequence: string;
  i7Name: string;
  i7Sequence: string;
  mergedSequence: string | null;
  createdAt: Date;
}

export interface BulkIndexWellImportRow {
  position: string;
  i5Name: string;
  i5Sequence: string;
  i7Name: string;
  i7Sequence: string;
  mergedSequence?: string | null;
}

// ----------------------------------------------------------------
// Pool Definition
// ----------------------------------------------------------------

export interface PoolDefinition {
  id: string;
  sequencingRunId: string;
  poolName: string;
  assayRatios: Record<string, number>;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePoolDefinitionInput {
  poolName: string;
  assayRatios?: Record<string, number>;
  notes?: string | null;
}

export interface UpdatePoolDefinitionInput {
  poolName?: string;
  assayRatios?: Record<string, number>;
  notes?: string | null;
}

// ----------------------------------------------------------------
// Reagent Inventory
// ----------------------------------------------------------------

export interface RunReagentInventory {
  id: string;
  sequencingRunId: string;
  reagentName: string;
  amountOnHand: number;
  minimumRequired: number;
  amountToMake: number;
  unit: string;
  lotNumber: string | null;
  expiryDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReagentInput {
  reagentName: string;
  amountOnHand: number;
  minimumRequired?: number;
  amountToMake?: number;
  unit?: string;
  lotNumber?: string | null;
  expiryDate?: Date | null;
  notes?: string | null;
}

export interface UpdateReagentInput {
  reagentName?: string;
  amountOnHand?: number;
  minimumRequired?: number;
  amountToMake?: number;
  unit?: string;
  lotNumber?: string | null;
  expiryDate?: Date | null;
  notes?: string | null;
}

// ----------------------------------------------------------------
// Export types
// ----------------------------------------------------------------

export interface OpentronsCsvRow {
  newTip: string;
  sourceLabware: string;
  sourceSlot: string;
  sourceWell: string;
  sourceAspirationHeight: string;
  destLabware: string;
  destSlot: string;
  destWell: string;
  destDispenseHeight: string;
  volumeUl: string;
}

export interface IlluminaSampleSheetRow {
  sampleId: string;
  sampleName: string;
  samplePlate: string;
  sampleWell: string;
  i7IndexId: string;
  index: string;
  i5IndexId: string;
  index2: string;
  sampleProject: string;
  description: string;
}

// ----------------------------------------------------------------
// Plate Map (8×12 grid for UI rendering)
// ----------------------------------------------------------------

export interface PlateMapWell<T = Record<string, unknown>> {
  position: string;
  row: string;
  column: string;
  data: T | null;
}

export type PlateMapGrid<T = Record<string, unknown>> = PlateMapWell<T>[][];

// ----------------------------------------------------------------
// Index Collision Result
// ----------------------------------------------------------------

export interface IndexCollision {
  mergedSequence: string;
  wells: Array<{
    pcrPlateId: string;
    plateIdentifier: string;
    position: string;
    sampleLabel: string | null;
  }>;
}

// ----------------------------------------------------------------
// Control Placement Warning
// ----------------------------------------------------------------

export interface ControlWarning {
  pcrPlateId: string;
  plateIdentifier: string;
  missingControls: string[];
  message: string;
}
