import { describe, it, expect } from 'vitest';

import {
  PcrAssay,
  PCR_ASSAY_INFO,
  ASSAY_BY_SUFFIX,
  getAssayLabel,
  getAssaySuffix,
  PcrResult,
  PoolingAction,
  WellType,
  ExtractionMethod,
  DEFAULT_REAGENT_FORMULAS,
  PCR_MASTER_MIX_PER_REACTION_UL,
  PCR_PRIMER_PER_REACTION_UL,
  PCR_TEMPLATE_PER_REACTION_UL,
  PCR_OVERAGE_FACTOR,
} from '@labflow/shared/constants/pcrAssays';

// ----------------------------------------------------------------
// PcrAssay enum
// ----------------------------------------------------------------
describe('PcrAssay', () => {
  it('has exactly 4 assay values', () => {
    const keys = Object.keys(PcrAssay);
    expect(keys).toHaveLength(4);
  });

  it.each([
    ['ASSAY_16S', 'ASSAY_16S'],
    ['ASSAY_EUK2', 'ASSAY_EUK2'],
    ['ASSAY_ITS', 'ASSAY_ITS'],
    ['ASSAY_COI', 'ASSAY_COI'],
  ])('contains %s with value "%s"', (key, value) => {
    expect(PcrAssay[key as keyof typeof PcrAssay]).toBe(value);
  });
});

// ----------------------------------------------------------------
// PCR_ASSAY_INFO
// ----------------------------------------------------------------
describe('PCR_ASSAY_INFO', () => {
  it('has an entry for every PcrAssay value', () => {
    for (const assay of Object.values(PcrAssay)) {
      expect(PCR_ASSAY_INFO).toHaveProperty(assay);
    }
  });

  it('each entry contains value, label, displayName, suffix, and targetGene', () => {
    for (const info of Object.values(PCR_ASSAY_INFO)) {
      expect(info).toHaveProperty('value');
      expect(info).toHaveProperty('label');
      expect(info).toHaveProperty('displayName');
      expect(info).toHaveProperty('suffix');
      expect(info).toHaveProperty('targetGene');
    }
  });

  it('maps ASSAY_16S to suffix "_16s"', () => {
    expect(PCR_ASSAY_INFO.ASSAY_16S.suffix).toBe('_16s');
  });

  it('maps ASSAY_EUK2 to suffix "_EUK2"', () => {
    expect(PCR_ASSAY_INFO.ASSAY_EUK2.suffix).toBe('_EUK2');
  });

  it('maps ASSAY_ITS to suffix "_ITS"', () => {
    expect(PCR_ASSAY_INFO.ASSAY_ITS.suffix).toBe('_ITS');
  });

  it('maps ASSAY_COI to suffix "_COI"', () => {
    expect(PCR_ASSAY_INFO.ASSAY_COI.suffix).toBe('_COI');
  });

  it('maps ASSAY_16S to label "16S"', () => {
    expect(PCR_ASSAY_INFO.ASSAY_16S.label).toBe('16S');
  });

  it('maps ASSAY_EUK2 to label "EUK2"', () => {
    expect(PCR_ASSAY_INFO.ASSAY_EUK2.label).toBe('EUK2');
  });

  it('maps ASSAY_ITS to label "ITS"', () => {
    expect(PCR_ASSAY_INFO.ASSAY_ITS.label).toBe('ITS');
  });

  it('maps ASSAY_COI to label "COI"', () => {
    expect(PCR_ASSAY_INFO.ASSAY_COI.label).toBe('COI');
  });
});

// ----------------------------------------------------------------
// ASSAY_BY_SUFFIX (reverse lookup)
// ----------------------------------------------------------------
describe('ASSAY_BY_SUFFIX', () => {
  it('maps "_16s" back to ASSAY_16S', () => {
    expect(ASSAY_BY_SUFFIX['_16s']).toBe(PcrAssay.ASSAY_16S);
  });

  it('maps "_EUK2" back to ASSAY_EUK2', () => {
    expect(ASSAY_BY_SUFFIX['_EUK2']).toBe(PcrAssay.ASSAY_EUK2);
  });

  it('maps "_ITS" back to ASSAY_ITS', () => {
    expect(ASSAY_BY_SUFFIX['_ITS']).toBe(PcrAssay.ASSAY_ITS);
  });

  it('maps "_COI" back to ASSAY_COI', () => {
    expect(ASSAY_BY_SUFFIX['_COI']).toBe(PcrAssay.ASSAY_COI);
  });
});

