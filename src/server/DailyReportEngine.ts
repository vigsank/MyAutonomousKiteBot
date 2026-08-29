import { AppConfig } from './AppConfig';
import { Ledger } from './Ledger';
import { NewsSentimentEngine } from './NewsSentimentEngine';
import { RiskEngine } from './RiskEngine';
import { LlmManager } from './LlmManager';
import { fetchGlobalMacro, GlobalMacroSnapshot } from './GlobalMacro';
import { logger } from './Logger';
import {
  DailyReport,
  NewsArticle,
  ReportType,
  SymbolRecommendation,
} from './types';
import { computePivots, computeSupportResistance } from './TechnicalIndicators';

/**
 * DailyReportEngine — the Reasoning Layer centerpiece.
 *
 * Generates the 3-stage daily report cycle (pre-open / mid-session / pre-close):
 *   - global macro numbers (Yahoo) + headlines (TinyFish -> Google News RSS),
 *   - per-symbol news sentiment + previous-day performance + holding status,
 *   - a deterministic capital snapshot,
 *   - a comprehensive LLM report (strict JSON) with advisory share/allocation
 *     suggestions that the RiskEngine clamps and enforces.
 *
 * The LLM is a financial advisor / signal source — it suggests numbers, the
 * deterministic RiskEngine decides. The report is persisted to the ledger and
 * returned for the algo to act on. Never throws.
 */
export class DailyReportEngine {
  constructor(
    private readonly config: AppConfig,
    private readonly ledger: Ledger,
    private readonly news: NewsSentimentEngine,
    private readonly risk: RiskEngine,
    private readonly llm: LlmManager,
  ) {}

  /**
   * Generate a report for one stage of the daily cycle.
   * @param asOf  optional YYYY-MM-DD. When set, per-symbol news sentiment is
   *              fetched via the TinyFish time-range filter for that date, so
   *              backtests see the news the bot would have had then (no look-ahead).
   */
  async generate(
    reportType: ReportType,
    symbols: string[],
    now: Date,
    asOf?: string,
    momentumBySymbol?: Map<string, number>,
  ): Promise<DailyReport | null> {
    try {
      const macro = await fetchGlobalMacro(asOf);
      const macroNews = await this.fetchMacroNews(asOf);
      const analyzed = await this.analyzeSymbols(symbols, asOf, momentumBySymbol);
      const capital = this.risk.capitalSnapshot();

      const prompt = this.buildPrompt(reportType, now, macro, macroNews, analyzed, capital);
      const report = await this.askLlm(prompt, reportType);
      if (!report) {
        logger.warn({ reportType }, 'Daily report LLM returned no valid JSON');
        return null;
      }

      // Clamp advisory suggestions to the available capital so the report is
      // never misleading (the RiskEngine enforces the final size regardless).
      const priceMap = new Map(analyzed.map((s) => [s.symbol, s.price]));
      for (const rec of report.portfolio_recommendations) {
        rec.suggested_allocation_inr = Math.min(rec.suggested_allocation_inr, capital.available);
        const price = priceMap.get(rec.symbol) ?? 0;
        if (price > 0) {
          rec.suggested_quantity = Math.min(rec.suggested_quantity, Math.floor(capital.available / price));
        }
      }

      // Persist for audit + review.
      this.ledger.recordDailyReport({
        reportType,
        reportDate: now.toISOString().slice(0, 10),
        reportJson: JSON.stringify(report),
        summary: report.summary,
      });

      return report;
    } catch (err) {
      logger.warn({ reportType, err: err?.message }, 'Daily report generation failed');
      return null;
    }
  }

  /** Global-macro headlines: TinyFish primary, Google News RSS fallback. */
  private async fetchMacroNews(asOf?: string): Promise<NewsArticle[]> {
    const query = 'global market India Dalal Street overnight';
    if (this.news.tinyfishConfigured) {
      // Date-scoped to the rebalance date when backtesting (no look-ahead);
      // otherwise the live query.
      const tf = asOf
        ? await this.news.fetchArticlesForQueryDate(query, asOf).catch(() => [])
        : await this.news.fetchTinyFishArticles(query).catch(() => []);
      if (tf.length > 0) return tf;
    }
    return this.news.fetchGoogleNewsArticles(query).catch(() => []);
  }

