import { def } from "./helpers";
import { AgentContext, AgentDef } from "./types";

/**
 * Domain G — post-trade agents.
 *
 * G1 trade_journal          : list FILLED trades from the ledger.
 * G2 performance_attribution : total PnL, win rate, per-symbol PnL.
 * G3 post_trade_review       : LLM review of what worked (stub).
 * G4 daily_report            : one-line daily summary.
 *
 * All agents are parallel and never throw (guarded by `def`). The orchestrator
 * does not pass payloads between agents, so each downstream agent re-queries
 * the ledger directly to stay self-contained.
 */

interface TradeRow {
  symbol: string;
  direction: string;
  quantity: number;
  price: number;
  pnl: number | null;
  reason: string;
  created_at: string;
}

interface PerformancePayload {
  totalPnl: number;
  winRate: number;
  perSymbol: Record<string, number>;
}

/** Query the ledger for all FILLED trades, newest first. */
function fetchFilledTrades(ctx: AgentContext): TradeRow[] {
  return ctx.ledger
    .raw()
    .prepare(
      `SELECT i.tradingsymbol AS symbol, t.direction AS direction,
              t.quantity AS quantity, t.price AS price, t.pnl AS pnl,
              t.reason AS reason, t.created_at AS created_at
         FROM trades t
         JOIN instruments i ON i.instrument_id = t.instrument_id
        WHERE t.status = 'FILLED'
        ORDER BY t.created_at DESC`,
    )
    .all() as TradeRow[];
}

/** Compute total PnL, win rate, and per-symbol PnL from FILLED trades. */
function computePerformance(trades: TradeRow[]): PerformancePayload {
  let totalPnl = 0;
  let wins = 0;
  const perSymbol: Record<string, number> = {};
  for (const t of trades) {
    const pnl = t.pnl ?? 0;
    totalPnl += pnl;
    if (pnl > 0) wins += 1;
    perSymbol[t.symbol] = (perSymbol[t.symbol] ?? 0) + pnl;
  }
  const winRate = trades.length > 0 ? wins / trades.length : 0;
  return { totalPnl, winRate, perSymbol };
}

export function buildDomainAgents(): AgentDef[] {
  return [
    def(
      "trade_journal",
      "Trade Journal",
      "G1",
      true,
      [],
      async (ctx: AgentContext) => {
        const trades = fetchFilledTrades(ctx);
        const list = trades.map((t) => ({
          symbol: t.symbol,
          direction: t.direction,
          quantity: t.quantity,
          price: t.price,
          pnl: t.pnl,
          reason: t.reason,
          created_at: t.created_at,
        }));
        return {
          summary: `trade_journal: ${list.length} FILLED trades`,
          payload: { count: list.length, trades: list },
        };
      },
    ),

    def(
      "performance_attribution",
      "Performance Attribution",
      "G2",
      true,
      ["trade_journal"],
      async (ctx: AgentContext) => {
        const trades = fetchFilledTrades(ctx);
        const perf = computePerformance(trades);
        return {
          summary: `performance_attribution: total PnL ${perf.totalPnl.toFixed(2)}, win rate ${(perf.winRate * 100).toFixed(1)}% across ${trades.length} trades`,
          payload: perf,
        };
      },
    ),

    def(
      "post_trade_review",
      "Post-Trade Review",
      "G3",
      true,
      ["performance_attribution"],
      async (ctx: AgentContext) => {
        const perf = computePerformance(fetchFilledTrades(ctx));
        return {
          summary: "post_trade_review: LLM review of what worked (stub)",
          payload: perf,
        };
      },
    ),

    def(
      "daily_report",
      "Daily Report",
      "G4",
      true,
      ["performance_attribution"],
      async (ctx: AgentContext) => {
        const perf = computePerformance(fetchFilledTrades(ctx));
        const openPositions = ctx.ledger.getOpenPositions().length;
        const summary = `daily_report: PnL ${perf.totalPnl.toFixed(2)}, win rate ${(perf.winRate * 100).toFixed(1)}%, ${openPositions} open positions`;
        return {
          summary,
          payload: { ...perf, openPositions },
        };
      },
    ),
  ];
}
