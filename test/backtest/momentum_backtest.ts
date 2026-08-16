/**
 * momentum_backtest.ts — cross-sectional momentum / relative-strength backtest.
 *
 * Hypothesis (Initiative 0 candidate): rank NSE symbols by trailing momentum and
 * long the top decile, rebalanced monthly. Momentum is a robust, well-documented
 * anomaly and is LONG-only friendly.
 *
 * Methodology (out-of-sample, net of costs):
 *  - Fetch daily closes for all enabled watchlist symbols from Yahoo.
 *  - At each monthly rebalance, rank by momentum = return over [t-3m, t-1m]
 *    (skip the most recent month to avoid short-term reversal).
 *  - Long the top `topN` symbols, equal weight, hold 1 month.
 *  - Apply the same cost model as PaperTrader (slippage + brokerage + statutory).
 *
 * Usage:
 *   ENV_FILE=.env.test npx ts-node test/backtest/momentum_backtest.ts
 */
import { loadConfig } from '../../src/server/AppConfig';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { Candle } from '../../src/server/types';

const LOOKBACK_MONTHS = numEnv('MOM_LOOKBACK', 3); // momentum window
const SKIP_MONTHS = numEnv('MOM_SKIP', 1); // skip most recent month (short-term reversal)
const HOLD_MONTHS = numEnv('MOM_HOLD', 1); // rebalance period
const TOP_N = numEnv('MOM_TOP', 10); // number of symbols to hold
const CAPITAL = 500_000;
const DATA_YEARS = numEnv('MOM_YEARS', 2); // years of history to fetch

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Round-trip cost as a fraction of notional (mirrors PaperTrader). */
function roundTripCostPct(): number {
  const c = loadConfig().costs;
  const brokerage = Math.min(c.brokerageBps / 10000, c.brokerageMax / 10000);
  const statutory = c.statutoryBps / 10000;
  const slippage = c.slippageBps / 10000;
  const gst = brokerage * c.gstPct / 100;
  return (brokerage + statutory + slippage + gst) * 2; // entry + exit
}

async function main(): Promise<void> {
  const config = loadConfig();
  const provider = createHistoricalProvider(config);
  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);

  const to = new Date();
  const from = new Date(to.getTime() - DATA_YEARS * 365 * 24 * 60 * 60 * 1000);

  console.log(`Fetching daily data for ${symbols.length} symbols...`);
  const closesBySymbol = new Map<string, Map<string, number>>(); // symbol -> date -> close
  let fetched = 0;
  for (const sym of symbols) {
    try {
      const inst = provider.findInstrument(sym, 'NSE');
      if (!inst) continue;
      const candles: Candle[] = await provider.getHistoricalData(inst.instrument_token, 'day', from, to);
      const map = new Map<string, number>();
      for (const c of candles) map.set(c.date.toISOString().slice(0, 10), c.close);
      if (map.size > 60) {
        closesBySymbol.set(sym, map);
        fetched++;
      }
    } catch {
      /* skip symbol on fetch error */
    }
  }
  console.log(`Fetched ${fetched}/${symbols.length} symbols.`);

  // Build a sorted list of all trading dates.
  const allDates = new Set<string>();
  for (const map of closesBySymbol.values()) for (const d of map.keys()) allDates.add(d);
  const dates = [...allDates].sort();

  // Monthly rebalance dates: first trading day of each month.
  const rebalanceDates: string[] = [];
  let lastMonth = '';
  for (const d of dates) {
    const m = d.slice(0, 7);
    if (m !== lastMonth) {
      rebalanceDates.push(d);
      lastMonth = m;
    }
  }

  const costPct = roundTripCostPct();
  const monthlyReturns: number[] = [];
  const trades: Array<{ date: string; symbol: string; ret: number }> = [];

  for (let i = 0; i < rebalanceDates.length; i++) {
    const rebalDate = rebalanceDates[i];
    const nextDate = rebalanceDates[i + 1];
    if (!nextDate) break;

    // Momentum window: [rebalDate - LOOKBACK - SKIP, rebalDate - SKIP] months.
    const skipDate = addMonths(rebalDate, -SKIP_MONTHS);
    const lookbackDate = addMonths(rebalDate, -(LOOKBACK_MONTHS + SKIP_MONTHS));

    const scored: Array<{ symbol: string; mom: number }> = [];
    for (const [sym, map] of closesBySymbol) {
      const start = closeOnOrBefore(map, lookbackDate);
      const end = closeOnOrBefore(map, skipDate);
      if (start && end && start > 0) {
        scored.push({ symbol: sym, mom: end / start - 1 });
      }
    }
    if (scored.length < TOP_N) continue;
    scored.sort((a, b) => b.mom - a.mom);
    const picks = scored.slice(0, TOP_N);

    // Hold 1 month: return from rebalDate close to nextDate close, net of costs.
    let gross = 0;
    let valid = 0;
    for (const p of picks) {
      const map = closesBySymbol.get(p.symbol)!;
      const entry = map.get(rebalDate);
      const exit = map.get(nextDate);
      if (entry && exit && entry > 0) {
        const ret = exit / entry - 1;
        gross += ret;
        valid++;
        trades.push({ date: rebalDate, symbol: p.symbol, ret });
      }
    }
    if (valid === 0) continue;
    const avgGross = gross / valid;
    const net = avgGross - costPct;
    monthlyReturns.push(net);
  }

  const n = monthlyReturns.length;
  const total = monthlyReturns.reduce((s, r) => s + r, 0);
  const avg = n ? total / n : 0;
  const positive = monthlyReturns.filter((r) => r > 0).length;
  const annualized = Math.pow(1 + avg, 12) - 1;

  console.log('\n==============================================================');
  console.log('  CROSS-SECTIONAL MOMENTUM (top ' + TOP_N + ', monthly rebalance)');
  console.log(`  Symbols: ${fetched} | Months: ${n} | Cost/round-trip: ${(costPct * 100).toFixed(2)}%`);
  console.log(`  Avg monthly return (net): ${(avg * 100).toFixed(2)}%`);
  console.log(`  Annualized (net): ${(annualized * 100).toFixed(2)}%`);
  console.log(`  Positive months: ${positive}/${n} (${((positive / n) * 100).toFixed(0)}%)`);
  console.log(`  Total net return: ${(total * 100).toFixed(2)}%`);
  console.log('==============================================================');
  console.log('Caveat: current-listed universe only (survivorship bias).');
}

/** Add months to a YYYY-MM-DD date string. */
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Close on or before a date, or null. */
function closeOnOrBefore(map: Map<string, number>, date: string): number | null {
  const keys = [...map.keys()].sort();
  for (let i = keys.length - 1; i >= 0; i--) {
    if (keys[i] <= date) return map.get(keys[i])!;
  }
  return null;
}

main().catch((err) => {
  console.error('momentum_backtest failed:', err);
  process.exit(1);
});
