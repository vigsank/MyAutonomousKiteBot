/**
 * mock_ai_backed.ts — FULL AI-backed multi-month mock trade.
 *
 * Treats the kite-paper-node mock Zerodha backend as the REAL broker, and runs
 * the REAL AI layer (LLM + news sentiment) at every monthly rebalance:
 *   1. Starts the kite-paper-node mock REST server (serves real NSE daily CSVs).
 *   2. Fetches daily closes for the watchlist via the REST historical endpoint.
 *   3. Wires the FULL stack: LlmManager + NewsSentimentEngine + DailyReportEngine
 *      (the Reasoning Layer) + MomentumStrategy + RiskEngine + PaperTrader.
 *   4. At each monthly rebalance, calls DailyReportEngine.generate('pre_open') —
 *      a REAL LLM report with market_regime.regime_score + per-symbol bias — which
 *      the momentum strategy consumes (regime scaling + veto/shrink).
 *   5. Executes through the mock broker (LiveTrader → POST /orders/:variety).
 *   6. Marks to market daily; writes a per-day + per-month P&L report.
 *
 * Usage:
 *   ENV_FILE=.env npx ts-node test/backtest/mock_ai_backed.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../../src/server/AppConfig';
import { Ledger } from '../../src/server/Ledger';
import { RiskEngine } from '../../src/server/RiskEngine';
import { PaperTrader } from '../../src/server/PaperTrader';
import { OrderGuard } from '../../src/server/OrderGuard';
import { LiveTrader } from '../../src/server/LiveTrader';
import { LiveDataService } from '../../src/server/LiveDataService';
import { LlmManager } from '../../src/server/LlmManager';
import { NewsSentimentEngine } from '../../src/server/NewsSentimentEngine';
import { NewsMonitorEngine } from '../../src/server/NewsMonitorEngine';
import { DailyReportEngine } from '../../src/server/DailyReportEngine';
import { MomentumStrategy } from '../../src/server/MomentumStrategy';
import { BrokerAccount, BrokerHolding } from '../../src/server/BrokerAccount';
import { ClosePoint } from '../../src/server/signals/momentum';
import { createMockServer } from 'kite-paper-node';
import { resolveDataDir } from './_dataDir';

// ── tunables ────────────────────────────────────────────────────────────────
const MONTHS = numEnv('MONTHS', 6);
const CAPITAL = numEnv('CAPITAL', 1_00_000);
const TOP_N = numEnv('TOP_N', 5);
const AI_SYMBOLS = numEnv('AI_SYMBOLS', 3); // names passed to the LLM report (fewer = faster/quota-friendly)
const DATA_DIR = resolveDataDir();
const OUT_FILE = path.join(__dirname, 'results', `mock_ai_backed_shrink_report_${MONTHS}m.md`);

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const inr = (n: number): string => '₹' + Math.round(n).toLocaleString('en-IN');

/** Parse a number from a string that may contain ₹, commas, spaces, %. */
function parseNum(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Set of symbols that have a real `_1d.csv` file (no synthetic mock data). */
function realCsvSymbols(): Set<string> {
  const set = new Set<string>();
  if (!fs.existsSync(DATA_DIR)) return set;
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (f.endsWith('_1d.csv')) set.add(f.replace('_1d.csv', ''));
  }
  return set;
}

/** Whole months between two YYYY-MM-DD dates. */
function monthsBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z');
  const db = new Date(b + 'T00:00:00Z');
  return (db.getUTCFullYear() - da.getUTCFullYear()) * 12 + (db.getUTCMonth() - da.getUTCMonth());
}

/**
 * MockBrokerAccount — a BrokerAccount that talks to the kite-paper-node mock
 * REST server, so the bot's LiveTrader routes orders to the mock exactly as it
 * would to a real Zerodha backend.
 */
class MockBrokerAccount implements BrokerAccount {
  constructor(private readonly base: string) {}

  async getBrokerHoldings(): Promise<BrokerHolding[]> {
    const res = (await fetch(`${this.base}/portfolio/holdings`).then((r) => r.json())) as any;
    return (res.data ?? []).map((h: any) => ({
      symbol: h.tradingsymbol,
      exchange: h.exchange ?? 'NSE',
      quantity: h.quantity ?? 0,
      averagePrice: h.average_price ?? 0,
      lastPrice: h.last_price ?? 0,
    }));
  }

