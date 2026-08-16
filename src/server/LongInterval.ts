import { logger } from './Logger';

/**
 * LongInterval — a repeating scheduler that is safe for multi-week periods.
 *
 * WHY THIS EXISTS:
 * Node stores timer delays in a 32-bit signed integer, so any delay above
 * 2,147,483,647 ms (~24.8 days) silently overflows and is clamped to **1 ms**.
 * A `setInterval(fn, 30 * 24 * 60 * 60 * 1000)` intended to run monthly
 * therefore runs roughly a thousand times a second, with only a
 * `TimeoutOverflowWarning` on stderr to hint at it. For a trading bot that
 * means the monthly rebalance hammers the data provider continuously.
 *
 * This schedules long delays by chaining bounded `setTimeout` chunks, and adds
 * re-entrancy protection so a slow async task can never overlap itself.
 */

/** Node's maximum safe timer delay, with headroom. */
const MAX_DELAY_MS = 2_000_000_000;

export interface LongIntervalHandle {
  stop: () => void;
}

/**
 * Run `fn` every `periodMs`, safely for any period length.
 *
 * @param name  used in logs so a stuck or overlapping task is identifiable.
 * @param periodMs  interval between runs (may exceed Node's 24.8-day limit).
 * @param fn  the task; may be async. Rejections are logged, never thrown.
 * @param initialDelayMs  delay before the first run (default: one full period).
 */
export function setLongInterval(
  name: string,
  periodMs: number,
  fn: () => void | Promise<void>,
  initialDelayMs = periodMs,
): LongIntervalHandle {
  let stopped = false;
  let running = false;
  let timer: NodeJS.Timeout | null = null;

  /** Chain bounded chunks until `remaining` is exhausted, then invoke. */
  const arm = (remaining: number): void => {
    if (stopped) return;
    const delay = Math.min(remaining, MAX_DELAY_MS);
    timer = setTimeout(() => {
      if (stopped) return;
      const left = remaining - delay;
      if (left > 0) {
        arm(left);
        return;
      }
      void fire();
    }, delay);
  };

  const fire = async (): Promise<void> => {
    // Re-entrancy guard: a run that takes longer than the period must not
    // stack up behind itself.
    if (running) {
      logger.warn({ task: name }, 'Scheduled task still running — skipping this cycle');
      arm(periodMs);
      return;
    }
    running = true;
    try {
      await fn();
    } catch (err: any) {
      logger.error({ task: name, err: err?.message }, 'Scheduled task failed');
    } finally {
      running = false;
      arm(periodMs);
    }
  };

  arm(initialDelayMs);

  return {
    stop: () => {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
    },
  };
}
