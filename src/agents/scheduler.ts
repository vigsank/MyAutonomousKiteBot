/**
 * Scheduling helpers for the agent loop.
 *
 * Implements the plan's "skip the first ~1.5h of market noise" heuristic: the
 * Indian equity market opens at 09:15 IST, and we hold off on executing until a
 * configurable number of minutes have elapsed after the open.
 */

/** IST market open time (fixed for NSE). */
export const MARKET_OPEN_IST = "09:15";

/** Minutes-of-day in IST. Adds the fixed +5:30 UTC→IST offset. */
export function istMinutes(now: Date): number {
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
  const total = (utcMinutes + 5 * 60 + 30) % (24 * 60);
  return total;
}

/**
 * True when we should hold off on executing.
 * Before the market opens (09:15 IST) we return true (hold). Otherwise we hold
 * until `holdUntilMinutesAfterOpen` minutes have elapsed since the open.
 */
export function withinHoldWindow(now: Date, holdUntilMinutesAfterOpen = 75): boolean {
  const openMinutes = 9 * 60 + 15; // 09:15 IST
  const minutes = istMinutes(now);
  if (minutes < openMinutes) return true;
  const minutesSinceOpen = minutes - openMinutes;
  return minutesSinceOpen < holdUntilMinutesAfterOpen;
}
