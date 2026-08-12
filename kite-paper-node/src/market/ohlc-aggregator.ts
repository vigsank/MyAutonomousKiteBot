/**
 * OHLC Aggregator — subscribes to the tick bus and feeds the tick history
 * buffer so that historical candle queries reflect live generated data.
 */

import type { Tick } from '../types';
import { TickEventBus } from './tick-event-bus';
import { TickHistoryBuffer } from './tick-history-buffer';

export class OHLCAggregator {
  private unsubscribe: () => void;

  constructor(
    private bus: TickEventBus,
    private historyBuffer: TickHistoryBuffer
  ) {
    this.unsubscribe = bus.subscribe((tick) => this.onTick(tick));
  }

  private onTick(tick: Tick): void {
    this.historyBuffer.push(tick);
  }

  /** Stop listening to the bus. */
  destroy(): void {
    this.unsubscribe();
  }
}
