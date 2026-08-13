-- ============================================================================
-- V006: probe runs + news articles persistence
-- ============================================================================
-- Persists every probe result (timestamp, link, summary, full page content,
-- content source) so any agent can later run an overall summary / pattern run
-- (e.g. "what news preceded this symbol's moves") without re-fetching the web.

CREATE TABLE IF NOT EXISTS probe_runs (
  run_id   TEXT PRIMARY KEY,            -- uuid
  run_type TEXT NOT NULL,               -- pre_open | mid_session | pre_close | manual
  symbol   TEXT NOT NULL,
  run_at   TEXT NOT NULL,               -- ISO-8601 UTC
  day_bias TEXT,                        -- bullish | bearish | neutral
  verdict  TEXT,                        -- strong verdict text
  summary  TEXT,
  meta     TEXT                         -- JSON: markets read, sector strength, etc.
);
CREATE INDEX IF NOT EXISTS idx_probe_runs_symbol_time ON probe_runs(symbol, run_at);

CREATE TABLE IF NOT EXISTS news_articles (
  article_id     TEXT PRIMARY KEY,      -- sha1 of dedup_key
  run_id         TEXT,                  -- FK probe_runs.run_id (soft)
  symbol         TEXT NOT NULL,
  source         TEXT NOT NULL,         -- tinyfish | rss | tavily | google_news
  title          TEXT NOT NULL,
  link           TEXT,
  summary        TEXT,
  full_content   TEXT,                  -- fetched page content (markdown)
  content_source TEXT,                  -- tinyfish_fetch | rss_snippet | null
  content_len    INTEGER,
  published_at   TEXT,
  fetched_at     TEXT NOT NULL,
  dedup_key      TEXT NOT NULL UNIQUE   -- sha1 of normalized title
);
CREATE INDEX IF NOT EXISTS idx_news_symbol_time ON news_articles(symbol, fetched_at);
CREATE INDEX IF NOT EXISTS idx_news_source ON news_articles(source);
