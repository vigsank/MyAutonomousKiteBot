/**
 * indmoney_ath_dma_trade.ts — the master-class 1-2-3 / 220-DMA cycle, backtested
 * on historical INDmoney (INDstocks) data.
 *
 * Per symbol, independently:
 *   BUY  when the close makes a new all-time high (1-2-3 breakout) AND is above
 *        its 220-DMA (uptrend guard).
 *   SELL when the close breaks below its 220-DMA (the class's stop rule).
 *
 * Reports per-trade P&L, win rate, and aggregate profit. This is the full
 * ENTRY + EXIT cycle of #18 (the defensive exit alone was validated in
 * entry_tracker_validation.ts; this exercises the opportunistic breakout entry
 * too, which the walk-forward did not).
 *
 * Usage (needs a valid INDmoney access token):
 *   BACKTEST_PROVIDER=indmoney ENV_FILE=.env.test \
 *     npx ts-node test/backtest/indmoney_ath_dma_trade.ts
 */
import { loadConfig } from '../../src/server/AppConfig';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { Candle } from '../../src/server/types';
import { ClosePoint, sma } from '../../src/server/signals/momentum';
import { detect123 } from '../../src/server/signals/entryScreen';

const DMA_PERIOD = numEnv('DMA_PERIOD', 220);
const DATA_YEARS = numEnv('DATA_YEARS', 4);
const CAPITAL_PER_TRADE = numEnv('CAPITAL_PER_TRADE', 100_000);

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

interface Trade {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  pnlPct: number;
  holdingDays: number;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((db - da) / (24 * 60 * 60 * 1000));
}

