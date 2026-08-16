/**
 * leak_attribution.ts — where does the money actually go? (Plan Phase 0.1)
 *
 * The validated signal and the money in the account are two very different
 * numbers, and until now the difference was a hand-waved list. This produces the
 * waterfall with real numbers: it runs the SAME strategy over the SAME window
 * repeatedly, switching on one real-world friction at a time, and reports what
 * each one costs.
 *
 *   Gross signal          top-N equal weight, 100% deployed, frictionless
 *     - trading costs     brokerage + STT + slippage + GST, on real turnover
 *     - cash reserve      MIN_CASH_RESERVE_PCT never leaves the account
 *     - single-stock cap  MAX_SINGLE_STOCK_PCT strands capital when it binds
 *     - AI news veto      vetoed names are skipped; survivors absorb the slack
 *     - capital gains tax STCG/LTCG, netted per financial year
 *   = Take-home
 *
 * Each step is a NAMED cause with a rupee and percentage-point figure, which is
 * the whole point: "we lose ~17 points somewhere" is not actionable, "the cash
 * reserve costs 4.1pp and the cap costs 0.3pp" is.
 *
 * HONEST LIMITS
 *  - The news veto uses a deterministic proxy (a sharp 5-day drop), not real
 *    historical sentiment, which we do not have for a 5-year window. It measures
 *    the MECHANISM's cost, not this specific LLM's skill. Plan item 1.3 governs
 *    when the threshold may actually be tuned; do not tune it on this.
 *  - Current-listed universe only (survivorship bias, plan item 0.3).
 *
 * Usage:
 *   ENV_FILE=.env.test LOG_LEVEL=silent npx ts-node test/backtest/leak_attribution.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../../src/server/AppConfig';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { ClosePoint, MomentumScore, selectWithHysteresis } from '../../src/server/signals/momentum';
import { bucketRealizedGains, estimateTax, financialYear } from '../../src/server/Tax';

const LOOKBACK_MONTHS = 12;
const SKIP_MONTHS = 1;
const OUT_DIR = path.join(__dirname, 'results', 'leak_attribution');
const CACHE_DIR = path.join(__dirname, 'results', 'strategy_lab', '.cache');

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const YEARS = numEnv('YEARS', 5);
const CAPITAL = numEnv('CAPITAL', 500_000);

/* ------------------------------------------------------------------ */
/* Simulation                                                          */
/* ------------------------------------------------------------------ */

/** Which frictions are switched on for this run. */
interface Frictions {
  costs: boolean;
  cashReserve: boolean;
  singleStockCap: boolean;
  newsVeto: boolean;
  tax: boolean;
}

const NONE: Frictions = {
  costs: false,
  cashReserve: false,
  singleStockCap: false,
  newsVeto: false,
  tax: false,
};

interface Lot {
  /** Rupees currently invested in this name. */
  value: number;
  /** Cost basis of the position. */
  cost: number;
  /** When the lot was opened, for the holding-period clock. */
  entryDate: string;
}

interface SimResult {
  finalEquity: number;
  cagr: number;
  /** Total tax paid across the run. */
  tax: number;
  /** Average share of capital actually invested. */
  avgExposure: number;
  /** Average |Δweight| traded per rebalance. */
  avgTurnover: number;
}

/**
 * Deterministic "bad news" proxy: a sharp recent drop stands in for the negative
 * headline that would have produced it. Mirrors `momentum_news_backtest.ts` so
 * the two agree on what the veto mechanism costs.
 */
function newsProxy(pts: ClosePoint[], date: string): number {
  let idx = -1;
  for (let i = pts.length - 1; i >= 0; i--) {
    if (pts[i].date <= date) {
      idx = i;
      break;
    }
  }
  if (idx < 5) return 0;
  const prior = pts[idx - 5].close;
  if (prior <= 0) return 0;
  return pts[idx].close / prior - 1 < -0.08 ? -0.5 : 0;
}

