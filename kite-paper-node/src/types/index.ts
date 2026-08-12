/**
 * kite-paper-node — Public type definitions.
 *
 * These types mirror the shapes returned by the real `kiteconnect` library so
 * that strategies written against `kiteconnect` work unchanged against the
 * mock engine. Field names, spellings (British `unrealised`/`realised`), and
 * structures follow `kiteconnect@5.x` exactly.
 */

// ---------------------------------------------------------------------------
// Order types
// ---------------------------------------------------------------------------

export type OrderVariety = 'regular' | 'amo' | 'iceberg' | 'bo' | 'co' | 'auction';
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
export type TransactionType = 'BUY' | 'SELL';
export type Product = 'MIS' | 'CNC' | 'NRML';
export type Validity = 'DAY' | 'IOC' | 'TTL';
export type Exchanges = 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'CDS' | 'MCX' | 'BCD';
export type PositionTypes = 'day' | 'overnight';

export type OrderStatus =
  | 'OPEN'
  | 'COMPLETE'
  | 'CANCELLED'
  | 'REJECTED'
  | 'TRIGGER PENDING'
  | 'VALIDATING';

export interface PlaceOrderParams {
  exchange: Exchanges;
  tradingsymbol: string;
  transaction_type: TransactionType;
  quantity: number;
  product: Product;
  order_type: OrderType;
  validity?: Validity;
  price?: number;
  disclosed_quantity?: number;
  trigger_price?: number;
  squareoff?: number;
  stoploss?: number;
  trailing_stoploss?: number;
  validity_ttl?: number;
  iceberg_legs?: number;
  iceberg_quantity?: number;
  auction_number?: number;
  tag?: string;
  autoslice?: boolean;
}

export interface ModifyOrderParams {
  quantity?: number;
  price?: number;
  order_type?: OrderType;
  validity?: Validity;
  disclosed_quantity?: number;
  trigger_price?: number;
  parent_order_id?: string;
}

export interface OrderRecord {
  order_id: string;
  parent_order_id: string | null;
  exchange_order_id: string | null;
  placed_by: string;
  variety: OrderVariety;
  status: OrderStatus;
  tradingsymbol: string;
  exchange: string;
  instrument_token: number;
  transaction_type: TransactionType;
  order_type: OrderType;
  product: Product;
  validity: Validity;
  price: number;
  quantity: number;
  trigger_price: number;
  average_price: number;
  pending_quantity: number;
  filled_quantity: number;
  disclosed_quantity: number;
  order_timestamp: Date;
  exchange_timestamp: Date | null;
  exchange_update_timestamp: string | null;
  status_message: string | null;
  status_message_raw: string | null;
  cancelled_quantity: number;
  meta: object | string;
  tag: string | null;
  tags?: string[];
  guid: string;
  market_protection: number;
}

export interface OrderFilter {
  instrument_token?: number;
  status?: OrderStatus;
  order_type?: OrderType;
  transaction_type?: TransactionType;
  variety?: OrderVariety;
}

export interface TradeRecord {
  trade_id: string;
  order_id: string;
  exchange_order_id: string | null;
  tradingsymbol: string;
  exchange: string;
  instrument_token: number;
  transaction_type: TransactionType;
  product: Product;
  average_price: number;
  filled: number;
  quantity: number;
  fill_timestamp: Date;
  order_timestamp: Date;
  exchange_timestamp: Date;
}

// ---------------------------------------------------------------------------
// Market data types
// ---------------------------------------------------------------------------

export interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Depth {
  quantity: number;
  price: number;
  orders: number;
}

