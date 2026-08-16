/**
 * momentum_news_backtest.ts — demonstrates the AI-backed news-risk filter on the
 * momentum strategy (Initiative 2 follow-up).
 *
 * The live system uses real news sentiment (RSS/TinyFish + LLM). In a backtest
 * we use a deterministic proxy for "bad news": a sharp recent drop (5-day
 * return < -8%) → news score -0.5, else 0. This tests the MECHANISM (entry veto
 * + exit trigger) and shows how many trades the news filter vetoes/exits.
 *
 * Usage:
 *   ENV_FILE=.env.test npx ts-node test/backtest/momentum_news_backtest.ts
 */
import { loadConfig } from '../../src/server/AppConfig';
import { Ledger } from '../../src/server/Ledger';
import { RiskEngine } from '../../src/server/RiskEngine';
import { PaperTrader } from '../../src/server/PaperTrader';
import { MomentumStrategy } from '../../src/server/MomentumStrategy';
import { LiveDataService } from '../../src/server/LiveDataService';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { ClosePoint } from '../../src/server/signals/momentum';

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Deterministic "bad news" proxy: 5-day return < -8% → -0.5, else 0. */
function newsProxy(pts: ClosePoint[], date: string): number {
  const idx = pts.findIndex((p) => p.date === date);
  if (idx < 5) return 0;
  const now = pts[idx].close;
  const fiveDaysAgo = pts[idx - 5].close;
  if (fiveDaysAgo <= 0) return 0;
  const ret = now / fiveDaysAgo - 1;
  return ret < -0.08 ? -0.5 : 0;
}

async function main(): Promise<void> {
  const config = loadConfig();
  config.risk.availableCapital = numEnv('CAPITAL', 500_000);
  config.strategy.momentumTopN = numEnv('MOMENTUM_TOP_N', 4);
  config.strategy.newsVetoThreshold = numEnv('NEWS_VETO_THRESHOLD', -0.4);
  const provider = createHistoricalProvider(config);
  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);

  const to = new Date();
  const from = new Date(to.getTime() - 4 * 365 * 24 * 60 * 60 * 1000);
  console.log(`Fetching daily data for ${symbols.length} symbols...`);

  const closesBySymbol = new Map<string, ClosePoint[]>();
  for (const sym of symbols) {
    try {
      const inst = provider.findInstrument(sym, 'NSE');
      if (!inst) continue;
      const candles = await provider.getHistoricalData(inst.instrument_token, 'day', from, to);
      const pts = candles
        .map((c) => ({ date: c.date.toISOString().slice(0, 10), close: c.close }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      if (pts.length > 60) closesBySymbol.set(sym, pts);
    } catch {
      /* skip */
    }
  }
  console.log(`Fetched ${closesBySymbol.size}/${symbols.length} symbols.`);

  const allDates = new Set<string>();
  for (const pts of closesBySymbol.values()) for (const p of pts) allDates.add(p.date);
  const dates = [...allDates].sort();
  const rebalanceDates: string[] = [];
  let lastMonth = '';
  for (const d of dates) {
    const m = d.slice(0, 7);
    if (m !== lastMonth) {
      rebalanceDates.push(d);
      lastMonth = m;
    }
  }

  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  const risk = new RiskEngine(config, ledger);
  const trader = new PaperTrader(config, ledger);
  const strategy = new MomentumStrategy(config, ledger, risk, trader, new LiveDataService());

  for (const [sym, pts] of closesBySymbol) {
    const last = pts[pts.length - 1].close;
    ledger.raw()
      .prepare(`INSERT OR IGNORE INTO instruments (token, tradingsymbol, exchange, segment, instrument_type, name, lot_size, tick_size)
                VALUES (?, ?, 'NSE', 'NSE', 'EQ', ?, 1, 0.05)`)
      .run(10000 + Math.abs(hash(sym)) % 100000, sym, sym);
    ledger.raw().prepare(`UPDATE instruments SET last_price = ? WHERE tradingsymbol = ?`).run(last, sym);
  }

  const monthlyReturns: number[] = [];
  let equity = config.risk.availableCapital;
  let newsVetoed = 0;
  let newsExited = 0;

  for (let i = 0; i < rebalanceDates.length; i++) {
    const rebalDate = rebalanceDates[i];
    const nextDate = rebalanceDates[i + 1];
    if (!nextDate) break;

    const closesUpTo = new Map<string, ClosePoint[]>();
    for (const [sym, pts] of closesBySymbol) {
      const upTo = pts.filter((p) => p.date <= rebalDate);
      if (upTo.length > 0) closesUpTo.set(sym, upTo);
    }
    const target = strategy.targetPortfolio(closesUpTo);

    const prices = new Map<string, number>();
    const newsScores = new Map<string, number>();
    for (const [sym, pts] of closesBySymbol) {
      const onOrBefore = [...pts].reverse().find((p) => p.date <= rebalDate);
      if (onOrBefore) {
        prices.set(sym, onOrBefore.close);
        newsScores.set(sym, newsProxy(pts, onOrBefore.date));
      }
    }

    const before = ledger.getOpenPositions().map((p) => p.symbol);
    const res = strategy.rebalance(new Date(rebalDate + 'T00:00:00Z'), prices, target, newsScores);
    const after = ledger.getOpenPositions().map((p) => p.symbol);
    // Count news-driven exits: positions held before, sold now, still in target.
    for (const sym of before) {
      if (!after.includes(sym) && target.includes(sym)) newsExited++;
    }
    newsVetoed += res.skipped.filter((s) => s.includes('news veto')).length;

    let eq = config.risk.availableCapital;
    for (const pos of ledger.getOpenPositions()) {
      const pts = closesBySymbol.get(pos.symbol)!;
      const exit = [...pts].reverse().find((p) => p.date <= nextDate);
      const price = exit ? exit.close : pos.avgPrice;
      eq += (price - pos.avgPrice) * pos.quantity;
    }
    const ret = eq / equity - 1;
    monthlyReturns.push(ret);
    equity = eq;
  }

  const n = monthlyReturns.length;
  const total = monthlyReturns.reduce((s, r) => s + r, 0);
  const avg = n ? total / n : 0;
  const positive = monthlyReturns.filter((r) => r > 0).length;
  const annualized = Math.pow(1 + avg, 12) - 1;

  console.log('\n==============================================================');
  console.log('  MOMENTUM + AI NEWS-RISK FILTER (proxy: 5-day drop < -8%)');
  console.log(`  Top ${config.strategy.momentumTopN} | Months: ${n} | Veto threshold: ${config.strategy.newsVetoThreshold}`);
  console.log(`  News-vetoed entries: ${newsVetoed}`);
  console.log(`  News-triggered exits: ${newsExited}`);
  console.log(`  Avg monthly return (net): ${(avg * 100).toFixed(2)}%`);
  console.log(`  Annualized (net): ${(annualized * 100).toFixed(2)}%`);
  console.log(`  Positive months: ${positive}/${n} (${((positive / n) * 100).toFixed(0)}%)`);
  console.log(`  Total net return: ${(total * 100).toFixed(2)}%`);
  console.log('==============================================================');
  console.log('Note: backtest uses a deterministic proxy for news. In production');
  console.log('the real RSS/TinyFish + LLM sentiment is used (wired in index.ts).');
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

main().catch((err) => {
  console.error('momentum_news_backtest failed:', err);
  process.exit(1);
});
