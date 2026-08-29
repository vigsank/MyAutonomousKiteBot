-- ============================================================================
-- V018: INDmoney rate-limit state (persisted daily counter)
-- ============================================================================
-- The INDmoney rate limiter enforces a per-day request budget. This table
-- persists the daily counter so a bot restart mid-day does NOT reset the budget
-- (which would let a crash-loop silently exceed the 100,000/day limit).

CREATE TABLE IF NOT EXISTS indmoney_rate_state (
    day_key    TEXT    PRIMARY KEY,          -- YYYY-MM-DD (IST)
    count      INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
