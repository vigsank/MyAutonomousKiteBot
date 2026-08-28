/**
 * news_monitor_walk_forward.ts — walk-forward validation of the Phase 4.4
 * event-driven news monitor's two paths, using PRICE-BASED proxies for the news
 * triggers (the CSVs have prices, not historical news):
 *
 *   - DEFENSIVE: a sharp daily drop on a HELD position proxies a negative-news
 *     event; exiting on it should cut left-tail (max drawdown) vs holding to the
 *     monthly rebalance.
 *   - OPPORTUNISTIC: a breakout above the N-day high on a non-held momentum
 *     candidate proxies a positive-news event; entering a partial position early
 *     should beat waiting for the monthly rebalance, net of turnover.
 *
 * Runs the pure-momentum monthly book as the baseline, then adds each path and
 * compares equity, return, and max drawdown over the full 5-year window.
 *
 * Usage:
 *   ENV_FILE=.env.test npx ts-node test/backtest/news_monitor_walk_forward.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { rankByMomentum, selectWithHysteresis, applyLiquidityFloor, ClosePoint } from '../../src/server/signals/momentum';
import { resolveDataDir } from './_dataDir';

const DATA_DIR = resolveDataDir();
const OUT_FILE = path.join(__dirname, 'results/news_monitor_walk_forward_report.md');
const TOP_N = 5;
const BAND = 8;
const LOOKBACK = 12;
const SKIP = 1;
const ONE_WAY_COST = 0.00155;
// Price proxies for the news triggers.
const DEFENSIVE_DROP_PCT = 4;   // exit a held name on a single-day drop >= this %
const BREAKOUT_LOOKBACK = 20;   // N-day high that proxies a positive-news breakout
const OPPORTUNISTIC_PARTIAL = 0.5; // partial entry size as fraction of ONE slot
const MAX_OPPORTUNISTIC = 2;    // max concurrent opportunistic positions (no over-leverage)

interface P { date: string; close: number; }

function loadCsv(symbol: string): P[] {
  const file = path.join(DATA_DIR, symbol + '_1d.csv');
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').slice(1);
  const pts: P[] = [];
  for (const line of lines) {
    const cols = line.split(',');
    const ts = cols[1]?.trim();
    const cl = parseFloat(cols[6]?.trim() ?? '');
    if (!ts || !Number.isFinite(cl) || cl <= 0) continue;
    pts.push({ date: ts.slice(0, 10), close: cl });
  }
  return pts.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function closeOnOrBefore(pts: P[], date: string): number | null {
  let last: number | null = null;
  for (const p of pts) {
    if (p.date <= date) last = p.close;
    else break;
  }
  return last;
}

function addMonths(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

interface Book {
  cash: number;
  holdings: Map<string, { qty: number; cost: number; entryDate: string }>;
  /** Symbols entered opportunistically (capped, sized against the slot). */
  opportunistic: Set<string>;
}

