/**
 * IndMoneyRateLimiter — enforces INDstocks (INDmoney) rate limits and provides
 * a circuit breaker that hard-stops all INDmoney calls on misuse.
 *
 * INDstocks limits (from the API docs):
 *   - Data APIs (instruments, historical, option chain): 5/sec, 100,000/day
 *   - Quote APIs: 5/sec, 100,000/day
 *   - Non-Trading APIs (profile, funds, holdings, positions): 15/sec, 100,000/day
 *
 * Design:
 *   - Token bucket throttles the per-second rate (never exceeds perSecond/sec).
 *   - A persisted daily counter enforces the per-day budget (survives restarts).
 *   - A circuit breaker halts ALL calls on: (a) daily budget exhausted (sticky,
 *     until the next IST day), or (b) N consecutive 429s (cooldown), or (c) a
 *     pathological per-second backlog (cooldown).
 *   - States: OK → WARN (≥ warnPct of daily) → HALTED, each logged distinctly.
 *   - Concurrency-safe via a mutex; time is injectable for deterministic tests.
 */

import { logger } from '../Logger';

export type IndRateState = 'OK' | 'WARN' | 'HALTED';

export interface IndMoneyRateLimiterConfig {
  /** Max requests per second (token-bucket refill rate). */
  perSecond: number;
  /** Max requests per IST day. */
  perDay: number;
  /** Warn threshold as % of the daily budget. */
  warnPct: number;
  /** Halt if a per-second slot would need to wait longer than this (misuse). */
  maxWaitMs: number;
  /** Reactive halt on consecutive 429s. */
  haltOn429: boolean;
  /** Consecutive 429s before halting. */
  halt429Threshold: number;
  /** Cooldown before a non-sticky halt auto-clears. */
  cooldownMs: number;
  /** Master switch for the proactive (budget/backlog) halt. */
  haltOnLimit: boolean;
}

export const DEFAULT_RATE_LIMIT: IndMoneyRateLimiterConfig = {
  perSecond: 5,
  perDay: 100_000,
  warnPct: 80,
  maxWaitMs: 5_000,
  haltOn429: true,
  halt429Threshold: 5,
  cooldownMs: 15 * 60 * 1000,
  haltOnLimit: true,
};

