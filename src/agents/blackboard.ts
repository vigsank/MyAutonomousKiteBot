import { AgentId } from "./types";

/**
 * Blackboard — the shared reasoning surface for an agent pass.
 *
 * WHY THIS EXISTS:
 * The orchestrator resolves `deps` to decide *ordering*, but until now it never
 * handed an agent its dependencies' output. Every downstream agent therefore
 * recomputed what its upstream had already produced — `sentiment`,
 * `sector_rotation`, `market_breadth` and `strategist` each called
 * `news.sentimentFor()` over the whole symbol list, four times per pass, and
 * `market_breadth` was not actually informed by `sentiment` at all. The fleet
 * was a dependency-ordered list of scripts rather than agents that build on one
 * another.
 *
 * The blackboard closes that gap: as each agent completes, the orchestrator
 * publishes its payload here, and downstream agents read it instead of
 * recomputing. That is what makes the AI layer genuinely orchestrating rather
 * than decorative.
 *
 * Design notes:
 *  - Write-once per agent per pass. An agent publishes its own result and never
 *    overwrites another's, so a pass is reproducible and attributable.
 *  - Reads are total: `read` returns `null` for a missing or failed upstream
 *    rather than throwing. An agent must degrade, never take down the pass.
 *  - Typed accessors below encode the shape of well-known payloads in one
 *    place, so a payload-shape change breaks at compile time instead of
 *    silently returning `undefined` deep inside a scoring function.
 */

/** Per-symbol sentiment, published by the `sentiment` agent (D1). */
export interface SentimentPayload {
  count: number;
  avg: number;
  scores: Record<string, number>;
  labels: Record<string, string>;
}

/** Breadth read, published by the `market_breadth` agent (D3). */
export interface BreadthPayload {
  breadth: number;
  label: "risk-on" | "risk-off" | "neutral";
  bullish: number;
  bearish: number;
  total: number;
}

/** Sentiment-bucketed symbols, published by `sector_rotation` (D2). */
export interface RotationPayload {
  bullish: string[];
  bearish: string[];
  neutral: string[];
}

/** One momentum-ranked candidate. */
export interface MomentumCandidate {
  symbol: string;
  momentum: number;
  /** True when the symbol is in the strategy's current target portfolio. */
  inTarget: boolean;
}

/**
 * The momentum edge's view, published by the `momentum_rank` agent.
 *
 * This is the ONLY source of trade candidates. The AI layer may veto, shrink or
 * re-rank these, but may not add to them — see the note on `strategist`.
 */
export interface MomentumPayload {
  candidates: MomentumCandidate[];
  target: string[];
  topN: number;
  /** ISO timestamp of the ranking this reflects, or null when never computed. */
  computedAt: string | null;
}

/** The LLM reasoning layer's latest report, published by `daily_report_context`. */
export interface ReportPayload {
  /** -1.0 .. +1.0 overall market regime score from the report. */
  regimeScore: number;
  overallSentiment: string;
  /** Per-symbol action bias, e.g. AVOID / BUY_ACCUMULATE / TRIM_50. */
  bias: Record<string, string>;
  /** Per-symbol suggested allocation in INR (advisory only). */
  suggestedAllocation: Record<string, number>;
  recommendedCashReservePct: number | null;
  createdAt: string;
}

/** Regime synthesis, published by the `regime` agent (F1). */
export interface RegimePayload {
  /** Combined risk posture derived from breadth + report + sentiment. */
  posture: "risk-on" | "risk-off" | "neutral";
  breadth: number;
  regimeScore: number;
  avgSentiment: number;
  notes: string[];
}

export class Blackboard {
  private readonly data = new Map<AgentId, unknown>();

  /** Publish an agent's payload. Ignores `undefined` so a payload-less agent is a no-op. */
  publish(id: AgentId, payload: unknown): void {
    if (payload === undefined) return;
    this.data.set(id, payload);
  }

  /** Read a payload, or `null` when the agent did not run / produced nothing. */
  read<T>(id: AgentId): T | null {
    const v = this.data.get(id);
    return (v as T) ?? null;
  }

  has(id: AgentId): boolean {
    return this.data.has(id);
  }

  /** Ids published so far — useful for debugging a pass. */
  keys(): AgentId[] {
    return [...this.data.keys()];
  }

  /* ---------------- typed accessors for well-known payloads ---------------- */

  sentiment(): SentimentPayload | null {
    return this.read<SentimentPayload>("sentiment");
  }

  breadth(): BreadthPayload | null {
    return this.read<BreadthPayload>("market_breadth");
  }

  rotation(): RotationPayload | null {
    return this.read<RotationPayload>("sector_rotation");
  }

  momentum(): MomentumPayload | null {
    return this.read<MomentumPayload>("momentum_rank");
  }

  report(): ReportPayload | null {
    return this.read<ReportPayload>("daily_report_context");
  }

  regime(): RegimePayload | null {
    return this.read<RegimePayload>("regime");
  }

  /**
   * Sentiment score for a symbol from the blackboard, or `null` when the
   * `sentiment` agent has not published (caller decides how to degrade).
   *
   * Deliberately does NOT fall back to calling the news engine: a silent
   * recompute is exactly the behaviour this class exists to remove.
   */
  sentimentFor(symbol: string): number | null {
    const s = this.sentiment();
    if (!s) return null;
    const v = s.scores[symbol];
    return typeof v === "number" ? v : null;
  }
}
