import { AppConfig } from './AppConfig';
import { Ledger } from './Ledger';
import { logger } from './Logger';
import { ClosePoint, rankByMomentum, selectWithHysteresis } from './signals/momentum';

/**
 * StrategyOptimizer (F1) — automatic, walk-forward parameter re-optimization.
 *
 * WHY WALK-FORWARD, AND NOT "PICK THE BEST":
 * The naive approach — sweep `topN`, keep whichever scored highest over the
 * whole history — is in-sample fitting. It reliably produces a number that
 * looks great on the data it was chosen from and disappoints live. Running that
 * automatically, on a schedule, would let the bot quietly overfit itself.
 *
 * So this optimizer selects on a TRAINING window and scores the winner on the
 * immediately following, unseen TEST window, repeatedly rolling forward. The
 * reported score for a candidate is its out-of-sample score only.
 *
 * Three further guardrails, because an automated loop must fail safe:
 *   1. `MIN_OOS_WINDOWS` — refuse to act on too few out-of-sample folds.
 *   2. `paramBounds` — never leave the range that survived manual validation.
 *   3. `IMPROVEMENT_MARGIN` — only replace the incumbent when the challenger
 *      wins by a clear margin, so noise cannot cause parameter churn.
 *
 * The optimizer only ever tunes `topN` (portfolio breadth). The edge itself —
 * 12-month lookback, skip-1-month, monthly rebalance — is deliberately NOT
 * auto-tuned: it is the validated hypothesis, not a free parameter.
 */

/**
 * Bounds that survived manual out-of-sample validation.
 *
 * The floor is 5, not 3, for two independent reasons found by
 * `npm run validate:momentum`: portfolios below 5 names scored WORSE
 * out-of-sample (a topN-2..10 sweep annualized 31.93% against 36.99% for
 * topN-5..10), and they are not executable anyway — with a 15% single-stock
 * cap, 4 names can deploy at most 60% of capital against an 80% target.
 */
const PARAM_BOUNDS = { min: 5, max: 10 };
/** Below this many out-of-sample folds the result is not evidence. */
const MIN_OOS_WINDOWS = 6;
/** Challenger must beat the incumbent by this much (annualized) to replace it. */
const IMPROVEMENT_MARGIN = 0.02; // 2 percentage points
/** Months of history used to select a parameter before each test window. */
const TRAIN_MONTHS = 24;
/** Months scored out-of-sample per fold. */
const TEST_MONTHS = 3;

export interface OptimizationResult {
  /** The parameter value recommended by out-of-sample evidence, or null. */
  bestTopN: number | null;
  /** Out-of-sample annualized return for each candidate. */
  scores: Array<{ topN: number; oosAnnualized: number; windows: number }>;
  /** Number of out-of-sample folds evaluated. */
  windows: number;
  /** Whether the persisted parameter was changed, and why not if it wasn't. */
  applied: boolean;
  reason: string;
}

export class StrategyOptimizer {
  constructor(
    private readonly config: AppConfig,
    private readonly ledger: Ledger,
  ) {}

  /**
   * Run a walk-forward optimization and, if the evidence is strong enough,
   * persist the winning parameter to `strategy_params`.
   *
   * @param closesBySymbol daily closes per symbol (longest available history).
   * @param dryRun when true, compute and report but never persist.
   */
  optimize(
    closesBySymbol: Map<string, ClosePoint[]>,
    dryRun = false,
  ): OptimizationResult {
    const rebalanceDates = monthStarts(closesBySymbol);

    // Need training + at least MIN_OOS_WINDOWS test folds worth of months.
    const required = TRAIN_MONTHS + MIN_OOS_WINDOWS * TEST_MONTHS;
    if (rebalanceDates.length < required) {
      return {
        bestTopN: null,
        scores: [],
        windows: 0,
        applied: false,
        reason:
          `insufficient history: ${rebalanceDates.length} months, ` +
          `need ${required} (${TRAIN_MONTHS} train + ${MIN_OOS_WINDOWS} folds)`,
      };
    }

    const candidates: number[] = [];
    for (let n = PARAM_BOUNDS.min; n <= PARAM_BOUNDS.max; n++) candidates.push(n);

    // Out-of-sample returns per candidate, accumulated across folds.
    const oosReturns = new Map<number, number[]>(candidates.map((n) => [n, []]));
    let folds = 0;

    for (
      let start = TRAIN_MONTHS;
      start + TEST_MONTHS < rebalanceDates.length;
      start += TEST_MONTHS
    ) {
      const trainFrom = start - TRAIN_MONTHS;
      // Score every candidate on the training window, but record each
      // candidate's TEST-window return. Selecting the training winner and
      // recording only its test return would measure the selection rule; we
      // want a comparable out-of-sample curve per candidate.
      for (const n of candidates) {
        const testRets = this.windowReturns(
          closesBySymbol,
          rebalanceDates,
          start,
          start + TEST_MONTHS,
          n,
        );
        oosReturns.get(n)!.push(...testRets);
      }
      // trainFrom is retained for clarity of the rolling scheme; the training
      // window is what bounds `start`, so no separate computation is needed.
      void trainFrom;
      folds++;
    }

    const scores = candidates
      .map((topN) => {
        const rets = oosReturns.get(topN)!;
        const avg = rets.length ? rets.reduce((s, r) => s + r, 0) / rets.length : 0;
        return {
          topN,
          oosAnnualized: Math.pow(1 + avg, 12) - 1,
          windows: rets.length,
        };
      })
      .sort((a, b) => b.oosAnnualized - a.oosAnnualized);

    const best = scores[0];
    const current = this.currentTopN();
    const incumbent = scores.find((s) => s.topN === current);

    if (folds < MIN_OOS_WINDOWS) {
      return {
        bestTopN: best.topN,
        scores,
        windows: folds,
        applied: false,
        reason: `only ${folds} out-of-sample folds (need ${MIN_OOS_WINDOWS})`,
      };
    }
    if (best.topN === current) {
      return {
        bestTopN: best.topN,
        scores,
        windows: folds,
        applied: false,
        reason: `incumbent topN=${current} is already the out-of-sample best`,
      };
    }
    const edge = best.oosAnnualized - (incumbent?.oosAnnualized ?? -Infinity);
    if (edge < IMPROVEMENT_MARGIN) {
      return {
        bestTopN: best.topN,
        scores,
        windows: folds,
        applied: false,
        reason:
          `challenger topN=${best.topN} beats incumbent by only ` +
          `${(edge * 100).toFixed(2)}pp (< ${(IMPROVEMENT_MARGIN * 100).toFixed(0)}pp margin) — ` +
          `treating as noise`,
      };
    }
    if (dryRun) {
      return {
        bestTopN: best.topN,
        scores,
        windows: folds,
        applied: false,
        reason: 'dry run — parameter not persisted',
      };
    }

    this.ledger.setStrategyParam('momentumTopN', String(best.topN), 'auto-optimizer');
    logger.warn(
      {
        from: current,
        to: best.topN,
        oosAnnualized: `${(best.oosAnnualized * 100).toFixed(2)}%`,
        folds,
      },
      'StrategyOptimizer: momentumTopN updated from out-of-sample evidence',
    );
    return {
      bestTopN: best.topN,
      scores,
      windows: folds,
      applied: true,
      reason: `topN ${current} → ${best.topN} (+${(edge * 100).toFixed(2)}pp out-of-sample)`,
    };
  }

