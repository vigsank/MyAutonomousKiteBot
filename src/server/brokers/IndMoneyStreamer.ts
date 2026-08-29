/**
 * IndMoneyStreamer — INDstocks (INDmoney) data provider.
 *
 * Implements BOTH `HistoricalDataProvider` (backtests) and `LiveDataProvider`
 * (paper/live trading) over the INDstocks REST + WebSocket surface. This lets
 * the bot paper-trade on REAL current INDmoney data, and backtest on REAL
 * INDmoney history.
 *
 * Key mappings (see indmoneyMapping.ts):
 *   - `security_id` (numeric string) → `instrument_token` (number)
 *   - scrip codes: `NSE_3045` (REST) / `NSE:2885` (WebSocket)
 *   - historical candles: `ts` is epoch seconds; request times are ms
 *
 * Order execution is NOT part of this class — see IndMoneyBrokerAccount.
 */

import { AppConfig } from '../AppConfig';
import { logger } from '../Logger';
import {
  HistoricalDataProvider,
  LiveDataProvider,
} from '../MarketDataProvider';
import { Candle, Instrument, Quote, Segment, Tick } from '../types';
import { IndMoneyClient, IndTokenState } from './IndMoneyClient';
import {
  maxRangeMs,
  scripCode,
  securityIdToToken,
  toIndInterval,
  wsInstrument,
} from './indmoneyMapping';

/** INDstocks instrument-master CSV columns (equity/fno, 16 columns). */
const CSV = {
  EXCH: 0,
  SEGMENT: 1,
  SECURITY_ID: 2,
  INSTRUMENT_NAME: 3,
  EXPIRY_CODE: 4,
  TRADING_SYMBOL: 5,
  LOT_UNITS: 6,
  CUSTOM_SYMBOL: 7,
  EXPIRY_DATE: 8,
  STRIKE_PRICE: 9,
  OPTION_TYPE: 10,
  TICK_SIZE: 11,
  EXPIRY_FLAG: 12,
  SEM_EXCH_INSTRUMENT_TYPE: 13,
  SERIES: 14,
  SYMBOL_NAME: 15,
} as const;

/**
 * Known NSE symbol names that differ from the INDstocks master. When a watchlist
 * symbol isn't found, these aliases are tried before giving up — this resolves
 * same-company/different-ticker gaps (e.g. REC is listed as RECLTD).
 */
const SYMBOL_ALIASES: Record<string, string> = {
  BERGERPAINT: 'BERGEPAINT',
  REC: 'RECLTD',
  SHREEBACEM: 'SHREECEM',
  INFOSYS: 'INFY',
};

export class IndMoneyStreamer implements HistoricalDataProvider, LiveDataProvider {
  readonly name = 'indmoney';
  private client: IndMoneyClient;
  private instruments = new Map<number, Instrument>();
  private ws: import('ws').WebSocket | null = null;
  private wsTokens: number[] = [];
  private wsOnTick: ((ticks: Tick[]) => void) | null = null;
  private wsReconnectAttempts = 0;
  private wsReconnectTimer: NodeJS.Timeout | null = null;
  private wsStopped = false;

  /** INDstocks allows up to 3 active WebSocket connections per user. */
  private static readonly MAX_WS_RECONNECTS = 3;
  private static readonly WS_RECONNECT_BASE_MS = 2_000;
  private static readonly WS_RECONNECT_MAX_MS = 30_000;

  constructor(private readonly config: AppConfig) {
    this.client = new IndMoneyClient({
      accessToken: config.broker.indmoney.accessToken,
      baseUrl: config.broker.indmoney.baseUrl,
      timeoutMs: config.broker.indmoney.timeoutMs,
      rateDelayMs: config.broker.indmoney.rateDelayMs,
      maxRetries: config.broker.indmoney.maxRetries,
      retryBaseMs: config.broker.indmoney.retryBaseMs,
      rateLimit: {
        perSecond: config.broker.indmoney.ratePerSecond,
        perDay: config.broker.indmoney.ratePerDay,
        warnPct: config.broker.indmoney.rateWarnPct,
        maxWaitMs: config.broker.indmoney.rateMaxWaitMs,
        haltOn429: config.broker.indmoney.rateHaltOn429,
        halt429Threshold: config.broker.indmoney.rate429Threshold,
        cooldownMs: config.broker.indmoney.rateCooldownMs,
        haltOnLimit: config.broker.indmoney.rateHaltOnLimit,
      },
    });
  }

  get isConfigured(): boolean {
    return this.client.isConfigured;
  }

  /** Current token state, updated on every request. */
  get tokenState(): IndTokenState {
    return this.client.tokenState;
  }

  /** Proactively verify the access token (updates tokenState). */
  async verifyToken(): Promise<boolean> {
    return this.client.verifyToken();
  }

