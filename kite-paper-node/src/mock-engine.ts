/**
 * Mock Engine — the central orchestrator and public API.
 *
 * Wires together the state store, market data layer, core engines, and
 * services. Exposes the deterministic testing API (emitTick, getOrders,
 * addSymbol, etc.) and the JIT data generation controls.
 */

import type {
  Instrument,
  MockEngineConfig,
  OrderFilter,
  OrderRecord,
  OrderVariety,
  PositionRecord,
  HoldingRecord,
  MarginState,
  LedgerState,
  GTTTrigger,
  StateSnapshot,
  Tick,
  TradeRecord,
  Product,
} from './types';
import { StateStore } from './state/state-store';
import { TickEventBus } from './market/tick-event-bus';
import { GeneratorPool } from './market/generator-pool';
import { TickHistoryBuffer } from './market/tick-history-buffer';
import { OHLCAggregator } from './market/ohlc-aggregator';
import { HistoricalReplayEngine, type HistoricalReplayOptions } from './market/historical-replay';
import { MarginEngine } from './core/margin-engine';
import { PositionEngine } from './core/position-engine';
import { LedgerEngine } from './core/ledger-engine';
import { OrderEngine } from './core/order-engine';
import { MatchingEngine } from './core/matching-engine';
import { GTTEngine } from './core/gtt-engine';
import { OrderService } from './services/order-service';
import { PositionService } from './services/position-service';
import { HoldingService } from './services/holding-service';
import { MarginService } from './services/margin-service';
import { QuoteService } from './services/quote-service';
import { HistoricalService } from './services/historical-service';
import { UserService } from './services/user-service';
import { GTTService } from './services/gtt-service';
import { resolveConfig } from './utils/config';
import { isWithinMarketHours } from './utils/date-utils';

export class MockEngine {
  // Infrastructure.
  public readonly store: StateStore;
  public readonly bus: TickEventBus;
  public readonly pool: GeneratorPool;
  public readonly historyBuffer: TickHistoryBuffer;
  public readonly replay: HistoricalReplayEngine;

  // Core engines.
  public readonly marginEngine: MarginEngine;
  public readonly positionEngine: PositionEngine;
  public readonly ledgerEngine: LedgerEngine;
  public readonly orderEngine: OrderEngine;
  public readonly matchingEngine: MatchingEngine;
  public readonly gttEngine: GTTEngine;

  // Services.
  public readonly orderService: OrderService;
  public readonly positionService: PositionService;
  public readonly holdingService: HoldingService;
  public readonly marginService: MarginService;
  public readonly quoteService: QuoteService;
  public readonly historicalService: HistoricalService;
  public readonly userService: UserService;
  public readonly gttService: GTTService;

  private config = resolveConfig();
  private aggregator: OHLCAggregator;
  private recordedEvents: Array<{ timestamp: string; event: any }> = [];

  constructor(config?: MockEngineConfig) {
    this.config = resolveConfig(config);

    this.store = new StateStore(this.config.startingCapital);
    this.bus = new TickEventBus();
    this.pool = new GeneratorPool(this.bus, {
      tickIntervalMs: this.config.ticker.randomWalk?.tickIntervalMs,
      seed: this.config.ticker.randomWalk?.seed,
    });
    this.historyBuffer = new TickHistoryBuffer();
    this.aggregator = new OHLCAggregator(this.bus, this.historyBuffer);
    this.replay = new HistoricalReplayEngine(this.bus);

    this.marginEngine = new MarginEngine(this.store, this.config.marginRate ?? 0.2);
    this.positionEngine = new PositionEngine(this.store);
    this.ledgerEngine = new LedgerEngine(
      this.store,
      this.positionEngine,
      this.marginEngine,
      this.bus
    );
    this.orderEngine = new OrderEngine(
      this.store,
      this.marginEngine,
      (symbol) => this.pool.resolveSymbol(symbol),
      { defaultProduct: this.config.defaultProduct }
    );
    this.matchingEngine = new MatchingEngine(
      this.store,
      this.orderEngine,
      this.ledgerEngine,
      this.positionEngine,
      this.bus,
      {
        partialFills: this.config.partialFills ?? false,
        seed: this.config.ticker.randomWalk?.seed,
      }
    );
    this.gttEngine = new GTTEngine(this.store, this.bus);

    this.orderService = new OrderService(this.orderEngine, this.ledgerEngine);
    this.positionService = new PositionService(this.positionEngine);
    this.holdingService = new HoldingService(this.store);
    this.marginService = new MarginService(this.marginEngine);
    this.quoteService = new QuoteService(this.pool);
    this.historicalService = new HistoricalService(this.historyBuffer, this.pool);
    this.userService = new UserService(this.marginService);
    this.gttService = new GTTService(this.gttEngine);

    // Record events for the testing API.
    this.bus.subscribe((tick) => this.record({ type: 'tick', tick }));
    this.bus.on('replay_complete', (payload) =>
      this.record({ type: 'replay_complete', ...payload })
    );

    // Auto-seed symbols from config.
    this.seedSymbolsFromConfig();
  }

