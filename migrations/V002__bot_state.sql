-- ============================================================================
-- V002: Generic key-value state store for runtime bot state
-- ============================================================================
-- Used to persist in-memory runtime state that must survive a restart, e.g.
-- the circuit-breaker window (recent trade timestamps + halt-until timestamp).

CREATE TABLE IF NOT EXISTS bot_state (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
