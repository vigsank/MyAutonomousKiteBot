/**
 * REST API Server — mirrors Zerodha's Kite Connect REST endpoints.
 *
 * Uses `express` (optional dependency). All responses follow the
 * kiteconnect-compatible `{ status, data }` envelope.
 */

import type { ServerConfig } from '../types';
import { OrderService } from '../services/order-service';
import { PositionService } from '../services/position-service';
import { HoldingService } from '../services/holding-service';
import { MarginService } from '../services/margin-service';
import { QuoteService } from '../services/quote-service';
import { HistoricalService } from '../services/historical-service';
import { UserService } from '../services/user-service';
import { GTTService } from '../services/gtt-service';
import { GeneratorPool } from '../market/generator-pool';
import { MockEngine } from '../mock-engine';
import { KiteError } from '../types';

export interface RestServerDeps {
  orderService: OrderService;
  positionService: PositionService;
  holdingService: HoldingService;
  marginService: MarginService;
  quoteService: QuoteService;
  historicalService: HistoricalService;
  userService: UserService;
  gttService: GTTService;
  pool: GeneratorPool;
  engine: MockEngine;
}

export class RestServer {
  private app: any;
  private server: any;

  constructor(
    private deps: RestServerDeps,
    private config: ServerConfig
  ) {
    // Lazy-load `express` (optional dependency).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const express = require('express');
    this.app = express();
    this.app.use(express.json());
    if (config.enableCORS) {
      this.app.use((req: any, res: any, next: any) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
        if (req.method === 'OPTIONS') return res.sendStatus(200);
        next();
      });
    }
    this.setupRoutes();
  }

  private ok(res: any, data: any): void {
    res.json({ status: 'success', data });
  }

  /**
   * Run a state-mutating operation then persist the broker state to SQLite
   * (no-op when persistence is disabled). Wraps the mutation handlers so the
   * mock survives restarts like a real broker.
   */
  private mutate(fn: () => any): any {
    const out = fn();
    this.deps.engine.persist();
    return out;
  }

  /** Parse a query date param, falling back to a numeric timestamp. */
  private parseDate(value: any, fallback: number): Date {
    if (value === undefined || value === null || value === '') return new Date(fallback);
    const n = Number(value);
    if (Number.isFinite(n)) return new Date(n);
    return new Date(String(value));
  }

  private setupRoutes(): void {
    const { deps } = this;

    // /user/*
    this.app.get('/user/profile', (_req: any, res: any) => this.ok(res, deps.userService.getProfile()));
    this.app.get('/user/margins', (_req: any, res: any) => this.ok(res, deps.marginService.getMargins()));
    this.app.get('/user/margins/:segment', (req: any, res: any) =>
      this.ok(res, deps.marginService.getMarginsForSegment(req.params.segment))
    );

    // /orders/*
    this.app.post('/orders/:variety', (req: any, res: any) =>
      this.ok(res, this.mutate(() => deps.orderService.placeOrder(req.params.variety, req.body)))
    );
    this.app.put('/orders/:variety/:order_id', (req: any, res: any) =>
      this.ok(res, this.mutate(() => deps.orderService.modifyOrder(req.params.variety, req.params.order_id, req.body)))
    );
    this.app.delete('/orders/:variety/:order_id', (req: any, res: any) =>
      this.ok(res, this.mutate(() => deps.orderService.cancelOrder(req.params.variety, req.params.order_id)))
    );
    this.app.get('/orders', (_req: any, res: any) => this.ok(res, deps.orderService.getOrders()));
    this.app.get('/orders/:order_id', (req: any, res: any) =>
      this.ok(res, deps.orderService.getOrderHistory(req.params.order_id))
    );
    this.app.get('/orders/:order_id/trades', (req: any, res: any) =>
      this.ok(res, deps.orderService.getOrderTrades(req.params.order_id))
    );
    this.app.get('/trades', (_req: any, res: any) => this.ok(res, deps.orderService.getTrades()));
    this.app.post('/orders/:variety/:order_id/exit', (req: any, res: any) =>
      this.ok(res, this.mutate(() => deps.engine.exitOrder(req.params.variety, req.params.order_id)))
    );

    // /portfolio/*
    this.app.get('/portfolio/positions', (_req: any, res: any) =>
      this.ok(res, deps.positionService.getPositions())
    );
    this.app.get('/portfolio/holdings', (_req: any, res: any) =>
      this.ok(res, deps.holdingService.getHoldings())
    );
    this.app.post('/portfolio/positions', (req: any, res: any) =>
      this.ok(res, this.mutate(() => deps.engine.convertPosition(req.body)))
    );

    // /margins/*
    this.app.post('/margins/orders', (req: any, res: any) =>
      this.ok(res, deps.engine.orderMargins(req.body))
    );
    this.app.post('/margins/basket', (req: any, res: any) =>
      this.ok(res, deps.engine.orderBasketMargins(req.body))
    );

    // /instruments/*
    this.app.get('/instruments', (_req: any, res: any) => this.ok(res, deps.pool.getInstruments()));
    this.app.get('/instruments/historical/:token/:interval', (req: any, res: any) => {
      const from = this.parseDate(req.query.from, Date.now() - 24 * 3600_000);
      const to = this.parseDate(req.query.to, Date.now());
      const data = deps.historicalService.getHistoricalData(
        Number(req.params.token),
        req.params.interval,
        from,
        to
      );
      this.ok(res, data);
    });
    this.app.get('/instruments/:exchange', (req: any, res: any) =>
      this.ok(
        res,
        deps.pool.getInstruments().filter((i) => i.exchange === req.params.exchange.toUpperCase())
      )
    );

    // /quote, /ohlc, /ltp — JIT from generator pool.
    const parseInstruments = (q: any): string[] =>
      String(q?.i ?? '').split(',').filter(Boolean);
    this.app.get('/quote', (req: any, res: any) =>
      this.ok(res, deps.quoteService.getQuote(parseInstruments(req.query)))
    );
    this.app.get('/ohlc', (req: any, res: any) =>
      this.ok(res, deps.quoteService.getOHLC(parseInstruments(req.query)))
    );
    this.app.get('/ltp', (req: any, res: any) =>
      this.ok(res, deps.quoteService.getLTP(parseInstruments(req.query)))
    );

    // /gtt/*
    this.app.post('/gtt/triggers', (req: any, res: any) => {
      const trigger = this.mutate(() => deps.gttService.createTrigger(req.body));
      this.ok(res, { trigger_id: trigger.id });
    });
    this.app.get('/gtt/triggers', (_req: any, res: any) => this.ok(res, deps.gttService.getGTTs()));
    this.app.get('/gtt/triggers/:trigger_id', (req: any, res: any) =>
      this.ok(res, deps.gttService.getGTT(req.params.trigger_id))
    );
    this.app.delete('/gtt/triggers/:trigger_id', (req: any, res: any) => {
      this.mutate(() => deps.gttService.deleteGTT(req.params.trigger_id));
      this.ok(res, { trigger_id: req.params.trigger_id });
    });
    this.app.put('/gtt/triggers/:trigger_id', (req: any, res: any) =>
      this.ok(res, this.mutate(() => deps.gttService.modifyTrigger(req.params.trigger_id, req.body)))
    );

    // Debug endpoints (R7).
    this.setupDebugRoutes();

    // Error handler.
    this.app.use((err: any, _req: any, res: any, _next: any) => {
      if (err instanceof KiteError) {
        res.status(err.httpStatus).json(err.toBody());
      } else {
        this.log('error', err?.message ?? 'Internal error');
        res.status(500).json({
          status: 'error',
          message: err?.message ?? 'Internal error',
          error_type: 'GeneralException',
          data: null,
        });
      }
    });
  }

  /** Simple structured logger. */
  private log(level: string, msg: string, fields?: any): void {
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
    if (level === 'error') console.error(line);
    else console.log(line);
  }

  /** Debug endpoints (disabled unless ENABLE_DEBUG=true). */
  private setupDebugRoutes(): void {
    if (process.env.ENABLE_DEBUG !== 'true') return;
    const { deps } = this;
    this.app.get('/__debug/state', (_req: any, res: any) =>
      this.ok(res, deps.engine.snapshot())
    );
    this.app.get('/__debug/symbols', (_req: any, res: any) =>
      this.ok(res, deps.engine.listSymbols())
    );
    this.app.get('/__debug/orders', (_req: any, res: any) =>
      this.ok(res, deps.engine.getOrders())
    );
    this.app.post('/__debug/reset', (_req: any, res: any) => {
      deps.engine.reset();
      this.ok(res, { reset: true });
    });
    this.app.post('/__debug/tick', (req: any, res: any) => {
      deps.engine.emitTick(req.body);
      this.ok(res, { emitted: true });
    });
    this.app.post('/__debug/symbol', (req: any, res: any) => {
      deps.engine.addSymbol(req.body.symbol, req.body.options);
      this.ok(res, { added: true });
    });
  }

  /** Start listening. */
  start(): Promise<number> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        resolve(this.config.port);
      });
    });
  }

  /** Mount an extra route/handler on the underlying express app. */
  use(path: string, handler: (req: any, res: any) => void): void {
    this.app.use(path, handler);
  }

  /** Get the underlying HTTP server (for attaching WebSocket). */
  getHttpServer(): any {
    return this.server;
  }

  /** Stop listening. */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
