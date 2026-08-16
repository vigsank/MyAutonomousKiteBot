/**
 * momentum_live_pattern.ts — validates the momentum strategy using kite-paper-node
 * data via its REST API, simulating the live trading pattern for 15 days.
 *
 * Flow (mirrors how the bot would run on live money):
 *   1. Start the kite-paper-node mock REST server (serves real NSE daily CSVs).
 *   2. Fetch daily closes for the watchlist via the REST historical endpoint.
 *   3. Compute the momentum target portfolio (12-month, top-N).
 *   4. Execute the rebalance through RiskEngine + PaperTrader (paper).
 *   5. Simulate 15 trading days of price movement, marking to market daily.
 *   6. Run for each of the 10 case capitals, rank by return, report the top 5.
 *
 * Usage:
 *   ENV_FILE=.env.test npx ts-node test/backtest/momentum_live_pattern.ts
 */
import { loadConfig } from '../../src/server/AppConfig';
import { Ledger } from '../../src/server/Ledger';
import { RiskEngine } from '../../src/server/RiskEngine';
import { PaperTrader } from '../../src/server/PaperTrader';
import { MomentumStrategy } from '../../src/server/MomentumStrategy';
import { LiveDataService } from '../../src/server/LiveDataService';
import { ClosePoint } from '../../src/server/signals/momentum';
import { createMockServer } from '../../kite-paper-node/src/index';

// The 10 mock-backtest case capitals (from run_all_cases.ts).
const CASES = [
  { name: 'case1', capital: 20000 },
  { name: 'case2', capital: 35000 },
  { name: 'case3', capital: 90000 },
  { name: 'case4', capital: 10000 },
  { name: 'case5', capital: 40000 },
  { name: 'case6', capital: 100000 },
  { name: 'case7', capital: 300000 },
  { name: 'case8', capital: 50000 },
  { name: 'case9', capital: 90000 },
  { name: 'case10', capital: 500000 },
];

