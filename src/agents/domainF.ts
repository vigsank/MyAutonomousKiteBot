import { def } from "./helpers";
import { AgentContext, AgentDef, TradeProposal } from "./types";
import { TradeRequest } from "../server/types";
import { RSI, SMA } from "@debut/indicators";
import { routerFor } from "./router";

/**
 * Domain F — decision (golden path) agents.
 *
 * F1 regime        : merge news/sentiment/indicators/holdings context + symbol list.
 * F2 screener      : shortlist enabled watchlist symbols (top 5).
 * F3 validator     : LLM hypothesize + code verify (stub).
 * F4 strategist    : A2A-style composite score (sentiment + indicators + regime + holdings),
 *                    pick strongest |composite|>0.2, build proposal; forceSignal test hook.
 * F5 risk_precheck : risk pre-check (code, soft).
 * F6 execute      : read latest proposal, run risk gate, paper-execute or defer to HITL.
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
 * Pull the most recent ~60 daily closes for a symbol from the ledger's candles
 * table (joined to instruments by tradingsymbol), oldest → newest.
 */
function fetchCloses(ctx: AgentContext, symbol: string): number[] {
  const rows = ctx.ledger
    .raw()
    .prepare(
      `SELECT c.close FROM candles c
        JOIN instruments i ON i.instrument_id = c.instrument_id
       WHERE i.tradingsymbol = ?
       ORDER BY c.timestamp DESC
       LIMIT 60`,
    )
    .all(symbol) as Array<{ close: number }>;
  return rows.map((r) => r.close).reverse();
}

/** Compute RSI(14) and SMA(20) over the given closes (oldest → newest). */
function computeIndicators(closes: number[]): { rsi: number | null; sma20: number | null } {
  if (closes.length < 20) return { rsi: null, sma20: null };
  const rsi = new RSI(14);
  const sma = new SMA(20);
  let rsiVal: number | null = null;
  let smaVal: number | null = null;
  for (const c of closes) {
    const r = rsi.nextValue(c);
    if (r !== undefined) rsiVal = r;
    const s = sma.nextValue(c);
    if (s !== undefined) smaVal = s;
  }
  return { rsi: rsiVal, sma20: smaVal };
}

/**
 * Indicator signal: +1 oversold (mean-reversion buy) or close > SMA20 (trend up),
 * -1 overbought or close < SMA20, else 0.
 */
function indicatorSignal(rsi: number | null, close: number, sma20: number | null): number {
  if (rsi === null || sma20 === null) return 0;
  if (rsi < 30 || close > sma20) return 1;
  if (rsi > 70 || close < sma20) return -1;
  return 0;
}

/** Regime signal from close vs SMA20: trending_up (+1), trending_down (-1), ranging (0). */
function regimeSignal(close: number, sma20: number | null): number {
  if (sma20 === null) return 0;
  if (close > sma20) return 1;
  if (close < sma20) return -1;
  return 0;
}

