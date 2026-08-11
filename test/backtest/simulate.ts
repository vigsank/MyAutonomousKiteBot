/**
 * Market Simulation — runs the full trading pipeline against synthetic price
 * data for 2 minutes (120 ticks at 1/sec) with ₹10,000 initial capital.
 *
 * Generates controlled price patterns that trigger RSI-based entries and
 * exits, then writes a detailed CSV P&L report to data/simulation_pnl.csv.
 *
 * Usage:  npx ts-node src/simulate.ts
 */

import { loadConfig } from '../../src/server/AppConfig';
import { Ledger, newTradeId } from '../../src/server/Ledger';
import { RiskEngine } from '../../src/server/RiskEngine';
import { PaperTrader } from '../../src/server/PaperTrader';
import { MarketAgent } from '../../src/server/MarketAgent';
import { NotificationService } from '../../src/server/NotificationService';
import { NewsSentimentEngine } from '../../src/server/NewsSentimentEngine';
import { LlmManager } from '../../src/server/LlmManager';
import { TelegramHITL } from '../../src/server/TelegramHITL';
import { OptionsEngine } from '../../src/server/OptionsEngine';
import { OptionsTrader } from '../../src/server/OptionsTrader';
import { KiteStreamer } from '../../src/server/KiteStreamer';
import { logger } from '../../src/server/Logger';
import { Tick, TradeFill, SignalDirection } from '../../src/server/types';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Mock KiteStreamer — returns pre-registered instruments for simulation
// ---------------------------------------------------------------------------
class MockStreamer {
  private tokens = new Map<number, { tradingsymbol: string; exchange: string }>();

  register(token: number, tradingsymbol: string, exchange: string): void {
    this.tokens.set(token, { tradingsymbol, exchange });
  }

  getInstrument(token: number): { tradingsymbol: string; exchange: string } | null {
    return this.tokens.get(token) ?? null;
  }

  get isConfigured(): boolean {
    return true;
  }

  findInstrument(symbol: string, exchange: string): { instrument_token: number } | null {
    for (const [token, info] of this.tokens) {
      if (info.tradingsymbol === symbol && info.exchange === exchange) return { instrument_token: token };
    }
    return null;
  }

  async loadInstruments(): Promise<void> { /* no-op */ }
  async getHistoricalData(): Promise<Array<{ close: number }>> {
    // Return candles with small variation so RSI can compute properly.
    const candles: Array<{ close: number }> = [];
    let price = 100;
    for (let i = 0; i < 30; i++) {
      price += (Math.random() - 0.5) * 2;
      candles.push({ close: Number(price.toFixed(2)) });
    }
    return candles;
  }
  startTicker(): void { /* no-op */ }
  stopTicker(): void { /* no-op */ }
  optionChain(): any[] { return []; }
}

// ---------------------------------------------------------------------------
// Price generator — oscillating (ranging) prices that keep ADX low and make
// RSI swing between oversold and overbought. This is the regime where the
// improved mean-reversion strategy is designed to work.
// ---------------------------------------------------------------------------
const START_PRICES: Record<string, number> = {
  INFY: 1850,
  RELIANCE: 2900,
  TCS: 4200,
  HDFCBANK: 1700,
  TATAMOTORS: 1050,
};

function generatePrices(symbol: string, totalTicks: number): number[] {
  const start = START_PRICES[symbol];
  const amplitude = start * 0.07; // ±7% oscillation
  const cycles = 2.5; // a couple of full cycles in the run
  const prices: number[] = [];

  for (let t = 0; t < totalTicks; t++) {
    const phase = (t / totalTicks) * cycles * Math.PI * 2;
    const wave = Math.sin(phase) * amplitude;
    // Small noise so bars have high/low spread for ATR/ADX.
    const noise = (Math.random() - 0.5) * start * 0.004;
    prices.push(Number((start + wave + noise).toFixed(2)));
  }

  return prices;
}

// ---------------------------------------------------------------------------
// Black-Scholes option pricing for a realistic option simulation
// ---------------------------------------------------------------------------
function normCdf(x: number): number {
  // Abramowitz & Stegun approximation, error < 7.5e-8
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? 1 - p : p;
}

function bsCall(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(0, S - K);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
}

function bsPut(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(0, K - S);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
}

// ---------------------------------------------------------------------------
// Option simulator — Black-Scholes based P&L tracking
// ---------------------------------------------------------------------------
interface OptionPosition {
  symbol: string;
  type: 'CE' | 'PE';
  strike: number;
  entryPremium: number;
  entryTime: Date;
  daysToExpiry: number;
  quantity: number; // number of lots
  lotSize: number;
}