  /* ------------------------------------------------------------ */
  /* Instruments                                                    */
  /* ------------------------------------------------------------ */

  async loadInstruments(exchange: Segment = 'NSE'): Promise<void> {
    if (!this.isConfigured) return;

    const source = exchange === 'NFO' || exchange === 'BFO' ? 'fno' : 'equity';
    const csv = await this.fetchCsv(`/market/instruments?source=${source}`);
    if (!csv) {
      logger.warn({ source }, 'IndMoneyStreamer: instrument CSV fetch failed');
      return;
    }

    const rows = parseCsv(csv);
    let added = 0;
    for (const row of rows) {
      if (row.length < 16) continue;
      const exch = row[CSV.EXCH]?.trim().toUpperCase();
      // Equity-only scope: skip F&O rows (SEGMENT != 'E').
      const seg = row[CSV.SEGMENT]?.trim().toUpperCase();
      if (source === 'equity' && seg !== 'E') continue;

      const securityId = row[CSV.SECURITY_ID]?.trim();
      const token = securityIdToToken(securityId);
      if (token === null) {
        logger.warn({ securityId }, 'IndMoneyStreamer: non-numeric security_id skipped');
        continue;
      }

      const tradingsymbol = row[CSV.TRADING_SYMBOL]?.trim() || row[CSV.SYMBOL_NAME]?.trim();
      if (!tradingsymbol) continue;

      const segType: Segment = exch === 'BSE' ? 'BSE' : 'NSE';
      this.instruments.set(token, {
        instrument_token: token,
        exchange_token: securityId,
        tradingsymbol,
        name: row[CSV.SYMBOL_NAME]?.trim() || tradingsymbol,
        last_price: 0,
        tick_size: Number(row[CSV.TICK_SIZE]) || 0.05,
        lot_size: Number(row[CSV.LOT_UNITS]) || 1,
        instrument_type: 'EQ',
        segment: segType,
        exchange: segType,
        security_id: securityId,
      });
      added++;
    }
    logger.info({ added, source }, 'IndMoneyStreamer: instruments loaded');
  }

  findInstrument(tradingsymbol: string, exchange: string): Instrument | null {
    const direct = this.lookupTradingsymbol(tradingsymbol, exchange);
    if (direct) return direct;
    // Symbol-gap fallback: try the INDstocks alias (same company, different ticker).
    const alias = SYMBOL_ALIASES[tradingsymbol.toUpperCase()];
    if (alias) return this.lookupTradingsymbol(alias, exchange);
    return null;
  }

  private lookupTradingsymbol(tradingsymbol: string, exchange: string): Instrument | null {
    for (const inst of this.instruments.values()) {
      if (inst.tradingsymbol === tradingsymbol && inst.exchange === exchange) {
        return inst;
      }
    }
    return null;
  }

  /**
   * Report which of the given symbols could not be resolved against the
   * INDstocks master (after aliases). Used by callers to surface coverage gaps
   * visibly instead of silently dropping names.
   */
  unresolvedSymbols(symbols: string[]): string[] {
    return symbols.filter((s) => !this.findInstrument(s, 'NSE'));
  }

  getInstrument(token: number): { tradingsymbol: string; exchange: string } | null {
    const inst = this.instruments.get(token);
    if (!inst) return null;
    return { tradingsymbol: inst.tradingsymbol, exchange: inst.exchange };
  }

  /* ------------------------------------------------------------ */
  /* Historical data                                                */
  /* ------------------------------------------------------------ */

