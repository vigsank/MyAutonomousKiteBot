/**
 * strategy_lab.ts — A/B test strategy variants under ONE out-of-sample method.
 *
 * The production gate (`momentum_walk_forward.ts`) answers "is the shipped edge
 * real?". This answers a different question: "does a proposed CHANGE beat what
 * we ship?" Nothing is promoted into the strategy until it wins here.
 *
 * Three things it fixes about the production harness, which matter for the
 * changes being evaluated:
 *
 *  1. TURNOVER-AWARE COSTS. The production harness charges a full round trip
 *     every month regardless of how much actually changed hands. That both
 *     overstates cost for a low-turnover strategy AND makes any turnover
 *     reduction (hysteresis) invisible. Here cost is charged on weight actually
 *     traded.
 *  2. NIFTY BENCHMARK. A positive return that trails the index is a failure.
 *     Every variant is scored against Nifty 50, not against zero.
 *  3. TAX. Monthly rebalancing makes 100% of gains short-term at 20%. Nothing
 *     in the codebase modelled this, so every number we had was pre-tax.
 *
 * Usage:
 *   ENV_FILE=.env.test LOG_LEVEL=silent npx ts-node test/backtest/strategy_lab.ts
 *   YEARS=6 CAPITAL=500000 npx ts-node test/backtest/strategy_lab.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../../src/server/AppConfig';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { ClosePoint } from '../../src/server/signals/momentum';

const LOOKBACK_MONTHS = 12;
const SKIP_MONTHS = 1;
const OUT_DIR = path.join(__dirname, 'results', 'strategy_lab');
const CACHE_DIR = path.join(OUT_DIR, '.cache');

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const YEARS = numEnv('YEARS', 6);
const CAPITAL = numEnv('CAPITAL', 500_000);

/* ------------------------------------------------------------------ */
/* Variants                                                            */
/* ------------------------------------------------------------------ */

interface Variant {
  name: string;
  note: string;
  topN: number;
  /** Rebalance every N months (1 = monthly). */
  everyMonths?: number;
  /**
   * Hold a name until it falls out of the top `topN + band`, instead of
   * selling the moment it leaves the top N. Cuts turnover (and therefore cost
   * and short-term tax) at the price of a slightly staler book.
   */
  hysteresisBand?: number;
  /** Annualized volatility target. Exposure = min(1, target / realized). */
  volTarget?: number;
  /** Halve exposure when the market is below its 200-day mean. */
  crashFilter?: boolean;
  /**
   * Mandatory cash reserve as a % of equity kept out of the market (0.4 sweep).
   * Reduces deployable capital to `equity * (1 - cashReservePct/100)`, mirroring
   * the live RiskEngine reserve. Defaults to 0 (fully deployed) for existing
   * variants so their numbers are unchanged.
   */
  cashReservePct?: number;
}

