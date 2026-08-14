/**
 * Run all 10 mock-backtest cases sequentially, save per-case JSON, and generate
 * MD + HTML (interactive Chart.js) reports into test/backtest/results/.
 *
 * Usage:
 *   ENV_FILE=.env.test npx ts-node test/backtest/run_all_cases.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { runCase, CaseConfig, CaseResult } from './mock_backtest';

/** Run name (used as the output subfolder) and capital multiplier. */
const RUN_NAME = process.env.RUN_NAME || 'run1';
const CAPITAL_MULT = Number(process.env.CAPITAL_MULT) || 1;
const OUT_DIR = path.join(process.cwd(), 'test', 'backtest', 'results', RUN_NAME);

const CASES: CaseConfig[] = [
  { name: 'case1', holdingsCount: 0, holdingsValue: 0, newCapital: 20000, pickSymbols: 20, days: 30, rebalanceDays: 1, seed: 7 },
  { name: 'case2', holdingsCount: 2, holdingsValue: 15000, newCapital: 20000, pickSymbols: 18, days: 30, rebalanceDays: 1, seed: 8 },
  { name: 'case3', holdingsCount: 10, holdingsValue: 60000, newCapital: 30000, pickSymbols: 10, days: 30, rebalanceDays: 1, seed: 9 },
  { name: 'case4', holdingsCount: 0, holdingsValue: 0, newCapital: 10000, pickSymbols: 10, days: 30, rebalanceDays: 1, seed: 10 },
  { name: 'case5', holdingsCount: 1, holdingsValue: 30000, newCapital: 10000, pickSymbols: 5, days: 30, rebalanceDays: 1, seed: 11 },
  { name: 'case6', holdingsCount: 5, holdingsValue: 50000, newCapital: 50000, pickSymbols: 15, days: 30, rebalanceDays: 1, seed: 12 },
  { name: 'case7', holdingsCount: 20, holdingsValue: 200000, newCapital: 100000, pickSymbols: 20, days: 30, rebalanceDays: 1, seed: 13 },
  { name: 'case8', holdingsCount: 0, holdingsValue: 0, newCapital: 50000, pickSymbols: 20, days: 60, rebalanceDays: 1, seed: 14 },
  { name: 'case9', holdingsCount: 10, holdingsValue: 60000, newCapital: 30000, pickSymbols: 10, days: 30, rebalanceDays: 5, seed: 15 },
  { name: 'case10', holdingsCount: 0, holdingsValue: 0, newCapital: 500000, pickSymbols: 40, days: 30, rebalanceDays: 1, seed: 16 },
];

function fmtRu(n: number): string { return '₹' + Math.round(n).toLocaleString('en-IN'); }
function fmtPct(n: number): string { return n.toFixed(2) + '%'; }

function generateMarkdown(results: CaseResult[]): string {
  const lines: string[] = [];
  lines.push(`# Mock-Data Backtest — 10 Cases (${RUN_NAME}, ${CAPITAL_MULT}x capital, AI-backed, real NSE data)`);
  lines.push('');
  lines.push('> Strategy: Bollinger mean-reversion + AI analyst (news sentiment + LLM verdict) gating entries. Paper-only, net of costs. 5-min bars from real historical CSVs.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Case | Holdings | New Cap | Total Cap | Picks | Days | Rebal | Trades | Win% | PF | Net P&L | Return | MaxDD | Final |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    lines.push(`| ${r.name} | ${r.holdingsCount} | ${fmtRu(r.newCapital)} | ${fmtRu(r.totalCapital)} | ${r.pickSymbols} | ${r.days} | ${r.rebalanceDays}d | ${r.roundTrips} | ${r.winRate.toFixed(1)}% | ${r.profitFactor === Infinity ? 'inf' : r.profitFactor.toFixed(2)} | ${fmtRu(r.netPnl)} | ${fmtPct(r.returnPct)} | ${fmtRu(r.maxDrawdown)} (${r.maxDrawdownPct.toFixed(1)}%) | ${fmtRu(r.finalEquity)} |`);
  }
  lines.push('');
  for (const r of results) {
    lines.push(`## ${r.name}`);
    lines.push('');
    lines.push(`- **Setup:** ${r.holdingsCount} existing holding(s) worth ${fmtRu(r.holdingsValue)} + ${fmtRu(r.newCapital)} new capital = **${fmtRu(r.totalCapital)}** total. Picked ${r.pickSymbols} symbols, ${r.days} days, rebalance every ${r.rebalanceDays} day(s).`);
    lines.push(`- **Symbols:** ${r.symbols.join(', ')}`);
    lines.push(`- **Result:** ${r.roundTrips} round trips, win rate ${r.winRate.toFixed(1)}%, profit factor ${r.profitFactor === Infinity ? 'inf' : r.profitFactor.toFixed(2)}, net P&L **${fmtRu(r.netPnl)}** (${fmtPct(r.returnPct)}), max drawdown ${fmtRu(r.maxDrawdown)} (${r.maxDrawdownPct.toFixed(1)}%), final equity **${fmtRu(r.finalEquity)}**.`);
    lines.push('');
    lines.push('| Symbol | P&L |');
    lines.push('|---|---|');
    for (const s of r.perSymbol) lines.push(`| ${s.symbol} | ${fmtRu(s.pnl)} |`);
    lines.push('');
    lines.push('**Top trades:**');
    for (const t of r.topTrades) lines.push(`- ${t.symbol} ${t.direction} ${t.quantity} @ ${t.price.toFixed(2)} → ${fmtRu(t.pnl)} (${t.reason})`);
    lines.push('');
  }
  return lines.join('\n');
}

