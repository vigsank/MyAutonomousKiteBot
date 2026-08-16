/**
 * optimize_momentum.ts — feedback-loop optimizer (Initiative 3).
 *
 * Sweeps `momentumTopN` over the end-to-end momentum strategy backtest and writes
 * the best value to the persistent `strategy_params` store, which the live
 * `MomentumStrategy` reads at startup.
 *
 * Usage:
 *   ENV_FILE=.env.test npx ts-node test/backtest/optimize_momentum.ts
 */
import { loadConfig } from '../../src/server/AppConfig';
import { Ledger } from '../../src/server/Ledger';
import { RiskEngine } from '../../src/server/RiskEngine';
import { PaperTrader } from '../../src/server/PaperTrader';
import { MomentumStrategy } from '../../src/server/MomentumStrategy';
import { LiveDataService } from '../../src/server/LiveDataService';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { ClosePoint } from '../../src/server/signals/momentum';

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

async function main(): Promise<void> {
  const config = loadConfig();
  config.risk.availableCapital = numEnv('CAPITAL', 500_000);
  const provider = createHistoricalProvider(config);
  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);

  const to = new Date();
  const from = new Date(to.getTime() - 4 * 365 * 24 * 60 * 60 * 1000);
  console.log(`Fetching daily data for ${symbols.length} symbols...`);

  const closesBySymbol = new Map<string, ClosePoint[]>();
  for (const sym of symbols) {
    try {
      const inst = provider.findInstrument(sym, 'NSE');
      if (!inst) continue;
      const candles = await provider.getHistoricalData(inst.instrument_token, 'day', from, to);
      const pts = candles
        .map((c) => ({ date: c.date.toISOString().slice(0, 10), close: c.close }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      if (pts.length > 60) closesBySymbol.set(sym, pts);
    } catch {
      /* skip */
    }
  }
  console.log(`Fetched ${closesBySymbol.size}/${symbols.length} symbols.`);

  const allDates = new Set<string>();
  for (const pts of closesBySymbol.values()) for (const p of pts) allDates.add(p.date);
  const dates = [...allDates].sort();
  const rebalanceDates: string[] = [];
  let lastMonth = '';
  for (const d of dates) {
    const m = d.slice(0, 7);
    if (m !== lastMonth) {
      rebalanceDates.push(d);
      lastMonth = m;
    }
  }

  const results: Array<{ topN: number; annualized: number; total: number; positive: number; months: number }> = [];

  for (let topN = 2; topN <= 10; topN++) {
    config.strategy.momentumTopN = topN;
    const ledger = new Ledger(':memory:');
    ledger.runMigrations();
    const risk = new RiskEngine(config, ledger);
    const trader = new PaperTrader(config, ledger);
    const strategy = new MomentumStrategy(config, ledger, risk, trader, new LiveDataService());

    for (const [sym, pts] of closesBySymbol) {
      const last = pts[pts.length - 1].close;
      ledger.raw()
        .prepare(`INSERT OR IGNORE INTO instruments (token, tradingsymbol, exchange, segment, instrument_type, name, lot_size, tick_size)
                  VALUES (?, ?, 'NSE', 'NSE', 'EQ', ?, 1, 0.05)`)
        .run(10000 + Math.abs(hash(sym)) % 100000, sym, sym);
      ledger.raw().prepare(`UPDATE instruments SET last_price = ? WHERE tradingsymbol = ?`).run(last, sym);
    }

    const monthlyReturns: number[] = [];
    let equity = config.risk.availableCapital;
    for (let i = 0; i < rebalanceDates.length; i++) {
      const rebalDate = rebalanceDates[i];
      const nextDate = rebalanceDates[i + 1];
      if (!nextDate) break;

      const closesUpTo = new Map<string, ClosePoint[]>();
      for (const [sym, pts] of closesBySymbol) {
        const upTo = pts.filter((p) => p.date <= rebalDate);
        if (upTo.length > 0) closesUpTo.set(sym, upTo);
      }
      const target = strategy.targetPortfolio(closesUpTo);
      const prices = new Map<string, number>();
      for (const [sym, pts] of closesBySymbol) {
        const onOrBefore = [...pts].reverse().find((p) => p.date <= rebalDate);
        if (onOrBefore) prices.set(sym, onOrBefore.close);
      }
      strategy.rebalance(new Date(rebalDate + 'T00:00:00Z'), prices, target);

      let eq = config.risk.availableCapital;
      for (const pos of ledger.getOpenPositions()) {
        const pts = closesBySymbol.get(pos.symbol)!;
        const exit = [...pts].reverse().find((p) => p.date <= nextDate);
        const price = exit ? exit.close : pos.avgPrice;
        eq += (price - pos.avgPrice) * pos.quantity;
      }
      const ret = eq / equity - 1;
      monthlyReturns.push(ret);
      equity = eq;
    }

    const n = monthlyReturns.length;
    const total = monthlyReturns.reduce((s, r) => s + r, 0);
    const avg = n ? total / n : 0;
    const positive = monthlyReturns.filter((r) => r > 0).length;
    const annualized = Math.pow(1 + avg, 12) - 1;
    results.push({ topN, annualized, total, positive, months: n });
    console.log(`  topN=${topN}: annualized ${(annualized * 100).toFixed(2)}%, total ${(total * 100).toFixed(2)}%, positive ${positive}/${n}`);
    ledger.close();
  }

  results.sort((a, b) => b.annualized - a.annualized);
  const best = results[0];
  console.log('\n==============================================================');
  console.log(`  BEST: topN=${best.topN} (annualized ${(best.annualized * 100).toFixed(2)}%)`);
  console.log('==============================================================');

  // Write the best to a persistent ledger's param store.
  const dataDir = process.env.DATA_DIR || 'data';
  const persist = new Ledger(dataDir);
  persist.runMigrations();
  persist.setStrategyParam('momentumTopN', String(best.topN), 'optimizer');
  console.log(`Wrote momentumTopN=${best.topN} to ${dataDir}/ledger.db strategy_params.`);
  persist.close();
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

main().catch((err) => {
  console.error('optimize_momentum failed:', err);
  process.exit(1);
});
