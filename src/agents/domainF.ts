import { def } from "./helpers";
import { AgentContext, AgentDef, TradeProposal } from "./types";
import { TradeRequest } from "../server/types";
import { routerFor } from "./router";

/**
 * Domain F — decision (golden path) agents.
 *
 * AUTHORITY MODEL (G4): momentum ORIGINATES, AI FILTERS.
 *   - `momentum_rank` publishes the validated cross-sectional momentum ranking
 *     to the blackboard. It is the ONLY source of trade candidates.
 *   - `screener` shortlists from that ranking, not the watchlist.
 *   - `strategist` picks from the momentum TARGET, applies the AI layer as a
 *     filter (report AVOID veto, strong-negative-sentiment veto, soft tilt that
 *     can only SHRINK size — never upsize), and records any AI-originated idea
 *     outside momentum as a SHADOW proposal (never executable).
 *   - `execute` routes the MOMENTUM proposal through LiveTrader (idempotency +
 *     live gate + reconciliation halt) and refuses any non-MOMENTUM originator.
 *
 * All agents are sequential (parallel false) and never throw (guarded by `def`).
 */

/**
 * Module-level hand-off from the sequential strategist to the execute agent.
 * The orchestrator runs strategist before execute (via deps), so the execute
 * agent reads whatever the latest strategist run produced here.
 */
let latestProposal: TradeProposal | null = null;

/**
 * Strongly-negative sentiment that vetoes a candidate outright. Softer negative
 * values only shrink (tilt < 1), never veto.
 */
const VETO_SENTIMENT = -0.5;

/** Report biases that veto a candidate outright. */
const VETO_BIASES = new Set(["AVOID", "EXIT_FULL"]);

