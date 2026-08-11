import { AppConfig } from './AppConfig';
import { OptionsEngine, OptionContract, OptionFill, OptionPosition } from './OptionsEngine';
import { SignalDirection } from './types';
import { logger } from './Logger';

/**
 * OptionsTrader — paper options execution with strict safety caps.
 *
 * Only BUYS options (defined risk = premium). Tracks open positions, total
 * exposure, and realized P&L. Fully switchable via OPTIONS_ENABLED.
 */
export class OptionsTrader {
  private positions = new Map<string, OptionPosition>();
  private exposure = 0;
  private fills: OptionFill[] = [];

  constructor(
    private readonly config: AppConfig,
    private readonly engine: OptionsEngine,
  ) {}

  get enabled(): boolean {
    return this.engine.enabled;
  }

  get openPositions(): number {
    return this.positions.size;
  }

  get totalExposure(): number {
    return this.exposure;
  }

  get allFills(): OptionFill[] {
    return this.fills;
  }

  /**
   * Open an option position for a direction. Returns a fill, or null if blocked
   * by a safety cap or if options are disabled.
   */
  open(
    symbol: string,
    direction: SignalDirection,
    spot: number,
    now: Date = new Date(),
  ): OptionFill | null {
    if (!this.enabled) return null;

    const contract = this.engine.buildContract(symbol, direction, spot, now);
    if (!contract) return null;

    const lots = 1;
    const blocked = this.engine.riskCheck(contract, lots, this.exposure);
    if (blocked) {
      logger.warn({ symbol, blocked }, 'Option trade blocked by safety cap');
      return null;
    }

    const totalPremium = this.engine.totalPremium(contract, lots);
    this.positions.set(symbol, { contract, quantity: lots, entryTime: now, entryPremium: totalPremium });
    this.exposure += totalPremium;

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
    this.fills.push(fill);
    return fill;
  }

  /**
   * Close an option position at the current spot. Returns the fill with
   * realized P&L, or null if no position exists.
   */
  close(symbol: string, spot: number, now: Date = new Date()): OptionFill | null {
    const pos = this.positions.get(symbol);
    if (!pos) return null;

    const c = pos.contract;
    const daysLeft = Math.max(0, (c.expiry.getTime() - now.getTime()) / 86400000);
    const newPremium = this.engine.premium(spot, c.strike, c.type, daysLeft);
    const newTotal = newPremium * c.lotSize * pos.quantity;
    const pnl = newTotal - pos.entryPremium;

    this.exposure = Math.max(0, this.exposure - pos.entryPremium);
    this.positions.delete(symbol);

    const fill: OptionFill = {
      symbol,
      type: c.type,
      strike: c.strike,
      quantity: pos.quantity,
      premium: newPremium,
      totalPremium: newTotal,
      pnl: Number(pnl.toFixed(2)),
      reason: `Sold ${c.type} ${c.strike} to close`,
      timestamp: now,
    };
    this.fills.push(fill);
    return fill;
  }

  /** Realized P&L across all closed option positions. */
  realizedPnl(): number {
    return this.fills.reduce((s, f) => s + f.pnl, 0);
  }
}
