/**
 * Sequencing / Metabarcoding Service
 *
 * Core business logic for the metabarcoding amplicon PCR tracking module.
 * Handles: CSV parsing, auto-population, index assignment, collision detection,
 * reagent calculation, Opentrons CSV generation, Illumina sample sheet generation.
 */

import { prisma } from '@labflow/db';
import type { Prisma, PrismaClient } from '@labflow/db';
import {
  ALL_WELL_POSITIONS,
  isValidWellPosition,
  normaliseWellPosition,
  ROWS,
  COLUMNS,
} from '@labflow/shared/constants/wellPositions';
import {
  isValidRunTransition,
  isValidPlateTransition,
} from '@labflow/shared/constants/sequencingStatuses';
import { PCR_ASSAY_INFO, DEFAULT_REAGENT_FORMULAS, PCR_MASTER_MIX_PER_REACTION_UL, PCR_PRIMER_PER_REACTION_UL, PCR_OVERAGE_FACTOR } from '@labflow/shared/constants/pcrAssays';
import { ConflictError, ValidationError, NotFoundError } from '../utils/errors.js';

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

// ----------------------------------------------------------------
// Status Transition Validation
// ----------------------------------------------------------------

export function validateRunStatusTransition(currentStatus: string, targetStatus: string): void {
  if (!isValidRunTransition(currentStatus as any, targetStatus as any)) {
    throw new ConflictError(
      `Cannot transition sequencing run from ${currentStatus} to ${targetStatus}`,
    );
  }
}

export function validatePlateStatusTransition(currentStatus: string, targetStatus: string): void {
  if (!isValidPlateTransition(currentStatus as any, targetStatus as any)) {
    throw new ConflictError(
      `Cannot transition PCR plate from ${currentStatus} to ${targetStatus}`,
    );
  }
}

// ----------------------------------------------------------------
// CSV Parsing — Bulk Well Import
// ----------------------------------------------------------------

export interface ParsedWell {
  position: string;
  sampleId?: string | null;
  wellType?: string;
  dnaConcentrationNgUl?: number | null;
  notes?: string | null;
}

export interface ParsedPCRWell {
  position: string;
  sampleLabel?: string | null;
  assayType?: string | null;
  wellType?: string;
  notes?: string | null;
}

export interface ParsedIndexWell {
  position: string;
  i5Name: string;
  i5Sequence: string;
  i7Name: string;
  i7Sequence: string;
  mergedSequence?: string | null;
}

/**
 * Parses CSV text for bulk DNA plate well import.
 * Expected columns: position, sampleId, wellType, dnaConcentrationNgUl, notes
 * Minimum required: position
 */
export function parseBulkWellCsv(csvText: string): ParsedWell[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new ValidationError('CSV must contain a header row and at least one data row');
  }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const posIdx = header.indexOf('position');
  if (posIdx === -1) {
    throw new ValidationError('CSV must contain a "position" column');
  }

  const sampleIdx = header.indexOf('sampleid') !== -1 ? header.indexOf('sampleid') : header.indexOf('sample_id');
  const typeIdx = header.indexOf('welltype') !== -1 ? header.indexOf('welltype') : header.indexOf('well_type');
  const concIdx = header.indexOf('dnaconcentrationngul') !== -1 ? header.indexOf('dnaconcentrationngul') : header.indexOf('concentration');
  const notesIdx = header.indexOf('notes');

  const wells: ParsedWell[] = [];
  const seenPositions = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',').map((c) => c.trim());
    const rawPos = cols[posIdx];
    const position = normaliseWellPosition(rawPos);

    if (!position) {
      throw new ValidationError(`Invalid well position "${rawPos}" on line ${i + 1}`);
    }

    if (seenPositions.has(position)) {
      throw new ValidationError(`Duplicate well position "${position}" on line ${i + 1}`);
    }
    seenPositions.add(position);

    const conc = concIdx !== -1 && cols[concIdx] ? parseFloat(cols[concIdx]) : null;
    if (conc !== null && isNaN(conc)) {
      throw new ValidationError(`Invalid concentration value "${cols[concIdx]}" on line ${i + 1}`);
    }

    wells.push({
      position,
      sampleId: sampleIdx !== -1 ? cols[sampleIdx] || null : null,
      wellType: typeIdx !== -1 ? (cols[typeIdx] || 'SAMPLE').toUpperCase() : 'SAMPLE',
      dnaConcentrationNgUl: conc,
      notes: notesIdx !== -1 ? cols[notesIdx] || null : null,
    });
  }

  return wells;
}