function runSim(
  closes: Map<string, P[]>,
  dates: string[],
  rebalDates: string[],
  opts: { defensive: boolean; opportunistic: boolean },
): { equity: number; maxDd: number; trades: number; oppEntries: number } {
  const book: Book = { cash: 1_000_000, holdings: new Map(), opportunistic: new Set() };
  let peak = 1_000_000;
  let maxDd = 0;
  let trades = 0;
  let oppEntries = 0;
  const rebalSet = new Set(rebalDates);

  const equity = (): number => {
    let e = book.cash;
    for (const [sym, h] of book.holdings) {
      const px = closeOnOrBefore(closes.get(sym)!, dates[dates.length - 1]);
      e += (px ?? h.cost) * h.qty;
    }
    return e;
  };

  for (const d of dates) {
    // Monthly rebalance.
    if (rebalSet.has(d)) {
      const inputs = [...closes.entries()].map(([symbol, c]) => ({ symbol, closes: c as unknown as ClosePoint[] }));
      const { kept } = applyLiquidityFloor(inputs, 0, 20);
      const ranked = rankByMomentum(kept, LOOKBACK, SKIP);
      const target = selectWithHysteresis(ranked, book.holdings.keys(), TOP_N, BAND);
      const targetSet = new Set(target);
      // Sell exited names.
      for (const [sym, h] of [...book.holdings]) {
        if (targetSet.has(sym)) continue;
        const px = closeOnOrBefore(closes.get(sym)!, d);
        if (!px) continue;
        book.cash += px * h.qty * (1 - ONE_WAY_COST);
        book.holdings.delete(sym);
        book.opportunistic.delete(sym);
        trades++;
      }
      // Buy new names (equal weight).
      const slots = Math.max(1, target.length);
      const perName = book.cash / slots;
      for (const sym of target) {
        if (book.holdings.has(sym)) continue;
        const px = closeOnOrBefore(closes.get(sym)!, d);
        if (!px) continue;
        const spend = Math.min(perName, book.cash);
        if (spend < 100) continue;
        const qty = Math.floor(spend / px);
        if (qty <= 0) continue;
        book.cash -= qty * px * (1 + ONE_WAY_COST);
        book.holdings.set(sym, { qty, cost: px, entryDate: d });
        trades++;
      }
    }

    // Defensive: exit a held name on a sharp single-day drop (negative-news proxy).
    if (opts.defensive) {
      for (const [sym, h] of [...book.holdings]) {
        const pts = closes.get(sym)!;
        const i = pts.findIndex((p) => p.date === d);
        if (i < 1) continue;
        const drop = (pts[i].close / pts[i - 1].close - 1) * 100;
        if (drop <= -DEFENSIVE_DROP_PCT) {
          book.cash += pts[i].close * h.qty * (1 - ONE_WAY_COST);
          book.holdings.delete(sym);
          book.opportunistic.delete(sym);
          trades++;
        }
      }
    }

    // Opportunistic: enter a partial position on a non-held momentum candidate
    // that breaks above its N-day high (positive-news proxy). Sized against ONE
    // slot (not remaining cash) and capped at MAX_OPPORTUNISTIC concurrent names,
    // so it cannot over-leverage or compound unrealistically.
    if (opts.opportunistic) {
      const inputs = [...closes.entries()].map(([symbol, c]) => ({ symbol, closes: c as unknown as ClosePoint[] }));
      const { kept } = applyLiquidityFloor(inputs, 0, 20);
      const ranked = rankByMomentum(kept, LOOKBACK, SKIP);
      const candidates = ranked.slice(0, TOP_N + BAND).map((r) => r.symbol);
      // Per-name slot = current equity / topN; opportunistic size = one slot * partial.
      let eq = book.cash;
      for (const [sym, h] of book.holdings) {
        const px = closeOnOrBefore(closes.get(sym)!, d);
        eq += (px ?? h.cost) * h.qty;
      }
      const slot = eq / TOP_N;
      const spend = slot * OPPORTUNISTIC_PARTIAL;
      for (const sym of candidates) {
        if (book.holdings.has(sym) || book.opportunistic.has(sym)) continue;
        if (book.opportunistic.size >= MAX_OPPORTUNISTIC) break;
        const pts = closes.get(sym)!;
        const i = pts.findIndex((p) => p.date === d);
        if (i < BREAKOUT_LOOKBACK) continue;
        const priorHigh = Math.max(...pts.slice(i - BREAKOUT_LOOKBACK, i).map((p) => p.close));
        if (pts[i].close > priorHigh) {
          const px = pts[i].close;
          const qty = Math.floor(spend / px);
          if (qty > 0 && qty * px <= book.cash) {
            book.cash -= qty * px * (1 + ONE_WAY_COST);
            book.holdings.set(sym, { qty, cost: px, entryDate: d });
            book.opportunistic.add(sym);
            trades++;
            oppEntries++;
          }
        }
      }
    }

    // Mark to market + track drawdown.
    let e = book.cash;
    for (const [sym, h] of book.holdings) {
      const px = closeOnOrBefore(closes.get(sym)!, d);
      e += (px ?? h.cost) * h.qty;
    }
    if (e > peak) peak = e;
    const dd = peak > 0 ? (peak - e) / peak * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }

  return { equity: equity(), maxDd, trades, oppEntries };
}

