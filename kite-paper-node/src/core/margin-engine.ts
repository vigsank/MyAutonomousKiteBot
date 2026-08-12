/**
 * Margin Engine — calculates margin requirements and updates the margin
 * state based on positions and the latest market prices.
 *
 * Returns the real `kiteconnect` `UserMargin` shape. The margin rate is
 * configurable (default 20% of trade value).
 */

import type { MarginState, UserMargin } from '../types';
import { StateStore } from '../state/state-store';

export class MarginEngine {
  private marginRate: number;

  constructor(
    private store: StateStore,
    marginRate = 0.2
  ) {
    this.marginRate = marginRate;
  }

  /** Calculate the margin required for a trade of the given value. */
  calculateMargin(tradeValue: number): number {
    return tradeValue * this.marginRate;
  }

  private buildUserMargin(): UserMargin {
    const positions = this.store.getPositions();
    let exposure = 0;
    let span = 0;
    let unrealised = 0;
    let realised = 0;

    for (const pos of positions) {
      const value = Math.abs(pos.value);
      exposure += value;
      span += this.calculateMargin(value);
      unrealised += pos.unrealised;
      realised += pos.realised;
    }

    const cash = this.store.ledger.cash_balance;
    const used = this.store.ledger.used_margin;

    return {
      enabled: true,
      net: cash,
      available: {
        adhoc_margin: 0,
        cash,
        opening_balance: this.store.ledger.starting_capital,
        live_balance: cash,
        collateral: 0,
        intraday_payin: 0,
      },
      utilised: {
        debits: used,
        exposure,
        m2m_realised: realised,
        m2m_unrealised: unrealised,
        option_premium: 0,
        payout: 0,
        span,
        holding_sales: 0,
        turnover: exposure,
        liquid_collateral: 0,
        stock_collateral: 0,
        delivery: 0,
      },
    };
  }

  /** Recompute the margin state from current positions and prices. */
  recompute(): void {
    const margin = this.buildUserMargin();
    this.store.margins = { equity: margin, commodity: { ...margin, enabled: false } };
  }

  /** Check whether a trade of the given value can be afforded. */
  canAfford(tradeValue: number): boolean {
    const required = this.calculateMargin(tradeValue);
    return this.store.ledger.cash_balance >= required;
  }

  /** Get the current margin state. */
  getMargins(): MarginState {
    this.recompute();
    return this.store.margins;
  }

  /** Get margins for a single segment. */
  getMarginsForSegment(segment: string): UserMargin {
    this.recompute();
    const key = segment.toLowerCase() === 'commodity' ? 'commodity' : 'equity';
    return this.store.margins[key] ?? this.buildUserMargin();
  }
}