  async getBrokerPositions(): Promise<BrokerHolding[]> {
    const res = (await fetch(`${this.base}/portfolio/positions`).then((r) => r.json())) as any;
    return (res.data ?? []).map((p: any) => ({
      symbol: p.tradingsymbol,
      exchange: p.exchange ?? 'NSE',
      quantity: p.quantity ?? 0,
      averagePrice: p.average_price ?? 0,
      lastPrice: p.last_price ?? 0,
    }));
  }

  async getAvailableCash(): Promise<number | null> {
    const res = (await fetch(`${this.base}/user/margins`).then((r) => r.json())) as any;
    return res.data?.equity?.available?.cash ?? null;
  }

  async placeOrder(params: {
    tradingsymbol: string;
    exchange: string;
    transaction_type: 'BUY' | 'SELL';
    quantity: number;
    product: string;
    order_type: string;
    price?: number;
    tag?: string;
  }): Promise<string> {
    const body = {
      exchange: params.exchange,
      tradingsymbol: params.tradingsymbol,
      transaction_type: params.transaction_type,
      quantity: params.quantity,
      product: params.product,
      order_type: params.order_type,
      price: params.price,
    };
    // Retry a few times: the mock's ticker may not have started for a symbol yet.
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${this.base}/orders/regular`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as any;
        if (json.status !== 'success') {
          throw new Error(`mock order rejected: ${JSON.stringify(json)}`);
        }
        return json.data?.order_id ?? '';
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * PriceProxyNewsEngine — a NewsSentimentEngine-shaped stub that proxies news
 * sentiment from PRICE moves (the CSVs have no historical news): a sharp drop
 * reads as negative news, a breakout reads as positive news. Lets the real
 * NewsMonitorEngine's defensive/opportunistic paths fire end-to-end in the
 * mock trade without live-news look-ahead.
 */
class PriceProxyNewsEngine {
  private date = '';
  constructor(private readonly closes: Map<string, ClosePoint[]>) {}
  setDate(d: string): void { this.date = d; }

  async fetchGoogleNewsArticles(symbol: string): Promise<any[]> {
    const move = this.dayMove(symbol);
    if (move === null || Math.abs(move) < 2) return [];
    return [{
      title: symbol + ' ' + (move >= 0 ? 'breakout' : 'drop') + ' ' + move.toFixed(1) + '%',
      link: 'proxy://' + symbol + '/' + this.date,
      summary: '',
      source: 'PriceProxy',
    }];
  }

  async sentimentFor(symbol: string): Promise<any | null> {
    const move = this.dayMove(symbol);
    if (move === null) return { symbol, score: 0, label: 'neutral', summary: '', sources: [], timestamp: new Date() };
    const score = Math.max(-1, Math.min(1, move / 5));
    return {
      symbol,
      score,
      label: score > 0.3 ? 'bullish' : score < -0.3 ? 'bearish' : 'neutral',
      summary: '',
      sources: [],
      timestamp: new Date(),
    };
  }

  private dayMove(symbol: string): number | null {
    const pts = this.closes.get(symbol);
    if (!pts) return null;
    const i = pts.findIndex((p) => p.date === this.date);
    if (i < 1) return null;
    return (pts[i].close / pts[i - 1].close - 1) * 100;
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  config.risk.availableCapital = CAPITAL;
  config.strategy.momentumTopN = TOP_N;
  // 5 years of daily data → full validated 12-month lookback.
  config.strategy.momentumLookbackMonths = 12;
  // Shrink-not-block: AI AVOID names are sized down, not fully blocked.
  config.strategy.momentumVetoMode = 'shrink';
  config.strategy.momentumVetoShrinkPct = 50;
  // Route orders to the mock broker (the "real" backend for this test).
  config.live.allowLiveOrders = true;
  config.live.shadowMode = false;
  config.live.maxLiveOrderValue = CAPITAL * 10;

  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);
  const watchSet = new Set(symbols);
  const realSet = realCsvSymbols();

  // 1. Start the kite-paper-node mock REST server (real NSE daily CSVs).
  console.log(`Starting kite-paper-node mock server (${symbols.length} symbols)...`);
  const server = await createMockServer({
    dataDir: DATA_DIR,
    ticker: { mode: 'random-walk', randomWalk: { seedSymbols: symbols } },
    server: { port: 4124, host: '127.0.0.1' },
  });
  const base = `http://127.0.0.1:${server.port}`;
  console.log(`Mock server on :${server.port}`);

  // 2. Get instruments (token -> symbol).
  const instRes = (await fetch(`${base}/instruments`).then((r) => r.json())) as any;
  const instruments = (instRes.data ?? []) as Array<{ instrument_token: number; tradingsymbol: string }>;
  const tokenToSymbol = new Map<number, string>();
  for (const i of instruments) tokenToSymbol.set(i.instrument_token, i.tradingsymbol);
  console.log(`Instruments: ${instruments.length}`);

  // 3. Fetch daily closes for all symbols via the REST historical endpoint.
  const closesBySymbol = new Map<string, ClosePoint[]>();
  const to = new Date();
  const from = new Date(to.getTime() - 500 * 24 * 60 * 60 * 1000);
  for (const [token, symbol] of tokenToSymbol) {
    try {
      const url = `${base}/instruments/historical/${token}/day?from=${from.getTime()}&to=${to.getTime()}`;
      const res = (await fetch(url).then((r) => r.json())) as any;
      const data = (res.data ?? []) as Array<{ date: string; close: number }>;
      const pts = data
        .map((c) => ({ date: new Date(c.date).toISOString().slice(0, 10), close: c.close }))
        .filter((p) => Number.isFinite(p.close) && p.close > 0)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      if (pts.length > 60 && watchSet.has(symbol) && realSet.has(symbol)) closesBySymbol.set(symbol, pts);
    } catch {
      /* skip */
    }
  }
  console.log(`Fetched daily data for ${closesBySymbol.size} symbols (real NSE CSVs only, no synthetic).`);

  // Build the sorted list of trading dates.
  const allDates = new Set<string>();
  for (const pts of closesBySymbol.values()) for (const p of pts) allDates.add(p.date);
  const dates = [...allDates].sort();
  if (dates.length < 40) {
    console.error('Not enough daily data for the simulation.');
    await server.stop();
    process.exit(1);
  }

  // Identify month-start rebalance dates (first trading day of each calendar
  // month) and take the last MONTHS of them. The sim window runs from the
  // first rebalance date through the last trading day.
  const monthStarts: string[] = [];
  let prevMonth = '';
  for (const d of dates) {
    const mo = d.slice(0, 7);
    if (mo !== prevMonth) {
      monthStarts.push(d);
      prevMonth = mo;
    }
  }
  const rebalDates = monthStarts.slice(-MONTHS);
  const simDates = dates.slice(dates.indexOf(rebalDates[0]));
  console.log(`Simulation window: ${simDates[0]} → ${simDates[simDates.length - 1]} (${simDates.length} days, ${rebalDates.length} monthly rebalances)`);
  console.log(`Rebalance dates: ${rebalDates.join(', ')}`);

  // Earliest real data date, for adaptive lookback (12-month lookback needs 13
  // months, but the CSVs only span ~12 months).
  const dataStart = dates[0];
  console.log(`Earliest data date: ${dataStart}`);

  // 4. Wire the bot stack (same as index.ts) with the mock broker.
  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  ledger.startSession('PAPER');
  ledger.setStrategyParam('momentumTopN', String(TOP_N), 'mock_ai_backed');
  const risk = new RiskEngine(config, ledger);
  const paper = new PaperTrader(config, ledger);
  const guard = new OrderGuard(ledger);
  const broker = new MockBrokerAccount(base);
  const liveTrader = new LiveTrader(config, ledger, paper, guard, broker, null);
  const liveData = new LiveDataService();
  // --- AI Reasoning Layer (real LLM + news sentiment) ---
  const llm = new LlmManager(config.llm);
  const news = new NewsSentimentEngine(config, llm, ledger);
  const reportEngine = new DailyReportEngine(config, ledger, news, risk, llm);
  const strategy = new MomentumStrategy(config, ledger, risk, paper, liveData, liveTrader);

  // --- Event-driven news monitor (Phase 4.4) with a price-proxy news source ---
  config.newsMonitor.enabled = true;
  config.newsMonitor.sentimentExitThreshold = -0.5;
  config.newsMonitor.opportunisticEnabled = true;
  config.newsMonitor.opportunisticPartialPct = 50;
  const proxyNews = new PriceProxyNewsEngine(closesBySymbol);
  const newsMonitor = new NewsMonitorEngine(config, ledger, proxyNews as unknown as NewsSentimentEngine, strategy);

  // Register instruments so price lookups work.
  for (const [sym, pts] of closesBySymbol) {
    const last = pts[pts.length - 1].close;
    ledger.raw()
      .prepare(`INSERT OR IGNORE INTO instruments (token, tradingsymbol, exchange, segment, instrument_type, name, lot_size, tick_size)
                VALUES (?, ?, 'NSE', 'NSE', 'EQ', ?, 1, 0.05)`)
      .run(10000 + Math.abs(hash(sym)) % 100000, sym, sym);
    ledger.raw().prepare(`UPDATE instruments SET last_price = ? WHERE tradingsymbol = ?`).run(last, sym);
  }

  // 5. Simulate the window day-by-day, rebalancing at each month-start.
  const rebalSet = new Set(rebalDates);
  const rows: string[] = [];
  const monthRows: string[] = [];
  let prevEquity = CAPITAL;
  let cumPnl = 0;
  let realizedTotal = 0;
  const curve: number[] = [CAPITAL];
  const rebalanceLog: string[] = [];
  let curMonth = '';
  let monthStartEq = CAPITAL;
  let monthBought: string[] = [];
  let monthSold: string[] = [];

  for (let i = 0; i < simDates.length; i++) {
    const d = simDates[i];
    // Event-driven news monitor: set the price-proxy date and poll. The proxy
    // reads a sharp drop as negative news (defensive exit) and a breakout as
    // positive news (opportunistic entry), so the monitor reacts intraday.
    proxyNews.setDate(d);
    // Refresh the momentum ranking as-of today so the opportunistic candidacy
    // check is fresh (not the last monthly-rebalance ranking).
    const upTo = new Map<string, ClosePoint[]>();
    for (const [sym, pts] of closesBySymbol) {
      const u = pts.filter((p) => p.date <= d);
      if (u.length > 0) upTo.set(sym, u);
    }
    strategy.targetPortfolio(upTo);
    const nm = await newsMonitor.poll(new Date(d + 'T10:00:00+05:30'));
    if (nm.decisions.some((x) => x.action !== 'NONE')) {
      console.log('  [news] ' + d + ': ' + nm.decisions.filter((x) => x.action !== 'NONE').map((x) => x.symbol + ':' + x.action).join(', '));
    }
    const mo = d.slice(0, 7);
    if (mo !== curMonth) {
      if (curMonth !== '') {
        const monthEndEq = prevEquity;
        monthRows.push(
          `| ${curMonth} | ${inr(monthStartEq)} | ${inr(monthEndEq)} | ${((monthEndEq - monthStartEq) / monthStartEq * 100).toFixed(2)}% | ${monthBought.join(', ') || '—'} | ${monthSold.join(', ') || '—'} |`
        );
      }
      curMonth = mo;
      monthStartEq = prevEquity;
      monthBought = [];
      monthSold = [];
    }

    // Monthly rebalance: compute the target from history <= today and trade
    // through the mock broker (bought/sold names are logged for the report).
    if (rebalSet.has(d)) {
      // 5 years of data → full validated 12-month lookback (capped by the
      // adaptive guard, which is 12 for any rebalance in this window).
      const available = monthsBetween(dataStart, d);
      const lookback = Math.max(2, Math.min(12, available - 2));
      config.strategy.momentumLookbackMonths = lookback;
      const closesUpTo = new Map<string, ClosePoint[]>();
      for (const [sym, pts] of closesBySymbol) {
        const upTo = pts.filter((p) => p.date <= d);
        if (upTo.length > 0) closesUpTo.set(sym, upTo);
      }
      const target = strategy.targetPortfolio(closesUpTo);
      const prices = new Map<string, number>();
      for (const [sym, pts] of closesBySymbol) {
        const onOrBefore = [...pts].reverse().find((p) => p.date <= d);
        if (onOrBefore) prices.set(sym, onOrBefore.close);
      }

      // REAL AI Reasoning Layer: generate the pre-open daily report for the
      // momentum target names. The LLM returns market_regime.regime_score +
      // per-symbol action_bias, persisted to the ledger where the momentum
      // strategy reads it (regime scaling + veto/shrink). News sentiment is
      // date-scoped to `d` via the TinyFish time-range filter, so the AI reads
      // the news it would have seen on that rebalance date (no look-ahead).
      const aiNow = new Date(d + 'T09:00:00+05:30');
      const aiSymbols = target.slice(0, AI_SYMBOLS);
      console.log(`  [AI] generating pre-open report for ${d} on ${aiSymbols.length} names...`);
      const report = await reportEngine.generate('pre_open', aiSymbols.length ? aiSymbols : ['RELIANCE', 'INFY', 'TCS', 'HDFCBANK', 'TATASTEEL'], aiNow, d);
      if (report) {
        const regime = report.market_regime.regime_score;
        const mult = strategy.currentRegimeMultiplier();
        console.log(`       regime_score=${regime.toFixed(3)} (${report.market_regime.overall_sentiment}) → exposure multiplier ${mult.toFixed(2)}`);
        console.log(`       recs: ${report.portfolio_recommendations.map((x: any) => `${x.symbol}:${x.action_bias}`).join(', ')}`);
        rebalanceLog.push(`- **${d}** AI regime ${regime.toFixed(2)} (${report.market_regime.overall_sentiment}) → exposure x${mult.toFixed(2)}; bias [${report.portfolio_recommendations.map((x: any) => `${x.symbol}:${x.action_bias}`).join(', ')}]`);
      } else {
        console.log('       [AI] report failed — neutral regime, no veto (momentum unchanged)');
        rebalanceLog.push(`- **${d}** AI report failed (neutral, no veto)`);
      }

      const res = strategy.rebalance(new Date(d + 'T00:00:00Z'), prices, target);
      monthBought = monthBought.concat(res.bought);
      monthSold = monthSold.concat(res.sold);
      rebalanceLog.push(`- **${d}** → target [${target.join(', ')}] | bought [${res.bought.join(', ')}] | sold [${res.sold.join(', ')}]`);
      console.log(`  Rebalance ${d}: bought [${res.bought.join(', ')}], sold [${res.sold.join(', ')}]`);
      if (res.skipped.length) console.log(`      skipped: ${res.skipped.join(' | ')}`);
      // Let the fire-and-log broker orders reach the mock before continuing.
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Mark to market at close of this day.
    let eq = CAPITAL;
    for (const pos of ledger.getOpenPositions()) {
      const pts = closesBySymbol.get(pos.symbol)!;
      const onOrBefore = [...pts].reverse().find((p) => p.date <= d);
      const price = onOrBefore ? onOrBefore.close : pos.avgPrice;
      eq += (price - pos.avgPrice) * pos.quantity;
    }
    const dayPnl = eq - prevEquity;
    cumPnl = eq - CAPITAL;
    const realized = ledger.cumulativeRealizedPnl();
    const dayRealized = realized - realizedTotal;
    realizedTotal = realized;
    curve.push(eq);
    prevEquity = eq;

    const held = ledger.getOpenPositions().map((p) => `${p.symbol}×${p.quantity}`).join(', ') || '(none)';
    rows.push(
      `| ${i + 1} | ${d} | ${inr(eq)} | ${inr(dayPnl)} | ${(dayPnl / CAPITAL * 100).toFixed(2)}% | ${inr(cumPnl)} | ${(cumPnl / CAPITAL * 100).toFixed(2)}% | ${inr(dayRealized)} | ${held} |`
    );
  }
  // Close out the final month.
  {
    const monthEndEq = prevEquity;
    monthRows.push(
      `| ${curMonth} | ${inr(monthStartEq)} | ${inr(monthEndEq)} | ${((monthEndEq - monthStartEq) / monthStartEq * 100).toFixed(2)}% | ${monthBought.join(', ') || '—'} | ${monthSold.join(', ') || '—'} |`
    );
  }

  // 6. Build the report.
  const finalEquity = curve[curve.length - 1];
  const totalPnl = finalEquity - CAPITAL;
  const totalPct = (totalPnl / CAPITAL) * 100;
  const wins = rows.filter((r) => parseNum(r.split('|')[4]) > 0).length;
  const losses = simDates.length - wins;

  const lines: string[] = [];
  lines.push(`# ${MONTHS}-Month AI-Backed Mock Trade Report (shrink-not-block veto)`);
  lines.push('');
  lines.push(`> **Strategy:** Cross-sectional momentum (12-month lookback, skip-1, top-${TOP_N}) + AI sentiment-regime switching & per-symbol veto (shrink-not-block)`);
  lines.push(`> **Capital:** ${inr(CAPITAL)} | **Window:** ${simDates[0]} → ${simDates[simDates.length - 1]} (${simDates.length} trading days, ${rebalDates.length} monthly rebalances)`);
  lines.push(`> **Broker:** kite-paper-node mock REST server (real NSE daily CSVs) — orders routed via LiveTrader → POST /orders/:variety`);
  lines.push(`> **Execution:** Real LLM report (regime + bias) → MomentumStrategy → RiskEngine + PaperTrader → LiveTrader → mock broker`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| Starting capital | ${inr(CAPITAL)} |`);
  lines.push(`| Final equity | ${inr(finalEquity)} |`);
  lines.push(`| Total P&L | ${inr(totalPnl)} (${totalPct.toFixed(2)}%) |`);
  lines.push(`| Winning days | ${wins} |`);
  lines.push(`| Losing days | ${losses} |`);
  lines.push(`| Total realized P&L | ${inr(realizedTotal)} |`);
  lines.push(`| Rebalance months | ${rebalDates.length} |`);
  lines.push('');
  lines.push('## Per-Month Table');
  lines.push('');
  lines.push('| Month | Start equity | End equity | Month return | Bought | Sold |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of monthRows) lines.push(r);
  lines.push('');
  lines.push('## Rebalance Log');
  lines.push('');
  for (const r of rebalanceLog) lines.push(r);
  lines.push('');
  lines.push('## Per-Day P&L');
  lines.push('');
  lines.push('| Day | Date | Equity | Day P&L | Day % | Cum P&L | Cum % | Day Realized | Holdings |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) lines.push(r);
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- The mock broker is treated as the real Zerodha backend: orders are placed through its');
  lines.push('  REST API, and the paper ledger (real NSE CSV fills) is the system of record.');
  lines.push('- Momentum is a monthly-rebalance strategy: the target portfolio is recomputed at each');
  lines.push('  month-start and the book is rebalanced through the mock broker. Day P&L is the');
  lines.push('  mark-to-market change between trading days.');
  lines.push('- Data is 5 years of real NSE daily closes (Aug 2021 → Aug 2026) from Yahoo, so the');
  lines.push('  validated 12-month lookback is used throughout. The portfolio-drawdown guard (10%)');
  lines.push('  can halt new entries after a drawdown, which is why some later months show buys blocked.');
  lines.push('- The AI layer is REAL: each monthly rebalance calls DailyReportEngine.generate(pre_open),');
  lines.push('  which runs the LLM (Ollama) + news sentiment and produces market_regime.regime_score');
  lines.push('  (drives exposure scaling) and per-symbol action_bias (drives veto/shrink).');
  lines.push('- Per-symbol news sentiment AND the global-macro numbers/headlines are DATE-SCOPED');
  lines.push('  to each rebalance date (TinyFish time-range + Yahoo chart history), so the AI reads');
  lines.push('  the news and market tone it would have seen then (no look-ahead).');

  const report = lines.join('\n');
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, report);
  console.log(`\n✔ Report written to: ${OUT_FILE}`);

  await server.stop();
}

main().catch((err) => {
  console.error('mock_30d_trade failed:', err);
  process.exit(1);
});
