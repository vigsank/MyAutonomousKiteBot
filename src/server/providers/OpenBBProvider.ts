import { HistoricalDataProvider, kiteIntervalToYahoo } from '../MarketDataProvider';
import { Candle, Instrument } from '../types';
import { logger } from '../Logger';

/** Map a Kite interval string to an OpenBB yfinance interval. */
function kiteIntervalToOpenBB(interval: string): string {
  const map: Record<string, string> = {
    minute: '1m',
    '2minute': '2m',
    '5minute': '5m',
    '15minute': '15m',
    '30minute': '30m',
    '60minute': '60m',
    hour: '1h',
    day: '1d',
    week: '1wk',
    month: '1mo',
  };
  return map[interval] ?? '1d';
}

/**
 * OpenBBProvider — account-free BACKTEST provider via the OpenBB Platform.
 *
 * OpenBB is an open-source (AGPLv3) Python platform that aggregates many free
 * data sources (including Yahoo Finance) behind one consistent local REST API.
 * It runs as a local FastAPI server (`openbb-api`, default http://127.0.0.1:6900).
 *
 * This provider calls that REST API over HTTP from Node. It uses the account-free
 * `yfinance` provider inside OpenBB by default.
 *
 * Setup (once):  pip install "openbb[all]" && openbb-api
 * Env: OPENBB_BASE_URL (default http://127.0.0.1:6900)
 */
export class OpenBBProvider implements HistoricalDataProvider {
  readonly name = 'openbb';
  readonly isConfigured = true; // no external account; needs the local server running

  private tokens = new Map<number, { tradingsymbol: string; exchange: string }>();
  private tokenBase = 30_000;

  private get baseUrl(): string {
    return process.env.OPENBB_BASE_URL || 'http://127.0.0.1:6900';
  }

  async loadInstruments(_exchange = 'NSE'): Promise<void> {
    // No instrument master; tokens are synthesised on demand.
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
    if (!inst) throw new Error(`OpenBB provider: unknown token ${instrumentToken}.`);

    const url = this.buildUrl(inst.tradingsymbol, interval, from, to);
    logger.debug({ url }, 'Fetching OpenBB history');

    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      throw new Error(`OpenBB HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { results?: Array<Record<string, unknown>> };

    return (json.results ?? [])
      .filter((r) =>
        ['open', 'high', 'low', 'close'].every((k) => Number.isFinite(Number(r[k]))),
      )
      .map((r) => ({
        date: new Date(String(r.date)),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume ?? 0),
      }));
  }

  private buildUrl(symbol: string, interval: string, from: Date, to: Date): string {
    const params = new URLSearchParams({
      provider: 'yfinance',
      symbol,
      start_date: from.toISOString().slice(0, 10),
      end_date: to.toISOString().slice(0, 10),
      interval: kiteIntervalToOpenBB(interval),
    });
    return `${this.baseUrl}/api/v1/equity/price/historical?${params.toString()}`;
  }
}

// Re-export helper for parity with the Yahoo provider.
export { kiteIntervalToYahoo };
