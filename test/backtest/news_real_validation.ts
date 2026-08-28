/**
 * news_real_validation.ts — validates the PRICE-PROXY assumption used in the
 * news-monitor walk-forward: does REAL date-scoped news sentiment align with
 * price moves? For a sample of rebalance dates, it fetches real news sentiment
 * (TinyFish time-range, via NewsSentimentEngine.sentimentForDate) for a few
 * symbols and compares it to the same-day price move.
 *
 * If negative news correlates with drops and positive news with breakouts, the
 * price proxies are a reasonable stand-in for news in the backtest.
 *
 * Usage:
 *   ENV_FILE=.env npx ts-node test/backtest/news_real_validation.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../../src/server/AppConfig';
import { Ledger } from '../../src/server/Ledger';
import { LlmManager } from '../../src/server/LlmManager';
import { NewsSentimentEngine } from '../../src/server/NewsSentimentEngine';
import { resolveDataDir } from './_dataDir';

const DATA_DIR = resolveDataDir();
const OUT_FILE = path.join(__dirname, 'results/news_real_validation_report.md');
const SAMPLE_SYMBOLS = ['RELIANCE', 'INFY', 'TCS', 'HDFCBANK', 'TATASTEEL', 'HINDCOPPER', 'CHENNPETRO', 'LAURUSLABS', 'ADANIPOWER', 'SHRIRAMFIN'];

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

function dayMove(pts: P[], date: string): number | null {
  const i = pts.findIndex((p) => p.date === date);
  if (i < 1) return null;
  return (pts[i].close / pts[i - 1].close - 1) * 100;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  const llm = new LlmManager(config.llm);
  const news = new NewsSentimentEngine(config, llm, ledger);

  // Load closes for the sample symbols.
  const closes = new Map<string, P[]>();
  for (const sym of SAMPLE_SYMBOLS) {
    const pts = loadCsv(sym);
    if (pts.length > 60) closes.set(sym, pts);
  }
  console.log('Loaded ' + closes.size + ' sample symbols.');

  // Sample dates: the 6 monthly rebalance dates of the 6-month window.
  const sampleDates = ['2026-03-02', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-03'];

  const rows: string[] = [];
  let agree = 0;
  let total = 0;
  for (const date of sampleDates) {
    for (const sym of SAMPLE_SYMBOLS) {
      const pts = closes.get(sym);
      if (!pts) continue;
      const move = dayMove(pts, date);
      if (move === null) continue;
      console.log('  [news] ' + date + ' ' + sym + ' (move ' + move.toFixed(1) + '%)...');
      const sent = (await news.sentimentForDate(sym, date).catch(() => null))?.score ?? 0;
      // Agreement: negative news (sent < -0.2) with a drop, or positive news (sent > 0.2) with a rise.
      const newsNeg = sent < -0.2;
      const newsPos = sent > 0.2;
      const priceNeg = move < -1;
      const pricePos = move > 1;
      const aligned = (newsNeg && priceNeg) || (newsPos && pricePos) || (!newsNeg && !newsPos);
      if (aligned) agree++;
      total++;
      rows.push('| ' + date + ' | ' + sym + ' | ' + move.toFixed(2) + '% | ' + sent.toFixed(2) + ' | ' + (aligned ? 'ALIGNED' : 'MISALIGNED') + ' |');
    }
  }

  const pct = total ? (agree / total * 100).toFixed(0) : '0';
  const lines: string[] = [];
  lines.push('# Real-News Validation — do price proxies align with real news sentiment?');
  lines.push('');
  lines.push('> **Method:** for each sample date, fetch real date-scoped news sentiment (TinyFish time-range) and compare to the same-day price move.');
  lines.push('> **Alignment:** negative news (sent < -0.2) with a drop, positive news (sent > 0.2) with a rise, or neutral with a small move.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push('| Samples | ' + total + ' |');
  lines.push('| Aligned | ' + agree + ' (' + pct + '%) |');
  lines.push('| Verdict | ' + (agree / Math.max(1, total) >= 0.6 ? '**Price proxies are a reasonable stand-in for news**' : '**Price proxies align weakly with real news — interpret the walk-forward with caution**') + ' |');
  lines.push('');
  lines.push('## Per-Sample');
  lines.push('');
  lines.push('| Date | Symbol | Price move | News sentiment | Alignment |');
  lines.push('|---|---|---|---|---|');
  for (const r of rows) lines.push(r);
  lines.push('');
  lines.push('## Caveats');
  lines.push('');
  lines.push('- TinyFish may not retain every article from a historical date; sentiment is best-effort.');
  lines.push('- A single-day price move is a noisy proxy for a news event; multi-day windows would be more robust.');

  const report = lines.join('\n');
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, report);
  console.log(report);
  console.log('\nReport written to: ' + OUT_FILE);
}

main().catch((e) => {
  console.error('news_real_validation failed:', e?.message ?? e);
  process.exit(1);
});
