/**
 * Historical Replay Engine — replays pre-recorded tick data (CSV or array)
 * deterministically, with configurable speed and loop modes.
 */

import * as fs from 'fs';
import type { Tick, TickRecord } from '../types';
import { TickEventBus } from './tick-event-bus';
import { sleep } from '../utils/date-utils';

export interface HistoricalReplayOptions {
  source: string | TickRecord[];
  replaySpeed?: number; // 0 = instant, 1 = real-time, 2 = 2x, ...
  loopMode?: 'once' | 'loop' | 'bounce';
  startTimestamp?: string;
  endTimestamp?: string;
}

export class HistoricalReplayEngine {
  private running = false;
  private stopped = false;

  constructor(private bus: TickEventBus) {}

  /** Parse a CSV string into tick records. */
  static parseCSV(csv: string): TickRecord[] {
    const lines = csv.trim().split(/\r?\n/);
    const header = lines[0].split(',');
    const records: TickRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',');
      const rec: any = {};
      header.forEach((h, idx) => {
        rec[h.trim()] = cols[idx]?.trim();
      });
      records.push({
        instrument_token: Number(rec.instrument_token),
        timestamp: rec.timestamp,
        last_price: Number(rec.last_price),
        open: Number(rec.open),
        high: Number(rec.high),
        low: Number(rec.low),
        close: Number(rec.close),
        volume: Number(rec.volume),
        bid: Number(rec.bid ?? rec.last_price),
        ask: Number(rec.ask ?? rec.last_price),
        buy_quantity: Number(rec.buy_quantity ?? 0),
        sell_quantity: Number(rec.sell_quantity ?? 0),
      });
    }
    return records;
  }

  /** Load records from a CSV file path or an array. */
  private loadRecords(source: string | TickRecord[]): TickRecord[] {
    if (Array.isArray(source)) return source;
    const csv = fs.readFileSync(source, 'utf-8');
    return HistoricalReplayEngine.parseCSV(csv);
  }

  private toTick(rec: TickRecord): Tick {
    const ts = new Date(rec.timestamp);
    return {
      tradable: true,
      mode: 'full',
      instrument_token: rec.instrument_token,
      last_price: rec.last_price,
      last_traded_quantity: Math.round(rec.volume * 0.1),
      average_traded_price: rec.last_price,
      volume_traded: rec.volume,
      total_buy_quantity: rec.buy_quantity,
      total_sell_quantity: rec.sell_quantity,
      ohlc: { open: rec.open, high: rec.high, low: rec.low, close: rec.close },
      change: rec.last_price - rec.open,
      last_trade_time: ts,
      exchange_timestamp: ts,
      depth: {
        buy: [{ price: rec.bid, quantity: rec.buy_quantity, orders: 1 }],
        sell: [{ price: rec.ask, quantity: rec.sell_quantity, orders: 1 }],
      },
    };
  }

  /**
   * Start replaying. Resolves when replay completes (or immediately for
   * instant mode). Emits 'replay_complete' on the bus when finished.
   */
  async start(options: HistoricalReplayOptions): Promise<number> {
    const records = this.loadRecords(options.source);
    const speed = options.replaySpeed ?? 1;
    const loopMode = options.loopMode ?? 'once';

    let list = records.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (options.startTimestamp) {
      list = list.filter((r) => r.timestamp >= options.startTimestamp!);
    }
    if (options.endTimestamp) {
      list = list.filter((r) => r.timestamp <= options.endTimestamp!);
    }

    this.running = true;
    this.stopped = false;
    let emitted = 0;

    if (speed === 0) {
      // Instant batch mode.
      for (const rec of list) {
        if (this.stopped) break;
        this.bus.publish(this.toTick(rec));
        emitted++;
      }
      this.bus.emit('replay_complete', { source: String(options.source), ticksEmitted: emitted });
      this.running = false;
      return emitted;
    }

    // Timed mode with loop support.
    let direction = 1;
    let index = 0;
    while (this.running && !this.stopped) {
      const rec = list[index];
      if (!rec) {
        if (loopMode === 'once') break;
        if (loopMode === 'loop') {
          index = 0;
          continue;
        }
        if (loopMode === 'bounce') {
          direction *= -1;
          index = Math.max(0, list.length - 2);
          continue;
        }
        break;
      }

      this.bus.publish(this.toTick(rec));
      emitted++;

      // Determine delay to next tick.
      const next = list[index + direction];
      if (next) {
        const delta = new Date(next.timestamp).getTime() - new Date(rec.timestamp).getTime();
        const delay = Math.max(0, delta / speed);
        await sleep(delay);
      }
      index += direction;
    }

    this.bus.emit('replay_complete', { source: String(options.source), ticksEmitted: emitted });
    this.running = false;
    return emitted;
  }

  /** Stop replaying. */
  stop(): void {
    this.stopped = true;
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }
}
