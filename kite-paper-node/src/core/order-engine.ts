/**
 * Order Engine — validates, creates, modifies, and cancels orders. Manages
 * the order state machine and delegates fills to the matching engine.
 *
 * Supports all real varieties (regular, amo, iceberg, bo, co, auction) and
 * returns orders with the real `kiteconnect` `Order` shape (Date timestamps,
 * `meta`, `tags`, `exchange_update_timestamp`).
 */

import type {
  Instrument,
  ModifyOrderParams,
  OrderRecord,
  OrderVariety,
  PlaceOrderParams,
  Product,
} from '../types';
import { StateStore } from '../state/state-store';
import { MarginEngine } from './margin-engine';
import { errors } from '../protocol/errors';
import { generateGuid, generateOrderId } from '../utils/id-generator';
import { tradeValue } from '../utils/price-utils';

export interface OrderEngineOptions {
  placedBy?: string;
  defaultProduct?: Product;
}

const VALID_VARIETIES: OrderVariety[] = ['regular', 'amo', 'iceberg', 'bo', 'co', 'auction'];

export class OrderEngine {
  private placedBy: string;
  private defaultProduct: Product;

  constructor(
    private store: StateStore,
    private marginEngine: MarginEngine,
    private resolveInstrument: (symbol: string) => Instrument | undefined,
    options?: OrderEngineOptions
  ) {
    this.placedBy = options?.placedBy ?? 'AB1234';
    this.defaultProduct = options?.defaultProduct ?? 'MIS';
  }

  /** Place a new order. Returns the created order. */
  placeOrder(variety: OrderVariety, params: PlaceOrderParams): OrderRecord {
    this.validatePlaceParams(variety, params);

    const instrument = this.resolveInstrument(params.tradingsymbol);
    if (!instrument) {
      throw errors.input(`Instrument not found: ${params.tradingsymbol}`);
    }

    const now = new Date();
    const initialStatus: OrderRecord['status'] =
      params.order_type === 'SL' || params.order_type === 'SL-M'
        ? 'TRIGGER PENDING'
        : 'OPEN';

    const order: OrderRecord = {
      order_id: generateOrderId(now),
      parent_order_id: null,
      exchange_order_id: null,
      placed_by: this.placedBy,
      variety,
      status: initialStatus,
      tradingsymbol: instrument.tradingsymbol,
      exchange: params.exchange,
      instrument_token: instrument.instrument_token,
      transaction_type: params.transaction_type,
      order_type: params.order_type,
      product: params.product ?? this.defaultProduct,
      validity: params.validity ?? 'DAY',
      price: params.price ?? 0,
      quantity: params.quantity,
      trigger_price: params.trigger_price ?? 0,
      average_price: 0,
      pending_quantity: params.quantity,
      filled_quantity: 0,
      disclosed_quantity: params.disclosed_quantity ?? 0,
      order_timestamp: now,
      exchange_timestamp: null,
      exchange_update_timestamp: null,
      status_message: initialStatus,
      status_message_raw: initialStatus,
      cancelled_quantity: 0,
      meta: {},
      tag: params.tag ?? null,
      guid: generateGuid(),
      market_protection: 0,
    };

    // Margin check for market/limit orders that will consume margin.
    if (order.status === 'OPEN' && order.order_type !== 'MARKET') {
      const value = tradeValue(order.price || Number(instrument.last_price), order.quantity);
      if (!this.marginEngine.canAfford(value)) {
        throw errors.margin('Insufficient margin for order');
      }
    }

    this.store.addOrder(order);
    return order;
  }

  /** Modify an open order. */
  modifyOrder(
    variety: OrderVariety,
    orderId: string,
    params: ModifyOrderParams
  ): OrderRecord {
    const order = this.store.getOrder(orderId);
    if (!order) throw errors.network(`Order not found: ${orderId}`);
    if (order.status === 'COMPLETE' || order.status === 'CANCELLED') {
      throw errors.order(`Cannot modify order in state: ${order.status}`);
    }

    if (params.quantity !== undefined) {
      order.quantity = params.quantity;
      order.pending_quantity = params.quantity - order.filled_quantity;
    }
    if (params.price !== undefined) order.price = params.price;
    if (params.trigger_price !== undefined) order.trigger_price = params.trigger_price;
    if (params.validity !== undefined) order.validity = params.validity;
    if (params.order_type !== undefined) order.order_type = params.order_type;
    if (params.disclosed_quantity !== undefined) {
      order.disclosed_quantity = params.disclosed_quantity;
    }
    order.exchange_update_timestamp = new Date().toISOString();

    this.store.updateOrder(order);
    return order;
  }

