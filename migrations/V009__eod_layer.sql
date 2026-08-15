-- ============================================================================
-- V009: End-of-Day layer
-- ============================================================================
-- 1. Adds a `product` column to positions so intraday (MIS) positions can be
--    force-squared-off at close while swing (CNC) positions are kept for the
--    overnight holding matrix.
-- 2. Adds an `eod_performance` table to log daily prediction/execution metrics.

ALTER TABLE positions ADD COLUMN product TEXT NOT NULL DEFAULT 'CNC';

CREATE TABLE IF NOT EXISTS eod_performance (
    eod_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    report_date         TEXT    NOT NULL,
    realized_pnl        REAL    NOT NULL DEFAULT 0,
    total_trades        INTEGER NOT NULL DEFAULT 0,
    winning_trades      INTEGER NOT NULL DEFAULT 0,
    losing_trades       INTEGER NOT NULL DEFAULT 0,
    win_rate            REAL,
    slippage_total      REAL    NOT NULL DEFAULT 0,
    execution_accuracy  REAL,
    summary             TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eod_performance_date ON eod_performance(report_date);

CREATE TABLE IF NOT EXISTS overnight_matrix (
    matrix_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    report_date     TEXT    NOT NULL,
    symbol          TEXT    NOT NULL,
    gap_risk_pct    REAL,
    flagged         INTEGER NOT NULL DEFAULT 0,
    events          TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_overnight_matrix_date ON overnight_matrix(report_date);
