import { logger } from "../server/Logger";
import { TradeRequest } from "../server/types";
import { def } from "./helpers";
import { AgentContext, AgentDef, AgentId, AgentResult } from "./types";

/**
 * HoldingsReview — manages EXISTING positions (not new entries).
 *
 * Runs at the 3 daily windows (pre-open / mid-session / pre-close) alongside
 * the probe. For each open position it decides HOLD / TRIM / EXIT using:
 *   - rule-based hard exits (stop-loss, broken trend)
 *   - an AI-backed holdings verdict (news sentiment + LLM)
 *   - rebalancing (trim overweight) and profit-booking (trim at a target)
 * All actions route through RiskEngine -> PaperTrader (paper-only).
 */

/** Compute a simple trend from the ledger candles (close vs SMA20). */
function computeTrend(ctx: AgentContext, symbol: string): "up" | "down" | "flat" {
  try {
    const rows = ctx.ledger
      .raw()
      .prepare(
        `SELECT c.close FROM candles c
           JOIN instruments i ON i.instrument_id = c.instrument_id
          WHERE i.tradingsymbol = ? ORDER BY c.timestamp DESC LIMIT 20`,
      )
      .all(symbol) as Array<{ close: number }>;
    if (rows.length < 20) return "flat";
    const closes = rows.map((r) => r.close).reverse();
    const sma = closes.reduce((s, v) => s + v, 0) / closes.length;
    const last = closes[closes.length - 1];
    if (last > sma * 1.005) return "up";
    if (last < sma * 0.995) return "down";
    return "flat";
  } catch {
    return "flat";
  }
}

/** Execute a paper close (sell-to-close LONG / buy-to-close SHORT) via RiskEngine. */
function closePosition(ctx: AgentContext, symbol: string, direction: string, quantity: number, price: number, reason: string): string {
  if (!ctx.risk || !ctx.trader) return "no risk/trader wired";
  const trade: TradeRequest = {
    symbol,
    exchange: "NSE",
    quantity,
    direction: direction === "LONG" ? "SHORT" : "LONG",
    entryPrice: price,
    reason,
    ticketSize: quantity * price,
    timestamp: ctx.now,
  };
  const decision = ctx.risk.evaluate(trade);
  if (!decision.allowed) return `risk REJECTED: ${decision.reasons.join("; ")}`;
  const fill = ctx.trader.execute(trade);
  return `closed ${fill.quantity} ${symbol} @ ${fill.price.toFixed(2)} (${fill.status})`;
}

/** Run the holdings review for all open positions. Returns an AgentResult. */
export async function runHoldingsReview(ctx: AgentContext, runType: string): Promise<AgentResult> {
  const start = Date.now();
  const cfg = ctx.config.strategy;
  const positions = ctx.ledger.getOpenPositions();
  const actions: Array<{ symbol: string; action: string; detail: string }> = [];

  for (const pos of positions) {
    try {
      const symbol = pos.symbol;
      const inst = ctx.ledger.getInstrumentBySymbol(symbol, "NSE");
      let price = inst?.last_price ?? 0;
      if (!price || price <= 0) {
        // Fall back to the mock MCP quote if the ledger has no price.
        if (ctx.mcp?.enabled) {
          const q = await ctx.mcp.getLtp(symbol);
          const m = q ? /"last_price":\s*([\d.]+)/.exec(q) : null;
          if (m) price = Number(m[1]);
        }
      }
      if (!price || price <= 0) {
        actions.push({ symbol, action: "SKIP", detail: "no price" });
        continue;
      }

      const unrealizedPnlPct =
        pos.direction === "LONG"
          ? ((price - pos.avgPrice) / pos.avgPrice) * 100
          : ((pos.avgPrice - price) / pos.avgPrice) * 100;
      const sentiment = (await ctx.news.sentimentFor(symbol).catch(() => null))?.score ?? 0;
      const trend = computeTrend(ctx, symbol);
      const weightPct = (pos.quantity * price / ctx.config.risk.availableCapital) * 100;

      // AI-backed verdict (best-effort; falls back to rules on failure).
      const ai = await ctx.news.holdingsVerdict({
        symbol,
        direction: pos.direction,
        quantity: pos.quantity,
        avgPrice: pos.avgPrice,
        currentPrice: price,
        unrealizedPnlPct,
        sentiment,
        trend,
        weightPct,
      }).catch(() => null);

      let action: "HOLD" | "TRIM" | "EXIT" = "HOLD";
      let detail = "hold";

      // 1. Rule-based hard exits (before AI).
      if (unrealizedPnlPct <= -cfg.stopLossPercent) {
        action = "EXIT";
        detail = `stop-loss (${unrealizedPnlPct.toFixed(1)}%)`;
      } else if (trend === "down" && pos.direction === "LONG") {
        action = "EXIT";
        detail = "trend broken";
      } else if (ai) {
        // 2. AI-driven decision.
        if (ai.action === "EXIT" || ai.riskScore >= cfg.analystRejectThreshold) {
          action = "EXIT";
          detail = `AI: ${ai.rationale}`;
        } else if (ai.action === "TRIM" || weightPct > cfg.holdingsTargetWeightPct) {
          action = "TRIM";
          detail = `AI: ${ai.rationale}${weightPct > cfg.holdingsTargetWeightPct ? ` (overweight ${weightPct.toFixed(1)}%)` : ""}`;
        } else if (unrealizedPnlPct >= cfg.holdingsProfitTargetPct) {
          action = "TRIM";
          detail = `book profit (${unrealizedPnlPct.toFixed(1)}%)`;
        }
      } else if (unrealizedPnlPct >= cfg.holdingsProfitTargetPct) {
        // 3. No AI — rule-based profit-booking.
        action = "TRIM";
        detail = `book profit (${unrealizedPnlPct.toFixed(1)}%)`;
      }

      if (action === "HOLD") {
        actions.push({ symbol, action, detail });
        continue;
      }

      const qty = action === "EXIT" ? pos.quantity : Math.max(1, Math.floor(pos.quantity / 2));
      const result = closePosition(ctx, symbol, pos.direction, qty, price, `holdings ${action}: ${detail}`);
      actions.push({ symbol, action, detail: `${detail} -> ${result}` });
    } catch (err) {
      logger.warn({ symbol: pos.symbol, err }, "holdings review position failed");
      actions.push({ symbol: pos.symbol, action: "ERROR", detail: String(err) });
    }
  }

  const summary = `holdings_review[${runType}]: ${positions.length} position(s) -> ` +
    actions.map((a) => `${a.symbol}:${a.action}`).join(", ") || "no open positions";
  return {
    id: "holdings_review",
    status: "done",
    startedAt: new Date(start),
    durationMs: Date.now() - start,
    summary,
    payload: { runType, actions },
  };
}

/** Registered agent so it appears in the fleet registry (fired on-demand at the 3 windows). */
export function buildHoldingsReviewAgent(): AgentDef {
  return def(
    "holdings_review",
    "Holdings Review",
    "E",
    false,
    [],
    async (ctx: AgentContext) => {
      const r = await runHoldingsReview(ctx, "cadence");
      return { summary: r.summary, payload: r.payload };
    },
  );
}
