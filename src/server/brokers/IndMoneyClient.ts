/**
 * IndMoneyClient — thin, typed REST client for the INDstocks (INDmoney) API.
 *
 * Auth: raw access token in the `Authorization` header — NO `Bearer` prefix.
 * Token is valid 24h and regenerated manually (TOTP auto-refresh is deferred).
 *
 * This client is READ-ONLY for this pass: it exposes the GET surface (profile,
 * funds, quotes, historical, holdings, positions) plus a `buildOrderRequest`
 * helper that constructs the order payload for the broker-order snapshot. It
 * does NOT call POST /order (order execution is stubbed).
 *
 * Uses only the global `fetch` available in Node 22 — no npm dependencies.
 */

import { logger } from '../Logger';
import {
  IndErrorResponse,
  IndFullQuote,
  IndFunds,
  IndHistoricalResponse,
  IndHolding,
  IndLtpQuote,
  IndOrderRequest,
  IndPosition,
  IndUserProfile,
} from './indmoneyTypes';
import { scripCode } from './indmoneyMapping';
import {
  configureIndMoneyRateLimiter,
  getIndMoneyRateLimiter,
  IndMoneyRateLimiterConfig,
} from './IndMoneyRateLimiter';

export interface IndMoneyClientConfig {
  accessToken: string;
  baseUrl: string;
  timeoutMs: number;
  /** Throttle: sleep before each request (ms) to stay under the rate limit. */
  rateDelayMs?: number;
  /** Max attempts on 429 / transient 5xx (0 = no retry). */
  maxRetries?: number;
  /** Base backoff (ms) for retries (doubles each attempt). */
  retryBaseMs?: number;
  /** Rate-limit / circuit-breaker settings (shared singleton). */
  rateLimit?: Partial<IndMoneyRateLimiterConfig>;
}

/** Token health state, updated on every request. */
export type IndTokenState = 'ok' | 'expired' | 'unknown';

export class IndMoneyClient {
  private tokenState_: IndTokenState = 'unknown';

  constructor(private readonly config: IndMoneyClientConfig) {
    // Configure the shared rate limiter (idempotent; the store is set later by
    // index.ts when a Ledger is available).
    configureIndMoneyRateLimiter(config.rateLimit ?? {});
  }

  /** True when an access token is configured. */
  get isConfigured(): boolean {
    return this.config.accessToken.length > 0;
  }

  /** Current token state, updated on every request. */
  get tokenState(): IndTokenState {
    return this.tokenState_;
  }

  /* ------------------------------------------------------------ */
  /* User / account                                                */
  /* ------------------------------------------------------------ */

  async getUserProfile(): Promise<IndUserProfile | null> {
    const res = await this.get<{ data: IndUserProfile }>('/user/profile');
    return res?.data ?? null;
  }

  /**
   * Proactively verify the access token by fetching the user profile. Returns
   * true when the token is valid, false when invalid/expired. Updates
   * `tokenState` as a side effect.
   */
  async verifyToken(): Promise<boolean> {
    const profile = await this.getUserProfile();
    return profile !== null;
  }

  async getFunds(): Promise<IndFunds | null> {
    const res = await this.get<{ data: IndFunds }>('/funds');
    return res?.data ?? null;
  }

  /* ------------------------------------------------------------ */
  /* Market data                                                   */
  /* ------------------------------------------------------------ */

  /** Full quotes for one or more scrip codes (up to 1000). */
  async getFullQuotes(scripCodes: string[]): Promise<Record<string, IndFullQuote>> {
    const res = await this.get<{ data: Record<string, IndFullQuote> }>(
      `/market/quotes/full?scrip-codes=${scripCodes.join(',')}`,
    );
    return res?.data ?? {};
  }

  /** LTP for one or more scrip codes. */
  async getLtp(scripCodes: string[]): Promise<Record<string, IndLtpQuote>> {
    const res = await this.get<{ data: Record<string, IndLtpQuote> }>(
      `/market/quotes/ltp?scrip-codes=${scripCodes.join(',')}`,
    );
    return res?.data ?? {};
  }

  /**
   * Historical OHLCV candles for up to 5 scrip codes in one window.
   * `startTime`/`endTime` are epoch milliseconds (IST, inclusive/exclusive).
   */
  async getHistorical(
    interval: string,
    scripCodes: string[],
    startTimeMs: number,
    endTimeMs: number,
  ): Promise<Record<string, { candles: Array<{ ts: number; o: number; h: number; l: number; c: number; v: number }> }>> {
    const res = await this.get<IndHistoricalResponse>(
      `/market/historical/${interval}?scrip-codes=${scripCodes.join(',')}&start_time=${startTimeMs}&end_time=${endTimeMs}`,
    );
    if (!res || res.success !== true) return {};
    return res.data ?? {};
  }

  /* ------------------------------------------------------------ */
  /* Portfolio                                                     */
  /* ------------------------------------------------------------ */

