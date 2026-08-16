import * as crypto from 'crypto';
import { Ledger } from './Ledger';
import { logger } from './Logger';
import { TradeRequest } from './types';
import { directionToSide } from './Ledger';

/**
 * OrderGuard (E1) — order idempotency.
 *
 * A trading bot re-runs the same decision many times: the scheduler fires
 * repeatedly, a network call is retried, the process restarts mid-rebalance.
 * Without a guard, each of those can place the *same* order again and silently
 * double (or triple) a position.
 *
 * The guard turns a trade intent into a deterministic key and claims it
 * atomically in the database *before* the order is executed. Whoever wins the
 * claim executes; everyone else is told to stand down.
 *
 * Key = sha1(symbol | exchange | side | intent | timeBucket)
 *
 * `intent` distinguishes purposeful repeats (e.g. `REBALANCE_BUY` vs
 * `TRIM_50`), and `timeBucket` scopes the key so that a genuinely new decision
 * on a later day/window is not mistaken for a duplicate. Quantity is
 * deliberately NOT in the key: a retry that re-sizes slightly must still be
 * recognised as the same intent.
 */
export class OrderGuard {
  constructor(private readonly ledger: Ledger) {}

  /**
   * Deterministic idempotency key for a trade intent.
   *
   * @param bucket scope for the key. Defaults to the calendar day (IST), which
   *   is the right granularity for the daily/monthly rebalance cadence. Pass a
   *   finer bucket (e.g. `2026-04-20T11`) for intraday report adjustments that
   *   are legitimately allowed once per window.
   */
  keyFor(request: TradeRequest, intent: string, bucket?: string): string {
    const side = safeSide(request);
    const scope = bucket ?? istDay(request.timestamp);
    const raw = [request.symbol, request.exchange, side, intent, scope].join('|');
    return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 32);
  }

  /**
   * Claim the right to execute this intent.
   *
   * @returns the idempotency key when the claim succeeded (caller should
   *   execute, then call {@link settle}), or `null` when this is a duplicate
   *   and the caller must NOT execute.
   */
  claim(request: TradeRequest, intent: string, bucket?: string): string | null {
    const key = this.keyFor(request, intent, bucket);
    const won = this.ledger.claimOrderIntent({
      key,
      symbol: request.symbol,
      side: safeSide(request),
      quantity: request.quantity,
      intent,
    });
    if (!won) {
      logger.warn(
        { symbol: request.symbol, intent, key },
        'OrderGuard: duplicate order intent suppressed',
      );
      return null;
    }
    return key;
  }

  /**
   * Settle a claim after attempting execution.
   *
   * On failure pass `ABANDONED` — the claim is released so a legitimate retry
   * can proceed. Leaving a failed claim in place would silently block the
   * trade for the rest of the bucket.
   */
  settle(key: string, status: 'EXECUTED' | 'ABANDONED'): void {
    this.ledger.settleOrderIntent(key, status);
  }

  /**
   * Run `fn` at most once per (intent, bucket). Returns the function's result,
   * or `null` when suppressed as a duplicate. Releases the claim if `fn` throws.
   */
  once<T>(
    request: TradeRequest,
    intent: string,
    fn: (key: string) => T,
    bucket?: string,
  ): T | null {
    const key = this.claim(request, intent, bucket);
    if (!key) return null;
    try {
      const out = fn(key);
      this.settle(key, 'EXECUTED');
      return out;
    } catch (err) {
      this.settle(key, 'ABANDONED');
      throw err;
    }
  }
}

/** `YYYY-MM-DD` in IST — the bot's trading calendar day. */
export function istDay(ts: Date): string {
  return new Date(ts.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** `YYYY-MM-DDTHH` in IST — for intraday windows (9 AM / 11 AM / 3:15 PM). */
export function istHourBucket(ts: Date): string {
  return new Date(ts.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 13);
}

/** Side for the key; NEUTRAL has no side, so fall back to a stable literal. */
function safeSide(request: TradeRequest): string {
  try {
    return directionToSide(request.direction);
  } catch {
    return request.direction;
  }
}
