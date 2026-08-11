/**
 * Parameter optimizer with multi-fold walk-forward validation.
 *
 * Fetches REAL historical candles once (account-free provider by default), then
 * sweeps a grid of strategy parameters. For each combination it runs a full
 * simulated backtest (in-memory SQLite — no real orders) and reports:
 *   - total P&L / return %
 *   - win rate
 *   - max drawdown
 *   - approx Sharpe
 *   - MULTI-FOLD walk-forward: the timeline is split into N rolling windows and
 *     each combo's P&L is measured per fold. A combo is robust only if it is
 *     profitable across MOST windows (guards against single-period luck).
 *   - an equity-curve CSV for the top combos (cumulative P&L over time).
 *
 * Usage:
 *   npx ts-node src/optimize.ts
 *
 * Tuning env (optional):
 *   OPT_RSI_ENTRY   = "25,30,35"
 *   OPT_RSI_EXIT    = "65,70,75"
 *   OPT_ATR_MULT    = "1.5,2,2.5"
 *   OPT_ADX         = "20,25,30"
 *   OPT_DAYS        = 120
 *   OPT_INTERVAL    = "5minute"
 *   OPT_CAPITAL     = 500000
 *   OPT_FOLDS       = 4     (walk-forward windows)
 *   OPT_TOP         = 5     (how many equity-curve CSVs to write)
 */

import { loadConfig, AppConfig } from '../../src/server/AppConfig';
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

