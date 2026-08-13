import * as crypto from "crypto";
import { logger } from "../server/Logger";
import { AgentContext, AgentResult } from "./types";

/** The three scheduled probe windows of the trading day. */
export type ProbeRunType = "pre_open" | "mid_session" | "pre_close";

/**
 * Run a scheduled probe for a single symbol:
 *  - fetches recent news + optionally the top article's page content,
 *  - scores sentiment,
 *  - persists every article (deduped) and a probe-run record to the ledger,
 *  - returns a well-formed AgentResult and never throws.
 */
export async function runProbe(
  ctx: AgentContext,
  runType: ProbeRunType,
  symbol: string,
): Promise<AgentResult> {
  const start = Date.now();
  const runId = crypto.randomUUID();
  try {
    const articles = await ctx.news.fetchArticles(symbol);
    const top = articles.slice(0, 1);

    // Best-effort page content for the single most recent article only.
    let topContent: string | null = null;
    if (top.length > 0 && top[0].link) {
      topContent = await ctx.news.fetchPage(top[0].link);
    }

    for (const a of articles) {
      const isTop = a === top[0];
      ctx.ledger.recordNewsArticle({
        runId,
        symbol,
        source: a.source,
        title: a.title,
        link: a.link,
        summary: a.summary,
        fullContent: isTop && topContent ? topContent : undefined,
        contentSource: isTop && topContent ? "page" : undefined,
      });
    }

    const sentiment = await ctx.news.sentimentFor(symbol);
    const dayBias = sentiment
      ? sentiment.score > 0.15
        ? "bullish"
        : sentiment.score < -0.15
          ? "bearish"
          : "neutral"
      : "neutral";
    const verdict = sentiment
      ? `${symbol} day bias ${dayBias} (${sentiment.score.toFixed(2)}): ${sentiment.summary}`
      : `${symbol}: no sentiment data`;
    const meta = JSON.stringify({
      articleCount: articles.length,
      sources: sentiment ? sentiment.sources : [],
    });

    ctx.ledger.recordProbeRun({
      runId,
      runType,
      symbol,
      runAt: ctx.now.toISOString(),
      dayBias,
      verdict,
      summary: `${runType} probe: ${articles.length} articles, bias ${dayBias}`,
      meta,
    });

    return {
      id: "news_feed",
      status: "done",
      startedAt: new Date(start),
      durationMs: Date.now() - start,
      summary: `${runType} probe ${symbol}: ${articles.length} articles, bias ${dayBias}`,
      payload: { runId, runType, symbol, dayBias, verdict, articleCount: articles.length },
    };
  } catch (err) {
    logger.warn({ runType, symbol, err }, "probe agent failed");
    return {
      id: "news_feed",
      status: "failed",
      startedAt: new Date(start),
      durationMs: Date.now() - start,
      summary: `probe ${runType} ${symbol}: ${String(err)}`,
    };
  }
}