// ----------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------
describe('getAssayLabel', () => {
  it('returns the display label for each assay', () => {
    expect(getAssayLabel(PcrAssay.ASSAY_16S)).toBe('16S');
    expect(getAssayLabel(PcrAssay.ASSAY_EUK2)).toBe('EUK2');
    expect(getAssayLabel(PcrAssay.ASSAY_ITS)).toBe('ITS');
    expect(getAssayLabel(PcrAssay.ASSAY_COI)).toBe('COI');
  });
});

describe('getAssaySuffix', () => {
  it('returns the suffix string for each assay', () => {
    expect(getAssaySuffix(PcrAssay.ASSAY_16S)).toBe('_16s');
    expect(getAssaySuffix(PcrAssay.ASSAY_EUK2)).toBe('_EUK2');
    expect(getAssaySuffix(PcrAssay.ASSAY_ITS)).toBe('_ITS');
    expect(getAssaySuffix(PcrAssay.ASSAY_COI)).toBe('_COI');
  });
});

// ----------------------------------------------------------------
// PcrResult enum
// ----------------------------------------------------------------
describe('PcrResult', () => {
  it('has exactly 4 values', () => {
    expect(Object.keys(PcrResult)).toHaveLength(4);
  });

  it('contains PENDING with value "PCR_PENDING"', () => {
    expect(PcrResult.PENDING).toBe('PCR_PENDING');
  });

  it('contains PASS with value "PASS"', () => {
    expect(PcrResult.PASS).toBe('PASS');
  });

  it('contains FAIL with value "FAIL"', () => {
    expect(PcrResult.FAIL).toBe('FAIL');
  });

  it('contains BORDERLINE with value "BORDERLINE"', () => {
    expect(PcrResult.BORDERLINE).toBe('BORDERLINE');
  });
});

// ----------------------------------------------------------------
// PoolingAction enum
// ----------------------------------------------------------------
describe('PoolingAction', () => {
  it('has exactly 4 values', () => {
    expect(Object.keys(PoolingAction)).toHaveLength(4);
  });

  it('contains POOL_NORMAL with value "POOL_NORMAL"', () => {
    expect(PoolingAction.POOL_NORMAL).toBe('POOL_NORMAL');
  });

  it('contains POOL_DOUBLE with value "POOL_DOUBLE"', () => {
    expect(PoolingAction.POOL_DOUBLE).toBe('POOL_DOUBLE');
  });

  it('contains DO_NOT_POOL with value "DO_NOT_POOL"', () => {
    expect(PoolingAction.DO_NOT_POOL).toBe('DO_NOT_POOL');
  });

  it('contains SKIP with value "POOL_SKIP"', () => {
    expect(PoolingAction.SKIP).toBe('POOL_SKIP');
  });
});

// ----------------------------------------------------------------
// WellType enum
// ----------------------------------------------------------------
describe('WellType', () => {
  it('has exactly 6 values', () => {
    expect(Object.keys(WellType)).toHaveLength(6);
  });

  it.each([
    ['SAMPLE', 'SAMPLE'],
    ['MOCK_CONTROL', 'MOCK_CONTROL'],
    ['EXTRACTION_CONTROL', 'EXTRACTION_CONTROL'],
    ['NTC', 'NTC'],
    ['POSITIVE_CONTROL', 'POSITIVE_CONTROL'],
    ['EMPTY', 'EMPTY'],
  ])('contains %s with value "%s"', (key, value) => {
    expect(WellType[key as keyof typeof WellType]).toBe(value);
  });
});

