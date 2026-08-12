-- ============================================================================
-- V005: instruments.last_price
-- ============================================================================
-- The RiskEngine's drawdown (which includes unrealized PnL on open positions)
-- reads each instrument's latest price. Add a `last_price` column that the live
-- tick loop updates, so open losses are visible before a position is closed.

ALTER TABLE instruments ADD COLUMN last_price REAL NOT NULL DEFAULT 0;
