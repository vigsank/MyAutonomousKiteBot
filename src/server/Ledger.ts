import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { MigrationRunner } from './MigrationRunner';
import {
  Instrument,
  OrderRecord,
  Position,
  SignalDirection,
  TradeFill,
  TradeRequest,
  TransactionType,
} from './types';

/**
 * SQLite ledger — the single source of truth for all bot state.
 *
 * Uses a highly normalized schema (16 tables) managed by a custom migration
 * runner (Liquibase-style). All paper-trade state, positions, orders, signals,
 * risk events, notifications, health checks, and performance summaries live
 * here.
 *
 * The database and schema are created automatically on first run — zero manual
 * setup required.
 */
export class Ledger {
  private db: Database.Database;
  private migrationRunner: MigrationRunner;

  constructor(dataDir: string) {
    if (dataDir === ':memory:') {
      this.db = new Database(':memory:');
    } else {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      this.db = new Database(path.join(dataDir, 'ledger.db'));
    }
    // WAL is only meaningful for file-backed DBs.
    if (dataDir !== ':memory:') {
      this.db.pragma('journal_mode = WAL');
    }
    this.db.pragma('foreign_keys = ON');

    this.migrationRunner = new MigrationRunner(this.db);
  }

  /** Run all pending schema migrations. Call once at startup. */
  runMigrations(): void {
    const migrationsDir = path.join(process.cwd(), 'migrations');
    this.migrationRunner.run(migrationsDir);
  }

  /** Expose the raw Database for services that need direct access. */
  raw(): Database.Database {
    return this.db;
  }

  /* ================================================================ */
  /* Instruments                                                       */
  /* ================================================================ */

  upsertInstrument(inst: Instrument): void {
    this.db
      .prepare(
        `INSERT INTO instruments
           (token, tradingsymbol, exchange, segment, instrument_type, name, lot_size, tick_size)
         VALUES (@token, @tradingsymbol, @exchange, @segment, @instrument_type, @name, @lot_size, @tick_size)
         ON CONFLICT(token) DO UPDATE SET
           tradingsymbol=excluded.tradingsymbol, exchange=excluded.exchange,
           segment=excluded.segment, instrument_type=excluded.instrument_type,
           name=excluded.name, lot_size=excluded.lot_size, tick_size=excluded.tick_size`,
      )
      .run({
        token: inst.instrument_token,
        tradingsymbol: inst.tradingsymbol,
        exchange: inst.exchange,
        segment: inst.segment,
        instrument_type: inst.instrument_type,
        name: inst.name,
        lot_size: inst.lot_size,
        tick_size: inst.tick_size,
      });
  }

  getInstrumentByToken(token: number): Instrument | null {
    const row = this.db
      .prepare('SELECT * FROM instruments WHERE token = ?')
      .get(token) as any;
    return row ? this.rowToInstrument(row) : null;
  }

  getInstrumentBySymbol(symbol: string, exchange: string): Instrument | null {
    const row = this.db
      .prepare(
        'SELECT * FROM instruments WHERE tradingsymbol = ? AND exchange = ?',
      )
      .get(symbol, exchange) as any;
    return row ? this.rowToInstrument(row) : null;
  }

  private rowToInstrument(row: any): Instrument {
    return {
      instrument_token: row.token,
      exchange_token: String(row.token),
      tradingsymbol: row.tradingsymbol,
      name: row.name,
      last_price: 0,
      expiry: undefined,
      strike: undefined,
      tick_size: row.tick_size,
      lot_size: row.lot_size,
      instrument_type: row.instrument_type,
      segment: row.segment,
      exchange: row.exchange,
    };
  }

  /* ================================================================ */
  /* Orders                                                            */
  /* ================================================================ */

