/**
 * Position Service — REST-facing position queries.
 *
 * Returns the real `kiteconnect` `getPositions` shape: `{ net, day }`.
 */

import type { PositionRecord, PositionsResponse } from '../types';
import { PositionEngine } from '../core/position-engine';

export class PositionService {
  constructor(private positionEngine: PositionEngine) {}

  getPositions(): PositionsResponse {
    const all = this.positionEngine.getPositions();
    return {
      net: all,
      day: all.filter((p) => p.day_buy_quantity > 0 || p.day_sell_quantity > 0),
    };
  }

  getPosition(token: number): PositionRecord | undefined {
    return this.positionEngine.getPosition(token);
  }
}