// ----------------------------------------------------------------
// ExtractionMethod enum
// ----------------------------------------------------------------
describe('ExtractionMethod', () => {
  it('has exactly 3 values', () => {
    expect(Object.keys(ExtractionMethod)).toHaveLength(3);
  });

  it('contains AUTOMATED with value "AUTOMATED"', () => {
    expect(ExtractionMethod.AUTOMATED).toBe('AUTOMATED');
  });

  it('contains MANUAL with value "MANUAL"', () => {
    expect(ExtractionMethod.MANUAL).toBe('MANUAL');
  });

  it('contains OTHER with value "OTHER"', () => {
    expect(ExtractionMethod.OTHER).toBe('OTHER');
  });
});

// ----------------------------------------------------------------
// DEFAULT_REAGENT_FORMULAS
// ----------------------------------------------------------------
describe('DEFAULT_REAGENT_FORMULAS', () => {
  it('is an array with at least one entry', () => {
    expect(Array.isArray(DEFAULT_REAGENT_FORMULAS)).toBe(true);
    expect(DEFAULT_REAGENT_FORMULAS.length).toBeGreaterThan(0);
  });

  it('contains 8 reagent entries', () => {
    expect(DEFAULT_REAGENT_FORMULAS).toHaveLength(8);
  });

  it('each entry has reagentName, perSampleUl, overageFactor, and unit', () => {
    for (const formula of DEFAULT_REAGENT_FORMULAS) {
      expect(formula).toHaveProperty('reagentName');
      expect(formula).toHaveProperty('perSampleUl');
      expect(formula).toHaveProperty('overageFactor');
      expect(formula).toHaveProperty('unit');

      expect(typeof formula.reagentName).toBe('string');
      expect(formula.reagentName.length).toBeGreaterThan(0);

      expect(typeof formula.perSampleUl).toBe('number');
      expect(formula.perSampleUl).toBeGreaterThan(0);

      expect(typeof formula.overageFactor).toBe('number');
      expect(formula.overageFactor).toBeGreaterThanOrEqual(1);

      expect(typeof formula.unit).toBe('string');
      expect(formula.unit.length).toBeGreaterThan(0);
    }
  });

  it('includes known reagents', () => {
    const names = DEFAULT_REAGENT_FORMULAS.map((f) => f.reagentName);
    expect(names).toContain('Lysis Solution');
    expect(names).toContain('80% Ethanol');
    expect(names).toContain('Concentrated SPRI Beads');
  });
});

// ----------------------------------------------------------------
// PCR volume constants
// ----------------------------------------------------------------
describe('PCR volume constants', () => {
  it('PCR_MASTER_MIX_PER_REACTION_UL is a positive number', () => {
    expect(typeof PCR_MASTER_MIX_PER_REACTION_UL).toBe('number');
    expect(PCR_MASTER_MIX_PER_REACTION_UL).toBeGreaterThan(0);
  });

  it('PCR_MASTER_MIX_PER_REACTION_UL equals 25', () => {
    expect(PCR_MASTER_MIX_PER_REACTION_UL).toBe(25);
  });

  it('PCR_PRIMER_PER_REACTION_UL is a positive number', () => {
    expect(typeof PCR_PRIMER_PER_REACTION_UL).toBe('number');
    expect(PCR_PRIMER_PER_REACTION_UL).toBeGreaterThan(0);
  });

  it('PCR_PRIMER_PER_REACTION_UL equals 2.5', () => {
    expect(PCR_PRIMER_PER_REACTION_UL).toBe(2.5);
  });

  it('PCR_TEMPLATE_PER_REACTION_UL is a positive number', () => {
    expect(typeof PCR_TEMPLATE_PER_REACTION_UL).toBe('number');
    expect(PCR_TEMPLATE_PER_REACTION_UL).toBeGreaterThan(0);
  });

  it('PCR_OVERAGE_FACTOR is greater than or equal to 1', () => {
    expect(typeof PCR_OVERAGE_FACTOR).toBe('number');
    expect(PCR_OVERAGE_FACTOR).toBeGreaterThanOrEqual(1);
  });
});