const VARIANTS: Variant[] = [
  { name: 'shipped', note: 'what we ship today: top-6 monthly + hysteresis-8', topN: 6, hysteresisBand: 8 },
  { name: 'no-hysteresis', note: 'the old shipped config, for reference', topN: 6 },
  { name: 'hysteresis-4', note: 'hold until rank > topN+4', topN: 6, hysteresisBand: 4 },
  { name: 'vol-15', note: 'scale exposure to 15% annualized vol', topN: 6, volTarget: 0.15 },
  { name: 'vol-20', note: 'scale exposure to 20% annualized vol', topN: 6, volTarget: 0.20 },
  { name: 'crash-filter', note: 'halve exposure below the 200d mean', topN: 6, crashFilter: true },
  // 2.1 re-test: vol scaling was measured on top of the OLD config. The only
  // honest question now is whether it adds anything on top of hysteresis-8.
  { name: 'hyst8+vol15', note: 'shipped + 15% vol target', topN: 6, hysteresisBand: 8, volTarget: 0.15 },
  { name: 'hyst8+vol20', note: 'shipped + 20% vol target', topN: 6, hysteresisBand: 8, volTarget: 0.20 },
  { name: 'hyst8+crash', note: 'shipped + crash filter', topN: 6, hysteresisBand: 8, crashFilter: true },
  { name: 'hyst8+vol15+crash', note: 'shipped + both overlays', topN: 6, hysteresisBand: 8, volTarget: 0.15, crashFilter: true },
  // 3.2: cadence AFTER TAX. Quarterly gives up signal freshness to push gains
  // toward the 12-month line; hysteresis buys turnover reduction without that
  // sacrifice. The comparison is only fair at the same band.
  { name: 'quarterly', note: 'rebalance every 3 months (tax-aware test)', topN: 6, everyMonths: 3 },
  { name: 'quarterly+hyst8', note: 'quarterly at the shipped band', topN: 6, everyMonths: 3, hysteresisBand: 8 },
  { name: 'semiannual+hyst8', note: 'every 6 months at the shipped band', topN: 6, everyMonths: 6, hysteresisBand: 8 },
  // 0.4: cash-reserve sensitivity. The leak waterfall showed the 20% reserve is
  // the single largest drag (-4.62pp). Sweep it WITH drawdown tracked, since the
  // reserve's whole justification is downside protection, not return.
  { name: 'reserve-0', note: 'shipped, 0% cash reserve (fully deployed)', topN: 6, hysteresisBand: 8, cashReservePct: 0 },
  { name: 'reserve-5', note: 'shipped, 5% cash reserve', topN: 6, hysteresisBand: 8, cashReservePct: 5 },
  { name: 'reserve-10', note: 'shipped, 10% cash reserve', topN: 6, hysteresisBand: 8, cashReservePct: 10 },
  { name: 'reserve-15', note: 'shipped, 15% cash reserve', topN: 6, hysteresisBand: 8, cashReservePct: 15 },
  { name: 'reserve-20', note: 'shipped, 20% cash reserve (current default)', topN: 6, hysteresisBand: 8, cashReservePct: 20 },
];

/* ------------------------------------------------------------------ */
/* Portfolio model                                                     */
/* ------------------------------------------------------------------ */

/** A held position, tracked in money so tax and turnover are real. */
interface Holding {
  value: number;
  cost: number;
  entryDate: string;
}

interface MonthResult {
  date: string;
  grossReturn: number;
  netReturn: number;
  cost: number;
  turnover: number;
  exposure: number;
  equity: number;
}

/** India's financial year (April–March) for tax accrual. */
function fyOf(date: string): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  return m >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

const STCG_RATE = 0.20;   // < 12 months (post 23-Jul-2024)
const LTCG_RATE = 0.125;  // >= 12 months, above the annual exemption
const LTCG_EXEMPTION = 125_000;

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

/* ------------------------------------------------------------------ */
/* Simulation                                                          */
/* ------------------------------------------------------------------ */

interface SimOutput {
  months: MonthResult[];
  finalEquity: number;
  /** Tax payable per financial year, computed on netted realized gains. */
  taxByFy: Map<string, number>;
  avgTurnover: number;
  avgExposure: number;
}

