/**
 * Signal prototype — walk-forward test of candidate signals (R&D, standalone).
 *
 * Does NOT touch MarketAgent. Fetches daily candles, runs each candidate signal
 * through rolling OOS folds (fresh state per fold, warmup on leading bars), and
 * reports a blunt VALIDATED / NOT VALIDATED verdict per signal.
 *
 * Usage:
 *   WATCHLIST_FILE=tmp_ab_watchlist_wide.json BACKTEST_DAYS=400 \
 *   npx ts-node test/backtest/signal_proto.ts
 */
import { RSI, ADX, ATR, SMA } from '@debut/indicators';
import { loadConfig } from '../../src/server/AppConfig';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { Candle } from '../../src/server/types';

const MIN_OOS_TRADES = 30;
const DEFAULT_CAPITAL = 2_000_000;

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

interface Trade { pnl: number; }

/** Simple net-of-cost PnL for a round trip (slippage + brokerage + STT). */
function roundTripPnl(entry: number, exit: number, qty: number): number {
  const slip = 0.0005;
  const buy = entry * (1 + slip);
  const sell = exit * (1 - slip);
  const brokerage = 0.0002 * (buy * qty + sell * qty);
  const stt = 0.001 * sell * qty;
  return (sell - buy) * qty - brokerage - stt;
}

function metrics(pnls: number[], capital: number) {
  if (pnls.length === 0) return { trades: 0, returnPct: 0, expectancy: 0, winRate: 0, profitFactor: 0 };
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossProfit = wins.reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
  return {
    trades: pnls.length,
    returnPct: (pnls.reduce((s, p) => s + p, 0) / capital) * 100,
    expectancy: pnls.reduce((s, p) => s + p, 0) / pnls.length,
    winRate: (wins.length / pnls.length) * 100,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
  };
}

/** A candidate signal: returns a list of round-trip PnLs for one symbol's candles. */
type Signal = (candles: Candle[], capital: number) => number[];

/** Trend-following: buy close > 20d high + ADX>=25 + close>SMA50; exit on SMA20 cross or 2xATR stop. */
const trendBreakout: Signal = (candles, capital) => {
  const adx = new ADX(14);
  const sma20 = new SMA(20);
  const sma50 = new SMA(50);
  const atr = new ATR(14);
  const pnls: number[] = [];
  let pos: { qty: number; entry: number; stop: number } | null = null;
  const highs: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const a = adx.nextValue(c.high, c.low, c.close);
    const s20 = sma20.nextValue(c.close);
    const s50 = sma50.nextValue(c.close);
    const t = atr.nextValue(c.high, c.low, c.close);
    highs.push(c.high);
    if (highs.length > 20) highs.shift();
    const priorHigh = i >= 20 ? Math.max(...highs.slice(0, -1)) : 0;

    if (!pos) {
      if (i >= 20 && a && a.adx !== undefined && a.adx >= 25 && s20 !== undefined && s50 !== undefined && s20 > s50 && c.close > priorHigh) {
        const qty = Math.max(1, Math.floor((capital * 0.02) / c.close));
        pos = { qty, entry: c.close, stop: c.close - (t ? t * 2 : c.close * 0.05) };
      }
    } else {
      const exit = (s20 !== undefined && c.close < s20) || c.close <= pos.stop;
      if (exit) {
        pnls.push(roundTripPnl(pos.entry, c.close, pos.qty));
        pos = null;
      } else {
        pos.stop = Math.max(pos.stop, c.close - (t ? t * 2 : c.close * 0.05));
      }
    }
  }
  if (pos) pnls.push(roundTripPnl(pos.entry, candles[candles.length - 1].close, pos.qty));
  return pnls;
};

/** Dual SMA crossover: buy SMA20>SMA50, exit SMA20<SMA50. */
const smaCross: Signal = (candles, capital) => {
  const sma20 = new SMA(20);
  const sma50 = new SMA(50);
  const pnls: number[] = [];
  let pos: { qty: number; entry: number } | null = null;
  let prev20: number | undefined;
  let prev50: number | undefined;
  for (const c of candles) {
    const s20 = sma20.nextValue(c.close);
    const s50 = sma50.nextValue(c.close);
    if (s20 !== undefined && s50 !== undefined) {
      if (!pos && prev20 !== undefined && prev50 !== undefined && prev20 <= prev50 && s20 > s50) {
        pos = { qty: Math.max(1, Math.floor((capital * 0.02) / c.close)), entry: c.close };
      } else if (pos && prev20 !== undefined && prev50 !== undefined && prev20 >= prev50 && s20 < s50) {
        pnls.push(roundTripPnl(pos.entry, c.close, pos.qty));
        pos = null;
      }
      prev20 = s20;
      prev50 = s50;
    }
  }
  if (pos) pnls.push(roundTripPnl(pos.entry, candles[candles.length - 1].close, pos.qty));
  return pnls;
};

