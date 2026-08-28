/**
 * defensive_exit_validation.ts — walk-forward validation of the AI defensive
 * exit (the ONE AI feature worth pursuing).
 *
 * The core question: does exiting a held position on a negative-news event
 * (proxied here by a sharp single-day drop, since the CSVs have prices, not
 * historical news) REDUCE max drawdown WITHOUT killing total return — and is
 * that true consistently across windows, not just in one lucky regime?
 *
 *   A  = pure momentum, monthly rebalance (baseline).
 *   A2 = momentum + defensive exit (exit a held name on a single-day drop).
 *
 * Both are compared over the full 5-year window AND every rolling 12-month
 * window (A2 and A run fresh each window) so we can see whether the defensive
 * edge is robust or over-fit.
 *
 * The trigger is a PRICE PROXY for news (see news_real_validation.ts: real
 * news aligns with price only ~57% of the time). So interpret results as the
 * DIRECTION (defensive cuts left-tail) not the exact magnitude. The live
 * system uses REAL news sentiment (NewsMonitorEngine), not this proxy.
 *
 * Usage:
 *   ENV_FILE=.env.test npx ts-node test/backtest/defensive_exit_validation.ts
 *   DEFENSIVE_DROP_PCT=5   (conservative trigger, override)
 *   WINDOW_MONTHS=12       (rolling-window length)
 *
 * Report: test/backtest/results/defensive_exit_validation_report.md
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ClosePoint,
  rankByMomentum,
  selectWithHysteresis,
  applyLiquidityFloor,
} from '../../src/server/signals/momentum';
import { resolveDataDir } from './_dataDir';

const DATA_DIR = resolveDataDir();
const OUT_DIR = path.join(__dirname, 'results');
const OUT_FILE = path.join(OUT_DIR, 'defensive_exit_validation_report.md');

const CAPITAL = 1_000_000;
const TOP_N = 5;
const BAND = 8;
const LOOKBACK_MONTHS = 12;
const SKIP_MONTHS = 1;
const ONE_WAY_COST = 0.00155;

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
/** Single-day drop (%) that triggers a defensive exit (price proxy for negative news). */
const DEFENSIVE_DROP_PCT = numEnv('DEFENSIVE_DROP_PCT', 5);
const WINDOW_MONTHS = Math.max(3, Math.floor(numEnv('WINDOW_MONTHS', 12)));

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

interface RunResult {
  monthlyReturns: number[];
  totalReturn: number;
  annualized: number;
  maxDrawdown: number;
  sharpe: number;
  winRate: number;
  trades: number;
}

