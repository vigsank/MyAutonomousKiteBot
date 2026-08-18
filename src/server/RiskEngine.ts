import { AppConfig } from './AppConfig';
import { Ledger } from './Ledger';
import { CapitalSnapshot, Position, RiskDecision, TradeRequest } from './types';

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

    // Per-trade allocation cap (absolute).
    if (trade.ticketSize > this.config.risk.maxTradeAllocation) {
      failures.push(
        `Ticket size ${trade.ticketSize} exceeds max trade allocation ` +
          `${this.config.risk.maxTradeAllocation}.`,
      );
    }

    // Single-stock concentration cap: ≤ maxSingleStockPct of total capital.
    const singleStockCap =
      (this.config.risk.availableCapital * this.config.risk.maxSingleStockPct) / 100;
    if (trade.ticketSize > singleStockCap) {
      failures.push(
        `Ticket size ${trade.ticketSize} exceeds single-stock cap ` +
          `${singleStockCap.toFixed(0)} (${this.config.risk.maxSingleStockPct}% of capital).`,
      );
    }

    // Per-symbol concentration cap: an add must not push the position's total
    // notional past the single-stock cap (repeated adds can otherwise build a
    // single oversized position).
    const existing = this.ledger.getPosition(trade.symbol, trade.exchange);

    // Exits / reductions always reduce exposure and free capital, so they
    // bypass the allocation, concentration, capital-capacity and drawdown caps.
    // Only a positive ticket is required — otherwise a fully-deployed book could
    // never be trimmed or closed (this previously blocked every sell and let the
    // book grow unbounded past topN).
    const isClose = existing !== null && existing.direction !== trade.direction;
    if (isClose) {
      const allowed = trade.ticketSize > 0;
      return { allowed, reasons: allowed ? [] : ['Ticket size must be positive.'] };
    }

    if (existing && existing.direction === trade.direction) {
      const newNotional =
        existing.quantity * existing.avgPrice + trade.quantity * trade.entryPrice;
      if (newNotional > singleStockCap) {
        failures.push(
          `Position ${trade.symbol} would exceed single-stock cap ` +
            `${singleStockCap.toFixed(0)} (${newNotional.toFixed(0)}).`,
        );
      }
    }

    // Sector concentration cap: total notional in a sector (incl. this trade)
    // must stay ≤ maxSectorWeightPct of capital. Only enforced when the symbol
    // has a sector mapped in the watchlist.
    const sector = this.sectorFor(trade.symbol);
    if (sector) {
      const sectorCap =
        (this.config.risk.availableCapital * this.config.risk.maxSectorWeightPct) / 100;
      const sectorExposure = this.sectorExposure(sector) + trade.ticketSize;
      if (sectorExposure > sectorCap) {
        failures.push(
          `Sector ${sector} exposure ${sectorExposure.toFixed(0)} exceeds cap ` +
            `${sectorCap.toFixed(0)} (${this.config.risk.maxSectorWeightPct}% of capital).`,
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

    // Portfolio-level drawdown guard: halt trading if the book is down more
    // than maxPortfolioDrawdownPct of capital (cumulative realized PnL).
    const realized = this.ledger.cumulativeRealizedPnl();
    const portfolioDdPct =
      (Math.abs(Math.min(0, realized)) / this.config.risk.availableCapital) * 100;
    if (portfolioDdPct > this.config.risk.maxPortfolioDrawdownPct) {
      failures.push(
        `Portfolio drawdown ${portfolioDdPct.toFixed(1)}% exceeds max ` +
          `${this.config.risk.maxPortfolioDrawdownPct}%. Trading halted.`,
      );
    }

    // Monthly drawdown guard: halt trading for the month if monthly P&L is down
    // more than maxMonthlyDrawdownPct of capital (protects month-end P&L).
    const monthlyPnl = this.ledger.monthlyRealizedPnl();
    const monthlyDdPct =
      (Math.abs(Math.min(0, monthlyPnl)) / this.config.risk.availableCapital) * 100;
    if (monthlyDdPct > this.config.risk.maxMonthlyDrawdownPct) {
      failures.push(
        `Monthly drawdown ${monthlyDdPct.toFixed(1)}% exceeds max ` +
          `${this.config.risk.maxMonthlyDrawdownPct}%. Trading halted for the month.`,
      );
    }

    // Single-trade risk cap: the loss at stop-loss must be ≤ maxRiskPerTradePct
    // of total account balance. Only applies to NEW entries (not closes), and
    // uses the actual ATR-based stop distance when provided (falls back to the
    // fixed stopLossPercent). riskAtStop = quantity * stopDist.
    if (!isClose) {
      const stopDist =
        trade.stopDistance ??
        (trade.entryPrice * this.config.strategy.stopLossPercent) / 100;
      const riskAtStop = trade.quantity * stopDist;
      const riskCap =
        (this.config.risk.availableCapital * this.config.risk.maxRiskPerTradePct) / 100;
      if (riskAtStop > riskCap) {
        failures.push(
          `Risk at stop ${riskAtStop.toFixed(0)} exceeds cap ` +
            `${riskCap.toFixed(0)} (${this.config.risk.maxRiskPerTradePct}% of balance).`,
        );
      }
    }

    // Capital capacity + mandatory cash reserve: after this trade, free capital
    // must stay ≥ minCashReservePct of total (preserve liquidity).
    const used = this.ledger.usedCapital();
    const reserve =
      (this.config.risk.availableCapital * this.config.risk.minCashReservePct) / 100;
    const spendable = this.config.risk.availableCapital - reserve;
    if (used + trade.ticketSize > spendable) {
      failures.push(
        `Insufficient capital: used ${used.toFixed(2)} + ticket ` +
          `${trade.ticketSize.toFixed(2)} > spendable ${spendable.toFixed(2)} ` +
          `(after ${this.config.risk.minCashReservePct}% cash reserve).`,
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

  /**
   * Deterministic capital snapshot at report time. The LLM advisor consumes
   * `available` as advisory context; the RiskEngine re-validates against live
   * capital at execution time.
   */
  capitalSnapshot(): CapitalSnapshot {
    const total = this.config.risk.availableCapital;
    const used = this.ledger.usedCapital();
    const pending = this.ledger.pendingOrders();
    const reserve = (total * this.config.risk.minCashReservePct) / 100;
    const available = Math.max(0, total - used - pending - reserve);
    return { total, used, pending, reserve, available };
  }

  /** Sector mapped to a symbol in the watchlist, or null. */
  private sectorFor(symbol: string): string | null {
    const w = this.config.watchlist.find((s) => s.tradingsymbol === symbol);
    return w?.sector ?? null;
  }

  /** Total notional currently deployed in a sector (from open positions). */
  private sectorExposure(sector: string): number {
    let total = 0;
    for (const p of this.ledger.getOpenPositions()) {
      if (this.sectorFor(p.symbol) === sector) {
        total += p.quantity * p.avgPrice;
      }
    }
    return total;
  }

  /** True when the cooldown period since the last trade has elapsed. */
  cooldownElapsed(now: Date = new Date()): boolean {
    const last = this.ledger.lastTradeTime();
    if (!last) return true;
    const windowMs = this.config.strategy.tradeCooldownMinutes * 60 * 1000;
    const elapsed = now.getTime() - last.getTime();
    // A trade dated in the FUTURE relative to `now` (e.g. a backtest replaying
    // a later bar's fill while processing an earlier bar) must never impose a
    // cooldown backwards in time. Cooldown only applies forward from a fill.
    if (elapsed < 0) return true;
    return elapsed >= windowMs;
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