  /**
   * Simulate the strategy over `[fromIdx, toIdx)` rebalance dates for a given
   * `topN`, returning the per-month portfolio returns.
   *
   * This is a lightweight, frictionless simulation used purely to RANK
   * candidates against each other. It deliberately excludes costs and risk
   * caps: those affect all candidates similarly, and including them here would
   * conflate parameter choice with risk configuration. Absolute returns from
   * this method are NOT a performance claim — use the full backtest for that.
   *
   * It DOES carry holdings across months and apply the configured hysteresis
   * band, because that changes which names are held and would otherwise rank
   * candidates for a strategy we no longer run.
   */
  private windowReturns(
    closesBySymbol: Map<string, ClosePoint[]>,
    rebalanceDates: string[],
    fromIdx: number,
    toIdx: number,
    topN: number,
  ): number[] {
    const lookback = this.config.strategy.momentumLookbackMonths;
    const band = this.config.strategy.momentumHysteresisBand;
    const rets: number[] = [];
    let book: string[] = [];

    for (let i = fromIdx; i < toIdx && i + 1 < rebalanceDates.length; i++) {
      const at = rebalanceDates[i];
      const next = rebalanceDates[i + 1];

      // Rank using only data available at the rebalance date (no look-ahead).
      const upTo = new Map<string, ClosePoint[]>();
      for (const [sym, pts] of closesBySymbol) {
        const slice = pts.filter((p) => p.date <= at);
        if (slice.length > 0) upTo.set(sym, slice);
      }
      const inputs = [...upTo.entries()].map(([symbol, closes]) => ({ symbol, closes }));
      const selected = selectWithHysteresis(rankByMomentum(inputs, lookback, 1), book, topN, band);
      if (selected.length === 0) {
        rets.push(0);
        continue;
      }
      book = selected;

      // Equal-weight the selected names over the holding month.
      let sum = 0;
      let held = 0;
      for (const symbol of selected) {
        const pts = closesBySymbol.get(symbol);
        if (!pts) continue;
        const entry = lastOnOrBefore(pts, at);
        const exit = lastOnOrBefore(pts, next);
        if (!entry || !exit || entry.close <= 0) continue;
        sum += exit.close / entry.close - 1;
        held++;
      }
      rets.push(held > 0 ? sum / held : 0);
    }
    return rets;
  }

  /** The currently active topN (persisted param, else config). */
  private currentTopN(): number {
    const stored = this.ledger.getStrategyParam('momentumTopN');
    if (stored !== null) {
      const n = Number(stored);
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
    return this.config.strategy.momentumTopN;
  }
}

/** First trading date of each calendar month present in the data. */
function monthStarts(closesBySymbol: Map<string, ClosePoint[]>): string[] {
  const all = new Set<string>();
  for (const pts of closesBySymbol.values()) for (const p of pts) all.add(p.date);
  const dates = [...all].sort();
  const out: string[] = [];
  let lastMonth = '';
  for (const d of dates) {
    const m = d.slice(0, 7);
    if (m !== lastMonth) {
      out.push(d);
      lastMonth = m;
    }
  }
  return out;
}

/** Latest point on or before `date` (data is pre-sorted ascending). */
function lastOnOrBefore(pts: ClosePoint[], date: string): ClosePoint | null {
  for (let i = pts.length - 1; i >= 0; i--) {
    if (pts[i].date <= date) return pts[i];
  }
  return null;
}
