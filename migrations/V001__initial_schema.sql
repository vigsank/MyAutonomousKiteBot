-- ============================================================================
-- V001: Initial normalized schema for My Autonomous Kite Vault
-- ============================================================================
-- This migration creates the full normalized data model. All tables use
-- IF NOT EXISTS so the migration is idempotent.

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS instruments (
    instrument_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    token           INTEGER UNIQUE NOT NULL,
    tradingsymbol   TEXT    NOT NULL,
    exchange        TEXT    NOT NULL,
    segment         TEXT    NOT NULL,
    instrument_type TEXT    NOT NULL,
    name            TEXT    NOT NULL DEFAULT '',
    lot_size        INTEGER NOT NULL DEFAULT 1,
    tick_size       REAL    NOT NULL DEFAULT 0.05,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_instruments_symbol
    ON instruments(tradingsymbol, exchange);

CREATE TABLE IF NOT EXISTS watchlist (
    watchlist_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    instrument_id   INTEGER NOT NULL REFERENCES instruments(instrument_id),
    quantity        INTEGER NOT NULL,
    enabled         INTEGER NOT NULL DEFAULT 1,
    added_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Market data
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS candles (
    candle_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    instrument_id   INTEGER NOT NULL REFERENCES instruments(instrument_id),
    interval        TEXT    NOT NULL,
    open            REAL    NOT NULL,
    high            REAL    NOT NULL,
    low             REAL    NOT NULL,
    close           REAL    NOT NULL,
    volume          INTEGER NOT NULL DEFAULT 0,
    timestamp       TEXT    NOT NULL,
    UNIQUE(instrument_id, interval, timestamp)
);

CREATE TABLE IF NOT EXISTS ticks (
    tick_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    instrument_id   INTEGER NOT NULL REFERENCES instruments(instrument_id),
    last_price      REAL    NOT NULL,
    volume_traded   INTEGER,
    oi              INTEGER,
    change          REAL,
    timestamp       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ticks_ts ON ticks(timestamp);

-- ---------------------------------------------------------------------------
-- Strategy signals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS signals (
    signal_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    instrument_id   INTEGER NOT NULL REFERENCES instruments(instrument_id),
    direction       TEXT    NOT NULL CHECK(direction IN ('LONG','SHORT','NEUTRAL')),
    rsi_value       REAL,
    price           REAL    NOT NULL,
    sentiment_score REAL,
    reason          TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_signals_ts ON signals(created_at);

-- ---------------------------------------------------------------------------
-- Risk events (audit trail for every gate decision)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS risk_events (
    risk_event_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    instrument_id   INTEGER REFERENCES instruments(instrument_id),
    event_type      TEXT    NOT NULL,
    details         TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_risk_events_ts ON risk_events(created_at);

-- ---------------------------------------------------------------------------
-- Orders (paper)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
    order_id        TEXT    PRIMARY KEY,
    instrument_id   INTEGER NOT NULL REFERENCES instruments(instrument_id),
    trade_id        TEXT,
    side            TEXT    NOT NULL CHECK(side IN ('BUY','SELL')),
    quantity        INTEGER NOT NULL,
    price           REAL    NOT NULL,
    ticket_size     REAL    NOT NULL,
    status          TEXT    NOT NULL CHECK(status IN ('PENDING','FILLED','REJECTED','CANCELLED')),
    variety         TEXT    NOT NULL DEFAULT 'regular',
    order_type      TEXT    NOT NULL DEFAULT 'MARKET',
    product         TEXT    NOT NULL DEFAULT 'CNC',
    reason          TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_ts ON orders(created_at);

-- ---------------------------------------------------------------------------
-- Positions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS positions (
    position_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    instrument_id   INTEGER NOT NULL REFERENCES instruments(instrument_id),
    quantity        INTEGER NOT NULL,
    avg_price       REAL    NOT NULL,
    direction       TEXT    NOT NULL CHECK(direction IN ('LONG','SHORT')),
    entry_time      TEXT    NOT NULL,
    exit_time       TEXT,
    exit_price      REAL,
    realized_pnl    REAL,
    status          TEXT    NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED'))
);

-- ---------------------------------------------------------------------------
-- Trades (fills)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trades (
    trade_id        TEXT    PRIMARY KEY,
    instrument_id   INTEGER NOT NULL REFERENCES instruments(instrument_id),
    position_id     INTEGER REFERENCES positions(position_id),
    direction       TEXT    NOT NULL CHECK(direction IN ('LONG','SHORT')),
    quantity        INTEGER NOT NULL,
    price           REAL    NOT NULL,
    ticket_size     REAL    NOT NULL,
    pnl             REAL,
    status          TEXT    NOT NULL CHECK(status IN ('FILLED','REJECTED')),
    reason          TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trades_ts ON trades(created_at);

-- ---------------------------------------------------------------------------
-- Notifications (DB-first; Telegram is an optional channel)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
    notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel         TEXT    NOT NULL DEFAULT 'DB' CHECK(channel IN ('DB','TELEGRAM','BOTH')),
    severity        TEXT    NOT NULL CHECK(severity IN ('INFO','WARN','ERROR','TRADE','APPROVAL','SENTIMENT')),
    title           TEXT    NOT NULL,
    body            TEXT    NOT NULL,
    metadata        TEXT,
    telegram_sent   INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_ts ON notifications(created_at);

-- ---------------------------------------------------------------------------
-- Daily performance summary
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS daily_summary (
    summary_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    date            TEXT    NOT NULL UNIQUE,
    starting_capital REAL   NOT NULL,
    ending_capital  REAL    NOT NULL,
    realized_pnl    REAL    NOT NULL DEFAULT 0,
    unrealized_pnl  REAL,
    total_trades    INTEGER NOT NULL DEFAULT 0,
    winning_trades  INTEGER NOT NULL DEFAULT 0,
    losing_trades   INTEGER NOT NULL DEFAULT 0,
    win_rate        REAL,
    max_drawdown    REAL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Session management
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sessions (
    session_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    session_type    TEXT    NOT NULL CHECK(session_type IN ('TRADING','BACKTEST','PAPER')),
    started_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    ended_at        TEXT,
    status          TEXT    NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','COMPLETED','STOPPED','CRASHED')),
    metadata        TEXT
);

-- ---------------------------------------------------------------------------
-- Health checks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS health_checks (
    health_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    component       TEXT    NOT NULL,
    status          TEXT    NOT NULL CHECK(status IN ('OK','DEGRADED','DOWN')),
    latency_ms      INTEGER,
    details         TEXT,
    checked_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Config audit trail
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS config_audit (
    audit_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key      TEXT    NOT NULL,
    old_value       TEXT,
    new_value       TEXT    NOT NULL,
    changed_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Migration tracking (self-referencing — the runner creates this first)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    version         TEXT    NOT NULL UNIQUE,
    description     TEXT    NOT NULL,
    checksum        TEXT    NOT NULL,
    applied_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    execution_ms    INTEGER
);