export function buildDomainAgents(): AgentDef[] {
  return [
    def(
      "regime",
      "Regime",
      "F1",
      false,
      ["news_feed", "sentiment", "indicator", "holdings"],
      async (ctx: AgentContext) => {
        const note = `regime: merging news/sentiment/indicators/holdings context for ${ctx.symbols.length} symbols into a regime note (LLM synthesis planned)`;
        return {
          summary: note,
          payload: { symbols: ctx.symbols, passNumber: ctx.passNumber },
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
        const shortlist = ctx.config.watchlist
          .filter((s) => s.enabled)
          .map((s) => s.tradingsymbol)
          .slice(0, 5);
        return {
          summary: `screener: shortlist ${shortlist.length} symbols from enabled watchlist`,
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
      ["validator"],
      async (ctx: AgentContext) => {
        // Test hook: force a proposal for a specific symbol, skipping all scoring.
        if (ctx.config.agents.forceSignal) {
          const symbol = ctx.config.agents.forceSignalSymbol;
          const inst = ctx.ledger.getInstrumentBySymbol(symbol, "NSE");
          const entryPrice = inst ? inst.last_price : 0;
          if (!entryPrice || entryPrice <= 0) {
            latestProposal = null;
            return { summary: `strategist: forceSignal ${symbol} skipped (no known price)`, payload: null };
          }
          const quantity = Math.max(1, Math.floor((ctx.config.risk.availableCapital * 0.01) / entryPrice));
          const proposal: TradeProposal = {
            symbol,
            orderType: "BUY",
            quantity,
            direction: "LONG",
            entryPrice,
            thesis: `forceSignal hook: BUY ${symbol} (downstream: ${routerFor("BUY").join(", ")})`,
            riskScore: 0,
            timestamp: ctx.now.toISOString(),
          };
          latestProposal = proposal;
          return {
            summary: `strategist: forceSignal BUY ${quantity} ${symbol} @ ${entryPrice.toFixed(2)} (LONG)`,
            payload: proposal,
          };
        }

        // A2A-style composite scoring across sentiment + indicators + regime + holdings.
        const openSymbols = new Set(ctx.ledger.getOpenPositions().map((p) => p.symbol));
        const scored: Array<{ symbol: string; score: number; thesis: string }> = [];
        for (const sym of ctx.symbols) {
          if (openSymbols.has(sym)) continue; // already holding — no add
          const sentiment = await ctx.news.sentimentFor(sym);
          const sent = sentiment ? sentiment.score : 0;
          const closes = fetchCloses(ctx, sym);
          const { rsi, sma20 } = computeIndicators(closes);
          const close = closes.length > 0 ? closes[closes.length - 1] : 0;
          const indicator = indicatorSignal(rsi, close, sma20);
          const regime = regimeSignal(close, sma20);
          const composite = 0.5 * sent + 0.3 * indicator + 0.2 * regime;
          if (Math.abs(composite) > 0.2) {
            scored.push({
              symbol: sym,
              score: composite,
              thesis: `sentiment ${sent.toFixed(3)} | indicator ${indicator} | regime ${regime} | rsi ${rsi?.toFixed(1) ?? "n/a"} | sma20 ${sma20?.toFixed(2) ?? "n/a"}`,
            });
          }
        }
        if (scored.length === 0) {
          latestProposal = null;
          return { summary: "strategist: no actionable proposal", payload: null };
        }
        scored.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
        const best = scored[0];

        // Best-effort latest known price from the ledger's instrument record.
        const inst = ctx.ledger.getInstrumentBySymbol(best.symbol, "NSE");
        const entryPrice = inst ? inst.last_price : 0;
        if (!entryPrice || entryPrice <= 0) {
          latestProposal = null;
          return { summary: `strategist: ${best.symbol} skipped (no known price)`, payload: null };
        }

        const direction = best.score > 0 ? "LONG" : "SHORT";
        const orderType = direction === "LONG" ? "BUY" : "SELL";
        const quantity = Math.max(1, Math.floor((ctx.config.risk.availableCapital * 0.01) / entryPrice));
        const downstream = routerFor(orderType).join(", ");
        const proposal: TradeProposal = {
          symbol: best.symbol,
          orderType,
          quantity,
          direction,
          entryPrice,
          thesis: `composite ${best.score.toFixed(3)} (${best.thesis}) | downstream: ${downstream}`,
          riskScore: Math.min(100, Math.round(Math.abs(best.score) * 100)),
          timestamp: ctx.now.toISOString(),
        };
        latestProposal = proposal;
        return {
          summary: `strategist: ${orderType} ${quantity} ${best.symbol} @ ${entryPrice.toFixed(2)} (${direction})`,
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
        if (!ctx.risk || !ctx.trader) {
          return { summary: "execute: no risk/trader wired", status: "skipped" };
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
          return {
            summary: `execute: risk REJECTED: ${decision.reasons.join("; ")}`,
            payload: { allowed: false, reasons: decision.reasons },
          };
        }

        // Above the auto-trade threshold, defer to human-in-the-loop approval.
        if (trade.ticketSize > ctx.config.risk.autoTradeTicketThreshold) {
          return {
            summary: "execute: approved but requires HITL approval",
            status: "skipped",
            payload: { allowed: true, needsApproval: true },
          };
        }

        // Paper-only execution — this never touches a real Kite order.
        const fill = ctx.trader.execute(trade);
        return {
          summary: `execute: executed ${proposal.symbol} ${proposal.quantity}@${fill.price.toFixed(2)}`,
          payload: fill,
        };
      },
    ),
  ];
}
