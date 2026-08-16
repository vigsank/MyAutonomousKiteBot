/**
 * survivorship_bias.ts — Phase 0.3. Put a NUMBER on the survivorship-bias risk.
 *
 * Every headline in this project (+19% to +37% annualized) is measured on the
 * CURRENT watchlist — names that survived to today. A momentum strategy is
 * especially exposed to this: it buys winners, and "winner that later delisted"
 * is exactly the population a current-listed universe cannot contain.
 *
 * We cannot cheaply reconstruct historical NSE membership, so we BOUND the bias
 * instead of pretending it away. The bound:
 *
 *   1. Full universe   — run the strategy on every current symbol (the number
 *                        we report today).
 *   2. Frozen universe — run the SAME strategy over the SAME months, but only
 *                        on symbols that already had >= LOOKBACK+SKIP months of
 *                        price history as of the window start. This drops names
 *                        that listed part-way through, which is where fresh
 *                        survivors enter and inflate returns.
 *
 * The gap between the two is a conservative, same-data estimate of how much of
 * the edge depends on names that were not investable at decision time. It is a
 * FLOOR on the true survivorship effect (it still cannot see delisted names),
 * reported so "optimistic, accepted" becomes "optimistic by ~X pp, accepted".
 *
 * Usage:
 *   ENV_FILE=.env.test npx ts-node test/backtest/survivorship_bias.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../../src/server/AppConfig';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { ClosePoint } from '../../src/server/signals/momentum';

const LOOKBACK_MONTHS = 12;
const SKIP_MONTHS = 1;
const YEARS = 6;
const CACHE_DIR = path.join(__dirname, 'results', 'walk_forward', '.cache');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const OUT_DIR = path.join(__dirname, 'results');

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

// Shipped config — the strategy we actually run (topN=6, band=8, monthly).
const TOP_N = numEnv('TOP_N', 6);
const BAND = numEnv('BAND', 8);

interface MonthRet {
  date: string;
  ret: number;
}

/** One-way cost as a fraction of notional (mirrors PaperTrader). */
function oneWayCostPct(): number {
  const c = loadConfig().costs;
  const brokerage = Math.min(c.brokerageBps / 10000, c.brokerageMax / 10000);
  const statutory = c.statutoryBps / 10000;
  const slippage = c.slippageBps / 10000;
  const gst = (brokerage * c.gstPct) / 100;
  return brokerage + statutory + slippage + gst;
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

/**
 * Monthly returns over `rebalanceDates`. Identical engine to the walk-forward
 * gate (weights carried across rebalances, cost charged on Σ|Δw|, hysteresis
 * band), with one addition: `eligible(sym, date)` gates whether a symbol may be
 * SCORED at a given rebalance. The frozen run passes a predicate that only
 * admits names already listed before the window; the full run admits everyone.
 */
function runMomentum(
  closesBySymbol: Map<string, ClosePoint[]>,
  rebalanceDates: string[],
  topN: number,
  oneWay: number,
  band: number,
  eligible: (sym: string, date: string) => boolean,
): MonthRet[] {
  const returns: MonthRet[] = [];
  let weights = new Map<string, number>();

  for (let i = 0; i < rebalanceDates.length; i++) {
    const rebalDate = rebalanceDates[i];
    const nextDate = rebalanceDates[i + 1];
    if (!nextDate) break;

    const skipDate = addMonths(rebalDate, -SKIP_MONTHS);
    const lookbackDate = addMonths(rebalDate, -(LOOKBACK_MONTHS + SKIP_MONTHS));

    const scored: Array<{ symbol: string; mom: number }> = [];
    for (const [sym, pts] of closesBySymbol) {
      if (!eligible(sym, rebalDate)) continue;
      const start = closeOnOrBefore(pts, lookbackDate);
      const end = closeOnOrBefore(pts, skipDate);
      if (start && end && start > 0) scored.push({ symbol: sym, mom: end / start - 1 });
    }
    if (scored.length < topN) continue;
    scored.sort((a, b) => b.mom - a.mom);
    const rank = new Map(scored.map((s, idx) => [s.symbol, idx]));

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

    const targetWeight = 1 / target.size;
    const next = new Map<string, number>();
    for (const sym of target) next.set(sym, targetWeight);

    let traded = 0;
    const universe = new Set([...weights.keys(), ...next.keys()]);
    for (const sym of universe) {
      traded += Math.abs((next.get(sym) ?? 0) - (weights.get(sym) ?? 0));
    }
    const cost = traded * oneWay;

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

    const total = [...drifted.values()].reduce((s, w) => s + w, 0);
    weights = new Map([...drifted].map(([s, w]) => [s, w / total]));
    returns.push({ date: rebalDate, ret: gross / invested - cost });
  }
  return returns;
}

/** Earliest close date we hold for each symbol — a proxy for its listing date. */
function firstDateBySymbol(closes: Map<string, ClosePoint[]>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [sym, pts] of closes) if (pts.length) out.set(sym, pts[0].date);
  return out;
}

