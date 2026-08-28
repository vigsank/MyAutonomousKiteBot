/**
 * news_defensive_real.ts — validates the REAL-NEWS defensive trigger across
 * MULTIPLE windows (firms up the small-n result with aggregate evidence).
 *
 * The price-proxy walk-forward (defensive_exit_validation.ts) showed a crude
 * "exit on 5% drop" whipsaws. The live system fires only on REAL negative news.
 * This harness answers the crux over several non-overlapping windows: of the
 * defensive-candidate events (a held name drops sharply), how many are genuinely
 * news-driven (crash risk) vs pure noise (whipsaw)? And does a real-news-only
 * defensive book cut drawdown without killing returns, consistently?
 *
 * Method (per window, two-pass, sample-capped to keep LLM cost manageable):
 *   Pass 1 — run the momentum book, collect every defensive-candidate event.
 *   News   — for a capped, evenly-sampled subset, fetch REAL date-scoped news
 *            sentiment (TinyFish). Sentiment < exit threshold = confirmed.
 *   Pass 2 — run momentum with a defensive exit firing ONLY on confirmed events.
 * Windows are defined as "start|end" pairs; each is capped at MAX_EVENTS calls.
 *
 * Usage (needs TinyFish + LLM access — run with .env, not .env.test):
 *   ENV_FILE=.env npx ts-node test/backtest/news_defensive_real.ts
 *   WINDOWS="2023-01-01|2023-12-31,2024-01-01|2024-12-31,2025-01-01|2025-12-31,2026-01-01|2026-08-31"
 *   MAX_EVENTS=12           (per-window LLM-call cap)
 *   DROP_PCT=5              (candidate drop trigger)
 *   EXIT_THRESHOLD=-0.4     (sentiment below this = confirmed negative news)
 *
 * Report: test/backtest/results/news_defensive_real_report.md
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../../src/server/AppConfig';
import { Ledger } from '../../src/server/Ledger';
import { LlmManager } from '../../src/server/LlmManager';
import { NewsSentimentEngine } from '../../src/server/NewsSentimentEngine';
import {
  ClosePoint,
  rankByMomentum,
  selectWithHysteresis,
  applyLiquidityFloor,
} from '../../src/server/signals/momentum';
import { resolveDataDir } from './_dataDir';

const DATA_DIR = resolveDataDir();
const OUT_DIR = path.join(__dirname, 'results');
const OUT_FILE = path.join(OUT_DIR, 'news_defensive_real_report.md');

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
const DROP_PCT = numEnv('DROP_PCT', 5);
const MAX_EVENTS = Math.max(1, Math.floor(numEnv('MAX_EVENTS', 12)));
const EXIT_THRESHOLD = numEnv('EXIT_THRESHOLD', -0.4);
/** Non-overlapping windows, "start|end" pairs comma-separated. */
const DEFAULT_WINDOWS = '2023-01-01|2023-12-31,2024-01-01|2024-12-31,2025-01-01|2025-12-31,2026-01-01|2026-08-31';
const WINDOWS: Array<{ start: string; end: string }> = (process.env.WINDOWS ?? DEFAULT_WINDOWS)
  .split(',')
  .map((w) => w.trim())
  .filter(Boolean)
  .map((w) => {
    const [start, end] = w.split('|').map((s) => s.trim());
    return { start, end };
  })
  .filter((w) => w.start && w.end);

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

interface Event { symbol: string; date: string; drop: number; }

interface RunResult {
  totalReturn: number;
  annualized: number;
  maxDrawdown: number;
  sharpe: number;
  trades: number;
}