  recordOrder(order: OrderRecord & { instrument_token?: number }): void {
    const instId = this.resolveInstrumentId(
      order.symbol,
      order.exchange,
      order.instrument_token,
    );
    this.db
      .prepare(
        `INSERT OR REPLACE INTO orders
           (order_id, instrument_id, trade_id, side, quantity, price,
            ticket_size, status, variety, order_type, product, reason, created_at)
         VALUES (@orderId, @instrumentId, @tradeId, @side, @quantity,
           @price, @ticketSize, @status, @variety, @orderType, @product,
           @reason, @createdAt)`,
      )
      .run({
        orderId: order.orderId,
        instrumentId: instId,
        tradeId: order.tradeId ?? null,
        side: order.side,
        quantity: order.quantity,
        price: order.price,
        ticketSize: order.ticketSize,
        status: order.status,
        variety: order.variety,
        orderType: order.orderType,
        product: order.product,
        reason: order.reason,
        createdAt: order.createdAt.toISOString(),
      });
  }

  /* ================================================================ */
  /* Positions                                                         */
  /* ================================================================ */

  upsertPosition(
    p: Position & { instrument_token?: number },
  ): void {
    const instId = this.resolveInstrumentId(
      p.symbol,
      p.exchange,
      p.instrument_token,
    );
    // Check if an OPEN position exists for this instrument.
    const existing = this.db
      .prepare(
        `SELECT position_id FROM positions
          WHERE instrument_id = ? AND status = 'OPEN'`,
      )
      .get(instId) as { position_id: number } | undefined;

    if (existing) {
      this.db
        .prepare(
          `UPDATE positions SET quantity=@qty, avg_price=@avg, direction=@dir,
            entry_time=@entry WHERE position_id=@id`,
        )
        .run({
          qty: p.quantity,
          avg: p.avgPrice,
          dir: p.direction,
          entry: p.entryTime.toISOString(),
          id: existing.position_id,
        });
    } else {
      this.db
        .prepare(
          `INSERT INTO positions
             (instrument_id, quantity, avg_price, direction, entry_time, status)
           VALUES (@instId, @qty, @avg, @dir, @entry, 'OPEN')`,
        )
        .run({
          instId,
          qty: p.quantity,
          avg: p.avgPrice,
          dir: p.direction,
          entry: p.entryTime.toISOString(),
        });
    }
  }

  closePosition(
    symbol: string,
    exitPrice: number,
    pnl: number,
    instrument_token?: number,
  ): void {
    const instId = this.resolveInstrumentId(symbol, 'NSE', instrument_token);
    this.db
      .prepare(
        `UPDATE positions
            SET status = 'CLOSED', exit_time = datetime('now'),
                exit_price = ?, realized_pnl = ?
          WHERE instrument_id = ? AND status = 'OPEN'`,
      )
      .run(exitPrice, pnl, instId);
  }

  getPosition(symbol: string): Position | null {
    const inst = this.getInstrumentBySymbol(symbol, 'NSE');
    if (!inst) return null;
    const instId = this.instrumentIdByToken(inst.instrument_token);
    if (instId === null) return null;
    const row = this.db
      .prepare(
        `SELECT * FROM positions
          WHERE instrument_id = ? AND status = 'OPEN'`,
      )
      .get(instId) as any;
    if (!row) return null;
    return {
      symbol,
      exchange: 'NSE',
      quantity: row.quantity,
      avgPrice: row.avg_price,
      entryTime: new Date(row.entry_time),
      direction: row.direction,
    };
  }

  getOpenPositions(): Position[] {
    const rows = this.db
      .prepare(
        `SELECT p.*, i.tradingsymbol, i.exchange
           FROM positions p
           JOIN instruments i ON i.instrument_id = p.instrument_id
          WHERE p.status = 'OPEN'`,
      )
      .all() as any[];
    return rows.map((r: any) => ({
      symbol: r.tradingsymbol,
      exchange: r.exchange,
      quantity: r.quantity,
      avgPrice: r.avg_price,
      entryTime: new Date(r.entry_time),
      direction: r.direction,
    }));
  }

  /* ================================================================ */
  /* Trades / PnL                                                      */
  /* ================================================================ */