function runSim(
  closes: Map<string, P[]>,
  dates: string[],
  rebalDates: string[],
  opts: { defensive: boolean },
): RunResult {
  const rebalSet = new Set(rebalDates);
  const cash = { v: CAPITAL };
  const holdings = new Map<string, { qty: number; cost: number }>();
  const monthlyReturns: number[] = [];
  let trades = 0;
  let prevEq = CAPITAL;

  const eq = (d: string): number => {
    let e = cash.v;
    for (const [sym, h] of holdings) {
      e += (closeOnOrBefore(closes.get(sym)!, d) ?? h.cost) * h.qty;
    }
    return e;
  };

  for (const d of dates) {
    // Monthly rebalance.
    if (rebalSet.has(d)) {
      const inputs = [...closes.entries()].map(([symbol, c]) => ({ symbol, closes: c as unknown as ClosePoint[] }));
      const { kept } = applyLiquidityFilter(inputs, 0, 20);
      const ranked = rankByMomentum(kept, LOOKBACK_MONTHS, SKIP_MONTHS);
      const target = selectWithHysteresis(ranked, holdings.keys(), TOP_N, BAND);
      const targetSet = new Set(target);
      for (const [sym, h] of [...holdings]) {
        if (targetSet.has(sym)) continue;
        const px = closeOnOrBefore(closes.get(sym)!, d);
        if (!px) continue;
        cash.v += px * h.qty * (1 - ONE_WAY_COST);
        holdings.delete(sym);
        trades++;
      }
      const slots = Math.max(1, target.length);
      const perName = cash.v / slots;
      for (const sym of target) {
        if (holdings.has(sym)) continue;
        const px = closeOnOrBefore(closes.get(sym)!, d);
        if (!px) continue;
        const spend = Math.min(perName, cash.v);
        if (spend < 100) continue;
        const qty = Math.floor(spend / px);
        if (qty <= 0) continue;
        cash.v -= qty * px * (1 + ONE_WAY_COST);
        holdings.set(sym, { qty, cost: px });
        trades++;
      }
    }

    // Defensive exit: a HELD name with a single-day drop >= threshold proxies a
    // negative-news event; exit it at that day's close.
    if (opts.defensive) {
      for (const [sym, h] of [...holdings]) {
        const pts = closes.get(sym)!;
        const i = pts.findIndex((p) => p.date === d);
        if (i < 1) continue;
        const drop = (pts[i].close / pts[i - 1].close - 1) * 100;
        if (drop <= -DEFENSIVE_DROP_PCT) {
          cash.v += pts[i].close * h.qty * (1 - ONE_WAY_COST);
          holdings.delete(sym);
          trades++;
        }
      }
    }

    // Track monthly mark-to-market return.
    const di = dates.indexOf(d);
    const next = di + 1 < dates.length ? dates[di + 1] : null;
    if (!next || next.slice(0, 7) !== d.slice(0, 7)) {
      monthlyReturns.push(eq(d) / prevEq - 1);
      prevEq = eq(d);
    }
  }

  const finalEq = eq(dates[dates.length - 1]);
  const totalReturn = finalEq / CAPITAL - 1;
  const n = monthlyReturns.length;
  const annualized = n ? Math.pow(1 + totalReturn, 12 / n) - 1 : 0;
  const winRate = n ? monthlyReturns.filter((r) => r > 0).length / n : 0;
  let peak = CAPITAL;
  let maxDD = 0;
  let eqV = CAPITAL;
  for (const r of monthlyReturns) {
    eqV *= 1 + r;
    peak = Math.max(peak, eqV);
    if (peak > 0) maxDD = Math.max(maxDD, (peak - eqV) / peak);
  }
  const mean = monthlyReturns.reduce((s, r) => s + r, 0) / n;
  const sd = Math.sqrt(monthlyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / n);
  const sharpe = sd === 0 ? 0 : (mean / sd) * Math.sqrt(12);

  return { monthlyReturns, totalReturn, annualized, maxDrawdown: maxDD, sharpe, winRate, trades };
}

/** Thin wrapper so runSim's call is explicit about the liquidity floor (no-op at 0). */
function applyLiquidityFilter(
  inputs: Array<{ symbol: string; closes: ClosePoint[] }>,
  floor: number,
  days: number,
): { kept: Array<{ symbol: string; closes: ClosePoint[] }> } {
  return applyLiquidityFloor(inputs, floor, days);
}