function simulate(
  closes: Map<string, ClosePoint[]>,
  rebalanceDates: string[],
  opts: {
    topN: number;
    band: number;
    oneWayCost: number;
    cashReservePct: number;
    singleStockPct: number;
    vetoThreshold: number;
    frictions: Frictions;
  },
): SimResult {
  const f = opts.frictions;
  let cash = CAPITAL;
  const holdings = new Map<string, Lot>();

  // Realized gains per financial year, split by holding period.
  const closedLots: Array<{ entryISO: string; exitISO: string; pnl: number }> = [];
  const paidByFy = new Map<string, number>();
  let taxPaid = 0;

  let turnoverSum = 0;
  let exposureSum = 0;
  let periods = 0;

  for (let i = 0; i < rebalanceDates.length - 1; i++) {
    const date = rebalanceDates[i];
    const next = rebalanceDates[i + 1];

    /* --- rank ------------------------------------------------------ */
    const skipDate = addMonths(date, -SKIP_MONTHS);
    const lookbackDate = addMonths(date, -(LOOKBACK_MONTHS + SKIP_MONTHS));
    const scored: MomentumScore[] = [];
    for (const [sym, pts] of closes) {
      const start = closeOnOrBefore(pts, lookbackDate);
      const end = closeOnOrBefore(pts, skipDate);
      const now = closeOnOrBefore(pts, date);
      if (start && end && now && start > 0) scored.push({ symbol: sym, momentum: end / start - 1 });
    }
    if (scored.length < opts.topN) continue;
    scored.sort((a, b) => b.momentum - a.momentum);

    let target = selectWithHysteresis(scored, holdings.keys(), opts.topN, opts.band);

    /* --- AI news veto ---------------------------------------------- */
    if (f.newsVeto) {
      target = target.filter((sym) => {
        const pts = closes.get(sym);
        return !pts || newsProxy(pts, date) >= opts.vetoThreshold;
      });
      if (target.length === 0) target = [];
    }

    /* --- size ------------------------------------------------------ */
    const equity = cash + [...holdings.values()].reduce((s, h) => s + h.value, 0);
    // Only the deployable slice is spread across slots; the reserve stays put.
    const deployable = f.cashReserve ? equity * (1 - opts.cashReservePct / 100) : equity;
    let perName = target.length > 0 ? deployable / target.length : 0;
    if (f.singleStockCap) {
      perName = Math.min(perName, (equity * opts.singleStockPct) / 100);
    }

    const wanted = new Map<string, number>();
    for (const sym of target) wanted.set(sym, perName);

    let traded = 0;

    // Sells first, so the proceeds fund the buys.
    for (const [sym, lot] of [...holdings]) {
      const want = wanted.get(sym) ?? 0;
      if (want >= lot.value) continue;
      const sellValue = lot.value - want;
      const frac = sellValue / lot.value;
      const realized = sellValue - lot.cost * frac;
      closedLots.push({
        entryISO: `${lot.entryDate}T00:00:00Z`,
        exitISO: `${date}T00:00:00Z`,
        pnl: realized,
      });
      const cost = f.costs ? sellValue * opts.oneWayCost : 0;
      cash += sellValue - cost;
      traded += sellValue;
      lot.cost *= 1 - frac;
      lot.value = want;
      if (lot.value <= 1) holdings.delete(sym);
    }

    // Then buys.
    for (const [sym, want] of wanted) {
      const have = holdings.get(sym)?.value ?? 0;
      if (want <= have) continue;
      const buyValue = Math.min(want - have, cash);
      if (buyValue <= 1) continue;
      const cost = f.costs ? buyValue * opts.oneWayCost : 0;
      cash -= buyValue + cost;
      traded += buyValue;
      const lot = holdings.get(sym);
      if (lot) {
        lot.value += buyValue;
        lot.cost += buyValue;
      } else {
        holdings.set(sym, { value: buyValue, cost: buyValue, entryDate: date });
      }
    }

    /* --- carry to the next rebalance ------------------------------- */
    const invested = [...holdings.values()].reduce((s, h) => s + h.value, 0);
    if (equity > 0) {
      exposureSum += invested / equity;
      turnoverSum += traded / equity;
      periods++;
    }

    for (const [sym, lot] of holdings) {
      const pts = closes.get(sym);
      if (!pts) continue;
      const p0 = closeOnOrBefore(pts, date);
      const p1 = closeOnOrBefore(pts, next);
      if (p0 && p1 && p0 > 0) lot.value *= p1 / p0;
    }

    /* --- pay tax at each financial year end ------------------------ */
    if (f.tax && financialYear(next) !== financialYear(date)) {
      const fy = financialYear(date);
      const gains = bucketRealizedGains(closedLots);
      const owed = estimateTax(gains, fy).tax - (paidByFy.get(fy) ?? 0);
      if (owed > 0) {
        // Tax leaves the book, exactly as it leaves a real account.
        const take = Math.min(owed, cash);
        cash -= take;
        taxPaid += take;
        paidByFy.set(fy, (paidByFy.get(fy) ?? 0) + take);
      }
      closedLots.length = 0;
    }
  }

  const finalEquity = cash + [...holdings.values()].reduce((s, h) => s + h.value, 0);
  const years =
    (new Date(rebalanceDates[rebalanceDates.length - 1]).getTime() -
      new Date(rebalanceDates[0]).getTime()) /
    (365.25 * 24 * 3600 * 1000);
  return {
    finalEquity,
    cagr: Math.pow(finalEquity / CAPITAL, 1 / years) - 1,
    tax: taxPaid,
    avgExposure: periods ? exposureSum / periods : 0,
    avgTurnover: periods ? turnoverSum / periods : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

async function loadCloses(symbols: string[]): Promise<Map<string, ClosePoint[]>> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  // Shares the strategy_lab cache — same window, same symbols, same shape.
  const cacheFile = path.join(CACHE_DIR, `closes_${YEARS}y_${symbols.length}.json`);
  if (fs.existsSync(cacheFile) && Date.now() - fs.statSync(cacheFile).mtimeMs < 86_400_000) {
    console.log('Using cached history (< 24h old).');
    const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as Record<string, ClosePoint[]>;
    return new Map(Object.entries(raw));
  }
  const config = loadConfig();
  const provider = createHistoricalProvider(config);
  const to = new Date();
  const from = new Date(to.getTime() - YEARS * 365 * 24 * 3600 * 1000);
  console.log(`Fetching ${YEARS}y of daily history for ${symbols.length} symbols...`);
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
      if (pts.length > 300) out.set(sym, pts);
    } catch {
      /* unavailable — skip */
    }
  }
  fs.writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(out)));
  return out;
}

