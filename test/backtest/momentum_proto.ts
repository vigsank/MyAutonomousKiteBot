/**
 * Momentum prototype — cross-sectional relative-strength backtest (R&D).
 *
 * Every HOLD days, rank all symbols by trailing LOOKBACK return and buy the
 * TOP_N strongest, equal-weight. Reports full-period metrics plus a 50/50
 * in-sample / out-of-sample split so you can see if the edge holds OOS.
 *
 * Usage:
 *   WATCHLIST_FILE=tmp_ab_watchlist_wide.json BACKTEST_DAYS=800 \
 *   MOM_LOOKBACK=90 MOM_HOLD=30 MOM_TOP_N=5 npx ts-node test/backtest/momentum_proto.ts
 */
import { loadConfig } from '../../src/server/AppConfig';
import { createHistoricalProvider } from '../../src/server/providers/factory';

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

interface Row { date: string; closes: Map<string, number>; }

function metrics(equity: number[], capital: number) {
  const ret = (equity[equity.length - 1] / capital - 1) * 100;
  let peak = capital;
  let maxDd = 0;
  for (const e of equity) {
    peak = Math.max(peak, e);
    if (peak > 0) maxDd = Math.max(maxDd, (peak - e) / peak * 100);
  }
  return { returnPct: ret, maxDrawdownPct: maxDd };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const days = numEnv('BACKTEST_DAYS', 800);
  const lookback = numEnv('MOM_LOOKBACK', 90);
  const hold = numEnv('MOM_HOLD', 30);
  const topN = numEnv('MOM_TOP_N', 5);
  const capital = 2_000_000;
  const symbols = config.watchlist.filter((s) => s.enabled);

  const streamer = createHistoricalProvider(config);
  await streamer.loadInstruments('NSE');
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  // Fetch daily closes per symbol.
  const series = new Map<string, Map<string, number>>(); // symbol -> date -> close
  for (const sym of symbols) {
    const inst = streamer.findInstrument(sym.tradingsymbol, 'NSE');
    if (!inst) continue;
    const candles = await streamer
      .getHistoricalData(inst.instrument_token, 'day', from, to)
      .catch(() => []);
    const m = new Map<string, number>();
    for (const c of candles) m.set(c.date.toISOString().slice(0, 10), c.close);
    series.set(sym.tradingsymbol, m);
  }

  // Build a date-ordered list of all trading dates (union).
  const allDates = new Set<string>();
  for (const m of series.values()) for (const d of m.keys()) allDates.add(d);
  const dates = [...allDates].sort();

  // Walk forward, rebalancing every HOLD days.
  const equity: number[] = [capital];
  let holdings: string[] = [];
  let lastRebalance = -Infinity;
  const cost = 0.001; // ~0.1% round-trip per position per rebalance

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    // Rebalance at the start of each HOLD window (after enough history).
    if (i - lastRebalance >= hold && i >= lookback) {
      const prevDate = dates[i - lookback];
      const ranked: Array<{ sym: string; ret: number }> = [];
      for (const [sym, m] of series) {
        const now = m.get(date);
        const then = m.get(prevDate);
        if (now && then && then > 0) ranked.push({ sym, ret: now / then - 1 });
      }
      ranked.sort((a, b) => b.ret - a.ret);
      holdings = ranked.slice(0, topN).map((r) => r.sym);
      lastRebalance = i;
    }

    // Mark-to-market the current holdings.
    let dayRet = 0;
    if (holdings.length > 0) {
      const prevDate = dates[i - 1];
      let sum = 0;
      for (const sym of holdings) {
        const now = series.get(sym)?.get(date);
        const then = series.get(sym)?.get(prevDate);
        if (now && then && then > 0) sum += now / then - 1;
      }
      dayRet = sum / holdings.length;
    }
    equity.push(equity[equity.length - 1] * (1 + dayRet));
  }

  // Apply rebalance costs (approximate: topN positions × cost per rebalance).
  const rebalances = Math.floor(dates.length / hold);
  const costDrag = rebalances * topN * cost;
  const finalEquity = equity[equity.length - 1] * (1 - costDrag);

  const full = metrics([...equity.slice(0, -1), finalEquity], capital);
  // 50/50 split: first half in-sample, second half OOS.
  const half = Math.floor(equity.length / 2);
  const isEq = metrics(equity.slice(0, half), capital);
  const oosEq = metrics(equity.slice(half), equity[half - 1]);

  console.log(`\n=== momentum (lookback=${lookback}d, hold=${hold}d, topN=${topN}) ===`);
  console.log(`  Full period: return ${full.returnPct.toFixed(2)}% | maxDD ${full.maxDrawdownPct.toFixed(2)}%`);
  console.log(`  In-sample (first half): return ${isEq.returnPct.toFixed(2)}%`);
  console.log(`  Out-of-sample (second half): return ${oosEq.returnPct.toFixed(2)}%`);
  console.log(`  Rebalances: ${rebalances} | cost drag ~${(costDrag * 100).toFixed(1)}%`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Momentum prototype failed:', err);
  process.exit(1);
});
