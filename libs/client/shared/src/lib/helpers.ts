/**
 * @libs/client-shared — helpers
 *
 * General-purpose helper functions shared across all client-side applications.
 * Note: string, array, and object utilities (capitalize, truncate, toLabel,
 * unique, chunk, groupBy, omit, pick) live in utils.ts to avoid duplicate exports.
 */

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

/**
 * Converts a string to slug format (lowercase, hyphen-separated).
 *
 * @example
 * toSlug('Hello World!') // 'hello-world'
 */
export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-');
}

// ---------------------------------------------------------------------------
// Number helpers
// ---------------------------------------------------------------------------

/**
 * Clamps a number between `min` and `max`.
 *
 * @example
 * clamp(150, 0, 100) // 100
 * clamp(-5,  0, 100) //   0
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Formats a number as a currency string.
 *
 * @example
 * formatCurrency(1234.5)                   // '$1,234.50'
 * formatCurrency(1234.5, 'EUR', 'de-DE')   // '1.234,50 €'
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  locale = 'en-US',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Formats a Date (or ISO string) as a localised date string.
 *
 * @example
 * formatDate(new Date('2024-01-15')) // 'Jan 15, 2024'
 */
export function formatDate(
  date: Date | string,
  locale = 'en-US',
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(date));
}

/**
 * Returns true if the given date is in the past.
 */
export function isPast(date: Date | string): boolean {
  return new Date(date).getTime() < Date.now();
}

/**
 * Returns true if the given date is in the future.
 */
export function isFuture(date: Date | string): boolean {
  return new Date(date).getTime() > Date.now();
}
