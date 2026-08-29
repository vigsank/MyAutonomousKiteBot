/**
 * indmoneyTypes.ts — INDstocks (INDmoney) API types and enums.
 *
 * These mirror the INDstocks OpenAPI spec (see indstocks-api-docs.md). They are
 * deliberately narrow: only the GET (read) surface the bot needs for paper
 * trading, plus the order-request shape used to build the broker-order
 * snapshot. Order execution (POST /order) is stubbed in this pass.
 */

/** Transaction side. */
export type IndTxnType = 'BUY' | 'SELL';

/** Exchange. */
export type IndExchange = 'NSE' | 'BSE';

/** Market segment (uppercase, as used by order endpoints). */
export type IndSegment = 'EQUITY' | 'DERIVATIVE';

/** Product type (uppercase, as used by order endpoints). */
export type IndProduct = 'CNC' | 'INTRADAY' | 'MARGIN';

/** Order type. */
export type IndOrderType = 'LIMIT' | 'MARKET';

/** Order validity. */
export type IndValidity = 'DAY' | 'IOC';

/** Order status values returned by INDstocks. */
export type IndOrderStatus =
  | 'QUEUED'
  | 'O-PENDING'
  | 'SL-PENDING'
  | 'PROCESSING'
  | 'ABORTED'
  | 'INITIATED'
  | 'SUCCESS'
  | 'CANCELLED'
  | 'MODIFIED'
  | 'PENDING'
  | 'EXPIRED'
  | 'FAILED'
  | 'PARTIALLY FILLED'
  | 'PARTIALLY FILLED - CANCELLED'
  | 'PARTIALLY FILLED - EXPIRED';

/** User profile response. */
export interface IndUserProfile {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  demat_id: string;
  is_nse_onboarded: boolean;
  is_bse_onboarded: boolean;
  is_nse_fno_onboarded: boolean;
  is_bse_fno_onboarded: boolean;
  ucc?: string;
  is_ddpi_active?: boolean;
}

/** Funds response. */
export interface IndFunds {
  sod_balance: number;
  pledge_received: number;
  pledge_remained: number;
  detailed_avl_balance: {
    option_sell: number;
    future: number;
    option_buy: number;
    comm_option_buy: number;
    eq_mis: number;
    eq_cnc: number;
    eq_mtf: number;
  };
  withdrawal_balance: number;
  funds_added: number;
  funds_withdrawn: number;
  realized_pnl: number;
  unrealized_pnl: number;
  brokerage: number;
  eq_charges: number;
  fno_charges: number;
}

/** Full market quote for a single scrip. */
export interface IndFullQuote {
  live_price: number;
  day_change: number;
  day_change_percentage: number;
  day_low: number;
  day_high: number;
  day_open: number;
  prev_close: number;
  '52week_high': number;
  '52week_low': number;
  upper_circuit: number;
  lower_circuit: number;
  market_depth?: unknown;
  volume: number;
}

/** LTP quote for a single scrip. */
export interface IndLtpQuote {
  live_price: number;
}

/** A single historical candle. */
export interface IndCandle {
  ts: number; // epoch seconds (IST)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/** Historical data for one scrip. */
export interface IndHistoricalScrip {
  candles: IndCandle[];
}

/** Equity holding. */
export interface IndHolding {
  security_id: string;
  symbol: string;
  isin: string;
  total_qty: number;
  used_qty: number;
  avg_price: number;
  t1_qty: number;
  t1_avg_price: number;
  dp_qty: number;
  dp_avg_price: number;
}

/** Open position (equity or derivative). */
export interface IndPosition {
  position_id: string;
  security_id: string;
  symbol: string;
  segment: string;
  product: string;
  exchange: string;
  isin?: string;
  drv_instrument?: string;
  drv_expiry_date?: string;
  drv_option_type?: string;
  drv_strike_price?: number;
  net_qty: number;
  avg_price: number;
  buy_qty: number;
  buy_avg: number;
  sell_qty: number;
  sell_avg: number;
  realized_profit: number;
  day_buy_qty: number | null;
  day_buy_val: number | null;
  day_sell_qty: number | null;
  day_sell_val: number | null;
  cf_buy_qty: number | null;
  cf_buy_val: number | null;
  cf_sell_qty: number | null;
  cf_sell_val: number | null;
}

/** Order request body (used to build the broker-order snapshot). */
export interface IndOrderRequest {
  txn_type: IndTxnType;
  exchange: IndExchange;
  segment: IndSegment;
  product: IndProduct;
  order_type: IndOrderType;
  validity: IndValidity;
  security_id: string;
  qty: number;
  algo_id: string;
  limit_price?: number;
  is_amo?: boolean;
  remarks?: string;
}

/** Generic INDstocks envelope: `status` + `data`. */
export interface IndStatusResponse<T> {
  status: string;
  data: T;
}

/** Historical-data envelope uses `success` instead of `status`. */
export interface IndHistoricalResponse {
  success: boolean;
  data: Record<string, IndHistoricalScrip>;
}

/** Error envelope. */
export interface IndErrorResponse {
  status?: string;
  message?: string;
  error_type?: string;
  debug_info?: string;
  success?: boolean;
}
