-- ============================================================================
-- V003: Options persistence
-- ============================================================================
-- Persist paper option positions and fills so option exposure is visible to the
-- RiskEngine and survives a restart (previously in-memory only).

CREATE TABLE IF NOT EXISTS option_positions (
    option_position_id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol            TEXT    NOT NULL,
    type              TEXT    NOT NULL CHECK(type IN ('CE','PE')),
    strike            REAL    NOT NULL,
    premium           REAL    NOT NULL,
    lot_size          INTEGER NOT NULL,
    days_to_expiry    INTEGER NOT NULL,
    expiry            TEXT    NOT NULL,
    quantity          INTEGER NOT NULL,
    entry_premium     REAL    NOT NULL,
    entry_time        TEXT    NOT NULL,
    status            TEXT    NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED')),
    exit_time         TEXT,
    exit_premium      REAL,
    realized_pnl      REAL
);

CREATE INDEX IF NOT EXISTS idx_option_positions_symbol
    ON option_positions(symbol, status);

CREATE TABLE IF NOT EXISTS option_fills (
    option_fill_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol          TEXT    NOT NULL,
    type            TEXT    NOT NULL,
    strike          REAL    NOT NULL,
    quantity        INTEGER NOT NULL,
    premium         REAL    NOT NULL,
    total_premium   REAL    NOT NULL,
    pnl             REAL    NOT NULL DEFAULT 0,
    reason          TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_option_fills_ts ON option_fills(created_at);