  private seedSymbolsFromConfig(): void {
    const rw = this.config.ticker.randomWalk;
    if (!rw) return;
    if (rw.seedSymbols) {
      for (const symbol of rw.seedSymbols) {
        try {
          this.pool.addSymbol(symbol);
        } catch {
          /* skip unknown symbols */
        }
      }
    }
    if (rw.basePrices) {
      for (const [tokenStr, price] of Object.entries(rw.basePrices)) {
        const token = Number(tokenStr);
        const inst = this.pool.resolveToken(token);
        if (inst) {
          this.pool.addInstrument(inst, { basePrice: price });
        }
      }
    }
  }

  private record(event: any): void {
    this.recordedEvents.push({ timestamp: new Date().toISOString(), event });
    if (this.recordedEvents.length > 10_000) {
      this.recordedEvents.splice(0, this.recordedEvents.length - 10_000);
    }
  }

  // -------------------------------------------------------------------------
  // Configuration & reset
  // -------------------------------------------------------------------------

  configure(config: MockEngineConfig): void {
    this.config = resolveConfig(config);
  }

  reset(config?: MockEngineConfig): void {
    if (config) this.config = resolveConfig(config);
    this.pool.stopAll();
    this.historyBuffer.clear();
    this.recordedEvents = [];
    this.store.reset(this.config.startingCapital);
    this.seedSymbolsFromConfig();
  }

  // -------------------------------------------------------------------------
  // Symbol management (JIT data generation)
  // -------------------------------------------------------------------------

  addSymbol(symbol: string, options?: { basePrice?: number; volatility?: number }): Instrument {
    const inst = this.pool.addSymbol(symbol, options);
    this.record({ type: 'symbol_added', symbol: inst.tradingsymbol, instrument_token: inst.instrument_token });
    return inst;
  }

  removeSymbol(symbol: string): boolean {
    const removed = this.pool.removeSymbol(symbol);
    if (removed) {
      this.record({ type: 'symbol_removed', symbol, instrument_token: 0 });
    }
    return removed;
  }

  listSymbols(): string[] {
    return this.pool
      .listTokens()
      .map((t) => this.pool.resolveToken(t)?.tradingsymbol ?? String(t));
  }

  // -------------------------------------------------------------------------
  // Tick control
  // -------------------------------------------------------------------------

  emitTick(tick: Partial<Tick> & { instrument_token: number }): void {
    const full: Tick = {
      tradable: tick.tradable ?? true,
      mode: 'full',
      instrument_token: tick.instrument_token,
      last_price: tick.last_price ?? 0,
      last_traded_quantity: tick.last_traded_quantity ?? 0,
      average_traded_price: tick.average_traded_price ?? tick.last_price ?? 0,
      volume_traded: tick.volume_traded ?? 0,
      total_buy_quantity: tick.total_buy_quantity ?? 0,
      total_sell_quantity: tick.total_sell_quantity ?? 0,
      ohlc: tick.ohlc ?? {
        open: tick.last_price ?? 0,
        high: tick.last_price ?? 0,
        low: tick.last_price ?? 0,
        close: tick.last_price ?? 0,
      },
      change: tick.change ?? 0,
      last_trade_time: tick.last_trade_time ?? new Date(),
      exchange_timestamp: tick.exchange_timestamp ?? new Date(),
      oi: tick.oi,
      oi_day_high: tick.oi_day_high,
      oi_day_low: tick.oi_day_low,
      depth: tick.depth ?? { buy: [], sell: [] },
      bid: tick.bid ?? tick.last_price ?? 0,
      ask: tick.ask ?? tick.last_price ?? 0,
      bid_quantity: tick.bid_quantity ?? 0,
      ask_quantity: tick.ask_quantity ?? 0,
    };
    this.pool.setLatestTick(full);
    this.bus.publish(full);
  }

  emitTicks(ticks: Array<Partial<Tick> & { instrument_token: number }>): void {
    for (const t of ticks) this.emitTick(t);
  }

  setBasePrice(token: number, price: number): void {
    this.pool.setBasePrice(token, price);
  }

  pauseTicker(token?: number): void {
    if (token !== undefined) this.pool.pause(token);
    else this.pool.pauseAll();
  }

  resumeTicker(token?: number): void {
    if (token !== undefined) this.pool.resume(token);
    else this.pool.resumeAll();
  }

  seedRandom(seed: number): void {
    this.pool.setSeed(seed);
  }

  // -------------------------------------------------------------------------
  // State access
  // -------------------------------------------------------------------------

  getOrders(filter?: OrderFilter): OrderRecord[] {
    return this.store.getOrders(filter);
  }

  getOrderById(orderId: string): OrderRecord | undefined {
    return this.store.getOrder(orderId);
  }