export interface Tick {
  tradable: boolean;
  mode: 'ltp' | 'quote' | 'full';
  instrument_token: number;
  last_price: number;
  last_traded_quantity: number;
  average_traded_price: number;
  volume_traded: number;
  total_buy_quantity: number;
  total_sell_quantity: number;
  ohlc: OHLC;
  change: number;
  last_trade_time?: Date | null;
  exchange_timestamp?: Date | null;
  oi?: number;
  oi_day_high?: number;
  oi_day_low?: number;
  depth?: { buy: Depth[]; sell: Depth[] };
  // Internal (not part of the real contract) — used for MARKET fill pricing.
  bid?: number;
  ask?: number;
  bid_quantity?: number;
  ask_quantity?: number;
}

export interface HistoricalData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
}

/** Raw candle tuple: [timestamp, open, high, low, close, volume, oi]. */
export type Candle = [string, number, number, number, number, number, number];

export type CandleInterval =
  | 'minute'
  | '3minute'
  | '5minute'
  | '10minute'
  | '15minute'
  | '30minute'
  | '60minute'
  | 'day'
  | 'week'
  | 'month';

export interface Instrument {
  instrument_token: number;
  exchange_token: string;
  tradingsymbol: string;
  name: string;
  last_price: string;
  expiry: string;
  strike: string;
  tick_size: string;
  lot_size: string;
  instrument_type: string;
  segment: string;
  exchange: string;
}

// ---------------------------------------------------------------------------
// Portfolio types
// ---------------------------------------------------------------------------

export interface PositionRecord {
  tradingsymbol: string;
  exchange: string;
  instrument_token: number;
  product: Product;
  quantity: number;
  overnight_quantity: number;
  multiplier: number;
  average_price: number;
  close_price: number;
  last_price: number;
  value: number;
  pnl: number;
  m2m: number;
  unrealised: number;
  realised: number;
  buy_quantity: number;
  buy_price: number;
  buy_value: number;
  buy_m2m: number;
  day_buy_quantity: number;
  day_buy_price: number;
  day_buy_value: number;
  sell_quantity: number;
  sell_price: number;
  sell_value: number;
  sell_m2m: number;
  day_sell_quantity: number;
  day_sell_price: number;
  day_sell_value: number;
}

export interface PositionsResponse {
  net: PositionRecord[];
  day: PositionRecord[];
}

export interface HoldingRecord {
  instrument_token: number;
  tradingsymbol: string;
  exchange: string;
  isin: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  close_price: number;
  product: Product;
  t1_quantity: number;
  realised_quantity: number;
  collateral_quantity: number;
  collateral_type: string | null;
}

export interface UserMargin {
  enabled: boolean;
  net: number;
  available: {
    adhoc_margin: number;
    cash: number;
    opening_balance: number;
    live_balance: number;
    collateral: number;
    intraday_payin: number;
  };
  utilised: {
    debits: number;
    exposure: number;
    m2m_realised: number;
    m2m_unrealised: number;
    option_premium: number;
    payout: number;
    span: number;
    holding_sales: number;
    turnover: number;
    liquid_collateral: number;
    stock_collateral: number;
    delivery: number;
  };
}

export interface MarginState {
  equity?: UserMargin;
  commodity?: UserMargin;
}

export interface LedgerState {
  cash_balance: number;
  used_margin: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_deposits: number;
  total_withdrawals: number;
  starting_capital: number;
}

// ---------------------------------------------------------------------------
// GTT types
// ---------------------------------------------------------------------------

export type GTTStatus =
  | 'active'
  | 'triggered'
  | 'disabled'
  | 'expired'
  | 'cancelled'
  | 'rejected'
  | 'deleted';

export interface GTTTrigger {
  trigger_id: string;
  type: 'single' | 'two-leg';
  status: GTTStatus;
  created_at: string;
  updated_at: string;
  expires_at: string;
  condition: {
    instrument_token: number;
    exchange: string;
    tradingsymbol: string;
    trigger_values: number[];
    last_price: number;
  };
  orders: Array<{
    exchange: string;
    tradingsymbol: string;
    transaction_type: TransactionType;
    quantity: number;
    order_type: OrderType;
    product: Product;
    price: number;
  }>;
}

