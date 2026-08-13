import { def } from "./helpers";
import { AgentContext, AgentDef } from "./types";

/**
 * Domain A — data ingestion agents.
 *
 * Each agent is a real, read-only implementation that never throws (the `def`
 * wrapper converts any error into a 'failed' result). They pull account and
 * market data from the ledger and the optional Kite MCP client.
 */

/** A1 — history_data: report persisted candle counts per symbol. */
const historyData = def(
  "history_data",
  "History Data",
  "A",
  true,
  [],
  async (ctx: AgentContext) => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const sym of ctx.symbols) {
      const row = ctx.ledger
        .raw()
        .prepare(
          `SELECT COUNT(*) c FROM candles c
             JOIN instruments i ON i.instrument_id = c.instrument_id
            WHERE i.tradingsymbol = ?`,
        )
        .get(sym) as { c: number } | undefined;
      const c = row?.c ?? 0;
      counts[sym] = c;
      total += c;
    }
    return {
      summary: `history_data: ${ctx.symbols.length} symbols, ${total} persisted candles total`,
      payload: { counts, total },
    };
  },
);

/** A2 — live_quote: latest prices via MCP when wired. */
const liveQuote = def(
  "live_quote",
  "Live Quote",
  "A",
  true,
  [],
  async (ctx: AgentContext) => {
    if (!ctx.mcp?.enabled) {
      return { summary: "live_quote: no MCP wired" };
    }
    const quotes: Record<string, string | null> = {};
    for (const sym of ctx.symbols) {
      quotes[sym] = await ctx.mcp.getLtp(sym);
    }
    return {
      summary: `live_quote: ${ctx.symbols.length} symbols quoted via MCP`,
      payload: { quotes },
    };
  },
);

/** A3 — instrument_master: enabled watchlist count + symbols. */
const instrumentMaster = def(
  "instrument_master",
  "Instrument Master",
  "A",
  true,
  [],
  async (ctx: AgentContext) => {
    const enabled = ctx.config.watchlist.filter((w) => w.enabled);
    const symbols = enabled.map((w) => w.tradingsymbol);
    return {
      summary: `instrument_master: ${enabled.length} enabled of ${ctx.config.watchlist.length} watchlist symbols`,
      payload: { enabledCount: enabled.length, totalCount: ctx.config.watchlist.length, symbols },
    };
  },
);

/** A4 — order_history: recent FILLED trades from the ledger. */
const orderHistory = def(
  "order_history",
  "Order History",
  "A",
  true,
  [],
  async (ctx: AgentContext) => {
    const rows = ctx.ledger
      .raw()
      .prepare(
        `SELECT i.tradingsymbol AS symbol, t.direction AS direction,
                t.pnl AS pnl, t.created_at AS created_at
           FROM trades t
           JOIN instruments i ON i.instrument_id = t.instrument_id
          WHERE t.status = 'FILLED'
          ORDER BY t.created_at DESC
          LIMIT 50`,
      )
      .all() as Array<{ symbol: string; direction: string; pnl: number | null; created_at: string }>;
    return {
      summary: `order_history: ${rows.length} recent FILLED trades`,
      payload: { count: rows.length, trades: rows },
    };
  },
);

/** A5 — holdings: positions from MCP when wired, else the ledger. */
const holdings = def(
  "holdings",
  "Holdings",
  "A",
  true,
  [],
  async (ctx: AgentContext) => {
    if (ctx.mcp?.enabled) {
      const positions = await ctx.mcp.getPositions();
      return {
        summary: `holdings: positions via MCP (${positions === null ? "no data" : "ok"})`,
        payload: { source: "mcp", positions },
      };
    }
    const positions = ctx.ledger.getOpenPositions();
    return {
      summary: `holdings: ${positions.length} open positions from ledger`,
      payload: { source: "ledger", positions },
    };
  },
);

/** A6 — positions_margins: capital + drawdown context. */
const positionsMargins = def(
  "positions_margins",
  "Positions & Margins",
  "A",
  true,
  [],
  async (ctx: AgentContext) => {
    const usedCapital = ctx.ledger.usedCapital();
    const drawdown = ctx.ledger.currentDrawdown();
    return {
      summary: `positions_margins: usedCapital=${usedCapital}, drawdown=${drawdown}`,
      payload: { usedCapital, drawdown },
    };
  },
);

/** A7 — option_chain: options exposure note (live only). */
const optionChain = def(
  "option_chain",
  "Option Chain",
  "A",
  true,
  [],
  async () => {
    return { summary: "option_chain: options exposure via OptionsEngine (live only)" };
  },
);

/** Build and return all Domain A agents. */
export function buildDomainAgents(): AgentDef[] {
  return [
    historyData,
    liveQuote,
    instrumentMaster,
    orderHistory,
    holdings,
    positionsMargins,
    optionChain,
  ];
}
