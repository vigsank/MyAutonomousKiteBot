import { AppConfig } from "../server/AppConfig";
import { Ledger } from "../server/Ledger";
import { NewsSentimentEngine } from "../server/NewsSentimentEngine";
import { RiskEngine } from "../server/RiskEngine";
import { PaperTrader } from "../server/PaperTrader";
import { KiteMcpClient } from "../server/KiteMcpClient";

/** The plan's full agent fleet (domains A–H). */
export type AgentId =
  // A — data ingestion
  | "history_data"
  | "live_quote"
  | "instrument_master"
  | "order_history"
  | "holdings"
  | "positions_margins"
  | "option_chain"
  // B — technical analysis
  | "indicator"
  | "trend_regime"
  | "support_resistance"
  | "volume_profile"
  | "candlestick_pattern"
  | "chart_pattern"
  | "momentum_divergence"
  // C — fundamental & context
  | "news_feed"
  | "web_search_news"
  | "earnings_calendar"
  | "macro_sentiment"
  | "analyst_ratings"
  // D — sentiment synthesis
  | "sentiment"
  | "sector_rotation"
  | "market_breadth"
  // E — portfolio & risk context
  | "holdings_exposure"
  | "margins_capital"
  | "correlation"
  | "drawdown_monitor"
  | "holdings_review"
  // F — decision (golden path)
  | "regime"
  | "screener"
  | "validator"
  | "strategist"
  | "risk_precheck"
  | "execute"
  // G — post-trade
  | "trade_journal"
  | "performance_attribution"
  | "post_trade_review"
  | "daily_report"
  // H — governance
  | "risk_watchdog"
  | "data_integrity"
  | "hallucination_guard"
  | "audit_trace"
  | "token_budget";

export type AgentStatus = "idle" | "running" | "done" | "failed" | "skipped";

/** A strict, schema-shaped execution-plan proposal built by the strategist. */
export interface TradeProposal {
  symbol: string;
  orderType: "BUY" | "SELL" | "OPTION" | "CLOSE";
  quantity: number;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  thesis: string;
  riskScore: number; // 0-100
  timestamp: string;
}

/** Outcome of a single agent run within a pass. */
export interface AgentResult {
  id: AgentId;
  status: AgentStatus;
  startedAt: Date;
  durationMs: number;
  summary: string;
  payload?: unknown;
}

/** A registered agent: metadata plus its run implementation. */
export interface AgentDef {
  id: AgentId;
  name: string;
  domain: string;
  parallel: boolean;
  deps: AgentId[];
  run: (ctx: AgentContext) => Promise<AgentResult>;
}

/** Shared context handed to every agent in a pass. */
export interface AgentContext {
  config: AppConfig;
  ledger: Ledger;
  news: NewsSentimentEngine;
  symbols: string[];
  passNumber: number;
  now: Date;
  /** Optional — set when the runtime wires the real risk/execution layer. */
  risk?: RiskEngine;
  trader?: PaperTrader;
  /** Optional — read-only Kite MCP client (mock or live) for account data. */
  mcp?: KiteMcpClient;
  /** Optional — current probe run id when running inside a probe pass. */
  probeRunId?: string;
}