  /** Cancel an open order. */
  cancelOrder(variety: OrderVariety, orderId: string): OrderRecord {
    const order = this.store.getOrder(orderId);
    if (!order) throw errors.network(`Order not found: ${orderId}`);
    if (order.status === 'COMPLETE') {
      throw errors.order('Cannot cancel a completed order');
    }
    if (order.status === 'CANCELLED') {
      throw errors.order('Order already cancelled');
    }

    order.status = 'CANCELLED';
    order.cancelled_quantity = order.pending_quantity;
    order.pending_quantity = 0;
    order.status_message = 'CANCELLED';
    order.status_message_raw = 'CANCELLED';
    order.exchange_update_timestamp = new Date().toISOString();
    this.store.updateOrder(order);
    return order;
  }

  /** Mark an order as filled. */
  markFilled(order: OrderRecord, fillPrice: number, timestamp: Date): void {
    order.status = 'COMPLETE';
    order.filled_quantity = order.quantity;
    order.pending_quantity = 0;
    order.average_price = fillPrice;
    order.exchange_timestamp = timestamp;
    order.exchange_update_timestamp = timestamp.toISOString();
    order.status_message = 'COMPLETE';
    order.status_message_raw = 'COMPLETE';
    this.store.updateOrder(order);
  }

  /** Apply a partial fill to an order. */
  applyPartialFill(order: OrderRecord, fillPrice: number, qty: number, timestamp: Date): void {
    order.filled_quantity += qty;
    order.pending_quantity = order.quantity - order.filled_quantity;
    order.average_price = fillPrice;
    order.exchange_timestamp = timestamp;
    order.exchange_update_timestamp = timestamp.toISOString();
    if (order.pending_quantity <= 0) {
      order.status = 'COMPLETE';
      order.status_message = 'COMPLETE';
      order.status_message_raw = 'COMPLETE';
    } else {
      order.status = 'OPEN';
      order.status_message = 'OPEN';
      order.status_message_raw = 'OPEN';
    }
    this.store.updateOrder(order);
  }

  /** Transition an SL/SL-M order from TRIGGER PENDING to OPEN. */
  triggerOrder(order: OrderRecord): void {
    if (order.status !== 'TRIGGER PENDING') return;
    order.status = 'OPEN';
    order.status_message = 'OPEN';
    order.status_message_raw = 'OPEN';
    order.exchange_update_timestamp = new Date().toISOString();
    this.store.updateOrder(order);
  }

  /** Cancel an order (used for IOC expiry). */
  cancelUnfilled(order: OrderRecord): void {
    if (order.status === 'COMPLETE' || order.status === 'CANCELLED') return;
    order.status = 'CANCELLED';
    order.cancelled_quantity = order.pending_quantity;
    order.pending_quantity = 0;
    order.status_message = 'CANCELLED';
    order.status_message_raw = 'CANCELLED';
    order.exchange_update_timestamp = new Date().toISOString();
    this.store.updateOrder(order);
  }

  getOrder(orderId: string): OrderRecord | undefined {
    return this.store.getOrder(orderId);
  }

  getOrders() {
    return this.store.getOrders();
  }

  private validatePlaceParams(variety: OrderVariety, params: PlaceOrderParams): void {
    if (!VALID_VARIETIES.includes(variety)) {
      throw errors.input(`Invalid variety: ${variety}`);
    }
    if (!['MARKET', 'LIMIT', 'SL', 'SL-M'].includes(params.order_type)) {
      throw errors.input(`Invalid order type: ${params.order_type}`);
    }
    if (!['BUY', 'SELL'].includes(params.transaction_type)) {
      throw errors.input(`Invalid transaction type: ${params.transaction_type}`);
    }
    if (!params.quantity || params.quantity <= 0) {
      throw errors.input('Quantity must be a positive number');
    }
    if (params.price !== undefined && params.price < 0) {
      throw errors.input('Price cannot be negative');
    }
    if (params.trigger_price !== undefined && params.trigger_price < 0) {
      throw errors.input('Trigger price cannot be negative');
    }
    if (params.disclosed_quantity !== undefined && params.disclosed_quantity > params.quantity) {
      throw errors.input('Disclosed quantity cannot exceed total quantity');
    }
    if (params.product && !['MIS', 'CNC', 'NRML'].includes(params.product)) {
      throw errors.input(`Invalid product: ${params.product}`);
    }
  }
}