/**
 * Parses CSV text for bulk PCR plate well import.
 */
export function parseBulkPCRWellCsv(csvText: string): ParsedPCRWell[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new ValidationError('CSV must contain a header row and at least one data row');
  }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const posIdx = header.indexOf('position');
  if (posIdx === -1) {
    throw new ValidationError('CSV must contain a "position" column');
  }

  const labelIdx = header.indexOf('samplelabel') !== -1 ? header.indexOf('samplelabel') : header.indexOf('sample_label');
  const assayIdx = header.indexOf('assaytype') !== -1 ? header.indexOf('assaytype') : header.indexOf('assay_type');
  const typeIdx = header.indexOf('welltype') !== -1 ? header.indexOf('welltype') : header.indexOf('well_type');
  const notesIdx = header.indexOf('notes');

  const wells: ParsedPCRWell[] = [];
  const seenPositions = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',').map((c) => c.trim());
    const rawPos = cols[posIdx];
    const position = normaliseWellPosition(rawPos);

    if (!position) {
      throw new ValidationError(`Invalid well position "${rawPos}" on line ${i + 1}`);
    }

    if (seenPositions.has(position)) {
      throw new ValidationError(`Duplicate well position "${position}" on line ${i + 1}`);
    }
    seenPositions.add(position);

    wells.push({
      position,
      sampleLabel: labelIdx !== -1 ? cols[labelIdx] || null : null,
      assayType: assayIdx !== -1 ? cols[assayIdx] || null : null,
      wellType: typeIdx !== -1 ? (cols[typeIdx] || 'SAMPLE').toUpperCase() : 'SAMPLE',
      notes: notesIdx !== -1 ? cols[notesIdx] || null : null,
    });
  }

  return wells;
}

/**
 * Parses CSV text for bulk index well import.
 */
export function parseBulkIndexWellCsv(csvText: string): ParsedIndexWell[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new ValidationError('CSV must contain a header row and at least one data row');
  }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const posIdx = header.indexOf('position');
  const i5NameIdx = header.indexOf('i5name') !== -1 ? header.indexOf('i5name') : header.indexOf('i5_name');
  const i5SeqIdx = header.indexOf('i5sequence') !== -1 ? header.indexOf('i5sequence') : header.indexOf('i5_sequence');
  const i7NameIdx = header.indexOf('i7name') !== -1 ? header.indexOf('i7name') : header.indexOf('i7_name');
  const i7SeqIdx = header.indexOf('i7sequence') !== -1 ? header.indexOf('i7sequence') : header.indexOf('i7_sequence');

  if (posIdx === -1) throw new ValidationError('CSV must contain a "position" column');
  if (i5NameIdx === -1) throw new ValidationError('CSV must contain an "i5Name" column');
  if (i5SeqIdx === -1) throw new ValidationError('CSV must contain an "i5Sequence" column');
  if (i7NameIdx === -1) throw new ValidationError('CSV must contain an "i7Name" column');
  if (i7SeqIdx === -1) throw new ValidationError('CSV must contain an "i7Sequence" column');

  const wells: ParsedIndexWell[] = [];
  const seenPositions = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',').map((c) => c.trim());
    const rawPos = cols[posIdx];
    const position = normaliseWellPosition(rawPos);

    if (!position) {
      throw new ValidationError(`Invalid well position "${rawPos}" on line ${i + 1}`);
    }
    if (seenPositions.has(position)) {
      throw new ValidationError(`Duplicate well position "${position}" on line ${i + 1}`);
    }
    seenPositions.add(position);

    const i5Seq = cols[i5SeqIdx];
    const i7Seq = cols[i7SeqIdx];

    wells.push({
      position,
      i5Name: cols[i5NameIdx],
      i5Sequence: i5Seq,
      i7Name: cols[i7NameIdx],
      i7Sequence: i7Seq,
      mergedSequence: `${i5Seq}${i7Seq}`,
    });
  }

  return wells;
}

// ----------------------------------------------------------------
// Auto-Populate PCR Plate from DNA Plate
// ----------------------------------------------------------------

