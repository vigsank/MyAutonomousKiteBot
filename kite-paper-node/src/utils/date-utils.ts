/**
 * Date/time helpers, including market-hours awareness.
 */

import type { MarketHoursConfig } from '../types';

/** Format a Date as an ISO 8601 string with +05:30 offset (IST). */
export function toIsoString(date: Date): string {
  return date.toISOString();
}

/** Format a Date in the Kite order-timestamp style: "YYYY-MM-DD HH:mm:ss". */
export function toKiteTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** Parse a "HH:mm" string into minutes since midnight. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Determine whether the given time falls within configured market hours.
 * When no config is provided, defaults to NSE hours (09:15–15:30 IST).
 */
export function isWithinMarketHours(
  date: Date,
  config?: MarketHoursConfig
): boolean {
  const start = toMinutes(config?.start ?? '09:15');
  const end = toMinutes(config?.end ?? '15:30');
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= start && minutes <= end;
}

/** Map a candle interval string to milliseconds. */
export function intervalToMs(interval: string): number {
  switch (interval) {
    case 'minute':
      return 60_000;
    case '3minute':
      return 3 * 60_000;
    case '5minute':
      return 5 * 60_000;
    case '10minute':
      return 10 * 60_000;
    case '15minute':
      return 15 * 60_000;
    case '30minute':
      return 30 * 60_000;
    case '60minute':
      return 60 * 60_000;
    case 'day':
      return 24 * 60 * 60_000;
    case 'week':
      return 7 * 24 * 60 * 60_000;
    case 'month':
      return 30 * 24 * 60 * 60_000;
    default:
      return 60_000;
  }
}

/** Sleep for a number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
