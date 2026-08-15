/**
 * Shared type definitions for the My Autonomous Kite Vault trading bot.
 * These mirror the shape of the Zerodha Kite Connect SDK responses plus
 * internal domain models.
 */

/** Segment of an instrument. */
export type Segment = 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'MCX' | 'CDS';

/** Instrument type for equity. */
export type InstrumentType =
  | 'EQ'
  | 'FUT'
  | 'OPT'
  | 'CE'
  | 'PE'
  | 'IDX'
  | 'COM'
  | 'CUR'
  | 'BTC';

/** Product types supported by Kite. */
export type Product = 'MIS' | 'CNC' | 'NRML';

/** Order types. */
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SLM';

/** Transaction (side) of an order. */
export type TransactionType = 'BUY' | 'SELL';

/** Order variety. */
export type Variety = 'regular' | 'amo' | 'iceberg' | 'auction';

/** Option type for an options contract. */
export type OptionType = 'CE' | 'PE' | null;

/** The direction the strategy believes the market will move. */
export type SignalDirection = 'LONG' | 'SHORT' | 'NEUTRAL';

/** A single bar/candle of OHLC data. */
export interface Candle {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** A single tick received from KiteTicker. */
export interface Tick {
  instrument_token: number;
  last_price: number;
  volume_traded?: number;
  oi?: number;
  change?: number;
  ohlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  exchange_timestamp?: Date;
  depth?: unknown;
}

/** A live quote for a symbol. */
export interface Quote {
  instrument_token: number;
  timestamp?: Date;
  last_price: number;
  volume: number;
  average_price: number;
  oi: number;
  ohlc: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  change: number;
}

/** A Kite instrument entry (from getInstruments). */
export interface Instrument {
  instrument_token: number;
  exchange_token: string;
  tradingsymbol: string;
  name: string;
  last_price: number;
  expiry?: Date;
  strike?: number;
  tick_size: number;
  lot_size: number;
  instrument_type: InstrumentType;
  segment: Segment;
  exchange: Segment;
}

/** A symbol in the watchlist. */
export interface WatchSymbol {
  tradingsymbol: string;
  exchange: Segment;
  quantity: number;
  enabled: boolean;
  /** Optional sector for concentration caps (e.g. 'BANK', 'IT'). */
  sector?: string;
}

/** A trading decision produced by the strategy/agent. */
export interface Signal {
  symbol: string;
  exchange: Segment;
  direction: SignalDirection;
  rsi: number;
  lastPrice: number;
  reason: string;
  timestamp: Date;
}

/** A request to place a paper trade. */
export interface TradeRequest {
  symbol: string;
  exchange: Segment;
  quantity: number;
  direction: SignalDirection;
  entryPrice: number;
  reason: string;
  ticketSize: number;
  timestamp: Date;
  /** MIS = intraday (squared off at close), CNC = delivery/swing. */
  product?: 'MIS' | 'CNC';
  /** Actual stop distance (per share) for risk-at-stop calc; falls back to stopLossPercent. */
  stopDistance?: number;
  /** Strategy mode that opened this trade (for mode-specific exits). */
  entryMode?: string;
}

/** Result of executing a paper trade. */
export interface TradeFill {
  tradeId: string;
  symbol: string;
  exchange: Segment;
  direction: SignalDirection;
  quantity: number;
  price: number;
  ticketSize: number;
  pnl: number;
  status: 'FILLED' | 'REJECTED';
  reason: string;
  timestamp: Date;
}

/** A persisted position. */
export interface Position {
  symbol: string;
  exchange: Segment;
  quantity: number;
  avgPrice: number;
  entryTime: Date;
  direction: SignalDirection;
  /** MIS = intraday (squared off at close), CNC = delivery/swing. */
  product?: 'MIS' | 'CNC';
  /** Strategy mode that opened this position (for mode-specific exits). */
  entryMode?: string;
}

/** An order stored in the ledger. */
export interface OrderRecord {
  orderId: string;
  tradeId?: string;
  symbol: string;
  exchange: Segment;
  side: TransactionType;
  quantity: number;
  price: number;
  ticketSize: number;
  status: string;
  variety: Variety;
  orderType: OrderType;
  product: Product;
  reason: string;
  createdAt: Date;
}

/** Outcome of the risk engine's checks. */
export interface RiskDecision {
  allowed: boolean;
  reasons: string[];
}

/**
 * Deterministic capital snapshot at a point in time. The LLM advisor consumes
 * `available` as advisory context; the RiskEngine re-validates against live
 * capital at execution time.
 */
export interface CapitalSnapshot {
  /** Total portfolio capital (config.availableCapital). */
  total: number;
  /** Capital locked in open positions (notional). */
  used: number;
  /** Capital reserved by pending/unfilled orders. */
  pending: number;
  /** Mandatory cash reserve kept free for liquidity (≥ minCashReservePct). */
  reserve: number;
  /** Free capital available for new trades = total - used - pending - reserve. */
  available: number;
}

/** A single sentiment reading for a symbol. */
export interface SentimentResult {
  symbol: string;
  score: number; // -1 (very bearish) .. +1 (very bullish)
  label: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  sources: string[];
  timestamp: Date;
}

/** A news article parsed from an RSS feed. */
export interface NewsArticle {
  title: string;
  link: string;
  summary?: string;
  pubDate?: string;
  source: string;
}

/** The AI's structured sentiment JSON output. */
export interface AiSentimentJson {
  score: number;
  label: 'bullish' | 'bearish' | 'neutral';
  summary: string;
}

/** The three stages of the daily report cycle. */
export type ReportType = 'pre_open' | 'mid_session' | 'pre_close';

/** Advisory action bias the LLM suggests for a symbol (algo enforces). */
export type ActionBias =
  | 'BUY_ACCUMULATE'
  | 'CONSIDER_LONG'
  | 'HOLD'
  | 'TRIM_25'
  | 'TRIM_50'
  | 'EXIT_FULL'
  | 'AVOID';

/** A single per-symbol recommendation inside a daily report. */
export interface SymbolRecommendation {
  symbol: string;
  action_bias: ActionBias;
  sentiment_score: number;
  current_holding_status: 'NONE' | 'HELD';
  /** Advisory share count — the RiskEngine clamps the final size. */
  suggested_quantity: number;
  /** Advisory allocation in INR — the RiskEngine clamps the final size. */
  suggested_allocation_inr: number;
  suggested_entry_strategy: string;
  reasoning: string;
  invalidation_condition: string;
}

/**
 * The comprehensive daily report (Reasoning Layer output). The LLM suggests
 * numbers (quantities/allocation); the deterministic RiskEngine enforces them.
 */
export interface DailyReport {
  report_type: ReportType;
  timestamp: string;
  market_regime: {
    overall_sentiment: string;
    regime_score: number;
    primary_catalyst: string;
  };
  capital_management: {
    available_capital: number;
    recommended_cash_reserve_pct: number;
    suggested_total_deployment_pct: number;
  };
  stocks_to_watch: string[];
  portfolio_recommendations: SymbolRecommendation[];
  summary: string;
}
