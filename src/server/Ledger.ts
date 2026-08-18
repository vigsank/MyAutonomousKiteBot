import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { MigrationRunner } from './MigrationRunner';
import {
  Instrument,
  OrderRecord,
  Position,
  Segment,
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
      last_price: row.last_price ?? 0,
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
            entry_time=@entry, product=@product, entry_mode=@entryMode WHERE position_id=@id`,
        )
        .run({
          qty: p.quantity,
          avg: p.avgPrice,
          dir: p.direction,
          entry: p.entryTime.toISOString(),
          product: p.product ?? 'CNC',
          entryMode: p.entryMode ?? null,
          id: existing.position_id,
        });
    } else {
      this.db
        .prepare(
          `INSERT INTO positions
             (instrument_id, quantity, avg_price, direction, entry_time, status, product, entry_mode)
           VALUES (@instId, @qty, @avg, @dir, @entry, 'OPEN', @product, @entryMode)`,
        )
        .run({
          instId,
          qty: p.quantity,
          avg: p.avgPrice,
          dir: p.direction,
          entry: p.entryTime.toISOString(),
          product: p.product ?? 'CNC',
          entryMode: p.entryMode ?? null,
        });
    }
  }

  closePosition(
    symbol: string,
    exitPrice: number,
    pnl: number,
    instrument_token?: number,
    exchange: string = 'NSE',
  ): void {
    const instId = this.resolveInstrumentId(symbol, exchange, instrument_token);
    this.db
      .prepare(
        `UPDATE positions
            SET status = 'CLOSED', exit_time = datetime('now'),
                exit_price = ?, realized_pnl = ?
          WHERE instrument_id = ? AND status = 'OPEN'`,
      )
      .run(exitPrice, pnl, instId);
  }

  getPosition(symbol: string, exchange: string = 'NSE'): Position | null {
    const inst = this.getInstrumentBySymbol(symbol, exchange);
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
      exchange: exchange as Segment,
      quantity: row.quantity,
      avgPrice: row.avg_price,
      entryTime: new Date(row.entry_time),
      direction: row.direction,
      product: row.product ?? 'CNC',
      entryMode: row.entry_mode ?? undefined,
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
      product: r.product ?? 'CNC',
      entryMode: r.entry_mode ?? undefined,
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

  /** Persist an OHLC candle so the UI's Market chart shows live/historical bars. */
  recordCandle(
    symbol: string,
    exchange: string,
    interval: string,
    c: { timestamp: string; open: number; high: number; low: number; close: number; volume: number },
  ): void {
    const instId = this.resolveInstrumentId(symbol, exchange);
    this.db
      .prepare(
        `INSERT OR IGNORE INTO candles
           (instrument_id, interval, open, high, low, close, volume, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(instId, interval, c.open, c.high, c.low, c.close, c.volume, c.timestamp);
  }

  /** Persist the latest trade price for an instrument (used by drawdown). */
  updateLastPrice(token: number, price: number): void {
    if (!Number.isFinite(price) || price <= 0) return;
    this.db
      .prepare(`UPDATE instruments SET last_price = ? WHERE token = ?`)
      .run(price, token);
  }

  currentDrawdown(): number {
    const today = todayIST();
    const startUTC = new Date(`${today}T00:00:00+05:30`).toISOString();
    const realized = this.db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN pnl < 0 THEN pnl ELSE 0 END), 0) AS loss
           FROM trades
          WHERE status = 'FILLED' AND created_at >= ?`,
      )
      .get(startUTC) as { loss: number };

    // Include unrealized losses on open positions (latest tick vs avg price)
    // so a large losing open position is counted before it is closed.
    const open = this.db
      .prepare(
        `SELECT p.quantity, p.avg_price, p.direction, i.last_price AS last_price
           FROM positions p
           JOIN instruments i ON i.instrument_id = p.instrument_id
          WHERE p.status = 'OPEN'`,
      )
      .all() as Array<{
      quantity: number;
      avg_price: number;
      direction: string;
      last_price: number | null;
    }>;

    let unrealizedLoss = 0;
    for (const p of open) {
      const last = p.last_price && p.last_price > 0 ? p.last_price : p.avg_price;
      const pnl =
        p.direction === 'LONG'
          ? (last - p.avg_price) * p.quantity
          : (p.avg_price - last) * p.quantity;
      if (pnl < 0) unrealizedLoss += pnl;
    }

    return Math.abs(realized.loss) + Math.abs(unrealizedLoss);
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

  /** Cumulative realized PnL across all closed trades (portfolio drawdown). */
  cumulativeRealizedPnl(): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(pnl), 0) AS pnl FROM trades WHERE status = 'FILLED'`,
      )
      .get() as { pnl: number };
    return row.pnl;
  }

  /** Realized PnL since the 1st of the current month (monthly drawdown guard). */
  monthlyRealizedPnl(): number {
    const today = todayIST(); // YYYY-MM-DD
    const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00+05:30`).toISOString();
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(pnl), 0) AS pnl FROM trades
          WHERE status = 'FILLED' AND created_at >= ?`,
      )
      .get(monthStart) as { pnl: number };
    return row.pnl;
  }

  /** Capital reserved by pending (unfilled) orders. */
  pendingOrders(): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(ticket_size), 0) AS pending
           FROM orders
          WHERE status = 'PENDING'`,
      )
      .get() as { pending: number };
    return row.pending;
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
    exchange?: string;
  }): void {
    const instId = this.resolveInstrumentId(
      s.symbol,
      s.exchange ?? 'NSE',
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
    exchange: string = 'NSE',
  ): void {
    let instId: number | null = null;
    if (symbol) {
      instId = this.resolveInstrumentId(symbol, exchange, instrument_token);
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
    const today = todayIST();
    const startUTC = new Date(`${today}T00:00:00+05:30`).toISOString();
    const trades = this.db
      .prepare(
        `SELECT pnl, status FROM trades
          WHERE created_at >= ? AND status = 'FILLED'`,
      )
      .all(startUTC) as Array<{ pnl: number | null; status: string }>;

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
  /* End-of-day layer (square-off, performance, overnight matrix)      */
  /* ================================================================ */

  /** Today's realized PnL + trade stats (for EOD performance logging). */
  eodStats(day?: string): {
    realizedPnl: number;
    totalTrades: number;
    winning: number;
    losing: number;
    winRate: number;
  } {
    // Scoped to the requested IST day (e.g. '2026-03-05') when provided, else today.
    const dayLabel = day ?? todayIST();
    const startUTC = new Date(`${dayLabel}T00:00:00+05:30`).toISOString();
    const endUTC = new Date(`${dayLabel}T00:00:00+05:30`);
    endUTC.setUTCDate(endUTC.getUTCDate() + 1);
    const rows = this.db
      .prepare(
        `SELECT pnl FROM trades
          WHERE status = 'FILLED' AND created_at >= ? AND created_at < ?`,
      )
      .all(startUTC, endUTC.toISOString()) as Array<{ pnl: number | null }>;
    let realizedPnl = 0;
    let winning = 0;
    let losing = 0;
    for (const r of rows) {
      const p = r.pnl ?? 0;
      realizedPnl += p;
      if (p > 0) winning++;
      else if (p < 0) losing++;
    }
    const totalTrades = rows.length;
    return { realizedPnl, totalTrades, winning, losing, winRate: totalTrades ? winning / totalTrades : 0 };
  }

  /** Persist an EOD performance record. */
  recordEodPerformance(p: {
    reportDate: string;
    realizedPnl: number;
    totalTrades: number;
    winning: number;
    losing: number;
    winRate: number;
    slippageTotal: number;
    executionAccuracy: number;
    summary: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO eod_performance
           (report_date, realized_pnl, total_trades, winning_trades, losing_trades,
            win_rate, slippage_total, execution_accuracy, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        p.reportDate,
        p.realizedPnl,
        p.totalTrades,
        p.winning,
        p.losing,
        p.winRate,
        p.slippageTotal,
        p.executionAccuracy,
        p.summary,
      );
  }

  /** Persist one row of the overnight holding matrix. */
  recordOvernightMatrix(m: {
    reportDate: string;
    symbol: string;
    gapRiskPct: number | null;
    flagged: boolean;
    events: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO overnight_matrix (report_date, symbol, gap_risk_pct, flagged, events)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(m.reportDate, m.symbol, m.gapRiskPct, m.flagged ? 1 : 0, m.events);
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

  /* ---- runtime state (key-value) ---- */

  getState(key: string): string | null {
    const row = this.db
      .prepare('SELECT value FROM bot_state WHERE key = ?')
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setState(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO bot_state (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      )
      .run(key, value);
  }

  /* ---- options ---- */

  recordOptionPosition(p: {
    symbol: string;
    type: 'CE' | 'PE';
    strike: number;
    premium: number;
    lotSize: number;
    daysToExpiry: number;
    expiry: string;
    quantity: number;
    entryPremium: number;
    entryTime: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO option_positions
           (symbol, type, strike, premium, lot_size, days_to_expiry, expiry, quantity, entry_premium, entry_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        p.symbol,
        p.type,
        p.strike,
        p.premium,
        p.lotSize,
        p.daysToExpiry,
        p.expiry,
        p.quantity,
        p.entryPremium,
        p.entryTime,
      );
  }

  closeOptionPosition(symbol: string, exitPremium: number, pnl: number): void {
    this.db
      .prepare(
        `UPDATE option_positions
            SET status = 'CLOSED', exit_time = datetime('now'),
                exit_premium = ?, realized_pnl = ?
          WHERE symbol = ? AND status = 'OPEN'`,
      )
      .run(exitPremium, pnl, symbol);
  }

  getOpenOptionPositions(): Array<{
    symbol: string;
    type: 'CE' | 'PE';
    strike: number;
    premium: number;
    lotSize: number;
    daysToExpiry: number;
    expiry: string;
    quantity: number;
    entryPremium: number;
    entryTime: string;
  }> {
    return this.db
      .prepare(
        `SELECT symbol, type, strike, premium, lot_size AS lotSize,
                days_to_expiry AS daysToExpiry, expiry, quantity,
                entry_premium AS entryPremium, entry_time AS entryTime
           FROM option_positions WHERE status = 'OPEN'`,
      )
      .all() as any[];
  }

  recordOptionFill(f: {
    symbol: string;
    type: string;
    strike: number;
    quantity: number;
    premium: number;
    totalPremium: number;
    pnl: number;
    reason: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO option_fills
           (symbol, type, strike, quantity, premium, total_premium, pnl, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        f.symbol,
        f.type,
        f.strike,
        f.quantity,
        f.premium,
        f.totalPremium,
        f.pnl,
        f.reason,
      );
  }

  getOptionFills(): Array<{
    symbol: string;
    type: string;
    strike: number;
    quantity: number;
    premium: number;
    totalPremium: number;
    pnl: number;
    reason: string;
    createdAt: string;
  }> {
    return this.db
      .prepare(
        `SELECT symbol, type, strike, quantity, premium,
                total_premium AS totalPremium, pnl, reason, created_at AS createdAt
           FROM option_fills ORDER BY created_at DESC`,
      )
      .all() as any[];
  }

  /** Total premium locked in open option positions. */
  optionExposure(): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(entry_premium), 0) AS exp
           FROM option_positions WHERE status = 'OPEN'`,
      )
      .get() as { exp: number };
    return row.exp;
  }

  /* ---- notifications ---- */

  recordNotification(rec: {
    channel: string;
    severity: string;
    title: string;
    body: string;
    metadata: string | null;
    telegramSent: number;
  }): void {
    this.db
      .prepare(
        `INSERT INTO notifications
           (channel, severity, title, body, metadata, telegram_sent)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        rec.channel,
        rec.severity,
        rec.title,
        rec.body,
        rec.metadata,
        rec.telegramSent,
      );
  }

  /* ---- llm traces ---- */

  recordLlmTrace(t: {
    purpose: string;
    symbol?: string;
    model: string;
    prompt: string;
    response: string;
    latencyMs: number;
    tokensIn?: number | null;
    tokensOut?: number | null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO llm_traces
           (purpose, symbol, model, prompt, response, latency_ms, tokens_in, tokens_out)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        t.purpose,
        t.symbol ?? null,
        t.model,
        t.prompt,
        t.response,
        t.latencyMs,
        t.tokensIn ?? null,
        t.tokensOut ?? null,
      );
  }

  getLlmTraces(limit = 100): Array<{
    purpose: string;
    symbol: string | null;
    model: string;
    prompt: string;
    response: string;
    latencyMs: number;
    tokensIn: number | null;
    tokensOut: number | null;
    createdAt: string;
  }> {
    return this.db
      .prepare(
        `SELECT purpose, symbol, model, prompt, response,
                latency_ms AS latencyMs, tokens_in AS tokensIn,
                tokens_out AS tokensOut, created_at AS createdAt
           FROM llm_traces ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as any[];
  }

  /* ---- probe runs & news articles (agent persistence) ---- */

  /** Persist a probe-run verdict (one row per pre-open / mid-session / pre-close run). */
  recordProbeRun(p: {
    runId: string;
    runType: 'pre_open' | 'mid_session' | 'pre_close' | 'manual';
    symbol: string;
    runAt: string;
    dayBias?: string;
    verdict?: string;
    summary?: string;
    meta?: string;
  }): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO probe_runs
           (run_id, run_type, symbol, run_at, day_bias, verdict, summary, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        p.runId,
        p.runType,
        p.symbol,
        p.runAt,
        p.dayBias ?? null,
        p.verdict ?? null,
        p.summary ?? null,
        p.meta ?? null,
      );
  }

  /**
   * Persist a fetched news article, deduped by normalized-title hash.
   * Returns true when a NEW row was inserted, false when it was a duplicate.
   */
  recordNewsArticle(a: {
    runId?: string;
    symbol: string;
    source: string;
    title: string;
    link?: string;
    summary?: string;
    fullContent?: string;
    contentSource?: string;
    publishedAt?: string;
  }): boolean {
    const dedupKey = this.dedupKey(a.title);
    const res = this.db
      .prepare(
        `INSERT OR IGNORE INTO news_articles
           (article_id, run_id, symbol, source, title, link, summary,
            full_content, content_source, content_len, published_at, fetched_at, dedup_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        dedupKey,
        a.runId ?? null,
        a.symbol,
        a.source,
        a.title,
        a.link ?? null,
        a.summary ?? null,
        a.fullContent ?? null,
        a.contentSource ?? null,
        (a.fullContent ?? '').length,
        a.publishedAt ?? null,
        new Date().toISOString(),
        dedupKey,
      );
    return res.changes > 0;
  }

  /** Read persisted news for a symbol (for pattern / summary runs). */
  getNewsArticles(
    symbol: string,
    fromIso?: string,
    limit = 100,
  ): Array<{
    articleId: string;
    symbol: string;
    source: string;
    title: string;
    link: string | null;
    summary: string | null;
    fullContent: string | null;
    contentSource: string | null;
    publishedAt: string | null;
    fetchedAt: string;
  }> {
    if (fromIso) {
      return this.db
        .prepare(
          `SELECT article_id AS articleId, symbol, source, title, link, summary,
                  full_content AS fullContent, content_source AS contentSource,
                  published_at AS publishedAt, fetched_at AS fetchedAt
             FROM news_articles WHERE symbol = ? AND fetched_at >= ?
             ORDER BY fetched_at DESC LIMIT ?`,
        )
        .all(symbol, fromIso, limit) as any[];
    }
    return this.db
      .prepare(
        `SELECT article_id AS articleId, symbol, source, title, link, summary,
                full_content AS fullContent, content_source AS contentSource,
                published_at AS publishedAt, fetched_at AS fetchedAt
           FROM news_articles WHERE symbol = ?
           ORDER BY fetched_at DESC LIMIT ?`,
      )
      .all(symbol, limit) as any[];
  }

  /** Read the latest probe runs for a symbol. */
  getProbeRuns(
    symbol: string,
    limit = 20,
  ): Array<{
    runId: string;
    runType: string;
    runAt: string;
    dayBias: string | null;
    verdict: string | null;
    summary: string | null;
    meta: string | null;
  }> {
    return this.db
      .prepare(
        `SELECT run_id AS runId, run_type AS runType, run_at AS runAt,
                day_bias AS dayBias, verdict, summary, meta
           FROM probe_runs WHERE symbol = ? ORDER BY run_at DESC LIMIT ?`,
      )
      .all(symbol, limit) as any[];
  }

  /* ---- daily report cycle (Reasoning Layer) ---- */

  /** Persist a 3-stage daily report (pre-open / mid-session / pre-close). */
  recordDailyReport(r: {
    reportType: 'pre_open' | 'mid_session' | 'pre_close';
    reportDate: string;
    reportJson: string;
    summary?: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO daily_reports (report_type, report_date, report_json, summary)
         VALUES (?, ?, ?, ?)`,
      )
      .run(r.reportType, r.reportDate, r.reportJson, r.summary ?? null);
  }

  /** Read the latest daily reports, optionally filtered by type. */
  getDailyReports(
    reportType?: 'pre_open' | 'mid_session' | 'pre_close',
    limit = 20,
  ): Array<{
    reportId: number;
    reportType: string;
    reportDate: string;
    reportJson: string;
    summary: string | null;
    createdAt: string;
  }> {
    if (reportType) {
      return this.db
        .prepare(
          `SELECT report_id AS reportId, report_type AS reportType,
                  report_date AS reportDate, report_json AS reportJson,
                  summary, created_at AS createdAt
             FROM daily_reports WHERE report_type = ?
             ORDER BY created_at DESC LIMIT ?`,
        )
        .all(reportType, limit) as any[];
    }
    return this.db
      .prepare(
        `SELECT report_id AS reportId, report_type AS reportType,
                report_date AS reportDate, report_json AS reportJson,
                summary, created_at AS createdAt
           FROM daily_reports ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as any[];
  }

  /** The most recent daily report (any stage), or null. */
  getLatestReport(): {
    reportType: string;
    reportDate: string;
    reportJson: string;
    createdAt: string;
  } | null {
    const row = this.db
      .prepare(
        `SELECT report_type AS reportType, report_date AS reportDate,
                report_json AS reportJson, created_at AS createdAt
           FROM daily_reports ORDER BY report_id DESC LIMIT 1`,
      )
      .get() as any;
    return row ?? null;
  }

  /** Record that a (symbol, date) news gap was backfilled. */
  recordBackfill(symbol: string, date: string, source: string, articleCount: number): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO news_backfill
           (symbol, backfill_date, backfilled_at, source, article_count)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(symbol, date, new Date().toISOString(), source, articleCount);
  }

  /** True when a (symbol, date) news gap has already been backfilled. */
  isBackfilled(symbol: string, date: string): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 FROM news_backfill WHERE symbol = ? AND backfill_date = ?`,
      )
      .get(symbol, date) as { 1: number } | undefined;
    return row !== undefined;
  }

  /** Normalized-title hash used as a dedup key across sources/runs. */
  private dedupKey(title: string): string {
    const norm = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    return crypto.createHash('sha1').update(norm).digest('hex');
  }

  /* ---- strategy parameter store (V011) ---- */

  /** Read a persisted strategy parameter (e.g. momentumTopN), or null. */
  getStrategyParam(key: string): string | null {
    const row = this.db
      .prepare('SELECT param_value FROM strategy_params WHERE param_key = ?')
      .get(key) as { param_value: string } | undefined;
    return row?.param_value ?? null;
  }

  /** Persist a strategy parameter (feedback/optimizer loop). */
  setStrategyParam(key: string, value: string, source = 'optimizer'): void {
    this.db
      .prepare(
        `INSERT INTO strategy_params (param_key, param_value, source, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(param_key) DO UPDATE SET
           param_value = excluded.param_value,
           source = excluded.source,
           updated_at = datetime('now')`,
      )
      .run(key, value, source);
  }

  /* ---- closed-trade feed (V009/V010, for StrategyAdaptation F2) ---- */

  /** Most recent closed (realized) trades, newest-first, for outcome learning. */
  getClosedTrades(limit = 40): Array<{ pnl: number; ticketSize: number }> {
    return this.db
      .prepare(
        `SELECT pnl, ticket_size AS ticketSize FROM trades
          WHERE status = 'FILLED' AND pnl IS NOT NULL AND pnl != 0
          ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as any[];
  }

  /* ---- order idempotency (V012, E1) ---- */

  /** Atomically claim the right to execute an order intent; false if duplicate. */
  claimOrderIntent(claim: {
    key: string;
    symbol: string;
    side: string;
    quantity: number;
    intent: string;
  }): boolean {
    const res = this.db
      .prepare(
        `INSERT INTO order_intents (intent_key, symbol, side, quantity, intent, status, claimed_at)
         VALUES (?, ?, ?, ?, ?, 'CLAIMED', datetime('now'))
         ON CONFLICT(intent_key) DO UPDATE SET
           status = 'CLAIMED', claimed_at = datetime('now'), settled_at = NULL
         WHERE order_intents.status = 'ABANDONED'`,
      )
      .run(claim.key, claim.symbol, claim.side, claim.quantity, claim.intent);
    return res.changes > 0;
  }

  /** Settle a claimed intent after execution (EXECUTED | ABANDONED). */
  settleOrderIntent(key: string, status: 'EXECUTED' | 'ABANDONED'): void {
    this.db
      .prepare(
        `UPDATE order_intents SET status = ?, settled_at = datetime('now')
          WHERE intent_key = ?`,
      )
      .run(status, key);
  }

  /** Back-link a broker order id to a fill (V012). */
  setBrokerOrderIdForTrade(tradeId: string, brokerOrderId: string): void {
    this.db
      .prepare('UPDATE trades SET broker_order_id = ? WHERE trade_id = ?')
      .run(brokerOrderId, tradeId);
  }

  /* ---- reconciliation log (V012, E2) ---- */

  /** Record a ledger ⇄ broker reconciliation finding. */
  recordReconciliation(r: {
    status: 'OK' | 'DRIFT' | 'ERROR';
    symbol?: string | null;
    issue?: string | null;
    ledgerQty?: number | null;
    brokerQty?: number | null;
    detail?: string | null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO reconciliation_log
           (status, symbol, issue, ledger_qty, broker_qty, detail, run_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(
        r.status,
        r.symbol ?? null,
        r.issue ?? null,
        r.ledgerQty ?? null,
        r.brokerQty ?? null,
        r.detail ?? null,
      );
  }

  /** Most recent reconciliation rows, newest-first (for the readiness test). */
  getRecentReconciliations(limit = 20): Array<{
    status: string;
    symbol: string | null;
    issue: string | null;
    ledgerQty: number | null;
    brokerQty: number | null;
    detail: string | null;
    runAt: string;
  }> {
    return this.db
      .prepare(
        `SELECT status, symbol, issue, ledger_qty AS ledgerQty,
                broker_qty AS brokerQty, detail, run_at AS runAt
           FROM reconciliation_log ORDER BY run_at DESC LIMIT ?`,
      )
      .all(limit) as any[];
  }

  /* ---- shadow book / AI authority (V013, Phase 4) ---- */

  /** Log an AI-originated (or momentum) proposal, executed or shadow-only. */
  recordAgentProposal(p: {
    symbol: string;
    originator: string;
    direction: string;
    quantity: number;
    entryPrice: number;
    aiTilt: number;
    thesis?: string;
    executed?: boolean;
    outcome?: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO agent_proposals
           (symbol, originator, direction, quantity, entry_price,
            ai_tilt, thesis, executed, outcome, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(
        p.symbol,
        p.originator,
        p.direction,
        p.quantity,
        p.entryPrice,
        p.aiTilt,
        p.thesis ?? 'no thesis',
        p.executed ? 1 : 0,
        p.outcome ?? null,
      );
  }

  /** Read logged proposals, newest-first, optionally filtered by originator. */
  getAgentProposals(
    limit = 50,
    originator?: string,
  ): Array<{
    symbol: string;
    originator: string;
    direction: string;
    quantity: number;
    entryPrice: number;
    aiTilt: number;
    executed: number;
    outcome: string | null;
    createdAt: string;
  }> {
    if (originator) {
      return this.db
        .prepare(
          `SELECT symbol, originator, direction, quantity, entry_price AS entryPrice,
                  ai_tilt AS aiTilt, executed, outcome, created_at AS createdAt
             FROM agent_proposals WHERE originator = ? ORDER BY created_at DESC LIMIT ?`,
        )
        .all(originator, limit) as any[];
    }
    return this.db
      .prepare(
        `SELECT symbol, originator, direction, quantity, entry_price AS entryPrice,
                ai_tilt AS aiTilt, executed, outcome, created_at AS createdAt
           FROM agent_proposals ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as any[];
  }

  /** Months of shadow-book history (earliest proposal → now). */
  shadowBookMonths(now: Date = new Date()): number {
    const row = this.db
      .prepare('SELECT MIN(created_at) AS first FROM agent_proposals')
      .get() as { first: string | null } | undefined;
    if (!row?.first) return 0;
    const first = new Date(row.first);
    const months =
      (now.getUTCFullYear() - first.getUTCFullYear()) * 12 +
      (now.getUTCMonth() - first.getUTCMonth());
    return Math.max(0, months);
  }

  /**
   * Forward-return of each logged proposal over a horizon, grouped by originator
   * (MOMENTUM executed vs AI_COMPOSITE shadow). Returns [] when no proposals
   * have a forward candle yet.
   */
  scoreShadowBook(horizonDays = 21): Array<{
    originator: string;
    scored: number;
    avgReturnPct: number;
    hitRate: number;
  }> {
    const proposals = this.db
      .prepare(
        `SELECT p.proposal_id AS id, p.symbol, p.direction, p.entry_price AS entryPrice,
                p.originator, p.created_at AS createdAt
           FROM agent_proposals p`,
      )
      .all() as any[];
    const byOriginator = new Map<
      string,
      { total: number; count: number; wins: number }
    >();
    for (const p of proposals) {
      // SQLite stores UTC as 'YYYY-MM-DD HH:MM:SS'; parse it as UTC so the
      // horizon comparison is exact regardless of the host's timezone.
      const rawCreated = String(p.createdAt ?? '');
      const createdUtc = new Date(
        rawCreated.includes('T')
          ? rawCreated
          : rawCreated.replace(' ', 'T') + 'Z',
      );
      if (Number.isNaN(createdUtc.getTime())) continue;
      const horizon = new Date(createdUtc.getTime() + horizonDays * 86400000);
      const instId = this.resolveInstrumentId(p.symbol, 'NSE');
      // First close at/after the horizon (forward return from the decision date).
      const row = this.db
        .prepare(
          `SELECT close FROM candles
            WHERE instrument_id = ? AND timestamp >= ?
            ORDER BY timestamp ASC LIMIT 1`,
        )
        .get(instId, horizon.toISOString()) as { close: number } | undefined;
      if (!row || row.close <= 0) continue;
      const ret =
        p.direction === 'SHORT' || p.direction === 'SELL'
          ? (p.entryPrice - row.close) / p.entryPrice
          : (row.close - p.entryPrice) / p.entryPrice;
      const acc = byOriginator.get(p.originator) ?? { total: 0, count: 0, wins: 0 };
      acc.total += ret * 100;
      acc.count += 1;
      if (ret > 0) acc.wins += 1;
      byOriginator.set(p.originator, acc);
    }
    return [...byOriginator.entries()].map(([originator, v]) => ({
      originator,
      scored: v.count,
      avgReturnPct: v.count > 0 ? v.total / v.count : 0,
      hitRate: v.count > 0 ? v.wins / v.count : 0,
    }));
  }

  /* ---- realized P&L by month (Phase 5.1) ---- */

  /** Realized P&L grouped by IST month, oldest→newest (feeds the kill ladder). */
  realizedPnlByMonth(): Array<{ month: string; pnl: number }> {
    const rows = this.db
      .prepare(
        `SELECT substr(created_at, 1, 7) AS month, SUM(pnl) AS pnl
           FROM trades WHERE pnl IS NOT NULL
          GROUP BY month ORDER BY month ASC`,
      )
      .all() as Array<{ month: string; pnl: number | null }>;
    return rows.map((r) => ({ month: r.month, pnl: r.pnl ?? 0 }));
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
/* ---- module-level helpers ---- */

/** IST date string for "now" (the market runs on IST, UTC+5:30). */
function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

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
