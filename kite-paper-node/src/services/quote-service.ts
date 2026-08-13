/**
 * Quote Service — serves /quote, /ohlc, and /ltp by reading the latest
 * generated tick from the generator pool (100% JIT data).
 *
 * Response shapes match the real `kiteconnect` `getQuote`/`getOHLC`/`getLTP`
 * contracts, including `net_change`, `buy_quantity`/`sell_quantity`,
 * `last_quantity`, circuit limits, and `depth: { buy, sell }`.
 */

import type { Tick } from '../types';
import { GeneratorPool } from '../market/generator-pool';
import { CsvDataProvider } from '../market/csv-data-provider';
import { errors } from '../protocol/errors';

export class QuoteService {
  constructor(
    private pool: GeneratorPool,
    private csvDataProvider?: CsvDataProvider
  ) {}

  /** Normalize a single instrument id or array into an array. */
  private normalize(instruments: string | string[]): string[] {
    return Array.isArray(instruments) ? instruments : [instruments];
  }

  private getTickFor(id: string): Tick {
    const symbol = id.includes(':') ? id.split(':')[1] : id;
    const inst = this.pool.resolveSymbol(symbol);
    if (!inst) {
      throw errors.input(`Instrument not found: ${id}`);
    }
    // Prefer real CSV data (latest day) when present.
    const csvTick = this.csvDataProvider?.getLatestTick(inst.instrument_token);
    if (csvTick) return csvTick;
    // Ensure a generator is running so JIT data is available on demand.
    this.pool.ensureGenerator(inst.instrument_token);
    const tick = this.pool.getLatestTick(inst.instrument_token);
    if (!tick) {
      // No tick generated yet — synthesize one on demand (JIT).
      const gen = this.pool.getGenerator(inst.instrument_token);
      if (gen) {
        return gen.generateTick();
      }
      throw errors.input(`No data available for: ${id}`);
    }
    return tick;
  }

  getQuote(instruments: string | string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const id of this.normalize(instruments)) {
      const tick = this.getTickFor(id);
      const close = tick.ohlc.close || tick.last_price;
      const netChange = tick.last_price - close;
      const circuit = this.circuitLimits(tick);
      result[id] = {
        instrument_token: tick.instrument_token,
        timestamp: tick.exchange_timestamp?.toISOString() ?? null,
        last_trade_time: tick.last_trade_time?.toISOString() ?? null,
        last_price: tick.last_price,
        volume: tick.volume_traded,
        average_price: tick.average_traded_price,
        buy_quantity: tick.total_buy_quantity,
        sell_quantity: tick.total_sell_quantity,
        open_interest: tick.oi ?? 0,
        last_quantity: tick.last_traded_quantity,
        ohlc: tick.ohlc,
        net_change: netChange,
        lower_circuit_limit: circuit.lower,
        upper_circuit_limit: circuit.upper,
        oi: tick.oi ?? 0,
        oi_day_high: tick.oi_day_high ?? 0,
        oi_day_low: tick.oi_day_low ?? 0,
        depth: tick.depth ?? { buy: [], sell: [] },
      };
    }
    return result;
  }

  getOHLC(instruments: string | string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const id of this.normalize(instruments)) {
      const tick = this.getTickFor(id);
      result[id] = {
        instrument_token: tick.instrument_token,
        last_price: tick.last_price,
        ohlc: tick.ohlc,
      };
    }
    return result;
  }

  getLTP(instruments: string | string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const id of this.normalize(instruments)) {
      const tick = this.getTickFor(id);
      result[id] = {
        instrument_token: tick.instrument_token,
        last_price: tick.last_price,
      };
    }
    return result;
  }

  private circuitLimits(tick: Tick): { lower: number; upper: number } {
    const base = tick.ohlc.close || tick.last_price;
    return {
      lower: Math.round(base * 0.95 * 100) / 100,
      upper: Math.round(base * 1.05 * 100) / 100,
    };
  }
}
