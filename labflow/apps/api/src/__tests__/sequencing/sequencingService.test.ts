import { describe, it, expect } from 'vitest';
import {
  parseBulkWellCsv,
  parseBulkPCRWellCsv,
  parseBulkIndexWellCsv,
  validateRunStatusTransition,
  validatePlateStatusTransition,
  calculateReagentRequirements,
  calculatePCRReagentRequirements,
} from '../../services/sequencingService.js';
import { ConflictError, ValidationError } from '../../utils/errors.js';

// ----------------------------------------------------------------
// parseBulkWellCsv
// ----------------------------------------------------------------

describe('parseBulkWellCsv', () => {
  it('parses valid CSV with all columns', () => {
    const csv = [
      'position,sampleId,wellType,dnaConcentrationNgUl,notes',
      'A01,SAMP-001,SAMPLE,12.5,first sample',
      'A02,SAMP-002,NTC,0,negative control',
    ].join('\n');

    const result = parseBulkWellCsv(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      position: 'A01',
      sampleId: 'SAMP-001',
      wellType: 'SAMPLE',
      dnaConcentrationNgUl: 12.5,
      notes: 'first sample',
    });
    expect(result[1]).toEqual({
      position: 'A02',
      sampleId: 'SAMP-002',
      wellType: 'NTC',
      dnaConcentrationNgUl: 0,
      notes: 'negative control',
    });
  });

  it('parses minimal CSV with only position column', () => {
    const csv = ['position', 'A01', 'B03'].join('\n');

    const result = parseBulkWellCsv(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      position: 'A01',
      sampleId: null,
      wellType: 'SAMPLE',
      dnaConcentrationNgUl: null,
      notes: null,
    });
    expect(result[1]).toEqual({
      position: 'B03',
      sampleId: null,
      wellType: 'SAMPLE',
      dnaConcentrationNgUl: null,
      notes: null,
    });
  });

  it('throws on missing position column', () => {
    const csv = ['sampleId,wellType', 'SAMP-001,SAMPLE'].join('\n');

    expect(() => parseBulkWellCsv(csv)).toThrow(ValidationError);
    expect(() => parseBulkWellCsv(csv)).toThrow('CSV must contain a "position" column');
  });

  it('throws on invalid well position (e.g., "Z99")', () => {
    const csv = ['position', 'Z99'].join('\n');

    expect(() => parseBulkWellCsv(csv)).toThrow(ValidationError);
    expect(() => parseBulkWellCsv(csv)).toThrow('Invalid well position "Z99"');
  });

  it('throws on duplicate positions', () => {
    const csv = ['position', 'A01', 'A01'].join('\n');

    expect(() => parseBulkWellCsv(csv)).toThrow(ValidationError);
    expect(() => parseBulkWellCsv(csv)).toThrow('Duplicate well position "A01"');
  });

  it('throws on CSV with only header row', () => {
    const csv = 'position,sampleId';

    expect(() => parseBulkWellCsv(csv)).toThrow(ValidationError);
    expect(() => parseBulkWellCsv(csv)).toThrow(
      'CSV must contain a header row and at least one data row',
    );
  });

  it('normalizes positions (e.g., "A1" -> "A01")', () => {
    const csv = ['position', 'A1', 'B3', 'H12'].join('\n');

    const result = parseBulkWellCsv(csv);

    expect(result[0].position).toBe('A01');
    expect(result[1].position).toBe('B03');
    expect(result[2].position).toBe('H12');
  });

  it('parses concentration values as numbers', () => {
    const csv = [
      'position,dnaConcentrationNgUl',
      'A01,42.7',
      'A02,0.5',
      'A03,100',
    ].join('\n');

    const result = parseBulkWellCsv(csv);

    expect(result[0].dnaConcentrationNgUl).toBe(42.7);
    expect(typeof result[0].dnaConcentrationNgUl).toBe('number');
    expect(result[1].dnaConcentrationNgUl).toBe(0.5);
    expect(result[2].dnaConcentrationNgUl).toBe(100);
  });
});

// ----------------------------------------------------------------
// parseBulkPCRWellCsv
// ----------------------------------------------------------------