  getPositions(): PositionRecord[] {
    return this.store.getPositions();
  }

  getPositionByToken(token: number): PositionRecord | undefined {
    return this.store.getPosition(token);
  }

  getHoldings(): HoldingRecord[] {
    return this.store.getHoldings();
  }

  getMargins(): MarginState {
    return this.marginEngine.getMargins();
  }

  getLedger(): LedgerState {
    return this.store.ledger;
  }

  getGTTs(): GTTTrigger[] {
    return this.store.getGTTs();
  }

  /** All trades executed today. */
  getTrades(): TradeRecord[] {
    return this.ledgerEngine.getTrades();
  }

  /** Convert an open position's product type. */
  convertPosition(params: {
    exchange: string;
    tradingsymbol: string;
    transaction_type: 'BUY' | 'SELL';
    position_type: 'day' | 'overnight';
    quantity: number;
    old_product: Product;
    new_product: Product;
  }): boolean {
    const inst = this.pool.resolveSymbol(params.tradingsymbol);
    if (!inst) throw new Error(`Instrument not found: ${params.tradingsymbol}`);
    const pos = this.store.getPosition(inst.instrument_token);
    if (!pos) throw new Error('Position not found');
    pos.product = params.new_product;
    this.store.setPosition(pos);
    return true;
  }

  /** Exit an order (cancel it and square off any position). */
  exitOrder(variety: OrderVariety, orderId: string): { order_id: string } {
    const order = this.store.getOrder(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);
    if (order.status === 'OPEN' || order.status === 'TRIGGER PENDING') {
      this.orderEngine.cancelUnfilled(order);
    }
    return { order_id: orderId };
  }

  /** Compute margin for a list of orders (basket margin). */
  orderMargins(orders: Array<{ quantity: number; price?: number }>): Array<{
    type: string;
    trading_symbol: string;
    exchange: string;
    span: number;
    exposure: number;
    option_premium: number;
    additional: number;
    bo: number;
    cash: number;
    var: number;
    pnl: { realised: number; unrealised: number };
    total: number;
  }> {
    return orders.map((o) => {
      const value = (o.price ?? 0) * o.quantity;
      const span = this.marginEngine.calculateMargin(value);
      return {
        type: 'equity',
        trading_symbol: '',
        exchange: 'NSE',
        span,
        exposure: 0,
        option_premium: 0,
        additional: 0,
        bo: 0,
        cash: span,
        var: 0,
        pnl: { realised: 0, unrealised: 0 },
        total: span,
      };
    });
  }

  /** Basket margin for a list of orders. */
  orderBasketMargins(
    orders: Array<{ quantity: number; price?: number }>,
    considerPositions?: boolean,
    mode?: string
  ): { initial: any; final: any; orders: any[] } {
    const margins = this.orderMargins(orders);
    return {
      initial: margins[0] ?? { total: 0 },
      final: margins[margins.length - 1] ?? { total: 0 },
      orders: margins,
    };
  }

  /** Whether the current time is within configured market hours. */
  isMarketOpen(): boolean {
    return isWithinMarketHours(new Date(), this.config.marketHours);
  }

  // -------------------------------------------------------------------------
  // Order manipulation (testing)
  // -------------------------------------------------------------------------

  forceFillOrder(orderId: string, price: number): void {
    const order = this.store.getOrder(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);
    this.orderEngine.markFilled(order, price, new Date());
    this.ledgerEngine.executeFill(order, price, new Date());
  }

  forceRejectOrder(orderId: string, reason: string): void {
    const order = this.store.getOrder(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);
    order.status = 'REJECTED';
    order.status_message = reason;
    order.status_message_raw = reason;
    this.store.updateOrder(order);
  }

  forceCancelOrder(orderId: string): void {
    const order = this.store.getOrder(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);
    order.status = 'CANCELLED';
    order.cancelled_quantity = order.pending_quantity;
    order.pending_quantity = 0;
    this.store.updateOrder(order);
  }

  // -------------------------------------------------------------------------
  // Historical replay
  // -------------------------------------------------------------------------

  loadHistoricalReplay(options: HistoricalReplayOptions): Promise<number> {
    return this.replay.start(options);
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  on(event: string, listener: (...args: any[]) => void): void {
    this.bus.on(event, listener);
  }

  getEvents(): Array<{ timestamp: string; event: any }> {
    return this.recordedEvents.slice();
  }

  clearEvents(): void {
    this.recordedEvents = [];
  }

  // -------------------------------------------------------------------------
  // Snapshot
  // -------------------------------------------------------------------------

  snapshot(): StateSnapshot {
    return this.store.snapshot();
  }

  restore(snapshot: StateSnapshot): void {
    this.store.restore(snapshot);
  }

  /** Stop all timers and listeners (for clean shutdown). */
  destroy(): void {
    this.pool.stopAll();
    this.matchingEngine.destroy();
    this.gttEngine.destroy();
    this.aggregator.destroy();
  }
}
