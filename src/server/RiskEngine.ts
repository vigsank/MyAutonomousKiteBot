import { AppConfig } from './AppConfig';
import { Ledger } from './Ledger';
import { Position, RiskDecision, TradeRequest } from './types';

/**
 * Risk engine - the immutable gatekeeper.
 *
 * The AI/strategy can NEVER override these checks. Every proposed trade is
 * validated here before it is allowed to reach the paper trader or the
 * human-in-the-loop approval flow.
 */
export class RiskEngine {
  constructor(
    private readonly config: AppConfig,
    private readonly ledger: Ledger,
  ) {}

  /**
   * Validate a proposed trade against hard risk limits.
   * Returns the set of reasons that failed (empty = allowed).
   */
  evaluate(trade: TradeRequest): RiskDecision {
    const failures: string[] = [];

    if (trade.ticketSize <= 0) {
      failures.push('Ticket size must be positive.');
    }

    // Per-trade allocation cap.
    if (trade.ticketSize > this.config.risk.maxTradeAllocation) {
      failures.push(
        `Ticket size ${trade.ticketSize} exceeds max trade allocation ` +
          `${this.config.risk.maxTradeAllocation}.`,
      );
    }

    // Per-symbol concentration cap: an add must not push the position's total
    // notional past the per-trade allocation limit (repeated adds can otherwise
    // build a single oversized position).
    const existing = this.ledger.getPosition(trade.symbol, trade.exchange);
    if (existing && existing.direction === trade.direction) {
      const newNotional =
        existing.quantity * existing.avgPrice + trade.quantity * trade.entryPrice;
      if (newNotional > this.config.risk.maxTradeAllocation) {
        failures.push(
          `Position ${trade.symbol} would exceed max allocation ` +
            `${this.config.risk.maxTradeAllocation} (${newNotional.toFixed(0)}).`,
        );
      }
    }

    // Daily drawdown cap using realised + unrealised PnL.
    const drawdown = this.ledger.currentDrawdown();
    if (drawdown > this.config.risk.maxDailyDrawdown) {
      failures.push(
        `Daily drawdown ${drawdown.toFixed(2)} exceeds max ` +
          `${this.config.risk.maxDailyDrawdown}. Trading halted.`,
      );
    }

    // Ensure we have open capital capacity (not over-allocated).
    const used = this.ledger.usedCapital();
    if (used + trade.ticketSize > this.config.risk.availableCapital) {
      failures.push(
        `Insufficient capital: used ${used.toFixed(2)} + ticket ` +
          `${trade.ticketSize.toFixed(2)} > available ` +
          `${this.config.risk.availableCapital.toFixed(2)}.`,
      );
    }

    const decision: RiskDecision = { allowed: failures.length === 0, reasons: failures };

    // Log every risk evaluation to the audit trail.
    if (!decision.allowed) {
      this.ledger.recordRiskEvent(
        'TRADE_BLOCKED',
        decision.reasons.join('; '),
        trade.symbol,
        undefined,
        trade.exchange,
      );
    }

    return decision;
  }

  /** True when the cooldown period since the last trade has elapsed. */
  cooldownElapsed(now: Date = new Date()): boolean {
    const last = this.ledger.lastTradeTime();
    if (!last) return true;
    const windowMs = this.config.strategy.tradeCooldownMinutes * 60 * 1000;
    return now.getTime() - last.getTime() >= windowMs;
  }

  /**
   * Compute the stop-loss price for an open position.
   *
   * If an ATR value is provided, uses ATR * multiplier (volatility-adaptive),
   * but never wider than the configured stopLossPercent hard cap. Falls back
   * to the fixed percentage when no ATR is available.
   */
  stopLossPrice(position: Position, atr?: number): number {
    // Hard cap distance based on fixed percentage.
    const pct = this.config.strategy.stopLossPercent / 100;
    const maxDist = position.avgPrice * pct;

    let dist = maxDist;
    if (atr && atr > 0) {
      const atrDist = atr * this.config.strategy.atrStopMultiplier;
      // ATR stop must be within the hard cap (tighter is fine, wider is not).
      dist = Math.min(atrDist, maxDist);
    }

    return position.direction === 'LONG'
      ? position.avgPrice - dist
      : position.avgPrice + dist;
  }

  /** True when current day's PnL has breached the drawdown limit. */
  drawdownBreached(): boolean {
    return this.ledger.currentDrawdown() > this.config.risk.maxDailyDrawdown;
  }

  /**
   * Validate an option trade against hard risk limits (premium cap, exposure
   * cap, and available capital). Returns the reason it's blocked, or null if
   * allowed. Options must pass through this gatekeeper like equity trades.
   */
  evaluateOption(
    totalPremium: number,
    currentExposure: number,
    symbol: string,
  ): string | null {
    const failures: string[] = [];
    if (totalPremium <= 0) failures.push('Option premium must be positive.');
    if (totalPremium > this.config.options.maxPremiumPerTrade) {
      failures.push(
        `Premium ${totalPremium.toFixed(0)} exceeds per-trade cap ${this.config.options.maxPremiumPerTrade}.`,
      );
    }
    if (currentExposure + totalPremium > this.config.options.maxOptionsExposure) {
      failures.push(
        `Options exposure ${(currentExposure + totalPremium).toFixed(0)} exceeds cap ${this.config.options.maxOptionsExposure}.`,
      );
    }
    const used = this.ledger.usedCapital() + this.ledger.optionExposure();
    if (used + totalPremium > this.config.risk.availableCapital) {
      failures.push(
        `Insufficient capital for option premium ${totalPremium.toFixed(0)}.`,
      );
    }
    if (failures.length > 0) {
      this.ledger.recordRiskEvent('OPTION_BLOCKED', failures.join('; '), symbol);
      return failures.join('; ');
    }
    return null;
  }
}
