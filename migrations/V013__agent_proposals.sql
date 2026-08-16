-- ============================================================================
-- V013: Agent proposals + shadow book
-- ============================================================================
-- Records every trade proposal the strategist produces, tagged with which layer
-- ORIGINATED it:
--
--   MOMENTUM     - from the walk-forward validated cross-sectional momentum
--                  edge. Eligible for execution.
--   AI_COMPOSITE - originated by the AI composite score, whose weights have
--                  never been validated and whose technical leg belongs to the
--                  same family that failed walk-forward at -33.5%. Recorded but
--                  NEVER executed.
--
-- The point of the shadow rows is to make the "should AI be allowed to
-- originate trades?" question answerable with evidence instead of opinion. At
-- ~48 trades/year the only honest way to earn that authority is to log
-- hypothetical entries now and compare realized outcomes over 12-18 months.
--
-- `executed` distinguishes a proposal that actually reached the broker/paper
-- ledger from one that was vetoed, risk-rejected, or shadow-only.

CREATE TABLE IF NOT EXISTS agent_proposals (
    proposal_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    symbol        TEXT    NOT NULL,
    -- MOMENTUM | AI_COMPOSITE
    originator    TEXT    NOT NULL,
    direction     TEXT    NOT NULL,
    quantity      INTEGER NOT NULL,
    entry_price   REAL    NOT NULL,
    -- Size multiplier the AI layer applied: 1 = untouched, 0 = vetoed.
    ai_tilt       REAL    NOT NULL DEFAULT 1,
    risk_score    REAL,
    thesis        TEXT    NOT NULL,
    -- 1 when this proposal actually executed; 0 for shadow/vetoed/rejected.
    executed      INTEGER NOT NULL DEFAULT 0,
    -- Why it did not execute (veto reason, risk reasons, or SHADOW).
    outcome       TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_proposals_created
    ON agent_proposals(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_proposals_originator
    ON agent_proposals(originator, executed);
