/**
 * CsvDataProvider — serves real historical NSE data from CSV files.
 *
 * Data layout (one CSV per symbol per interval, written by
 * `scripts/fetch-watchlist-csv.js`):
 *   data/<SYMBOL>_1min.csv   (7 days of 1m)
 *   data/<SYMBOL>_5min.csv   (30 days of 5m)
 *   data/<SYMBOL>_15min.csv  (30 days of 15m)
 *   data/<SYMBOL>_1d.csv     (365 days of daily)
 *
 * Latest-day rule:
 *   - The **latest day** in a CSV is treated as LIVE (current price / ticks).
 *   - All days **before** the latest day are treated as HISTORICAL.
 *
 * Symbols without a CSV fall back to the random-walk generator.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Candle, CandleInterval, Tick } from '../types';
import { intervalToMs } from '../utils/date-utils';

export interface CsvRow {
  instrument_token: number;
  timestamp: string;
  last_price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bid: number;
  ask: number;
  buy_quantity: number;
  sell_quantity: number;
}

// Finest-first so quotes use the most granular data available.
const INTERVAL_ORDER = ['1min', '5min', '15min', '1d'] as const;
type CsvInterval = (typeof INTERVAL_ORDER)[number];

const INTERVAL_TO_KEY: Record<string, CsvInterval> = {
  minute: '1min',
  '1minute': '1min',
  '5minute': '5min',
  '15minute': '15min',
  day: '1d',
};

export class CsvDataProvider {
  private data = new Map<number, Map<CsvInterval, CsvRow[]>>();
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  /** Scan the data directory and load all `<SYMBOL>_<interval>.csv` files. */
  load(): void {
    if (!fs.existsSync(this.dataDir)) return;
    const files = fs.readdirSync(this.dataDir).filter((f) => f.endsWith('.csv'));
    for (const file of files) {
      const match = file.match(/^(.+)_(1min|5min|15min|1d)\.csv$/);
      if (!match) continue;
      const interval = match[2] as CsvInterval;
      const rows = this.parseCsv(path.join(this.dataDir, file));
      if (rows.length === 0) continue;
      const token = rows[0].instrument_token;
      if (!this.data.has(token)) this.data.set(token, new Map());
      this.data.get(token)!.set(interval, rows);
    }
  }

  private parseCsv(file: string): CsvRow[] {
    const text = fs.readFileSync(file, 'utf-8');
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const header = lines[0].split(',');
    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < header.length) continue;
      const row: Record<string, string> = {};
      header.forEach((h, idx) => {
        row[h.trim()] = cols[idx]?.trim() ?? '';
      });
      const close = Number(row.close);
      if (!Number.isFinite(close)) continue;
      rows.push({
        instrument_token: Number(row.instrument_token),
        timestamp: row.timestamp,
        last_price: Number(row.last_price ?? close),
        open: Number(row.open ?? close),
        high: Number(row.high ?? close),
        low: Number(row.low ?? close),
        close,
        volume: Number(row.volume ?? 0),
        bid: Number(row.bid ?? close),
        ask: Number(row.ask ?? close),
        buy_quantity: Number(row.buy_quantity ?? 0),
        sell_quantity: Number(row.sell_quantity ?? 0),
      });
    }
    return rows;
  }

  /** Whether a symbol (by token) has any CSV data. */
  hasData(token: number): boolean {
    return this.data.has(token);
  }

  /** The finest interval available for a token. */
  private finestInterval(token: number): CsvInterval | undefined {
    const intervals = this.data.get(token);
    if (!intervals) return undefined;
    for (const iv of INTERVAL_ORDER) {
      if (intervals.has(iv)) return iv;
    }
    return undefined;
  }

  /** The latest day (YYYY-MM-DD) present in a given interval's rows. */
  private latestDay(token: number, interval: CsvInterval): string | undefined {
    const rows = this.data.get(token)?.get(interval);
    if (!rows || rows.length === 0) return undefined;
    let latest = '';
    for (const r of rows) {
      const day = r.timestamp.slice(0, 10);
      if (day > latest) latest = day;
    }
    return latest;
  }

  /** Latest tick (current price) from the finest CSV — the LIVE day. */
  getLatestTick(token: number): Tick | undefined {
    const interval = this.finestInterval(token);
    if (!interval) return undefined;
    const rows = this.data.get(token)!.get(interval)!;
    const latest = rows[rows.length - 1];
    return this.rowToTick(latest);
  }

  /** The latest day's rows (for live tick streaming). */
  getLatestDayRows(token: number): CsvRow[] | undefined {
    const interval = this.finestInterval(token);
    if (!interval) return undefined;
    const rows = this.data.get(token)!.get(interval)!;
    const day = this.latestDay(token, interval);
    if (!day) return undefined;
    return rows.filter((r) => r.timestamp.slice(0, 10) === day);
  }

  /**
   * Historical candles for days strictly before the latest day, at the
   * requested interval (exact CSV, or aggregated up from a finer one).
   */
  getHistoricalData(
    token: number,
    interval: CandleInterval,
    from: Date,
    to: Date
  ): Candle[] {
    const intervals = this.data.get(token);
    if (!intervals) return [];

    const key = INTERVAL_TO_KEY[interval];
    const exact = key ? intervals.get(key) : undefined;
    const source = exact ?? (this.finestInterval(token) ? intervals.get(this.finestInterval(token)!) : undefined);
    if (!source) return [];

    const sourceKey = exact ? key : this.finestInterval(token)!;
    const liveDay = this.latestDay(token, sourceKey);
    if (!liveDay) return [];

    // Historical = days strictly before the live day, within [from, to].
    const prior = source.filter((r) => {
      const day = r.timestamp.slice(0, 10);
      if (day >= liveDay) return false;
      const t = new Date(r.timestamp).getTime();
      return t >= from.getTime() && t <= to.getTime();
    });
    if (prior.length === 0) return [];

    if (exact) {
      return prior.map((r) => [r.timestamp, r.open, r.high, r.low, r.close, r.volume, 0]);
    }
    return this.aggregate(prior, interval);
  }

  /** Aggregate finer rows into the requested interval. */
  private aggregate(rows: CsvRow[], interval: CandleInterval): Candle[] {
    const intervalMs = intervalToMs(interval);
    const buckets = new Map<number, CsvRow[]>();
    for (const r of rows) {
      const t = new Date(r.timestamp).getTime();
      const start = Math.floor(t / intervalMs) * intervalMs;
      if (!buckets.has(start)) buckets.set(start, []);
      buckets.get(start)!.push(r);
    }
    const candles: Candle[] = [];
    for (const start of Array.from(buckets.keys()).sort((a, b) => a - b)) {
      const bucket = buckets.get(start)!;
      const open = bucket[0].open;
      let high = bucket[0].high;
      let low = bucket[0].low;
      const close = bucket[bucket.length - 1].close;
      let volume = 0;
      for (const r of bucket) {
        high = Math.max(high, r.high);
        low = Math.min(low, r.low);
        volume += r.volume;
      }
      candles.push([new Date(start).toISOString(), open, high, low, close, volume, 0]);
    }
    return candles;
  }

  private rowToTick(r: CsvRow): Tick {
    const ts = new Date(r.timestamp);
    return {
      tradable: true,
      mode: 'full',
      instrument_token: r.instrument_token,
      last_price: r.close,
      last_traded_quantity: Math.round(r.volume * 0.1),
      average_traded_price: r.close,
      volume_traded: r.volume,
      total_buy_quantity: r.buy_quantity,
      total_sell_quantity: r.sell_quantity,
      ohlc: { open: r.open, high: r.high, low: r.low, close: r.close },
      change: r.close - r.open,
      last_trade_time: ts,
      exchange_timestamp: ts,
      depth: {
        buy: [{ price: r.bid, quantity: r.buy_quantity, orders: 1 }],
        sell: [{ price: r.ask, quantity: r.sell_quantity, orders: 1 }],
      },
    };
  }
}