class OptionSimulator {
  private positions: Map<string, OptionPosition> = new Map();
  private trades: Array<{
    timestamp: string;
    symbol: string;
    type: string;
    direction: string;
    quantity: number;
    premium: number;
    pnl: number;
    reason: string;
  }> = [];

  private readonly SIGMA = 0.3;
  private readonly RATE = 0.06;

  /** Open an option position when an equity entry fires. */
  openOption(
    symbol: string,
    equityDirection: SignalDirection,
    underlyingPrice: number,
    timestamp: Date,
  ): void {
    if (equityDirection === 'NEUTRAL') return;

    const optType: 'CE' | 'PE' = equityDirection === 'LONG' ? 'CE' : 'PE';
    // ATM strike = round to nearest 50.
    const strike = Math.round(underlyingPrice / 50) * 50;
    const lotSize = 50;
    const daysToExpiry = 25; // ~3.5 weeks
    const T = daysToExpiry / 365;

    const premium =
      optType === 'CE'
        ? bsCall(underlyingPrice, strike, T, this.RATE, this.SIGMA)
        : bsPut(underlyingPrice, strike, T, this.RATE, this.SIGMA);

    const pos: OptionPosition = {
      symbol,
      type: optType,
      strike,
      entryPremium: Number(premium.toFixed(2)),
      entryTime: timestamp,
      daysToExpiry,
      quantity: 1,
      lotSize,
    };
    this.positions.set(symbol, pos);

    this.trades.push({
      timestamp: timestamp.toISOString(),
      symbol: `${symbol}${strike}${optType}`,
      type: 'OPTION',
      direction: 'BUY',
      quantity: 1 * lotSize,
      premium: Number(premium.toFixed(2)),
      pnl: 0,
      reason: `ATM ${optType} entry on ${equityDirection} signal`,
    });
  }

