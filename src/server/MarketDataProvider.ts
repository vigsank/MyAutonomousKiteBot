import { Candle, Instrument, Tick } from './types';

/**
 * HistoricalDataProvider — used ONLY for backtests / simulations.
 *
 * Provides historical candles and instrument resolution. No live streaming.
 * Default implementation is Yahoo Finance (account-free); Kite can also serve
 * real historical data when credentials are present.
 */
export interface HistoricalDataProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  /** Load the instrument map (Kite reads the master list; others build on demand). */
  loadInstruments(exchange?: string): Promise<void>;
  /** Resolve a symbol+exchange to a full instrument (synthesising a token if needed). */
  findInstrument(tradingsymbol: string, exchange: string): Instrument | null;
  /** Fetch historical OHLC candles. */
  getHistoricalData(
    instrumentToken: number,
    interval: string,
    from: Date,
    to: Date,
  ): Promise<Candle[]>;
}

/**
 * LiveDataProvider — used ONLY for live (paper or real) trading.
 *
 * Provides real-time websocket ticks and live quotes. Default is Zerodha Kite.
 */
export interface LiveDataProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  loadInstruments(exchange?: string): Promise<void>;
  /** Resolve a token to its symbol (used by the live tick loop). */
  getInstrument(token: number): { tradingsymbol: string; exchange: string } | null;
  findInstrument(tradingsymbol: string, exchange: string): Instrument | null;
  /** Fetch historical OHLC candles (used for live indicator warmup). */
  getHistoricalData(
    instrumentToken: number,
    interval: string,
    from: Date,
    to: Date,
  ): Promise<Candle[]>;
  /** Start streaming live ticks. */
  startTicker(tokens: number[], onTick: (ticks: Tick[]) => void): void;
  /** Stop the live ticker. */
  stopTicker(): void;
}

/** Map a Kite interval string to a Yahoo Finance interval. */
export function kiteIntervalToYahoo(interval: string): string {
  const map: Record<string, string> = {
    minute: '1m',
    '2minute': '2m',
    '5minute': '5m',
    '10minute': '10m',
    '15minute': '15m',
    '30minute': '30m',
    '60minute': '60m',
    hour: '60m',
    day: '1d',
    week: '1wk',
    month: '1mo',
  };
  return map[interval] ?? '1d';
}
