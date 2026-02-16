/**
 * Cursor-based and offset-based pagination helpers for the LabFlow API.
 *
 * These utilities produce a standardised response envelope:
 *
 * {
 *   data: T[],
 *   meta: {
 *     total:     number,
 *     page:      number | null,
 *     pageSize:  number,
 *     pageCount: number | null,
 *     hasMore:   boolean,
 *     cursor:    string | null,
 *   }
 * }
 */

import { z } from 'zod';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface PaginationMeta {
  total: number;
  page: number | null;
  pageSize: number;
  pageCount: number | null;
  hasMore: boolean;
  cursor: string | null;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface OffsetPaginationParams {
  page: number;
  pageSize: number;
}

export interface CursorPaginationParams {
  cursor: string | null;
  pageSize: number;
}

// ----------------------------------------------------------------
// Zod schemas for query-string parsing
// ----------------------------------------------------------------

export const offsetPaginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform(Number)
    .pipe(z.number().int().positive()),
  pageSize: z
    .string()
    .optional()
    .default('25')
    .transform(Number)
    .pipe(z.number().int().min(1).max(100)),
});

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional().default('').transform((v) => (v === '' ? null : v)),
  pageSize: z
    .string()
    .optional()
    .default('25')
    .transform(Number)
    .pipe(z.number().int().min(1).max(100)),
});

// ----------------------------------------------------------------
// Parsing helpers
// ----------------------------------------------------------------

/**
 * Parse raw query-string parameters into validated offset pagination params.
 */
export function parseOffsetPagination(
  query: Record<string, unknown>,
): OffsetPaginationParams {
  const parsed = offsetPaginationSchema.parse(query);
  return { page: parsed.page, pageSize: parsed.pageSize };
}

/**
 * Parse raw query-string parameters into validated cursor pagination params.
 */
export function parseCursorPagination(
  query: Record<string, unknown>,
): CursorPaginationParams {
  const parsed = cursorPaginationSchema.parse(query);
  return { cursor: parsed.cursor, pageSize: parsed.pageSize };
}

// ----------------------------------------------------------------
// Offset-based pagination
// ----------------------------------------------------------------

/**
 * Calculate the Prisma `skip` value for offset pagination.
 */
export function calculateOffset(params: OffsetPaginationParams): number {
  return (params.page - 1) * params.pageSize;
}

/**
 * Build a complete paginated response for offset-based queries.
 *
 * @param data      - The page of results
 * @param total     - Total number of matching rows (from a `count` query)
 * @param params    - The pagination parameters used
 */
export function paginateOffset<T>(
  data: T[],
  total: number,
  params: OffsetPaginationParams,
): PaginatedResult<T> {
  const pageCount = Math.ceil(total / params.pageSize);
  const hasMore = params.page < pageCount;

  return {
    data,
    meta: {
      total,
      page: params.page,
      pageSize: params.pageSize,
      pageCount,
      hasMore,
      cursor: null,
    },
  };
}

// ----------------------------------------------------------------
// Cursor-based pagination
// ----------------------------------------------------------------

/**
 * Encode a cursor value. The cursor is a Base64-encoded JSON payload
 * so it is opaque to the client.
 */
export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * Decode a cursor string back into its constituent parts.
 */
export function decodeCursor(cursor: string): Record<string, unknown> {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid pagination cursor');
  }
}

/**
 * Build Prisma cursor arguments from a cursor string.
 *
 * Assumes the cursor encodes an `id` field (the primary key).
 * For compound cursors, callers should use `decodeCursor` directly.
 */
export function buildPrismaCursorArgs(cursor: string | null): {
  cursor?: { id: string };
  skip?: number;
} {
  if (!cursor) {
    return {};
  }

  const decoded = decodeCursor(cursor);
  const id = decoded.id;

  if (typeof id !== 'string') {
    throw new Error('Invalid cursor: missing id field');
  }

  return {
    cursor: { id },
    skip: 1, // Skip the cursor element itself
  };
}

/**
 * Build a complete paginated response for cursor-based queries.
 *
 * The caller fetches `pageSize + 1` items. If more items are returned than
 * `pageSize`, we know there is a next page and we slice the extra item off.
 *
 * @param data      - The results (may include one extra item to detect next page)
 * @param total     - Total count of matching rows
 * @param pageSize  - Requested page size
 * @param cursorField - The field to use as the cursor (defaults to 'id')
 */
export function paginateCursor<T extends Record<string, unknown>>(
  data: T[],
  total: number,
  pageSize: number,
  cursorField: string = 'id',
): PaginatedResult<T> {
  const hasMore = data.length > pageSize;
  const items = hasMore ? data.slice(0, pageSize) : data;

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = encodeCursor({ [cursorField]: lastItem[cursorField] });
  }

  return {
    data: items,
    meta: {
      total,
      page: null,
      pageSize,
      pageCount: null,
      hasMore,
      cursor: nextCursor,
    },
  };
}

// ----------------------------------------------------------------
// Sorting helpers
// ----------------------------------------------------------------

export const sortSchema = z.object({
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export interface SortParams {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export function parseSortParams(
  query: Record<string, unknown>,
  allowedFields: string[] = ['createdAt', 'updatedAt', 'name'],
): SortParams {
  const parsed = sortSchema.parse(query);

  // Prevent injection of arbitrary field names
  const sortBy = allowedFields.includes(parsed.sortBy)
    ? parsed.sortBy
    : 'createdAt';

  return { sortBy, sortOrder: parsed.sortOrder };
}

/**
 * Build a Prisma-compatible `orderBy` clause from sort params.
 */
export function buildOrderBy(params: SortParams): Record<string, 'asc' | 'desc'> {
  return { [params.sortBy]: params.sortOrder };
}