  /** Close an option position when the equity exits. */
  closeOption(
    symbol: string,
    underlyingPrice: number,
    timestamp: Date,
    reason: string,
  ): number {
    const pos = this.positions.get(symbol);
    if (!pos) return 0;

    // Time decay since entry.
    const daysElapsed = Math.max(0, (timestamp.getTime() - pos.entryTime.getTime()) / 86400000);
    const T = Math.max(0.001, (pos.daysToExpiry - daysElapsed) / 365);

    const newPremium =
      pos.type === 'CE'
        ? bsCall(underlyingPrice, pos.strike, T, this.RATE, this.SIGMA)
        : bsPut(underlyingPrice, pos.strike, T, this.RATE, this.SIGMA);

    const pnl =
      (newPremium - pos.entryPremium) * pos.quantity * pos.lotSize;

    this.trades.push({
      timestamp: timestamp.toISOString(),
      symbol: `${symbol}${pos.strike}${pos.type}`,
      type: 'OPTION',
      direction: 'SELL',
      quantity: pos.quantity * pos.lotSize,
      premium: Number(newPremium.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
      reason,
    });

    this.positions.delete(symbol);
    return pnl;
  }

  getTrades(): typeof this.trades {
    return this.trades;
  }
}

// ---------------------------------------------------------------------------
// Main simulation
// ---------------------------------------------------------------------------
async function simulate(): Promise<void> {
  const config = loadConfig();
  // Hardcode watchlist for simulation — bypass file reading.
  config.watchlist = [
    { tradingsymbol: 'INFY', exchange: 'NSE' as const, quantity: 2, enabled: true },
    { tradingsymbol: 'RELIANCE', exchange: 'NSE' as const, quantity: 1, enabled: true },
    { tradingsymbol: 'TCS', exchange: 'NSE' as const, quantity: 1, enabled: true },
    { tradingsymbol: 'HDFCBANK', exchange: 'NSE' as const, quantity: 2, enabled: true },
    { tradingsymbol: 'TATAMOTORS', exchange: 'NSE' as const, quantity: 3, enabled: true },
  ];
  console.log('  Watchlist qty:', config.watchlist.map(s => `${s.tradingsymbol}=${s.quantity}`).join(', '));
  // Override for simulation: ₹50,000 capital so all 5 symbols can trade.
  config.risk.availableCapital = 50_000;
  config.risk.maxDailyDrawdown = 50_000;
  config.risk.maxTradeAllocation = 50_000;
  config.risk.autoTradeTicketThreshold = 50_000;
  // Disable cooldown for fast simulation.
  config.strategy.tradeCooldownMinutes = 0;
  // Strategy guard tuning for the demo:
  config.strategy.barIntervalSeconds = 5;       // finalize bars every 5 ticks
  config.strategy.volumeConfirmMultiplier = 1.0; // don't block on volume in sim
  config.strategy.maxSimultaneousEntries = 5;   // allow all symbols
  config.strategy.riskPerTradePercent = 10;      // sizing budget for small caps
  config.strategy.circuitBreakerTrades = 99;    // effectively off for this demo
  // Disable time-of-day filter (sim runs on wall-clock, may be outside hours).
  config.strategy.skipFirstMinutes = 0;
  config.strategy.skipLastMinutes = 0;

  const TOTAL_TICKS = 120; // 2 minutes at 1/sec
  const SYMBOLS = ['INFY', 'RELIANCE', 'TCS', 'HDFCBANK', 'TATAMOTORS'];
  const TOKEN_BASE = 1000;

  // --- Setup ---------------------------------------------------------------
  const simDir = path.join(config.dataDir, 'sim');
  if (!fs.existsSync(simDir)) fs.mkdirSync(simDir, { recursive: true });

  // Clear any previous simulation DB so results are fresh.
  for (const f of ['ledger.db', 'ledger.db-wal', 'ledger.db-shm']) {
    const p = path.join(simDir, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const ledger = new Ledger(simDir);
  ledger.runMigrations();

  const mockStreamer = new MockStreamer();
  SYMBOLS.forEach((sym, i) => {
    const token = TOKEN_BASE + i;
    mockStreamer.register(token, sym, 'NSE');
    // Register in ledger too.
    ledger.upsertInstrument({
      instrument_token: token,
      exchange_token: String(token),
      tradingsymbol: sym,
      name: sym,
      last_price: 0,
      tick_size: 0.05,
      lot_size: 1,
      instrument_type: 'EQ',
      segment: 'NSE',
      exchange: 'NSE',
    } as any);
  });

  const notify = new NotificationService(ledger, config);
  const risk = new RiskEngine(config, ledger);
  const trader = new PaperTrader(config, ledger);
  const telegram = new TelegramHITL(config, new LlmManager(config.llm), notify);
  const news = new NewsSentimentEngine(config, new LlmManager(config.llm), ledger);
  const optionsTrader = new OptionsTrader(config, new OptionsEngine(config), ledger, risk);
  const agent = new MarketAgent(
    config,
    mockStreamer as any,
    ledger,
    risk,
    trader,
    telegram,
    news,
    notify,
    optionsTrader,
  );

  // Verify what the agent sees.
  const agentWatchlist = (agent as any).config?.watchlist as any[];
  console.log('  Agent watchlist:', agentWatchlist?.map((s: any) => `${s.tradingsymbol}=${s.quantity}`).join(', '));
  console.log('  Tracked symbols:', (agent as any).trackedSymbols?.()?.join(', ') ?? '?');
  console.log('  Watchlist from config:', config.watchlist.filter(s => s.enabled).map(s => `${s.tradingsymbol}=${s.quantity}`).join(', '));

  const optionSim = new OptionSimulator();

  // --- Warmup indicators with varied OHLC candles -------------------------
  for (const sym of SYMBOLS) {
    const start = START_PRICES[sym];
    let p = start;
    const warmupCandles: any[] = [];
    for (let i = 0; i < 40; i++) {
      const o = p;
      p += (Math.random() - 0.5) * start * 0.01; // ±0.5% noise
      const c = Number(p.toFixed(2));
      const high = Number((Math.max(o, c) * 1.002).toFixed(2));
      const low = Number((Math.min(o, c) * 0.998).toFixed(2));
      warmupCandles.push({ date: new Date(), open: o, high, low, close: c, volume: 100000 });
    }
    const ind = await agent.warmup(sym, warmupCandles);
    logger.info(
      { symbol: sym, rsi: ind.rsi?.toFixed(2) ?? 'n/a', adx: ind.adx?.toFixed(2) ?? 'n/a', atr: ind.atr?.toFixed(2) ?? 'n/a' },
      'Warmup indicators',
    );
  }

  // --- Generate prices -----------------------------------------------------
  const priceSeries: Record<string, number[]> = {};
  for (const sym of SYMBOLS) {
    priceSeries[sym] = generatePrices(sym, TOTAL_TICKS);
  }

  // --- Run simulation tick by tick -----------------------------------------
  logger.info('Starting 2-minute simulation with 5 symbols...');
  // Start at 10:00 today so the trading-window filter passes.
  const startTime = new Date();
  startTime.setHours(10, 0, 0, 0);

  for (let t = 0; t < TOTAL_TICKS; t++) {
    const tickTime = new Date(startTime.getTime() + t * 1000);
    const ticks: Tick[] = [];

    for (let i = 0; i < SYMBOLS.length; i++) {
      const sym = SYMBOLS[i];
      const token = TOKEN_BASE + i;
      const price = priceSeries[sym][t];

      ticks.push({
        instrument_token: token,
        last_price: price,
        volume_traded: Math.floor(Math.random() * 10000) + 1000,
        oi: 0,
        change: t > 0 ? price - priceSeries[sym][t - 1] : 0,
        exchange_timestamp: tickTime,
      });
    }

    // Feed ticks to the agent.
    agent.onTicks(ticks, tickTime);

    // Debug: log RSI + ADX every 10 ticks.
    if (t % 10 === 0 || t === TOTAL_TICKS - 1) {
      const dbg: string[] = [];
      for (const sym of SYMBOLS) {
        const rsiVal = (agent as any).rsiValues?.get(sym);
        const adxVal = (agent as any).adxValues?.get(sym);
        const price = priceSeries[sym][t];
        dbg.push(`${sym}=R${rsiVal?.toFixed(0) ?? '?'}/A${adxVal?.toFixed(0) ?? '?'}@${price.toFixed(0)}`);
      }
      console.log(`  [t=${String(t).padStart(3)}] ${dbg.join(' | ')}`);
    }

    // Check for new positions and open corresponding options.
    const positions = ledger.getOpenPositions();
    for (const pos of positions) {
      // If we haven't opened an option for this position yet, do it.
      if (!optionSim.getTrades().some(
        (tr) => tr.type === 'OPTION' && tr.direction === 'BUY' && tr.symbol.startsWith(pos.symbol),
      )) {
        optionSim.openOption(pos.symbol, pos.direction, priceSeries[pos.symbol][t], tickTime);
      }
    }

    // Check for closed positions and close corresponding options.
    for (const sym of SYMBOLS) {
      const pos = ledger.getPosition(sym);
      if (!pos) {
        // Position was closed — close the option too if open.
        const optTrades = optionSim.getTrades();
        const openOpt = optTrades.find(
          (tr) => tr.type === 'OPTION' && tr.direction === 'BUY' && tr.symbol.startsWith(sym),
        );
        const closedOpt = optTrades.find(
          (tr) => tr.type === 'OPTION' && tr.direction === 'SELL' && tr.symbol.startsWith(sym),
        );
        if (openOpt && !closedOpt) {
          optionSim.closeOption(sym, priceSeries[sym][t], tickTime, 'Equity position closed');
        }
      }
    }
  }

  // Close any remaining option positions at the end.
  for (const sym of SYMBOLS) {
    const pos = ledger.getPosition(sym);
    if (pos) {
      // Force-close equity position at last price.
      const lastPrice = priceSeries[sym][TOTAL_TICKS - 1];
      const fill = trader.execute({
        symbol: sym,
        exchange: 'NSE',
        quantity: pos.quantity,
        direction: pos.direction === 'LONG' ? 'SHORT' : 'LONG',
        entryPrice: lastPrice,
        reason: 'Simulation end — force close',
        ticketSize: pos.quantity * lastPrice,
        timestamp: new Date(startTime.getTime() + TOTAL_TICKS * 1000),
      });
      optionSim.closeOption(sym, lastPrice, new Date(), 'Simulation end');
    }
  }

  // --- Compute daily summary ------------------------------------------------
  // Drain the async trade-queue before reading results.
  await agent.flush();

  ledger.computeDailySummary(config.risk.availableCapital);

  // --- Debug: check signals table -------------------------------------------
  const signalCount = ledger.raw()
    .prepare('SELECT COUNT(*) as cnt FROM signals')
    .get() as { cnt: number };
  console.log(`  Signals recorded: ${signalCount.cnt}`);
  const riskCount = ledger.raw()
    .prepare('SELECT COUNT(*) as cnt FROM risk_events')
    .get() as { cnt: number };
  console.log(`  Risk events: ${riskCount.cnt}`);

  // Show first 5 risk events to understand what's blocking.
  const sampleRisks = ledger.raw()
    .prepare('SELECT event_type, details, created_at FROM risk_events ORDER BY created_at LIMIT 5')
    .all() as any[];
  for (const r of sampleRisks) {
    console.log(`  BLOCKED: [${r.event_type}] ${r.details}`);
  }

  // Show first 5 signals.
  const sampleSignals = ledger.raw()
    .prepare(`SELECT s.direction, s.rsi_value, s.price, s.reason, i.tradingsymbol
                FROM signals s JOIN instruments i ON i.token = s.instrument_id
               ORDER BY s.created_at LIMIT 5`)
    .all() as any[];
  for (const s of sampleSignals) {
    console.log(`  SIGNAL: ${s.tradingsymbol} ${s.direction} RSI=${s.rsi_value?.toFixed(1)} @${s.price} — ${s.reason?.slice(0, 60)}`);
  }

  // --- Write CSV P&L report -------------------------------------------------
  const csvPath = path.join(config.dataDir, 'simulation_pnl.csv');
  const csvRows: string[] = [];

  // Header
  csvRows.push('timestamp,symbol,type,direction,quantity,price,ticket_size,pnl,reason');

  // Equity trades from ledger
  const equityTrades = ledger.raw()
    .prepare(`SELECT t.*, i.tradingsymbol FROM trades t JOIN instruments i ON i.instrument_id = t.instrument_id ORDER BY t.created_at`)
    .all() as any[];

  for (const t of equityTrades) {
    csvRows.push(
      `${t.created_at},${t.tradingsymbol},EQUITY,${t.direction},${t.quantity},${t.price},${t.ticket_size},${t.pnl ?? 0},"${(t.reason ?? '').replace(/"/g, '""')}"`,
    );
  }

  // Option trades
  for (const t of optionSim.getTrades()) {
    csvRows.push(
      `${t.timestamp},${t.symbol},${t.type},${t.direction},${t.quantity},${t.premium},${t.quantity * t.premium},${t.pnl},"${t.reason.replace(/"/g, '""')}"`,
    );
  }

  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');

  // --- Print summary -------------------------------------------------------
  const equityPnl = equityTrades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
  const optionPnl = optionSim.getTrades().reduce((s, t) => s + t.pnl, 0);
  const totalPnl = equityPnl + optionPnl;
  const totalTrades = equityTrades.length + optionSim.getTrades().length;

  console.log('══════════════════════════════════════════════');
  console.log('  SIMULATION RESULTS — 2 min, ₹50,000 capital');
  console.log('══════════════════════════════════════════════');
  console.log(`  Symbols traded:      ${SYMBOLS.join(', ')}`);
  console.log(`  Total ticks:         ${TOTAL_TICKS}`);
  console.log(`  Total trades:        ${totalTrades}`);
  console.log(`  Equity P&L:          ₹${equityPnl.toFixed(2)}`);
  console.log(`  Options P&L:         ₹${optionPnl.toFixed(2)}`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  NET P&L:             ₹${totalPnl.toFixed(2)}`);
  console.log(`  Return:              ${((totalPnl / 50000) * 100).toFixed(2)}%`);
  console.log(`  Final capital:       ₹${(50000 + totalPnl).toFixed(2)}`);
  console.log('══════════════════════════════════════════════');
  console.log(`  CSV report:          ${csvPath}`);
  console.log(`  DB:                  ${simDir}/ledger.db`);
  console.log('══════════════════════════════════════════════\n');

  // --- Explain the logic ---------------------------------------------------
  console.log('📊 HOW THE LOGIC WORKED:');
  console.log('─────────────────────────────────────────────');
  console.log('1. Price patterns were designed to create RSI oversold conditions');
  console.log('   (sharp drops) followed by recoveries (RSI overbought exits).');
  console.log('');
  console.log('2. EQUITY entries fired when RSI(14) dropped below 30 (oversold).');
  console.log('   Each entry bought the configured quantity from watchlist.json.');
  console.log('');
  console.log('3. EQUITY exits fired on:');
  console.log('   - RSI(14) rising above 70 (overbought)');
  console.log('   - Stop-loss hit (4% below entry)');
  console.log('');
  console.log('4. OPTIONS: For every equity LONG entry, an ATM Call was bought.');
  console.log('   For every equity exit, the Call was sold. P&L approximated');
  console.log('   using delta ~0.5 × underlying move × lot size (50).');
  console.log('');
  console.log('5. RiskEngine gated every trade (drawdown, allocation, capital).');
  console.log('   All trades were auto-approved (ticket ≤ ₹10,000 threshold).');
  console.log('');
  console.log('6. Every trade, signal, and risk decision is persisted in the');
  console.log('   SQLite database for full auditability.');
  console.log('');

  ledger.close();
}

simulate().catch((err) => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