/**
 * CsvTickGenerator — streams the latest (live) day's rows as ticks.
 *
 * Implements the same `generateTick()` surface as RandomWalkGenerator so the
 * GeneratorPool can use it interchangeably. Advances through the latest day's
 * rows, wrapping when exhausted (so the ticker keeps producing ticks).
 */
export class CsvTickGenerator {
  private rows: CsvRow[];
  private index = 0;

  constructor(rows: CsvRow[]) {
    this.rows = rows;
  }

  generateTick(): Tick {
    const row = this.rows[this.index % this.rows.length];
    this.index++;
    return this.toTick(row);
  }

  getCurrentPrice(): number {
    return this.rows[this.index % this.rows.length].close;
  }

  setCurrentPrice(price: number): void {
    // Not meaningful for CSV replay; ignore.
  }

  saveState(): { index: number } {
    return { index: this.index };
  }

  restoreState(state: { index: number }): void {
    this.index = state.index;
  }

  private toTick(r: CsvRow): Tick {
    const ts = new Date(r.timestamp);
    return {
      tradable: true,
      mode: 'full',
      instrument_token: r.instrument_token,
      last_price: r.close,
      last_traded_quantity: Math.round(r.volume * 0.1),
      average_traded_price: r.close,
      volume_traded: r.volume,
      total_buy_quantity: r.buy_quantity,
      total_sell_quantity: r.sell_quantity,
      ohlc: { open: r.open, high: r.high, low: r.low, close: r.close },
      change: r.close - r.open,
      last_trade_time: ts,
      exchange_timestamp: ts,
      depth: {
        buy: [{ price: r.bid, quantity: r.buy_quantity, orders: 1 }],
        sell: [{ price: r.ask, quantity: r.sell_quantity, orders: 1 }],
      },
    };
  }
}
