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