function simulate(
  closes: Map<string, ClosePoint[]>,
  rebalDates: string[],
  v: Variant,
  oneWayCost: number,
  marketIndex: Map<string, number>,
): SimOutput {
  let cash = CAPITAL;
  const holdings = new Map<string, Holding>();
  const months: MonthResult[] = [];

  // Realized gains netted within a financial year, split by holding period.
  const stcgByFy = new Map<string, number>();
  const ltcgByFy = new Map<string, number>();
  const taxByFy = new Map<string, number>();

  let turnoverSum = 0;
  let exposureSum = 0;
  let periods = 0;

  const every = v.everyMonths ?? 1;

  for (let i = 0; i < rebalDates.length - 1; i++) {
    const date = rebalDates[i];
    const next = rebalDates[i + 1];

    const equityBefore = cash + [...holdings.values()].reduce((s, h) => s + h.value, 0);
    if (equityBefore <= 0) break;

    const isRebalance = i % every === 0;
    let turnover = 0;
    let exposure = 1;

    if (isRebalance) {
      /* --- Rank the universe (no lookahead: uses data up to `date`) ---- */
      const scored: Array<{ symbol: string; mom: number }> = [];
      for (const [sym, pts] of closes) {
        const start = closeOnOrBefore(pts, addMonths(date, -(LOOKBACK_MONTHS + SKIP_MONTHS)));
        const end = closeOnOrBefore(pts, addMonths(date, -SKIP_MONTHS));
        const now = closeOnOrBefore(pts, date);
        if (start && end && now && start > 0) scored.push({ symbol: sym, mom: end / start - 1 });
      }
      if (scored.length < v.topN) continue;
      scored.sort((a, b) => b.mom - a.mom);
      const rank = new Map(scored.map((s, idx) => [s.symbol, idx]));

      /* --- Target set, with hysteresis ---------------------------------- */
      const band = v.hysteresisBand ?? 0;
      const target = new Set<string>();
      // Incumbents keep their slot while they remain inside the wider band.
      for (const sym of holdings.keys()) {
        const r = rank.get(sym);
        if (r !== undefined && r < v.topN + band) target.add(sym);
      }
      // Fill remaining slots from the top of the ranking.
      for (const s of scored) {
        if (target.size >= v.topN) break;
        target.add(s.symbol);
      }
      // If hysteresis left us over-full, drop the worst-ranked incumbents.
      if (target.size > v.topN) {
        const ordered = [...target].sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
        target.clear();
        for (const s of ordered.slice(0, v.topN)) target.add(s);
      }

      /* --- Exposure overlays -------------------------------------------- */
      if (v.volTarget) {
        const rv = realizedVol(closes, [...target], date);
        if (rv > 0) exposure = Math.min(1, v.volTarget / rv);
      }
      if (v.crashFilter && isBearMarket(marketIndex, date)) {
        exposure *= 0.5;
      }

      /* --- Trade to target ---------------------------------------------- */
      const equity = equityBefore;
      // Cash reserve holds back a fixed slice of equity from deployment (0.4).
      const deployFrac = 1 - (v.cashReservePct ?? 0) / 100;
      const perName = (equity * exposure * deployFrac) / v.topN;

      // Sell/trim anything not wanted, or held above its target weight.
      for (const [sym, h] of [...holdings]) {
        const want = target.has(sym) ? perName : 0;
        if (h.value <= want + 1e-9) continue;
        const sellValue = h.value - want;
        const frac = sellValue / h.value;
        const realized = sellValue - h.cost * frac;

        const fy = fyOf(date);
        const heldMonths = monthsBetween(h.entryDate, date);
        const bucket = heldMonths >= 12 ? ltcgByFy : stcgByFy;
        bucket.set(fy, (bucket.get(fy) ?? 0) + realized);

        const costOfTrade = sellValue * oneWayCost;
        cash += sellValue - costOfTrade;
        turnover += sellValue / equity;
        h.value -= sellValue;
        h.cost -= h.cost * frac;
        if (h.value <= 1e-6) holdings.delete(sym);
      }

      // Buy/top-up toward the target weight.
      for (const sym of target) {
        const h = holdings.get(sym);
        const have = h?.value ?? 0;
        const buyValue = Math.min(perName - have, cash);
        if (buyValue <= 1e-6) continue;
        const costOfTrade = buyValue * oneWayCost;
        cash -= buyValue + costOfTrade;
        turnover += buyValue / equity;
        if (h) {
          h.value += buyValue;
          h.cost += buyValue;
        } else {
          holdings.set(sym, { value: buyValue, cost: buyValue, entryDate: date });
        }
      }

      turnoverSum += turnover;
      exposureSum += exposure;
      periods++;
    }

    /* --- Carry the book forward one period ----------------------------- */
    for (const [sym, h] of holdings) {
      const pts = closes.get(sym)!;
      const p0 = closeOnOrBefore(pts, date);
      const p1 = closeOnOrBefore(pts, next);
      if (p0 && p1 && p0 > 0) h.value *= p1 / p0;
    }

    const equityAfter = cash + [...holdings.values()].reduce((s, h) => s + h.value, 0);
    months.push({
      date: next,
      grossReturn: equityBefore > 0 ? equityAfter / equityBefore - 1 : 0,
      netReturn: equityBefore > 0 ? equityAfter / equityBefore - 1 : 0,
      cost: turnover * oneWayCost,
      turnover,
      exposure,
      equity: equityAfter,
    });

    // Settle tax at each financial-year boundary, netting gains against losses.
    if (fyOf(date) !== fyOf(next)) {
      const fy = fyOf(date);
      const tax = taxFor(stcgByFy.get(fy) ?? 0, ltcgByFy.get(fy) ?? 0);
      if (tax > 0) {
        taxByFy.set(fy, tax);
        // Paid from the book, which is what actually happens to compounding.
        if (cash >= tax) cash -= tax;
        else {
          let owed = tax - cash;
          cash = 0;
          for (const h of holdings.values()) {
            const take = Math.min(h.value, owed);
            h.value -= take;
            h.cost -= h.cost * (take / (h.value + take || 1));
            owed -= take;
            if (owed <= 0) break;
          }
        }
      }
    }
  }

  const finalEquity = cash + [...holdings.values()].reduce((s, h) => s + h.value, 0);
  return {
    months,
    finalEquity,
    taxByFy,
    avgTurnover: periods ? turnoverSum / periods : 0,
    avgExposure: periods ? exposureSum / periods : 1,
  };
}

