/**
 * A/B comparison — current strategy edge vs. buy-and-hold baseline.
 *
 * Fetches ONE identical set of historical candles (Yahoo, account-free),
 * then runs both legs over the SAME data:
 *   - STRATEGY leg: the real MarketAgent/PaperTrader code path (net of costs).
 *   - BASELINE leg: equal-weight buy-and-hold of the same symbols (net of the
 *     same slippage + NSE cost model).
 *
 * Both legs are computed at two capitals so we separate STRATEGY EDGE (₹20L)
 * from REAL-CAPITAL TRADEABILITY (₹10k).
 *
 * Usage:
 *   BACKTEST_DAYS=60 npx ts-node test/backtest/ab_compare.ts
 *
 * Config (all optional, mirrors backtest.ts):
 *   BACKTEST_INTERVAL     - candle interval (default 5minute)
 *   BACKTEST_DAYS         - how far back (default 90)
 *   BACKTEST_WARMUP_BARS  - warmup bars for indicators (default 60)
 *   AB_CAPITALS           - comma list of starting capitals (default 2000000,10000)
 *   WATCHLIST_FILE        - a small symbol list is recommended for clean output
 */
import { loadConfig } from '../../src/server/AppConfig';
import { Ledger } from '../../src/server/Ledger';
import { RiskEngine } from '../../src/server/RiskEngine';
import { PaperTrader } from '../../src/server/PaperTrader';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { NewsSentimentEngine } from '../../src/server/NewsSentimentEngine';
import { TelegramHITL } from '../../src/server/TelegramHITL';
import { LlmManager } from '../../src/server/LlmManager';
import { MarketAgent } from '../../src/server/MarketAgent';
import { OptionsEngine } from '../../src/server/OptionsEngine';
import { OptionsTrader } from '../../src/server/OptionsTrader';
import { NotificationService } from '../../src/server/NotificationService';
import { logger } from '../../src/server/Logger';
import { Candle } from '../../src/server/types';
import * as fs from 'fs';
import * as path from 'path';

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

interface Metrics {
  label: string;
  initialCapital: number;
  totalReturnPct: number;
  cagrPct: number;
  trades: number;
  winRatePct: number;
  profitFactor: number;
  maxDrawdown: number;
  avgTrade: number;
  sharpe: number;
  finalEquity: number;
}

