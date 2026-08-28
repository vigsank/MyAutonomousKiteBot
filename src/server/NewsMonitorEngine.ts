import { AppConfig } from './AppConfig';
import { Ledger } from './Ledger';
import { NewsSentimentEngine } from './NewsSentimentEngine';
import { MomentumStrategy } from './MomentumStrategy';
import { logger } from './Logger';

/**
 * NewsMonitorEngine (Phase 4.4) — event-driven news monitor.
 *
 * Closes the "monthly gap": a pure monthly-rebalance book is blind to news
 * between rebalances. This engine polls Google News RSS for the watchlist,
 * diffs against a seen-article store, and reacts to NEW news with two paths:
 *
 *   - DEFENSIVE: a HELD symbol with strongly negative news is exited/shrunk
 *     immediately (crash-catch, before the stop-loss drags it out).
 *   - OPPORTUNISTIC: a non-held momentum candidate with positive news gets a
 *     PARTIAL entry (pull-forward of the monthly entry).
 *
 * Momentum stays the originator: the opportunistic path only fires on symbols
 * already in the momentum ranking. The RiskEngine remains the final arbiter.
 *
 * Event-driven: LLM calls scale with news volume, not time. Disabled by default
 * (`NEWS_MONITOR_ENABLED=false`).
 */
export interface NewsMonitorDecision {
  symbol: string;
  action: 'NONE' | 'EXIT' | 'OPPORTUNISTIC_ENTRY';
  sentiment: number;
  reason: string;
}

export class NewsMonitorEngine {
  /** Sentiment above this (positive news) can trigger an opportunistic entry. */
  private static readonly OPPORTUNISTIC_SENTIMENT_FLOOR = 0.3;

  constructor(
    private readonly config: AppConfig,
    private readonly ledger: Ledger,
    private readonly news: NewsSentimentEngine,
    private readonly momentum: MomentumStrategy,
  ) {}

  /**
   * One poll cycle: fetch watchlist news, detect new articles, score sentiment
   * once per symbol with new news, decide, and execute. Returns a summary.
   */
  async poll(now: Date): Promise<{ newArticles: number; decisions: NewsMonitorDecision[] }> {
    if (!this.config.newsMonitor.enabled) return { newArticles: 0, decisions: [] };

    const symbols = this.config.watchlist
      .filter((s) => s.enabled)
      .map((s) => s.tradingsymbol);
    const decisions: NewsMonitorDecision[] = [];
    let newArticles = 0;

    for (const symbol of symbols) {
      const articles = await this.news.fetchGoogleNewsArticles(symbol).catch(() => []);
      const fresh = articles.filter((a) => a.link && !this.ledger.isArticleSeen(symbol, a.link));
      if (fresh.length === 0) continue;

      // Mark all new articles as seen so each story triggers once.
      for (const a of fresh) this.ledger.recordSeenArticle(symbol, a.link!, a.title);
      newArticles += fresh.length;

      // Score the symbol's current news picture once (aggregate), then decide.
      const sentiment = (await this.news.sentimentFor(symbol).catch(() => null))?.score ?? 0;
      const decision = this.decide(symbol, sentiment, now);
      decisions.push(decision);
      this.execute(decision, now);
    }

    return { newArticles, decisions };
  }

  /**
   * Pure decision: given a symbol's current news sentiment, what should happen?
   * Exposed for unit testing.
   */
  decide(symbol: string, sentiment: number, now: Date): NewsMonitorDecision {
    const held = this.ledger.getPosition(symbol, 'NSE');

    // Defensive: a held name with strongly negative news is exited immediately.
    if (held && sentiment < this.config.newsMonitor.sentimentExitThreshold) {
      return {
        symbol,
        action: 'EXIT',
        sentiment,
        reason: `news sentiment ${sentiment.toFixed(2)} < exit threshold ${this.config.newsMonitor.sentimentExitThreshold}`,
      };
    }

    // Opportunistic: a non-held momentum candidate with positive news gets a
    // partial entry (pull-forward). Momentum stays the originator.
    if (
      this.config.newsMonitor.opportunisticEnabled &&
      !held &&
      sentiment >= NewsMonitorEngine.OPPORTUNISTIC_SENTIMENT_FLOOR &&
      this.isMomentumCandidate(symbol)
    ) {
      return {
        symbol,
        action: 'OPPORTUNISTIC_ENTRY',
        sentiment,
        reason: `positive news ${sentiment.toFixed(2)} on momentum candidate`,
      };
    }

    return { symbol, action: 'NONE', sentiment, reason: 'no action' };
  }

  /** True when the symbol is in the current momentum ranking (a candidate). */
  private isMomentumCandidate(symbol: string): boolean {
    try {
      const ranking = this.momentum.lastRanking();
      return ranking.candidates.some((c) => c.symbol === symbol);
    } catch {
      return false;
    }
  }

  /** Execute a decision through the momentum strategy (RiskEngine is the arbiter). */
  private execute(decision: NewsMonitorDecision, now: Date): void {
    if (decision.action === 'NONE') return;
    const price = this.currentPrice(decision.symbol);
    if (!price || price <= 0) {
      logger.warn({ symbol: decision.symbol }, 'NewsMonitor: no price to act on');
      return;
    }
    if (decision.action === 'EXIT') {
      const ok = this.momentum.defensiveExit(decision.symbol, price, now, decision.reason);
      logger.info({ symbol: decision.symbol, ok, reason: decision.reason }, 'NewsMonitor: defensive exit');
    } else if (decision.action === 'OPPORTUNISTIC_ENTRY') {
      const ok = this.momentum.opportunisticEntry(decision.symbol, price, now, decision.reason);
      logger.info({ symbol: decision.symbol, ok, reason: decision.reason }, 'NewsMonitor: opportunistic entry');
    }
  }

  private currentPrice(symbol: string): number | null {
    const inst = this.ledger.getInstrumentBySymbol(symbol, 'NSE');
    return inst?.last_price ?? null;
  }
}
