/**
 * GTT Service — REST-facing GTT trigger operations.
 */

import type { GTTParams, GTTTrigger } from '../types';
import { GTTEngine } from '../core/gtt-engine';

export class GTTService {
  constructor(private gttEngine: GTTEngine) {}

  createTrigger(input: GTTParams): GTTTrigger {
    return this.gttEngine.createTrigger(input);
  }

  modifyTrigger(triggerId: string, params: Partial<GTTParams>): GTTTrigger {
    return this.gttEngine.modifyTrigger(triggerId, params);
  }

  getGTT(triggerId: string): GTTTrigger | undefined {
    return this.gttEngine.getGTT(triggerId);
  }

  getGTTs(): GTTTrigger[] {
    return this.gttEngine.getGTTs();
  }

  deleteGTT(triggerId: string): boolean {
    return this.gttEngine.deleteGTT(triggerId);
  }
}
