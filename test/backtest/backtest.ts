/**
 * Backtester — runs the full strategy against REAL historical Kite candles
 * WITHOUT placing any real orders. All execution is simulated via PaperTrader
 * and persisted to an isolated SQLite database.
 *
 * When you add real Zerodha Kite credentials, this is the tool you run to
 * validate the strategy over historical data before considering real money.
 *
 * Usage:
 *   BACKTEST_INTERVAL=5minute BACKTEST_DAYS=60 npx ts-node src/backtest.ts
 *
 * Config (all optional):
 *   BACKTEST_INTERVAL     - candle interval: minute, 5minute, 15minute, day
 *   BACKTEST_DAYS         - how far back to fetch (default 60)
 *   BACKTEST_WARMUP_BARS  - bars used for indicator warmup (default 60)
 *   BACKTEST_CAPITAL      - virtual starting capital (default 500000)
 *   BACKTEST_VOLUME_MULT  - volume confirmation multiplier (default 1.0)
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

const DEFAULT_CAPITAL = 500_000;

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

interface TradeRow {
  symbol: string;
  direction: string;
  quantity: number;
  price: number;
  pnl: number;
  created_at: string;
  reason: string;
}

async function runBacktest(): Promise<void> {
  const config = loadConfig();

  // --- BACKTEST provider (account-free Yahoo by default) -------------------
  const backtestProvider = (process.env.BACKTEST_PROVIDER || 'yahoo').toLowerCase();
  if (backtestProvider === 'kite' && (!config.kite.apiKey || !config.kite.accessToken)) {
    console.error(
      'BACKTEST_PROVIDER=kite requires Kite credentials.\n' +
        '  Set KITE_API_KEY and KITE_ACCESS_TOKEN in your .env, or use the\n' +
        '  account-free default BACKTEST_PROVIDER=yahoo.\n' +
        '  The backtest fetches REAL historical candles but places NO real orders.',
    );
    process.exit(1);
  }

  // --- Backtest overrides ---------------------------------------------------
  const interval = process.env.BACKTEST_INTERVAL || '5minute';
  const days = numEnv('BACKTEST_DAYS', 60);
  const warmupBars = numEnv('BACKTEST_WARMUP_BARS', 60);
  const capital = numEnv('BACKTEST_CAPITAL', DEFAULT_CAPITAL);
  const volumeMult = numEnv('BACKTEST_VOLUME_MULT', 1.0);

  config.risk.availableCapital = capital;
  config.risk.maxTradeAllocation = Number.MAX_SAFE_INTEGER;
  config.risk.autoTradeTicketThreshold = Number.MAX_SAFE_INTEGER; // auto-execute all
  config.strategy.volumeConfirmMultiplier = volumeMult;
  // Time-of-day filter uses historical candle times; disable for backtest clarity.
  config.strategy.skipFirstMinutes = 0;
  config.strategy.skipLastMinutes = 0;
  config.strategy.disableTimeFilter = true;

  const symbols = config.watchlist.filter((s) => s.enabled);
  if (symbols.length === 0) {
    console.error('❌ No enabled symbols in watchlist.');
    process.exit(1);
  }

  // --- Isolated backtest DB -------------------------------------------------
  const btDir = path.join(config.dataDir, 'backtest');
  if (!fs.existsSync(btDir)) fs.mkdirSync(btDir, { recursive: true });
  for (const f of ['ledger.db', 'ledger.db-wal', 'ledger.db-shm']) {
    const p = path.join(btDir, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const ledger = new Ledger(btDir);
  ledger.runMigrations();
  const sessionId = ledger.startSession('BACKTEST');

  const notify = new NotificationService(ledger, config);
  // Account-free historical provider (Yahoo by default).
  const streamer = createHistoricalProvider(config);
  const risk = new RiskEngine(config, ledger);
  const trader = new PaperTrader(config, ledger);
  const llm = new LlmManager(config.llm);
  const telegram = new TelegramHITL(config, llm, notify);
  const news = new NewsSentimentEngine(config, llm, ledger);
  const optionsTrader = new OptionsTrader(config, new OptionsEngine(config), ledger, risk);
  // The agent is only used for warmup + onCandle in backtest (never onTicks),
  // so the historical provider satisfies it structurally.
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

  // --- Load instruments and fetch history -----------------------------------
  console.log('======================================================');
  console.log('  BACKTEST — no real orders placed');
  console.log(`  Provider: ${backtestProvider} (account-free by default)`);
  console.log(`  Interval: ${interval} | Days: ${days} | Warmup: ${warmupBars}`);
  console.log(`  Capital: ₹${capital.toLocaleString('en-IN')}`);
  console.log(`  Symbols: ${symbols.map((s) => s.tradingsymbol).join(', ')}`);
  console.log('======================================================');

  await streamer.loadInstruments('NFO');

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  for (const sym of symbols) {
    const inst = streamer.findInstrument(sym.tradingsymbol, 'NSE');
    if (!inst) {
      logger.warn({ symbol: sym.tradingsymbol }, 'Instrument not found — skipping');
      continue;
    }
    ledger.upsertInstrument(inst);

    let candles: Candle[];
    try {
      candles = await streamer.getHistoricalData(
        inst.instrument_token,
        interval,
        from,
        to,
      );
    } catch (err: any) {
      logger.error({ symbol: sym.tradingsymbol, err: err?.message }, 'History fetch failed');
      continue;
    }

    if (candles.length < warmupBars) {
      logger.warn(
        { symbol: sym.tradingsymbol, got: candles.length, need: warmupBars },
        'Not enough history — skipping',
      );
      continue;
    }

    const ind = await agent.warmup(sym.tradingsymbol, candles.slice(0, warmupBars));
    logger.info(
      { symbol: sym.tradingsymbol, bars: candles.length, rsi: ind.rsi?.toFixed(1), adx: ind.adx?.toFixed(1), atr: ind.atr?.toFixed(1) },
      'Warmed up',
    );

    // Walk forward bar-by-bar.
    for (let i = warmupBars; i < candles.length; i++) {
      agent.onCandle(sym.tradingsymbol, candles[i], candles[i].date);
    }

    // Force-close any open position at the last close.
    const pos = ledger.getPosition(sym.tradingsymbol);
    if (pos) {
      const last = candles[candles.length - 1];
      trader.execute({
        symbol: sym.tradingsymbol,
        exchange: 'NSE',
        quantity: pos.quantity,
        direction: pos.direction === 'LONG' ? 'SHORT' : 'LONG',
        entryPrice: last.close,
        reason: 'Backtest end — force close',
        ticketSize: pos.quantity * last.close,
        timestamp: last.date,
      });
    }
  }

  // Drain the async trade-queue before reading results.
  await agent.flush();

  ledger.computeDailySummary(capital);

  // --- Collect trades -------------------------------------------------------
  const rows = ledger.raw()
    .prepare(
      `SELECT t.pnl, t.price, t.quantity, t.direction, t.created_at, t.reason, i.tradingsymbol
         FROM trades t
         JOIN instruments i ON i.instrument_id = t.instrument_id
        WHERE t.status = 'FILLED'
        ORDER BY t.created_at`,
    )
    .all() as any[];

  const realized = rows.filter((r) => r.pnl !== 0);
  const totalPnl = rows.reduce((s, r) => s + (r.pnl ?? 0), 0);
  const wins = realized.filter((r) => (r.pnl ?? 0) > 0).length;
  const losses = realized.filter((r) => (r.pnl ?? 0) < 0).length;
  const winRate = realized.length > 0 ? wins / realized.length : 0;

  // Max drawdown from cumulative realized PnL.
  let peak = 0;
  let running = 0;
  let maxDd = 0;
  for (const r of realized) {
    running += r.pnl ?? 0;
    if (running > peak) peak = running;
    maxDd = Math.max(maxDd, peak - running);
  }

  // Sharpe (daily-ish, on round trips).
  const returns = realized.map((r) => r.pnl ?? 0);
  const avg = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance =
    returns.length > 1
      ? returns.reduce((a, b) => a + (b - avg) * (b - avg), 0) / (returns.length - 1)
      : 0;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (avg / std) * Math.sqrt(Math.sqrt(realized.length)) : 0;

  // --- Write CSV ------------------------------------------------------------
  const csvPath = path.join(config.dataDir, 'backtest_report.csv');
  const lines: string[] = [
    'timestamp,symbol,direction,quantity,price,pnl,reason',
    ...rows.map((r: any) =>
      `${r.created_at},${r.tradingsymbol},${r.direction},${r.quantity},${r.price},${r.pnl ?? 0},"${(r.reason ?? '').replace(/"/g, '""')}"`,
    ),
    // Option fills (if the options layer is enabled).
    ...optionsTrader.allFills.map((f) =>
      `${f.timestamp.toISOString()},${f.symbol}${f.strike}${f.type},OPTION,${f.quantity},${f.premium},${f.totalPremium},${f.pnl},"${f.reason.replace(/"/g, '""')}"`,
    ),
  ];
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf-8');

  const optionPnl = optionsTrader.realizedPnl();
  const combinedPnl = totalPnl + optionPnl;

  // --- Summary --------------------------------------------------------------
  console.log('\n══════════════════════════════════════════════');
  console.log('  BACKTEST RESULTS');
  console.log('══════════════════════════════════════════════');
  console.log(`  Period:            ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)} (${days}d)`);
  console.log(`  Interval:          ${interval}`);
  console.log(`  Symbols:           ${symbols.map((s) => s.tradingsymbol).join(', ')}`);
  console.log(`  Round trips:       ${realized.length}`);
  console.log(`  Win rate:          ${(winRate * 100).toFixed(1)}% (${wins}W / ${losses}L)`);
  console.log(`  Equity P&L:        ₹${totalPnl.toFixed(2)}`);
  console.log(`  Options P&L:       ₹${optionPnl.toFixed(2)} (${optionsTrader.openPositions} open)`);
  console.log(`  Combined P&L:      ₹${combinedPnl.toFixed(2)}`);
  console.log(`  Return:            ${((combinedPnl / capital) * 100).toFixed(2)}%`);
  console.log(`  Max drawdown:      ₹${maxDd.toFixed(2)}`);
  console.log(`  Sharpe (approx):   ${sharpe.toFixed(2)}`);
  console.log(`  Final capital:     ₹${(capital + totalPnl).toFixed(2)}`);
  console.log('══════════════════════════════════════════════');
  console.log(`  CSV report:        ${csvPath}`);
  console.log(`  DB:                ${btDir}/ledger.db`);
  console.log('══════════════════════════════════════════════');

  // --- Interpretation -------------------------------------------------------
  console.log('\n📊 INTERPRETATION:');
  console.log('  • Win rate > 55% with positive expectancy is a reasonable mean-reversion baseline.');
  console.log('  • Max drawdown < your MAX_DAILY_DRAWDOWN is what you want to see.');
  console.log('  • A positive Sharpe indicates the edge is consistent, not luck.');
  console.log('  • This ran on REAL historical candles but placed NO real orders.');
  console.log('  • Validate over multiple time periods & intervals before real money.\n');

  ledger.endSession(sessionId, 'COMPLETED');
  ledger.close();
}

runBacktest().catch((err) => {
  logger.fatal({ err: err?.message, stack: err?.stack }, 'Backtest failed');
  process.exit(1);
});