async function loadNiftyCagr(rebalanceDates: string[]): Promise<number | null> {
  const cacheFile = path.join(CACHE_DIR, `nifty_${YEARS}y.json`);
  let pts: ClosePoint[] = [];
  if (fs.existsSync(cacheFile)) {
    pts = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as ClosePoint[];
  } else {
    try {
      const config = loadConfig();
      const provider = createHistoricalProvider(config);
      const to = new Date();
      const from = new Date(to.getTime() - YEARS * 365 * 24 * 3600 * 1000);
      const inst = provider.findInstrument('^NSEI', 'INDEX' as 'NSE');
      if (!inst) return null;
      const candles = await provider.getHistoricalData(inst.instrument_token, 'day', from, to);
      pts = candles
        .map((c) => ({ date: c.date.toISOString().slice(0, 10), close: c.close }))
        .filter((p) => Number.isFinite(p.close) && p.close > 0)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(pts));
    } catch {
      return null;
    }
  }
  const p0 = closeOnOrBefore(pts, rebalanceDates[0]);
  const p1 = closeOnOrBefore(pts, rebalanceDates[rebalanceDates.length - 1]);
  if (!p0 || !p1 || p0 <= 0) return null;
  const years =
    (new Date(rebalanceDates[rebalanceDates.length - 1]).getTime() -
      new Date(rebalanceDates[0]).getTime()) /
    (365.25 * 24 * 3600 * 1000);
  return Math.pow(p1 / p0, 1 / years) - 1;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const config = loadConfig();
  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);
  const closes = await loadCloses(symbols);
  console.log(`Loaded ${closes.size} symbols.`);

  const allDates = new Set<string>();
  for (const pts of closes.values()) for (const p of pts) allDates.add(p.date);
  const dates = [...allDates].sort();
  const byMonth = new Map<string, string>();
  for (const d of dates) if (!byMonth.has(d.slice(0, 7))) byMonth.set(d.slice(0, 7), d);
  const rebalDates = [...byMonth.values()].sort();
  // Skip the first 13 months: the 12-month lookback needs history behind it.
  const usable = rebalDates.slice(LOOKBACK_MONTHS + SKIP_MONTHS);

  const c = config.costs;
  const brokerage = Math.min(c.brokerageBps / 10000, c.brokerageMax / 10000);
  const oneWayCost =
    brokerage + c.statutoryBps / 10000 + c.slippageBps / 10000 + (brokerage * c.gstPct) / 100;

  const base = {
    topN: config.strategy.momentumTopN,
    band: config.strategy.momentumHysteresisBand,
    oneWayCost,
    cashReservePct: config.risk.minCashReservePct,
    singleStockPct: config.risk.maxSingleStockPct,
    vetoThreshold: config.strategy.newsVetoThreshold,
  };

  console.log(`\nWindow: ${usable[0]} → ${usable[usable.length - 1]} (${usable.length} rebalances)`);
  console.log(
    `Config: topN=${base.topN} band=${base.band} cashReserve=${base.cashReservePct}% ` +
      `singleStockCap=${base.singleStockPct}% veto<${base.vetoThreshold} oneWayCost=${(oneWayCost * 100).toFixed(3)}%`,
  );

  // Each stage switches on exactly one more friction, cumulatively.
  const stages: Array<{ label: string; frictions: Frictions; note: string }> = [
    { label: 'Gross signal', frictions: { ...NONE }, note: '100% deployed, frictionless' },
    {
      label: '− Trading costs',
      frictions: { ...NONE, costs: true },
      note: 'brokerage + STT + slippage + GST on real turnover',
    },
    {
      label: '− Cash reserve',
      frictions: { ...NONE, costs: true, cashReserve: true },
      note: `MIN_CASH_RESERVE_PCT = ${base.cashReservePct}%`,
    },
    {
      label: '− Single-stock cap',
      frictions: { ...NONE, costs: true, cashReserve: true, singleStockCap: true },
      note: `MAX_SINGLE_STOCK_PCT = ${base.singleStockPct}%`,
    },
    {
      label: '− AI news veto',
      frictions: { ...NONE, costs: true, cashReserve: true, singleStockCap: true, newsVeto: true },
      note: 'PROXY, not real sentiment — measures the mechanism, not the LLM',
    },
    {
      label: '− Capital gains tax',
      frictions: { costs: true, cashReserve: true, singleStockCap: true, newsVeto: true, tax: true },
      note: 'STCG 20% / LTCG 12.5%, netted per financial year',
    },
  ];

  const results = stages.map((s) => ({
    ...s,
    result: simulate(closes, usable, { ...base, frictions: s.frictions }),
  }));

  const niftyCagr = await loadNiftyCagr(usable);
  const gross = results[0].result.cagr;
  const takeHome = results[results.length - 1].result.cagr;

  /* --- report ----------------------------------------------------- */
  const L: string[] = [];
  const push = (s: string) => {
    L.push(s);
    console.log(s);
  };

  push('');
  push('='.repeat(100));
  push('  LEAK ATTRIBUTION — gross signal to take-home');
  push('='.repeat(100));
  push('  Stage                   CAGR      Δ vs prior   Final equity     Exposure  Turn/reb');
  push('  ' + '-'.repeat(96));

  let prior: number | null = null;
  for (const r of results) {
    const delta = prior === null ? '—' : `${((r.result.cagr - prior) * 100).toFixed(2)}pp`;
    push(
      `  ${r.label.padEnd(22)} ${(r.result.cagr * 100).toFixed(2).padStart(7)}%  ` +
        `${delta.padStart(11)}   ${inr(r.result.finalEquity).padStart(13)}   ` +
        `${(r.result.avgExposure * 100).toFixed(0).padStart(6)}%   ${(r.result.avgTurnover * 100).toFixed(0).padStart(6)}%`,
    );
    prior = r.result.cagr;
  }
  push('  ' + '-'.repeat(96));
  push(`  Total leak             ${((takeHome - gross) * 100).toFixed(2).padStart(7)}pp`);
  if (niftyCagr !== null) {
    push(`  Nifty 50 (same window) ${(niftyCagr * 100).toFixed(2).padStart(7)}%`);
    push(
      `  Take-home vs Nifty     ${((takeHome - niftyCagr) * 100).toFixed(2).padStart(7)}pp  ` +
        `${takeHome > niftyCagr ? '← the bot justifies its existence' : '← AN INDEX FUND WOULD HAVE DONE BETTER'}`,
    );
  }
  push('='.repeat(100));

  push('');
  push('  Leak breakdown (share of the total gap):');
  const totalLeak = gross - takeHome;
  prior = gross;
  for (const r of results.slice(1)) {
    const cost = prior - r.result.cagr;
    const share = totalLeak !== 0 ? (cost / totalLeak) * 100 : 0;
    const bar = '█'.repeat(Math.max(0, Math.round(Math.abs(share) / 3)));
    push(
      `    ${r.label.replace('− ', '').padEnd(20)} ${(cost * 100).toFixed(2).padStart(6)}pp  ` +
        `${share.toFixed(0).padStart(4)}%  ${bar}`,
    );
    prior = r.result.cagr;
  }
  push('');
  push(`  Tax paid over the run: ${inr(results[results.length - 1].result.tax)}`);
  push('');
  push('  Caveats: current-listed universe (survivorship bias, plan 0.3); the news');
  push('  veto uses a deterministic proxy, so its line measures the MECHANISM\'s cost,');
  push('  not this LLM\'s skill (plan 1.3 governs tuning the threshold).');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, 'leak_attribution.md');
  fs.writeFileSync(
    outFile,
    `# Leak Attribution — gross signal to take-home\n\n` +
      `Generated ${new Date().toISOString()}\n\n` +
      `Window: ${usable[0]} → ${usable[usable.length - 1]} · ${closes.size} symbols · ` +
      `capital ₹${CAPITAL.toLocaleString('en-IN')}\n\n` +
      '```\n' +
      L.join('\n') +
      '\n```\n',
  );
  console.log(`\nReport: ${path.relative(process.cwd(), outFile)}`);
}

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function closeOnOrBefore(pts: ClosePoint[], date: string): number | null {
  for (let i = pts.length - 1; i >= 0; i--) {
    if (pts[i].date <= date) return pts[i].close;
  }
  return null;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
