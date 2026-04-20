/**
 * @libs/shared-shared
 *
 * Utilities shared between all libs inside libs/shared/*.
 * Import this lib from other shared libs (dto, types, validation-schemas)
 * to avoid duplicating cross-cutting helpers.
 */

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function paginate<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

// ---------------------------------------------------------------------------
// HTTP Response envelope
// ---------------------------------------------------------------------------

export interface HttpResponse<T = unknown> {
  statusCode: number;
  data?: T;
  message?: string;
  error?: string | null;
}

export function successResponse<T>(
  data: T,
  statusCode = 200,
  message?: string
): HttpResponse<T> {
  return { statusCode, data, message };
}

export function errorResponse(
  error: string,
  statusCode = 500
): HttpResponse<never> {
  return { statusCode, error };
}

// ---------------------------------------------------------------------------
// Common status codes
// ---------------------------------------------------------------------------

export type StatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 500;

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/** Make specific keys of T required */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Make specific keys of T optional */
export type PartialFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

/** Strip null and undefined from a type */
export type NonNullableFields<T> = {
  [K in keyof T]: NonNullable<T[K]>;
};

// ---------------------------------------------------------------------------
// General helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the value is not null or undefined.
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Removes keys with undefined values from an object.
 */
export function omitUndefined<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

/**
 * Capitalises the first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a camelCase string to snake_case.
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Deeply freezes an object (useful for constants).
 */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.getOwnPropertyNames(obj).forEach((name) => {
    const value = (obj as Record<string, unknown>)[name];
    if (value && typeof value === 'object') {
      deepFreeze(value as object);
    }
  });
  return Object.freeze(obj);
}
