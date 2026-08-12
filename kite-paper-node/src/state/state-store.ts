/**
 * Central in-memory state store.
 *
 * Holds all collections (orders, positions, holdings, margins, GTT triggers,
 * ledger) plus fast indexes for order queries. This is the single source of
 * truth for the entire mock engine.
 */

import type {
  GTTTrigger,
  HoldingRecord,
  LedgerState,
  MarginState,
  OrderFilter,
  OrderRecord,
  OrderStatus,
  PositionRecord,
  StateSnapshot,
} from '../types';
import { DEFAULT_CONFIG } from '../utils/config';

export class StateStore {
  public orders = new Map<string, OrderRecord>();
  public positions = new Map<number, PositionRecord>();
  public holdings = new Map<number, HoldingRecord>();
  public gtt = new Map<string, GTTTrigger>();
  public margins: MarginState = this.emptyMargins();
  public ledger: LedgerState = this.emptyLedger();

  // Order indexes for fast lookups.
  private tokenIndex = new Map<number, Set<string>>();
  private statusIndex = new Map<OrderStatus, Set<string>>();

  constructor(startingCapital = DEFAULT_CONFIG.startingCapital) {
    this.ledger.starting_capital = startingCapital;
    this.ledger.cash_balance = startingCapital;
    this.ledger.total_deposits = startingCapital;
  }

  private emptyLedger(): LedgerState {
    return {
      cash_balance: 0,
      used_margin: 0,
      realized_pnl: 0,
      unrealized_pnl: 0,
      total_deposits: 0,
      total_withdrawals: 0,
      starting_capital: 0,
    };
  }

  private emptyMargins(): MarginState {
    const block = () => ({
      enabled: true,
      net: 0,
      available: {
        adhoc_margin: 0,
        cash: 0,
        opening_balance: 0,
        live_balance: 0,
        collateral: 0,
        intraday_payin: 0,
      },
      utilised: {
        debits: 0,
        exposure: 0,
        m2m_realised: 0,
        m2m_unrealised: 0,
        option_premium: 0,
        payout: 0,
        span: 0,
        holding_sales: 0,
        turnover: 0,
        liquid_collateral: 0,
        stock_collateral: 0,
        delivery: 0,
      },
    });
    return { equity: block(), commodity: block() };
  }

  // -------------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------------

  addOrder(order: OrderRecord): void {
    this.orders.set(order.order_id, order);
    this.indexOrder(order);
  }

  updateOrder(order: OrderRecord): void {
    this.removeOrderIndex(order.order_id);
    this.orders.set(order.order_id, order);
    this.indexOrder(order);
  }

  getOrder(orderId: string): OrderRecord | undefined {
    return this.orders.get(orderId);
  }

  getOrders(filter?: OrderFilter): OrderRecord[] {
    let list = Array.from(this.orders.values());
    if (filter) {
      if (filter.instrument_token !== undefined) {
        list = list.filter((o) => o.instrument_token === filter.instrument_token);
      }
      if (filter.status) list = list.filter((o) => o.status === filter.status);
      if (filter.order_type) list = list.filter((o) => o.order_type === filter.order_type);
      if (filter.transaction_type) {
        list = list.filter((o) => o.transaction_type === filter.transaction_type);
      }
      if (filter.variety) list = list.filter((o) => o.variety === filter.variety);
    }
    // Newest first.
    return list.sort((a, b) => b.order_timestamp.getTime() - a.order_timestamp.getTime());
  }

