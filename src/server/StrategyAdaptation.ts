import { AppConfig } from './AppConfig';
import { Ledger } from './Ledger';
import { logger } from './Logger';

/**
 * StrategyAdaptation (F2) — learn from realized trade outcomes.
 *
 * THE HONEST CONSTRAINT THAT SHAPES THIS FILE:
 * a monthly rebalance holding ~4 names produces roughly 50 closed trades a
 * year. That is nowhere near enough to re-derive an edge from outcomes. Any
 * "learning" that re-tunes entry rules on 50 samples is fitting noise, and on
 * live money that is worse than not learning at all.
 *
 * So this layer does not touch the edge. It adapts **exposure**: when realized
 * results deteriorate in a way that is unlikely to be chance, it scales
 * position sizing down; when they recover, it scales back up. That is a
 * defensible use of a small sample, because it only needs to detect "things are
 * going badly", not "which rule is best".
 *
 * Outputs a single `riskMultiplier` in [MIN_MULTIPLIER, 1.0] that the sizing
 * path multiplies into its allocation. It can only ever REDUCE risk relative to
 * the configured caps — never increase it above them.
 */

/** Floor on the multiplier: never de-risk to the point of not trading at all. */
const MIN_MULTIPLIER = 0.4;
/** Below this many closed trades there is no signal — stay at full size. */
const MIN_SAMPLE = 12;
/** Trades considered in the rolling window. */
const WINDOW = 40;
/** Expectancy (as % of notional) below which we start de-risking. */
const EXPECTANCY_FLOOR_PCT = 0;
/** Consecutive-loss count that triggers a defensive step-down. */
const LOSS_STREAK_TRIGGER = 4;

export interface AdaptationState {
  /** Sizing multiplier to apply, in [MIN_MULTIPLIER, 1]. */
  riskMultiplier: number;
  /** Closed trades considered. */
  sample: number;
  winRate: number;
  /** Average P&L per trade as a % of notional traded. */
  expectancyPct: number;
  /** Profit factor: gross wins / gross losses (Infinity when no losses). */
  profitFactor: number;
  /** Current run of consecutive losing trades. */
  lossStreak: number;
  /** Human-readable explanation of the multiplier. */
  reason: string;
}

export class StrategyAdaptation {
  private cached: AdaptationState | null = null;
  private cachedAt = 0;

  constructor(
    private readonly config: AppConfig,
    private readonly ledger: Ledger,
  ) {}

  /**
   * Current adaptation state, recomputed at most once a minute (the underlying
   * data only changes when a position closes).
   */
  state(now: Date = new Date()): AdaptationState {
    if (this.cached && now.getTime() - this.cachedAt < 60_000) return this.cached;
    const s = this.compute();
    this.cached = s;
    this.cachedAt = now.getTime();
    return s;
  }

  /** Convenience: the multiplier the sizing path should apply. */
  riskMultiplier(now?: Date): number {
    return this.state(now).riskMultiplier;
  }

  private compute(): AdaptationState {
    const trades = this.ledger.getClosedTrades(WINDOW);
    const sample = trades.length;

    if (sample < MIN_SAMPLE) {
      return {
        riskMultiplier: 1,
        sample,
        winRate: 0,
        expectancyPct: 0,
        profitFactor: 0,
        lossStreak: 0,
        reason: `only ${sample} closed trades (need ${MIN_SAMPLE}) — no adaptation`,
      };
    }

    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);
    const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const winRate = wins.length / sample;
    const profitFactor = grossLoss === 0 ? Infinity : grossWin / grossLoss;

    // Expectancy normalized by notional, so a run of large trades does not
    // dominate a run of small ones.
    const totalNotional = trades.reduce((s, t) => s + Math.abs(t.ticketSize), 0);
    const netPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const expectancyPct = totalNotional > 0 ? (netPnl / totalNotional) * 100 : 0;

    // Trades come back newest-first, so this counts the CURRENT streak.
    let lossStreak = 0;
    for (const t of trades) {
      if (t.pnl < 0) lossStreak++;
      else break;
    }

    // --- Derive the multiplier ------------------------------------------
    // Two independent triggers; the more defensive one wins.
    let multiplier = 1;
    const reasons: string[] = [];

    if (expectancyPct < EXPECTANCY_FLOOR_PCT) {
      // Scale down in proportion to how negative expectancy is, saturating at
      // the floor once we are losing ~1% of notional per trade.
      const severity = Math.min(1, Math.abs(expectancyPct) / 1.0);
      const m = 1 - severity * (1 - MIN_MULTIPLIER);
      multiplier = Math.min(multiplier, m);
      reasons.push(`expectancy ${expectancyPct.toFixed(2)}%/trade is negative`);
    }

    if (lossStreak >= LOSS_STREAK_TRIGGER) {
      // One step down per loss beyond the trigger. A streak is a cheap,
      // sample-efficient signal that conditions have turned against the model.
      const steps = lossStreak - LOSS_STREAK_TRIGGER + 1;
      const m = Math.max(MIN_MULTIPLIER, 1 - steps * 0.15);
      multiplier = Math.min(multiplier, m);
      reasons.push(`${lossStreak} consecutive losing trades`);
    }

    multiplier = Math.max(MIN_MULTIPLIER, Math.min(1, multiplier));

    const state: AdaptationState = {
      riskMultiplier: multiplier,
      sample,
      winRate,
      expectancyPct,
      profitFactor,
      lossStreak,
      reason:
        reasons.length === 0
          ? `healthy: ${(winRate * 100).toFixed(0)}% win rate, ` +
            `expectancy ${expectancyPct.toFixed(2)}%/trade — full size`
          : `de-risked to ${(multiplier * 100).toFixed(0)}%: ${reasons.join('; ')}`,
    };

    if (multiplier < 1) {
      logger.warn(
        {
          multiplier,
          sample,
          winRate: Number((winRate * 100).toFixed(1)),
          expectancyPct: Number(expectancyPct.toFixed(3)),
          lossStreak,
        },
        'StrategyAdaptation: de-risking from realized outcomes',
      );
    }
    return state;
  }
}
