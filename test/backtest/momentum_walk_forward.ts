/**
 * momentum_walk_forward.ts — rigorous out-of-sample validation of the momentum
 * strategy (Initiative 0, walk-forward form).
 *
 * Methodology:
 *  - Fetch ~6y of daily closes for all watchlist symbols.
 *  - Split into rolling test windows (6 months, step 6).
 *  - For each test window, select `topN` AND the hysteresis `band` by sweeping
 *    them on the PRECEDING 24-month training window (out-of-sample parameter
 *    selection — the test window is never used to choose parameters).
 *  - Evaluate the test window with those parameters (net of costs).
 *  - Aggregate all test-window returns → VALIDATED / NOT VALIDATED verdict.
 *
 * Costs are charged on the weight ACTUALLY traded. The earlier version charged
 * a full round trip every month regardless of turnover, which both overstated
 * cost for a strategy that mostly holds and made any turnover reduction
 * impossible to detect.
 *
 * Every return is printed beside Nifty 50 over the same months. A positive
 * number that trails the index is a failure, not a win.
 *
 * Usage:
 *   ENV_FILE=.env.test npx ts-node test/backtest/momentum_walk_forward.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../../src/server/AppConfig';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { ClosePoint, sma, dailyReturnStd, combineMomentumAndVolatility } from '../../src/server/signals/momentum';

const LOOKBACK_MONTHS = 12;
const SKIP_MONTHS = 1;
const TRAIN_MONTHS = 24;
const TEST_MONTHS = 6;
const MIN_OOS_MONTHS = 12;
const YEARS = 6;
const CACHE_DIR = path.join(__dirname, 'results', 'walk_forward', '.cache');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** A single month's realised return, tagged with the date it started. */
interface MonthRet {
  date: string;
  ret: number;
}

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parameter sweep ranges, overridable so the gate can be A/B'd against itself.
 *   BANDS=0            — disable hysteresis, isolating its contribution.
 *   TOPN_MIN=2         — allow portfolios too concentrated to run in production.
 *
 * The topN floor is 5 by default because that is the tightest book the
 * RiskEngine can actually deploy: with a 15% single-stock cap, 4 names reach at
 * most 60% of capital against an 80% target. Sweeping below it validates a
 * strategy we cannot execute — and it scored worse anyway (31.93% for a 2..10
 * sweep versus 36.99% for 5..10).
 */
const BANDS: number[] = (process.env.BANDS ?? '0,2,4,6,8')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n));
const TOPN_MIN = numEnv('TOPN_MIN', 5);
const TOPN_MAX = numEnv('TOPN_MAX', 10);
/**
 * Rebalance cadences to sweep, in months. Defaults to monthly only — the gate's
 * job is to validate what we ship.
 *
 * Cadence is deliberately NOT auto-selected. Letting the training window choose
 * it scored 31.21% out-of-sample, WORSE than every fixed cadence (1m 36.99%,
 * 2m 36.44%, 3m 39.21%, 6m 41.49%): training picked `every = 6` in 6 of 8
 * windows and that choice lost ~6pp live. Longer cadences also make far fewer
 * decisions — 8 rebalances across the whole OOS run at 6m — so their apparent
 * edge is not separable from luck. Set `CADENCES=1,2,3,6` to re-examine.
 */
const CADENCES: number[] = (process.env.CADENCES ?? '1')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n >= 1);

/**
 * Feature flags for A/B testing the master-class overlays against the baseline.
 * These are FIXED features (not swept parameters): the walk-forward still
 * selects topN/band/cadence out-of-sample, and the overlay is applied uniformly
 * across training and test. Run the gate once per configuration and compare.
 */
const DMA_GUARD_ENABLED = process.env.DMA_GUARD === '1';
const DMA_PERIOD = numEnv('DMA_PERIOD', 220);
const FACTOR_TILT = process.env.FACTOR_TILT === 'lowvol' ? 'lowvol' : 'none';
const FACTOR_TILT_WEIGHT = numEnv('FACTOR_TILT_WEIGHT', 0.5);
const FACTOR_VOL_DAYS = numEnv('FACTOR_VOL_DAYS', 252);