  async getHoldings(): Promise<IndHolding[]> {
    const res = await this.get<{ data: IndHolding[] }>('/portfolio/holdings');
    return res?.data ?? [];
  }

  async getPositions(segment: 'equity' | 'derivative', product: string): Promise<IndPosition[]> {
    const res = await this.get<{ data: IndPosition[] }>(
      `/portfolio/positions?segment=${segment}&product=${product}`,
    );
    return res?.data ?? [];
  }

  /* ------------------------------------------------------------ */
  /* Order snapshot (no execution)                                 */
  /* ------------------------------------------------------------ */

  /**
   * Build the INDstocks order payload for a symbol. This is used ONLY to
   * produce the broker-order snapshot — it is never sent in this pass.
   */
  buildOrderRequest(params: {
    txnType: 'BUY' | 'SELL';
    exchange: string;
    product: string;
    orderType: string;
    validity: string;
    securityId: string;
    qty: number;
    algoId: string;
    limitPrice?: number;
    remarks?: string;
  }): IndOrderRequest {
    return {
      txn_type: params.txnType,
      exchange: params.exchange === 'BSE' ? 'BSE' : 'NSE',
      segment: 'EQUITY',
      product: params.product === 'MIS' ? 'INTRADAY' : 'CNC',
      order_type: params.orderType === 'LIMIT' ? 'LIMIT' : 'MARKET',
      validity: params.validity === 'IOC' ? 'IOC' : 'DAY',
      security_id: params.securityId,
      qty: params.qty,
      algo_id: params.algoId,
      limit_price: params.limitPrice,
      is_amo: false,
      remarks: params.remarks,
    };
  }

  /* ------------------------------------------------------------ */
  /* Transport                                                     */
  /* ------------------------------------------------------------ */

  /**
   * GET a path and return the parsed JSON, or null on any failure. Never throws.
   * Throttles via the shared rate limiter, retries 429 / transient 5xx with
   * exponential backoff, and feeds 429/success signals back to the limiter's
   * reactive circuit breaker.
   */
  private async get<T>(path: string): Promise<T | null> {
    if (!this.isConfigured) return null;
    const limiter = getIndMoneyRateLimiter();
    const maxRetries = this.config.maxRetries ?? 4;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const allowed = await limiter.waitForSlot();
      if (!allowed) {
        logger.warn(
          { path, reason: limiter.haltReason },
          'IndMoneyClient: rate limiter halted, skipping request',
        );
        return null;
      }

      const { value, retryable, status } = await this.tryGet<T>(path);
      if (status === 429) limiter.record429();
      else if (status >= 200 && status < 300) limiter.recordSuccess();

      if (retryable && attempt < maxRetries - 1) {
        const backoff = (this.config.retryBaseMs ?? 500) * Math.pow(2, attempt);
        logger.warn(
          { path, attempt: attempt + 1, backoffMs: backoff },
          'IndMoneyClient: rate-limited, backing off',
        );
        await sleep(backoff);
        continue;
      }
      return value;
    }
    return null;
  }

  /** Single GET attempt. Returns the value, whether to retry, and the status. */
  private async tryGet<T>(
    path: string,
  ): Promise<{ value: T | null; retryable: boolean; status: number }> {
    const delay = this.config.rateDelayMs ?? 0;
    if (delay > 0) await sleep(delay);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(`${this.config.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          Authorization: this.config.accessToken,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          return { value: null, retryable: true, status: res.status };
        }
        const err = json as IndErrorResponse | null;
        if (isTokenError(res.status, err)) {
          this.tokenState_ = 'expired';
          logger.error(
            { path, status: res.status, message: err?.message ?? err?.debug_info ?? text },
            'INDMONEY_TOKEN_EXPIRED: access token invalid/expired — regenerate it',
          );
        } else {
          logger.warn(
            { path, status: res.status, message: err?.message ?? err?.debug_info ?? text },
            'IndMoneyClient: request failed',
          );
        }
        return { value: null, retryable: false, status: res.status };
      }

      this.tokenState_ = 'ok';
      return { value: json as T, retryable: false, status: res.status };
    } catch (err) {
      logger.warn({ path, err: (err as Error)?.message }, 'IndMoneyClient.get failed');
      return { value: null, retryable: false, status: 0 };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Convenience: build a scrip code for a symbol's exchange + token. */
export function indScripCode(exchange: string, token: number): string {
  return scripCode(exchange, token);
}

/** True when an HTTP status / error envelope indicates an invalid/expired token. */
export function isTokenError(status: number, err: IndErrorResponse | null): boolean {
  if (status === 401 || status === 403) return true;
  const type = (err?.error_type ?? '').toLowerCase();
  const msg = (err?.message ?? '').toLowerCase();
  return type.includes('token') || msg.includes('token') || msg.includes('invalid token');
}

/** Simple promise-based sleep. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
