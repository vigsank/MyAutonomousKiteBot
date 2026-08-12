/**
 * Tick History Buffer — a circular per-symbol buffer of recent ticks.
 *
 * Used to serve recent historical candles (Tier 1 of the historical data
 * strategy) that are 100% consistent with what a WebSocket subscriber saw.
 */

import type { Candle, CandleInterval, Tick } from '../types';
import { intervalToMs } from '../utils/date-utils';
import { DEFAULT_TICK_BUFFER_SIZE } from '../protocol/constants';

export class TickHistoryBuffer {
  private buffers = new Map<number, Tick[]>();
  private readonly capacity: number;

  constructor(capacity = DEFAULT_TICK_BUFFER_SIZE) {
    this.capacity = capacity;
  }

  /** Append a tick to the buffer for its instrument. */
  push(tick: Tick): void {
    let buf = this.buffers.get(tick.instrument_token);
    if (!buf) {
      buf = [];
      this.buffers.set(tick.instrument_token, buf);
    }
    buf.push(tick);
    if (buf.length > this.capacity) {
      buf.splice(0, buf.length - this.capacity);
    }
  }

  /** Get all buffered ticks for a token. */
  getTicks(token: number): Tick[] {
    return this.buffers.get(token) ?? [];
  }

  /** Get ticks for a token within a time range. */
  getTicksInRange(token: number, from: Date, to: Date): Tick[] {
    const fromMs = from.getTime();
    const toMs = to.getTime();
    return (this.buffers.get(token) ?? []).filter((t) => {
      const ts = t.exchange_timestamp.getTime();
      return ts >= fromMs && ts <= toMs;
    });
  }

  /**
   * Aggregate buffered ticks into candles at the requested interval.
   * Returns candles as [timestamp, open, high, low, close, volume, oi].
   */
  getCandles(
    token: number,
    interval: CandleInterval,
    from: Date,
    to: Date
  ): Candle[] {
    const ticks = this.getTicksInRange(token, from, to);
    if (ticks.length === 0) return [];

    const intervalMs = intervalToMs(interval);
    const buckets = new Map<number, Tick[]>();

    for (const tick of ticks) {
      const bucketStart =
        Math.floor(tick.exchange_timestamp.getTime() / intervalMs) * intervalMs;
      if (!buckets.has(bucketStart)) buckets.set(bucketStart, []);
      buckets.get(bucketStart)!.push(tick);
    }

    const candles: Candle[] = [];
    const sortedStarts = Array.from(buckets.keys()).sort((a, b) => a - b);
    for (const start of sortedStarts) {
      const bucket = buckets.get(start)!;
      const open = bucket[0].ohlc.open;
      let high = bucket[0].ohlc.high;
      let low = bucket[0].ohlc.low;
      const close = bucket[bucket.length - 1].ohlc.close;
      let volume = 0;
      let oi = 0;
      for (const t of bucket) {
        high = Math.max(high, t.ohlc.high);
        low = Math.min(low, t.ohlc.low);
        volume += t.volume_traded;
        oi = t.open_interest ?? oi;
      }
      candles.push([
        new Date(start).toISOString(),
        open,
        high,
        low,
        close,
        volume,
        oi,
      ]);
    }
    return candles;
  }

  /** Clear all buffers. */
  clear(): void {
    this.buffers.clear();
  }
}
