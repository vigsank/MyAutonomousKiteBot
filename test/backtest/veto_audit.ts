/**
 * veto_audit.ts — measures whether the AI's per-symbol AVOID vetoes helped or
 * hurt vs the pure-momentum baseline, over the same 6-month window.
 *
 * For each monthly rebalance it:
 *   1. Computes the pure-momentum target and the momentum book's forward return.
 *   2. Reads the AI-backed run's vetoed (AVOID) names from
 *      `results/mock_ai_backed_report_6m.md`.
 *   3. Computes each vetoed name's forward 1-month return from the CSV data.
 *   4. Compares: if vetoed names beat the momentum book, the veto was harmful
 *      (it blocked winners); if they lagged, the veto was protective.
 *
 * Usage:
 *   ENV_FILE=.env.test npx ts-node test/backtest/veto_audit.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { rankByMomentum, selectWithHysteresis, applyLiquidityFloor, ClosePoint } from '../../src/server/signals/momentum';
import { resolveDataDir } from './_dataDir';

const DATA_DIR = resolveDataDir();
const AI_REPORT = path.join(__dirname, 'results/mock_ai_backed_report_6m.md');
const OUT_FILE = path.join(__dirname, 'results/veto_audit_report.md');
const TOP_N = 5;
const BAND = 8;
const LOOKBACK = 12;
const SKIP = 1;

interface ClosePoint2 { date: string; close: number; }

function loadCsv(symbol: string): ClosePoint2[] {
  const file = path.join(DATA_DIR, symbol + '_1d.csv');
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').slice(1);
  const pts: ClosePoint2[] = [];
  for (const line of lines) {
    const cols = line.split(',');
    const ts = cols[1]?.trim();
    const cl = parseFloat(cols[6]?.trim() ?? '');
    if (!ts || !Number.isFinite(cl) || cl <= 0) continue;
    pts.push({ date: ts.slice(0, 10), close: cl });
  }
  return pts.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function closeOnOrBefore(pts: ClosePoint2[], date: string): number | null {
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

function forwardReturn(pts: ClosePoint2[], from: string, to: string): number | null {
  const p0 = closeOnOrBefore(pts, from);
  const p1 = closeOnOrBefore(pts, to);
  if (!p0 || !p1 || p0 <= 0) return null;
  return p1 / p0 - 1;
}

/** Parse the AI-backed report's per-month AVOID names (string ops, no regex). */
function parseAiVetoes(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!fs.existsSync(AI_REPORT)) return map;
  const lines = fs.readFileSync(AI_REPORT, 'utf8').split('\n');
  for (const line of lines) {
    if (!line.startsWith('- **') || !line.includes('AI regime')) continue;
    const date = line.slice(4, 14); // YYYY-MM-DD (after '- **')
    const biasStart = line.indexOf('bias [');
    if (biasStart < 0) continue;
    const biasEnd = line.indexOf(']', biasStart);
    const bias = line.slice(biasStart + 6, biasEnd);
    const avoids = bias
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.endsWith(':AVOID'))
      .map((s) => s.replace(':AVOID', ''));
    if (avoids.length) map.set(date, avoids);
  }
  return map;
}

function main(): void {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('_1d.csv'));
  const closes = new Map<string, ClosePoint2[]>();
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
  const rebalDates = monthStarts.slice(-6);
  const nextDate = (d: string) => {
    const i = dates.indexOf(d);
    return dates[i + 21] ?? dates[dates.length - 1];
  };

  const vetoes = parseAiVetoes();
  const rows: string[] = [];
  let vetoedCount = 0;
  let vetoedSum = 0;
  let bookSum = 0;
  let bookCount = 0;

  for (const d of rebalDates) {
    const to = nextDate(d);
    const inputs = [...closes.entries()].map(([symbol, c]) => ({ symbol, closes: c as unknown as ClosePoint[] }));
    const { kept } = applyLiquidityFloor(inputs, 0, 20);
    const ranked = rankByMomentum(kept, LOOKBACK, SKIP);
    const target = selectWithHysteresis(ranked, [], TOP_N, BAND);
    let bookRet = 0;
    let n = 0;
    for (const sym of target) {
      const r = forwardReturn(closes.get(sym)!, d, to);
      if (r !== null) { bookRet += r; n++; }
    }
    const bookAvg = n ? bookRet / n : 0;
    bookSum += bookAvg;
    bookCount++;

    const avoids = vetoes.get(d) ?? [];
    const vetoRets: string[] = [];
    let vetoAvg = 0;
    let vn = 0;
    for (const sym of avoids) {
      const r = forwardReturn(closes.get(sym)!, d, to);
      if (r !== null) {
        vetoRets.push(sym + ' ' + (r * 100).toFixed(1) + '%');
        vetoAvg += r;
        vn++;
        vetoedSum += r;
        vetoedCount++;
      }
    }
    if (vn) vetoAvg /= vn;
    const verdict = vn ? (vetoAvg > bookAvg ? 'HARMFUL (vetoed a winner)' : 'PROTECTIVE (vetoed a loser)') : 'no vetoes';
    rows.push(
      '| ' + d + ' | ' + target.join(', ') + ' | ' + (bookAvg * 100).toFixed(2) + '% | ' +
      (avoids.join(', ') || '—') + ' | ' + (vetoRets.join(', ') || '—') + ' | ' +
      (vn ? (vetoAvg * 100).toFixed(2) + '%' : '—') + ' | ' + verdict + ' |'
    );
    console.log('  ' + d + ': book ' + (bookAvg * 100).toFixed(2) + '% | vetoed [' + avoids.join(', ') + '] avg ' + (vn ? (vetoAvg * 100).toFixed(2) + '%' : 'n/a') + ' -> ' + verdict);
  }

  const overallVetoed = vetoedCount ? (vetoedSum / vetoedCount) * 100 : 0;
  const overallBook = bookCount ? (bookSum / bookCount) * 100 : 0;

  const lines: string[] = [];
  lines.push('# AI Veto Audit — did the AI\'s AVOID calls help or hurt?');
  lines.push('');
  lines.push('> **Window:** ' + rebalDates[0] + ' -> ' + rebalDates[rebalDates.length - 1] + ' (6 monthly rebalances) | **Baseline:** pure momentum (top-' + TOP_N + ', 12m lookback, skip-1)');
  lines.push('> **Vetoes:** parsed from `mock_ai_backed_report_6m.md` (the AI-backed run)');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push('| Avg momentum-book monthly return | ' + overallBook.toFixed(2) + '% |');
  lines.push('| Avg vetoed-name forward return | ' + overallVetoed.toFixed(2) + '% |');
  lines.push('| Vetoed names counted | ' + vetoedCount + ' |');
  lines.push('| Verdict | ' + (overallVetoed > overallBook ? '**HARMFUL** — the AI vetoed names that beat the book' : '**PROTECTIVE** — the AI vetoed names that lagged the book') + ' |');
  lines.push('');
  lines.push('## Per-Month');
  lines.push('');
  lines.push('| Rebalance | Momentum target | Book return | AI AVOID names | Vetoed forward return | Verdict |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of rows) lines.push(r);
  lines.push('');
  lines.push('## Caveats');
  lines.push('');
  lines.push('- Small sample (6 months, a handful of vetoes) — directional, not conclusive.');
  lines.push('- Forward return is the next ~21 trading days from the rebalance date.');
  lines.push('- The AI-backed run also de-risks via the regime gate, so the veto effect is not fully isolated.');

  const report = lines.join('\n');
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, report);
  console.log('\nReport written to: ' + OUT_FILE);
}

main();
