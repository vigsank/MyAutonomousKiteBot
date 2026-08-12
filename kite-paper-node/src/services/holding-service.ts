/**
 * Holding Service — REST-facing holding queries.
 */

import type { HoldingRecord } from '../types';
import { StateStore } from '../state/state-store';

export class HoldingService {
  constructor(private store: StateStore) {}

  getHoldings(): HoldingRecord[] {
    return this.store.getHoldings();
  }
}
