// ============================================================
// 96-Well Plate Position Constants & Validation
// ============================================================

/**
 * Standard 96-well plate row labels (A through H).
 */
export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export type WellRow = (typeof ROWS)[number];

/**
 * Standard 96-well plate column labels (zero-padded: 01 through 12).
 */
export const COLUMNS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] as const;

export type WellColumn = (typeof COLUMNS)[number];

/**
 * All 96 well positions in row-major order (A01, A02, ... A12, B01, ... H12).
 */
export const ALL_WELL_POSITIONS: string[] = ROWS.flatMap((row) =>
  COLUMNS.map((col) => `${row}${col}`),
);

/**
 * Total number of wells in a standard 96-well plate.
 */
export const PLATE_WELL_COUNT = 96;

/**
 * Number of rows in a standard 96-well plate.
 */
export const PLATE_ROWS = 8;

/**
 * Number of columns in a standard 96-well plate.
 */
export const PLATE_COLUMNS = 12;

/**
 * Regex for validating a well position string (A01–H12).
 */
export const WELL_POSITION_REGEX = /^[A-H](0[1-9]|1[0-2])$/;

/**
 * Returns true if the given string is a valid 96-well position (A01–H12).
 */
export function isValidWellPosition(position: string): boolean {
  return WELL_POSITION_REGEX.test(position);
}

/**
 * Converts a well position string (e.g. "B03") to a zero-based index (0–95).
 * Returns -1 for invalid positions.
 */
export function wellPositionToIndex(position: string): number {
  if (!isValidWellPosition(position)) return -1;
  const row = position.charCodeAt(0) - 'A'.charCodeAt(0);
  const col = parseInt(position.slice(1), 10) - 1;
  return row * PLATE_COLUMNS + col;
}

/**
 * Converts a zero-based index (0–95) to a well position string (e.g. "B03").
 * Returns null for out-of-range indices.
 */
export function indexToWellPosition(index: number): string | null {
  if (index < 0 || index >= PLATE_WELL_COUNT) return null;
  const row = Math.floor(index / PLATE_COLUMNS);
  const col = index % PLATE_COLUMNS;
  return `${ROWS[row]}${COLUMNS[col]}`;
}

/**
 * Normalises a well position to the canonical zero-padded format.
 * Accepts "A1" → "A01", "H12" → "H12", "a01" → "A01".
 * Returns null for invalid positions.
 */
export function normaliseWellPosition(position: string): string | null {
  const upper = position.toUpperCase().trim();
  // Handle single-digit column (e.g. "A1" → "A01")
  const match = upper.match(/^([A-H])(\d{1,2})$/);
  if (!match) return null;
  const row = match[1];
  const col = match[2].padStart(2, '0');
  const normalised = `${row}${col}`;
  return isValidWellPosition(normalised) ? normalised : null;
}

/**
 * Generates an 8×12 grid structure with well positions.
 * Each cell contains the position string and a null data slot.
 */
export function generateEmptyPlateGrid<T = null>(): Array<Array<{ position: string; data: T | null }>> {
  return ROWS.map((row) =>
    COLUMNS.map((col) => ({
      position: `${row}${col}`,
      data: null,
    })),
  );
}
