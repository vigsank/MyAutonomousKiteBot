/**
 * Mock-data backtest ENGINE — runs the real strategy (MarketAgent.onCandle)
 * over the mock's real historical CSVs, with optional seeded holdings and
 * periodic rebalancing, on a given capital. AI analyst (news sentiment + LLM
 * verdict) gates entries. Returns a CaseResult for reporting.
 *
 * Used by run_all_cases.ts to run the 10 scenarios and generate reports.
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
import { Candle, TradeRequest } from '../../src/server/types';
import * as fs from 'fs';
import * as path from 'path';
import { resolveDataDir } from './_dataDir';

const DATA_DIR = resolveDataDir();

/** Reject a promise after `ms` so a hung network/LLM call can't block the run. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export interface CaseConfig {
  name: string;
  holdingsCount: number;
  holdingsValue: number;
  newCapital: number;
  pickSymbols: number;
  days: number;
  rebalanceDays: number;
  seed: number;
}

export interface CaseResult {
  name: string;
  holdingsCount: number;
  holdingsValue: number;
  newCapital: number;
  totalCapital: number;
  pickSymbols: number;
  days: number;
  rebalanceDays: number;
  seed: number;
  symbols: string[];
  roundTrips: number;
  winRate: number;
  profitFactor: number;
  netPnl: number;
  returnPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  finalEquity: number;
  equityCurve: number[];
  perSymbol: Array<{ symbol: string; pnl: number }>;
  topTrades: Array<{ symbol: string; direction: string; quantity: number; price: number; pnl: number; reason: string }>;
  /** Diagnostic: how many candidate signals were rejected at each gate. */
  gateCounters: Record<string, number>;
  /** Diagnostic: breakdown of RiskEngine block reasons. */
  riskReasons: Record<string, number>;
}

