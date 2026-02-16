// ============================================================
// Sequencing Run & PCR Plate Status Constants & Transitions
// ============================================================

// ----------------------------------------------------------------
// Sequencing Run Statuses
// ----------------------------------------------------------------

export const SequencingRunStatus = {
  SETUP: 'SETUP',
  DNA_EXTRACTED: 'DNA_EXTRACTED',
  PCR_IN_PROGRESS: 'PCR_IN_PROGRESS',
  POOLED: 'POOLED',
  SUBMITTED: 'SUBMITTED',
  SEQUENCED: 'SEQUENCED',
} as const;

export type SequencingRunStatus = (typeof SequencingRunStatus)[keyof typeof SequencingRunStatus];

export interface RunStatusInfo {
  value: SequencingRunStatus;
  label: string;
  description: string;
  color: string;
  isFinal: boolean;
}

export const SEQUENCING_RUN_STATUS_INFO: Record<SequencingRunStatus, RunStatusInfo> = {
  SETUP: {
    value: 'SETUP',
    label: 'Setup',
    description: 'Run is being configured — plates and samples are being defined',
    color: '#6B7280',
    isFinal: false,
  },
  DNA_EXTRACTED: {
    value: 'DNA_EXTRACTED',
    label: 'DNA Extracted',
    description: 'DNA extraction is complete for all plates in this run',
    color: '#3B82F6',
    isFinal: false,
  },
  PCR_IN_PROGRESS: {
    value: 'PCR_IN_PROGRESS',
    label: 'PCR In Progress',
    description: 'PCR amplification and gel checking are underway',
    color: '#F59E0B',
    isFinal: false,
  },
  POOLED: {
    value: 'POOLED',
    label: 'Pooled',
    description: 'PCR products have been pooled for sequencing',
    color: '#8B5CF6',
    isFinal: false,
  },
  SUBMITTED: {
    value: 'SUBMITTED',
    label: 'Submitted',
    description: 'Pool has been submitted for sequencing',
    color: '#10B981',
    isFinal: false,
  },
  SEQUENCED: {
    value: 'SEQUENCED',
    label: 'Sequenced',
    description: 'Sequencing is complete and data has been received',
    color: '#059669',
    isFinal: true,
  },
};

export const SEQUENCING_RUN_TRANSITIONS: Record<SequencingRunStatus, SequencingRunStatus[]> = {
  SETUP: ['DNA_EXTRACTED'],
  DNA_EXTRACTED: ['PCR_IN_PROGRESS'],
  PCR_IN_PROGRESS: ['POOLED'],
  POOLED: ['SUBMITTED'],
  SUBMITTED: ['SEQUENCED'],
  SEQUENCED: [],
};

export function isValidRunTransition(from: SequencingRunStatus, to: SequencingRunStatus): boolean {
  return SEQUENCING_RUN_TRANSITIONS[from].includes(to);
}

export function getAvailableRunTransitions(current: SequencingRunStatus): SequencingRunStatus[] {
  return SEQUENCING_RUN_TRANSITIONS[current];
}

export function getActiveRunStatuses(): SequencingRunStatus[] {
  return (Object.keys(SEQUENCING_RUN_STATUS_INFO) as SequencingRunStatus[]).filter(
    (status) => !SEQUENCING_RUN_STATUS_INFO[status].isFinal,
  );
}

export function getFinalRunStatuses(): SequencingRunStatus[] {
  return (Object.keys(SEQUENCING_RUN_STATUS_INFO) as SequencingRunStatus[]).filter(
    (status) => SEQUENCING_RUN_STATUS_INFO[status].isFinal,
  );
}

// ----------------------------------------------------------------
// PCR Plate Statuses
// ----------------------------------------------------------------

export const PcrPlateStatus = {
  SETUP: 'PLATE_SETUP',
  PCR_COMPLETE: 'PCR_COMPLETE',
  GEL_CHECKED: 'GEL_CHECKED',
  POOLING_ASSIGNED: 'POOLING_ASSIGNED',
  DONE: 'PLATE_DONE',
} as const;

export type PcrPlateStatus = (typeof PcrPlateStatus)[keyof typeof PcrPlateStatus];

export interface PlateStatusInfo {
  value: PcrPlateStatus;
  label: string;
  description: string;
  color: string;
  isFinal: boolean;
}

export const PCR_PLATE_STATUS_INFO: Record<PcrPlateStatus, PlateStatusInfo> = {
  PLATE_SETUP: {
    value: 'PLATE_SETUP',
    label: 'Setup',
    description: 'PCR plate is being prepared — wells are being populated',
    color: '#6B7280',
    isFinal: false,
  },
  PCR_COMPLETE: {
    value: 'PCR_COMPLETE',
    label: 'PCR Complete',
    description: 'PCR amplification has been performed',
    color: '#3B82F6',
    isFinal: false,
  },
  GEL_CHECKED: {
    value: 'GEL_CHECKED',
    label: 'Gel Checked',
    description: 'Gel electrophoresis results have been assessed',
    color: '#F59E0B',
    isFinal: false,
  },
  POOLING_ASSIGNED: {
    value: 'POOLING_ASSIGNED',
    label: 'Pooling Assigned',
    description: 'Pooling actions have been assigned to all wells',
    color: '#8B5CF6',
    isFinal: false,
  },
  PLATE_DONE: {
    value: 'PLATE_DONE',
    label: 'Done',
    description: 'Plate has been fully processed and pooled',
    color: '#059669',
    isFinal: true,
  },
};

export const PCR_PLATE_TRANSITIONS: Record<PcrPlateStatus, PcrPlateStatus[]> = {
  PLATE_SETUP: ['PCR_COMPLETE'],
  PCR_COMPLETE: ['GEL_CHECKED'],
  GEL_CHECKED: ['POOLING_ASSIGNED'],
  POOLING_ASSIGNED: ['PLATE_DONE'],
  PLATE_DONE: [],
};

export function isValidPlateTransition(from: PcrPlateStatus, to: PcrPlateStatus): boolean {
  return PCR_PLATE_TRANSITIONS[from].includes(to);
}

export function getAvailablePlateTransitions(current: PcrPlateStatus): PcrPlateStatus[] {
  return PCR_PLATE_TRANSITIONS[current];
}

export function getActivePlateStatuses(): PcrPlateStatus[] {
  return (Object.keys(PCR_PLATE_STATUS_INFO) as PcrPlateStatus[]).filter(
    (status) => !PCR_PLATE_STATUS_INFO[status].isFinal,
  );
}

export function getFinalPlateStatuses(): PcrPlateStatus[] {
  return (Object.keys(PCR_PLATE_STATUS_INFO) as PcrPlateStatus[]).filter(
    (status) => PCR_PLATE_STATUS_INFO[status].isFinal,
  );
}
