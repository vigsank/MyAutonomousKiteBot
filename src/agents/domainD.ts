import { def } from "./helpers";
import { AgentContext, AgentDef } from "./types";

/**
 * Domain D — sentiment synthesis agents.
 *
 * D1 sentiment        : per-symbol news sentiment scores.
 * D2 sector_rotation  : group symbols by sentiment sign as a rough rotation read.
 * D3 market_breadth   : breadth = (bullish - bearish) / total with a risk label.
 *
 * Note: the orchestrator does not pass dependency payloads into the context, so
 * agents that declare `deps` recompute the same underlying data from the news
 * engine via the shared helper below. The `deps` declaration still guarantees
 * ordering.
 */

/** Per-symbol sentiment score, or null when the engine returns no result. */
async function sentimentScores(ctx: AgentContext): Promise<Record<string, number>> {
  const scores: Record<string, number> = {};
  for (const symbol of ctx.symbols) {
    const result = await ctx.news.sentimentFor(symbol);
    if (result !== null) {
      scores[symbol] = result.score;
    }
  }
  return scores;
}

/** Classify a score into a sentiment bucket. */
function bucket(score: number): "bullish" | "bearish" | "neutral" {
  if (score > 0.1) {
    return "bullish";
  }
  if (score < -0.1) {
    return "bearish";
  }
  return "neutral";
}

export function buildDomainAgents(): AgentDef[] {
  return [
    def(
      "sentiment",
      "Sentiment",
      "D",
      true,
      ["news_feed"],
      async (ctx: AgentContext) => {
        const scores: Record<string, number> = {};
        const labels: Record<string, string> = {};
        let count = 0;
        let sum = 0;
        for (const symbol of ctx.symbols) {
          const result = await ctx.news.sentimentFor(symbol);
          if (result === null) {
            continue;
          }
          scores[symbol] = result.score;
          labels[symbol] = result.label;
          count += 1;
          sum += result.score;
        }
        const avg = count > 0 ? sum / count : 0;
        return {
          summary: `sentiment: scored ${count} of ${ctx.symbols.length} symbol(s); avg score ${avg.toFixed(3)}.`,
          payload: { count, avg, scores, labels },
        };
      },
    ),

    def(
      "sector_rotation",
      "Sector Rotation",
      "D",
      true,
      ["sentiment"],
      async (ctx: AgentContext) => {
        // Read the sentiment agent's published payload — never re-query the news
        // engine (G3: only the `sentiment` agent may touch it).
        const sent = ctx.blackboard.sentiment();
        const scores = sent?.scores ?? {};
        const buckets: Record<string, string[]> = { bullish: [], bearish: [], neutral: [] };
        for (const [symbol, score] of Object.entries(scores)) {
          buckets[bucket(score)].push(symbol);
        }
        return {
          summary: `sector_rotation: ${buckets.bullish.length} bullish, ${buckets.bearish.length} bearish, ${buckets.neutral.length} neutral.`,
          payload: buckets,
        };
      },
    ),

    def(
      "market_breadth",
      "Market Breadth",
      "D",
      true,
      ["sentiment"],
      async (ctx: AgentContext) => {
        const sent = ctx.blackboard.sentiment();
        const scores = sent?.scores ?? {};
        let bullish = 0;
        let bearish = 0;
        for (const score of Object.values(scores)) {
          if (bucket(score) === "bullish") {
            bullish += 1;
          } else if (bucket(score) === "bearish") {
            bearish += 1;
          }
        }
        const total = Object.keys(scores).length;
        const breadth = total > 0 ? (bullish - bearish) / total : 0;
        const label = breadth > 0.2 ? "risk-on" : breadth < -0.2 ? "risk-off" : "neutral";
        return {
          summary: `market_breadth: breadth ${breadth.toFixed(3)} (${label}).`,
          payload: { breadth, label, bullish, bearish, total },
        };
      },
    ),
  ];
}
