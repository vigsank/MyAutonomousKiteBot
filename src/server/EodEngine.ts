import { AppConfig } from './AppConfig';
import { Ledger } from './Ledger';
import { RiskEngine } from './RiskEngine';
import { PaperTrader } from './PaperTrader';
import { NewsSentimentEngine } from './NewsSentimentEngine';
import { logger } from './Logger';
import { TradeRequest } from './types';

/**
 * EodEngine — the End-of-Day layer.
 *
 * Runs at the pre-close window (15:15 IST):
 *  1. squareOffIntraday — force-liquidate intraday (MIS) positions to avoid
 *     overnight gap risk.
 *  2. logEodPerformance — persist daily prediction/execution metrics.
 *  3. overnightMatrix — scan swing (CNC) positions for overnight gap risk
 *     against upcoming global calendar events.
 *
 * All actions route through the RiskEngine -> PaperTrader (paper-only). Never
 * throws.
 */
export class EodEngine {
  constructor(
    private readonly config: AppConfig,
    private readonly ledger: Ledger,
    private readonly risk: RiskEngine,
    private readonly trader: PaperTrader,
    private readonly news: NewsSentimentEngine,
  ) {}

  /** Force-liquidate all open intraday (MIS) positions. */
  squareOffIntraday(now: Date): { closed: string[]; skipped: string[] } {
    const closed: string[] = [];
    const skipped: string[] = [];
    for (const pos of this.ledger.getOpenPositions()) {
      if (pos.product !== 'MIS') continue;
      const price = this.priceFor(pos.symbol);
      if (!price || price <= 0) {
        skipped.push(`${pos.symbol}: no price`);
        continue;
      }
      const trade: TradeRequest = {
        symbol: pos.symbol,
        exchange: pos.exchange,
        quantity: pos.quantity,
        direction: pos.direction === 'LONG' ? 'SHORT' : 'LONG',
        entryPrice: price,
        reason: 'EOD square-off (intraday)',
        ticketSize: pos.quantity * price,
        timestamp: now,
        product: 'MIS',
      };
      const decision = this.risk.evaluate(trade);
      if (!decision.allowed) {
        skipped.push(`${pos.symbol}: risk ${decision.reasons.join('; ')}`);
        continue;
      }
      this.trader.execute(trade);
      closed.push(`${pos.symbol} ${pos.quantity} @ ${price.toFixed(2)}`);
    }
    return { closed, skipped };
  }

  /** Persist daily prediction/execution performance metrics. */
  logEodPerformance(now: Date): void {
    const stats = this.ledger.eodStats();
    // Estimate total slippage from the config rate across today's trades.
    const slippageTotal =
      stats.totalTrades * (this.config.costs.slippageBps / 10000) *
      (this.config.risk.availableCapital / Math.max(1, stats.totalTrades));
    const executionAccuracy = stats.totalTrades ? stats.winning / stats.totalTrades : 0;
    this.ledger.recordEodPerformance({
      reportDate: now.toISOString().slice(0, 10),
      realizedPnl: stats.realizedPnl,
      totalTrades: stats.totalTrades,
      winning: stats.winning,
      losing: stats.losing,
      winRate: stats.winRate,
      slippageTotal,
      executionAccuracy,
      summary:
        `EOD: ${stats.totalTrades} trades, PnL ${stats.realizedPnl.toFixed(0)}, ` +
        `win rate ${(stats.winRate * 100).toFixed(1)}%, exec accuracy ${(executionAccuracy * 100).toFixed(1)}%`,
    });
  }

  /** Scan swing (CNC) positions for overnight gap risk vs upcoming events. */
  overnightMatrix(now: Date): void {
    const upcoming = this.upcomingEvents(now);
    const eventsText = upcoming.map((e) => `${e.date} ${e.event}`).join('; ');
    for (const pos of this.ledger.getOpenPositions()) {
      if (pos.product !== 'CNC') continue; // swing positions only
      const price = this.priceFor(pos.symbol);
      const gapRiskPct = this.gapRiskPct(pos.symbol, price);
      const flagged =
        gapRiskPct !== null &&
        gapRiskPct > this.config.eod.overnightGapRiskThresholdPct;
      this.ledger.recordOvernightMatrix({
        reportDate: now.toISOString().slice(0, 10),
        symbol: pos.symbol,
        gapRiskPct,
        flagged,
        events: eventsText,
      });
    }
  }

  /** Latest price for a symbol from the ledger, or 0. */
  private priceFor(symbol: string): number {
    const inst = this.ledger.getInstrumentBySymbol(symbol, 'NSE');
    return inst?.last_price ?? 0;
  }

  /** Average daily range as % of price (overnight gap risk proxy). */
  private gapRiskPct(symbol: string, price: number): number | null {
    if (!price || price <= 0) return null;
    try {
      const rows = this.ledger
        .raw()
        .prepare(
          `SELECT c.high, c.low, c.timestamp FROM candles c
             JOIN instruments i ON i.instrument_id = c.instrument_id
            WHERE i.tradingsymbol = ? ORDER BY c.timestamp DESC LIMIT 2000`,
        )
        .all(symbol) as Array<{ high: number; low: number; timestamp: string }>;
      const byDay = new Map<string, { high: number; low: number }>();
      for (const r of rows) {
        const day = r.timestamp.slice(0, 10);
        const cur = byDay.get(day);
        if (!cur) byDay.set(day, { high: r.high, low: r.low });
        else {
          cur.high = Math.max(cur.high, r.high);
          cur.low = Math.min(cur.low, r.low);
        }
      }
      const days = [...byDay.values()].slice(-5);
      if (days.length === 0) return null;
      const avgRange = days.reduce((s, d) => s + (d.high - d.low), 0) / days.length;
      return (avgRange / price) * 100;
    } catch {
      return null;
    }
  }

  /** Upcoming global events from config (date >= today). */
  private upcomingEvents(now: Date): Array<{ date: string; event: string }> {
    const today = now.toISOString().slice(0, 10);
    return this.config.eod.overnightEvents.filter((e) => e.date >= today);
  }
}