/** Tax on netted realized gains: losses offset within the year. */
function taxFor(stcg: number, ltcg: number): number {
  let st = stcg;
  let lt = ltcg;
  // A loss in one bucket offsets a gain in the other.
  if (st < 0 && lt > 0) { const off = Math.min(-st, lt); lt -= off; st += off; }
  if (lt < 0 && st > 0) { const off = Math.min(-lt, st); st -= off; lt += off; }
  const stTax = st > 0 ? st * STCG_RATE : 0;
  const ltTax = lt > LTCG_EXEMPTION ? (lt - LTCG_EXEMPTION) * LTCG_RATE : 0;
  return stTax + ltTax;
}

/** Annualized realized vol of an equal-weight basket over the trailing 6 months. */
function realizedVol(
  closes: Map<string, ClosePoint[]>,
  symbols: string[],
  asOf: string,
): number {
  const from = addMonths(asOf, -6);
  const series: number[][] = [];
  for (const sym of symbols) {
    const pts = closes.get(sym);
    if (!pts) continue;
    const window = pts.filter((p) => p.date > from && p.date <= asOf);
    if (window.length < 30) continue;
    const rets: number[] = [];
    for (let i = 1; i < window.length; i++) {
      rets.push(window[i].close / window[i - 1].close - 1);
    }
    series.push(rets);
  }
  if (!series.length) return 0;

  const n = Math.min(...series.map((s) => s.length));
  const port: number[] = [];
  for (let i = 0; i < n; i++) {
    port.push(series.reduce((s, r) => s + r[r.length - n + i], 0) / series.length);
  }
  const mean = port.reduce((s, r) => s + r, 0) / port.length;
  const varr = port.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(1, port.length - 1);
  return Math.sqrt(varr) * Math.sqrt(252);
}

