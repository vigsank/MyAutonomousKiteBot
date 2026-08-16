/**
 * AiAuthorityPolicy.ts — Phase 4.3: promote or retire the AI on evidence.
 *
 * The AI runs today as a FILTER only (veto / shrink / re-rank; it never
 * originates a trade). Its would-be ideas are logged to `agent_proposals` as a
 * shadow book and graded by `Ledger.scoreShadowBook()` (Phase 4.1). This module
 * turns that evidence into a single, WRITTEN, auditable decision so the AI never
 * sits in indefinite limbo:
 *
 *   PROMOTE  — the AI's shadow ideas have, on a large-enough and long-enough
 *              sample, genuinely and materially beaten momentum. Widen its
 *              authority (start executing a capped sleeve of AI-originated ideas).
 *   HOLD     — not enough evidence yet, OR the edge is real but too small to act
 *              on. Keep AI as filter-only and keep accumulating shadow data.
 *   RETIRE   — the AI's shadow ideas have, on a large-enough sample, materially
 *              LAGGED momentum. Narrow its authority (drop it toward veto-only,
 *              stop spending tokens re-ranking).
 *
 * The rule is deliberately conservative: promotion demands a long track record
 * (`minMonths`), a large sample (`minScored`) AND a material edge (`edgePpToActOn`),
 * so a lucky short run cannot hand the AI the keys. Retirement is symmetric but
 * needs only the sample (a persistent lag is enough to pull authority).
 *
 * Pure and side-effect-free — decisions are computed from data and printed /
 * asserted, never executed automatically. Acting on a PROMOTE/RETIRE is a
 * deliberate, human-audited step (the go-live ladder, Phase 5).
 */

/** One originator's realized shadow-book performance (from scoreShadowBook). */
export interface ShadowScore {
  originator: string;
  scored: number;
  hitRate: number;
  avgReturnPct: number;
  totalReturnPct: number;
}

export type AiAuthorityVerdict = 'PROMOTE' | 'HOLD' | 'RETIRE';

export interface AiAuthorityConfig {
  /** Minimum months of shadow history before ANY promote/retire is allowed. */
  minMonths: number;
  /** Minimum scored AI proposals before ANY promote/retire is allowed. */
  minScored: number;
  /**
   * Edge (AI avg return − momentum avg return, in percentage points) required to
   * PROMOTE. A positive-but-tiny edge is not worth the added risk, so we demand
   * a material gap. A lag of this same magnitude triggers RETIRE.
   */
  edgePpToActOn: number;
}

/** Conservative defaults — a full trading year of evidence and a real edge. */
export const DEFAULT_AI_AUTHORITY_CONFIG: AiAuthorityConfig = {
  minMonths: 12,
  minScored: 30,
  edgePpToActOn: 2.0,
};

export interface AiAuthorityDecision {
  verdict: AiAuthorityVerdict;
  /** Human-readable justification, safe to log and audit. */
  rationale: string;
  /** AI edge over momentum in percentage points (avg return). */
  edgePp: number;
  /** Months of shadow history observed. */
  monthsObserved: number;
  /** Whether the minimum-evidence bar (months AND sample) was met. */
  evidenceSufficient: boolean;
}

/**
 * Decide the AI's authority from the scored shadow book.
 *
 * @param scores        output of `Ledger.scoreShadowBook()`
 * @param monthsObserved months of shadow history accrued (caller supplies this;
 *                        the ledger knows the earliest proposal timestamp)
 * @param cfg           thresholds (defaults = a trading year + 2pp edge)
 */
export function decideAiAuthority(
  scores: ShadowScore[],
  monthsObserved: number,
  cfg: AiAuthorityConfig = DEFAULT_AI_AUTHORITY_CONFIG,
): AiAuthorityDecision {
  const ai = scores.find((s) => s.originator === 'AI_COMPOSITE');
  const mom = scores.find((s) => s.originator === 'MOMENTUM');

  // No comparison possible without both sides.
  if (!ai || !mom) {
    return {
      verdict: 'HOLD',
      rationale:
        'Insufficient shadow book: need both AI_COMPOSITE and MOMENTUM scored ' +
        'proposals to compare. Keep AI as filter-only and keep logging.',
      edgePp: 0,
      monthsObserved,
      evidenceSufficient: false,
    };
  }

  const edgePp = ai.avgReturnPct - mom.avgReturnPct;
  const evidenceSufficient = monthsObserved >= cfg.minMonths && ai.scored >= cfg.minScored;

  if (!evidenceSufficient) {
    return {
      verdict: 'HOLD',
      rationale:
        `Not enough evidence yet (${monthsObserved.toFixed(1)}mo / ${ai.scored} scored; ` +
        `need ${cfg.minMonths}mo and ${cfg.minScored}). AI edge so far ` +
        `${edgePp >= 0 ? '+' : ''}${edgePp.toFixed(2)}pp — advisory only. Filter-only.`,
      edgePp,
      monthsObserved,
      evidenceSufficient: false,
    };
  }

  if (edgePp >= cfg.edgePpToActOn) {
    return {
      verdict: 'PROMOTE',
      rationale:
        `AI shadow ideas beat momentum by ${edgePp.toFixed(2)}pp over ` +
        `${monthsObserved.toFixed(1)}mo (${ai.scored} scored, ${(ai.hitRate * 100).toFixed(0)}% hit) — ` +
        `above the ${cfg.edgePpToActOn}pp bar. Widen AI authority via a capped, ` +
        `human-audited sleeve (Phase 5 ladder).`,
      edgePp,
      monthsObserved,
      evidenceSufficient: true,
    };
  }

  if (edgePp <= -cfg.edgePpToActOn) {
    return {
      verdict: 'RETIRE',
      rationale:
        `AI shadow ideas lagged momentum by ${Math.abs(edgePp).toFixed(2)}pp over ` +
        `${monthsObserved.toFixed(1)}mo (${ai.scored} scored) — below the ` +
        `-${cfg.edgePpToActOn}pp bar. Narrow AI toward veto-only; stop re-ranking spend.`,
      edgePp,
      monthsObserved,
      evidenceSufficient: true,
    };
  }

  return {
    verdict: 'HOLD',
    rationale:
      `Enough evidence (${monthsObserved.toFixed(1)}mo, ${ai.scored} scored) but the ` +
      `AI edge (${edgePp >= 0 ? '+' : ''}${edgePp.toFixed(2)}pp) is inside the ` +
      `±${cfg.edgePpToActOn}pp no-action band. Keep AI as filter-only.`,
    edgePp,
    monthsObserved,
    evidenceSufficient: true,
  };
}