/** One-way cost as a fraction of notional (mirrors PaperTrader). */
function oneWayCostPct(): number {
  const c = loadConfig().costs;
  const brokerage = Math.min(c.brokerageBps / 10000, c.brokerageMax / 10000);
  const statutory = c.statutoryBps / 10000;
  const slippage = c.slippageBps / 10000;
  const gst = brokerage * c.gstPct / 100;
  return brokerage + statutory + slippage + gst;
}

/**
 * Monthly returns over the given rebalance dates.
 *
 * Holdings are carried across rebalances so turnover is real: a name that stays
 * in the target is not sold and re-bought, and therefore costs nothing. With
 * `band > 0` an incumbent keeps its slot until it falls out of the top
 * `topN + band`, which is what makes a slow signal cheap to run.
 *
 * `every > 1` rebalances less often while still marking the book to market
 * every month, so returns stay monthly and comparable across cadences — only
 * the decision frequency changes.
 */
function runMomentum(
  closesBySymbol: Map<string, ClosePoint[]>,
  rebalanceDates: string[],
  topN: number,
  oneWay: number,
  band = 0,
  every = 1,
): MonthRet[] {
  const returns: MonthRet[] = [];
  // Weights of the current book, summing to <= 1.
  let weights = new Map<string, number>();

  for (let i = 0; i < rebalanceDates.length; i++) {
    const rebalDate = rebalanceDates[i];
    const nextDate = rebalanceDates[i + 1];
    if (!nextDate) break;

    // Always rebalance on the first month; thereafter only every `every` months.
    const isRebalance = i % every === 0 || weights.size === 0;
    let cost = 0;
    let next: Map<string, number>;

    if (isRebalance) {
      const skipDate = addMonths(rebalDate, -SKIP_MONTHS);
      const lookbackDate = addMonths(rebalDate, -(LOOKBACK_MONTHS + SKIP_MONTHS));

      const scored: Array<{ symbol: string; mom: number }> = [];
      const volBySymbol = new Map<string, number | null>();
      for (const [sym, pts] of closesBySymbol) {
        const start = closeOnOrBefore(pts, lookbackDate);
        const end = closeOnOrBefore(pts, skipDate);
        if (!start || !end || start <= 0) continue;

        // DMA trend guard: drop names whose close is below their SMA at the
        // rebalance date (the master-class 200/220-DMA rule).
        if (DMA_GUARD_ENABLED) {
          const upTo = pts.filter((p) => p.date <= rebalDate);
          const avg = sma(upTo, DMA_PERIOD);
          const last = closeOnOrBefore(pts, rebalDate);
          if (avg !== null && last !== null && last < avg) continue;
        }

        scored.push({ symbol: sym, mom: end / start - 1 });

        if (FACTOR_TILT === 'lowvol') {
          const upTo = pts.filter((p) => p.date <= rebalDate);
          volBySymbol.set(sym, dailyReturnStd(upTo, FACTOR_VOL_DAYS));
        }
      }
      if (scored.length < topN) continue;

      // Factor tilt: blend momentum with low-volatility via cross-sectional ranks.
      if (FACTOR_TILT === 'lowvol') {
        const combined = combineMomentumAndVolatility(
          scored.map((s) => ({ symbol: s.symbol, momentum: s.mom, volatility: volBySymbol.get(s.symbol) ?? null })),
          FACTOR_TILT_WEIGHT,
        );
        scored.length = 0;
        for (const c of combined) scored.push({ symbol: c.symbol, mom: c.momentum });
      } else {
        scored.sort((a, b) => b.mom - a.mom);
      }
      const rank = new Map(scored.map((s, idx) => [s.symbol, idx]));

      // Target set: incumbents survive while inside the wider band, then the
      // remaining slots are filled from the top of the ranking.
      const target = new Set<string>();
      for (const sym of weights.keys()) {
        const r = rank.get(sym);
        if (r !== undefined && r < topN + band) target.add(sym);
      }
      for (const s of scored) {
        if (target.size >= topN) break;
        target.add(s.symbol);
      }
      if (target.size > topN) {
        const ordered = [...target].sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
        target.clear();
        for (const s of ordered.slice(0, topN)) target.add(s);
      }

      // Rebalance to equal weight; cost only the weight that actually moves.
      const targetWeight = 1 / target.size;
      next = new Map<string, number>();
      for (const sym of target) next.set(sym, targetWeight);

      let traded = 0;
      const universe = new Set([...weights.keys(), ...next.keys()]);
      for (const sym of universe) {
        traded += Math.abs((next.get(sym) ?? 0) - (weights.get(sym) ?? 0));
      }
      cost = traded * oneWay;
    } else {
      // Hold: no decision, no trade, no cost.
      next = weights;
    }

    // Carry the book one period forward.
    let gross = 0;
    let invested = 0;
    const drifted = new Map<string, number>();
    for (const [sym, w] of next) {
      const pts = closesBySymbol.get(sym)!;
      const entry = closeOnOrBefore(pts, rebalDate);
      const exit = closeOnOrBefore(pts, nextDate);
      if (entry && exit && entry > 0) {
        const r = exit / entry - 1;
        gross += w * r;
        invested += w;
        drifted.set(sym, w * (1 + r));
      }
    }
    if (invested === 0) continue;

    // Renormalise the drifted weights so the next period compares like for like.
    const total = [...drifted.values()].reduce((s, w) => s + w, 0);
    weights = new Map([...drifted].map(([s, w]) => [s, w / total]));

    returns.push({ date: rebalDate, ret: gross / invested - cost });
  }
  return returns;
}

