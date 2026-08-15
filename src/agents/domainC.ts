import { def } from "./helpers";
import { AgentContext, AgentDef } from "./types";
import { NewsArticle } from "../server/types";

/** Bounded concurrency for parallel symbol fetches (avoids hammering rate limits). */
const CONCURRENCY = 4;
/** Per-symbol overall timeout so a hung feed can't stall the whole pass. */
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Module-level cache keyed by pass + symbol so news_feed and web_search_news
 * don't re-fetch the same symbol's articles twice within a single pass.
 */
const articleCache = new Map<string, NewsArticle[]>();
let cachedPassNumber: number | null = null;

/** Reset the cache whenever a new pass begins (bounds memory across passes). */
function beginPass(passNumber: number): void {
  if (cachedPassNumber !== passNumber) {
    articleCache.clear();
    cachedPassNumber = passNumber;
  }
}

function cacheKey(passNumber: number, symbol: string): string {
  return `${passNumber}:${symbol}`;
}

/** Bound a promise so a slow/hung fetch can't stall the whole pass. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("fetch timed out")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Run `fn` over items with bounded concurrency (Promise.all over chunks). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    results.push(...(await Promise.all(chunk.map(fn))));
  }
  return results;
}

/** Persist fetched articles to the news_articles corpus (deduped by title). */
function persistArticles(ctx: AgentContext, symbol: string, articles: NewsArticle[]): number {
  let inserted = 0;
  for (const a of articles) {
    if (ctx.ledger.recordNewsArticle({
      runId: ctx.probeRunId,
      symbol,
      source: a.source,
      title: a.title,
      link: a.link,
      summary: a.summary,
      publishedAt: a.pubDate,
    })) {
      inserted++;
    }
  }
  return inserted;
}

/**
 * Domain C — fundamental & context agents.
 *
 * C1 news_feed          : RSS/news-feed article counts per symbol.
 * C2 web_search_news    : free web-search (TinyFish) article counts per symbol.
 * C3 earnings_calendar  : stub — LLM agentic search (open-ended).
 * C4 macro_sentiment    : stub — LLM agentic search (open-ended).
 * C5 analyst_ratings    : stub — LLM agentic search (open-ended).
 */
export function buildDomainAgents(): AgentDef[] {
  return [
    def(
      "news_feed",
      "News Feed",
      "C",
      true,
      [],
      async (ctx: AgentContext) => {
        beginPass(ctx.passNumber);
        const counts: Record<string, number> = {};
        let total = 0;
        let persisted = 0;
        const results = await mapLimit(ctx.symbols, CONCURRENCY, async (symbol) => {
          const key = cacheKey(ctx.passNumber, symbol);
          let articles = articleCache.get(key);
          if (!articles) {
            articles = await withTimeout(ctx.news.fetchArticles(symbol), FETCH_TIMEOUT_MS).catch(() => []);
            articleCache.set(key, articles);
          }
          return { symbol, count: articles.length, inserted: persistArticles(ctx, symbol, articles) };
        });
        for (const r of results) {
          counts[r.symbol] = r.count;
          total += r.count;
          persisted += r.inserted;
        }
        return {
          summary: `news_feed: fetched ${total} article(s) across ${ctx.symbols.length} symbol(s), persisted ${persisted} new.`,
          payload: { counts, total, persisted },
        };
      },
    ),

    def(
      "web_search_news",
      "Web Search News",
      "C",
      true,
      [],
      async (ctx: AgentContext) => {
        beginPass(ctx.passNumber);
        const counts: Record<string, number> = {};
        let total = 0;
        let persisted = 0;
        const results = await mapLimit(ctx.symbols, CONCURRENCY, async (symbol) => {
          const key = cacheKey(ctx.passNumber, symbol);
          let articles = articleCache.get(key);
          if (!articles) {
            articles = await withTimeout(
              (async () => {
                let found = await ctx.news.fetchTinyFishArticles(symbol);
                if (found.length === 0) {
                  found = await ctx.news.fetchGoogleNewsArticles(symbol);
                }
                return found;
              })(),
              FETCH_TIMEOUT_MS,
            ).catch(() => []);
            articleCache.set(key, articles);
          }
          return { symbol, count: articles.length, inserted: persistArticles(ctx, symbol, articles) };
        });
        for (const r of results) {
          counts[r.symbol] = r.count;
          total += r.count;
          persisted += r.inserted;
        }
        return {
          summary: `web_search_news: fetched ${total} article(s) via web search across ${ctx.symbols.length} symbol(s), persisted ${persisted} new.`,
          payload: { counts, total, persisted },
        };
      },
    ),

    def(
      "earnings_calendar",
      "Earnings Calendar",
      "C",
      true,
      [],
      async (ctx: AgentContext) => {
        return {
          summary:
            "earnings_calendar: earnings/announcement calendar is LLM agentic search (open-ended) — stub only.",
          payload: { symbols: ctx.symbols },
        };
      },
    ),

    def(
      "macro_sentiment",
      "Macro Sentiment",
      "C",
      true,
      [],
      async (ctx: AgentContext) => {
        return {
          summary:
            "macro_sentiment: macro/market sentiment is LLM agentic search (open-ended) — stub only.",
          payload: { symbolCount: ctx.symbols.length },
        };
      },
    ),

    def(
      "analyst_ratings",
      "Analyst Ratings",
      "C",
      true,
      [],
      async () => {
        return {
          summary:
            "analyst_ratings: analyst ratings/consensus is LLM agentic search (open-ended) — stub only.",
        };
      },
    ),
  ];
}