  /** Per-symbol context: price, previous-day change, sentiment, momentum, holding status. */
  private async analyzeSymbols(
    symbols: string[],
    asOf?: string,
    momentumBySymbol?: Map<string, number>,
  ): Promise<SymbolContext[]> {
    const out: SymbolContext[] = [];
    for (const symbol of symbols) {
      try {
        const inst = this.ledger.getInstrumentBySymbol(symbol, 'NSE');
        const price = inst?.last_price ?? 0;
        const prevDayChange = this.previousDayChange(symbol);
        // Date-scoped sentiment when backtesting; live sentiment otherwise.
        const sentiment = asOf
          ? (await this.news.sentimentForDate(symbol, asOf).catch(() => null))?.score ?? 0
          : (await this.news.sentimentFor(symbol).catch(() => null))?.score ?? 0;
        const momentum = momentumBySymbol?.get(symbol) ?? null;
        const pos = this.ledger.getPosition(symbol, 'NSE');
        const weightPct = pos && price > 0
          ? (pos.quantity * price / this.config.risk.availableCapital) * 100
          : 0;
        out.push({
          symbol,
          price,
          prevDayChange,
          sentiment,
          momentum,
          holdingStatus: pos ? 'HELD' : 'NONE',
          weightPct,
          pivots: this.pivotsFor(symbol),
          supportResistance: this.supportResistanceFor(symbol),
        });
      } catch (err) {
        logger.warn({ symbol, err: err?.message }, 'Symbol analysis failed');
        out.push({
          symbol, price: 0, prevDayChange: null, sentiment: 0, momentum: null,
          holdingStatus: 'NONE', weightPct: 0, pivots: null, supportResistance: null,
        });
      }
    }
    return out;
  }

  /** Change % of the latest close vs the previous session's close (from candles). */
  private previousDayChange(symbol: string): number | null {
    const days = this.dailyCandles(symbol, 2);
    if (days.length < 2) return null;
    const latest = days[days.length - 1].close;
    const prev = days[days.length - 2].close;
    if (!prev) return null;
    return ((latest - prev) / prev) * 100;
  }

  /** Aggregate intraday candles into daily OHLC (last `days` days). */
  private dailyCandles(symbol: string, days: number): Array<{ high: number; low: number; close: number }> {
    try {
      const rows = this.ledger
        .raw()
        .prepare(
          `SELECT c.high, c.low, c.close, c.timestamp FROM candles c
             JOIN instruments i ON i.instrument_id = c.instrument_id
            WHERE i.tradingsymbol = ? ORDER BY c.timestamp DESC LIMIT 2000`,
        )
        .all(symbol) as Array<{ high: number; low: number; close: number; timestamp: string }>;
      const byDay = new Map<string, { high: number; low: number; close: number }>();
      for (const r of rows) {
        const day = r.timestamp.slice(0, 10);
        const cur = byDay.get(day);
        if (!cur) {
          byDay.set(day, { high: r.high, low: r.low, close: r.close });
        } else {
          cur.high = Math.max(cur.high, r.high);
          cur.low = Math.min(cur.low, r.low);
          cur.close = r.close;
        }
      }
      return [...byDay.values()].slice(-days);
    } catch {
      return [];
    }
  }

  /** Pivot levels from the most recent COMPLETED daily candle, or null. */
  private pivotsFor(symbol: string): ReturnType<typeof computePivots> | null {
    const days = this.dailyCandles(symbol, 2);
    if (days.length < 2) return null;
    const last = days[days.length - 2]; // last completed day (today is incomplete)
    return computePivots(last.high, last.low, last.close);
  }

  /** 7-day support & resistance zones, or null. */
  private supportResistanceFor(symbol: string): ReturnType<typeof computeSupportResistance> | null {
    const days = this.dailyCandles(symbol, 7);
    if (days.length === 0) return null;
    return computeSupportResistance(days, 7);
  }