function pct(x: number): string {
  return (x * 100).toFixed(2) + '%';
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
  const rebalDates = monthStarts.slice(LOOKBACK_MONTHS + SKIP_MONTHS);
  console.log('Window: ' + rebalDates[0] + ' -> ' + dates[dates.length - 1] + ' (' + rebalDates.length + ' rebalances)');

  // Full-window comparison.
  const a = runSim(closes, dates, rebalDates, { defensive: false });
  const a2 = runSim(closes, dates, rebalDates, { defensive: true });

  // Rolling-window comparison (fresh run each window).
  const rolling: Array<{ start: string; end: string; ddA: number; ddA2: number; retA: number; retA2: number }> = [];
  for (let i = 0; i + WINDOW_MONTHS <= rebalDates.length; i++) {
    const win = rebalDates.slice(i, i + WINDOW_MONTHS);
    const winDates = dates.slice(dates.indexOf(win[0]), dates.indexOf(win[win.length - 1]) + 1);
    const rA = runSim(closes, winDates, win, { defensive: false });
    const rA2 = runSim(closes, winDates, win, { defensive: true });
    rolling.push({ start: win[0], end: win[win.length - 1], ddA: rA.maxDrawdown, ddA2: rA2.maxDrawdown, retA: rA.totalReturn, retA2: rA2.totalReturn });
  }

  const n = rolling.length;
  const ddBetter = rolling.filter((r) => r.ddA2 < r.ddA).length;
  const retOk = rolling.filter((r) => r.retA2 >= r.retA - 0.03).length;
  const bothGood = rolling.filter((r) => r.ddA2 < r.ddA && r.retA2 >= r.retA - 0.03).length;

  const lines: string[] = [];
  lines.push('# Defensive Exit Validation (AI defensive-only, Phase 4.4 focus)');
  lines.push('');
  lines.push('> **Window:** ' + rebalDates[0] + ' -> ' + dates[dates.length - 1] + ' | **Baseline:** momentum top-' + TOP_N + ', 12m lookback, skip-1, monthly');
  lines.push('> **Trigger:** exit a held name on a single-day drop >= ' + DEFENSIVE_DROP_PCT + '% (PRICE PROXY for negative news — see caveat).');
  lines.push('');
  lines.push('## Full-window comparison');
  lines.push('');
  lines.push('| Metric | A (momentum) | A2 (+ defensive exit) |');
  lines.push('| --- | --- | --- |');
  lines.push('| Total return | ' + pct(a.totalReturn) + ' | ' + pct(a2.totalReturn) + ' |');
  lines.push('| Annualized | ' + pct(a.annualized) + ' | ' + pct(a2.annualized) + ' |');
  lines.push('| Max drawdown | ' + pct(a.maxDrawdown) + ' | ' + pct(a2.maxDrawdown) + ' |');
  lines.push('| Sharpe | ' + a.sharpe.toFixed(2) + ' | ' + a2.sharpe.toFixed(2) + ' |');
  lines.push('| Win rate | ' + pct(a.winRate) + ' | ' + pct(a2.winRate) + ' |');
  lines.push('| Trades | ' + a.trades + ' | ' + a2.trades + ' |');
  lines.push('');
  lines.push('## Rolling-window comparison (' + WINDOW_MONTHS + '-month windows, ' + n + ' total)');
  lines.push('');
  lines.push('Windows where defensive CUT max drawdown: ' + ddBetter + '/' + n + ' (' + pct(ddBetter / n) + ')');
  lines.push('Windows where defensive did NOT kill returns (within 3% of A): ' + retOk + '/' + n + ' (' + pct(retOk / n) + ')');
  lines.push('Windows where defensive BOTH cut drawdown AND kept returns: ' + bothGood + '/' + n + ' (' + pct(bothGood / n) + ')');
  lines.push('');
  const verdict = bothGood / n >= 0.6
    ? '**KEEP the defensive exit — it reliably cuts drawdown without killing returns.**'
    : '**MIXED — defensive cuts drawdown but not consistently, or it kills returns too often. Tune the trigger or reconsider.**';
  lines.push('**VERDICT: ' + verdict + '**');
  lines.push('');
  lines.push('## Per-window');
  lines.push('');
  lines.push('| Window | A return | A+DD return | A DD | A+DD DD |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const r of rolling) {
    lines.push('| ' + r.start + ' -> ' + r.end + ' | ' + pct(r.retA) + ' | ' + pct(r.retA2) + ' | ' + pct(r.ddA) + ' | ' + pct(r.ddA2) + ' |');
  }
  lines.push('');
  lines.push('## Caveat');
  lines.push('');
  lines.push('- The trigger is a PRICE PROXY. Real news aligns with price only ~57% of the time (`news_real_validation.ts`), so treat results as DIRECTION (does defensive cut left-tail?) not exact magnitude.');
  lines.push('- The live system uses REAL news sentiment (NewsMonitorEngine defensive path), which may behave differently.');
  lines.push('- A 5% single-day-drop trigger is conservative; looser (4%) fires more (more whipsaw), tighter (7%) fires less.');

  const report = lines.join('\n');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, report);
  console.log(report);
  console.log('\nReport written to: ' + OUT_FILE);
}

main();