const DAYS = numEnv('DAYS', 15);
const TOP_N = 4;

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);

  // 1. Start the kite-paper-node mock REST server (serves real NSE daily CSVs).
  console.log(`Starting kite-paper-node mock server (${symbols.length} symbols)...`);
  const server = await createMockServer({
    dataDir: 'kite-paper-node/data',
    ticker: { mode: 'random-walk', randomWalk: { seedSymbols: symbols } },
    server: { port: 4123, host: '127.0.0.1' },
  });
  const base = `http://127.0.0.1:${server.port}`;
  console.log(`Mock server on :${server.port}`);

  // 2. Get instruments (token -> symbol).
  const instRes = (await fetch(`${base}/instruments`).then((r) => r.json())) as any;
  const instruments = (instRes.data ?? []) as Array<{ instrument_token: number; tradingsymbol: string }>;
  const tokenToSymbol = new Map<number, string>();
  for (const i of instruments) tokenToSymbol.set(i.instrument_token, i.tradingsymbol);
  console.log(`Instruments: ${instruments.length}`);

  // 3. Fetch daily closes for all symbols via the REST historical endpoint.
  const closesBySymbol = new Map<string, ClosePoint[]>();
  const to = new Date();
  const from = new Date(to.getTime() - 400 * 24 * 60 * 60 * 1000);
  for (const [token, symbol] of tokenToSymbol) {
    try {
      const url = `${base}/instruments/historical/${token}/day?from=${from.getTime()}&to=${to.getTime()}`;
      const res = (await fetch(url).then((r) => r.json())) as any;
      const data = (res.data ?? []) as Array<{ date: string; close: number }>;
      const pts = data
        .map((c) => ({ date: new Date(c.date).toISOString().slice(0, 10), close: c.close }))
        .filter((p) => Number.isFinite(p.close) && p.close > 0)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      if (pts.length > 60) closesBySymbol.set(symbol, pts);
    } catch {
      /* skip */
    }
  }
  console.log(`Fetched daily data for ${closesBySymbol.size}/${tokenToSymbol.size} symbols.`);

  // Build the sorted list of trading dates.
  const allDates = new Set<string>();
  for (const pts of closesBySymbol.values()) for (const p of pts) allDates.add(p.date);
  const dates = [...allDates].sort();
  if (dates.length < DAYS + 30) {
    console.error('Not enough daily data for a 15-day simulation.');
    await server.stop();
    process.exit(1);
  }
  // Start 15 days before the last date (so we have 15 forward days).
  const startIdx = dates.length - DAYS;
  const startDate = dates[startIdx];
  const simDates = dates.slice(startIdx, startIdx + DAYS);
  console.log(`Simulation window: ${startDate} → ${simDates[simDates.length - 1]} (${simDates.length} days)`);

  // 4. Run the momentum strategy for each case capital.
  const results: Array<{ name: string; capital: number; returnPct: number; pnl: number; trades: number; final: number }> = [];
  for (const c of CASES) {
    config.risk.availableCapital = c.capital;
    config.strategy.momentumTopN = TOP_N;
    // kite-paper-node daily CSVs span ~12 months; a 12-month lookback needs 13,
    // so use a 6-month lookback that fits (demonstrates the live pattern, not the
    // validated 12-month edge).
    config.strategy.momentumLookbackMonths = 6;
    const ledger = new Ledger(':memory:');
    ledger.runMigrations();
    const risk = new RiskEngine(config, ledger);
    const trader = new PaperTrader(config, ledger);
    const strategy = new MomentumStrategy(config, ledger, risk, trader, new LiveDataService());

    // Register instruments so price lookups work.
    for (const [sym, pts] of closesBySymbol) {
      const last = pts[pts.length - 1].close;
      ledger.raw()
        .prepare(`INSERT OR IGNORE INTO instruments (token, tradingsymbol, exchange, segment, instrument_type, name, lot_size, tick_size)
                  VALUES (?, ?, 'NSE', 'NSE', 'EQ', ?, 1, 0.05)`)
        .run(10000 + Math.abs(hash(sym)) % 100000, sym, sym);
      ledger.raw().prepare(`UPDATE instruments SET last_price = ? WHERE tradingsymbol = ?`).run(last, sym);
    }

    // Compute target using data up to startDate.
    const closesUpTo = new Map<string, ClosePoint[]>();
    for (const [sym, pts] of closesBySymbol) {
      const upTo = pts.filter((p) => p.date <= startDate);
      if (upTo.length > 0) closesUpTo.set(sym, upTo);
    }
    const target = strategy.targetPortfolio(closesUpTo);
    if (c.name === 'case1') console.log('  [debug] target:', target);

    // Prices at startDate.
    const prices = new Map<string, number>();
    for (const [sym, pts] of closesBySymbol) {
      const onOrBefore = [...pts].reverse().find((p) => p.date <= startDate);
      if (onOrBefore) prices.set(sym, onOrBefore.close);
    }

    // Execute the rebalance (enter positions).
    const res = strategy.rebalance(new Date(startDate + 'T00:00:00Z'), prices, target);
    const trades = res.bought.length + res.sold.length;

    // Simulate 15 days of price movement, marking to market daily.
    let equity = c.capital;
    const curve: number[] = [equity];
    for (const d of simDates) {
      let eq = c.capital;
      for (const pos of ledger.getOpenPositions()) {
        const pts = closesBySymbol.get(pos.symbol)!;
        const onOrBefore = [...pts].reverse().find((p) => p.date <= d);
        const price = onOrBefore ? onOrBefore.close : pos.avgPrice;
        eq += (price - pos.avgPrice) * pos.quantity;
      }
      equity = eq;
      curve.push(eq);
    }

    const pnl = equity - c.capital;
    const returnPct = (pnl / c.capital) * 100;
    results.push({ name: c.name, capital: c.capital, returnPct, pnl, trades, final: equity });
    console.log(`  ${c.name}: cap ₹${c.capital.toLocaleString('en-IN')} → ₹${equity.toLocaleString('en-IN')} (${returnPct.toFixed(2)}%), ${trades} trades`);
    ledger.close();
  }

  // 5. Rank by return, report the top 5.
  const ranked = [...results].sort((a, b) => b.returnPct - a.returnPct);
  const top5 = ranked.slice(0, 5);

  console.log('\n==============================================================');
  console.log('  MOMENTUM STRATEGY — LIVE PATTERN (kite-paper-node REST)');
  console.log(`  Window: ${startDate} → ${simDates[simDates.length - 1]} (${DAYS} days) | Top ${TOP_N} | 10 cases`);
  console.log('==============================================================');
  console.log('\n  ALL 10 CASES (ranked):');
  ranked.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name}: ${r.returnPct.toFixed(2)}% (₹${r.pnl.toLocaleString('en-IN')})`);
  });
  console.log('\n  STRONG TOP 5 CASES:');
  console.log('  | Case | Capital | Return | P&L | Trades | Final |');
  console.log('  |---|---|---|---|---|---|');
  for (const r of top5) {
    console.log(`  | ${r.name} | ₹${r.capital.toLocaleString('en-IN')} | ${r.returnPct.toFixed(2)}% | ₹${r.pnl.toLocaleString('en-IN')} | ${r.trades} | ₹${r.final.toLocaleString('en-IN')} |`);
  }
  console.log('==============================================================');
  console.log('Note: data served by kite-paper-node from real NSE daily CSVs via');
  console.log('the REST API. Paper execution through RiskEngine + PaperTrader.');

  await server.stop();
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

main().catch((err) => {
  console.error('momentum_live_pattern failed:', err);
  process.exit(1);
});
