import { def } from "./helpers";
import { AgentContext, AgentDef } from "./types";

/**
 * Domain H — governance agents.
 *
 * H1 risk_watchdog        : drawdown vs max, open positions vs max entries.
 * H2 data_integrity       : row counts for candles/signals/trades/news_articles.
 * H3 hallucination_guard  : LLM re-checks agent outputs (stub).
 * H4 audit_trace          : recent LLM trace count.
 * H5 token_budget         : cost watchdog (stub).
 *
 * All agents are parallel, depend on nothing, and never throw (guarded by
 * `def`). Each queries the ledger directly to stay self-contained.
 */

export function buildDomainAgents(): AgentDef[] {
  return [
    def(
      "risk_watchdog",
      "Risk Watchdog",
      "H1",
      true,
      [],
      async (ctx: AgentContext) => {
        const drawdown = ctx.ledger.currentDrawdown();
        const maxDrawdown = ctx.config.risk.maxDailyDrawdown;
        const breached = drawdown > maxDrawdown;
        const openPositions = ctx.ledger.getOpenPositions().length;
        const maxEntries = ctx.config.strategy.maxSimultaneousEntries;
        const overLimit = openPositions > maxEntries;
        return {
          summary: `risk_watchdog: drawdown ${drawdown.toFixed(2)}/${maxDrawdown} ${breached ? "BREACHED" : "ok"}, ${openPositions}/${maxEntries} open positions ${overLimit ? "OVER LIMIT" : "ok"}`,
          payload: {
            drawdown,
            maxDrawdown,
            breached,
            openPositions,
            maxEntries,
            overLimit,
          },
        };
      },
    ),

    def(
      "data_integrity",
      "Data Integrity",
      "H2",
      true,
      [],
      async (ctx: AgentContext) => {
        const db = ctx.ledger.raw();
        const count = (table: string): number => {
          const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
          return row.n;
        };
        const candles = count("candles");
        const signals = count("signals");
        const trades = count("trades");
        const newsArticles = count("news_articles");
        const zeroTables = [
          candles === 0 ? "candles" : null,
          signals === 0 ? "signals" : null,
          trades === 0 ? "trades" : null,
          newsArticles === 0 ? "news_articles" : null,
        ].filter((t): t is string => t !== null);
        const note = zeroTables.length > 0 ? `empty tables: ${zeroTables.join(", ")}` : "all tables populated";
        return {
          summary: `data_integrity: candles ${candles}, signals ${signals}, trades ${trades}, news_articles ${newsArticles} (${note})`,
          payload: { candles, signals, trades, newsArticles, note },
        };
      },
    ),

    def(
      "hallucination_guard",
      "Hallucination Guard",
      "H3",
      true,
      [],
      async (ctx: AgentContext) => {
        const symbolCount = ctx.symbols.length;
        return {
          summary: `hallucination_guard: LLM re-checks agent outputs (stub) across ${symbolCount} symbols`,
          payload: { symbolCount },
        };
      },
    ),

    def(
      "audit_trace",
      "Audit Trace",
      "H4",
      true,
      [],
      async (ctx: AgentContext) => {
        const traces = ctx.ledger.getLlmTraces(20);
        const traceCount = traces.length;
        return {
          summary: `audit_trace: ${traceCount} recent LLM traces`,
          payload: { traceCount },
        };
      },
    ),

    def(
      "token_budget",
      "Token Budget",
      "H5",
      true,
      [],
      async (ctx: AgentContext) => {
        const symbolCount = ctx.symbols.length;
        return {
          summary: `token_budget: cost watchdog (stub) across ${symbolCount} symbols`,
          payload: { symbolCount },
        };
      },
    ),
  ];
}