export async function autoPopulatePCRFromDNA(
  pcrPlateId: string,
  dnaPlateId: string,
  pcrAssay: string,
  tx: TxClient,
): Promise<number> {
  const dnaWells = await tx.dNAPlateWell.findMany({
    where: { dnaPlateId },
    orderBy: { position: 'asc' },
  });

  if (dnaWells.length === 0) {
    throw new ValidationError('Source DNA plate has no wells');
  }

  const assayInfo = PCR_ASSAY_INFO[pcrAssay as keyof typeof PCR_ASSAY_INFO];
  const suffix = assayInfo ? assayInfo.suffix : '';
  const assayLabel = assayInfo ? assayInfo.label : pcrAssay;

  // Delete existing wells on the PCR plate first
  await tx.pCRPlateWell.deleteMany({ where: { pcrPlateId } });

  const wellData = dnaWells.map((dw) => ({
    pcrPlateId,
    position: dw.position,
    sampleLabel: dw.sampleId ? `${dw.sampleId}${suffix}` : null,
    assayType: assayLabel,
    wellType: dw.wellType,
    pcrResult: 'PCR_PENDING' as const,
    poolingAction: 'POOL_NORMAL' as const,
  }));

  await tx.pCRPlateWell.createMany({ data: wellData });

  return wellData.length;
}

// ----------------------------------------------------------------
// Auto-Assign Indices from IndexPlateReference
// ----------------------------------------------------------------

export async function autoAssignIndices(
  pcrPlateId: string,
  indexPlateRefId: string,
  tx: TxClient,
): Promise<number> {
  const indexWells = await tx.indexWell.findMany({
    where: { indexPlateReferenceId: indexPlateRefId },
  });

  if (indexWells.length === 0) {
    throw new ValidationError('Index plate reference has no wells');
  }

  // Build a position → index well lookup
  const indexMap = new Map(indexWells.map((iw) => [iw.position, iw]));

  const pcrWells = await tx.pCRPlateWell.findMany({
    where: { pcrPlateId },
  });

  let updated = 0;
  for (const well of pcrWells) {
    const indexWell = indexMap.get(well.position);
    if (indexWell) {
      await tx.pCRPlateWell.update({
        where: { id: well.id },
        data: {
          indexI5Sequence: indexWell.i5Sequence,
          indexI7Sequence: indexWell.i7Sequence,
          mergedIndexSequence: indexWell.mergedSequence || `${indexWell.i5Sequence}${indexWell.i7Sequence}`,
        },
      });
      updated++;
    }
  }

  // Also update the PCR plate's indexPlateReferenceId
  await tx.pCRPlate.update({
    where: { id: pcrPlateId },
    data: { indexPlateReferenceId: indexPlateRefId },
  });

  return updated;
}

// ----------------------------------------------------------------
// Index Collision Detection
// ----------------------------------------------------------------

export interface CollisionResult {
  mergedSequence: string;
  wells: Array<{
    pcrPlateId: string;
    plateIdentifier: string;
    position: string;
    sampleLabel: string | null;
  }>;
}

export async function detectIndexCollisions(poolId: string): Promise<CollisionResult[]> {
  // Get all PCR plates assigned to this pool
  const assignments = await prisma.poolPlateAssignment.findMany({
    where: { poolDefinitionId: poolId },
    include: {
      pcrPlate: {
        include: {
          wells: {
            where: {
              poolingAction: { in: ['POOL_NORMAL', 'POOL_DOUBLE'] },
              mergedIndexSequence: { not: null },
            },
          },
        },
      },
    },
  });

  // Collect all wells with their merged index sequences
  const sequenceMap = new Map<string, CollisionResult['wells']>();

  for (const assignment of assignments) {
    const plate = assignment.pcrPlate;
    for (const well of plate.wells) {
      if (!well.mergedIndexSequence) continue;

      const existing = sequenceMap.get(well.mergedIndexSequence) || [];
      existing.push({
        pcrPlateId: plate.id,
        plateIdentifier: plate.plateIdentifier,
        position: well.position,
        sampleLabel: well.sampleLabel,
      });
      sequenceMap.set(well.mergedIndexSequence, existing);
    }
  }

  // Filter to only collisions (2+ wells with same sequence)
  const collisions: CollisionResult[] = [];
  for (const [mergedSequence, wells] of sequenceMap) {
    if (wells.length > 1) {
      collisions.push({ mergedSequence, wells });
    }
  }

  return collisions;
}

// ----------------------------------------------------------------
// Control Placement Validation
// ----------------------------------------------------------------

export interface ControlWarning {
  plateId: string;
  plateIdentifier: string;
  missingControls: string[];
  message: string;
}