  private buildPrompt(
    reportType: ReportType,
    now: Date,
    macro: GlobalMacroSnapshot,
    macroNews: NewsArticle[],
    analyzed: SymbolContext[],
    capital: ReturnType<RiskEngine['capitalSnapshot']>,
  ): string {
    const stageLabel =
      reportType === 'pre_open' ? 'PRE-OPEN (09:00 IST)' :
      reportType === 'mid_session' ? 'MID-SESSION (11:00 IST)' : 'END-OF-DAY (15:15 IST)';

    const macroLines = macro.readings.length
      ? macro.readings.map((r) => `- ${r.name}: ${r.price} (${r.changePct >= 0 ? '+' : ''}${r.changePct.toFixed(2)}%)`).join('\n')
      : '- (unavailable)';

    const newsLines = macroNews.length
      ? macroNews.slice(0, 8).map((a) => `- [${a.source}] ${a.title}`).join('\n')
      : '- (no headlines)';

    const symbolLines = analyzed
      .map((s) =>
        `- ${s.symbol}: price ${s.price || 'n/a'}, prev-day ${s.prevDayChange === null ? 'n/a' : s.prevDayChange.toFixed(2) + '%'}, ` +
        `sentiment ${s.sentiment.toFixed(2)}, momentum ${s.momentum === null ? 'n/a' : (s.momentum * 100).toFixed(1) + '%'}, ` +
        `holding ${s.holdingStatus}, weight ${s.weightPct.toFixed(1)}%, ` +
        `pivots ${s.pivots ? `P ${s.pivots.pivot.toFixed(1)} R1 ${s.pivots.r1.toFixed(1)} S1 ${s.pivots.s1.toFixed(1)}` : 'n/a'}, ` +
        `S/R ${s.supportResistance ? `S ${s.supportResistance.support.toFixed(1)} R ${s.supportResistance.resistance.toFixed(1)}` : 'n/a'}`, 
      )
      .join('\n');

    return `You are a disciplined financial advisor for a retail Indian (NSE) equity portfolio. Generate the ${stageLabel} daily report.

GLOBAL MACRO (numbers):
${macroLines}

GLOBAL MACRO HEADLINES:
${newsLines}

CAPITAL SNAPSHOT (INR):
- Total capital: ${capital.total}
- Used in open positions: ${capital.used}
- Pending orders: ${capital.pending}
- Mandatory cash reserve (${this.config.risk.minCashReservePct}%): ${capital.reserve}
- Available for new trades: ${capital.available}
- Risk appetite: ${this.config.risk.riskAppetite}

WATCHLIST SYMBOLS (price, prev-day %, sentiment -1..+1, momentum 12m %, holding, weight % of capital):
${symbolLines}

TASK:
1. Summarise the overall market sentiment and any major events impacting Dalal Street today.
2. For EACH symbol, give an action bias, weighing BOTH the news sentiment AND the 12-month momentum (a bullish-news + strong-momentum name is the highest conviction; a bearish-news + weak-momentum name is the lowest):
   - HELD: HOLD, TRIM_25, TRIM_50, EXIT_FULL, or BUY_ACCUMULATE (add).
   - NOT HELD: CONSIDER_LONG (buy) or AVOID.
3. Suggest an ADVISORY share quantity and allocation (INR) per symbol based on the available capital, price, risk appetite, and diversification. Do NOT deploy all capital — keep the cash reserve and leave room for future opportunities. These are suggestions only; the risk engine enforces the final size.
4. List the top "stocks to watch" for the day (prefer names with both bullish sentiment and positive momentum).
5. Provide a concise, readable summary.

Return STRICT JSON only, no markdown, matching this exact schema:
{
  "report_type": "${reportType}",
  "timestamp": "${now.toISOString()}",
  "market_regime": { "overall_sentiment": "string", "regime_score": number -1..1, "primary_catalyst": "string" },
  "capital_management": { "available_capital": number, "recommended_cash_reserve_pct": number, "suggested_total_deployment_pct": number },
  "stocks_to_watch": ["SYMBOL"],
  "portfolio_recommendations": [
    { "symbol": "SYMBOL", "action_bias": "BUY_ACCUMULATE|CONSIDER_LONG|HOLD|TRIM_25|TRIM_50|EXIT_FULL|AVOID",
      "sentiment_score": number, "current_holding_status": "NONE|HELD",
      "suggested_quantity": number, "suggested_allocation_inr": number,
      "suggested_entry_strategy": "string", "reasoning": "string", "invalidation_condition": "string" }
  ],
  "summary": "concise readable summary"
}`;
  }