/** Persistence for the daily counter (so restarts don't reset the budget). */
export interface IndRateStore {
  getDailyCount(dayKey: string): number;
  setDailyCount(dayKey: string, count: number): void;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** `YYYY-MM-DD` in IST — the trading calendar day. */
export function istDayKey(now: number): string {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export class IndMoneyRateLimiter {
  private cfg: IndMoneyRateLimiterConfig;
  private store: IndRateStore | null = null;
  private now: () => number;

  // Token bucket.
  private tokens: number;
  private lastRefillAt: number;

  // Daily budget.
  private dayKey: string;
  private dayCount: number;

  // State.
  private state: IndRateState = 'OK';
  private haltReason_: string | null = null;
  private haltedAt = 0;
  private haltSticky = false;
  private consecutive429 = 0;

  // Concurrency.
  private mutex: Promise<void> = Promise.resolve();

  constructor(
    cfg: Partial<IndMoneyRateLimiterConfig> = {},
    now: () => number = Date.now,
  ) {
    this.cfg = { ...DEFAULT_RATE_LIMIT, ...cfg };
    this.now = now;
    this.tokens = this.cfg.perSecond;
    this.lastRefillAt = this.now();
    this.dayKey = istDayKey(this.now());
    this.dayCount = 0;
  }

  /** (Re)configure the limiter and reload the persisted daily count. */
  configure(cfg: Partial<IndMoneyRateLimiterConfig>, store?: IndRateStore): void {
    this.cfg = { ...this.cfg, ...cfg };
    if (store) this.store = store;
    this.dayKey = istDayKey(this.now());
    this.dayCount = this.store?.getDailyCount(this.dayKey) ?? 0;
    this.tokens = Math.min(this.tokens, this.cfg.perSecond);
  }

  get currentState(): IndRateState {
    return this.state;
  }

  get haltReason(): string | null {
    return this.haltReason_;
  }

  get dailyCount(): number {
    return this.dayCount;
  }

  /**
   * Wait for a per-second token (throttle) and consume a daily unit. Returns
   * true when the request may proceed, false when the circuit breaker is open.
   */
  async waitForSlot(): Promise<boolean> {
    return this.withLock(async () => {
      this.rollDay();

      if (this.state === 'HALTED') {
        if (!this.haltSticky && this.now() - this.haltedAt >= this.cfg.cooldownMs) {
          this.clearHalt();
        } else {
          return false;
        }
      }

      if (this.cfg.haltOnLimit && this.dayCount >= this.cfg.perDay) {
        this.halt(`per-day limit (${this.cfg.perDay}) exhausted`, true);
        return false;
      }

      const now = this.now();
      const elapsed = now - this.lastRefillAt;
      this.tokens = Math.min(
        this.cfg.perSecond,
        this.tokens + (elapsed / 1000) * this.cfg.perSecond,
      );
      this.lastRefillAt = now;

      if (this.tokens >= 1) {
        this.tokens -= 1;
        this.consume();
        return true;
      }

      const waitMs = ((1 - this.tokens) / this.cfg.perSecond) * 1000;
      if (waitMs > this.cfg.maxWaitMs) {
        this.halt(
          `per-second limit (${this.cfg.perSecond}/s) would require a ${Math.round(waitMs)}ms wait`,
          false,
        );
        return false;
      }

      await sleep(waitMs);
      this.tokens = 0;
      this.lastRefillAt = this.now();
      this.consume();
      return true;
    });
  }

  /** Record a 429 response (reactive circuit breaker). */
  record429(): void {
    if (!this.cfg.haltOn429) return;
    this.consecutive429++;
    if (this.consecutive429 >= this.cfg.halt429Threshold) {
      this.halt(
        `${this.consecutive429} consecutive 429s — INDstocks is rate-limiting us`,
        false,
      );
    }
  }

  /** Record a successful (2xx) response — resets the 429 streak. */
  recordSuccess(): void {
    this.consecutive429 = 0;
  }

  /** Manually clear the circuit breaker. */
  reset(): void {
    this.clearHalt();
    this.consecutive429 = 0;
  }

  /* ------------------------------------------------------------ */
  /* Internals                                                      */
  /* ------------------------------------------------------------ */

  private consume(): void {
    this.dayCount++;
    this.persist();
    this.updateWarn();
  }

  private rollDay(): void {
    const key = istDayKey(this.now());
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.dayCount = this.store?.getDailyCount(key) ?? 0;
      this.clearHalt();
    }
  }

  private updateWarn(): void {
    if (this.state === 'HALTED') return;
    const pct = (this.dayCount / this.cfg.perDay) * 100;
    if (pct >= this.cfg.warnPct && this.state !== 'WARN') {
      this.state = 'WARN';
      logger.warn(
        { dayCount: this.dayCount, pct: pct.toFixed(1) },
        'INDMONEY_RATE_LIMIT_WARN: approaching daily limit',
      );
    } else if (pct < this.cfg.warnPct && this.state === 'WARN') {
      this.state = 'OK';
    }
  }

  private halt(reason: string, sticky: boolean): void {
    if (this.state === 'HALTED') return;
    this.state = 'HALTED';
    this.haltReason_ = reason;
    this.haltedAt = this.now();
    this.haltSticky = sticky;
    logger.error(
      { reason, sticky },
      'INDMONEY_RATE_LIMIT_HALTED: stopping all INDmoney calls',
    );
  }

  private clearHalt(): void {
    if (this.state === 'HALTED') {
      logger.info({ reason: this.haltReason_ }, 'INDMONEY_RATE_LIMIT: halt cleared');
    }
    this.state = 'OK';
    this.haltReason_ = null;
    this.haltedAt = 0;
    this.haltSticky = false;
  }

  private persist(): void {
    this.store?.setDailyCount(this.dayKey, this.dayCount);
  }

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const prev = this.mutex;
    this.mutex = new Promise<void>((r) => {
      release = r;
    });
    return prev.then(fn).finally(() => release!());
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* ------------------------------------------------------------------ */
/* Singleton (shared budget across streamer + broker account)          */
/* ------------------------------------------------------------------ */

let singleton: IndMoneyRateLimiter | null = null;

export function getIndMoneyRateLimiter(): IndMoneyRateLimiter {
  if (!singleton) singleton = new IndMoneyRateLimiter();
  return singleton;
}

export function configureIndMoneyRateLimiter(
  cfg: Partial<IndMoneyRateLimiterConfig>,
  store?: IndRateStore,
): IndMoneyRateLimiter {
  const limiter = getIndMoneyRateLimiter();
  limiter.configure(cfg, store);
  return limiter;
}
