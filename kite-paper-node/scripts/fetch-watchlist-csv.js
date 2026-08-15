#!/usr/bin/env node
/**
 * fetch-watchlist-csv.js — fetches real NSE data from Yahoo Finance for every
 * symbol in the PARENT's `data/watchlist.json`, syncing it into the paper
 * node's instrument master, then writing one CSV per symbol per interval.
 *
 * Usage:
 *   node scripts/fetch-watchlist-csv.js                   # fetch all watchlist symbols
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

/**
 * NSE trading symbol → Yahoo Finance symbol (without the .NS suffix).
 * Yahoo tickers sometimes differ from the NSE tradingsymbol (renames,
 * demergers, re-codes). Kept explicit so the mismatch is visible.
 */
const YAHOO_ALIASES = {
  INFOSYS: 'INFY',
  REC: 'RECLTD',
  SHREEBACEM: 'SHREECEM',
  GMRINFRA: 'GMRAIRPORT',
  BERGERPAINT: 'BERGEPAINT',
  // Tata Motors demerged into passenger (TMPV) + commercial (TMCV) arms;
  // the passenger-vehicle listing is the liquid proxy for the legacy ticker.
  TATAMOTORS: 'TMPV',
};

/** Convert an NSE tradingsymbol to the Yahoo symbol Yahoo can resolve. */
function toYahooSymbol(tradingsymbol) {
  const ns = YAHOO_ALIASES[tradingsymbol.toUpperCase()] || tradingsymbol;
  return `${ns}.NS`;
}

/** Sleep helper for retry backoff. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

/** Load the parent's watchlist symbols (the real list the algo trades). */
function loadWatchlist() {
  const data = readJson(PARENT_WATCHLIST, { symbols: [] });
  return (data.symbols || []).filter((s) => s && s.tradingsymbol);
}

/** Load the paper node's instrument master. */
function loadMaster() {
  return readJson(MASTER, { instruments: [] });
}

/** Assign a unique token for a symbol not yet in the master. */
function nextToken(instruments) {
  const max = instruments.reduce((m, i) => Math.max(m, i.instrument_token || 0), 0);
  return Math.max(max + 1, 10_000_000);
}

/**
 * Sync the parent watchlist into the instrument master: add any watchlist
 * symbols missing from the master (with a generated token), and return the
 * updated list of NSE equity instruments. Writes the master back if changed.
 */
function syncWatchlistToMaster() {
  const master = loadMaster();
  const instruments = master.instruments || [];
  const watchlist = loadWatchlist();
  const have = new Set(instruments.map((i) => i.tradingsymbol.toUpperCase()));
  let added = 0;

  for (const s of watchlist) {
    const sym = s.tradingsymbol.toUpperCase();
    if (s.exchange !== 'NSE') continue; // only equities for now
    if (have.has(sym)) continue;
    instruments.push({
      instrument_token: nextToken(instruments),
      exchange_token: String(sym.length * 7919), // pseudo-unique
      tradingsymbol: s.tradingsymbol,
      name: s.tradingsymbol,
      last_price: '100.0',
      expiry: '',
      strike: '0',
      tick_size: '0.05',
      lot_size: '1',
      instrument_type: 'EQ',
      segment: 'NSE',
      exchange: 'NSE',
    });
    have.add(sym);
    added++;
  }

  if (added > 0) {
    fs.writeFileSync(MASTER, JSON.stringify({ version: 1, updated: new Date().toISOString(), instruments }, null, 2));
    console.log(`Added ${added} watchlist symbols to instrument master → ${MASTER}`);
  }

  return instruments.filter(
    (i) => i.exchange === 'NSE' && i.instrument_type === 'EQ'
  );
}

const MAX_ATTEMPTS = 4;

/**
 * Fetch OHLCV history for a Yahoo symbol. Deliberately does NOT depend on
 * quote() — that call is flaky (returns null / throws even when chart() works),
 * so we derive the window purely from the chart endpoint. Retries transient
 * failures with backoff, and returns [] (never throws) on persistent failure.
 */
async function fetchChart(symbol, interval, days) {
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const period2 = Math.floor(Date.now() / 1000);
      const period1 = period2 - days * 24 * 3600;
      const result = await yahooFinance.chart(symbol, { period1, period2, interval });
      return (result.quotes || []).filter((q) => q.date && q.close != null);
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_ATTEMPTS) await sleep(1200 * attempt);
    }
  }
  console.log(`      ${symbol} ${interval}: retried ${MAX_ATTEMPTS}x, giving up: ${lastErr && lastErr.message}`);
  return [];
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
  const onlyArg = process.argv.find((a) => a.startsWith('--symbols='));
  const only = onlyArg ? onlyArg.split('=')[1].split(',').map((s) => s.trim().toUpperCase()) : null;

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const instruments = syncWatchlistToMaster().filter(
    (i) => !only || only.includes(i.tradingsymbol.toUpperCase())
  );
  let ok = 0;
  let fail = 0;

  console.log(`Fetching ${instruments.length} symbols × ${Object.keys(INTERVALS).length} intervals...\n`);

  for (const inst of instruments) {
    const symbol = toYahooSymbol(inst.tradingsymbol);
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

  console.log(`\nDone. ${ok} files written, ${fail} failed.`);
  console.log(`CSV directory: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