/** Bollinger mean-reversion: buy close < lower band + RSI<30; exit at middle band. */
const bollingerReversion: Signal = (candles, capital) => {
  const period = numEnv('BOLLINGER_PERIOD', 20);
  const stdDev = numEnv('BOLLINGER_STD_DEV', 2);
  const rsiEntry = numEnv('BOLLINGER_RSI_ENTRY', 30);
  const rsi = new RSI(14);
  const closes: number[] = [];
  const pnls: number[] = [];
  let pos: { qty: number; entry: number } | null = null;
  for (const c of candles) {
    closes.push(c.close);
    if (closes.length > period) closes.shift();
    const r = rsi.nextValue(c.close);
    if (closes.length === period) {
      const mean = closes.reduce((s, v) => s + v, 0) / period;
      const sd = Math.sqrt(closes.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
      const lower = mean - stdDev * sd;
      if (!pos && r !== undefined && r < rsiEntry && c.close < lower) {
        pos = { qty: Math.max(1, Math.floor((capital * 0.02) / c.close)), entry: c.close };
      } else if (pos && c.close >= mean) {
        pnls.push(roundTripPnl(pos.entry, c.close, pos.qty));
        pos = null;
      }
    }
  }
  if (pos) pnls.push(roundTripPnl(pos.entry, candles[candles.length - 1].close, pos.qty));
  return pnls;
};

async function main(): Promise<void> {
  const config = loadConfig();
  const days = numEnv('BACKTEST_DAYS', 400);
  const warmupBars = 60;
  const testBars = 50;
  const capital = numEnv('BACKTEST_CAPITAL', DEFAULT_CAPITAL);
  const symbols = config.watchlist.filter((s) => s.enabled);

  const streamer = createHistoricalProvider(config);
  await streamer.loadInstruments('NSE');
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const signals: Array<[string, Signal]> = [
    ['trend_breakout', trendBreakout],
    ['sma_cross', smaCross],
    ['bollinger_reversion', bollingerReversion],
  ];

  for (const [name, signal] of signals) {
    const allPnl: number[] = [];
    let symbolsPositive = 0;
    let symbolsEval = 0;
    for (const sym of symbols) {
      const inst = streamer.findInstrument(sym.tradingsymbol, 'NSE');
      if (!inst) continue;
      const candles: Candle[] = await streamer
        .getHistoricalData(inst.instrument_token, 'day', from, to)
        .catch(() => []);
      if (candles.length <= warmupBars + 5) continue;
      symbolsEval++;
      // Walk-forward folds.
      const foldPnl: number[] = [];
      let start = warmupBars;
      while (start < candles.length) {
        const end = Math.min(start + testBars, candles.length);
        if (end - start >= Math.max(5, Math.floor(testBars / 2))) {
          const foldCandles = candles.slice(0, end); // warmup = everything before fold
          foldPnl.push(...signal(foldCandles, capital));
        }
        start = end;
      }
      allPnl.push(...foldPnl);
      if (metrics(foldPnl, capital).returnPct > 0) symbolsPositive++;
    }
    const m = metrics(allPnl, capital);
    const consistency = symbolsEval >= 2 ? symbolsPositive / symbolsEval : 0;
    const reasons: string[] = [];
    if (m.trades < MIN_OOS_TRADES) reasons.push(`only ${m.trades} OOS trades (need >= ${MIN_OOS_TRADES})`);
    if (m.expectancy <= 0) reasons.push(`expectancy ${m.expectancy.toFixed(2)} (<= 0)`);
    if (m.returnPct <= 0) reasons.push(`return ${m.returnPct.toFixed(2)}% (<= 0)`);
    if (consistency <= 0.5) reasons.push(`edge in ${(consistency * 100).toFixed(0)}% of symbols (<= 50%)`);
    const verdict = reasons.length === 0 ? 'VALIDATED' : 'NOT VALIDATED';
    console.log(`\n=== ${name} ===`);
    console.log(`  OOS trades: ${m.trades} | Return: ${m.returnPct.toFixed(2)}% | Expectancy: ₹${m.expectancy.toFixed(2)}`);
    console.log(`  Win rate: ${m.winRate.toFixed(1)}% | PF: ${m.profitFactor === Infinity ? 'inf' : m.profitFactor.toFixed(2)}`);
    console.log(`  Symbols positive: ${symbolsPositive}/${symbolsEval} | Verdict: ${verdict}`);
    reasons.forEach((r) => console.log(`    - ${r}`));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Signal prototype failed:', err);
  process.exit(1);
});