describe('parseBulkPCRWellCsv', () => {
  it('parses valid CSV with all columns', () => {
    const csv = [
      'position,sampleLabel,assayType,wellType,notes',
      'A01,SAMP-001_16s,16S,SAMPLE,test note',
      'A02,SAMP-002_16s,16S,NTC,control',
    ].join('\n');

    const result = parseBulkPCRWellCsv(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      position: 'A01',
      sampleLabel: 'SAMP-001_16s',
      assayType: '16S',
      wellType: 'SAMPLE',
      notes: 'test note',
    });
    expect(result[1]).toEqual({
      position: 'A02',
      sampleLabel: 'SAMP-002_16s',
      assayType: '16S',
      wellType: 'NTC',
      notes: 'control',
    });
  });

  it('defaults wellType to SAMPLE when column is absent', () => {
    const csv = ['position,sampleLabel', 'A01,SAMP-001'].join('\n');

    const result = parseBulkPCRWellCsv(csv);

    expect(result[0].wellType).toBe('SAMPLE');
  });

  it('throws on missing position column', () => {
    const csv = ['sampleLabel,assayType', 'SAMP-001,16S'].join('\n');

    expect(() => parseBulkPCRWellCsv(csv)).toThrow(ValidationError);
    expect(() => parseBulkPCRWellCsv(csv)).toThrow('CSV must contain a "position" column');
  });
});

// ----------------------------------------------------------------
// parseBulkIndexWellCsv
// ----------------------------------------------------------------

describe('parseBulkIndexWellCsv', () => {
  it('parses valid CSV with all required columns', () => {
    const csv = [
      'position,i5Name,i5Sequence,i7Name,i7Sequence',
      'A01,i5_idx1,ATCGATCG,i7_idx1,GCTAGCTA',
      'A02,i5_idx2,TTAACCGG,i7_idx2,CCAATTGG',
    ].join('\n');

    const result = parseBulkIndexWellCsv(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      position: 'A01',
      i5Name: 'i5_idx1',
      i5Sequence: 'ATCGATCG',
      i7Name: 'i7_idx1',
      i7Sequence: 'GCTAGCTA',
      mergedSequence: 'ATCGATCGGCTAGCTA',
    });
    expect(result[1]).toEqual({
      position: 'A02',
      i5Name: 'i5_idx2',
      i5Sequence: 'TTAACCGG',
      i7Name: 'i7_idx2',
      i7Sequence: 'CCAATTGG',
      mergedSequence: 'TTAACCGGCCAATTGG',
    });
  });

  it('auto-generates mergedSequence from i5 + i7 sequences', () => {
    const csv = [
      'position,i5Name,i5Sequence,i7Name,i7Sequence',
      'A01,idx_a,AAAA,idx_b,TTTT',
    ].join('\n');

    const result = parseBulkIndexWellCsv(csv);

    expect(result[0].mergedSequence).toBe('AAAATTTT');
  });

  it('throws on missing required column (i5Name)', () => {
    const csv = [
      'position,i5Sequence,i7Name,i7Sequence',
      'A01,ATCGATCG,i7_idx1,GCTAGCTA',
    ].join('\n');

    expect(() => parseBulkIndexWellCsv(csv)).toThrow(ValidationError);
    expect(() => parseBulkIndexWellCsv(csv)).toThrow('CSV must contain an "i5Name" column');
  });

  it('throws on missing required column (i7Sequence)', () => {
    const csv = [
      'position,i5Name,i5Sequence,i7Name',
      'A01,i5_idx1,ATCGATCG,i7_idx1',
    ].join('\n');

    expect(() => parseBulkIndexWellCsv(csv)).toThrow(ValidationError);
    expect(() => parseBulkIndexWellCsv(csv)).toThrow('CSV must contain an "i7Sequence" column');
  });

  it('throws on missing position column', () => {
    const csv = [
      'i5Name,i5Sequence,i7Name,i7Sequence',
      'i5_idx1,ATCGATCG,i7_idx1,GCTAGCTA',
    ].join('\n');

    expect(() => parseBulkIndexWellCsv(csv)).toThrow(ValidationError);
    expect(() => parseBulkIndexWellCsv(csv)).toThrow('CSV must contain a "position" column');
  });
});

// ----------------------------------------------------------------
// validateRunStatusTransition
// ----------------------------------------------------------------

