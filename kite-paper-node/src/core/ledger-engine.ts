/**
 * Ledger Engine — executes fills, updates cash balance, margin blocks,
 * positions, and realized/unrealized P&L. Emits `order_update` postbacks on
 * the tick bus so ticker consumers receive fill notifications.
 */

import type { OrderRecord, TradeRecord } from '../types';
import { StateStore } from '../state/state-store';
import { PositionEngine } from './position-engine';
import { MarginEngine } from './margin-engine';
import { TickEventBus } from '../market/tick-event-bus';
import { roundMoney, tradeValue } from '../utils/price-utils';
import { generateTradeId } from '../utils/id-generator';

export class LedgerEngine {
  private trades: TradeRecord[] = [];

  constructor(
    private store: StateStore,
    private positionEngine: PositionEngine,
    private marginEngine: MarginEngine,
    private bus: TickEventBus
  ) {}

  /**
   * Execute a fill for an order at the given price.
   * Returns the trade record created.
   */
  executeFill(order: OrderRecord, fillPrice: number, timestamp: Date): TradeRecord {
    const value = tradeValue(fillPrice, order.quantity);

    // Update positions.
    this.positionEngine.applyFill(
      order.instrument_token,
      order.tradingsymbol,
      order.exchange,
      order.product,
      order.transaction_type,
      order.quantity,
      fillPrice
    );

    // Update cash and margin.
    if (order.transaction_type === 'BUY') {
      this.store.ledger.cash_balance = roundMoney(this.store.ledger.cash_balance - value);
      this.store.ledger.used_margin = roundMoney(
        this.store.ledger.used_margin + this.marginEngine.calculateMargin(value)
      );
    } else {
      this.store.ledger.cash_balance = roundMoney(this.store.ledger.cash_balance + value);
      this.store.ledger.used_margin = roundMoney(
        Math.max(0, this.store.ledger.used_margin - this.marginEngine.calculateMargin(value))
      );
    }

    // Record the trade (real kiteconnect Trade shape).
    const trade: TradeRecord = {
      trade_id: generateTradeId(),
      order_id: order.order_id,
      exchange_order_id: order.exchange_order_id ?? order.order_id,
      tradingsymbol: order.tradingsymbol,
      exchange: order.exchange,
      instrument_token: order.instrument_token,
      transaction_type: order.transaction_type,
      product: order.product,
      average_price: fillPrice,
      filled: order.quantity,
      quantity: order.quantity,
      fill_timestamp: timestamp,
      order_timestamp: order.order_timestamp,
      exchange_timestamp: timestamp,
    };
    this.trades.push(trade);

    this.marginEngine.recompute();

    // Emit order_update postback (C7).
    this.bus.emit('order_update', order);

    return trade;
  }

  /** Get all trades for an order. */
  getTradesForOrder(orderId: string): TradeRecord[] {
    return this.trades.filter((t) => t.order_id === orderId);
  }

  /** Get all trades (day-wide). */
  getTrades(): TradeRecord[] {
    return this.trades.slice();
  }

  /** Get the current ledger state. */
  getLedger() {
    return this.store.ledger;
  }

  /** Recompute unrealized P&L across all positions. */
  recomputeUnrealized(): void {
    let total = 0;
    for (const pos of this.store.getPositions()) {
      total += pos.unrealised;
    }
    this.store.ledger.unrealized_pnl = roundMoney(total);
  }
}