/** Run the ATH-buy → DMA-sell cycle for one symbol. `costPct` is the round-trip cost in percentage points. */
function simulateSymbol(symbol: string, closes: ClosePoint[], dmaPeriod: number, costPct: number): Trade[] {
  const trades: Trade[] = [];
  let held: { date: string; price: number } | null = null;

  for (let i = dmaPeriod; i < closes.length; i++) {
    const upTo = closes.slice(0, i + 1);
    const dma = sma(upTo, dmaPeriod);
    const last = closes[i].close;
    if (dma === null) continue;

    if (!held) {
      // BUY: new ATH (1-2-3 breakout) AND above the DMA.
      if (last >= dma && detect123(upTo).state === 'breakout') {
        held = { date: closes[i].date, price: last };
      }
    } else if (last < dma) {
      // SELL: close broke below the DMA (the class's stop).
      trades.push({
        symbol,
        entryDate: held.date,
        entryPrice: held.price,
        exitDate: closes[i].date,
        exitPrice: last,
        pnlPct: (last / held.price - 1) * 100 - costPct,
        holdingDays: daysBetween(held.date, closes[i].date),
      });
      held = null;
    }
  }

  // Close any still-open position at the last close.
  if (held) {
    const last = closes[closes.length - 1];
    trades.push({
      symbol,
      entryDate: held.date,
      entryPrice: held.price,
      exitDate: last.date,
      exitPrice: last.close,
      pnlPct: (last.close / held.price - 1) * 100 - costPct,
      holdingDays: daysBetween(held.date, last.date),
    });
  }
  return trades;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const provider = createHistoricalProvider(config);

  console.log('==============================================================');
  console.log('  ATH-buy → 220-DMA-sell (INDmoney historical data)');
  console.log(`  Provider: ${provider.name} | configured: ${provider.isConfigured}`);
  console.log(`  DMA period: ${DMA_PERIOD} | History: ${DATA_YEARS}y | Capital/trade: ₹${CAPITAL_PER_TRADE.toLocaleString('en-IN')}`);
  console.log('==============================================================');

  if (!provider.isConfigured) {
    console.error('\n❌ INDmoney provider is NOT configured.');
    console.error('   Set INDMONEY_ACCESS_TOKEN in .env (24h token, manual), then run:');
    console.error('   BACKTEST_PROVIDER=indmoney npx ts-node test/backtest/indmoney_ath_dma_trade.ts');
    process.exit(1);
  }

  console.log('Loading INDmoney instrument master (NSE)...');
  await provider.loadInstruments('NSE');

  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);
  const to = new Date();
  const from = new Date(to.getTime() - DATA_YEARS * 365 * 24 * 60 * 60 * 1000);

  console.log(`Fetching daily data for ${symbols.length} symbols (${DATA_YEARS}y)...`);
  const closesBySymbol = new Map<string, ClosePoint[]>();
  let fetched = 0;
  for (const sym of symbols) {
    try {
      const inst = provider.findInstrument(sym, 'NSE');
      if (!inst) continue;
      const candles: Candle[] = await provider.getHistoricalData(inst.instrument_token, 'day', from, to);
      const closes: ClosePoint[] = candles
        .map((c) => ({ date: c.date.toISOString().slice(0, 10), close: c.close }))
        .filter((p) => Number.isFinite(p.close) && p.close > 0)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      if (closes.length > DMA_PERIOD) {
        closesBySymbol.set(sym, closes);
        fetched++;
      }
    } catch {
      /* skip */
    }
  }
  console.log(`Fetched ${fetched}/${symbols.length} symbols (with >${DMA_PERIOD} days).`);

  if (fetched === 0) {
    console.error('\n❌ No data fetched. Check the token and network, then retry.');
    process.exit(1);
  }

  // Run the cycle per symbol.
  const costPct = roundTripCostPct() * 100; // percentage points
  const allTrades: Trade[] = [];
  for (const [sym, closes] of closesBySymbol) {
    allTrades.push(...simulateSymbol(sym, closes, DMA_PERIOD, costPct));
  }

  if (allTrades.length === 0) {
    console.log('\nNo trades generated — no symbol made a new ATH above its DMA in the window.');
    process.exit(0);
  }

  const wins = allTrades.filter((t) => t.pnlPct > 0);
  const losses = allTrades.filter((t) => t.pnlPct <= 0);
  const totalPnlPct = allTrades.reduce((s, t) => s + t.pnlPct, 0);
  const avgPnlPct = totalPnlPct / allTrades.length;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length : 0;
  const avgHold = allTrades.reduce((s, t) => s + t.holdingDays, 0) / allTrades.length;
  const totalProfitInr = (totalPnlPct / 100) * CAPITAL_PER_TRADE;

  console.log('\n==============================================================');
  console.log('  RESULTS');
  console.log('==============================================================');
  console.log(`  Trades: ${allTrades.length} | Wins: ${wins.length} | Losses: ${losses.length}`);
  console.log(`  Round-trip cost: ${costPct.toFixed(2)}% (net of costs)`);
  console.log(`  Win rate: ${((wins.length / allTrades.length) * 100).toFixed(0)}%`);
  console.log(`  Avg P&L/trade: ${avgPnlPct.toFixed(2)}%`);
  console.log(`  Avg win: ${avgWin.toFixed(2)}% | Avg loss: ${avgLoss.toFixed(2)}%`);
  console.log(`  Avg holding: ${avgHold.toFixed(0)} days`);
  console.log(`  Total P&L (sum of %): ${totalPnlPct.toFixed(2)}%`);
  console.log(`  Total profit @ ₹${CAPITAL_PER_TRADE.toLocaleString('en-IN')}/trade: ₹${totalProfitInr.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`);
  console.log('==============================================================');

  // Best and worst trades.
  const sorted = [...allTrades].sort((a, b) => b.pnlPct - a.pnlPct);
  console.log('\nBest 5 trades:');
  for (const t of sorted.slice(0, 5)) {
    console.log(`  ${t.symbol.padEnd(14)} ${t.entryDate} → ${t.exitDate}  ${t.pnlPct.toFixed(1).padStart(7)}%  (${t.holdingDays}d)`);
  }
  console.log('Worst 5 trades:');
  for (const t of sorted.slice(-5).reverse()) {
    console.log(`  ${t.symbol.padEnd(14)} ${t.entryDate} → ${t.exitDate}  ${t.pnlPct.toFixed(1).padStart(7)}%  (${t.holdingDays}d)`);
  }

  console.log('\nCaveat: current-listed universe only (survivorship bias); net of round-trip cost/slippage.');
}

main().catch((err) => {
  console.error('indmoney_ath_dma_trade failed:', err);
  process.exit(1);
});