  private async askLlm(prompt: string, reportType: ReportType): Promise<DailyReport | null> {
    if (!this.llm.configured) {
      logger.warn({ reportType }, 'LLM not configured — skipping daily report');
      return null;
    }
    const start = Date.now();
    const responses = await this.llm.chatEnsemble(prompt);
    const reports = responses
      .map((r) => validateReportJson(extractJson(r.text)))
      .filter((r): r is DailyReport => r !== null);
    if (reports.length === 0) return null;

    // Consensus: merge recommendations across models rather than trusting the
    // most verbose report (which biases toward hallucination / over-trading).
    const report = mergeReports(reports);

    this.ledger.recordLlmTrace({
      purpose: `daily_report_${reportType}`,
      model: responses.map((r) => r.model).join(','),
      prompt,
      response: responses.map((r) => r.text).join('\n---\n'),
      latencyMs: Date.now() - start,
      tokensIn: null,
      tokensOut: null,
    });
    return report;
  }
}

/** Per-symbol context gathered deterministically before the LLM call. */
interface SymbolContext {
  symbol: string;
  price: number;
  prevDayChange: number | null;
  sentiment: number;
  /** Trailing 12-month momentum (fractional return), or null when unavailable. */
  momentum: number | null;
  holdingStatus: 'NONE' | 'HELD';
  weightPct: number;
  pivots: ReturnType<typeof computePivots> | null;
  supportResistance: ReturnType<typeof computeSupportResistance> | null;
}

/** Parse JSON out of an LLM response, tolerating fences/prose. */
function extractJson(raw: string): unknown {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
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
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Validate the LLM's report JSON against the strict schema. */
function validateReportJson(v: unknown): DailyReport | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.report_type !== 'string') return null;
  if (typeof r.summary !== 'string') return null;

  const regime = r.market_regime as Record<string, unknown> | undefined;
  if (!regime || typeof regime.overall_sentiment !== 'string') return null;

  const capital = r.capital_management as Record<string, unknown> | undefined;
  if (!capital || typeof capital.available_capital !== 'number') return null;

  const recs: SymbolRecommendation[] = [];
  if (Array.isArray(r.portfolio_recommendations)) {
    for (const item of r.portfolio_recommendations) {
      const rec = item as Record<string, unknown>;
      if (typeof rec.symbol !== 'string') continue;
      recs.push({
        symbol: rec.symbol,
        action_bias: (rec.action_bias as SymbolRecommendation['action_bias']) ?? 'HOLD',
        sentiment_score: typeof rec.sentiment_score === 'number' ? rec.sentiment_score : 0,
        current_holding_status: rec.current_holding_status === 'HELD' ? 'HELD' : 'NONE',
        suggested_quantity: typeof rec.suggested_quantity === 'number' ? Math.max(0, Math.floor(rec.suggested_quantity)) : 0,
        suggested_allocation_inr: typeof rec.suggested_allocation_inr === 'number' ? Math.max(0, rec.suggested_allocation_inr) : 0,
        suggested_entry_strategy: typeof rec.suggested_entry_strategy === 'string' ? rec.suggested_entry_strategy : '',
        reasoning: typeof rec.reasoning === 'string' ? rec.reasoning : '',
        invalidation_condition: typeof rec.invalidation_condition === 'string' ? rec.invalidation_condition : '',
      });
    }
  }

  return {
    report_type: r.report_type as ReportType,
    timestamp: typeof r.timestamp === 'string' ? r.timestamp : new Date().toISOString(),
    market_regime: {
      overall_sentiment: regime.overall_sentiment,
      regime_score: typeof regime.regime_score === 'number' ? regime.regime_score : 0,
      primary_catalyst: typeof regime.primary_catalyst === 'string' ? regime.primary_catalyst : '',
    },
    capital_management: {
      available_capital: capital.available_capital,
      recommended_cash_reserve_pct: typeof capital.recommended_cash_reserve_pct === 'number' ? capital.recommended_cash_reserve_pct : 0,
      suggested_total_deployment_pct: typeof capital.suggested_total_deployment_pct === 'number' ? capital.suggested_total_deployment_pct : 0,
    },
    stocks_to_watch: Array.isArray(r.stocks_to_watch) ? r.stocks_to_watch.filter((s): s is string => typeof s === 'string') : [],
    portfolio_recommendations: recs,
    summary: r.summary,
  };
}

