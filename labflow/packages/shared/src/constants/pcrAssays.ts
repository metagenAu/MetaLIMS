// ============================================================
// PCR Assay Constants, Suffix Mappings & Reagent Formulas
// ============================================================

// ----------------------------------------------------------------
// Assay Types
// ----------------------------------------------------------------

export const PcrAssay = {
  ASSAY_16S: 'ASSAY_16S',
  ASSAY_EUK2: 'ASSAY_EUK2',
  ASSAY_ITS: 'ASSAY_ITS',
  ASSAY_COI: 'ASSAY_COI',
} as const;

export type PcrAssay = (typeof PcrAssay)[keyof typeof PcrAssay];

export interface AssayInfo {
  value: PcrAssay;
  label: string;
  displayName: string;
  suffix: string;
  targetGene: string;
}

export const PCR_ASSAY_INFO: Record<PcrAssay, AssayInfo> = {
  ASSAY_16S: {
    value: 'ASSAY_16S',
    label: '16S',
    displayName: '16S rRNA',
    suffix: '_16s',
    targetGene: '16S ribosomal RNA',
  },
  ASSAY_EUK2: {
    value: 'ASSAY_EUK2',
    label: 'EUK2',
    displayName: 'Eukaryotic 18S',
    suffix: '_EUK2',
    targetGene: '18S ribosomal RNA (eukaryotic)',
  },
  ASSAY_ITS: {
    value: 'ASSAY_ITS',
    label: 'ITS',
    displayName: 'ITS',
    suffix: '_ITS',
    targetGene: 'Internal Transcribed Spacer',
  },
  ASSAY_COI: {
    value: 'ASSAY_COI',
    label: 'COI',
    displayName: 'COI',
    suffix: '_COI',
    targetGene: 'Cytochrome c Oxidase I',
  },
};

/**
 * Reverse lookup: suffix string → PcrAssay value.
 */
export const ASSAY_BY_SUFFIX: Record<string, PcrAssay> = Object.fromEntries(
  Object.values(PCR_ASSAY_INFO).map((info) => [info.suffix, info.value]),
) as Record<string, PcrAssay>;

/**
 * Returns the assay label for display (e.g. "16S", "EUK2").
 */
export function getAssayLabel(assay: PcrAssay): string {
  return PCR_ASSAY_INFO[assay].label;
}

/**
 * Returns the suffix to append to sample labels for a given assay.
 */
export function getAssaySuffix(assay: PcrAssay): string {
  return PCR_ASSAY_INFO[assay].suffix;
}

// ----------------------------------------------------------------
// PCR Result & Pooling Action enums (mirroring Prisma enums)
// ----------------------------------------------------------------

export const PcrResult = {
  PENDING: 'PCR_PENDING',
  PASS: 'PASS',
  FAIL: 'FAIL',
  BORDERLINE: 'BORDERLINE',
} as const;

export type PcrResult = (typeof PcrResult)[keyof typeof PcrResult];

export const PoolingAction = {
  POOL_NORMAL: 'POOL_NORMAL',
  POOL_DOUBLE: 'POOL_DOUBLE',
  DO_NOT_POOL: 'DO_NOT_POOL',
  SKIP: 'POOL_SKIP',
} as const;

export type PoolingAction = (typeof PoolingAction)[keyof typeof PoolingAction];

// ----------------------------------------------------------------
// Well Type enum (mirroring Prisma WellType)
// ----------------------------------------------------------------

export const WellType = {
  SAMPLE: 'SAMPLE',
  MOCK_CONTROL: 'MOCK_CONTROL',
  EXTRACTION_CONTROL: 'EXTRACTION_CONTROL',
  NTC: 'NTC',
  POSITIVE_CONTROL: 'POSITIVE_CONTROL',
  EMPTY: 'EMPTY',
} as const;

export type WellType = (typeof WellType)[keyof typeof WellType];

// ----------------------------------------------------------------
// Extraction Method enum (mirroring Prisma ExtractionMethod)
// ----------------------------------------------------------------

export const ExtractionMethod = {
  AUTOMATED: 'AUTOMATED',
  MANUAL: 'MANUAL',
  OTHER: 'OTHER',
} as const;

export type ExtractionMethod = (typeof ExtractionMethod)[keyof typeof ExtractionMethod];

// ----------------------------------------------------------------
// Sample Label Suffix Descriptions
// ----------------------------------------------------------------

export const SAMPLE_LABEL_SUFFIXES = [
  { suffix: '_16s', description: '16S rRNA assay', type: 'assay' },
  { suffix: '_EUK2', description: 'Eukaryotic 18S assay', type: 'assay' },
  { suffix: '_ITS', description: 'ITS assay', type: 'assay' },
  { suffix: '_COI', description: 'COI assay', type: 'assay' },
  { suffix: '.d2', description: 'Dilution (1:2)', type: 'dilution' },
  { suffix: '.d5', description: 'Dilution (1:5)', type: 'dilution' },
  { suffix: '.d10', description: 'Dilution (1:10)', type: 'dilution' },
  { suffix: '.r', description: 'Rerun', type: 'rerun' },
  { suffix: '_2', description: 'Repeat (2nd attempt)', type: 'repeat' },
  { suffix: '_3', description: 'Repeat (3rd attempt)', type: 'repeat' },
] as const;

// ----------------------------------------------------------------
// Reagent Formulas (default per-sample volumes in µL)
// ----------------------------------------------------------------

export interface ReagentFormula {
  reagentName: string;
  perSampleUl: number;
  unit: string;
  overageFactor: number;
}

/**
 * Default reagent requirements per sample for a standard metabarcoding run.
 * Volumes are in µL per sample. The overageFactor (e.g. 1.1 = 10% overage)
 * accounts for pipetting loss.
 */
export const DEFAULT_REAGENT_FORMULAS: ReagentFormula[] = [
  { reagentName: 'Lysis Solution', perSampleUl: 600, unit: 'µL', overageFactor: 1.1 },
  { reagentName: 'Soil Lysis Additive', perSampleUl: 100, unit: 'µL', overageFactor: 1.1 },
  { reagentName: 'SPRI Bead Binding Solution', perSampleUl: 300, unit: 'µL', overageFactor: 1.15 },
  { reagentName: 'Flocculant Solution', perSampleUl: 200, unit: 'µL', overageFactor: 1.1 },
  { reagentName: '10mM TRIS', perSampleUl: 100, unit: 'µL', overageFactor: 1.1 },
  { reagentName: '80% Ethanol', perSampleUl: 800, unit: 'µL', overageFactor: 1.1 },
  { reagentName: 'Sterilised Sandblasting Grit', perSampleUl: 50, unit: 'mg', overageFactor: 1.2 },
  { reagentName: 'Concentrated SPRI Beads', perSampleUl: 20, unit: 'µL', overageFactor: 1.15 },
];

/**
 * PCR master mix volumes per reaction (µL).
 */
export const PCR_MASTER_MIX_PER_REACTION_UL = 25;
export const PCR_PRIMER_PER_REACTION_UL = 2.5;
export const PCR_TEMPLATE_PER_REACTION_UL = 2;
export const PCR_OVERAGE_FACTOR = 1.1;
