/**
 * Order Service — REST-facing order operations with kiteconnect-compatible
 * response shapes.
 */

import type {
  ModifyOrderParams,
  OrderRecord,
  OrderVariety,
  PlaceOrderParams,
  TradeRecord,
} from '../types';
import { OrderEngine } from '../core/order-engine';
import { LedgerEngine } from '../core/ledger-engine';

export class OrderService {
  constructor(
    private orderEngine: OrderEngine,
    private ledgerEngine: LedgerEngine
  ) {}

  placeOrder(
    variety: OrderVariety,
    params: PlaceOrderParams
  ): { order_id: string; children?: Array<{ order_id?: string; error?: any }> } {
    const order = this.orderEngine.placeOrder(variety, params);
    return { order_id: order.order_id };
  }

  modifyOrder(
    variety: OrderVariety,
    orderId: string,
    params: ModifyOrderParams
  ): { order_id: string } {
    this.orderEngine.modifyOrder(variety, orderId, params);
    return { order_id: orderId };
  }

  cancelOrder(variety: OrderVariety, orderId: string): { order_id: string } {
    this.orderEngine.cancelOrder(variety, orderId);
    return { order_id: orderId };
  }

  getOrders(): OrderRecord[] {
    return this.orderEngine.getOrders();
  }

  /** Return the order history (status transitions) as an array. */
  getOrderHistory(orderId: string): OrderRecord[] {
    const order = this.orderEngine.getOrder(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }
    // The mock tracks a single state; return it as a one-element history.
    return [order];
  }

  getOrderTrades(orderId: string): TradeRecord[] {
    return this.ledgerEngine.getTradesForOrder(orderId);
  }

  /** All trades executed today. */
  getTrades(): TradeRecord[] {
    return this.ledgerEngine.getTrades();
  }
}