  async getHistoricalData(
    instrumentToken: number,
    interval: string,
    from: Date,
    to: Date,
  ): Promise<Candle[]> {
    if (!this.isConfigured) return [];

    const indInterval = toIndInterval(interval);
    const range = maxRangeMs(interval);
    const code = scripCode(this.exchangeForToken(instrumentToken), instrumentToken);

    // Walk backwards from `to` in max-range windows, stitching candles.
    const candles = new Map<number, Candle>();
    let windowEnd = to.getTime();
    const fromMs = from.getTime();

    while (windowEnd > fromMs) {
      const windowStart = Math.max(fromMs, windowEnd - range);
      const batch = await this.client.getHistorical(
        indInterval,
        [code],
        windowStart,
        windowEnd,
      );
      const scrip = batch[code];
      if (scrip?.candles) {
        for (const c of scrip.candles) {
          const tsMs = c.ts * 1000; // candle ts is epoch seconds
          candles.set(tsMs, {
            date: new Date(tsMs),
            open: c.o,
            high: c.h,
            low: c.l,
            close: c.c,
            volume: c.v ?? 0,
          });
        }
      }
      windowEnd = windowStart;
    }

    return [...candles.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /* ------------------------------------------------------------ */
  /* Quotes                                                         */
  /* ------------------------------------------------------------ */

  /** Fetch a live full quote for a symbol (parity with KiteStreamer.getQuote). */
  async getQuote(symbol: string, exchange: Segment): Promise<Quote | null> {
    const inst = this.findInstrument(symbol, exchange);
    if (!inst) return null;
    const code = scripCode(exchange, inst.instrument_token);
    const quotes = await this.client.getFullQuotes([code]);
    const q = quotes[code];
    if (!q) return null;
    return {
      instrument_token: inst.instrument_token,
      timestamp: new Date(),
      last_price: q.live_price,
      volume: q.volume,
      average_price: q.live_price,
      oi: 0,
      ohlc: {
        open: q.day_open,
        high: q.day_high,
        low: q.day_low,
        close: q.prev_close,
      },
      change: q.day_change,
    };
  }

  /* ------------------------------------------------------------ */
  /* WebSocket ticks                                                */
  /* ------------------------------------------------------------ */

  startTicker(tokens: number[], onTick: (ticks: Tick[]) => void): void {
    if (this.ws) return;
    if (!this.isConfigured) return;
    this.wsTokens = tokens;
    this.wsOnTick = onTick;
    this.wsStopped = false;
    this.wsReconnectAttempts = 0;
    this.connect();
  }

  stopTicker(): void {
    this.wsStopped = true;
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** Open (or re-open) the price-feed WebSocket. */
  private connect(): void {
    const WebSocket = require('ws') as typeof import('ws');
    const ws = new WebSocket(this.config.broker.indmoney.wsPricesUrl, {
      headers: { Authorization: this.config.broker.indmoney.accessToken },
    });
    this.ws = ws;

    ws.on('open', () => {
      this.wsReconnectAttempts = 0; // reset on a successful connect
      const instruments = this.wsTokens.map((t) => wsInstrument(this.exchangeForToken(t), t));
      ws.send(JSON.stringify({ action: 'subscribe', mode: 'ltp', instruments }));
      logger.info({ tokens: this.wsTokens.length }, 'IndMoneyStreamer: ticker subscribed');
    });

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        // Price feed: { mode, instrument, timestamp, data: { ltp } }
        if (msg && msg.mode === 'ltp' && msg.instrument && msg.data?.ltp !== undefined) {
          const token = Number(msg.instrument);
          if (!Number.isFinite(token)) return;
          this.wsOnTick?.([
            {
              instrument_token: token,
              last_price: msg.data.ltp,
              exchange_timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
            },
          ]);
        }
      } catch {
        // ignore malformed frames
      }
    });

    ws.on('error', (err: Error) => {
      logger.warn({ err: err?.message }, 'IndMoneyStreamer: ticker error');
    });

    ws.on('close', () => {
      this.ws = null;
      if (this.wsStopped) {
        logger.info('IndMoneyStreamer: ticker closed (intentional)');
        return;
      }
      this.scheduleReconnect();
    });
  }

  /** Schedule a reconnect with exponential backoff, capped at 3 attempts. */
  private scheduleReconnect(): void {
    if (this.wsReconnectAttempts >= IndMoneyStreamer.MAX_WS_RECONNECTS) {
      logger.error(
        { attempts: this.wsReconnectAttempts },
        'IndMoneyStreamer: ticker reconnect limit reached (3 connections) — giving up',
      );
      return;
    }
    const delay = Math.min(
      IndMoneyStreamer.WS_RECONNECT_BASE_MS * Math.pow(2, this.wsReconnectAttempts),
      IndMoneyStreamer.WS_RECONNECT_MAX_MS,
    );
    this.wsReconnectAttempts++;
    logger.warn(
      { attempt: this.wsReconnectAttempts, delayMs: delay },
      'IndMoneyStreamer: ticker reconnecting',
    );
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      this.connect();
    }, delay);
  }

  /* ------------------------------------------------------------ */
  /* Internals                                                      */
  /* ------------------------------------------------------------ */

  private exchangeForToken(token: number): string {
    return this.instruments.get(token)?.exchange ?? 'NSE';
  }

  private async fetchCsv(path: string): Promise<string | null> {
    if (!this.isConfigured) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.broker.indmoney.timeoutMs);
    try {
      const res = await fetch(`${this.config.broker.indmoney.baseUrl}${path}`, {
        headers: { Authorization: this.config.broker.indmoney.accessToken },
        signal: controller.signal,
      });
      if (!res.ok) {
        logger.warn({ path, status: res.status }, 'IndMoneyStreamer: CSV fetch failed');
        return null;
      }
      return await res.text();
    } catch (err) {
      logger.warn({ path, err: (err as Error)?.message }, 'IndMoneyStreamer: CSV fetch error');
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Minimal CSV parser (no quoted-field handling — INDstocks CSV is simple). */
function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  // Skip the header row.
  return lines.slice(1).map((l) => l.split(','));
}
