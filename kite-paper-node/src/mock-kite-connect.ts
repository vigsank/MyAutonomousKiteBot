/**
 * MockKiteConnect — drop-in replacement for `KiteConnect`.
 *
 * Extends the real KiteConnect class (when available) and overrides every
 * public method to delegate to the in-process mock engine. Response shapes
 * and signatures match `kiteconnect@5.x`.
 */

import { KiteConnectBaseClass } from './kiteconnect-compat';
import { MockEngine } from './mock-engine';
import type {
  Exchanges,
  HistoricalData,
  ModifyOrderParams,
  OrderVariety,
  PlaceOrderParams,
  PositionTypes,
  Product,
  SessionData,
  TransactionType,
} from './types';

export interface MockKiteConnectParams {
  api_key: string;
  access_token?: string;
  root?: string;
  debug?: boolean;
  timeout?: number;
  engine?: MockEngine;
}

export class MockKiteConnect extends KiteConnectBaseClass {
  private engine: MockEngine;
  private accessToken: string | null = null;
  private sessionExpiryHook: ((error: any) => void) | null = null;

  constructor(params: MockKiteConnectParams) {
    super({ api_key: params.api_key, debug: params.debug });
    this.engine = params.engine ?? getDefaultEngine();
    if (params.access_token) this.accessToken = params.access_token;
  }

  /** Set the access token (mock accepts any token). */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /** Register a session-expiry callback. */
  setSessionExpiryHook(cb: (error: any) => void): void {
    this.sessionExpiryHook = cb;
  }

  /** Mock session generation — returns a full SessionData object. */
  async generateSession(requestToken: string, apiSecret: string): Promise<SessionData> {
    return {
      access_token: requestToken || 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      user_id: 'AB1234',
      user_name: 'Paper Trader',
      user_shortname: 'Paper',
      email: 'paper@kite-paper-node.local',
      user_type: 'investor',
      broker: 'ZERODHA',
      exchanges: ['NSE', 'BSE', 'MCX', 'NFO'],
      products: ['MIS', 'CNC', 'NRML'],
      order_types: ['MARKET', 'LIMIT', 'SL', 'SL-M'],
      avatar_url: null,
      meta: { demat_consent: 'consent' },
    };
  }

  /** Renew the access token. */
  async renewAccessToken(refreshToken: string, apiSecret: string): Promise<SessionData> {
    return this.generateSession(refreshToken, apiSecret);
  }

  /** Invalidate the access token. */
  async invalidateAccessToken(accessToken?: string): Promise<boolean> {
    if (accessToken) this.accessToken = accessToken;
    this.accessToken = null;
    return true;
  }

  /** Invalidate the refresh token. */
  async invalidateRefreshToken(refreshToken: string): Promise<boolean> {
    return true;
  }

  /** Get the remote login URL. */
  getLoginURL(): string {
    return 'https://kite.trade/connect/login?api_key=mock_key';
  }

  /** Validate a postback checksum (mock always returns true). */
  validatePostback(
    postbackData: { order_id: string; checksum: string; order_timestamp: string },
    apiSecret: string
  ): boolean {
    return true;
  }

  // -------------------------------------------------------------------------
  // User
  // -------------------------------------------------------------------------

  async getProfile(): Promise<any> {
    return this.engine.userService.getProfile();
  }

  async getMargins(segment?: 'equity' | 'commodity'): Promise<any> {
    if (segment) return this.engine.marginService.getMarginsForSegment(segment);
    return this.engine.marginService.getMargins();
  }

  // -------------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------------

  async placeOrder(variety: OrderVariety, params: PlaceOrderParams): Promise<{ order_id: string }> {
    return this.engine.orderService.placeOrder(variety, params);
  }

  async modifyOrder(
    variety: OrderVariety,
    orderId: string,
    params: ModifyOrderParams
  ): Promise<{ order_id: string }> {
    return this.engine.orderService.modifyOrder(variety, orderId, params);
  }

  async cancelOrder(
    variety: OrderVariety,
    orderId: string,
    params?: { parent_order_id?: string }
  ): Promise<{ order_id: string }> {
    return this.engine.orderService.cancelOrder(variety, orderId);
  }

  async exitOrder(
    variety: OrderVariety,
    orderId: string,
    params?: { parent_order_id?: string }
  ): Promise<{ order_id: string }> {
    return this.engine.exitOrder(variety, orderId);
  }

  async getOrders(): Promise<any[]> {
    return this.engine.orderService.getOrders();
  }

  async getOrderHistory(orderId: string): Promise<any[]> {
    return this.engine.orderService.getOrderHistory(orderId);
  }

  async getOrderTrades(orderId: string): Promise<any[]> {
    return this.engine.orderService.getOrderTrades(orderId);
  }

  async getTrades(): Promise<any[]> {
    return this.engine.getTrades();
  }

  // -------------------------------------------------------------------------
  // Portfolio
  // -------------------------------------------------------------------------

