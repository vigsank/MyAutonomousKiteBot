/**
 * Pagination — mirrors Kite MCP's pagination contract.
 *
 * When `limit` is provided, list tools return `{ data, pagination }`.
 * When `limit` is omitted, they return the raw array.
 */

export interface PaginationParams {
  from: number;
  limit: number | null;
}

/** Extract `from` / `limit` from tool arguments. */
export function parsePagination(args: Record<string, any>): PaginationParams {
  const from = safeInt(args.from, 0);
  const rawLimit = safeInt(args.limit, 0);
  return { from, limit: rawLimit > 0 ? rawLimit : null };
}

/** Slice a list according to pagination params. */
export function applyPagination<T>(data: T[], params: PaginationParams): T[] {
  if (params.limit === null) return data;
  return data.slice(params.from, params.from + params.limit);
}

/** Wrap paginated data with Kite MCP's pagination metadata. */
export function createPaginatedResponse<T>(
  originalData: T[],
  paginatedData: T[],
  params: PaginationParams,
  originalLength: number
): { data: T[]; pagination: Record<string, number> } {
  return {
    data: paginatedData,
    pagination: {
      total: originalLength,
      from: params.from,
      limit: params.limit ?? 0,
      returned: paginatedData.length,
    },
  };
}

/**
 * Paginate a list. Returns the raw array when `limit` is absent, or a
 * `{ data, pagination }` object when pagination is requested.
 */
export function paginate<T>(
  data: T[],
  args: Record<string, any>
): T[] | { data: T[]; pagination: Record<string, number> } {
  const params = parsePagination(args);
  if (params.limit === null) return data;
  const page = applyPagination(data, params);
  return createPaginatedResponse(data, page, params, data.length);
}

/** Coerce a value to an integer with a fallback. */
export function safeInt(v: any, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