function computeMetrics(label: string, initialCapital: number, pnls: number[], days: number): Metrics {
  const realized = pnls.filter((p) => p !== 0);
  const totalPnl = realized.reduce((s, p) => s + p, 0);
  const wins = realized.filter((p) => p > 0).length;
  const losses = realized.filter((p) => p < 0).length;
  const winRatePct = realized.length ? (wins / realized.length) * 100 : 0;

  const grossProfit = realized.filter((p) => p > 0).reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(realized.filter((p) => p < 0).reduce((s, p) => s + p, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  let peak = 0;
  let running = 0;
  let maxDrawdown = 0;
  for (const p of realized) {
    running += p;
    if (running > peak) peak = running;
    maxDrawdown = Math.max(maxDrawdown, peak - running);
  }

  const avg = realized.length ? totalPnl / realized.length : 0;
  const variance =
    realized.length > 1
      ? realized.reduce((s, p) => s + (p - avg) * (p - avg), 0) / (realized.length - 1)
      : 0;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (avg / std) * Math.sqrt(Math.sqrt(realized.length)) : 0;

  const finalEquity = initialCapital + totalPnl;
  const totalReturnPct = (totalPnl / initialCapital) * 100;
  const cagrPct =
    totalReturnPct > -100
      ? (Math.pow(Math.max(finalEquity, 1) / initialCapital, 365 / Math.max(days, 1)) - 1) * 100
      : -100;

  return {
    label,
    initialCapital,
    totalReturnPct,
    cagrPct,
    trades: realized.length,
    winRatePct,
    profitFactor,
    maxDrawdown,
    avgTrade: avg,
    sharpe,
    finalEquity,
  };
}

/** Baseline leg: equal-weight buy-and-hold of every symbol, net of costs. */
function runBaseline(candlesMap: Map<string, Candle[]>, symbols: string[], capital: number, slippagePct: number): Metrics {
  const pnls: number[] = [];
  const n = candlesMap.size;
  if (n === 0) return computeMetrics('BASELINE', capital, [], 90);
  const perSymbol = capital / n;
  for (const sym of symbols) {
    const c = candlesMap.get(sym);
    if (!c || c.length < 2) continue;
    const buy = c[0].close;
    const sell = c[c.length - 1].close;
    // Equal-weight share count, integer lots.
    const qty = Math.max(1, Math.floor(perSymbol / buy));
    const buyCost = buy * (1 + slippagePct);
    const sellNet = sell * (1 - slippagePct);
    // ~NSE cost model: flat brokerage + stamp duty on buy + STT on sell (approx).
    const brokerage = 0.0002 * (buyCost * qty + sellNet * qty);
    const stampDuty = 0.0001 * buyCost * qty;
    const stt = 0.001 * sellNet * qty;
    const pnl = (sellNet - buyCost) * qty - brokerage - stampDuty - stt;
    pnls.push(pnl);
  }
  return computeMetrics(`BASELINE (buy&hold ₹${capital / 1e5}L)` , capital, pnls, numEnv('BACKTEST_DAYS', 90));
}

/** Strategy leg: full MarketAgent/PaperTrader code path over the same candles. */
async function runStrategyLeg(
  config: ReturnType<typeof loadConfig>,
  candlesMap: Map<string, Candle[]>,
  warmupBars: number,
  capital: number,
  btDir: string,
): Promise<Metrics> {
  // Fresh isolated DB per leg/capital.
  if (!fs.existsSync(btDir)) fs.mkdirSync(btDir, { recursive: true });
  for (const f of ['ledger.db', 'ledger.db-wal', 'ledger.db-shm']) {
    const p = path.join(btDir, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  config.risk.availableCapital = capital;
  config.risk.maxTradeAllocation = capital;
  config.risk.autoTradeTicketThreshold = Number.MAX_SAFE_INTEGER;
  // Scale the daily-drawdown halt to the test capital (default cap is sized for
  // the small paper account and would halt a large A/B on the first loss).
  config.risk.maxDailyDrawdown = Math.max(config.risk.maxDailyDrawdown, capital * 0.1);
  config.strategy.analystEnabled = false;
  config.strategy.disableTimeFilter = true;
  config.strategy.skipFirstMinutes = 0;
  config.strategy.skipLastMinutes = 0;

  const ledger = new Ledger(btDir);
  ledger.runMigrations();
  ledger.startSession('BACKTEST');

  const notify = new NotificationService(ledger, config);
  const streamer = createHistoricalProvider(config);
  const risk = new RiskEngine(config, ledger);
  const trader = new PaperTrader(config, ledger);
  const llm = new LlmManager(config.llm);
  const telegram = new TelegramHITL(config, llm, notify);
  const news = new NewsSentimentEngine(config, llm, ledger);
  const optionsTrader = new OptionsTrader(config, new OptionsEngine(config), ledger, risk);
  const agent = new MarketAgent(
    config,
    streamer as any,
    ledger,
    risk,
    trader,
    telegram,
    news,
    notify,
    optionsTrader,
  );

  for (const sym of candlesMap.keys()) {
    const candles = candlesMap.get(sym)!;
    if (candles.length < warmupBars) continue;
    await agent.warmup(sym, candles.slice(0, warmupBars));
    for (let i = warmupBars; i < candles.length; i++) {
      agent.onCandle(sym, candles[i], candles[i].date);
    }
    await agent.flush();
    const pos = ledger.getPosition(sym);
    if (pos) {
      const last = candles[candles.length - 1];
      trader.execute({
        symbol: sym,
        exchange: 'NSE',
        quantity: pos.quantity,
        direction: pos.direction === 'LONG' ? 'SHORT' : 'LONG',
        entryPrice: last.close,
        reason: 'A/B end — force close',
        ticketSize: pos.quantity * last.close,
        timestamp: last.date,
      });
    }
  }
  await agent.flush();

  const rows = ledger
    .raw()
    .prepare(
      `SELECT t.pnl FROM trades t WHERE t.status = 'FILLED' AND t.pnl != 0 ORDER BY t.created_at`,
    )
    .all() as any[];
  const pnls = rows.map((r: any) => r.pnl ?? 0);
  const days = numEnv('BACKTEST_DAYS', 90);
  const m = computeMetrics(`STRATEGY ₹${capital.toLocaleString('en-IN')}`, capital, pnls, days);
  ledger.close();
  return m;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const interval = process.env.BACKTEST_INTERVAL || '5minute';
  const days = numEnv('BACKTEST_DAYS', 90);
  const warmupBars = numEnv('BACKTEST_WARMUP_BARS', 60);
  const capitals = (process.env.AB_CAPITALS || '2000000,10000')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);
  if (symbols.length === 0) {
    console.error('❌ No enabled symbols in watchlist.');
    process.exit(1);
  }

  console.log('========================================================');
  console.log('  A/B — STRATEGY EDGE vs BUY-AND-HOLD BASELINE');
  console.log(`  Provider: yahoo (account-free) | Interval: ${interval} | Days: ${days}`);
  console.log(`  Symbols (${symbols.length}): ${symbols.join(', ')}`);
  console.log(`  Capitals: ${capitals.map((c) => '₹' + c.toLocaleString('en-IN')).join(', ')}`);
  console.log('========================================================\n');

  const streamer = createHistoricalProvider(config);
  await streamer.loadInstruments('NSE');
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  // Fetch the ONE identical dataset for all legs.
  const candlesMap = new Map<string, Candle[]>();
  for (const sym of symbols) {
    const inst = streamer.findInstrument(sym, 'NSE');
    if (!inst) {
      logger.warn({ symbol: sym }, 'Instrument not found — skipping');
      continue;
    }
    try {
      const c = await streamer.getHistoricalData(inst.instrument_token, interval, from, to);
      if (c.length >= warmupBars) candlesMap.set(sym, c);
      else logger.warn({ symbol: sym, got: c.length, need: warmupBars }, 'Not enough history — skipping');
    } catch (err: any) {
      logger.error({ symbol: sym, err: err?.message }, 'History fetch failed');
    }
  }
  console.log(`\nFetched history for ${candlesMap.size}/${symbols.length} symbols.\n`);

  const results: Metrics[] = [];
  for (const capital of capitals) {
    const baseline = runBaseline(candlesMap, symbols, capital, 0.0005);
    const btDir = path.join(config.dataDir, `ab_strategy_${Math.round(capital)}`);
    const strategy = await runStrategyLeg(config, candlesMap, warmupBars, capital, btDir);
    results.push(strategy, baseline);
    console.log(`  ✓ Completed strategy + baseline at ₹${capital.toLocaleString('en-IN')}`);
  }

  // --- Comparison table ----------------------------------------------------
  const pad = (s: string, w: number) => String(s).padEnd(w);
  const fmtPct = (v: number) => `${v.toFixed(2)}%`;
  const fmtRu = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
  const fmtNum = (v: number) => v.toLocaleString('en-IN');

  console.log('\n' + '═'.repeat(104));
  console.log('  COMPARISON TABLE — current strategy vs. buy-and-hold baseline');
  console.log('═'.repeat(104));
  const h = (name: string) => pad(name, 38);
  console.log(`${h('Metric')}${results.map((r) => pad(r.label, 32)).join('')}`);
  console.log('-'.repeat(104));

  const row = (name: string, fn: (m: Metrics) => string) => {
    console.log(`${h(name)}${results.map((r) => pad(fn(r), 32)).join('')}`);
  };

  row('Total return', (m) => fmtPct(m.totalReturnPct));
  row('CAGR (ann.)', (m) => fmtPct(m.cagrPct));
  row('# trades (round trips)', (m) => fmtNum(m.trades));
  row('Win rate', (m) => fmtPct(m.winRatePct));
  row('Profit factor', (m) => (Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : '∞'));
  row('Max drawdown', (m) => fmtRu(m.maxDrawdown));
  row('Avg trade (net)', (m) => fmtRu(m.avgTrade));
  row('Sharpe (approx)', (m) => m.sharpe.toFixed(2));
  row('Final equity', (m) => fmtRu(m.finalEquity));
  console.log('═'.repeat(104));

  // --- Decision rules ------------------------------------------------------
  console.log('\n📊 VERDICT — apply these rules in order:');
  for (const capital of capitals) {
    const strat = results.find((r) => r.label.includes('STRATEGY') && r.initialCapital === capital)!;
    const base = results.find((r) => r.label.includes('BASELINE') && r.initialCapital === capital)!;
    const beats = strat.totalReturnPct > base.totalReturnPct;
    const tradeable = strat.trades > 0;
    console.log(`  • ₹${capital.toLocaleString('en-IN')}: strategy ${beats ? 'BEATS' : 'LOSES TO'} baseline ` +
      `(${fmtPct(strat.totalReturnPct)} vs ${fmtPct(base.totalReturnPct)}), ` +
      `trades=${strat.trades}${tradeable ? '' : ' → NOT tradeable at this capital'}`);
  }
  console.log('\n  • If the strategy does NOT beat baseline at ₹20L, indicator stacking is wasted');
  console.log('    effort — fix the SIGNAL, not the parameters.');
  console.log('  • If it beats at ₹20L but is untradeable at ₹10k, the fix is instrument');
  console.log('    selection (lower-priced symbols), not more indicators.');
  console.log('  • Only if it beats baseline at BOTH capitals do we proceed to single-');
  console.log('    indicator experiments (Bollinger alone, trend-confirmation alone).\n');
}

main().catch((err) => {
  logger.fatal({ err: err?.message, stack: err?.stack }, 'A/B comparison failed');
  process.exit(1);
});
