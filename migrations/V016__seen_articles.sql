-- ============================================================================
-- V016: Seen-article store (event-driven news monitor, Phase 4.4)
-- ============================================================================
-- The news feed poller polls Google News RSS for the watchlist and must only
-- react to NEW articles, not re-trigger on ones it has already seen. This table
-- records every article URL the monitor has processed, per symbol, so a story
-- triggers the AI/strategy exactly once.

CREATE TABLE IF NOT EXISTS seen_articles (
    seen_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol        TEXT    NOT NULL,
    url           TEXT    NOT NULL,
    title         TEXT,
    first_seen_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- A given article URL for a symbol is processed once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_seen_articles_symbol_url
    ON seen_articles(symbol, url);
CREATE INDEX IF NOT EXISTS idx_seen_articles_symbol
    ON seen_articles(symbol);