export async function validateControlPlacement(poolId: string): Promise<ControlWarning[]> {
  const assignments = await prisma.poolPlateAssignment.findMany({
    where: { poolDefinitionId: poolId },
    include: {
      pcrPlate: {
        include: { wells: true },
      },
    },
  });

  const warnings: ControlWarning[] = [];

  for (const assignment of assignments) {
    const plate = assignment.pcrPlate;
    const wellTypes = new Set(plate.wells.map((w) => w.wellType));
    const missing: string[] = [];

    if (!wellTypes.has('NTC')) missing.push('NTC');
    if (!wellTypes.has('MOCK_CONTROL')) missing.push('MOCK_CONTROL');

    if (missing.length > 0) {
      warnings.push({
        plateId: plate.id,
        plateIdentifier: plate.plateIdentifier,
        missingControls: missing,
        message: `PCR plate "${plate.plateIdentifier}" is missing: ${missing.join(', ')}`,
      });
    }
  }

  return warnings;
}

// ----------------------------------------------------------------
// Reagent Requirement Calculator
// ----------------------------------------------------------------

export interface ReagentRequirement {
  reagentName: string;
  quantity: number;
  unit: string;
}

export function calculateReagentRequirements(
  sampleCount: number,
  plateCount: number,
): ReagentRequirement[] {
  return DEFAULT_REAGENT_FORMULAS.map((formula) => ({
    reagentName: formula.reagentName,
    quantity: Math.ceil(sampleCount * formula.perSampleUl * formula.overageFactor) / 1000, // Convert µL to mL
    unit: formula.unit === 'mg' ? 'mg' : 'mL',
  }));
}

export function calculatePCRReagentRequirements(
  reactionCount: number,
): ReagentRequirement[] {
  const totalWithOverage = Math.ceil(reactionCount * PCR_OVERAGE_FACTOR);
  return [
    {
      reagentName: 'PCR Master Mix',
      quantity: totalWithOverage * PCR_MASTER_MIX_PER_REACTION_UL / 1000,
      unit: 'mL',
    },
    {
      reagentName: 'Forward Primer',
      quantity: totalWithOverage * PCR_PRIMER_PER_REACTION_UL / 1000,
      unit: 'mL',
    },
    {
      reagentName: 'Reverse Primer',
      quantity: totalWithOverage * PCR_PRIMER_PER_REACTION_UL / 1000,
      unit: 'mL',
    },
  ];
}

// ----------------------------------------------------------------
// Plate Map Generation
// ----------------------------------------------------------------

export interface PlateMapCell {
  position: string;
  row: string;
  column: string;
  data: Record<string, unknown> | null;
}

export async function getDNAPlateMap(plateId: string): Promise<PlateMapCell[][]> {
  const wells = await prisma.dNAPlateWell.findMany({
    where: { dnaPlateId: plateId },
  });

  const wellMap = new Map(wells.map((w) => [w.position, w]));

  return ROWS.map((row) =>
    COLUMNS.map((col) => {
      const position = `${row}${col}`;
      const well = wellMap.get(position);
      return {
        position,
        row,
        column: col,
        data: well
          ? {
              id: well.id,
              sampleId: well.sampleId,
              wellType: well.wellType,
              dnaConcentrationNgUl: well.dnaConcentrationNgUl
                ? Number(well.dnaConcentrationNgUl)
                : null,
              notes: well.notes,
            }
          : null,
      };
    }),
  );
}

export async function getPCRPlateMap(plateId: string): Promise<PlateMapCell[][]> {
  const wells = await prisma.pCRPlateWell.findMany({
    where: { pcrPlateId: plateId },
  });

  const wellMap = new Map(wells.map((w) => [w.position, w]));

  return ROWS.map((row) =>
    COLUMNS.map((col) => {
      const position = `${row}${col}`;
      const well = wellMap.get(position);
      return {
        position,
        row,
        column: col,
        data: well
          ? {
              id: well.id,
              sampleLabel: well.sampleLabel,
              assayType: well.assayType,
              wellType: well.wellType,
              indexI5Sequence: well.indexI5Sequence,
              indexI7Sequence: well.indexI7Sequence,
              mergedIndexSequence: well.mergedIndexSequence,
              pcrResult: well.pcrResult,
              poolingAction: well.poolingAction,
              notes: well.notes,
            }
          : null,
      };
    }),
  );
}

// ----------------------------------------------------------------
// Opentrons CSV Export
// ----------------------------------------------------------------

