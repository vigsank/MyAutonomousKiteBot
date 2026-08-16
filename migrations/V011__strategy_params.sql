-- ============================================================================
-- V011: Strategy parameter store (feedback / learning loop)
-- ============================================================================
-- Persists tunable strategy parameters so a periodic optimizer can update them
-- and the strategy can read them at startup (with config fallback). This is the
-- feedback loop: the strategy adapts based on out-of-sample validation.

CREATE TABLE IF NOT EXISTS strategy_params (
    param_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    param_key   TEXT    NOT NULL UNIQUE,
    param_value TEXT    NOT NULL,
    source      TEXT    NOT NULL DEFAULT 'optimizer',
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