/** Run a momentum book over the given simulation dates/rebalances. */
function runBook(
  closes: Map<string, P[]>,
  dates: string[],
  rebalDates: string[],
  confirmed: Set<string>,
  collect: boolean,
): { res: RunResult; events: Event[] } {
  const rebalSet = new Set(rebalDates);
  const cash = { v: CAPITAL };
  const holdings = new Map<string, { qty: number; cost: number }>();
  const monthlyReturns: number[] = [];
  const events: Event[] = [];
  let trades = 0;
  let prevEq = CAPITAL;

  const eq = (d: string): number => {
    let e = cash.v;
    for (const [sym, h] of holdings) e += (closeOnOrBefore(closes.get(sym)!, d) ?? h.cost) * h.qty;
    return e;
  };

  for (const d of dates) {
    if (rebalSet.has(d)) {
      const inputs = [...closes.entries()].map(([symbol, c]) => ({ symbol, closes: c as unknown as ClosePoint[] }));
      const { kept } = applyLiquidityFloor(inputs, 0, 20);
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

    for (const [sym, h] of [...holdings]) {
      const pts = closes.get(sym)!;
      const i = pts.findIndex((p) => p.date === d);
      if (i < 1) continue;
      const drop = (pts[i].close / pts[i - 1].close - 1) * 100;
      if (drop <= -DROP_PCT) {
        if (collect) events.push({ symbol: sym, date: d, drop });
        if (confirmed.has(sym + '|' + d)) {
          cash.v += pts[i].close * h.qty * (1 - ONE_WAY_COST);
          holdings.delete(sym);
          trades++;
        }
      }
    }

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
  return { res: { totalReturn, annualized, maxDrawdown: maxDD, sharpe, trades }, events };
}

function pct(x: number): string {
  return (x * 100).toFixed(2) + '%';
}

async function main(): Promise<void> {
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
  const allDatesSorted = [...allDates].sort();
  const allRebal = monthStartsOf(allDatesSorted);

  const config = loadConfig();
  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  const llm = new LlmManager(config.llm);
  const news = new NewsSentimentEngine(config, llm, ledger);

  // Aggregate across windows.
  let totalEvents = 0;
  let totalChecked = 0;
  let totalConfirmed = 0;
  const rows: Array<{ label: string; events: number; checked: number; confirmed: number; rate: RunResult; real: RunResult }> = [];
  const samplesAll: Array<{ date: string; symbol: string; drop: number; sent: number; kind: string; window: string }> = [];

  for (const win of WINDOWS) {
    const dates = allDatesSorted.filter((d) => d >= win.start && d <= win.end);
    const rebalDates = allRebal.filter((d) => d >= win.start && d <= win.end);
    if (dates.length < 40 || rebalDates.length < 3) {
      console.log('Skipping window ' + win.start + '..' + win.end + ' (insufficient data)');
      continue;
    }

    // Pass 1: baseline + collect events.
    const { res: base, events } = runBook(closes, dates, rebalDates, new Set(), true);
    // Sample evenly to cap calls.
    const sampled = events.length <= MAX_EVENTS
      ? events
      : Array.from({ length: MAX_EVENTS }, (_, k) => events[Math.floor((k * events.length) / MAX_EVENTS)]);

    const confirmed = new Set<string>();
    let confirmedCount = 0;
    for (const ev of sampled) {
      const sent = (await news.sentimentForDate(ev.symbol, ev.date).catch(() => null))?.score ?? 0;
      const isNeg = sent < EXIT_THRESHOLD;
      if (isNeg) {
        confirmed.add(ev.symbol + '|' + ev.date);
        confirmedCount++;
      }
      samplesAll.push({ date: ev.date, symbol: ev.symbol, drop: ev.drop, sent, kind: isNeg ? 'CONFIRMED' : 'whipsaw', window: win.start.slice(0, 7) });
      console.log('  [news] ' + win.start.slice(0, 7) + ' ' + ev.date + ' ' + ev.symbol + ' drop ' + ev.drop.toFixed(1) + '% sent ' + sent.toFixed(2) + ' -> ' + (isNeg ? 'CONFIRMED' : 'whipsaw'));
    }

    const { res: real } = runBook(closes, dates, rebalDates, confirmed, false);

    totalEvents += events.length;
    totalChecked += sampled.length;
    totalConfirmed += confirmedCount;
    rows.push({
      label: win.start + ' → ' + win.end,
      events: events.length,
      checked: sampled.length,
      confirmed: confirmedCount,
      rate: base,
      real,
    });
  }

  const overallRate = totalChecked ? totalConfirmed / totalChecked : 0;
  const lines: string[] = [];
  lines.push('# Real-News Defensive Trigger Validation (multi-window)');
  lines.push('');
  lines.push('> **Trigger:** exit a held name on a single-day drop >= ' + DROP_PCT + '% · **Exit threshold:** sentiment < ' + EXIT_THRESHOLD);
  lines.push('> **News:** REAL date-scoped (TinyFish time-range) via `sentimentForDate`.');
  lines.push('');
  lines.push('## The crux across windows');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push('| Defensive-candidate events | ' + totalEvents + ' |');
  lines.push('| News-checked (sampled) | ' + totalChecked + ' |');
  lines.push('| Confirmed negative news (real crash risk) | ' + totalConfirmed + ' (' + pct(overallRate) + ') |');
  lines.push('| Whipsaw (drop with no negative news) | ' + (totalChecked - totalConfirmed) + ' (' + pct(1 - overallRate) + ') |');
  lines.push('');
  lines.push('## Per-window');
  lines.push('');
  lines.push('| Window | Events | Checked | Confirmed | Baseline ann | Real ann | Baseline DD | Real DD | Baseline Sharpe | Real Sharpe |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of rows) {
    lines.push('| ' + r.label + ' | ' + r.events + ' | ' + r.checked + ' | ' + r.confirmed + ' | ' + pct(r.rate.annualized) + ' | ' + pct(r.real.annualized) + ' | ' + pct(r.rate.maxDrawdown) + ' | ' + pct(r.real.maxDrawdown) + ' | ' + r.rate.sharpe.toFixed(2) + ' | ' + r.real.sharpe.toFixed(2) + ' |');
  }
  lines.push('');
  lines.push('## Aggregate verdict');
  lines.push('');
  // Aggregate return/drawdown across windows (simple mean of per-window totals).
  const n = rows.length || 1;
  const avgBaseAnn = rows.reduce((s, r) => s + r.rate.annualized, 0) / n;
  const avgRealAnn = rows.reduce((s, r) => s + r.real.annualized, 0) / n;
  const avgBaseDD = rows.reduce((s, r) => s + r.rate.maxDrawdown, 0) / n;
  const avgRealDD = rows.reduce((s, r) => s + r.real.maxDrawdown, 0) / n;
  const avgBaseSh = rows.reduce((s, r) => s + r.rate.sharpe, 0) / n;
  const avgRealSh = rows.reduce((s, r) => s + r.real.sharpe, 0) / n;
  const ddCuts = rows.filter((r) => r.real.maxDrawdown < r.rate.maxDrawdown).length;
  const retHolds = rows.filter((r) => r.real.totalReturn >= r.rate.totalReturn * 0.9).length;
  lines.push('| Metric | Baseline (avg) | + Real-news defensive (avg) |');
  lines.push('| --- | --- | --- |');
  lines.push('| Annualized | ' + pct(avgBaseAnn) + ' | ' + pct(avgRealAnn) + ' |');
  lines.push('| Max drawdown | ' + pct(avgBaseDD) + ' | ' + pct(avgRealDD) + ' |');
  lines.push('| Sharpe | ' + avgBaseSh.toFixed(2) + ' | ' + avgRealSh.toFixed(2) + ' |');
  lines.push('| Windows where DD was cut | — | ' + ddCuts + '/' + rows.length + ' |');
  lines.push('| Windows where returns kept (>=90%) | — | ' + retHolds + '/' + rows.length + ' |');
  lines.push('');
  const worthIt = avgRealDD < avgBaseDD && avgRealAnn >= avgBaseAnn * 0.9;
  lines.push('**VERDICT: ' + (worthIt
    ? 'Real-news defensive cuts drawdown AND keeps returns across windows — worth enabling.'
    : 'Real-news defensive does not consistently help across windows.') + '**');
  lines.push('');
  lines.push('## Per-event news classification');
  lines.push('');
  lines.push('| Window | Date | Symbol | Drop | News sentiment | Kind |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const s of samplesAll) {
    lines.push('| ' + s.window + ' | ' + s.date + ' | ' + s.symbol + ' | ' + s.drop.toFixed(1) + '% | ' + s.sent.toFixed(2) + ' | ' + s.kind + ' |');
  }
  lines.push('');
  lines.push('## Caveats');
  lines.push('');
  lines.push('- TinyFish may miss historical articles → reads as neutral → "whipsaw".');
  lines.push('- Single-day drop is a noisy event proxy; a multi-day confirmation window would be more robust.');
  lines.push('- Events are sampled (cap ' + MAX_EVENTS + ' per window) to bound LLM cost; confirmed rate is a sample estimate.');

  const report = lines.join('\n');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, report);
  console.log('\n' + report);
  console.log('\nReport written to: ' + OUT_FILE);
}

/** Month-start dates from a sorted date list. */
function monthStartsOf(dates: string[]): string[] {
  const out: string[] = [];
  let prev = '';
  for (const d of dates) {
    const mo = d.slice(0, 7);
    if (mo !== prev) { out.push(d); prev = mo; }
  }
  return out;
}

main().catch((e) => {
  console.error('news_defensive_real failed:', e?.message ?? e);
  process.exit(1);
});
