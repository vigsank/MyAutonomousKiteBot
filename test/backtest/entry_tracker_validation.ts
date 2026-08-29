/**
 * entry_tracker_validation.ts — does the daily 220-DMA-break exit (the
 * master-class stop rule) reduce drawdown without costing too much return,
 * versus the plain monthly momentum rebalance?
 *
 * Baseline : momentum monthly rebalance (top-N, hysteresis), equal weight.
 * Tracker  : same, but each day a held name whose close < its 220-DMA is sold
 *            to cash until the next rebalance (the class's stop).
 *
 * This is the DEFENSIVE half of #18. The opportunistic breakout ENTRY is a
 * separate, riskier question (and the news-monitor's analogous opportunistic
 * path already showed churn), so it is not tested here.
 *
 * Usage:
 *   ENV_FILE=.env.test npx ts-node test/backtest/entry_tracker_validation.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../../src/server/AppConfig';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { ClosePoint, sma } from '../../src/server/signals/momentum';

const YEARS = 6;
const LOOKBACK_MONTHS = 12;
const SKIP_MONTHS = 1;
const TOP_N = 6;
const BAND = 8;
const DMA_PERIOD = 220;
const CACHE_DIR = path.join(__dirname, 'results', 'walk_forward', '.cache');

function oneWayCostPct(): number {
  const c = loadConfig().costs;
  const brokerage = Math.min(c.brokerageBps / 10000, c.brokerageMax / 10000);
  const statutory = c.statutoryBps / 10000;
  const slippage = c.slippageBps / 10000;
  const gst = (brokerage * c.gstPct) / 100;
  return brokerage + statutory + slippage + gst;
}

function closeOnOrBefore(pts: ClosePoint[], date: string): number | null {
  for (let i = pts.length - 1; i >= 0; i--) {
    if (pts[i].date <= date) return pts[i].close;
  }
  return null;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Daily closes for the watchlist, reusing the walk-forward cache when fresh. */
async function loadCloses(symbols: string[]): Promise<Map<string, ClosePoint[]>> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, `closes_${YEARS}y_${symbols.length}.json`);
  if (fs.existsSync(cacheFile) && Date.now() - fs.statSync(cacheFile).mtimeMs < 24 * 60 * 60 * 1000) {
    const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as Record<string, ClosePoint[]>;
    return new Map(Object.entries(raw));
  }
  const config = loadConfig();
  const provider = createHistoricalProvider(config);
  const to = new Date();
  const from = new Date(to.getTime() - YEARS * 365 * 24 * 60 * 60 * 1000);
  const out = new Map<string, ClosePoint[]>();
  for (const sym of symbols) {
    try {
      const inst = provider.findInstrument(sym, 'NSE');
      if (!inst) continue;
      const candles = await provider.getHistoricalData(inst.instrument_token, 'day', from, to);
      const pts = candles
        .map((c) => ({ date: c.date.toISOString().slice(0, 10), close: c.close }))
        .filter((p) => Number.isFinite(p.close) && p.close > 0)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      if (pts.length > 60) out.set(sym, pts);
    } catch {
      /* skip */
    }
  }
  fs.writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(out)));
  return out;
}

/** Momentum top-N with hysteresis, at a given rebalance date. */
function selectTarget(
  closesBySymbol: Map<string, ClosePoint[]>,
  rebalDate: string,
  held: string[],
): string[] {
  const skipDate = addMonths(rebalDate, -SKIP_MONTHS);
  const lookbackDate = addMonths(rebalDate, -(LOOKBACK_MONTHS + SKIP_MONTHS));
  const scored: Array<{ symbol: string; mom: number }> = [];
  for (const [sym, pts] of closesBySymbol) {
    const start = closeOnOrBefore(pts, lookbackDate);
    const end = closeOnOrBefore(pts, skipDate);
    if (start && end && start > 0) scored.push({ symbol: sym, mom: end / start - 1 });
  }
  scored.sort((a, b) => b.mom - a.mom);
  const rank = new Map(scored.map((s, i) => [s.symbol, i]));
  const target = new Set<string>();
  for (const sym of held) {
    const r = rank.get(sym);
    if (r !== undefined && r < TOP_N + BAND) target.add(sym);
  }
  for (const s of scored) {
    if (target.size >= TOP_N) break;
    target.add(s.symbol);
  }
  const ordered = [...target].sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
  return ordered.slice(0, TOP_N);
}