/** Parse a mock CSV into Candle[] (chronological). */
export function readCandles(symbol: string, interval: string): Candle[] {
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

/** Deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A symbol is tradeable if one share (NSE min lot = 1) fits within capital budget. */
export function isTradeable(price: number, capital: number, maxPositions: number): boolean {
  return price > 0 && price <= capital / Math.max(1, maxPositions);
}

/** Minimal streamer stub — MarketAgent.onCandle only needs instrument lookup. */
function makeStreamer(symbols: string[]) {
  const bySymbol = new Map(symbols.map((s, i) => [s, {
    instrument_token: 1000 + i, tradingsymbol: s, exchange: 'NSE', last_price: 0,
  }]));
  return {
    findInstrument: (symbol: string) => bySymbol.get(symbol) ?? null,
    getInstrument: (token: number) => [...bySymbol.values()].find((i: any) => i.instrument_token === token) ?? null,
  };
}

/** Run one case. Returns a CaseResult. */
export async function runCase(cfg: CaseConfig, interval = '5min', warmupBars = 60): Promise<CaseResult> {
  const config = loadConfig();
  const totalCapital = cfg.holdingsValue + cfg.newCapital;
  config.risk.availableCapital = totalCapital;
  // Cap each position to a % of total capital so the portfolio can diversify
  // (was 100% — one oversized trade starved all subsequent entries).
  const weightPct = Math.min(Math.max(config.risk.maxPositionWeightPct || 20, 5), 100);
  config.risk.maxTradeAllocation = Math.max(1, Math.round((totalCapital * weightPct) / 100));
  config.risk.autoTradeTicketThreshold = Number.MAX_SAFE_INTEGER;
  config.risk.maxDailyDrawdown = Math.max(config.risk.maxDailyDrawdown, totalCapital * 0.1);
  config.strategy.analystEnabled = process.env.BACKTEST_NO_ANALYST !== '1';
  config.strategy.disableTimeFilter = true;
  // Signal diversification: pick the strategy that fits each symbol's regime
  // (mean-reversion for ranging, pullback-trend for trending) instead of one.
  config.strategy.regimeAdaptive = true;

  const allSymbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);
  const rng = mulberry32(cfg.seed);
  const shuffled = [...allSymbols].sort(() => rng() - 0.5);
  const selected = shuffled.slice(0, Math.min(cfg.pickSymbols, allSymbols.length));

  const candlesMap = new Map<string, Candle[]>();
  for (const sym of selected) {
    const c = readCandles(sym, interval);
    if (c.length > warmupBars) {
      // Tradeability filter: skip symbols too expensive to size at this capital.
      if (isTradeable(c[0].close, totalCapital, cfg.pickSymbols)) candlesMap.set(sym, c);
    }
  }

  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  ledger.startSession('BACKTEST');
  const notify = new NotificationService(ledger, config);
  const streamer = makeStreamer([...candlesMap.keys()]) as any;
  const risk = new RiskEngine(config, ledger);
  const trader = new PaperTrader(config, ledger);
  const llm = new LlmManager(config.llm);
  // Backtest ensemble mode: 'fast' (default) for speed, or 'depth' for the
  // heavier reasoning models. Controlled via ENSEMBLE_MODE env (set by the
  // run_all_cases --ensemble arg).
  const mode = (process.env.ENSEMBLE_MODE || 'fast') === 'depth' ? 'depth' : 'fast';
  llm.setEnsembleMode(mode);
  const telegram = new TelegramHITL(config, llm, notify);
  const news = new NewsSentimentEngine(config, llm, ledger);
  const optionsTrader = new OptionsTrader(config, new OptionsEngine(config), ledger, risk);
  const agent = new MarketAgent(config, streamer, ledger, risk, trader, telegram, news, notify, optionsTrader);

  // Optional pre-computation of real news sentiment per selected symbol.
  // OFF by default (BACKTEST_PRECOMPUTE_NEWS=1 to enable): each symbol's
  // sentimentFor() does Google-RSS + TinyFish + LLM calls that can hang for up
  // to 45s each, stalling the whole backtest before trading starts. When off,
  // sentiment starts neutral (0) and the LLM analyst gate still runs at
  // proposal time.
  if (process.env.BACKTEST_PRECOMPUTE_NEWS === '1') {
    for (const sym of candlesMap.keys()) {
      try {
        const s = await withTimeout(news.sentimentFor(sym), 45_000);
        if (s && typeof s.score === 'number') (agent as any).sentiment.set(sym, s.score);
      } catch { /* keep 0 */ }
    }
  }

  // Seed existing holdings (equal weight across holdingsCount symbols).
  const seedSymbols = shuffled.slice(0, Math.min(cfg.holdingsCount, candlesMap.size));
  if (cfg.holdingsCount > 0 && seedSymbols.length > 0) {
    const perHolding = cfg.holdingsValue / seedSymbols.length;
    for (const sym of seedSymbols) {
      const candles = candlesMap.get(sym);
      if (!candles || candles.length === 0) continue;
      const price = candles[0].close;
      const qty = Math.max(1, Math.floor(perHolding / price));
      trader.execute({
        symbol: sym, exchange: 'NSE', quantity: qty, direction: 'LONG',
        entryPrice: price, reason: 'seeded holding', ticketSize: qty * price, timestamp: candles[0].date,
      });
    }
  }

  // Run over candles, rebalancing every rebalanceDays.
  const equityCurve: number[] = [totalCapital];
  const byDay = new Map<string, string[]>();
  for (const [sym, candles] of candlesMap) {
    for (const c of candles) {
      const d = c.date.toISOString().slice(0, 10);
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d)!.push(sym);
    }
  }
  const days = [...byDay.keys()].sort().slice(0, cfg.days);

  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    for (const sym of candlesMap.keys()) {
      const candles = candlesMap.get(sym)!;
      const dayCandles = candles.filter((c) => c.date.toISOString().slice(0, 10) === day);
      for (const c of dayCandles) {
        agent.onCandle(sym, c, c.date);
        await agent.flush();
      }
    }
    // Rebalance at the end of each rebalance period.
    if ((di + 1) % cfg.rebalanceDays === 0) {
      rebalance(ledger, trader, risk, config, candlesMap, days[di]);
    }
    // Mark-to-market equity.
    let eq = totalCapital;
    for (const pos of ledger.getOpenPositions()) {
      const inst = ledger.getInstrumentBySymbol(pos.symbol, 'NSE');
      const price = inst?.last_price ?? pos.avgPrice;
      eq += pos.direction === 'LONG' ? (price - pos.avgPrice) * pos.quantity : (pos.avgPrice - price) * pos.quantity;
    }
    equityCurve.push(eq);
  }

  // Force-close any open positions at the end.
  for (const sym of candlesMap.keys()) {
    const pos = ledger.getPosition(sym, 'NSE');
    if (pos) {
      const candles = candlesMap.get(sym)!;
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
    `SELECT i.tradingsymbol AS symbol, t.direction, t.quantity, t.price, t.pnl, t.reason
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

  let peak = totalCapital, running = totalCapital, maxDd = 0;
  for (const r of realized) {
    running += r.pnl ?? 0;
    peak = Math.max(peak, running);
    maxDd = Math.max(maxDd, peak - running);
  }

  const perSymbol = new Map<string, number>();
  for (const r of realized) perSymbol.set(r.symbol, (perSymbol.get(r.symbol) ?? 0) + (r.pnl ?? 0));
  const topTrades = [...realized].sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)).slice(0, 8)
    .map((t) => ({ symbol: t.symbol, direction: t.direction, quantity: t.quantity, price: t.price, pnl: t.pnl ?? 0, reason: t.reason }));

  // Aggregate RiskEngine block reasons from the audit trail.
  const riskRows = ledger.raw().prepare(
    `SELECT details FROM risk_events WHERE event_type = 'TRADE_BLOCKED'`,
  ).all() as Array<{ details: string }>;
  const riskReasons: Record<string, number> = {};
  for (const r of riskRows) {
    for (const part of r.details.split(';')) {
      const k = part.trim();
      if (!k) continue;
      riskReasons[k] = (riskReasons[k] ?? 0) + 1;
    }
  }

  ledger.close();
  return {
    name: cfg.name, holdingsCount: cfg.holdingsCount, holdingsValue: cfg.holdingsValue,
    newCapital: cfg.newCapital, totalCapital, pickSymbols: cfg.pickSymbols, days: cfg.days,
    rebalanceDays: cfg.rebalanceDays, seed: cfg.seed, symbols: [...candlesMap.keys()],
    roundTrips: realized.length, winRate, profitFactor, netPnl: totalPnl,
    returnPct: (totalPnl / totalCapital) * 100, maxDrawdown: maxDd,
    maxDrawdownPct: (maxDd / totalCapital) * 100, finalEquity: totalCapital + totalPnl,
    equityCurve, perSymbol: [...perSymbol.entries()].map(([symbol, pnl]) => ({ symbol, pnl })).sort((a, b) => b.pnl - a.pnl),
    topTrades,
    gateCounters: agent.getGateCounters(),
    riskReasons,
  };
}

/** Rebalance: trim overweight / book profit / exit losers, freeing capital. */
function rebalance(ledger: Ledger, trader: PaperTrader, risk: RiskEngine, config: any, candlesMap: Map<string, Candle[]>, day: string): void {
  const cfg = config.strategy;
  for (const pos of ledger.getOpenPositions()) {
    const candles = candlesMap.get(pos.symbol);
    if (!candles) continue;
    const dayCandles = candles.filter((c) => c.date.toISOString().slice(0, 10) === day);
    if (dayCandles.length === 0) continue;
    const price = dayCandles[dayCandles.length - 1].close;
    const unrealizedPnlPct = pos.direction === 'LONG'
      ? ((price - pos.avgPrice) / pos.avgPrice) * 100
      : ((pos.avgPrice - price) / pos.avgPrice) * 100;
    const weightPct = (pos.quantity * price / config.risk.availableCapital) * 100;

    let action: 'HOLD' | 'TRIM' | 'EXIT' = 'HOLD';
    if (unrealizedPnlPct <= -cfg.stopLossPercent) action = 'EXIT';
    else if (unrealizedPnlPct >= cfg.holdingsProfitTargetPct) action = 'TRIM';
    else if (weightPct > cfg.holdingsTargetWeightPct) action = 'TRIM';

    if (action === 'HOLD') continue;
    const qty = action === 'EXIT' ? pos.quantity : Math.max(1, Math.floor(pos.quantity / 2));
    const trade: TradeRequest = {
      symbol: pos.symbol, exchange: 'NSE', quantity: qty,
      direction: pos.direction === 'LONG' ? 'SHORT' : 'LONG',
      entryPrice: price, reason: `rebalance ${action}`, ticketSize: qty * price, timestamp: new Date(day),
    };
    const decision = risk.evaluate(trade);
    if (decision.allowed) trader.execute(trade);
  }
}
