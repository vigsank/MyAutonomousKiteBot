-- ============================================================================
-- V004: LLM trace observability
-- ============================================================================
-- Lightweight LangSmith-style tracing: record every LLM call (sentiment,
-- analyst verdict) with prompt, response, model, latency and token usage so you
-- can inspect WHY the agent made a decision.

CREATE TABLE IF NOT EXISTS llm_traces (
    llm_trace_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    purpose       TEXT    NOT NULL,
    symbol        TEXT,
    model         TEXT    NOT NULL,
    prompt        TEXT    NOT NULL,
    response      TEXT    NOT NULL,
    latency_ms    INTEGER NOT NULL,
    tokens_in     INTEGER,
    tokens_out    INTEGER,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_llm_traces_ts ON llm_traces(created_at);
CREATE INDEX IF NOT EXISTS idx_llm_traces_purpose ON llm_traces(purpose);
