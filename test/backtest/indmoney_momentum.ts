/**
 * indmoney_momentum.ts — run the cross-sectional momentum strategy against
 * INDmoney (INDstocks) historical data.
 *
 * This is the "real-data" harness: it pulls daily closes from the INDstocks
 * `/market/historical/1day` endpoint (via IndMoneyStreamer) and runs the SAME
 * momentum signal the bot uses (12-month lookback, skip 1, top-N + hysteresis),
 * rebalanced monthly, net of the paper cost model.
 *
 * Usage (needs a valid INDmoney access token):
 *   INDMONEY_ACCESS_TOKEN=... BACKTEST_PROVIDER=indmoney \
 *     ENV_FILE=.env.test npx ts-node test/backtest/indmoney_momentum.ts
 *
 * Without a token the harness prints clear setup instructions and exits.
 */
import { loadConfig } from '../../src/server/AppConfig';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { Candle } from '../../src/server/types';
import {
  computeMomentum,
  selectWithHysteresis,
  MomentumInput,
} from '../../src/server/signals/momentum';

const LOOKBACK_MONTHS = numEnv('MOM_LOOKBACK', 12); // trailing momentum window
const SKIP_MONTHS = numEnv('MOM_SKIP', 1); // skip most recent month (reversal)
const TOP_N = numEnv('MOM_TOP', 6); // names to hold
const HYSTERESIS_BAND = numEnv('MOM_BAND', 8); // rank-hysteresis band
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
  const gst = (brokerage * c.gstPct) / 100;
  return (brokerage + statutory + slippage + gst) * 2; // entry + exit
}

async function main(): Promise<void> {
  const config = loadConfig();
  const provider = createHistoricalProvider(config);

  console.log('==============================================================');
  console.log('  INDmoney (INDstocks) momentum backtest');
  console.log(`  Provider: ${provider.name} | configured: ${provider.isConfigured}`);
  console.log('==============================================================');

  if (!provider.isConfigured) {
    console.error('\n❌ INDmoney provider is NOT configured.');
    console.error('   Set INDMONEY_ACCESS_TOKEN in .env (24h token, manual), then run:');
    console.error('   BACKTEST_PROVIDER=indmoney npx ts-node test/backtest/indmoney_momentum.ts');
    process.exit(1);
  }

  // Resolve the watchlist symbols against the INDstocks instrument master.
  console.log('Loading INDmoney instrument master (NSE)...');
  await provider.loadInstruments('NSE');

  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);
  const to = new Date();
  const from = new Date(to.getTime() - DATA_YEARS * 365 * 24 * 60 * 60 * 1000);

  console.log(`Fetching daily data for ${symbols.length} symbols (${DATA_YEARS}y)...`);
  const closesBySymbol = new Map<string, Map<string, number>>();
  let fetched = 0;
  for (const sym of symbols) {
    try {
      const inst = provider.findInstrument(sym, 'NSE');
      if (!inst) {
        console.warn(`  ⚠️  ${sym}: instrument not found (run loadInstruments first?)`);
        continue;
      }
      const candles: Candle[] = await provider.getHistoricalData(
        inst.instrument_token,
        'day',
        from,
        to,
      );
      const map = new Map<string, number>();
      for (const c of candles) map.set(c.date.toISOString().slice(0, 10), c.close);
      if (map.size > 60) {
        closesBySymbol.set(sym, map);
        fetched++;
      }
    } catch (err) {
      console.warn(`  ⚠️  ${sym}: fetch failed (${(err as Error)?.message})`);
    }
  }
  console.log(`Fetched ${fetched}/${symbols.length} symbols.`);

  if (fetched === 0) {
    console.error('\n❌ No data fetched. Check the token and network, then retry.');
    process.exit(1);
  }

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
  const monthlyReturns: Array<{ date: string; ret: number; picks: string[] }> = [];
  let held: string[] = [];

  for (let i = 0; i < rebalanceDates.length; i++) {
    const rebalDate = rebalanceDates[i];
    const nextDate = rebalanceDates[i + 1];
    if (!nextDate) break;

    // Build MomentumInput for each symbol up to the rebalance date.
    const inputs: MomentumInput[] = [];
    for (const [sym, map] of closesBySymbol) {
      const closes = [...map.entries()]
        .filter(([d]) => d <= rebalDate)
        .map(([date, close]) => ({ date, close }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      if (closes.length > 0) inputs.push({ symbol: sym, closes });
    }

    // Rank by momentum (12m lookback, skip 1) and select with hysteresis.
    const ranked = inputs
      .map((inp) => ({ symbol: inp.symbol, momentum: computeMomentum(inp.closes, LOOKBACK_MONTHS, SKIP_MONTHS) }))
      .filter((r): r is { symbol: string; momentum: number } => r.momentum !== null)
      .sort((a, b) => b.momentum - a.momentum);

    const picks = selectWithHysteresis(ranked, held, TOP_N, HYSTERESIS_BAND);
    held = picks;

    // Hold 1 month: return from rebalDate close to nextDate close, net of costs.
    let gross = 0;
    let valid = 0;
    for (const p of picks) {
      const map = closesBySymbol.get(p);
      if (!map) continue;
      const entry = map.get(rebalDate);
      const exit = map.get(nextDate);
      if (entry && exit && entry > 0) {
        gross += exit / entry - 1;
        valid++;
      }
    }
    if (valid === 0) continue;
    const net = gross / valid - costPct;
    monthlyReturns.push({ date: rebalDate, ret: net, picks });
  }

  const n = monthlyReturns.length;
  const total = monthlyReturns.reduce((s, r) => s + r.ret, 0);
  const avg = n ? total / n : 0;
  const positive = monthlyReturns.filter((r) => r.ret > 0).length;
  const annualized = Math.pow(1 + avg, 12) - 1;

  console.log('\n==============================================================');
  console.log('  CROSS-SECTIONAL MOMENTUM (INDmoney data)');
  console.log(`  Symbols: ${fetched} | Months: ${n} | Cost/round-trip: ${(costPct * 100).toFixed(2)}%`);
  console.log(`  Avg monthly return (net): ${(avg * 100).toFixed(2)}%`);
  console.log(`  Annualized (net): ${(annualized * 100).toFixed(2)}%`);
  console.log(`  Positive months: ${positive}/${n} (${n ? ((positive / n) * 100).toFixed(0) : 0}%)`);
  console.log(`  Total net return: ${(total * 100).toFixed(2)}%`);
  console.log('==============================================================');

  // Per-month detail (last 12 months).
  console.log('\nPer-month (last 12):');
  for (const m of monthlyReturns.slice(-12)) {
    console.log(`  ${m.date}  ${(m.ret * 100).toFixed(2).padStart(7)}%  [${m.picks.join(', ')}]`);
  }

  console.log('\nCaveat: current-listed universe only (survivorship bias).');
}

main().catch((err) => {
  console.error('indmoney_momentum failed:', err);
  process.exit(1);
});
