// ============================================================
// Human-Readable ID Generators
// ============================================================
// Generates IDs in formats like:
//   WO-2025-000001  (Work Order / Order)
//   SMP-2025-000001 (Sample)
//   INV-2025-000001 (Invoice)
//   RPT-2025-000001 (Report)
//   CN-2025-000001  (Credit Note)
// ============================================================

/**
 * Entity type prefixes used in human-readable IDs.
 */
export const ENTITY_PREFIXES = {
  ORDER: 'WO',
  SAMPLE: 'SMP',
  INVOICE: 'INV',
  REPORT: 'RPT',
  CREDIT_NOTE: 'CN',
} as const;

export type EntityType = keyof typeof ENTITY_PREFIXES;

/**
 * Pads a number with leading zeros to the specified width.
 */
export function padNumber(value: number, width: number = 6): string {
  return String(value).padStart(width, '0');
}

/**
 * Generates a human-readable ID string from its components.
 *
 * @param entityType - The entity type (ORDER, SAMPLE, INVOICE, REPORT, CREDIT_NOTE)
 * @param year - The year component (4-digit)
 * @param sequenceNumber - The sequence number to format
 * @param padWidth - Number of digits to pad to (default: 6)
 * @returns Formatted ID string, e.g. "WO-2025-000001"
 */
export function formatEntityId(
  entityType: EntityType,
  year: number,
  sequenceNumber: number,
  padWidth: number = 6
): string {
  const prefix = ENTITY_PREFIXES[entityType];
  return `${prefix}-${year}-${padNumber(sequenceNumber, padWidth)}`;
}

/**
 * Parses a human-readable ID string back into its components.
 *
 * @param id - The formatted ID string (e.g. "WO-2025-000001")
 * @returns Parsed components or null if the format is invalid
 */
export function parseEntityId(
  id: string
): { entityType: EntityType; year: number; sequenceNumber: number } | null {
  const parts = id.split('-');
  if (parts.length !== 3) {
    return null;
  }

  const [prefix, yearStr, seqStr] = parts;

  const entityType = (Object.keys(ENTITY_PREFIXES) as EntityType[]).find(
    (key) => ENTITY_PREFIXES[key] === prefix
  );

  if (!entityType) {
    return null;
  }

  const year = parseInt(yearStr, 10);
  const sequenceNumber = parseInt(seqStr, 10);

  if (isNaN(year) || isNaN(sequenceNumber)) {
    return null;
  }

  return { entityType, year, sequenceNumber };
}

/**
 * Generates the next ID for a given entity type given the current sequence value.
 * This is a pure function; actual sequence management happens at the database layer.
 *
 * @param entityType - The entity type
 * @param currentSequenceValue - The current highest sequence value (will be incremented)
 * @param year - Optional year override (defaults to current year)
 * @returns Object containing the formatted ID and the new sequence value
 */
export function generateNextId(
  entityType: EntityType,
  currentSequenceValue: number,
  year?: number
): { id: string; newSequenceValue: number } {
  const idYear = year ?? new Date().getFullYear();
  const newSequenceValue = currentSequenceValue + 1;
  const id = formatEntityId(entityType, idYear, newSequenceValue);
  return { id, newSequenceValue };
}

/**
 * Generates a barcode value for a sample.
 * Format: {orgSlugPrefix}-{sampleNumber} (e.g. "ACME-SMP-2025-000001")
 *
 * @param organizationPrefix - Short prefix for the organization (e.g. "ACME")
 * @param sampleNumber - The full sample number (e.g. "SMP-2025-000001")
 * @returns The barcode value string
 */
export function generateBarcodeValue(
  organizationPrefix: string,
  sampleNumber: string
): string {
  return `${organizationPrefix.toUpperCase()}-${sampleNumber}`;
}

/**
 * Generates a batch ID for grouping tests.
 * Format: BATCH-{YYYYMMDD}-{sequence}
 *
 * @param date - The batch date (defaults to today)
 * @param sequence - The batch sequence number for the day
 * @returns Formatted batch ID
 */
export function generateBatchId(date?: Date, sequence: number = 1): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `BATCH-${year}${month}${day}-${padNumber(sequence, 4)}`;
}

/**
 * Validates that a given string matches the expected entity ID format.
 *
 * @param id - The string to validate
 * @param entityType - Optional: restrict validation to a specific entity type
 * @returns true if the string is a valid entity ID
 */
export function isValidEntityId(id: string, entityType?: EntityType): boolean {
  const parsed = parseEntityId(id);
  if (!parsed) {
    return false;
  }
  if (entityType && parsed.entityType !== entityType) {
    return false;
  }
  if (parsed.year < 2000 || parsed.year > 2100) {
    return false;
  }
  if (parsed.sequenceNumber < 1) {
    return false;
  }
  return true;
}
