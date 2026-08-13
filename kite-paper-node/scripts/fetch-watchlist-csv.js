#!/usr/bin/env node
/**
 * fetch-watchlist-csv.js — fetches real NSE data from Yahoo Finance for every
 * symbol in the paper node's instrument master, writing one CSV per symbol
 * per interval into `kite-paper-node/data/`.
 *
 * Usage:
 *   node scripts/fetch-watchlist-csv.js                 # fetch all symbols
 *   node scripts/fetch-watchlist-csv.js --sync-watchlist # also rewrite parent watchlist
 *   node scripts/fetch-watchlist-csv.js --symbols=RELIANCE,TCS  # only these
 *
 * Output (per symbol, per interval):
 *   data/RELIANCE_1min.csv   (7 days of 1m)
 *   data/RELIANCE_5min.csv   (30 days of 5m)
 *   data/RELIANCE_15min.csv  (30 days of 15m)
 *   data/RELIANCE_1d.csv     (365 days of daily)
 *
 * The mock auto-prefers these CSVs (latest day = live, prior days = historical)
 * and falls back to the random walk for symbols without a CSV.
 */

const fs = require('fs');
const path = require('path');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const ROOT = path.join(__dirname, '..');
const MASTER = path.join(ROOT, 'src', 'data', 'instruments.json');
const OUT_DIR = path.join(ROOT, 'data');
const PARENT_WATCHLIST = path.join(ROOT, '..', 'data', 'watchlist.json');

// interval → { days of history, file suffix }
const INTERVALS = {
  '1m': { days: 7, suffix: '1min' },
  '5m': { days: 30, suffix: '5min' },
  '15m': { days: 30, suffix: '15min' },
  '1d': { days: 365, suffix: '1d' },
};

function loadInstruments() {
  const data = JSON.parse(fs.readFileSync(MASTER, 'utf-8'));
  return data.instruments.filter(
    (i) => i.exchange === 'NSE' && i.instrument_type === 'EQ'
  );
}

async function fetchChart(symbol, interval, days) {
  const quote = await yahooFinance.quote(symbol);
  const period2 = Math.floor(quote.regularMarketTime / 1000); // ms → seconds
  const period1 = period2 - days * 24 * 3600;
  const result = await yahooFinance.chart(symbol, { period1, period2, interval });
  return result.quotes.filter((q) => q.date && q.close != null);
}

function toCsv(rows, token) {
  const header =
    'instrument_token,timestamp,last_price,open,high,low,close,volume,bid,ask,buy_quantity,sell_quantity';
  const lines = rows.map((q) => {
    const ts = new Date(q.date).toISOString();
    return [
      token, ts, q.close, q.open, q.high, q.low, q.close, q.volume ?? 0,
      q.open, q.close, 0, 0,
    ].join(',');
  });
  return header + '\n' + lines.join('\n');
}

async function main() {
  const syncWatchlist = process.argv.includes('--sync-watchlist');
  const onlyArg = process.argv.find((a) => a.startsWith('--symbols='));
  const only = onlyArg ? onlyArg.split('=')[1].split(',').map((s) => s.trim().toUpperCase()) : null;

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const instruments = loadInstruments().filter(
    (i) => !only || only.includes(i.tradingsymbol.toUpperCase())
  );
  const watchlist = [];
  let ok = 0;
  let fail = 0;

  console.log(`Fetching ${instruments.length} symbols × ${Object.keys(INTERVALS).length} intervals...\n`);

  for (const inst of instruments) {
    const symbol = `${inst.tradingsymbol}.NS`;
    watchlist.push({ tradingsymbol: inst.tradingsymbol, exchange: 'NSE', quantity: 10, enabled: true });
    for (const [interval, cfg] of Object.entries(INTERVALS)) {
      try {
        const rows = await fetchChart(symbol, interval, cfg.days);
        if (rows.length === 0) {
          console.log(`  ${symbol} ${interval}: 0 rows (skip)`);
          continue;
        }
        const file = path.join(OUT_DIR, `${inst.tradingsymbol}_${cfg.suffix}.csv`);
        fs.writeFileSync(file, toCsv(rows, inst.instrument_token));
        console.log(`  ${symbol} ${interval}: ${rows.length} rows → ${path.basename(file)}`);
        ok++;
      } catch (e) {
        console.log(`  ${symbol} ${interval}: ERROR ${e.message}`);
        fail++;
      }
    }
  }

  if (syncWatchlist) {
    fs.writeFileSync(PARENT_WATCHLIST, JSON.stringify({ symbols: watchlist }, null, 2));
    console.log(`\nWrote parent watchlist (${watchlist.length} symbols) → ${PARENT_WATCHLIST}`);
  }

  console.log(`\nDone. ${ok} files written, ${fail} failed.`);
  console.log(`CSV directory: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