  getOrdersByToken(token: number): OrderRecord[] {
    const ids = this.tokenIndex.get(token);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.orders.get(id)!)
      .filter(Boolean);
  }

  getOpenOrdersByToken(token: number): OrderRecord[] {
    return this.getOrdersByToken(token).filter(
      (o) => o.status === 'OPEN' || o.status === 'TRIGGER PENDING'
    );
  }

  private indexOrder(order: OrderRecord): void {
    if (!this.tokenIndex.has(order.instrument_token)) {
      this.tokenIndex.set(order.instrument_token, new Set());
    }
    this.tokenIndex.get(order.instrument_token)!.add(order.order_id);

    if (!this.statusIndex.has(order.status)) {
      this.statusIndex.set(order.status, new Set());
    }
    this.statusIndex.get(order.status)!.add(order.order_id);
  }

  private removeOrderIndex(orderId: string): void {
    const order = this.orders.get(orderId);
    if (!order) return;
    this.tokenIndex.get(order.instrument_token)?.delete(orderId);
    this.statusIndex.get(order.status)?.delete(orderId);
  }

  // -------------------------------------------------------------------------
  // Positions
  // -------------------------------------------------------------------------

  getPosition(token: number): PositionRecord | undefined {
    return this.positions.get(token);
  }

  getOrCreatePosition(token: number): PositionRecord {
    let pos = this.positions.get(token);
    if (!pos) {
      pos = {
        tradingsymbol: '',
        exchange: 'NSE',
        instrument_token: token,
        product: 'MIS',
        quantity: 0,
        overnight_quantity: 0,
        multiplier: 1,
        average_price: 0,
        close_price: 0,
        last_price: 0,
        value: 0,
        pnl: 0,
        m2m: 0,
        unrealised: 0,
        realised: 0,
        buy_quantity: 0,
        buy_price: 0,
        buy_value: 0,
        buy_m2m: 0,
        day_buy_quantity: 0,
        day_buy_price: 0,
        day_buy_value: 0,
        sell_quantity: 0,
        sell_price: 0,
        sell_value: 0,
        sell_m2m: 0,
        day_sell_quantity: 0,
        day_sell_price: 0,
        day_sell_value: 0,
      };
      this.positions.set(token, pos);
    }
    return pos;
  }

  setPosition(pos: PositionRecord): void {
    this.positions.set(pos.instrument_token, pos);
  }

  getPositions(): PositionRecord[] {
    return Array.from(this.positions.values());
  }

  // -------------------------------------------------------------------------
  // Holdings
  // -------------------------------------------------------------------------

  getHolding(token: number): HoldingRecord | undefined {
    return this.holdings.get(token);
  }

  setHolding(holding: HoldingRecord): void {
    this.holdings.set(holding.instrument_token, holding);
  }

  getHoldings(): HoldingRecord[] {
    return Array.from(this.holdings.values());
  }

  // -------------------------------------------------------------------------
  // GTT
  // -------------------------------------------------------------------------

  addGTT(trigger: GTTTrigger): void {
    this.gtt.set(trigger.trigger_id, trigger);
  }

  getGTT(triggerId: string): GTTTrigger | undefined {
    return this.gtt.get(triggerId);
  }

  getGTTs(): GTTTrigger[] {
    return Array.from(this.gtt.values());
  }

  deleteGTT(triggerId: string): boolean {
    return this.gtt.delete(triggerId);
  }

  // -------------------------------------------------------------------------
  // Snapshot / reset
  // -------------------------------------------------------------------------

  snapshot(): StateSnapshot {
    return {
      version: 1,
      timestamp: new Date().toISOString(),
      ledger: { ...this.ledger },
      orders: Array.from(this.orders.values()),
      positions: Array.from(this.positions.values()),
      holdings: Array.from(this.holdings.values()),
      margins: JSON.parse(JSON.stringify(this.margins)),
      gtt_triggers: Array.from(this.gtt.values()),
    };
  }

  restore(snapshot: StateSnapshot): void {
    this.orders = new Map(snapshot.orders.map((o) => [o.order_id, o]));
    this.positions = new Map(snapshot.positions.map((p) => [p.instrument_token, p]));
    this.holdings = new Map(snapshot.holdings.map((h) => [h.instrument_token, h]));
    this.margins = JSON.parse(JSON.stringify(snapshot.margins));
    this.gtt = new Map(snapshot.gtt_triggers.map((g) => [g.trigger_id, g]));
    this.ledger = { ...snapshot.ledger };
    this.rebuildIndexes();
  }

  reset(startingCapital = DEFAULT_CONFIG.startingCapital): void {
    this.orders.clear();
    this.positions.clear();
    this.holdings.clear();
    this.gtt.clear();
    this.tokenIndex.clear();
    this.statusIndex.clear();
    this.margins = this.emptyMargins();
    this.ledger = this.emptyLedger();
    this.ledger.starting_capital = startingCapital;
    this.ledger.cash_balance = startingCapital;
    this.ledger.total_deposits = startingCapital;
  }

  private rebuildIndexes(): void {
    this.tokenIndex.clear();
    this.statusIndex.clear();
    for (const order of this.orders.values()) {
      this.indexOrder(order);
    }
  }
}
