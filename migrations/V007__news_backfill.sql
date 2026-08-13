-- ============================================================================
-- V007: news backfill tracking
-- ============================================================================
-- Records which (symbol, date) pairs have been backfilled from the live web
-- (date-scoped TinyFish/Tavily search) so a gap is reconciled once, not on
-- every pass. The corpus is forward-accumulating; this lets it self-heal gaps
-- for any date that was queried but returned empty.

CREATE TABLE IF NOT EXISTS news_backfill (
  symbol        TEXT NOT NULL,
  backfill_date TEXT NOT NULL,          -- YYYY-MM-DD
  backfilled_at TEXT NOT NULL,          -- ISO-8601 UTC
  source        TEXT,                   -- tinyfish | tavily
  article_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (symbol, backfill_date)
);
CREATE INDEX IF NOT EXISTS idx_news_backfill_date ON news_backfill(backfill_date);