  recordTrade(
    trade: TradeFill & { instrument_token?: number },
  ): void {
    const instId = this.resolveInstrumentId(
      trade.symbol,
      trade.exchange,
      trade.instrument_token,
    );
    this.db
      .prepare(
        `INSERT OR REPLACE INTO trades
           (trade_id, instrument_id, direction, quantity, price,
            ticket_size, pnl, status, reason, created_at)
         VALUES (@tradeId, @instId, @dir, @qty, @price,
           @ticketSize, @pnl, @status, @reason, @ts)`,
      )
      .run({
        tradeId: trade.tradeId,
        instId,
        dir: trade.direction,
        qty: trade.quantity,
        price: trade.price,
        ticketSize: trade.ticketSize,
        pnl: trade.pnl,
        status: trade.status,
        reason: trade.reason,
        ts: trade.timestamp.toISOString(),
      });
  }

  currentDrawdown(): number {
    const today = new Date().toISOString().slice(0, 10);
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN pnl < 0 THEN pnl ELSE 0 END), 0) AS loss
           FROM trades
          WHERE status = 'FILLED' AND created_at LIKE ?`,
      )
      .get(`${today}%`) as { loss: number };
    return Math.abs(row.loss);
  }

  usedCapital(): number {
    const rows = this.db
      .prepare(
        `SELECT p.quantity, p.avg_price
           FROM positions p
          WHERE p.status = 'OPEN'`,
      )
      .all() as Array<{ quantity: number; avg_price: number }>;
    return rows.reduce((sum, r) => sum + r.quantity * r.avg_price, 0);
  }

  lastTradeTime(): Date | null {
    const row = this.db
      .prepare(
        `SELECT created_at FROM trades
          WHERE status = 'FILLED' ORDER BY created_at DESC LIMIT 1`,
      )
      .get() as { created_at: string } | undefined;
    return row ? new Date(row.created_at) : null;
  }

  /* ================================================================ */
  /* Signals                                                           */
  /* ================================================================ */

  recordSignal(s: {
    symbol: string;
    direction: string;
    rsi: number;
    price: number;
    reason: string;
    timestamp: Date;
    sentiment_score?: number;
    instrument_token?: number;
  }): void {
    const instId = this.resolveInstrumentId(
      s.symbol,
      'NSE',
      s.instrument_token,
    );
    this.db
      .prepare(
        `INSERT INTO signals
           (instrument_id, direction, rsi_value, price, sentiment_score, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        instId,
        s.direction,
        s.rsi,
        s.price,
        s.sentiment_score ?? null,
        s.reason,
        s.timestamp.toISOString(),
      );
  }

  /* ================================================================ */
  /* Risk events                                                       */
  /* ================================================================ */

  recordRiskEvent(
    eventType: string,
    details: string,
    symbol?: string,
    instrument_token?: number,
  ): void {
    let instId: number | null = null;
    if (symbol) {
      instId = this.resolveInstrumentId(symbol, 'NSE', instrument_token);
    }
    this.db
      .prepare(
        `INSERT INTO risk_events (instrument_id, event_type, details)
         VALUES (?, ?, ?)`,
      )
      .run(instId, eventType, details);
  }

  /* ================================================================ */
  /* Session                                                           */
  /* ================================================================ */

  startSession(type: string = 'PAPER'): number {
    const result = this.db
      .prepare(
        `INSERT INTO sessions (session_type, status) VALUES (?, 'ACTIVE')`,
      )
      .run(type);
    return Number(result.lastInsertRowid);
  }

  endSession(sessionId: number, status: string): void {
    this.db
      .prepare(
        `UPDATE sessions SET ended_at = datetime('now'), status = ? WHERE session_id = ?`,
      )
      .run(status, sessionId);
  }

  /* ================================================================ */
  /* Health checks                                                     */
  /* ================================================================ */

  recordHealthCheck(
    component: string,
    status: string,
    latencyMs?: number,
    details?: string,
  ): void {
    this.db
      .prepare(
        `INSERT INTO health_checks (component, status, latency_ms, details)
         VALUES (?, ?, ?, ?)`,
      )
      .run(component, status, latencyMs ?? null, details ?? null);
  }

  /* ================================================================ */
  /* Daily summary                                                     */
  /* ================================================================ */

  computeDailySummary(capital: number): void {
    const today = new Date().toISOString().slice(0, 10);
    const trades = this.db
      .prepare(
        `SELECT pnl, status FROM trades
          WHERE created_at LIKE ? AND status = 'FILLED'`,
      )
      .all(`${today}%`) as Array<{ pnl: number | null; status: string }>;

    const totalTrades = trades.length;
    const winning = trades.filter((t) => (t.pnl ?? 0) > 0).length;
    const losing = trades.filter((t) => (t.pnl ?? 0) < 0).length;
    const realizedPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const winRate = totalTrades > 0 ? winning / totalTrades : null;

    // Compute max drawdown for the day from trade PnL.
    let peak = 0;
    let running = 0;
    let maxDd = 0;
    for (const t of trades) {
      running += t.pnl ?? 0;
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDd) maxDd = dd;
    }

    this.db
      .prepare(
        `INSERT OR REPLACE INTO daily_summary
           (date, starting_capital, ending_capital, realized_pnl,
            total_trades, winning_trades, losing_trades, win_rate, max_drawdown)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        today,
        capital,
        capital + realizedPnl,
        realizedPnl,
        totalTrades,
        winning,
        losing,
        winRate,
        maxDd,
      );
  }

  /* ================================================================ */
  /* Utility                                                           */
  /* ================================================================ */

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  close(): void {
    this.db.close();
  }

  /* ---- private ---- */

  /** Look up the auto-increment instrument_id for a token, or null. */
  private instrumentIdByToken(token: number): number | null {
    const row = this.db
      .prepare('SELECT instrument_id FROM instruments WHERE token = ?')
      .get(token) as { instrument_id: number } | undefined;
    return row ? row.instrument_id : null;
  }

  /**
   * Resolve an instrument_id from a symbol+exchange, optionally creating a
   * stub row if the instrument isn't yet in the table.
   */
  private resolveInstrumentId(
    symbol: string,
    exchange: string,
    token?: number,
  ): number {
    if (token) {
      const existing = this.db
        .prepare('SELECT instrument_id FROM instruments WHERE token = ?')
        .get(token) as { instrument_id: number } | undefined;
      if (existing) return existing.instrument_id;
    }

    const bySymbol = this.db
      .prepare(
        `SELECT instrument_id FROM instruments
          WHERE tradingsymbol = ? AND exchange = ?`,
      )
      .get(symbol, exchange) as { instrument_id: number } | undefined;
    if (bySymbol) return bySymbol.instrument_id;

    // Create a stub — the real data will be upserted later by KiteStreamer.
    // Use a deterministic per-symbol token so multiple symbols never collide.
    const stubToken = token ?? hashToken(symbol, exchange);
    const result = this.db
      .prepare(
        `INSERT INTO instruments (token, tradingsymbol, exchange, segment, instrument_type)
         VALUES (?, ?, ?, ?, 'EQ')`,
      )
      .run(stubToken, symbol, exchange, exchange);
    return Number(result.lastInsertRowid);
  }
}

/** Deterministic 32-bit hash of a symbol+exchange, used for stub tokens. */
function hashToken(symbol: string, exchange: string): number {
  const s = exchange + ':' + symbol;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h || 1; // never 0 (0 is the "no token" sentinel)
}

/** Build a deterministic trade id. */
export function newTradeId(): string {
  return `TRD-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** Side implied by a direction. NEUTRAL is invalid for execution. */
export function directionToSide(
  direction: SignalDirection,
): TransactionType {
  switch (direction) {
    case 'LONG':
      return 'BUY';
    case 'SHORT':
      return 'SELL';
    case 'NEUTRAL':
      throw new Error('Cannot map NEUTRAL direction to a trade side.');
  }
}