/** Market is "bear" when the index sits below its 200-day mean. */
function isBearMarket(index: Map<string, number>, asOf: string): boolean {
  const dates = [...index.keys()].filter((d) => d <= asOf).sort();
  if (dates.length < 200) return false;
  const window = dates.slice(-200);
  const mean = window.reduce((s, d) => s + index.get(d)!, 0) / window.length;
  return index.get(dates[dates.length - 1])! < mean;
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

async function loadCloses(symbols: string[]): Promise<Map<string, ClosePoint[]>> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, `closes_${YEARS}y_${symbols.length}.json`);
  if (fs.existsSync(cacheFile)) {
    const age = Date.now() - fs.statSync(cacheFile).mtimeMs;
    if (age < 24 * 60 * 60 * 1000) {
      console.log('Using cached history (< 24h old).');
      const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as Record<string, ClosePoint[]>;
      return new Map(Object.entries(raw));
    }
  }

  const config = loadConfig();
  const provider = createHistoricalProvider(config);
  const to = new Date();
  const from = new Date(to.getTime() - YEARS * 365 * 24 * 60 * 60 * 1000);
  console.log(`Fetching ${YEARS}y of daily history for ${symbols.length} symbols...`);

  const out = new Map<string, ClosePoint[]>();
  for (const sym of symbols) {
    try {
      const inst = provider.findInstrument(sym, 'NSE');
      if (!inst) continue;
      const candles = await provider.getHistoricalData(inst.instrument_token, 'day', from, to);
      const pts: ClosePoint[] = candles
        .map((c) => ({ date: c.date.toISOString().slice(0, 10), close: c.close }))
        .filter((p) => Number.isFinite(p.close) && p.close > 0)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      if (pts.length > 300) out.set(sym, pts);
    } catch {
      /* unavailable — skip */
    }
  }
  fs.writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(out)));
  return out;
}