/**
 * Merge multiple model reports into one consensus report. Averages numeric
 * fields, takes the majority action bias per symbol, and unions stocks-to-watch
 * — rather than trusting the most verbose report (which biases toward
 * hallucination / over-trading).
 */
function mergeReports(reports: DailyReport[]): DailyReport {
  const base = reports[0];

  const regimeScore =
    reports.reduce((s, r) => s + r.market_regime.regime_score, 0) / reports.length;
  const sentimentCounts = new Map<string, number>();
  for (const r of reports) {
    const s = r.market_regime.overall_sentiment;
    sentimentCounts.set(s, (sentimentCounts.get(s) ?? 0) + 1);
  }
  const overallSentiment =
    [...sentimentCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    base.market_regime.overall_sentiment;
  const catalysts = [
    ...new Set(reports.map((r) => r.market_regime.primary_catalyst).filter(Boolean)),
  ].join(' | ');

  const capital = {
    available_capital:
      reports.reduce((s, r) => s + r.capital_management.available_capital, 0) / reports.length,
    recommended_cash_reserve_pct:
      reports.reduce((s, r) => s + r.capital_management.recommended_cash_reserve_pct, 0) / reports.length,
    suggested_total_deployment_pct:
      reports.reduce((s, r) => s + r.capital_management.suggested_total_deployment_pct, 0) / reports.length,
  };

  const stocksToWatch = [...new Set(reports.flatMap((r) => r.stocks_to_watch))];

  const bySymbol = new Map<string, SymbolRecommendation[]>();
  for (const r of reports) {
    for (const rec of r.portfolio_recommendations) {
      const arr = bySymbol.get(rec.symbol) ?? [];
      arr.push(rec);
      bySymbol.set(rec.symbol, arr);
    }
  }
  const recommendations: SymbolRecommendation[] = [];
  for (const [symbol, recs] of bySymbol) {
    const biasCounts = new Map<string, number>();
    for (const r of recs) biasCounts.set(r.action_bias, (biasCounts.get(r.action_bias) ?? 0) + 1);
    const actionBias =
      [...biasCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'HOLD';
    const first = recs[0];
    recommendations.push({
      symbol,
      action_bias: actionBias as SymbolRecommendation['action_bias'],
      sentiment_score: recs.reduce((s, r) => s + r.sentiment_score, 0) / recs.length,
      current_holding_status: recs.some((r) => r.current_holding_status === 'HELD') ? 'HELD' : 'NONE',
      suggested_quantity: Math.round(recs.reduce((s, r) => s + r.suggested_quantity, 0) / recs.length),
      suggested_allocation_inr: Math.round(recs.reduce((s, r) => s + r.suggested_allocation_inr, 0) / recs.length),
      suggested_entry_strategy: first.suggested_entry_strategy,
      reasoning: recs.map((r) => r.reasoning).filter(Boolean).join(' | '),
      invalidation_condition: first.invalidation_condition,
    });
  }

  return {
    report_type: base.report_type,
    timestamp: base.timestamp,
    market_regime: {
      overall_sentiment: overallSentiment,
      regime_score: regimeScore,
      primary_catalyst: catalysts,
    },
    capital_management: capital,
    stocks_to_watch: stocksToWatch,
    portfolio_recommendations: recommendations,
    summary: base.summary,
  };
}
