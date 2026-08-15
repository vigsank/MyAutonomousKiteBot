-- ============================================================================
-- V010: Position entry mode (for mode-specific exits)
-- ============================================================================
-- Stores the strategy mode that opened a position so checkExit can apply the
-- correct exit logic (trend-break / trailing stop) even in regime-adaptive mode.

ALTER TABLE positions ADD COLUMN entry_mode TEXT;
