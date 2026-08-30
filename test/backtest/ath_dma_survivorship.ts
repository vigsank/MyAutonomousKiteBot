/**
 * ath_dma_survivorship.ts — bound the survivorship bias of the ATH-buy →
 * 220-DMA-sell strategy (indmoney_ath_dma_trade.ts).
 *
 * Same frozen-universe methodology as survivorship_bias.ts: run the cycle on
 * the full current watchlist vs. only symbols already listed before a freeze
 * point. The gap in per-trade expectancy is a FLOOR on the survivorship effect
 * (delisted names remain invisible — this cannot see them).
 *
 * Usage (needs a valid INDmoney access token):
 *   BACKTEST_PROVIDER=indmoney ENV_FILE=.env \
 *     npx ts-node test/backtest/ath_dma_survivorship.ts
 */
import { loadConfig } from '../../src/server/AppConfig';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { Candle } from '../../src/server/types';
import { ClosePoint, sma } from '../../src/server/signals/momentum';
import { detect123 } from '../../src/server/signals/entryScreen';

const DMA_PERIOD = numEnv('DMA_PERIOD', 220);
const DATA_YEARS = numEnv('DATA_YEARS', 4);
const FREEZE_MONTHS = numEnv('FREEZE_MONTHS', 24);

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function roundTripCostPct(): number {
  const c = loadConfig().costs;
  const brokerage = Math.min(c.brokerageBps / 10000, c.brokerageMax / 10000);
  const statutory = c.statutoryBps / 10000;
  const slippage = c.slippageBps / 10000;
  const gst = (brokerage * c.gstPct) / 100;
  return (brokerage + statutory + slippage + gst) * 2;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Trade {
  symbol: string;
  pnlPct: number;
}

/** Run the ATH-buy → DMA-sell cycle for one symbol (net of round-trip cost). */
function simulateSymbol(symbol: string, closes: ClosePoint[], dmaPeriod: number, costPct: number): Trade[] {
  const trades: Trade[] = [];
  let held: { price: number } | null = null;
  for (let i = dmaPeriod; i < closes.length; i++) {
    const upTo = closes.slice(0, i + 1);
    const dma = sma(upTo, dmaPeriod);
    const last = closes[i].close;
    if (dma === null) continue;
    if (!held) {
      if (last >= dma && detect123(upTo).state === 'breakout') held = { price: last };
    } else if (last < dma) {
      trades.push({ symbol, pnlPct: (last / held.price - 1) * 100 - costPct });
      held = null;
    }
  }
  if (held) {
    const last = closes[closes.length - 1];
    trades.push({ symbol, pnlPct: (last.close / held.price - 1) * 100 - costPct });
  }
  return trades;
}

function summarize(trades: Trade[]): { n: number; avg: number; wins: number } {
  if (trades.length === 0) return { n: 0, avg: 0, wins: 0 };
  const avg = trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length;
  const wins = trades.filter((t) => t.pnlPct > 0).length;
  return { n: trades.length, avg, wins };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const provider = createHistoricalProvider(config);

  console.log('==============================================================');
  console.log('  ATH-DMA SURVIVORSHIP-BIAS BOUND');
  console.log(`  Provider: ${provider.name} | configured: ${provider.isConfigured}`);
  console.log('==============================================================');

  if (!provider.isConfigured) {
    console.error('\n❌ INDmoney provider is NOT configured. Set INDMONEY_ACCESS_TOKEN in .env.');
    process.exit(1);
  }

  await provider.loadInstruments('NSE');
  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);
  const to = new Date();
  const from = new Date(to.getTime() - DATA_YEARS * 365 * 24 * 60 * 60 * 1000);

  console.log(`Fetching daily data for ${symbols.length} symbols (${DATA_YEARS}y)...`);
  const closesBySymbol = new Map<string, ClosePoint[]>();
  for (const sym of symbols) {
    try {
      const inst = provider.findInstrument(sym, 'NSE');
      if (!inst) continue;
      const candles: Candle[] = await provider.getHistoricalData(inst.instrument_token, 'day', from, to);
      const closes: ClosePoint[] = candles
        .map((c) => ({ date: c.date.toISOString().slice(0, 10), close: c.close }))
        .filter((p) => Number.isFinite(p.close) && p.close > 0)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      if (closes.length > DMA_PERIOD) closesBySymbol.set(sym, closes);
    } catch {
      /* skip */
    }
  }
  console.log(`Fetched ${closesBySymbol.size}/${symbols.length} symbols.`);

  // Freeze point: FREEZE_MONTHS before the last date. A symbol is
  // frozen-eligible only if it had enough history (DMA_PERIOD days) before the
  // freeze point — i.e. it was already listed and scorable then.
  const allDates = new Set<string>();
  for (const pts of closesBySymbol.values()) for (const p of pts) allDates.add(p.date);
  const lastDate = [...allDates].sort().pop()!;
  const freezePoint = addMonths(lastDate, -FREEZE_MONTHS);
  const eligibilityAnchor = addDays(freezePoint, -DMA_PERIOD);

  const frozenSet = new Set<string>();
  for (const [sym, pts] of closesBySymbol) {
    if (pts[0].date <= eligibilityAnchor) frozenSet.add(sym);
  }

  const costPct = roundTripCostPct() * 100;

  const fullTrades: Trade[] = [];
  const frozenTrades: Trade[] = [];
  for (const [sym, closes] of closesBySymbol) {
    const trades = simulateSymbol(sym, closes, DMA_PERIOD, costPct);
    fullTrades.push(...trades);
    if (frozenSet.has(sym)) frozenTrades.push(...trades);
  }

  const full = summarize(fullTrades);
  const frozen = summarize(frozenTrades);
  const gapPp = full.avg - frozen.avg;

  console.log('\n==============================================================');
  console.log('  RESULTS');
  console.log(`  Freeze point: ${freezePoint} (universe frozen ${FREEZE_MONTHS}mo ago)`);
  console.log(`  DMA period: ${DMA_PERIOD} | Round-trip cost: ${costPct.toFixed(2)}%`);
  console.log('  --------------------------------------------------------------');
  console.log(`  Full universe   (${closesBySymbol.size} symbols): ${full.n} trades, avg ${full.avg.toFixed(2)}%/trade, ${full.wins} wins`);
  console.log(`  Frozen universe (${frozenSet.size} symbols): ${frozen.n} trades, avg ${frozen.avg.toFixed(2)}%/trade, ${frozen.wins} wins`);
  console.log(`  Later entrants excluded: ${closesBySymbol.size - frozenSet.size}`);
  console.log('  --------------------------------------------------------------');
  console.log(`  Survivorship-bias FLOOR: ${gapPp >= 0 ? '+' : ''}${gapPp.toFixed(2)}pp per trade`);
  console.log('  (return attributable to names not yet listed at the freeze point;');
  console.log('   a floor, not the full effect — delisted names remain invisible)');
  console.log('==============================================================');
}

main().catch((err) => {
  console.error('ath_dma_survivorship failed:', err);
  process.exit(1);
});
