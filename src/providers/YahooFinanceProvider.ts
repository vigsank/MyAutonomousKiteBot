import YahooFinance from 'yahoo-finance2';
import {
  HistoricalDataProvider,
  kiteIntervalToYahoo,
} from '../MarketDataProvider';
import { Candle, Instrument } from '../types';
import { logger } from '../Logger';

/**
 * YahooFinanceProvider — the account-free BACKTEST provider.
 *
 * Provides historical OHLC candles via Yahoo Finance (no account, no API key).
 * It does NOT stream live ticks (that's what the LIVE provider is for). Use it
 * for backtests, optimization, and simulations.
 *
 * Yahoo symbols use a market suffix: NSE -> ".NS", BSE -> ".BO".
 */
export class YahooFinanceProvider implements HistoricalDataProvider {
  readonly name = 'yahoo';
  readonly isConfigured = true; // no account or key required

  private client = new YahooFinance({ suppressNotices: ['ripHistorical'] });
  private tokens = new Map<number, { tradingsymbol: string; exchange: string }>();
  private tokenBase = 10_000;

  async loadInstruments(_exchange = 'NSE'): Promise<void> {
    // Yahoo has no instrument master; tokens are synthesised on demand.
  }

  private tokenFor(symbol: string, exchange: string): number {
    for (const [t, i] of this.tokens) {
      if (i.tradingsymbol === symbol && i.exchange === exchange) return t;
    }
    const token = this.tokenBase + this.tokens.size;
    this.tokens.set(token, { tradingsymbol: symbol, exchange });
    return token;
  }

  findInstrument(tradingsymbol: string, exchange: string): Instrument | null {
    const token = this.tokenFor(tradingsymbol, exchange);
    return {
      instrument_token: token,
      exchange_token: String(token),
      tradingsymbol,
      name: tradingsymbol,
      last_price: 0,
      tick_size: 0.05,
      lot_size: 1,
      instrument_type: 'EQ',
      segment: exchange as Instrument['segment'],
      exchange: exchange as Instrument['exchange'],
    };
  }

  async getHistoricalData(
    instrumentToken: number,
    interval: string,
    from: Date,
    to: Date,
  ): Promise<Candle[]> {
    const inst = this.tokens.get(instrumentToken);
    if (!inst) {
      throw new Error(`Yahoo provider: unknown token ${instrumentToken}.`);
    }

    const yahooSymbol = this.toYahooSymbol(inst.tradingsymbol, inst.exchange);
    const yahooInterval = kiteIntervalToYahoo(interval);

    logger.debug({ symbol: yahooSymbol, interval: yahooInterval }, 'Fetching Yahoo history');

    const res = await this.fetchWithRetry(() =>
      this.client.chart(yahooSymbol, {
        period1: from,
        period2: to,
        interval: yahooInterval,
      }),
    );

    return (res?.quotes ?? [])
      .filter((r) =>
        [r.open, r.high, r.low, r.close, r.volume ?? 0].every((v) => Number.isFinite(v)),
      )
      .map((r) => ({
        date: r.date,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume ?? 0,
      }));
  }

  private toYahooSymbol(symbol: string, exchange: string): string {
    if (exchange === 'NSE') return `${symbol}.NS`;
    if (exchange === 'BSE') return `${symbol}.BO`;
    return symbol;
  }

  /** Retry Yahoo's rate-limited historical endpoint with backoff. */
  private async fetchWithRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        const retryable = /data doesn't exist|too many requests|rate limit/i.test(msg);
        if (i === attempts - 1 || !retryable) {
          throw err;
        }
        const delay = (i + 1) * 2000;
        logger.warn({ attempt: i + 1, delayMs: delay, msg }, 'Yahoo fetch rate-limited, retrying');
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error('Yahoo fetch retries exhausted');
  }
}