export function buildDomainAgents(): AgentDef[] {
  return [
    def(
      "momentum_rank",
      "Momentum Rank",
      "F0",
      true,
      [],
      async (ctx: AgentContext) => {
        if (!ctx.momentum) {
          return {
            summary: "momentum_rank: no momentum strategy wired",
            status: "skipped" as const,
          };
        }
        const ranking = ctx.momentum.lastRanking();
        if (!ranking || ranking.candidates.length === 0) {
          return {
            summary: "momentum_rank: no ranking computed yet",
            status: "skipped" as const,
          };
        }
        return {
          summary: `momentum_rank: ${ranking.candidates.length} candidate(s), target ${ranking.target.length}`,
          payload: ranking,
        };
      },
    ),

    def(
      "regime",
      "Regime",
      "F1",
      false,
      ["news_feed", "sentiment", "indicator", "holdings", "momentum_rank", "daily_report_context"],
      async (ctx: AgentContext) => {
        const breadth = ctx.blackboard.breadth();
        const report = ctx.blackboard.report();
        const sentiment = ctx.blackboard.sentiment();
        const regimeScore =
          report?.regimeScore ?? (sentiment ? sentiment.avg : 0);
        const posture: "risk-on" | "risk-off" | "neutral" =
          (breadth && breadth.breadth > 0.2) || regimeScore > 0.2
            ? "risk-on"
            : (breadth && breadth.breadth < -0.2) || regimeScore < -0.2
              ? "risk-off"
              : "neutral";
        return {
          summary: `regime: ${posture} (regime ${regimeScore.toFixed(2)})`,
          payload: {
            posture,
            breadth: breadth?.breadth ?? 0,
            regimeScore,
            avgSentiment: sentiment?.avg ?? 0,
            notes: ["momentum-originated, AI-filtered authority model"],
          },
        };
      },
    ),

    def(
      "screener",
      "Screener",
      "F2",
      false,
      ["regime"],
      async (ctx: AgentContext) => {
        const mom = ctx.blackboard.momentum();
        if (!mom || mom.candidates.length === 0) {
          return { summary: "screener: no momentum ranking => skip", status: "skipped" as const };
        }
        const regime = ctx.blackboard.regime();
        // In risk-off, tighten to the current target book; otherwise screen the
        // full momentum ranking (candidates are the only legitimate universe).
        const shortlist =
          regime?.posture === "risk-off"
            ? mom.candidates.filter((c) => c.inTarget).map((c) => c.symbol)
            : mom.candidates.map((c) => c.symbol);
        return {
          summary: `screener: shortlist ${shortlist.length} symbol(s) from momentum ranking`,
          payload: { shortlist },
        };
      },
    ),

    def(
      "validator",
      "Validator",
      "F3",
      false,
      ["screener"],
      async () => "validator: LLM hypothesize + code verify (stub)",
    ),

    def(
      "strategist",
      "Strategist",
      "F4",
      false,
      ["validator", "momentum_rank", "daily_report_context", "sentiment"],
      async (ctx: AgentContext) => {
        // Test hook: force a proposal for a specific symbol, skipping all scoring.
        if (ctx.config.agents.forceSignal) {
          return forceSignalProposal(ctx);
        }

        const mom = ctx.blackboard.momentum();
        if (!mom || mom.candidates.length === 0) {
          latestProposal = null;
          return { summary: "strategist: no momentum ranking => no proposal", status: "skipped" as const };
        }
        const report = ctx.blackboard.report();
        const sentiment = ctx.blackboard.sentiment();
        const openSymbols = new Set(ctx.ledger.getOpenPositions().map((p) => p.symbol));
        const momentumTarget = new Set(
          mom.candidates.filter((c) => c.inTarget).map((c) => c.symbol),
        );

        // Record any AI-originated idea OUTSIDE the momentum ranking as a shadow
        // proposal — evidence for AiAuthorityPolicy, never executed.
        recordShadowIdeas(ctx, mom, momentumTarget, sentiment);

        // Score the momentum targets: report AVOID / strong-negative sentiment
        // veto; softer negative sentiment shrinks (tilt < 1, never > 1).
        const scored: Array<{
          symbol: string;
          momentum: number;
          aiTilt: number;
          vetoed: boolean;
          reason: string;
        }> = [];
        const vetoes: string[] = [];
        for (const c of mom.candidates) {
          if (!momentumTarget.has(c.symbol) || openSymbols.has(c.symbol)) continue;
          let aiTilt = 1;
          let vetoed = false;
          const reasonParts: string[] = [];
          const bias = report?.bias?.[c.symbol];
          if (bias && VETO_BIASES.has(bias)) {
            vetoed = true;
            vetoes.push(`${c.symbol}: report ${bias}`);
            reasonParts.push(`report ${bias}`);
          }
          const sent = sentiment?.scores?.[c.symbol];
          if (sent !== undefined) {
            if (sent <= VETO_SENTIMENT) {
              vetoed = true;
              vetoes.push(`${c.symbol}: sentiment ${sent.toFixed(2)}`);
              reasonParts.push(`sentiment ${sent.toFixed(2)}`);
            } else if (sent < 0) {
              // Soft-negative: shrink proportionally, bounded well below 1 and
              // never zeroed (a weak tilt is a size reduction, not a veto).
              aiTilt = Math.max(0.5, 1 + sent); // sent in (-0.5, 0) -> tilt in (0.5, 1)
              reasonParts.push(`tilt ${aiTilt.toFixed(2)}`);
            }
          }
          if (vetoed) {
            scored.push({ symbol: c.symbol, momentum: c.momentum, aiTilt: 0, vetoed: true, reason: reasonParts.join(", ") });
            continue;
          }
          scored.push({ symbol: c.symbol, momentum: c.momentum, aiTilt, vetoed: false, reason: reasonParts.join(", ") });
        }

        const actionable = scored.filter((s) => !s.vetoed);
        if (actionable.length === 0) {
          latestProposal = null;
          return {
            summary: `strategist: all momentum targets vetoed (${vetoes.length})`,
            payload: { vetoes, proposed: null },
          };
        }

        // Pick the highest-momentum actionable target (rank order is descending).
        const best = actionable[0];
        const inst = ctx.ledger.getInstrumentBySymbol(best.symbol, "NSE");
        const entryPrice = inst ? inst.last_price : 0;
        if (!entryPrice || entryPrice <= 0) {
          latestProposal = null;
          return { summary: `strategist: ${best.symbol} skipped (no known price)`, payload: null };
        }

        // Size via the momentum strategy's rule, then shrink by the AI tilt.
        const baseSize = ctx.momentum ? ctx.momentum.sizeFor(best.symbol, entryPrice) : 0;
        const rawSize =
          baseSize > 0
            ? baseSize
            : Math.max(1, Math.floor((ctx.config.risk.availableCapital * 0.01) / entryPrice));
        const quantity = Math.max(1, Math.floor(rawSize * best.aiTilt));
        const proposal: TradeProposal = {
          symbol: best.symbol,
          orderType: "BUY",
          quantity,
          direction: "LONG",
          entryPrice,
          thesis: `momentum rank #${best.momentum.toFixed(3)} (${best.reason || "no AI override"}) | downstream: ${routerFor("BUY").join(", ")}`,
          riskScore: Math.min(100, Math.round(best.momentum * 100 + 50)),
          timestamp: ctx.now.toISOString(),
          originator: "MOMENTUM",
          aiTilt: best.aiTilt,
        };
        latestProposal = proposal;
        return {
          summary: `strategist: BUY ${quantity} ${best.symbol} @ ${entryPrice.toFixed(2)} (MOMENTUM, tilt ${best.aiTilt.toFixed(2)})`,
          payload: proposal,
        };
      },
    ),

    def(
      "risk_precheck",
      "Risk Pre-check",
      "F5",
      false,
      ["strategist"],
      async () => "risk pre-check: code (soft)",
    ),

    def(
      "execute",
      "Execute",
      "F6",
      false,
      ["risk_precheck"],
      async (ctx: AgentContext) => {
        const proposal = latestProposal;
        if (!proposal) {
          return { summary: "execute: nothing to execute" };
        }
        if (!ctx.risk) {
          return { summary: "execute: no risk engine wired", status: "skipped" as const };
        }
        if (!ctx.liveTrader && !ctx.trader) {
          return { summary: "execute: no risk/trader wired", status: "skipped" as const };
        }

        // G4/G5: only MOMENTUM-originated proposals may execute. Any other
        // originator is recorded as a shadow row and refused.
        if (proposal.originator && proposal.originator !== "MOMENTUM") {
          ctx.ledger.recordAgentProposal({
            symbol: proposal.symbol,
            originator: proposal.originator,
            direction: proposal.direction,
            quantity: proposal.quantity,
            entryPrice: proposal.entryPrice,
            aiTilt: proposal.aiTilt ?? 1,
            thesis: proposal.thesis,
            executed: false,
            outcome: "SHADOW",
          });
          return {
            summary: `execute: refused ${proposal.originator}-originated proposal (MOMENTUM only)`,
            status: "skipped" as const,
          };
        }

        const trade: TradeRequest = {
          symbol: proposal.symbol,
          exchange: "NSE",
          quantity: proposal.quantity,
          direction: proposal.direction,
          entryPrice: proposal.entryPrice,
          reason: proposal.thesis,
          ticketSize: proposal.quantity * proposal.entryPrice,
          timestamp: ctx.now,
        };

        // Hard gate: the RiskEngine is the immutable risk decision-maker.
        const decision = ctx.risk.evaluate(trade);
        if (!decision.allowed) {
          ctx.ledger.recordAgentProposal({
            symbol: proposal.symbol,
            originator: "MOMENTUM",
            direction: proposal.direction,
            quantity: proposal.quantity,
            entryPrice: proposal.entryPrice,
            aiTilt: proposal.aiTilt ?? 1,
            thesis: proposal.thesis,
            executed: false,
            outcome: `RISK: ${decision.reasons.join("; ")}`,
          });
          return {
            summary: `execute: risk REJECTED: ${decision.reasons.join("; ")}`,
            payload: { allowed: false, reasons: decision.reasons },
          };
        }

        // Above the auto-trade threshold, defer to human-in-the-loop approval.
        if (trade.ticketSize > ctx.config.risk.autoTradeTicketThreshold) {
          return {
            summary: "execute: approved but requires HITL approval",
            status: "skipped" as const,
            payload: { allowed: true, needsApproval: true },
          };
        }

        // Route through LiveTrader when wired (idempotency + live gate + recon
        // halt), else PaperTrader. LiveTrader returns null on a duplicate intent.
        const fill = ctx.liveTrader
          ? ctx.liveTrader.execute(trade, "AGENT_" + proposal.symbol)
          : ctx.trader!.execute(trade);
        if (!fill) {
          return { summary: "execute: duplicate/blocked intent (not re-fired)", status: "skipped" as const };
        }
        ctx.ledger.recordAgentProposal({
          symbol: proposal.symbol,
          originator: "MOMENTUM",
          direction: proposal.direction,
          quantity: proposal.quantity,
          entryPrice: proposal.entryPrice,
          aiTilt: proposal.aiTilt ?? 1,
          thesis: proposal.thesis,
          executed: true,
          outcome: "FILLED",
        });
        return {
          summary: `execute: executed ${proposal.symbol} ${proposal.quantity}@${fill.price.toFixed(2)}`,
          payload: fill,
        };
      },
    ),
  ];
}

