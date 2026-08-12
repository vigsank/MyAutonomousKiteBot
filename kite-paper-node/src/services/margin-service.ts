/**
 * Margin Service — REST-facing margin queries.
 */

import type { MarginState, UserMargin } from '../types';
import { MarginEngine } from '../core/margin-engine';

export class MarginService {
  constructor(private marginEngine: MarginEngine) {}

  getMargins(): MarginState {
    return this.marginEngine.getMargins();
  }

  getMarginsForSegment(segment: string): UserMargin {
    return this.marginEngine.getMarginsForSegment(segment);
  }
}