/** Best (topN, band, every) on a training window — highest annualized. */
function bestParams(
  closesBySymbol: Map<string, ClosePoint[]>,
  rebalanceDates: string[],
  oneWay: number,
): { topN: number; band: number; every: number } {
  let best = { topN: TOPN_MIN, band: BANDS[0] ?? 0, every: CADENCES[0] ?? 1 };
  let bestAnn = -Infinity;
  for (let n = TOPN_MIN; n <= TOPN_MAX; n++) {
    for (const band of BANDS) {
      for (const every of CADENCES) {
        const rets = runMomentum(closesBySymbol, rebalanceDates, n, oneWay, band, every);
        const avg = rets.length ? rets.reduce((s, r) => s + r.ret, 0) / rets.length : 0;
        const ann = Math.pow(1 + avg, 12) - 1;
        if (ann > bestAnn) {
          bestAnn = ann;
          best = { topN: n, band, every };
        }
      }
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Data                                                                 */
/* ------------------------------------------------------------------ */

/** Daily closes for the watchlist, cached on disk for 24h. */
async function loadCloses(symbols: string[]): Promise<Map<string, ClosePoint[]>> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, `closes_${YEARS}y_${symbols.length}.json`);
  if (fs.existsSync(cacheFile) && Date.now() - fs.statSync(cacheFile).mtimeMs < CACHE_TTL_MS) {
    console.log('Using cached history (< 24h old).');
    const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as Record<string, ClosePoint[]>;
    return new Map(Object.entries(raw));
  }

  const config = loadConfig();
  const provider = createHistoricalProvider(config);
  const to = new Date();
  const from = new Date(to.getTime() - YEARS * 365 * 24 * 60 * 60 * 1000);
  console.log(`Fetching daily data for ${symbols.length} symbols (${YEARS}y)...`);

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
  if (fs.existsSync(cacheFile) && Date.now() - fs.statSync(cacheFile).mtimeMs < CACHE_TTL_MS) {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as ClosePoint[];
  }
  try {
    const config = loadConfig();
    const provider = createHistoricalProvider(config);
    const to = new Date();
    const from = new Date(to.getTime() - YEARS * 365 * 24 * 60 * 60 * 1000);
    // Any exchange other than NSE/BSE passes the symbol through unsuffixed.
    const inst = provider.findInstrument('^NSEI', 'INDEX' as 'NSE');
    if (!inst) return [];
    const candles = await provider.getHistoricalData(inst.instrument_token, 'day', from, to);
    const pts = candles
      .map((c) => ({ date: c.date.toISOString().slice(0, 10), close: c.close }))
      .filter((p) => Number.isFinite(p.close) && p.close > 0)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    fs.writeFileSync(cacheFile, JSON.stringify(pts));
    return pts;
  } catch {
    return [];
  }
}

/**
 * Buy-and-hold return of `pts` over each [date, nextDate) pair, keyed by the
 * start date so it can be aligned against strategy months exactly.
 */
function benchmarkMonths(pts: ClosePoint[], rebalanceDates: string[]): Map<string, number> {
  const out = new Map<string, number>();
  if (pts.length === 0) return out;
  for (let i = 0; i < rebalanceDates.length - 1; i++) {
    const a = closeOnOrBefore(pts, rebalanceDates[i]);
    const b = closeOnOrBefore(pts, rebalanceDates[i + 1]);
    if (a && b && a > 0) out.set(rebalanceDates[i], b / a - 1);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const config = loadConfig();
  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);

  const closesBySymbol = await loadCloses(symbols);
  console.log(`Fetched ${closesBySymbol.size}/${symbols.length} symbols.`);
  const nifty = await loadNifty();
  if (nifty.length === 0) {
    console.warn('WARNING: Nifty 50 history unavailable — benchmark comparison skipped.');
  }

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

  const oneWay = oneWayCostPct();
  const niftyByMonth = benchmarkMonths(nifty, rebalanceDates);
  const oosReturns: MonthRet[] = [];
  const windows: Array<{
    train: string;
    test: string;
    topN: number;
    band: number;
    every: number;
    rets: MonthRet[];
  }> = [];

  // Rolling test windows of TEST_MONTHS, stepping TEST_MONTHS.
  for (let i = 0; i < rebalanceDates.length; i += TEST_MONTHS) {
    const testStart = rebalanceDates[i];
    const testEndIdx = i + TEST_MONTHS;
    if (testEndIdx >= rebalanceDates.length) break;
    const testEnd = rebalanceDates[testEndIdx];

    const trainStartIdx = i - TRAIN_MONTHS;
    if (trainStartIdx < 0) continue; // need 24 months of training before test
    const trainStart = rebalanceDates[trainStartIdx];
    const trainEnd = testStart;

    const trainDates = rebalanceDates.filter((d) => d >= trainStart && d < trainEnd);
    const testDates = rebalanceDates.filter((d) => d >= testStart && d <= testEnd);
    if (trainDates.length < 12 || testDates.length < 3) continue;

    const { topN, band, every } = bestParams(closesBySymbol, trainDates, oneWay);
    const rets = runMomentum(closesBySymbol, testDates, topN, oneWay, band, every);
    oosReturns.push(...rets);
    windows.push({ train: trainStart, test: testStart, topN, band, every, rets });

    const avg = rets.length ? (rets.reduce((s, r) => s + r.ret, 0) / rets.length) * 100 : 0;
    const bench =
      rets.reduce((s, r) => s + (niftyByMonth.get(r.date) ?? 0), 0) * 100;
    console.log(
      `  window test=${testStart} topN=${topN} band=${band} every=${every}m months=${rets.length} ` +
        `avg=${avg.toFixed(2)}% total=${(rets.reduce((s, r) => s + r.ret, 0) * 100).toFixed(2)}% ` +
        `nifty=${bench.toFixed(2)}%`,
    );
  }

  const n = oosReturns.length;
  const total = oosReturns.reduce((s, r) => s + r.ret, 0);
  const avg = n ? total / n : 0;
  const positive = oosReturns.filter((r) => r.ret > 0).length;
  const annualized = Math.pow(1 + avg, 12) - 1;
  const positiveWindows = windows.filter(
    (w) => w.rets.reduce((s, r) => s + r.ret, 0) > 0,
  ).length;

  // Nifty over exactly the same months, so the comparison is like for like.
  const benchMonths = oosReturns
    .map((r) => niftyByMonth.get(r.date))
    .filter((v): v is number => v !== undefined);
  const benchAvg = benchMonths.length
    ? benchMonths.reduce((s, r) => s + r, 0) / benchMonths.length
    : 0;
  const benchAnn = Math.pow(1 + benchAvg, 12) - 1;

  // Which parameters the OOS procedure actually chose, so we can see whether an
  // overlay survives selection rather than being asserted.
  const tally = (pick: (w: (typeof windows)[number]) => number): string => {
    const counts = new Map<number, number>();
    for (const w of windows) counts.set(pick(w), (counts.get(pick(w)) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([v, c]) => `${v}:${c}`)
      .join(' ');
  };
  const avgBand = windows.length
    ? windows.reduce((s, w) => s + w.band, 0) / windows.length
    : 0;

  console.log('\n==============================================================');
  console.log('  MOMENTUM WALK-FORWARD (out-of-sample)');
  console.log(
    `  OOS months: ${n} | Windows: ${windows.length} | One-way cost: ${(oneWay * 100).toFixed(3)}%`,
  );
  console.log(`  Sweep: topN ${TOPN_MIN}..${TOPN_MAX} × band [${BANDS.join(',')}] × every [${CADENCES.join(',')}]m`);
  console.log(
    `  Features: DMA guard=${DMA_GUARD_ENABLED ? `on(${DMA_PERIOD})` : 'off'} | factor tilt=${FACTOR_TILT}${FACTOR_TILT === 'lowvol' ? `(w=${FACTOR_TILT_WEIGHT})` : ''}`,
  );
  console.log(`  Avg monthly return (net): ${(avg * 100).toFixed(2)}%`);
  console.log(`  Annualized (net, pre-tax): ${(annualized * 100).toFixed(2)}%`);
  console.log(`  Nifty 50, same months:      ${(benchAnn * 100).toFixed(2)}%`);
  console.log(`  Excess over Nifty:          ${((annualized - benchAnn) * 100).toFixed(2)}pp`);
  console.log(`  Positive months: ${positive}/${n} (${((positive / n) * 100).toFixed(0)}%)`);
  console.log(`  Positive windows: ${positiveWindows}/${windows.length}`);
  console.log(`  Hysteresis band chosen OOS: avg=${avgBand.toFixed(1)} (band:count ${tally((w) => w.band)})`);
  console.log(`  Cadence chosen OOS (months): ${tally((w) => w.every)}`);
  console.log(`  topN chosen OOS:             ${tally((w) => w.topN)}`);
  console.log('==============================================================');

  const reasons: string[] = [];
  if (n < MIN_OOS_MONTHS) reasons.push(`only ${n} OOS months (need >= ${MIN_OOS_MONTHS})`);
  if (avg <= 0) reasons.push(`net OOS expectancy ${(avg * 100).toFixed(2)}% (<= 0)`);
  if (total <= 0) reasons.push(`net OOS return ${(total * 100).toFixed(2)}% (<= 0)`);
  if (windows.length > 0 && positiveWindows / windows.length <= 0.5) {
    reasons.push(`edge in only ${((positiveWindows / windows.length) * 100).toFixed(0)}% of windows (<= 50%)`);
  }
  if (benchMonths.length > 0 && annualized <= benchAnn) {
    reasons.push(
      `does not beat Nifty 50 (${(annualized * 100).toFixed(2)}% vs ${(benchAnn * 100).toFixed(2)}%)`,
    );
  }
  const verdict = reasons.length === 0 ? 'VALIDATED' : 'NOT VALIDATED';
  console.log(`\n  VERDICT: ${verdict}`);
  reasons.forEach((r) => console.log(`    - ${r}`));
  console.log('Caveat: current-listed universe only; survivorship-bias floor measured at ~0.5pp (npm run estimate:survivorship).');
  if (verdict !== 'VALIDATED') process.exitCode = 1;
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

main().catch((err) => {
  console.error('momentum_walk_forward failed:', err);
  process.exit(1);
});
