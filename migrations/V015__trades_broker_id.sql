-- ============================================================================
-- V015: broker_order_id on trades (Phase E follow-on)
-- ============================================================================
-- V012 added `broker_order_id` to `orders`. LiveTrader.setBrokerOrderIdForTrade
-- back-links the broker's order id to the *fill* (a row in `trades`) so the
-- reconciliation path can match a ledger fill to the broker's order. Add the
-- same column to `trades` so that method has a home.

ALTER TABLE trades ADD COLUMN broker_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_trades_broker_id ON trades(broker_order_id);
