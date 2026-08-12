/**
 * Matching Engine — matches open orders against incoming ticks.
 *
 * Order of matching per tick:
 *   1. MARKET orders (immediate fill)
 *   2. SL-M orders (trigger → immediate market fill)
 *   3. SL orders (trigger → OPEN, then behaves as LIMIT)
 *   4. LIMIT orders (fill when price crosses limit)
 *
 * Supports optional partial fills and IOC expiry.
 */

import type { OrderRecord, Tick } from '../types';
import { StateStore } from '../state/state-store';
import { OrderEngine } from './order-engine';
import { LedgerEngine } from './ledger-engine';
import { PositionEngine } from './position-engine';
import { TickEventBus } from '../market/tick-event-bus';
import { createPRNG } from '../utils/random';

export interface MatchingEngineOptions {
  /** Enable partial fills (default false). */
  partialFills?: boolean;
  /** Seed for partial-fill randomness. */
  seed?: number;
}

export class MatchingEngine {
  private unsubscribe: () => void;
  private partialFills: boolean;
  private prng = createPRNG();

  constructor(
    private store: StateStore,
    private orderEngine: OrderEngine,
    private ledgerEngine: LedgerEngine,
    private positionEngine: PositionEngine,
    bus: TickEventBus,
    options?: MatchingEngineOptions
  ) {
    this.partialFills = options?.partialFills ?? false;
    if (options?.seed !== undefined) this.prng = createPRNG(options.seed);
    this.unsubscribe = bus.subscribe((tick) => this.matchTick(tick));
  }

  /** Match all open orders against a single tick. */
  matchTick(tick: Tick): void {
    const token = tick.instrument_token;

    // Mark positions to market first.
    this.positionEngine.markToMarket(token, tick.last_price);

    // 1. MARKET orders.
    const marketOrders = this.store
      .getOpenOrdersByToken(token)
      .filter((o) => o.order_type === 'MARKET' && o.status === 'OPEN')
      .sort((a, b) => a.order_timestamp.getTime() - b.order_timestamp.getTime());
    for (const order of marketOrders) {
      this.fillMarketOrder(order, tick);
    }

    // 2. SL-M orders (trigger → immediate market fill).
    const slmOrders = this.store
      .getOpenOrdersByToken(token)
      .filter((o) => o.order_type === 'SL-M' && o.status === 'TRIGGER PENDING');
    for (const order of slmOrders) {
      if (this.isTriggered(order, tick)) {
        this.orderEngine.triggerOrder(order);
        this.fillMarketOrder(order, tick);
      }
    }

    // 3. SL orders (trigger → OPEN, then behaves as LIMIT).
    const slOrders = this.store
      .getOpenOrdersByToken(token)
      .filter((o) => o.order_type === 'SL' && o.status === 'TRIGGER PENDING');
    for (const order of slOrders) {
      if (this.isTriggered(order, tick)) {
        this.orderEngine.triggerOrder(order);
      }
    }

    // 4. LIMIT orders (including freshly-triggered SL orders).
    const limitOrders = this.store
      .getOpenOrdersByToken(token)
      .filter(
        (o) =>
          o.status === 'OPEN' &&
          (o.order_type === 'LIMIT' || o.order_type === 'SL')
      )
      .sort((a, b) => a.order_timestamp.getTime() - b.order_timestamp.getTime());
    for (const order of limitOrders) {
      if (this.isLimitMatched(order, tick)) {
        this.fillLimitOrder(order, tick);
      }
    }

    // 5. IOC expiry — cancel any IOC orders still open after this tick.
    const iocOrders = this.store
      .getOpenOrdersByToken(token)
      .filter((o) => o.validity === 'IOC' && o.status === 'OPEN');
    for (const order of iocOrders) {
      this.orderEngine.cancelUnfilled(order);
    }
  }

  private fillMarketOrder(order: OrderRecord, tick: Tick): void {
    // Best ask for BUY, best bid for SELL (from the depth book), falling
    // back to last_price when depth is unavailable.
    const bestAsk = tick.depth?.sell?.[0]?.price;
    const bestBid = tick.depth?.buy?.[0]?.price;
    const fillPrice =
      order.transaction_type === 'BUY'
        ? bestAsk ?? tick.last_price
        : bestBid ?? tick.last_price;
    this.fillOrder(order, fillPrice, tick.exchange_timestamp ?? new Date());
  }

  private fillLimitOrder(order: OrderRecord, tick: Tick): void {
    this.fillOrder(order, order.price, tick.exchange_timestamp ?? new Date());
  }

  private fillOrder(order: OrderRecord, fillPrice: number, timestamp: Date): void {
    if (this.partialFills && order.quantity > 1) {
      // Fill a random fraction (25–100%) of the remaining quantity.
      const remaining = order.pending_quantity;
      const fraction = this.prng.range(0.25, 1);
      const qty = Math.max(1, Math.round(remaining * fraction));
      this.orderEngine.applyPartialFill(order, fillPrice, qty, timestamp);
      this.ledgerEngine.executeFill(order, fillPrice, timestamp);
    } else {
      this.orderEngine.markFilled(order, fillPrice, timestamp);
      this.ledgerEngine.executeFill(order, fillPrice, timestamp);
    }
  }

  private isTriggered(order: OrderRecord, tick: Tick): boolean {
    if (order.transaction_type === 'BUY') {
      return tick.last_price >= order.trigger_price;
    }
    return tick.last_price <= order.trigger_price;
  }

  private isLimitMatched(order: OrderRecord, tick: Tick): boolean {
    if (order.transaction_type === 'BUY') {
      return tick.last_price <= order.price;
    }
    return tick.last_price >= order.price;
  }

  /** Stop listening to the bus. */
  destroy(): void {
    this.unsubscribe();
  }
}
