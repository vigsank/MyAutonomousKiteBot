/**
 * Historical Service — serves /instruments/historical/{token}/{interval}.
 *
 * Two-tier strategy:
 *   Tier 1: aggregate real generated ticks from the tick history buffer.
 *   Tier 2: synthesize candles with the same Random Walk model for ranges
 *           before the buffer window, preserving continuity.
 *
 * Returns `HistoricalData[]` objects matching the real `kiteconnect`
 * `getHistoricalData` contract: `{ date, open, high, low, close, volume, oi? }`.
 */

import type { Candle, CandleInterval, HistoricalData } from '../types';
import { TickHistoryBuffer } from '../market/tick-history-buffer';
import { GeneratorPool } from '../market/generator-pool';
import { CsvDataProvider } from '../market/csv-data-provider';
import { intervalToMs } from '../utils/date-utils';

export class HistoricalService {
  constructor(
    private historyBuffer: TickHistoryBuffer,
    private pool: GeneratorPool,
    private csvDataProvider?: CsvDataProvider
  ) {}

  getHistoricalData(
    token: number,
    interval: CandleInterval,
    from: Date,
    to: Date
  ): HistoricalData[] {
    // Prefer real CSV data (days before the live day) when present.
    const csvCandles = this.csvDataProvider?.getHistoricalData(token, interval, from, to);
    if (csvCandles && csvCandles.length > 0) {
      return csvCandles.map((c) => this.toHistoricalData(c));
    }

    // Ensure a generator exists so synthetic (Tier 2) candles can be made.
    this.pool.ensureGenerator(token);

    // Tier 1: try the tick history buffer.
    const buffered = this.historyBuffer.getCandles(token, interval, from, to);
    if (buffered.length > 0) {
      return buffered.map((c) => this.toHistoricalData(c));
    }

    // Tier 2: synthesize candles using the generator model.
    return this.generateSyntheticCandles(token, interval, from, to);
  }

  private toHistoricalData(candle: Candle): HistoricalData {
    return {
      date: new Date(candle[0]),
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5],
      oi: candle[6] || undefined,
    };
  }

  private generateSyntheticCandles(
    token: number,
    interval: CandleInterval,
    from: Date,
    to: Date
  ): HistoricalData[] {
    const generator = this.pool.getGenerator(token);
    if (!generator) return [];

    const intervalMs = intervalToMs(interval);
    const numCandles = Math.max(
      1,
      Math.ceil((to.getTime() - from.getTime()) / intervalMs)
    );

    const savedState = generator.saveState();
    const candles: HistoricalData[] = [];
    let cursor = from.getTime();

    for (let i = 0; i < numCandles; i++) {
      const open = generator.getCurrentPrice();
      let high = open;
      let low = open;
      let close = open;
      let volume = 0;
      const subTicks = 5;
      for (let s = 0; s < subTicks; s++) {
        const tick = generator.generateTick();
        high = Math.max(high, tick.ohlc.high);
        low = Math.min(low, tick.ohlc.low);
        close = tick.last_price;
        volume += tick.volume_traded;
      }
      candles.push({
        date: new Date(cursor),
        open,
        high,
        low,
        close,
        volume,
      });
      cursor += intervalMs;
    }

    // Restore state but keep continuity with the last synthetic close.
    generator.restoreState(savedState);
    generator.setCurrentPrice(candles[candles.length - 1].close);

    return candles;
  }
}
