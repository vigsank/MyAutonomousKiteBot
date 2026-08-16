-- ============================================================================
-- V012: Live-trading readiness (Phase E)
-- ============================================================================
-- E1 Order idempotency:
--   `order_intents` is an atomic claim ledger. Before a trade is executed the
--   OrderGuard *claims* a deterministic key (symbol + side + intent + time
--   bucket) with INSERT ... ON CONFLICT DO NOTHING. Because the claim happens
--   BEFORE execution, a retry, duplicate scheduler tick, or process restart
--   mid-flight can never place the same order twice.
--   `orders.idempotency_key` back-links the resulting fill to its claim, and
--   `orders.broker_order_id` stores the id Kite returns once an order is live.
--
-- E2 Broker reconciliation:
--   `reconciliation_log` records every ledger-vs-broker comparison so drift is
--   auditable rather than silently corrected.

ALTER TABLE orders ADD COLUMN idempotency_key TEXT;
ALTER TABLE orders ADD COLUMN broker_order_id  TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_broker_id   ON orders(broker_order_id);

CREATE TABLE IF NOT EXISTS order_intents (
    intent_key  TEXT    PRIMARY KEY,
    symbol      TEXT    NOT NULL,
    side        TEXT    NOT NULL,
    quantity    INTEGER NOT NULL,
    intent      TEXT    NOT NULL,
    -- CLAIMED | EXECUTED | ABANDONED
    status      TEXT    NOT NULL DEFAULT 'CLAIMED',
    claimed_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    settled_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_intents_claimed ON order_intents(claimed_at);

CREATE TABLE IF NOT EXISTS reconciliation_log (
    recon_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    -- OK | DRIFT | ERROR
    status       TEXT    NOT NULL,
    symbol       TEXT,
    -- MISSING_AT_BROKER | MISSING_IN_LEDGER | QUANTITY_MISMATCH | PRICE_DRIFT
    issue        TEXT,
    ledger_qty   INTEGER,
    broker_qty   INTEGER,
    ledger_price REAL,
    broker_price REAL,
    detail       TEXT
);

CREATE INDEX IF NOT EXISTS idx_recon_run_at ON reconciliation_log(run_at);
