import Parser from 'rss-parser';
import { tavily } from '@tavily/core';
import { AppConfig } from './AppConfig';
import { LlmManager } from './LlmManager';
import { logger } from './Logger';
import { AiSentimentJson, NewsArticle, SentimentResult } from './types';

/**
 * Curated Indian financial news RSS feeds. RSS-first approach: deterministic,
 * free, no API keys. The configured LLM (OpenAI or Ollama Cloud) is used only
 * to summarise and score the collected headlines into structured sentiment.
 */
const RSS_FEEDS: Array<{ name: string; url: string }> = [
  { name: 'EconomicTimes', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms' },
  { name: 'Moneycontrol', url: 'https://www.moneycontrol.com/rss/Marketnews.xml' },
  { name: 'BusinessStandard', url: 'https://www.business-standard.com/rss/markets-106.rss' },
  { name: 'NDTVProfit', url: 'https://www.ndtv.com/rss/business/news' },
];

export class NewsSentimentEngine {
  private parser = new Parser();
  private tavilyClient: ReturnType<typeof tavily> | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly llm: LlmManager,
  ) {
    if (config.tavily.enabled) {
      this.tavilyClient = tavily({ apiKey: config.tavily.apiKey });
      logger.info('Tavily enabled (live web search news source).');
    }
  }

  get aiConfigured(): boolean {
    return this.llm.configured;
  }

  get tavilyConfigured(): boolean {
    return this.tavilyClient !== null;
  }

  /** Fetch and aggregate recent headlines mentioning a symbol from all feeds. */
  async fetchArticles(symbol: string): Promise<NewsArticle[]> {
    const keyword = symbol.toUpperCase();
    const results: NewsArticle[] = [];

    for (const feed of RSS_FEEDS) {
      try {
        const parsed = await this.parser.parseURL(feed.url);
        const items = parsed.items ?? [];
        for (const item of items.slice(0, 30)) {
          const title = item.title ?? '';
          if (title.toUpperCase().includes(keyword) || (item.contentSnippet ?? '').toUpperCase().includes(keyword)) {
            results.push({
              title,
              link: item.link ?? feed.url,
              summary: item.contentSnippet,
              pubDate: item.pubDate,
              source: feed.name,
            });
          }
        }
      } catch (err) {
        logger.warn({ feed: feed.name, err }, 'RSS feed fetch failed');
      }
    }

    // Add Tavily live web-search results (if configured).
    const tavilyArticles = await this.fetchTavilyArticles(symbol);
    results.push(...tavilyArticles);

    // De-duplicate by title.
    const seen = new Set<string>();
    const unique: NewsArticle[] = [];
    for (const a of results) {
      if (!seen.has(a.title)) {
        seen.add(a.title);
        unique.push(a);
      }
    }
    return unique.slice(0, 10);
  }

  /** Search the live web via Tavily for recent news on a symbol. */
  async fetchTavilyArticles(symbol: string): Promise<NewsArticle[]> {
    if (!this.tavilyClient) return [];
    try {
      const res = await this.tavilyClient.search(`${symbol} stock news India`, {
        searchDepth: this.config.tavily.searchDepth,
        maxResults: this.config.tavily.maxResults,
        topic: 'news',
        days: 7,
      });
      return (res.results ?? []).map((r) => ({
        title: r.title,
        link: r.url,
        summary: r.content,
        pubDate: r.publishedDate,
        source: 'Tavily',
      }));
    } catch (err) {
      logger.warn({ symbol, err }, 'Tavily search failed');
      return [];
    }
  }

  /** Fetch deeper Tavily details (AI answer + more results) for a symbol. */
  async fetchTavilyDetails(symbol: string): Promise<{ answer?: string; articles: NewsArticle[] }> {
    if (!this.tavilyClient) return { articles: [] };
    try {
      const res = await this.tavilyClient.search(
        `Latest news and developments for ${symbol} stock`,
        {
          searchDepth: 'advanced',
          maxResults: this.config.tavily.maxResults,
          topic: 'news',
          days: 3,
          includeAnswer: true,
        },
      );
      return {
        answer: res.answer,
        articles: (res.results ?? []).map((r) => ({
          title: r.title,
          link: r.url,
          summary: r.content,
          pubDate: r.publishedDate,
          source: 'Tavily',
        })),
      };
    } catch (err) {
      logger.warn({ symbol, err }, 'Tavily details failed');
      return { articles: [] };
    }
  }

  /**
   * Score sentiment for a symbol. Uses the configured LLM (OpenAI / Ollama
   * Cloud) if available; otherwise falls back to a keyword heuristic so the bot
   * still functions without an API key.
   */
  async sentimentFor(symbol: string): Promise<SentimentResult | null> {
    const articles = await this.fetchArticles(symbol);
    if (articles.length === 0) {
      return {
        symbol,
        score: 0,
        label: 'neutral',
        summary: `No recent news found for ${symbol}.`,
        sources: [],
        timestamp: new Date(),
      };
    }

    if (this.aiConfigured) {
      return this.aiSentiment(symbol, articles);
    }
    return this.heuristicSentiment(symbol, articles);
  }

  /** Use the configured LLM to score the news. */
  private async aiSentiment(
    symbol: string,
    articles: NewsArticle[],
  ): Promise<SentimentResult> {
    const headlines = articles
      .map((a) => `- [${a.source}] ${a.title}`)
      .join('\n');

    const prompt = `You are a financial analyst. Analyse the following recent news
headlines for the Indian stock ${symbol}. Return STRICT JSON only, with no
markdown, no extra text:

{"score": number between -1 and 1, "label": "bullish"|"bearish"|"neutral",
 "summary": "one sentence summarising the sentiment and key drivers"}

Headlines:
${headlines}`;

    try {
      const raw = await this.llm.chat(prompt);
      const parsed = extractJson(raw) as AiSentimentJson;
      const score = Math.max(-1, Math.min(1, Number(parsed.score) || 0));

      return {
        symbol,
        score,
        label: parsed.label ?? (score > 0.2 ? 'bullish' : score < -0.2 ? 'bearish' : 'neutral'),
        summary: parsed.summary ?? 'No summary.',
        sources: articles.map((a) => a.link),
        timestamp: new Date(),
      };
    } catch (err) {
      logger.warn({ symbol, err }, 'AI sentiment failed, falling back to heuristic');
      return this.heuristicSentiment(symbol, articles);
    }
  }

  /** Keyword-based fallback that needs no API key. */
  private heuristicSentiment(
    symbol: string,
    articles: NewsArticle[],
  ): SentimentResult {
    const bullishWords = ['surge', 'rally', 'gain', 'up', 'beat', 'profit', 'growth', 'upgrade', 'buy'];
    const bearishWords = ['fall', 'drop', 'down', 'miss', 'loss', 'cut', 'downgrade', 'sell', 'weak', 'crisis'];

    let score = 0;
    let count = 0;
    for (const a of articles) {
      const text = `${a.title} ${a.summary ?? ''}`.toLowerCase();
      for (const w of bullishWords) {
        if (text.includes(w)) {
          score += 1;
          count++;
        }
      }
      for (const w of bearishWords) {
        if (text.includes(w)) {
          score -= 1;
          count++;
        }
      }
    }

    const normalized = count === 0 ? 0 : score / (count || 1) / 2;
    const clamped = Math.max(-1, Math.min(1, normalized));

    return {
      symbol,
      score: clamped,
      label: clamped > 0.2 ? 'bullish' : clamped < -0.2 ? 'bearish' : 'neutral',
      summary: `Heuristic sentiment (${count} keyword hits) across ${articles.length} headlines.`,
      sources: articles.map((a) => a.link),
      timestamp: new Date(),
    };
  }
}

/**
 * Parse JSON out of an LLM response, tolerating markdown code fences and any
 * surrounding prose. Throws if no valid JSON object can be found.
 */
function extractJson(raw: string): unknown {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    /* fall through to tolerant parsing */
  }

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fall through */
    }
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }

  throw new Error('No JSON object found in LLM response.');
}