/** Nifty 50 daily closes. Yahoo serves the index as `^NSEI` (no .NS suffix). */
async function loadNifty(): Promise<ClosePoint[]> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, `nifty_${YEARS}y.json`);
  if (fs.existsSync(cacheFile)) {
    const age = Date.now() - fs.statSync(cacheFile).mtimeMs;
    if (age < 24 * 60 * 60 * 1000) {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as ClosePoint[];
    }
  }
  const config = loadConfig();
  const provider = createHistoricalProvider(config);
  const to = new Date();
  const from = new Date(to.getTime() - YEARS * 365 * 24 * 60 * 60 * 1000);
  try {
    // Any exchange other than NSE/BSE passes the symbol through unsuffixed.
    const inst = provider.findInstrument('^NSEI', 'INDEX' as 'NSE');
    if (!inst) return [];
    const candles = await provider.getHistoricalData(inst.instrument_token, 'day', from, to);
    const pts: ClosePoint[] = candles
      .map((c) => ({ date: c.date.toISOString().slice(0, 10), close: c.close }))
      .filter((p) => Number.isFinite(p.close) && p.close > 0)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    fs.writeFileSync(cacheFile, JSON.stringify(pts));
    return pts;
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const config = loadConfig();
  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);

  const closes = await loadCloses(symbols);
  console.log(`Loaded ${closes.size} symbols.`);
  if (closes.size < 20) {
    console.error('Not enough history to run the lab.');
    process.exit(1);
  }

  const nifty = await loadNifty();
  console.log(nifty.length ? `Nifty 50: ${nifty.length} bars.` : 'Nifty 50 unavailable — benchmark limited to the universe.');

  // Month-end rebalance dates common to the dataset.
  const allDates = new Set<string>();
  for (const pts of closes.values()) for (const p of pts) allDates.add(p.date);
  const dates = [...allDates].sort();
  const byMonth = new Map<string, string>();
  for (const d of dates) byMonth.set(d.slice(0, 7), d); // last trading day seen per month
  const rebalDates = [...byMonth.values()].sort();
  // Skip the first 13 months — the lookback needs them.
  const usable = rebalDates.slice(LOOKBACK_MONTHS + SKIP_MONTHS);

  const c = config.costs;
  const brokerage = Math.min(c.brokerageBps / 10000, c.brokerageMax / 10000);
  const oneWayCost =
    brokerage + c.statutoryBps / 10000 + c.slippageBps / 10000 + (brokerage * c.gstPct) / 100;

  // Equal-weight universe index, used for the crash filter's market state.
  const marketIndex = buildEqualWeightIndex(closes, dates);

  const start = usable[0];
  const end = usable[usable.length - 1];
  const years = monthsBetween(start, end) / 12;

  console.log(`\nWindow: ${start} → ${end} (${years.toFixed(1)}y, ${usable.length} rebalance dates)`);
  console.log(`One-way cost: ${(oneWayCost * 100).toFixed(3)}%  ·  Capital: ₹${CAPITAL.toLocaleString('en-IN')}\n`);

  const rows: Array<{
    v: Variant; cagr: number; afterTaxCagr: number; sharpe: number; maxDd: number;
    turnover: number; exposure: number; totalTax: number; posMonths: number; months: number;
  }> = [];

  for (const v of VARIANTS) {
    const out = simulate(closes, usable, v, oneWayCost, marketIndex);
    if (!out.months.length) continue;

    const rets = out.months.map((m) => m.netReturn);
    const cagr = Math.pow(out.finalEquity / CAPITAL, 1 / years) - 1;
    const totalTax = [...out.taxByFy.values()].reduce((s, t) => s + t, 0);
    // Tax is already paid out of the book inside simulate(); the pre-tax curve
    // is reconstructed by adding it back for an honest side-by-side.
    const preTaxEquity = out.finalEquity + totalTax;
    const preTaxCagr = Math.pow(preTaxEquity / CAPITAL, 1 / years) - 1;

    const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
    const sd = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(1, rets.length - 1));
    const sharpe = sd > 0 ? (mean * 12) / (sd * Math.sqrt(12)) : 0;

    let peak = -Infinity;
    let maxDd = 0;
    for (const m of out.months) {
      peak = Math.max(peak, m.equity);
      maxDd = Math.min(maxDd, m.equity / peak - 1);
    }

    rows.push({
      v,
      cagr: preTaxCagr,
      afterTaxCagr: cagr,
      sharpe,
      maxDd,
      turnover: out.avgTurnover,
      exposure: out.avgExposure,
      totalTax,
      posMonths: rets.filter((r) => r > 0).length,
      months: rets.length,
    });
  }

  const niftyCagr = benchmarkCagr(nifty, start, end, years);
  const universeCagr = benchmarkCagr(
    dates.map((d) => ({ date: d, close: marketIndex.get(d)! })),
    start, end, years,
  );

  /* --- Report ------------------------------------------------------- */
  const pct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
  const L: string[] = [];
  L.push('# Strategy Lab — variant comparison');
  L.push('');
  L.push(`**Window:** ${start} → ${end} (${years.toFixed(1)}y) · **Universe:** ${closes.size} NSE symbols · **Capital:** ₹${CAPITAL.toLocaleString('en-IN')}`);
  L.push('');
  L.push('Costs are charged on weight actually traded, not assumed at 100% turnover.');
  L.push('Tax is Indian equity: 20% STCG (<12m), 12.5% LTCG above ₹1.25L/FY, losses netted within the year.');
  L.push('');
  L.push('## Benchmarks');
  L.push('');
  L.push('| Benchmark | CAGR |');
  L.push('| --- | --- |');
  if (nifty.length) L.push(`| **Nifty 50 (buy & hold)** | **${pct(niftyCagr)}** |`);
  L.push(`| Equal-weight universe (buy & hold) | ${pct(universeCagr)} |`);
  L.push('');
  L.push('## Variants');
  L.push('');
  L.push('| Variant | CAGR (pre-tax) | CAGR (after tax) | vs Nifty | Sharpe | Max DD | Turnover/rebal | Avg exposure | Pos. months |');
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  const sorted = [...rows].sort((a, b) => b.afterTaxCagr - a.afterTaxCagr);
  for (const r of sorted) {
    L.push(
      `| ${r.v.name} | ${pct(r.cagr)} | **${pct(r.afterTaxCagr)}** | ${pct(r.afterTaxCagr - niftyCagr)} | ` +
      `${r.sharpe.toFixed(2)} | ${pct(r.maxDd)} | ${(r.turnover * 100).toFixed(0)}% | ` +
      `${(r.exposure * 100).toFixed(0)}% | ${r.posMonths}/${r.months} |`,
    );
  }
  L.push('');
  L.push('## What each variant is');
  L.push('');
  for (const v of VARIANTS) L.push(`- **${v.name}** — ${v.note}`);
  L.push('');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, 'strategy_lab_report.md');
  fs.writeFileSync(outFile, L.join('\n'));

  // Console summary
  console.log('='.repeat(104));
  console.log('  VARIANT COMPARISON (sorted by after-tax CAGR)');
  console.log('='.repeat(104));
  console.log('  Variant              PreTax    AfterTax   vsNifty   Sharpe   MaxDD   Turn/reb  Expos   Pos');
  console.log('  ' + '-'.repeat(100));
  for (const r of sorted) {
    console.log(
      `  ${r.v.name.padEnd(20)} ${pct(r.cagr).padStart(8)}  ${pct(r.afterTaxCagr).padStart(9)}  ` +
      `${pct(r.afterTaxCagr - niftyCagr).padStart(8)}  ${r.sharpe.toFixed(2).padStart(6)}  ` +
      `${pct(r.maxDd).padStart(7)}  ${(r.turnover * 100).toFixed(0).padStart(6)}%  ` +
      `${(r.exposure * 100).toFixed(0).padStart(4)}%  ${String(r.posMonths).padStart(3)}/${r.months}`,
    );
  }
  console.log('  ' + '-'.repeat(100));
  if (nifty.length) console.log(`  Nifty 50 buy & hold: ${pct(niftyCagr)}`);
  console.log(`  Equal-weight universe: ${pct(universeCagr)}`);
  console.log('='.repeat(104));

  const best = sorted[0];
  const beatsNifty = sorted.filter((r) => r.afterTaxCagr > niftyCagr);
  console.log(`\n  Best after tax : ${best.v.name} (${pct(best.afterTaxCagr)})`);
  console.log(`  Beat Nifty     : ${beatsNifty.length}/${sorted.length} variants`);
  console.log(`\nReport: ${path.relative(process.cwd(), outFile)}`);
}

function buildEqualWeightIndex(
  closes: Map<string, ClosePoint[]>,
  dates: string[],
): Map<string, number> {
  const index = new Map<string, number>();
  const base = new Map<string, number>();
  for (const [sym, pts] of closes) {
    if (pts.length) base.set(sym, pts[0].close);
  }
  for (const d of dates) {
    let sum = 0;
    let n = 0;
    for (const [sym, pts] of closes) {
      const p = closeOnOrBefore(pts, d);
      const b = base.get(sym);
      if (p && b && b > 0) { sum += p / b; n++; }
    }
    if (n) index.set(d, (sum / n) * 100);
  }
  return index;
}

function benchmarkCagr(pts: ClosePoint[], start: string, end: string, years: number): number {
  if (!pts.length) return 0;
  const p0 = closeOnOrBefore(pts, start);
  const p1 = closeOnOrBefore(pts, end);
  if (!p0 || !p1 || p0 <= 0) return 0;
  return Math.pow(p1 / p0, 1 / years) - 1;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function closeOnOrBefore(sorted: ClosePoint[], date: string): number | null {
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].date <= date) return sorted[i].close;
  }
  return null;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