function main(): void {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('_1d.csv'));
  const closes = new Map<string, P[]>();
  for (const f of files) {
    const sym = f.replace('_1d.csv', '');
    const pts = loadCsv(sym);
    if (pts.length > 60) closes.set(sym, pts);
  }
  console.log('Loaded ' + closes.size + ' symbols.');

  const allDates = new Set<string>();
  for (const pts of closes.values()) for (const p of pts) allDates.add(p.date);
  const dates = [...allDates].sort();
  const monthStarts: string[] = [];
  let prev = '';
  for (const d of dates) {
    const mo = d.slice(0, 7);
    if (mo !== prev) { monthStarts.push(d); prev = mo; }
  }
  // Skip the first 13 months (lookback warm-up) so momentum is computable.
  const rebalDates = monthStarts.slice(13);
  console.log('Window: ' + rebalDates[0] + ' -> ' + dates[dates.length - 1] + ' (' + rebalDates.length + ' rebalances)');

  const baseline = runSim(closes, dates, rebalDates, { defensive: false, opportunistic: false });
  const defensive = runSim(closes, dates, rebalDates, { defensive: true, opportunistic: false });
  const opportunistic = runSim(closes, dates, rebalDates, { defensive: false, opportunistic: true });
  const both = runSim(closes, dates, rebalDates, { defensive: true, opportunistic: true });

  const pct = (e: number) => ((e - 1_000_000) / 1_000_000 * 100).toFixed(2) + '%';
  const rows: Array<[string, { equity: number; maxDd: number; trades: number; oppEntries: number }]> = [
    ['Baseline (monthly momentum)', baseline],
    ['+ Defensive exit', defensive],
    ['+ Opportunistic entry', opportunistic],
    ['+ Both', both],
  ];

  const lines: string[] = [];
  lines.push('# News Monitor Walk-Forward (price-proxy validation)');
  lines.push('');
  lines.push('> **Window:** ' + rebalDates[0] + ' -> ' + dates[dates.length - 1] + ' | **Baseline:** pure momentum (top-' + TOP_N + ', 12m lookback, skip-1)');
  lines.push('> **Proxies:** defensive = exit a held name on a single-day drop >= ' + DEFENSIVE_DROP_PCT + '%; opportunistic = partial entry on a ' + BREAKOUT_LOOKBACK + '-day-high breakout of a momentum candidate.');
  lines.push('');
  lines.push('| Variant | Final equity | Total return | Max drawdown | Trades | Opp entries |');
  lines.push('|---|---|---|---|---|---|');
  for (const [name, r] of rows) {
    lines.push('| ' + name + ' | ' + Math.round(r.equity).toLocaleString('en-IN') + ' | ' + pct(r.equity) + ' | ' + r.maxDd.toFixed(1) + '% | ' + r.trades + ' | ' + r.oppEntries + ' |');
  }
  lines.push('');
  lines.push('## Reading');
  lines.push('');
  lines.push('- **Defensive** should cut max drawdown (left-tail) at some cost to total return (whipsaw).');
  lines.push('- **Opportunistic** should add return if early entry on breakouts beats waiting for the monthly rebalance, net of turnover.');
  lines.push('- These use PRICE proxies for news (the CSVs have no historical news). Real news sentiment may differ.');

  const report = lines.join('\n');
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, report);
  console.log(report);
  console.log('\nReport written to: ' + OUT_FILE);
}

main();
