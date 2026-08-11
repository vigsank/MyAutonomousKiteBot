/**
 * Generate an HTML chart of the equity curves (combined equity + options P&L).
 *
 * Reads every equity_*.csv in data/equity_curves/ and writes a self-contained
 * HTML file (Chart.js from CDN) you can open in a browser.
 *
 * Usage: npx ts-node test/backtest/chart_equity.ts [--top N]
 */
import * as fs from 'fs';
import * as path from 'path';

function main(): void {
  const dir = path.join(process.cwd(), 'data', 'equity_curves');
  if (!fs.existsSync(dir)) {
    console.error('No equity_curves directory found. Run the optimizer first.');
    process.exit(1);
  }

  const topN = Number(process.argv.find((a) => a.startsWith('--top='))?.split('=')[1] ?? 10);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('equity_') && f.endsWith('.csv'))
    .sort();

  const datasets: string[] = [];
  for (const f of files.slice(0, topN)) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf-8').trim().split('\n');
    const labels: string[] = [];
    const data: number[] = [];
    for (const line of lines.slice(1)) {
      const [ts, eq] = line.split(',');
      if (ts && eq) {
        labels.push(ts.slice(0, 10));
        data.push(Number(eq));
      }
    }
    const label = f.replace('equity_', '').replace('.csv', '');
    datasets.push(
      `{ label: '${label}', data: [${data.join(',')}], borderWidth: 2, tension: 0.2, pointRadius: 0 }`,
    );
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Equity Curves</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>body{font-family:sans-serif;margin:20px}canvas{max-width:1200px}</style></head>
<body><h2>Equity Curves (combined equity + options P&L)</h2>
<canvas id="chart"></canvas>
<script>
const ctx = document.getElementById('chart').getContext('2d');
new Chart(ctx, {
  type: 'line',
  data: { labels: [], datasets: [${datasets.join(',')}] },
  options: {
    responsive: true,
    plugins: { legend: { position: 'top' } },
    scales: { y: { title: { display: true, text: 'Cumulative P&L (₹)' } } }
  }
});
</script></body></html>`;

  const out = path.join(process.cwd(), 'data', 'equity_chart.html');
  fs.writeFileSync(out, html, 'utf-8');
  console.log(`Chart written to ${out} (${datasets.length} curves). Open in a browser.`);
}

main();