export interface GTTParams {
  type?: 'single' | 'two-leg';
  instrument_token: number;
  exchange: string;
  tradingsymbol: string;
  trigger_values: number[];
  orders: GTTTrigger['orders'];
  expires_at?: string;
}

// ---------------------------------------------------------------------------
// Session / auth types
// ---------------------------------------------------------------------------

export interface SessionData {
  access_token: string;
  refresh_token: string;
  user_id: string;
  user_name: string;
  user_shortname: string;
  email: string;
  user_type: string;
  broker: string;
  exchanges: string[];
  products: string[];
  order_types: string[];
  avatar_url: string | null;
  meta: { demat_consent: string };
}

// ---------------------------------------------------------------------------
// Configuration types
// ---------------------------------------------------------------------------

export interface RandomWalkConfig {
  seed?: number;
  seedSymbols?: string[];
  basePrices?: Record<number, number>;
  volatility?: number;
  tickIntervalMs?: number;
  bidAskSpread?: number;
  enableRealismFeatures?: boolean;
}

export interface HistoricalReplayConfig {
  source: string | TickRecord[];
  replaySpeed?: number;
  loopMode?: 'once' | 'loop' | 'bounce';
  startTimestamp?: string;
  endTimestamp?: string;
}

export interface TickRecord {
  instrument_token: number;
  timestamp: string;
  last_price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bid: number;
  ask: number;
  buy_quantity: number;
  sell_quantity: number;
}

export interface TickerConfig {
  mode: 'random-walk' | 'historical-replay' | 'manual';
  randomWalk?: RandomWalkConfig;
  historicalReplay?: HistoricalReplayConfig;
}

export interface AuthConfig {
  strict: boolean;
  validApiKeys: string[];
  validAccessTokens: string[];
  tokenExpiryMs: number;
  failureRate: number;
}

export interface MarketHoursConfig {
  start: string;
  end: string;
  timezone: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  enableCORS: boolean;
  enableBinaryWS: boolean;
}

export interface MockEngineConfig {
  startingCapital?: number;
  defaultProduct?: Product;
  marketHours?: MarketHoursConfig;
  auth?: Partial<AuthConfig>;
  ticker?: TickerConfig;
  /** Enable partial fills (default false). */
  partialFills?: boolean;
  /** Margin rate as a fraction of trade value (default 0.2). */
  marginRate?: number;
}

export interface StateSnapshot {
  version: number;
  timestamp: string;
  ledger: LedgerState;
  orders: OrderRecord[];
  positions: PositionRecord[];
  holdings: HoldingRecord[];
  margins: MarginState;
  gtt_triggers: GTTTrigger[];
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type ErrorType =
  | 'InputException'
  | 'NetworkException'
  | 'OrderException'
  | 'MarginException'
  | 'TokenException'
  | 'PermissionException'
  | 'GeneralException';

export interface KiteErrorBody {
  status: 'error';
  message: string;
  error_type: ErrorType;
  data: null;
}

export class KiteError extends Error {
  public readonly error_type: ErrorType;
  public readonly httpStatus: number;

  constructor(error_type: ErrorType, message: string, httpStatus = 400) {
    super(message);
    this.name = 'KiteError';
    this.error_type = error_type;
    this.httpStatus = httpStatus;
  }

  toBody(): KiteErrorBody {
    return {
      status: 'error',
      message: this.message,
      error_type: this.error_type,
      data: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type MockEngineEvent =
  | { type: 'tick'; tick: Tick }
  | { type: 'order_update'; order: OrderRecord }
  | { type: 'error'; error: KiteError }
  | { type: 'symbol_added'; symbol: string; instrument_token: number }
  | { type: 'symbol_removed'; symbol: string; instrument_token: number }
  | { type: 'replay_complete'; source: string; ticksEmitted: number };

export interface RecordedEvent {
  timestamp: string;
  event: MockEngineEvent;
}
