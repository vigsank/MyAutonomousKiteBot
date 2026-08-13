import { AgentContext } from "./types";

/**
 * On-demand news backfill — invoked when a historical news query for a
 * (symbol, date) returns empty. Runs a date-scoped TinyFish search and fills
 * the corpus. Best-effort: the live index may not retain every article from
 * that date, so it fills the gap with what is still findable.
 *
 * Returns the number of articles newly persisted (0 if already backfilled or
 * no results). Never throws.
 */
export async function backfillNews(
  ctx: AgentContext,
  symbol: string,
  date: string, // YYYY-MM-DD
): Promise<number> {
  if (ctx.ledger.isBackfilled(symbol, date)) return 0;
  const articles = await ctx.news.fetchArticlesForDate(symbol, date).catch(() => []);
  let inserted = 0;
  for (const a of articles) {
    if (
      ctx.ledger.recordNewsArticle({
        runId: ctx.probeRunId,
        symbol,
        source: a.source,
        title: a.title,
        link: a.link,
        summary: a.summary,
        publishedAt: a.pubDate,
      })
    ) {
      inserted++;
    }
  }
  ctx.ledger.recordBackfill(symbol, date, "tinyfish", articles.length);
  return inserted;
}