  async getPositions(): Promise<{ net: any[]; day: any[] }> {
    return this.engine.positionService.getPositions();
  }

  async getHoldings(): Promise<any[]> {
    return this.engine.holdingService.getHoldings();
  }

  async convertPosition(params: {
    exchange: Exchanges;
    tradingsymbol: string;
    transaction_type: TransactionType;
    position_type: PositionTypes;
    quantity: number;
    old_product: Product;
    new_product: Product;
  }): Promise<boolean> {
    return this.engine.convertPosition(params);
  }

  // -------------------------------------------------------------------------
  // Instruments & market data (JIT)
  // -------------------------------------------------------------------------

  async getInstruments(exchange?: Exchanges): Promise<any[]> {
    const all = this.engine.pool.getInstruments();
    if (exchange) return all.filter((i) => i.exchange === exchange.toUpperCase());
    return all;
  }

  async getHistoricalData(
    instrumentToken: number,
    interval: string,
    fromDate: string | Date,
    toDate: string | Date,
    continuous?: boolean,
    oi?: boolean
  ): Promise<HistoricalData[]> {
    return this.engine.historicalService.getHistoricalData(
      instrumentToken,
      interval as any,
      new Date(fromDate),
      new Date(toDate)
    );
  }

  async getQuote(instruments: string | string[]): Promise<any> {
    return this.engine.quoteService.getQuote(instruments);
  }

  async getOHLC(instruments: string | string[]): Promise<any> {
    return this.engine.quoteService.getOHLC(instruments);
  }

  async getLTP(instruments: string | string[]): Promise<any> {
    return this.engine.quoteService.getLTP(instruments);
  }

  async getTriggerRange(
    exchange: Exchanges,
    tradingsymbol: string,
    transactionType: TransactionType
  ): Promise<any> {
    const inst = this.engine.pool.resolveSymbol(tradingsymbol);
    const price = inst ? Number(inst.last_price) : 0;
    return {
      trigger_range: [
        Math.round(price * 0.9 * 100) / 100,
        Math.round(price * 1.1 * 100) / 100,
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Margins
  // -------------------------------------------------------------------------

  async orderMargins(orders: any[], mode?: string): Promise<any[]> {
    return this.engine.orderMargins(orders);
  }

  async orderBasketMargins(
    orders: any[],
    considerPositions?: boolean,
    mode?: string
  ): Promise<any> {
    const margins = this.engine.orderMargins(orders);
    return {
      initial: margins[0] ?? { total: 0 },
      final: margins[margins.length - 1] ?? { total: 0 },
      orders: margins,
    };
  }

  async getvirtualContractNote(orders: any[]): Promise<any[]> {
    return orders.map((o) => ({ order_id: o.order_id, status: 'success' }));
  }

  // -------------------------------------------------------------------------
  // GTT
  // -------------------------------------------------------------------------

  async placeGTT(params: any): Promise<{ trigger_id: number }> {
    const trigger = this.engine.gttService.createTrigger(params);
    return { trigger_id: trigger.id };
  }

  async getGTTs(): Promise<any[]> {
    return this.engine.gttService.getGTTs();
  }

  async getGTT(triggerId: string): Promise<any> {
    return this.engine.gttService.getGTT(triggerId);
  }

  async modifyGTT(triggerId: string, params: any): Promise<{ trigger_id: number }> {
    this.engine.gttService.modifyTrigger(triggerId, params);
    return { trigger_id: Number(triggerId) };
  }

  async deleteGTT(triggerId: string): Promise<{ trigger_id: number }> {
    this.engine.gttService.deleteGTT(triggerId);
    return { trigger_id: Number(triggerId) };
  }

  // -------------------------------------------------------------------------
  // Mutual funds (stubs)
  // -------------------------------------------------------------------------

  async getMFOrders(orderId?: string): Promise<any[]> {
    return [];
  }

  async getMFHoldings(): Promise<any[]> {
    return [];
  }

  async placeMFOrder(): Promise<any> {
    throw new Error('Mutual fund orders are not supported in the mock engine');
  }

  async getMFInstruments(): Promise<any[]> {
    return [];
  }

  async getMFSIPS(sipId?: string): Promise<any[]> {
    return [];
  }

  async placeMFSIP(): Promise<any> {
    throw new Error('Mutual fund SIPs are not supported in the mock engine');
  }

  async modifyMFSIP(): Promise<any> {
    throw new Error('Mutual fund SIPs are not supported in the mock engine');
  }

  async cancelMFSIP(): Promise<any> {
    throw new Error('Mutual fund SIPs are not supported in the mock engine');
  }

  async cancelMFOrder(): Promise<any> {
    throw new Error('Mutual fund orders are not supported in the mock engine');
  }
}

// Default engine singleton shared across mock instances.
let defaultEngine: MockEngine | null = null;
export function getDefaultEngine(): MockEngine {
  if (!defaultEngine) {
    defaultEngine = new MockEngine();
  }
  return defaultEngine;
}
