-- ============================================================================
-- V017: Broker-order snapshots (INDmoney integration)
-- ============================================================================
-- When the bot decides to BUY/SELL but order execution is stubbed (INDmoney
-- data-only mode), the exact broker payload it *would* have sent is persisted
-- here for later audit. This is a SEPARATE audit trail from the paper ledger
-- (`trades`/`orders`), which remains the system of record for P&L.
--
-- `status`:
--   STUBBED — payload built, not sent (shadow/stub mode)
--   SENT    — payload sent to the broker (future live mode)
--   FAILED  — broker rejected the order (future live mode)

CREATE TABLE IF NOT EXISTS broker_order_snapshots (
    snapshot_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    broker        TEXT    NOT NULL,          -- 'kite' | 'indmoney'
    trade_id      TEXT,                      -- back-link to the paper fill
    symbol        TEXT    NOT NULL,
    exchange      TEXT    NOT NULL,
    side          TEXT    NOT NULL,          -- BUY | SELL
    quantity      INTEGER NOT NULL,
    product       TEXT,
    order_type    TEXT,
    price         REAL,
    intent        TEXT,
    payload_json  TEXT    NOT NULL,          -- the exact broker order JSON
    status        TEXT    NOT NULL DEFAULT 'STUBBED',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_broker_snapshots_symbol  ON broker_order_snapshots(symbol);
CREATE INDEX IF NOT EXISTS idx_broker_snapshots_created ON broker_order_snapshots(created_at);