/** forceSignal dev hook: propose a specific symbol, bypassing scoring. */
function forceSignalProposal(ctx: AgentContext): { summary: string; status?: "skipped" } {
  const symbol = ctx.config.agents.forceSignalSymbol;
  const inst = ctx.ledger.getInstrumentBySymbol(symbol, "NSE");
  const entryPrice = inst ? inst.last_price : 0;
  if (!entryPrice || entryPrice <= 0) {
    latestProposal = null;
    return { summary: `strategist: forceSignal ${symbol} skipped (no known price)`, status: "skipped" };
  }
  const quantity = Math.max(1, Math.floor((ctx.config.risk.availableCapital * 0.01) / entryPrice));
  latestProposal = {
    symbol,
    orderType: "BUY",
    quantity,
    direction: "LONG",
    entryPrice,
    thesis: `forceSignal hook: BUY ${symbol}`,
    riskScore: 0,
    timestamp: ctx.now.toISOString(),
    originator: "MOMENTUM",
    aiTilt: 1,
  };
  return { summary: `strategist: forceSignal BUY ${quantity} ${symbol} @ ${entryPrice.toFixed(2)} (LONG)` };
}

/**
 * Record AI-originated ideas (strongly bullish symbols absent from the momentum
 * ranking) as SHADOW proposals — evidence for AiAuthorityPolicy, never executed.
 */
function recordShadowIdeas(
  ctx: AgentContext,
  mom: { candidates: Array<{ symbol: string }>; target: string[] },
  momentumTarget: Set<string>,
  sentiment: { scores: Record<string, number> } | null,
): void {
  if (!sentiment) return;
  const ranked = new Set(mom.candidates.map((c) => c.symbol));
  for (const [symbol, score] of Object.entries(sentiment.scores)) {
    if (ranked.has(symbol) || momentumTarget.has(symbol)) continue;
    if (score > 0.5) {
      const inst = ctx.ledger.getInstrumentBySymbol(symbol, "NSE");
      ctx.ledger.recordAgentProposal({
        symbol,
        originator: "AI_COMPOSITE",
        direction: "LONG",
        quantity: 0,
        entryPrice: inst?.last_price ?? 0,
        aiTilt: 1,
        thesis: `AI-originated idea outside momentum ranking (sentiment ${score.toFixed(2)})`,
        executed: false,
        outcome: "SHADOW",
      });
    }
  }
}
