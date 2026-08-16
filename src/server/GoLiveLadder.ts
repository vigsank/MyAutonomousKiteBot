/**
 * GoLiveLadder.ts — Phase 5: the go-live ladder and its kill criteria.
 *
 * Written BEFORE real money moves (that is the whole point of 5.1). Two pure,
 * auditable pieces:
 *
 *   5.1 KILL CRITERIA — objective, pre-committed conditions that STOP the bot.
 *        Some are already enforced live by the RiskEngine (daily / portfolio /
 *        monthly drawdown halts); the two the RiskEngine does NOT yet watch —
 *        consecutive losing months and tracking error vs Nifty — are evaluated
 *        here so the operator has a single, honest kill dashboard. A KILL means
 *        "stop trading, go back to paper, diagnose"; it is never auto-overridden.
 *
 *   5.2 CAPITAL LADDER — capital rises on EVIDENCE, never on a good month. Each
 *        rung has an entry gate; you may only advance when the gate is met, and
 *        any kill criterion drops you back to PAPER.
 *
 * Everything here is side-effect-free: it computes verdicts from measured stats.
 * Acting on them (halting, moving a rung) is a deliberate operator step.
 */

export interface KillCriteriaConfig {
  /** Max peak-to-trough drawdown (%) tolerated before the plug is pulled. */
  maxDrawdownPct: number;
  /** Consecutive losing months that trigger a kill (protects compounding). */
  maxConsecutiveLosingMonths: number;
  /**
   * Max tracking error vs Nifty (annualized %). A momentum book should not
   * wander arbitrarily far from its benchmark; extreme divergence means the
   * edge has broken or the universe has drifted.
   */
  maxTrackingErrorPct: number;
}

/**
 * Defaults chosen from the walk-forward evidence: every profitable config in
 * this codebase still carried a ~40–48% max drawdown, so 45% is the pre-committed
 * ceiling to size AROUND (via cash reserve, 0.4/5.1), not a target to accept.
 */
export const DEFAULT_KILL_CRITERIA: KillCriteriaConfig = {
  maxDrawdownPct: 45,
  maxConsecutiveLosingMonths: 3,
  maxTrackingErrorPct: 40,
};

export interface KillCriteriaInput {
  /** Observed peak-to-trough drawdown (%), positive number. */
  drawdownPct: number;
  /** Realized PnL by month, oldest→newest (Ledger.realizedPnlByMonth). */
  monthlyPnl: Array<{ month: string; pnl: number }>;
  /** Annualized tracking error vs Nifty (%), if measured; omit if unknown. */
  trackingErrorPct?: number;
}

export interface KillVerdict {
  killed: boolean;
  /** Each breached criterion, human-readable and safe to log. */
  breaches: string[];
  /** The measured consecutive losing-month streak (tail of the series). */
  consecutiveLosingMonths: number;
}

/** Count the trailing run of losing months (pnl < 0) at the end of the series. */
export function consecutiveLosingMonths(
  monthlyPnl: Array<{ month: string; pnl: number }>,
): number {
  let n = 0;
  for (let i = monthlyPnl.length - 1; i >= 0; i--) {
    if (monthlyPnl[i].pnl < 0) n++;
    else break;
  }
  return n;
}

/** Evaluate the pre-committed kill criteria. */
export function evaluateKillCriteria(
  input: KillCriteriaInput,
  cfg: KillCriteriaConfig = DEFAULT_KILL_CRITERIA,
): KillVerdict {
  const breaches: string[] = [];

  if (input.drawdownPct > cfg.maxDrawdownPct) {
    breaches.push(
      `Max drawdown ${input.drawdownPct.toFixed(1)}% > ${cfg.maxDrawdownPct}% ceiling.`,
    );
  }

  const streak = consecutiveLosingMonths(input.monthlyPnl);
  if (streak >= cfg.maxConsecutiveLosingMonths) {
    breaches.push(
      `${streak} consecutive losing months >= ${cfg.maxConsecutiveLosingMonths} limit.`,
    );
  }

  if (
    input.trackingErrorPct !== undefined &&
    input.trackingErrorPct > cfg.maxTrackingErrorPct
  ) {
    breaches.push(
      `Tracking error ${input.trackingErrorPct.toFixed(1)}% > ${cfg.maxTrackingErrorPct}% vs Nifty.`,
    );
  }

  return { killed: breaches.length > 0, breaches, consecutiveLosingMonths: streak };
}

/* ------------------------------------------------------------------ */
/* 5.2 — Capital ladder                                                */
/* ------------------------------------------------------------------ */

export type LadderStage = 'PAPER' | 'SHADOW' | 'LIVE_25K' | 'SCALE';

export interface LadderRung {
  stage: LadderStage;
  capitalInr: number;
  /** Plain-English gate to ENTER this rung (audited by a human). */
  entryGate: string;
}

/**
 * The ladder. Capital increases only when the rung's evidence gate is met, and
 * ANY kill criterion sends you back to PAPER. Written once, referenced forever.
 */
export const CAPITAL_LADDER: LadderRung[] = [
  {
    stage: 'PAPER',
    capitalInr: 0,
    entryGate: 'Default. Strategy must pass npm run validate:momentum (OOS, beats Nifty).',
  },
  {
    stage: 'SHADOW',
    capitalInr: 0,
    entryGate:
      'Paper stable for 1+ month AND the shadow book is accruing (score:shadow runs).',
  },
  {
    stage: 'LIVE_25K',
    capitalInr: 25_000,
    entryGate:
      '3+ months paper/shadow with NO kill breach AND after-tax return beats Nifty on the sample.',
  },
  {
    stage: 'SCALE',
    capitalInr: 100_000,
    entryGate:
      '6+ live months, positive after-tax vs Nifty, max drawdown within ceiling, no kill breach. ' +
      'Scale on evidence, never on a single good month.',
  },
];

export interface LadderRecommendation {
  /** Stage the operator should be on given the evidence + kill state. */
  recommendedStage: LadderStage;
  rationale: string;
}

/**
 * Recommend a ladder stage. Conservative and one-directional on bad news: a kill
 * breach always recommends PAPER regardless of how far up the ladder you were.
 */
export function recommendLadderStage(
  current: LadderStage,
  kill: KillVerdict,
): LadderRecommendation {
  if (kill.killed) {
    return {
      recommendedStage: 'PAPER',
      rationale:
        `Kill criterion breached (${kill.breaches.join(' ')}) — drop to PAPER, ` +
        `diagnose, and re-earn each rung. Capital never resumes on a hunch.`,
    };
  }
  return {
    recommendedStage: current,
    rationale:
      `No kill breach. Hold ${current}; advance only when the next rung's ` +
      `evidence gate is met (see CAPITAL_LADDER).`,
  };
}
