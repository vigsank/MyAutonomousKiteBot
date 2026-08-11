import { AppConfig } from './AppConfig';
import { OptionsEngine, OptionContract, OptionFill } from './OptionsEngine';
import { Ledger } from './Ledger';
import { RiskEngine } from './RiskEngine';
import { SignalDirection } from './types';
import { logger } from './Logger';

/**
 * OptionsTrader — paper options execution with strict safety caps.
 *
 * Only BUYS options (defined risk = premium). Positions and fills are persisted
 * to the SQLite ledger (so exposure is visible to the RiskEngine and survives a
 * restart), and every open is gated by the RiskEngine like equity trades.
 * Fully switchable via OPTIONS_ENABLED.
 */
export class OptionsTrader {
  constructor(
    private readonly config: AppConfig,
    private readonly engine: OptionsEngine,
    private readonly ledger: Ledger,
    private readonly risk: RiskEngine,
  ) {}

  get enabled(): boolean {
    return this.engine.enabled;
  }

  get openPositions(): number {
    return this.ledger.getOpenOptionPositions().length;
  }

  get totalExposure(): number {
    return this.ledger.optionExposure();
  }

  get allFills(): OptionFill[] {
    return this.ledger.getOptionFills().map((f) => ({
      symbol: f.symbol,
      type: f.type as 'CE' | 'PE',
      strike: f.strike,
      quantity: f.quantity,
      premium: f.premium,
      totalPremium: f.totalPremium,
      pnl: f.pnl,
      reason: f.reason,
      timestamp: new Date(f.createdAt),
    }));
  }

  /**
   * Open an option position for a direction. Returns a fill, or null if blocked
   * by the RiskEngine or if options are disabled.
   */
  open(
    symbol: string,
    direction: SignalDirection,
    spot: number,
    now: Date = new Date(),
    sigma?: number,
  ): OptionFill | null {
    if (!this.enabled) return null;

    const contract = this.engine.buildContract(symbol, direction, spot, now, sigma);
    if (!contract) return null;

    const lots = 1;
    const totalPremium = this.engine.totalPremium(contract, lots);
    const blocked = this.risk.evaluateOption(
      totalPremium,
      this.ledger.optionExposure(),
      symbol,
    );
    if (blocked) {
      logger.warn({ symbol, blocked }, 'Option trade blocked by risk engine');
      return null;
    }

    // Persist the position and the fill.
    this.ledger.recordOptionPosition({
      symbol,
      type: contract.type,
      strike: contract.strike,
      premium: contract.premium,
      lotSize: contract.lotSize,
      daysToExpiry: contract.daysToExpiry,
      expiry: contract.expiry.toISOString(),
      quantity: lots,
      entryPremium: totalPremium,
      entryTime: now.toISOString(),
    });
    this.ledger.recordOptionFill({
      symbol,
      type: contract.type,
      strike: contract.strike,
      quantity: lots,
      premium: contract.premium,
      totalPremium,
      pnl: 0,
      reason: `Bought ${contract.type} ${contract.strike} on ${direction} signal`,
    });

    const fill: OptionFill = {
      symbol,
      type: contract.type,
      strike: contract.strike,
      quantity: lots,
      premium: contract.premium,
      totalPremium,
      pnl: 0,
      reason: `Bought ${contract.type} ${contract.strike} on ${direction} signal`,
      timestamp: now,
    };
    return fill;
  }

  /**
   * Close an option position at the current spot. Returns the fill with
   * realized P&L, or null if no position exists.
   */
  close(symbol: string, spot: number, now: Date = new Date(), sigma?: number): OptionFill | null {
    const pos = this.ledger
      .getOpenOptionPositions()
      .find((p) => p.symbol === symbol);
    if (!pos) return null;

    const daysLeft = Math.max(0, (new Date(pos.expiry).getTime() - now.getTime()) / 86400000);
    const newPremium = this.engine.premium(spot, pos.strike, pos.type, daysLeft, sigma);
    const newTotal = newPremium * pos.lotSize * pos.quantity;
    const pnl = Number((newTotal - pos.entryPremium).toFixed(2));

    this.ledger.closeOptionPosition(symbol, newPremium, pnl);
    this.ledger.recordOptionFill({
      symbol,
      type: pos.type,
      strike: pos.strike,
      quantity: pos.quantity,
      premium: newPremium,
      totalPremium: newTotal,
      pnl,
      reason: `Sold ${pos.type} ${pos.strike} to close`,
    });

    const fill: OptionFill = {
      symbol,
      type: pos.type,
      strike: pos.strike,
      quantity: pos.quantity,
      premium: newPremium,
      totalPremium: newTotal,
      pnl,
      reason: `Sold ${pos.type} ${pos.strike} to close`,
      timestamp: now,
    };
    return fill;
  }

  /** Realized P&L across all closed option positions. */
  realizedPnl(): number {
    return this.ledger.getOptionFills().reduce((s, f) => s + f.pnl, 0);
  }
}
