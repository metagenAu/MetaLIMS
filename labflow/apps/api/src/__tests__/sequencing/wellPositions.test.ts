import { describe, it, expect } from 'vitest';

import {
  ROWS,
  COLUMNS,
  ALL_WELL_POSITIONS,
  WELL_POSITION_REGEX,
  isValidWellPosition,
  wellPositionToIndex,
  indexToWellPosition,
  normaliseWellPosition,
  generateEmptyPlateGrid,
} from '@labflow/shared/constants/wellPositions';

// ============================================================
// ROWS
// ============================================================
describe('ROWS', () => {
  it('has 8 entries A through H', () => {
    expect(ROWS).toHaveLength(8);
    expect([...ROWS]).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  });
});

// ============================================================
// COLUMNS
// ============================================================
describe('COLUMNS', () => {
  it('has 12 zero-padded entries 01 through 12', () => {
    expect(COLUMNS).toHaveLength(12);
    expect([...COLUMNS]).toEqual([
      '01', '02', '03', '04', '05', '06',
      '07', '08', '09', '10', '11', '12',
    ]);
  });
});

// ============================================================
// ALL_WELL_POSITIONS
// ============================================================
describe('ALL_WELL_POSITIONS', () => {
  it('has 96 entries', () => {
    expect(ALL_WELL_POSITIONS).toHaveLength(96);
  });

  it('starts with A01', () => {
    expect(ALL_WELL_POSITIONS[0]).toBe('A01');
  });

  it('ends with H12', () => {
    expect(ALL_WELL_POSITIONS[95]).toBe('H12');
  });
});

// ============================================================
// WELL_POSITION_REGEX
// ============================================================
describe('WELL_POSITION_REGEX', () => {
  it('matches valid well positions', () => {
    expect(WELL_POSITION_REGEX.test('A01')).toBe(true);
    expect(WELL_POSITION_REGEX.test('H12')).toBe(true);
  });

  it('does not match non-zero-padded single-digit columns', () => {
    expect(WELL_POSITION_REGEX.test('A1')).toBe(false);
  });

  it('does not match rows beyond H', () => {
    expect(WELL_POSITION_REGEX.test('I01')).toBe(false);
  });

  it('does not match columns beyond 12', () => {
    expect(WELL_POSITION_REGEX.test('A13')).toBe(false);
  });
});

// ============================================================
// isValidWellPosition
// ============================================================
describe('isValidWellPosition', () => {
  it('returns true for A01', () => {
    expect(isValidWellPosition('A01')).toBe(true);
  });

  it('returns true for H12', () => {
    expect(isValidWellPosition('H12')).toBe(true);
  });

  it('returns false for non-zero-padded column (A1)', () => {
    expect(isValidWellPosition('A1')).toBe(false);
  });

  it('returns false for row beyond H (I01)', () => {
    expect(isValidWellPosition('I01')).toBe(false);
  });

  it('returns false for column beyond 12 (A13)', () => {
    expect(isValidWellPosition('A13')).toBe(false);
  });

  it('returns false for completely invalid position (Z99)', () => {
    expect(isValidWellPosition('Z99')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidWellPosition('')).toBe(false);
  });
});

// ============================================================
// wellPositionToIndex
// ============================================================
describe('wellPositionToIndex', () => {
  it('returns 0 for A01', () => {
    expect(wellPositionToIndex('A01')).toBe(0);
  });

  it('returns 11 for A12', () => {
    expect(wellPositionToIndex('A12')).toBe(11);
  });

  it('returns 12 for B01', () => {
    expect(wellPositionToIndex('B01')).toBe(12);
  });

  it('returns 95 for H12', () => {
    expect(wellPositionToIndex('H12')).toBe(95);
  });
});

// ============================================================
// indexToWellPosition
// ============================================================
describe('indexToWellPosition', () => {
  it('returns A01 for index 0', () => {
    expect(indexToWellPosition(0)).toBe('A01');
  });

  it('returns A12 for index 11', () => {
    expect(indexToWellPosition(11)).toBe('A12');
  });

  it('returns B01 for index 12', () => {
    expect(indexToWellPosition(12)).toBe('B01');
  });

  it('returns H12 for index 95', () => {
    expect(indexToWellPosition(95)).toBe('H12');
  });

  it('returns null for out-of-range index 96', () => {
    expect(indexToWellPosition(96)).toBeNull();
  });
});

// ============================================================
// normaliseWellPosition
// ============================================================
describe('normaliseWellPosition', () => {
  it('pads single-digit column: A1 -> A01', () => {
    expect(normaliseWellPosition('A1')).toBe('A01');
  });

  it('uppercases lowercase input: a01 -> A01', () => {
    expect(normaliseWellPosition('a01')).toBe('A01');
  });

  it('returns already-valid position unchanged: H12 -> H12', () => {
    expect(normaliseWellPosition('H12')).toBe('H12');
  });

  it('returns null for invalid row: Z1', () => {
    expect(normaliseWellPosition('Z1')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normaliseWellPosition('')).toBeNull();
  });
});

// ============================================================
// generateEmptyPlateGrid
// ============================================================
describe('generateEmptyPlateGrid', () => {
  const grid = generateEmptyPlateGrid();

  it('returns 8 rows', () => {
    expect(grid).toHaveLength(8);
  });

  it('each row has 12 cells', () => {
    for (const row of grid) {
      expect(row).toHaveLength(12);
    }
  });

  it('each cell has a position string and data set to null', () => {
    for (const row of grid) {
      for (const cell of row) {
        expect(cell).toHaveProperty('position');
        expect(typeof cell.position).toBe('string');
        expect(cell).toHaveProperty('data');
        expect(cell.data).toBeNull();
      }
    }
  });

  it('first cell is A01 and last cell is H12', () => {
    expect(grid[0][0].position).toBe('A01');
    expect(grid[7][11].position).toBe('H12');
  });
});
