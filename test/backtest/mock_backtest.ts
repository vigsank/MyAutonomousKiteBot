/**
 * Mock-data backtest — runs the real strategy (MarketAgent.onCandle) over the
 * mock's real historical CSVs (5-min bars, 30 days) on a given capital, and
 * prints a consolidated P&L report. No real orders — paper only.
 *
 * Usage:
 *   ENV_FILE=.env.test BACKTEST_CAPITAL=50000 npx ts-node test/backtest/mock_backtest.ts
 */
import { loadConfig } from '../../src/server/AppConfig';
import { Ledger } from '../../src/server/Ledger';
import { RiskEngine } from '../../src/server/RiskEngine';
import { PaperTrader } from '../../src/server/PaperTrader';
import { MarketAgent } from '../../src/server/MarketAgent';
import { NotificationService } from '../../src/server/NotificationService';
import { NewsSentimentEngine } from '../../src/server/NewsSentimentEngine';
import { LlmManager } from '../../src/server/LlmManager';
import { TelegramHITL } from '../../src/server/TelegramHITL';
import { OptionsEngine } from '../../src/server/OptionsEngine';
import { OptionsTrader } from '../../src/server/OptionsTrader';
import { Candle } from '../../src/server/types';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'kite-paper-node', 'data');

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Parse a mock CSV into Candle[] (chronological). */
function readCandles(symbol: string, interval: string): Candle[] {
  const file = path.join(DATA_DIR, `${symbol}_${interval}.csv`);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf-8').trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const idx = (name: string) => header.indexOf(name);
  const out: Candle[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c.length < header.length) continue;
    out.push({
      date: new Date(c[idx('timestamp')]),
      open: Number(c[idx('open')]),
      high: Number(c[idx('high')]),
      low: Number(c[idx('low')]),
      close: Number(c[idx('close')]),
      volume: Number(c[idx('volume')] || 0),
    });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Minimal streamer stub — MarketAgent.onCandle only needs instrument lookup. */
function makeStreamer(symbols: string[]) {
  const bySymbol = new Map(symbols.map((s, i) => [s, {
    instrument_token: 1000 + i,
    tradingsymbol: s,
    exchange: 'NSE',
    last_price: 0,
  }]));
  return {
    findInstrument: (symbol: string) => bySymbol.get(symbol) ?? null,
    getInstrument: (token: number) => [...bySymbol.values()].find((i: any) => i.instrument_token === token) ?? null,
  };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const capital = numEnv('BACKTEST_CAPITAL', 50000);
  const interval = process.env.BACKTEST_INTERVAL || '5min';
  const warmupBars = numEnv('BACKTEST_WARMUP_BARS', 60);

  config.risk.availableCapital = capital;
  config.risk.maxTradeAllocation = capital;
  config.risk.autoTradeTicketThreshold = Number.MAX_SAFE_INTEGER;
  config.risk.maxDailyDrawdown = Math.max(config.risk.maxDailyDrawdown, capital * 0.1);
  config.strategy.analystEnabled = true; // AI-backed verdicts before buy/sell
  config.strategy.analystRejectThreshold = numEnv('ANALYST_REJECT_THRESHOLD', 70);
  config.strategy.disableTimeFilter = true;

  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);
  // Randomly pick ~20 symbols the user wishes to invest on (deterministic seed).
  const pickN = numEnv('PICK_SYMBOLS', 20);
  const seed = numEnv('PICK_SEED', 12345);
  const rng = mulberry32(seed);
  const shuffled = [...symbols].sort(() => rng() - 0.5);
  const selected = shuffled.slice(0, Math.min(pickN, symbols.length));

  const candlesMap = new Map<string, Candle[]>();
  for (const sym of selected) {
    const c = readCandles(sym, interval);
    if (c.length > warmupBars) candlesMap.set(sym, c);
  }

  console.log('==============================================================');
  console.log('  MOCK-DATA BACKTEST (real historical CSVs + AI analyst)');
  console.log(`  Interval: ${interval} | Capital: ₹${capital.toLocaleString('en-IN')}`);
  console.log(`  Selected symbols (${candlesMap.size}): ${[...candlesMap.keys()].join(', ')}`);
  console.log('  AI analyst: ENABLED (news sentiment + LLM verdict before trades)');
  console.log('==============================================================');

  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  ledger.startSession('BACKTEST');
  const notify = new NotificationService(ledger, config);
  const streamer = makeStreamer([...candlesMap.keys()]) as any;
  const risk = new RiskEngine(config, ledger);
  const trader = new PaperTrader(config, ledger);
  const llm = new LlmManager(config.llm);
  const telegram = new TelegramHITL(config, llm, notify);
  const news = new NewsSentimentEngine(config, llm, ledger);
  const optionsTrader = new OptionsTrader(config, new OptionsEngine(config), ledger, risk);
  const agent = new MarketAgent(config, streamer, ledger, risk, trader, telegram, news, notify, optionsTrader);

  // Pre-compute real news sentiment per selected symbol (the "new sentiments").
  console.log('  Computing news sentiment for selected symbols...');
  for (const sym of candlesMap.keys()) {
    try {
      const s = await news.sentimentFor(sym);
      if (s && typeof s.score === 'number') (agent as any).sentiment.set(sym, s.score);
    } catch {
      /* keep 0 on failure */
    }
  }
  console.log('  Sentiment computed.');

  for (const sym of candlesMap.keys()) {
    const candles = candlesMap.get(sym)!;
    await agent.warmup(sym, candles.slice(0, warmupBars));
    for (let i = warmupBars; i < candles.length; i++) {
      agent.onCandle(sym, candles[i], candles[i].date);
      // Flush so async AI-analyst-gated trades execute before the next bar.
      await agent.flush();
    }
    const pos = ledger.getPosition(sym, 'NSE');
    if (pos) {
      const last = candles[candles.length - 1];
      trader.execute({
        symbol: sym, exchange: 'NSE', quantity: pos.quantity,
        direction: pos.direction === 'LONG' ? 'SHORT' : 'LONG',
        entryPrice: last.close, reason: 'Backtest end — force close',
        ticketSize: pos.quantity * last.close, timestamp: last.date,
      });
    }
  }
  await agent.flush();

  const rows = ledger.raw().prepare(
    `SELECT i.tradingsymbol AS symbol, t.direction, t.quantity, t.price, t.pnl, t.reason, t.created_at
       FROM trades t JOIN instruments i ON i.instrument_id = t.instrument_id
      WHERE t.status = 'FILLED' ORDER BY t.created_at`,
  ).all() as any[];

  const realized = rows.filter((r) => r.pnl !== 0);
  const totalPnl = realized.reduce((s, r) => s + (r.pnl ?? 0), 0);
  const wins = realized.filter((r) => (r.pnl ?? 0) > 0);
  const losses = realized.filter((r) => (r.pnl ?? 0) < 0);
  const grossProfit = wins.reduce((s, r) => s + (r.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, r) => s + (r.pnl ?? 0), 0));
  const winRate = realized.length ? (wins.length / realized.length) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  let peak = capital, running = capital, maxDd = 0;
  for (const r of realized) {
    running += r.pnl ?? 0;
    peak = Math.max(peak, running);
    maxDd = Math.max(maxDd, peak - running);
  }

  console.log('\n══════════════════════════════════════════════');
  console.log('  CONSOLIDATED P&L REPORT (30-day simulation)');
  console.log('══════════════════════════════════════════════');
  console.log(`  Starting capital:   ₹${capital.toLocaleString('en-IN')}`);
  console.log(`  Round trips:        ${realized.length}`);
  console.log(`  Win rate:           ${winRate.toFixed(1)}% (${wins.length}W / ${losses.length}L)`);
  console.log(`  Gross profit:       ₹${grossProfit.toFixed(2)}`);
  console.log(`  Gross loss:         ₹${grossLoss.toFixed(2)}`);
  console.log(`  Profit factor:      ${profitFactor === Infinity ? 'inf' : profitFactor.toFixed(2)}`);
  console.log(`  Net P&L:            ₹${totalPnl.toFixed(2)}`);
  console.log(`  Return:             ${((totalPnl / capital) * 100).toFixed(2)}%`);
  console.log(`  Max drawdown:       ₹${maxDd.toFixed(2)} (${((maxDd / capital) * 100).toFixed(2)}%)`);
  console.log(`  Final equity:       ₹${(capital + totalPnl).toLocaleString('en-IN')}`);
  console.log('══════════════════════════════════════════════');

  console.log('\n  Top trades:');
  const top = [...realized].sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)).slice(0, 8);
  for (const t of top) {
    console.log(`    ${t.symbol} ${t.direction} ${t.quantity} @ ${t.price.toFixed(2)}  PnL ₹${(t.pnl ?? 0).toFixed(2)}  ${t.reason}`);
  }
  console.log('\n  Per-symbol P&L:');
  const bySym = new Map<string, number>();
  for (const r of realized) bySym.set(r.symbol, (bySym.get(r.symbol) ?? 0) + (r.pnl ?? 0));
  const sorted = [...bySym.entries()].sort((a, b) => b[1] - a[1]);
  for (const [s, p] of sorted) console.log(`    ${s.padEnd(14)} ₹${p.toFixed(2)}`);
  console.log('══════════════════════════════════════════════');
  process.exit(0);
}

main().catch((err) => {
  console.error('Mock backtest failed:', err);
  process.exit(1);
});

/** Deterministic PRNG for reproducible random symbol picks. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