/** Daily closes for the watchlist, cached on disk (shares the gate's cache). */
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

function annualize(rets: MonthRet[]): number {
  if (!rets.length) return 0;
  const avg = rets.reduce((s, r) => s + r.ret, 0) / rets.length;
  return Math.pow(1 + avg, 12) - 1;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);
  const closes = await loadCloses(symbols);
  console.log(`Loaded ${closes.size}/${symbols.length} symbols.`);

  const allDates = new Set<string>();
  for (const pts of closes.values()) for (const p of pts) allDates.add(p.date);
  const dates = [...allDates].sort();
  const byMonth = new Map<string, string>();
  for (const d of dates) if (!byMonth.has(d.slice(0, 7))) byMonth.set(d.slice(0, 7), d);
  const rebalDates = [...byMonth.values()].sort();

  const oneWay = oneWayCostPct();
  const firstDate = firstDateBySymbol(closes);

  // Freeze the universe as it stood FREEZE_MONTHS ago (default 36 — "3 years
  // ago", the user's own bound). The comparison window is everything from that
  // freeze point to today, plus the lookback needed to score the first month.
  // A symbol is frozen-eligible only if it had enough price history to be
  // scorable at the freeze point — i.e. it was already listed and investable
  // then, not a later entrant that a naive backtest silently adds mid-run.
  const FREEZE_MONTHS = numEnv('FREEZE_MONTHS', 36);
  const lastDate = rebalDates[rebalDates.length - 1];
  const freezePoint = addMonths(lastDate, -FREEZE_MONTHS);
  const usable = rebalDates.filter((d) => d >= freezePoint);
  if (usable.length < 13) {
    console.error('Not enough history after the freeze point to run.');
    process.exit(1);
  }
  const windowStart = usable[0];

  // A symbol is "frozen-eligible" if it had enough history at the window start
  // to be scorable then — its first close must predate the lookback anchor of
  // the window start, which is exactly the data the momentum score needs.
  const eligibilityAnchor = addMonths(windowStart, -(LOOKBACK_MONTHS + SKIP_MONTHS));
  const frozenSet = new Set<string>();
  for (const [sym, first] of firstDate) if (first <= eligibilityAnchor) frozenSet.add(sym);

  const alwaysEligible = () => true;
  const frozenEligible = (sym: string) => frozenSet.has(sym);

  const full = runMomentum(closes, usable, TOP_N, oneWay, BAND, alwaysEligible);
  const frozen = runMomentum(closes, usable, TOP_N, oneWay, BAND, frozenEligible);

  const fullAnn = annualize(full);
  const frozenAnn = annualize(frozen);
  const gapPp = (fullAnn - frozenAnn) * 100;

  const laterEntrants = closes.size - frozenSet.size;

  console.log('\n==============================================================');
  console.log('  SURVIVORSHIP-BIAS BOUND (Phase 0.3)');
  console.log(`  Freeze point: ${windowStart} (universe frozen ${FREEZE_MONTHS}mo ago)`);
  console.log(`  Window: ${usable[0]} → ${usable[usable.length - 1]} (${usable.length} months)`);
  console.log(`  Config: topN=${TOP_N} band=${BAND} monthly | one-way cost ${(oneWay * 100).toFixed(3)}%`);
  console.log('  --------------------------------------------------------------');
  console.log(`  Full universe   (${closes.size} symbols):  ${(fullAnn * 100).toFixed(2)}% annualized`);
  console.log(`  Frozen universe (${frozenSet.size} symbols):  ${(frozenAnn * 100).toFixed(2)}% annualized`);
  console.log(`  Later entrants excluded from frozen run: ${laterEntrants}`);
  console.log(`  --------------------------------------------------------------`);
  console.log(`  Survivorship-bias FLOOR: ${gapPp >= 0 ? '+' : ''}${gapPp.toFixed(2)}pp`);
  console.log('  (return attributable to names not yet listed at window start;');
  console.log('   a floor, not the full effect — delisted names remain invisible)');
  console.log('==============================================================');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const md = [
    '# Survivorship-Bias Bound (Phase 0.3)',
    '',
    `Window: **${usable[0]} → ${usable[usable.length - 1]}** (${usable.length} months), universe frozen as of ${FREEZE_MONTHS} months ago  `,
    `Config: topN=${TOP_N}, hysteresis band=${BAND}, monthly, one-way cost ${(oneWay * 100).toFixed(3)}%`,
    '',
    '| Universe | Symbols | Annualized (net, pre-tax) |',
    '|---|---:|---:|',
    `| Full (current watchlist) | ${closes.size} | ${(fullAnn * 100).toFixed(2)}% |`,
    `| Frozen (listed before window start) | ${frozenSet.size} | ${(frozenAnn * 100).toFixed(2)}% |`,
    '',
    `**Survivorship-bias floor: ${gapPp >= 0 ? '+' : ''}${gapPp.toFixed(2)}pp.** ` +
      `${laterEntrants} symbols listed after the window start and were excluded ` +
      'from the frozen run.',
    '',
    '## What this is, and is not',
    '',
    'This is a **floor** on the survivorship effect, measured on the data we ' +
      'actually have. It removes names that were **not yet listed** at decision ' +
      'time — the population that, in a naive backtest, silently joins the ' +
      'ranking only after they have already run up. The gap above is the return ' +
      'that depended on them.',
    '',
    'It **cannot** see the other half of the bias: names that were listed, got ' +
      'picked, then **delisted or collapsed** and left the current watchlist. ' +
      'Those are gone from the data entirely. So the true survivorship drag is ' +
      '**at least** the number above, likely somewhat larger.',
    '',
    '## Verdict',
    '',
    gapPp < 3
      ? 'The floor is small (< 3pp). The edge does not appear to live in ' +
        'late-listing survivors. Combined with the walk-forward gate still ' +
        'clearing Nifty by ~27pp, the headline survives a conservative haircut.'
      : 'The floor is material (>= 3pp). Discount the headline by at least this ' +
        'much and prefer the frozen-universe figure as the honest baseline.',
    '',
    '_The bot always trades the latest NSE-listed watchlist, and the AI/news ' +
      'layer is meant to react to sudden bad news in real time — so the live ' +
      'system is less exposed to the delisting tail than a static backtest ' +
      'implies. This bound quantifies the residual, it does not eliminate it._',
    '',
  ].join('\n');
  const outFile = path.join(OUT_DIR, 'survivorship_bias.md');
  fs.writeFileSync(outFile, md);
  console.log(`\nReport written to ${path.relative(process.cwd(), outFile)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