function csvNum(v: string, fallback: number[]): number[] {
  const raw = process.env[v];
  if (!raw || !raw.trim()) return fallback;
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Resolve the sweep mode from CLI args (--quick/--mid/--large/--xl) or the
 * OPT_MODE env var. Defaults to 'large'.
 */
function resolveMode(): string {
  const arg = process.argv.find((a) => /^--(quick|mid|large|xl)$/i.test(a));
  if (arg) return arg.replace(/^--/, '').toLowerCase();
  const env = (process.env.OPT_MODE || 'large').toLowerCase();
  return ['quick', 'mid', 'large', 'xl'].includes(env) ? env : 'large';
}

/** Preset parameter grids per mode. Individual OPT_* env vars override axes. */
function getGrid(mode: string): {
  rsiEntry: number[];
  rsiExit: number[];
  atrMult: number[];
  adx: number[];
  stopLoss: number[];
  breakoutLookback: number[];
  breakoutTrailAtrMult: number[];
  optionPremiumCap: number[];
  optionStrikeOffset: number[];
  optionExpiryDays: number[];
} {
  const strategyMode = (process.env.STRATEGY_MODE || 'mean_reversion').toLowerCase();
  const isBreakout = strategyMode === 'breakout';
  const isOptions = (process.env.OPTIONS_ENABLED || 'false') === 'true';

  const mrPresets: Record<string, {
    rsiEntry: number[]; rsiExit: number[]; atrMult: number[]; adx: number[]; stopLoss: number[];
  }> = {
    quick: { rsiEntry: [30], rsiExit: [70], atrMult: [2], adx: [25], stopLoss: [4] },
    mid: { rsiEntry: [25, 30, 35], rsiExit: [65, 70, 75], atrMult: [1.5, 2, 2.5], adx: [20, 25, 30], stopLoss: [3, 4, 5] },
    large: { rsiEntry: [25, 28, 30, 32, 35], rsiExit: [65, 68, 70, 72, 75], atrMult: [1.5, 2, 2.5, 3], adx: [20, 25, 30], stopLoss: [3, 4, 5] },
    xl: { rsiEntry: [20, 25, 28, 30, 32, 35], rsiExit: [60, 65, 68, 70, 72, 75, 80], atrMult: [1, 1.5, 2, 2.5, 3, 3.5], adx: [15, 20, 25, 30, 35], stopLoss: [2, 3, 4, 5, 6] },
  };
  const boPresets: Record<string, { lookback: number[]; trail: number[] }> = {
    quick: { lookback: [20], trail: [2] },
    mid: { lookback: [10, 20, 30], trail: [1.5, 2, 2.5] },
    large: { lookback: [10, 15, 20, 25, 30], trail: [1.5, 2, 2.5, 3] },
    xl: { lookback: [5, 10, 15, 20, 25, 30], trail: [1, 1.5, 2, 2.5, 3, 3.5] },
  };
  const optPresets: Record<string, { cap: number[]; offset: number[]; expiry: number[] }> = {
    quick: { cap: [5000], offset: [2], expiry: [30] },
    mid: { cap: [2000, 5000, 10000], offset: [0, 2, 5], expiry: [15, 30, 60] },
    large: { cap: [2000, 5000, 10000, 15000], offset: [0, 2, 5, 8], expiry: [15, 30, 45, 60] },
    xl: { cap: [1000, 2000, 5000, 10000, 15000], offset: [0, 2, 5, 8, 10], expiry: [7, 15, 30, 45, 60] },
  };

  const base = {
    rsiEntry: [30], rsiExit: [70], atrMult: [2], adx: [25], stopLoss: [4],
    breakoutLookback: [20], breakoutTrailAtrMult: [2],
  };

  if (isOptions) {
    const p = optPresets[mode] ?? optPresets.large;
    return {
      ...base,
      optionPremiumCap: csvNum('OPT_OPTION_PREMIUM_CAP', p.cap),
      optionStrikeOffset: csvNum('OPT_OPTION_STRIKE_OFFSET', p.offset),
      optionExpiryDays: csvNum('OPT_OPTION_EXPIRY', p.expiry),
    };
  }

  if (isBreakout) {
    const p = boPresets[mode] ?? boPresets.large;
    return {
      ...base,
      breakoutLookback: csvNum('OPT_BREAKOUT_LOOKBACK', p.lookback),
      breakoutTrailAtrMult: csvNum('OPT_BREAKOUT_TRAIL_ATR_MULT', p.trail),
      optionPremiumCap: [5000], optionStrikeOffset: [2], optionExpiryDays: [30],
    };
  }

  const p = mrPresets[mode] ?? mrPresets.large;
  return {
    rsiEntry: csvNum('OPT_RSI_ENTRY', p.rsiEntry),
    rsiExit: csvNum('OPT_RSI_EXIT', p.rsiExit),
    atrMult: csvNum('OPT_ATR_MULT', p.atrMult),
    adx: csvNum('OPT_ADX', p.adx),
    stopLoss: csvNum('OPT_STOP_LOSS', p.stopLoss),
    breakoutLookback: [20], breakoutTrailAtrMult: [2],
    optionPremiumCap: [5000], optionStrikeOffset: [2], optionExpiryDays: [30],
  };
}

interface Combo {
  // mean-reversion / pullback
  rsiEntry: number;
  rsiExit: number;
  atrMult: number;
  adx: number;
  stopLoss: number;
  // breakout
  breakoutLookback: number;
  breakoutTrailAtrMult: number;
  // options
  optionPremiumCap: number;
  optionStrikeOffset: number;
  optionExpiryDays: number;
}

interface Metrics {
  trades: number;
  totalPnl: number;
  returnPct: number;
  winRate: number;
  maxDrawdown: number;
  sharpe: number;
  /** Per-fold realised P&L (multi-fold walk-forward). */
  folds: number[];
  /** Number of folds with positive P&L. */
  positiveFolds: number;
}

/** One trade on the equity curve. */
interface CurvePoint {
  ts: number;
  pnl: number;
}

interface ComboResult {
  combo: Combo;
  metrics: Metrics;
  equity: CurvePoint[];
}

async function main(): Promise<void> {
  const base = loadConfig();
  const optProvider = (process.env.BACKTEST_PROVIDER || 'yahoo').toLowerCase();
  if (optProvider === 'kite' && (!base.kite.apiKey || !base.kite.accessToken)) {
    console.error('❌ BACKTEST_PROVIDER=kite requires Kite credentials. Use the account-free default BACKTEST_PROVIDER=yahoo.');
    process.exit(1);
  }

  const interval = process.env.OPT_INTERVAL || '5minute';
  const days = numEnv('OPT_DAYS', 120);
  const capital = numEnv('OPT_CAPITAL', 500_000);
  const folds = numEnv('OPT_FOLDS', 4);
  const topN = numEnv('OPT_TOP', 5);
  const warmupBars = 60;
  const mode = resolveMode();

  const grid = getGrid(mode);
  const isBreakout = (process.env.STRATEGY_MODE || 'mean_reversion').toLowerCase() === 'breakout';
  const isOptions = (process.env.OPTIONS_ENABLED || 'false') === 'true';
  const totalCombos = isOptions
    ? grid.optionPremiumCap.length * grid.optionStrikeOffset.length * grid.optionExpiryDays.length
    : isBreakout
      ? grid.breakoutLookback.length * grid.breakoutTrailAtrMult.length
      : grid.rsiEntry.length * grid.rsiExit.length * grid.atrMult.length *
        grid.adx.length * grid.stopLoss.length;

  const symbols = base.watchlist.filter((s) => s.enabled);
  if (symbols.length === 0) {
    console.error('❌ No enabled symbols in watchlist.');
    process.exit(1);
  }

  console.log('======================================================');
  console.log('  PARAMETER OPTIMIZER (multi-fold walk-forward)');
  console.log(`  Mode: ${mode.toUpperCase()} | Data provider: ${optProvider} (account-free by default)`);
  console.log(`  Interval: ${interval} | Days: ${days} | Capital: ₹${capital.toLocaleString('en-IN')}`);
  console.log(`  Grid: ${isOptions
    ? `${grid.optionPremiumCap.length}×${grid.optionStrikeOffset.length}×${grid.optionExpiryDays.length} (cap×offset×expiry)`
    : isBreakout
      ? `${grid.breakoutLookback.length}×${grid.breakoutTrailAtrMult.length} (lookback×trail)`
      : `${grid.rsiEntry.length}×${grid.rsiExit.length}×${grid.atrMult.length}×${grid.adx.length}×${grid.stopLoss.length}`} = ${totalCombos} combos`);
  console.log(`  Walk-forward folds: ${folds}`);
  console.log(`  Symbols: ${symbols.map((s) => s.tradingsymbol).join(', ')}`);
  console.log('======================================================');

  // Fetch data once, shared across all combos.
  const streamer = createHistoricalProvider(base);
  await streamer.loadInstruments('NFO');
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const data: Record<string, Candle[]> = {};
  for (const sym of symbols) {
    const inst = streamer.findInstrument(sym.tradingsymbol, 'NSE');
    if (!inst) continue;
    try {
      const candles = await streamer.getHistoricalData(inst.instrument_token, interval, from, to);
      if (candles.length >= warmupBars + 20) data[sym.tradingsymbol] = candles;
      else logger.warn({ symbol: sym.tradingsymbol, bars: candles.length }, 'Too little history — skipped');
    } catch (err: any) {
      logger.error({ symbol: sym.tradingsymbol, err: err?.message }, 'History fetch failed');
    }
  }
  if (Object.keys(data).length === 0) {
    console.error('❌ No historical data fetched.');
    process.exit(1);
  }

  // Global timeline bounds (for fold boundaries).
  const allDates: number[] = [];
  for (const candles of Object.values(data)) {
    for (const c of candles) allDates.push(c.date.getTime());
  }
  allDates.sort((a, b) => a - b);
  const tMin = allDates[0];
  const tMax = allDates[allDates.length - 1];

  const results: ComboResult[] = [];
  let done = 0;

  if (isOptions) {
    for (const optionPremiumCap of grid.optionPremiumCap) {
      for (const optionStrikeOffset of grid.optionStrikeOffset) {
        for (const optionExpiryDays of grid.optionExpiryDays) {
          const combo: Combo = {
            rsiEntry: 30, rsiExit: 70, atrMult: 2, adx: 25, stopLoss: 4,
            breakoutLookback: 20, breakoutTrailAtrMult: 2,
            optionPremiumCap, optionStrikeOffset, optionExpiryDays,
          };
          const res = runCombo(base, data, combo, { capital, warmupBars, folds, tMin, tMax });
          results.push(res);
          done++;
          process.stdout.write(`\r  Progress: ${done}/${totalCombos} combos`);
        }
      }
    }
  } else if (isBreakout) {
    for (const breakoutLookback of grid.breakoutLookback) {
      for (const breakoutTrailAtrMult of grid.breakoutTrailAtrMult) {
        const combo: Combo = {
          rsiEntry: 30, rsiExit: 70, atrMult: 2, adx: 25, stopLoss: 4,
          breakoutLookback, breakoutTrailAtrMult,
          optionPremiumCap: 5000, optionStrikeOffset: 2, optionExpiryDays: 30,
        };
        const res = runCombo(base, data, combo, { capital, warmupBars, folds, tMin, tMax });
        results.push(res);
        done++;
        process.stdout.write(`\r  Progress: ${done}/${totalCombos} combos`);
      }
    }
  } else {
    for (const rsiEntry of grid.rsiEntry) {
      for (const rsiExit of grid.rsiExit) {
        for (const atrMult of grid.atrMult) {
          for (const adx of grid.adx) {
            for (const stopLoss of grid.stopLoss) {
              const combo: Combo = {
                rsiEntry, rsiExit, atrMult, adx, stopLoss,
                breakoutLookback: 20, breakoutTrailAtrMult: 2,
                optionPremiumCap: 5000, optionStrikeOffset: 2, optionExpiryDays: 30,
              };
              const res = runCombo(base, data, combo, { capital, warmupBars, folds, tMin, tMax });
              results.push(res);
              done++;
              process.stdout.write(`\r  Progress: ${done}/${totalCombos} combos`);
            }
          }
        }
      }
    }
  }

  // Sort by fitness score.
  const scored = results
    .map((r) => ({ ...r, fitness: fitnessScore(r.metrics) }))
    .sort((a, b) => b.fitness - a.fitness);

  // --- Summary CSV -----------------------------------------------------------
  const reportPath = path.join(base.dataDir, 'optimization_report.csv');
  const foldHeader = Array.from({ length: folds }, (_, i) => `fold${i + 1}_pnl`).join(',');
  const header = isOptions
    ? `option_premium_cap,option_strike_offset,option_expiry_days,fitness,trades,return_pct,win_rate,max_drawdown,sharpe,positive_folds,${foldHeader}`
    : isBreakout
      ? `breakout_lookback,breakout_trail_atr,fitness,trades,return_pct,win_rate,max_drawdown,sharpe,positive_folds,${foldHeader}`
      : `rsi_entry,rsi_exit,atr_mult,adx,stop_loss,fitness,trades,return_pct,win_rate,max_drawdown,sharpe,positive_folds,${foldHeader}`;
  const lines = [
    header,
    ...scored.map((r) => {
      const m = r.metrics;
      const params = isOptions
        ? `${r.combo.optionPremiumCap},${r.combo.optionStrikeOffset},${r.combo.optionExpiryDays},`
        : isBreakout
          ? `${r.combo.breakoutLookback},${r.combo.breakoutTrailAtrMult},`
          : `${r.combo.rsiEntry},${r.combo.rsiExit},${r.combo.atrMult},${r.combo.adx},${r.combo.stopLoss},`;
      return (
        params +
        `${r.fitness.toFixed(2)},${m.trades},${m.returnPct.toFixed(2)},` +
        `${(m.winRate * 100).toFixed(1)},${m.maxDrawdown.toFixed(0)},${m.sharpe.toFixed(2)},` +
        `${m.positiveFolds}/${folds},${m.folds.map((f) => f.toFixed(0)).join(',')}`
      );
    }),
  ];
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');

  // --- Equity-curve CSVs for the top combos ----------------------------------
  const equityDir = path.join(base.dataDir, 'equity_curves');
  if (!fs.existsSync(equityDir)) fs.mkdirSync(equityDir, { recursive: true });
  const equityFiles: string[] = [];
  for (const r of scored.slice(0, topN)) {
    const label = isOptions
      ? `opt_${r.combo.optionPremiumCap}_${r.combo.optionStrikeOffset}_${r.combo.optionExpiryDays}`
      : isBreakout
        ? `bo_${r.combo.breakoutLookback}_${r.combo.breakoutTrailAtrMult}`
        : `${r.combo.rsiEntry}_${r.combo.rsiExit}_${r.combo.atrMult}_${r.combo.adx}_${r.combo.stopLoss}`;
    const file = path.join(equityDir, `equity_${label}.csv`);
    const eqLines = ['timestamp,equity'];
    let cum = 0;
    for (const p of r.equity) {
      cum += p.pnl;
      eqLines.push(`${new Date(p.ts).toISOString()},${cum.toFixed(2)}`);
    }
    fs.writeFileSync(file, eqLines.join('\n'), 'utf-8');
    equityFiles.push(file);
  }

  // --- Console report --------------------------------------------------------
  console.log('\n\n══════════════════════════════════════════════════════════');
  console.log(`  TOP ${Math.min(15, scored.length)} COMBINATIONS (by fitness)`);
  console.log('══════════════════════════════════════════════════════════');
  const foldCols = Array.from({ length: folds }, (_, i) => `F${i + 1}`).join(' ');
  if (isOptions) {
    console.log(`  CAP   OFFSET  EXPIRY | FITNESS  RET%  WIN%   DD    SHARPE  ROBUST  ${foldCols}`);
    console.log('  ' + '-'.repeat(66 + folds * 4));
    for (const r of scored.slice(0, 15)) {
      const m = r.metrics;
      const robust = m.positiveFolds === folds ? '✓ ALL' : `${m.positiveFolds}/${folds}`;
      const foldStr = m.folds.map((f) => (f > 0 ? '+' : '').concat(f.toFixed(0))).join(' ');
      console.log(
        `  ${String(r.combo.optionPremiumCap).padEnd(5)} ${String(r.combo.optionStrikeOffset).padEnd(7)} ${String(r.combo.optionExpiryDays).padEnd(7)} | ` +
        `${r.fitness.toFixed(2).padStart(6)}  ${m.returnPct.toFixed(1).padStart(5)}%  ` +
        `${(m.winRate * 100).toFixed(0).padStart(4)}%  ${m.maxDrawdown.toFixed(0).padStart(5)}  ` +
        `${m.sharpe.toFixed(2).padStart(6)}  ${robust.padStart(7)}  ${foldStr}`,
      );
    }
  } else if (isBreakout) {
    console.log(`  LOOKBACK  TRAIL | FITNESS  RET%  WIN%   DD    SHARPE  ROBUST  ${foldCols}`);
    console.log('  ' + '-'.repeat(60 + folds * 4));
    for (const r of scored.slice(0, 15)) {
      const m = r.metrics;
      const robust = m.positiveFolds === folds ? '✓ ALL' : `${m.positiveFolds}/${folds}`;
      const foldStr = m.folds.map((f) => (f > 0 ? '+' : '').concat(f.toFixed(0))).join(' ');
      console.log(
        `  ${String(r.combo.breakoutLookback).padEnd(8)} ${String(r.combo.breakoutTrailAtrMult).padEnd(6)} | ` +
        `${r.fitness.toFixed(2).padStart(6)}  ${m.returnPct.toFixed(1).padStart(5)}%  ` +
        `${(m.winRate * 100).toFixed(0).padStart(4)}%  ${m.maxDrawdown.toFixed(0).padStart(5)}  ` +
        `${m.sharpe.toFixed(2).padStart(6)}  ${robust.padStart(7)}  ${foldStr}`,
      );
    }
  } else {
    console.log(`  ENTRY  EXIT  ATR  ADX  SL | FITNESS  RET%  WIN%   DD    SHARPE  ROBUST  ${foldCols}`);
    console.log('  ' + '-'.repeat(72 + folds * 4));
    for (const r of scored.slice(0, 15)) {
      const m = r.metrics;
      const robust = m.positiveFolds === folds ? '✓ ALL' : `${m.positiveFolds}/${folds}`;
      const foldStr = m.folds.map((f) => (f > 0 ? '+' : '').concat(f.toFixed(0))).join(' ');
      console.log(
        `  ${String(r.combo.rsiEntry).padEnd(5)} ${String(r.combo.rsiExit).padEnd(5)} ` +
        `${String(r.combo.atrMult).padEnd(4)} ${String(r.combo.adx).padEnd(4)} ${String(r.combo.stopLoss).padEnd(3)} | ` +
        `${r.fitness.toFixed(2).padStart(6)}  ${m.returnPct.toFixed(1).padStart(5)}%  ` +
        `${(m.winRate * 100).toFixed(0).padStart(4)}%  ${m.maxDrawdown.toFixed(0).padStart(5)}  ` +
        `${m.sharpe.toFixed(2).padStart(6)}  ${robust.padStart(7)}  ${foldStr}`,
      );
    }
  }
  console.log('══════════════════════════════════════════════════════════');
  console.log('  ✓ ALL = positive P&L in EVERY walk-forward fold (most robust)');
  console.log(`  Full report: ${reportPath}`);
  console.log(`  Equity curves (top ${topN}): ${equityDir}`);
  for (const f of equityFiles) console.log(`    ${f}`);
  console.log('  ⚠️  Optimization is exploratory. Validate the top combo on data');
  console.log('      you did NOT optimize on before considering real capital.\n');
}

/** Fitness: reward return, penalise drawdown, reward multi-fold robustness. */
function fitnessScore(m: Metrics): number {
  const tradePenalty = m.trades < 5 ? 0.5 : 1;
  const ddRatio = m.totalPnl === 0 ? 0 : m.maxDrawdown / Math.abs(m.totalPnl);
  const robustBonus = (m.positiveFolds / Math.max(1, m.folds.length)) * 3;
  return m.returnPct * tradePenalty - ddRatio * 10 + robustBonus;
}

/** Run one parameter combination as a full simulated backtest. */
function runCombo(
  base: AppConfig,
  data: Record<string, Candle[]>,
  combo: Combo,
  opts: { capital: number; warmupBars: number; folds: number; tMin: number; tMax: number },
): ComboResult {
  // Fresh config + in-memory ledger per combo.
  const config: AppConfig = { ...base, strategy: { ...base.strategy }, risk: { ...base.risk }, options: { ...base.options } };
  config.strategy.rsiEntryThreshold = combo.rsiEntry;
  config.strategy.rsiExitThreshold = combo.rsiExit;
  config.strategy.atrStopMultiplier = combo.atrMult;
  config.strategy.adxTrendThreshold = combo.adx;
  config.strategy.stopLossPercent = combo.stopLoss;
  config.strategy.breakoutLookback = combo.breakoutLookback;
  config.strategy.breakoutTrailAtrMult = combo.breakoutTrailAtrMult;
  config.options.maxPremiumPerTrade = combo.optionPremiumCap;
  config.options.strikeOffsetPct = combo.optionStrikeOffset;
  config.options.expiryDays = combo.optionExpiryDays;
  config.risk.availableCapital = opts.capital;
  config.risk.maxTradeAllocation = Number.MAX_SAFE_INTEGER;
  config.risk.autoTradeTicketThreshold = Number.MAX_SAFE_INTEGER;
  config.risk.maxDailyDrawdown = Number.MAX_SAFE_INTEGER;
  config.strategy.volumeConfirmMultiplier = 0;
  config.strategy.skipFirstMinutes = 0;
  config.strategy.skipLastMinutes = 0;
  config.strategy.tradeCooldownMinutes = 0;

  const ledger = new Ledger(':memory:');
  ledger.runMigrations();

  const notify = new NotificationService(ledger, config);
  const risk = new RiskEngine(config, ledger);
  const trader = new PaperTrader(config, ledger);
  const llm = new LlmManager(config.llm);
  const telegram = new TelegramHITL(config, llm, notify);
  const news = new NewsSentimentEngine(config, llm, ledger);
  const optionsTrader = new OptionsTrader(config, new OptionsEngine(config), ledger, risk);
  const agent = new MarketAgent(
    config,
    new CandleOnlyStreamer(Object.keys(data)) as any,
    ledger,
    risk,
    trader,
    telegram,
    news,
    notify,
    optionsTrader,
  );

  for (const [symbol, candles] of Object.entries(data)) {
    const warm = candles.slice(0, opts.warmupBars);
    agent.warmup(symbol, warm);
    for (let i = opts.warmupBars; i < candles.length; i++) {
      agent.onCandle(symbol, candles[i], candles[i].date);
    }
    // Force-close open position at last close.
    const pos = ledger.getPosition(symbol);
    if (pos) {
      const last = candles[candles.length - 1];
      trader.execute({
        symbol,
        exchange: 'NSE',
        quantity: pos.quantity,
        direction: pos.direction === 'LONG' ? 'SHORT' : 'LONG',
        entryPrice: last.close,
        reason: 'Sweep end — force close',
        ticketSize: pos.quantity * last.close,
        timestamp: last.date,
      });
    }
  }

  const rows = ledger.raw()
    .prepare(`SELECT pnl, created_at FROM trades WHERE status = 'FILLED' AND pnl != 0`)
    .all() as Array<{ pnl: number; created_at: string }>;

  // Build sorted equity curve (equity + option fills).
  const equity: CurvePoint[] = [
    ...rows.map((r) => ({ ts: new Date(r.created_at).getTime(), pnl: r.pnl })),
    ...optionsTrader.allFills.map((f) => ({ ts: f.timestamp.getTime(), pnl: f.pnl })),
  ].sort((a, b) => a.ts - b.ts);

  const realized = equity.map((p) => p.pnl);
  const totalPnl = realized.reduce((a, b) => a + b, 0);
  const wins = realized.filter((p) => p > 0).length;
  const losses = realized.filter((p) => p < 0).length;
  const winRate = realized.length ? wins / realized.length : 0;

  let peak = 0;
  let running = 0;
  let maxDd = 0;
  for (const p of equity) {
    running += p.pnl;
    if (running > peak) peak = running;
    maxDd = Math.max(maxDd, peak - running);
  }

  // Multi-fold walk-forward: bucket trades by time window.
  const folds = Array.from({ length: opts.folds }, () => 0);
  const span = opts.tMax - opts.tMin;
  for (const p of equity) {
    const idx = span > 0 ? Math.floor(((p.ts - opts.tMin) / span) * opts.folds) : 0;
    folds[Math.min(opts.folds - 1, Math.max(0, idx))] += p.pnl;
  }
  const positiveFolds = folds.filter((f) => f > 0).length;

  const avg = realized.length ? totalPnl / realized.length : 0;
  const variance =
    realized.length > 1
      ? realized.reduce((a, b) => a + (b - avg) * (b - avg), 0) / (realized.length - 1)
      : 0;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (avg / std) * Math.sqrt(Math.max(1, realized.length)) : 0;

  ledger.close();

  return {
    combo,
    metrics: {
      trades: realized.length,
      totalPnl,
      returnPct: (totalPnl / opts.capital) * 100,
      winRate,
      maxDrawdown: maxDd,
      sharpe,
      folds,
      positiveFolds,
    },
    equity,
  };
}

/** Minimal streamer so the agent can resolve symbols during a sweep. */
class CandleOnlyStreamer {
  constructor(private symbols: string[]) {}
  get isConfigured() { return true; }
  getInstrument(token: number) {
    return { tradingsymbol: this.symbols[token % this.symbols.length] ?? 'UNKNOWN', exchange: 'NSE' };
  }
  findInstrument(symbol: string) { return { instrument_token: this.symbols.indexOf(symbol) + 1 }; }
  async loadInstruments() {}
  async getHistoricalData() { return []; }
  startTicker() {}
  stopTicker() {}
}

main().catch((err) => {
  logger.fatal({ err: err?.message, stack: err?.stack }, 'Optimizer failed');
  process.exit(1);
});