function generateHtml(results: CaseResult[]): string {
  const charts = results.map((r, i) => {
    const eq = JSON.stringify(r.equityCurve);
    const syms = JSON.stringify(r.perSymbol.map((s) => s.symbol));
    const pnls = JSON.stringify(r.perSymbol.map((s) => Math.round(s.pnl)));
    return `
    <div class="case">
      <h2>${r.name} — ${fmtRu(r.netPnl)} (${fmtPct(r.returnPct)})</h2>
      <p><b>Setup:</b> ${r.holdingsCount} holdings (${fmtRu(r.holdingsValue)}) + ${fmtRu(r.newCapital)} new = ${fmtRu(r.totalCapital)} total · ${r.pickSymbols} symbols · ${r.days}d · rebalance ${r.rebalanceDays}d</p>
      <p><b>Result:</b> ${r.roundTrips} trades · win ${r.winRate.toFixed(1)}% · PF ${r.profitFactor === Infinity ? 'inf' : r.profitFactor.toFixed(2)} · maxDD ${fmtRu(r.maxDrawdown)} (${r.maxDrawdownPct.toFixed(1)}%) · final ${fmtRu(r.finalEquity)}</p>
      <div class="chart"><canvas id="eq${i}"></canvas></div>
      <div class="chart"><canvas id="pnl${i}"></canvas></div>
    </div>`;
  }).join('\n');

  const chartScripts = results.map((r, i) => {
    const eq = JSON.stringify(r.equityCurve);
    const syms = JSON.stringify(r.perSymbol.map((s) => s.symbol));
    const pnls = JSON.stringify(r.perSymbol.map((s) => Math.round(s.pnl)));
    return `
    new Chart(document.getElementById('eq${i}'), { type: 'line', data: { labels: Array.from({length:${r.equityCurve.length}}, (_,k)=>k), datasets: [{ label: 'Equity', data: ${eq}, borderColor: '#22c55e', fill: false, tension: 0.1 }] }, options: { plugins: { title: { display: true, text: 'Equity curve' } } } });
    new Chart(document.getElementById('pnl${i}'), { type: 'bar', data: { labels: ${syms}, datasets: [{ label: 'P&L', data: ${pnls}, backgroundColor: ${JSON.stringify(r.perSymbol.map((s) => (s.pnl >= 0 ? '#22c55e' : '#ef4444')))} }] }, options: { plugins: { title: { display: true, text: 'Per-symbol P&L' } }, indexAxis: 'y' } });`;
  }).join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>Mock-Data Backtest — 10 Cases (${RUN_NAME})</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>body{font-family:system-ui,sans-serif;margin:2rem;background:#0f172a;color:#e2e8f0}.case{border:1px solid #334155;border-radius:8px;padding:1rem;margin-bottom:2rem}.chart{max-width:600px;margin:1rem 0}h1{color:#22c55e}h2{color:#f8fafc}p{color:#cbd5e1}</style>
</head><body>
<h1>Mock-Data Backtest — 10 Cases (${RUN_NAME}, ${CAPITAL_MULT}x capital, AI-backed, real NSE data)</h1>
<p>Strategy: Bollinger mean-reversion + AI analyst (news sentiment + LLM verdict). Paper-only, net of costs, 5-min bars from real historical CSVs.</p>
${charts}
<script>${chartScripts}</script>
</body></html>`;
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const results: CaseResult[] = [];
  for (const cfg of CASES) {
    const c = { ...cfg, newCapital: Math.round(cfg.newCapital * CAPITAL_MULT) };
    console.log(`\n=== Running ${c.name} (${c.holdingsCount} holdings, ${fmtRu(c.newCapital)} new, ${c.pickSymbols} symbols, ${c.days}d, rebalance ${c.rebalanceDays}d) ===`);
    const r = await runCase(c);
    results.push(r);
    fs.writeFileSync(path.join(OUT_DIR, `${c.name}.json`), JSON.stringify(r, null, 2));
    console.log(`  ${c.name}: ${r.roundTrips} trades, net ${fmtRu(r.netPnl)} (${fmtPct(r.returnPct)})`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), generateMarkdown(results));
  fs.writeFileSync(path.join(OUT_DIR, 'report.html'), generateHtml(results));
  console.log('\nReports written to', OUT_DIR);
  process.exit(0);
}

main().catch((err) => { console.error('run_all_cases failed:', err); process.exit(1); });