export async function generateOpentronsCsv(
  poolId: string,
  sourceSlot: string = '1',
  destSlot: string = '2',
  volumeUl: number = 5,
): Promise<string> {
  const assignments = await prisma.poolPlateAssignment.findMany({
    where: { poolDefinitionId: poolId },
    include: {
      pcrPlate: {
        include: {
          wells: {
            where: {
              poolingAction: { in: ['POOL_NORMAL', 'POOL_DOUBLE'] },
            },
            orderBy: { position: 'asc' },
          },
        },
      },
    },
  });

  const header = [
    'New Tip',
    'Source Labware',
    'Source Slot',
    'Source Well',
    'Source Aspiration Height',
    'Dest Labware',
    'Dest Slot',
    'Dest Well',
    'Dest Dispense Height',
    'Volume (in ul)',
  ].join(',');

  const rows: string[] = [header];
  let destWellIndex = 0;

  for (const assignment of assignments) {
    const plate = assignment.pcrPlate;
    for (const well of plate.wells) {
      const vol = well.poolingAction === 'POOL_DOUBLE' ? volumeUl * 2 : volumeUl;
      const destWell = ALL_WELL_POSITIONS[destWellIndex % ALL_WELL_POSITIONS.length];
      rows.push([
        'Yes',
        plate.plateIdentifier,
        sourceSlot,
        well.position,
        '1',
        'Destination',
        destSlot,
        destWell,
        '1',
        String(vol),
      ].join(','));
      destWellIndex++;
    }
  }

  return rows.join('\n');
}

// ----------------------------------------------------------------
// Illumina Sample Sheet Export
// ----------------------------------------------------------------

export async function generateIlluminaSampleSheet(runId: string): Promise<string> {
  const run = await prisma.sequencingRun.findUnique({
    where: { id: runId },
    include: {
      pcrPlates: {
        include: {
          wells: {
            where: {
              poolingAction: { in: ['POOL_NORMAL', 'POOL_DOUBLE'] },
              wellType: 'SAMPLE',
            },
            orderBy: { position: 'asc' },
          },
        },
      },
    },
  });

  if (!run) {
    throw new NotFoundError('SequencingRun', runId);
  }

  const lines: string[] = [];

  // [Header] section
  lines.push('[Header]');
  lines.push(`IEMFileVersion,5`);
  lines.push(`Investigator Name,LabFlow`);
  lines.push(`Experiment Name,${run.runIdentifier}`);
  lines.push(`Date,${new Date().toISOString().split('T')[0]}`);
  lines.push(`Workflow,GenerateFASTQ`);
  lines.push(`Application,FASTQ Only`);
  lines.push(`Chemistry,Amplicon`);
  lines.push('');

  // [Reads] section
  lines.push('[Reads]');
  lines.push('301');
  lines.push('301');
  lines.push('');

  // [Settings] section
  lines.push('[Settings]');
  lines.push('ReverseComplement,0');
  lines.push('');

  // [Data] section
  lines.push('[Data]');
  lines.push('Sample_ID,Sample_Name,Sample_Plate,Sample_Well,I7_Index_ID,index,I5_Index_ID,index2,Sample_Project,Description');

  for (const plate of run.pcrPlates) {
    for (const well of plate.wells) {
      lines.push([
        well.sampleLabel || `${plate.plateIdentifier}_${well.position}`,
        well.sampleLabel || '',
        plate.plateIdentifier,
        well.position,
        '', // I7_Index_ID
        well.indexI7Sequence || '',
        '', // I5_Index_ID
        well.indexI5Sequence || '',
        run.runIdentifier,
        well.assayType || '',
      ].join(','));
    }
  }

  return lines.join('\n');
}

// ----------------------------------------------------------------
// S3 Upload Helper (follows reportProcessor.ts pattern)
// ----------------------------------------------------------------

export async function uploadToS3(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
  const bucket = process.env.S3_BUCKET || 'labflow';
  const accessKey = process.env.S3_ACCESS_KEY || 'minioadmin';
  const secretKey = process.env.S3_SECRET_KEY || 'minioadmin';

  const url = `${endpoint}/${bucket}/${key}`;
  const dateStr = new Date().toUTCString();

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.byteLength),
      Date: dateStr,
      Authorization: `AWS ${accessKey}:${secretKey}`,
    },
    body: buffer,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`S3 upload failed (${response.status}): ${body}`);
  }

  return key;
}