describe('validateRunStatusTransition', () => {
  it('allows valid transition: SETUP -> DNA_EXTRACTED', () => {
    expect(() => validateRunStatusTransition('SETUP', 'DNA_EXTRACTED')).not.toThrow();
  });

  it('allows valid transition: PCR_IN_PROGRESS -> POOLED', () => {
    expect(() => validateRunStatusTransition('PCR_IN_PROGRESS', 'POOLED')).not.toThrow();
  });

  it('throws ConflictError for invalid transition: SETUP -> POOLED', () => {
    expect(() => validateRunStatusTransition('SETUP', 'POOLED')).toThrow(ConflictError);
    expect(() => validateRunStatusTransition('SETUP', 'POOLED')).toThrow(
      'Cannot transition sequencing run from SETUP to POOLED',
    );
  });

  it('throws ConflictError for invalid transition: SEQUENCED -> SETUP', () => {
    expect(() => validateRunStatusTransition('SEQUENCED', 'SETUP')).toThrow(ConflictError);
    expect(() => validateRunStatusTransition('SEQUENCED', 'SETUP')).toThrow(
      'Cannot transition sequencing run from SEQUENCED to SETUP',
    );
  });
});

// ----------------------------------------------------------------
// validatePlateStatusTransition
// ----------------------------------------------------------------

describe('validatePlateStatusTransition', () => {
  it('allows valid transition: PLATE_SETUP -> PCR_COMPLETE', () => {
    expect(() =>
      validatePlateStatusTransition('PLATE_SETUP', 'PCR_COMPLETE'),
    ).not.toThrow();
  });

  it('allows valid transition: GEL_CHECKED -> POOLING_ASSIGNED', () => {
    expect(() =>
      validatePlateStatusTransition('GEL_CHECKED', 'POOLING_ASSIGNED'),
    ).not.toThrow();
  });

  it('throws ConflictError for invalid transition: PLATE_SETUP -> PLATE_DONE', () => {
    expect(() =>
      validatePlateStatusTransition('PLATE_SETUP', 'PLATE_DONE'),
    ).toThrow(ConflictError);
    expect(() =>
      validatePlateStatusTransition('PLATE_SETUP', 'PLATE_DONE'),
    ).toThrow('Cannot transition PCR plate from PLATE_SETUP to PLATE_DONE');
  });
});

// ----------------------------------------------------------------
// calculateReagentRequirements
// ----------------------------------------------------------------

describe('calculateReagentRequirements', () => {
  it('returns an array of ReagentRequirement objects', () => {
    const result = calculateReagentRequirements(96, 1);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    for (const req of result) {
      expect(req).toHaveProperty('reagentName');
      expect(req).toHaveProperty('quantity');
      expect(req).toHaveProperty('unit');
      expect(typeof req.reagentName).toBe('string');
      expect(typeof req.quantity).toBe('number');
      expect(typeof req.unit).toBe('string');
    }
  });

  it('each requirement has reagentName, quantity, and unit', () => {
    const result = calculateReagentRequirements(10, 1);

    for (const req of result) {
      expect(req.reagentName).toBeTruthy();
      expect(req.quantity).toBeGreaterThan(0);
      expect(['mL', 'mg']).toContain(req.unit);
    }
  });

  it('quantity scales with sampleCount', () => {
    const small = calculateReagentRequirements(10, 1);
    const large = calculateReagentRequirements(100, 1);

    // For every reagent, the quantity at 100 samples should be greater
    // than the quantity at 10 samples
    for (let i = 0; i < small.length; i++) {
      expect(large[i].quantity).toBeGreaterThan(small[i].quantity);
      expect(large[i].reagentName).toBe(small[i].reagentName);
    }
  });
});

// ----------------------------------------------------------------
// calculatePCRReagentRequirements
// ----------------------------------------------------------------

describe('calculatePCRReagentRequirements', () => {
  it('returns PCR Master Mix, Forward Primer, and Reverse Primer', () => {
    const result = calculatePCRReagentRequirements(96);

    expect(result).toHaveLength(3);
    expect(result[0].reagentName).toBe('PCR Master Mix');
    expect(result[1].reagentName).toBe('Forward Primer');
    expect(result[2].reagentName).toBe('Reverse Primer');
  });

  it('all requirements have mL as unit', () => {
    const result = calculatePCRReagentRequirements(48);

    for (const req of result) {
      expect(req.unit).toBe('mL');
    }
  });

  it('quantity scales with reaction count', () => {
    const small = calculatePCRReagentRequirements(10);
    const large = calculatePCRReagentRequirements(100);

    for (let i = 0; i < small.length; i++) {
      expect(large[i].quantity).toBeGreaterThan(small[i].quantity);
    }
  });
});