function maxDrawdown(equity: number[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const e of equity) {
    if (e > peak) peak = e;
    const dd = (peak - e) / peak;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

interface SimResult {
  annualized: number;
  maxDd: number;
  turnover: number;
  exits: number;
  finalEquity: number;
}

/**
 * Run the daily simulation. `dailyExit` toggles the 220-DMA-break stop.
 * Weights are fractions of total equity; cash is the uninvested remainder.
 */
function simulate(
  closesBySymbol: Map<string, ClosePoint[]>,
  dates: string[],
  rebalanceDates: Set<string>,
  oneWay: number,
  dailyExit: boolean,
): SimResult {
  let weights = new Map<string, number>();
  let cash = 1; // start fully in cash
  let equity = 1;
  let turnover = 0;
  let exits = 0;
  const equitySeries: number[] = [1];

  for (let i = 1; i < dates.length; i++) {
    const prevDate = dates[i - 1];
    const date = dates[i];

    // 1. Mark to market: return from prevDate → date on current weights.
    let portfolioReturn = 0;
    for (const [sym, w] of weights) {
      const pts = closesBySymbol.get(sym);
      if (!pts) continue;
      const prev = closeOnOrBefore(pts, prevDate);
      const cur = closeOnOrBefore(pts, date);
      if (prev && cur && prev > 0) portfolioReturn += w * (cur / prev - 1);
    }
    equity *= 1 + portfolioReturn;
    equitySeries.push(equity);

    // 2. Rebalance or daily exit at `date`'s close.
    if (rebalanceDates.has(date)) {
      const held = [...weights.keys()];
      const target = selectTarget(closesBySymbol, date, held);
      const targetWeight = 1 / target.length;
      const next = new Map<string, number>();
      for (const sym of target) next.set(sym, targetWeight);
      // Cost on the weight that actually moves (including cash).
      let traded = Math.abs(cash - 0); // cash → invested
      const universe = new Set([...weights.keys(), ...next.keys()]);
      for (const sym of universe) {
        traded += Math.abs((next.get(sym) ?? 0) - (weights.get(sym) ?? 0));
      }
      turnover += traded;
      equity *= 1 - traded * oneWay;
      weights = next;
      cash = 0;
    } else if (dailyExit) {
      for (const [sym, w] of [...weights]) {
        const pts = closesBySymbol.get(sym);
        if (!pts) continue;
        const upTo = pts.filter((p) => p.date <= date);
        const avg = sma(upTo, DMA_PERIOD);
        const cur = closeOnOrBefore(pts, date);
        if (avg !== null && cur !== null && cur < avg) {
          // Sell to cash (the class's stop).
          weights.delete(sym);
          cash += w;
          turnover += w;
          equity *= 1 - w * oneWay;
          exits++;
        }
      }
    }
  }

  const years = dates.length / 252;
  const annualized = Math.pow(equity, 1 / years) - 1;
  return { annualized, maxDd: maxDrawdown(equitySeries), turnover, exits, finalEquity: equity };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);
  const closesBySymbol = await loadCloses(symbols);
  console.log(`Fetched ${closesBySymbol.size}/${symbols.length} symbols.`);

  const allDates = new Set<string>();
  for (const pts of closesBySymbol.values()) for (const p of pts) allDates.add(p.date);
  const dates = [...allDates].sort();

  const rebalanceDates = new Set<string>();
  let lastMonth = '';
  for (const d of dates) {
    const m = d.slice(0, 7);
    if (m !== lastMonth) {
      rebalanceDates.add(d);
      lastMonth = m;
    }
  }

  const oneWay = oneWayCostPct();
  const base = simulate(closesBySymbol, dates, rebalanceDates, oneWay, false);
  const tracked = simulate(closesBySymbol, dates, rebalanceDates, oneWay, true);

  console.log('\n==============================================================');
  console.log('  ENTRY TRACKER — daily 220-DMA-break exit (defensive)');
  console.log(`  Universe: ${closesBySymbol.size} | Days: ${dates.length} | One-way cost: ${(oneWay * 100).toFixed(3)}%`);
  console.log('--------------------------------------------------------------');
  console.log(`  Baseline (monthly rebalance):`);
  console.log(`    Annualized: ${(base.annualized * 100).toFixed(2)}% | Max DD: ${(base.maxDd * 100).toFixed(1)}% | Turnover: ${(base.turnover * 100).toFixed(0)}%`);
  console.log(`  + daily DMA-break exit:`);
  console.log(`    Annualized: ${(tracked.annualized * 100).toFixed(2)}% | Max DD: ${(tracked.maxDd * 100).toFixed(1)}% | Turnover: ${(tracked.turnover * 100).toFixed(0)}% | Exits: ${tracked.exits}`);
  console.log('--------------------------------------------------------------');
  console.log(`  Δ annualized: ${((tracked.annualized - base.annualized) * 100).toFixed(2)}pp`);
  console.log(`  Δ max drawdown: ${((tracked.maxDd - base.maxDd) * 100).toFixed(1)}pp`);
  console.log('==============================================================');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
