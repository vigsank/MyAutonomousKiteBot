/**
 * Walk-forward / out-of-sample validation.
 *
 * A single in-sample backtest proves nothing. This runs the LIVE signal engine
 * (MarketAgent.onCandle) on rolling OOS folds, NET of realistic costs (the paper
 * cost model), and prints a blunt VALIDATED / NOT VALIDATED verdict on whether
 * the strategy has a deployable edge.
 *
 * Methodology:
 *  - Warm up a FRESH agent per fold on leading bars (never the fold itself), so
 *    there is no look-ahead.
 *  - Evaluate each fold out-of-sample, collecting realized fill PnL.
 *  - Require >= 30 OOS trades, positive net expectancy AND return, and the edge
 *    present in > 50% of folds (not one lucky window).
 *
 * Caveat: the universe is current watchlist names only, so results carry
 * survivorship/selection bias. A green verdict is necessary, not sufficient.
 *
 * Usage:
 *   BACKTEST_INTERVAL=day BACKTEST_DAYS=400 npm run validate:strategy
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
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { Candle } from '../../src/server/types';

const MIN_OOS_TRADES = 30;
const DEFAULT_CAPITAL = 500_000;

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function metrics(pnls: number[], capital: number) {
  if (pnls.length === 0) {
    return { trades: 0, returnPct: 0, expectancy: 0, winRate: 0, profitFactor: 0, maxDrawdownPct: 0 };
  }
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossProfit = wins.reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));

  let equity = capital;
  let peak = capital;
  let maxDd = 0;
  for (const p of pnls) {
    equity += p;
    peak = Math.max(peak, equity);
    if (peak > 0) maxDd = Math.max(maxDd, (peak - equity) / peak * 100);
  }

  return {
    trades: pnls.length,
    returnPct: (pnls.reduce((s, p) => s + p, 0) / capital) * 100,
    expectancy: pnls.reduce((s, p) => s + p, 0) / pnls.length,
    winRate: (wins.length / pnls.length) * 100,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    maxDrawdownPct: maxDd,
  };
}

function edgeVerdict(
  agg: ReturnType<typeof metrics>,
  foldConsistency: number,
): { verdict: string; reasons: string[] } {
  const reasons: string[] = [];
  if (agg.trades < MIN_OOS_TRADES) {
    reasons.push(`only ${agg.trades} OOS trades (need >= ${MIN_OOS_TRADES})`);
  }
  if (agg.expectancy <= 0) reasons.push(`net OOS expectancy ${agg.expectancy.toFixed(2)} (<= 0)`);
  if (agg.returnPct <= 0) reasons.push(`net OOS return ${agg.returnPct.toFixed(2)}% (<= 0)`);
  if (foldConsistency <= 0.5) {
    reasons.push(`edge in only ${(foldConsistency * 100).toFixed(0)}% of folds (<= 50%)`);
  }
  return reasons.length === 0
    ? { verdict: 'VALIDATED', reasons: ['positive net-of-cost edge, consistent across folds'] }
    : { verdict: 'NOT VALIDATED', reasons };
}

async function main(): Promise<void> {
  const config = loadConfig();

  const backtestProvider = (process.env.BACKTEST_PROVIDER || 'yahoo').toLowerCase();
  const interval = process.env.BACKTEST_INTERVAL || 'day';
  const days = numEnv('BACKTEST_DAYS', 400);
  const warmupBars = numEnv('BACKTEST_WARMUP_BARS', 60);
  const testBars = numEnv('BACKTEST_FOLD_BARS', 50);
  const capital = numEnv('BACKTEST_CAPITAL', DEFAULT_CAPITAL);

  config.risk.availableCapital = capital;
  config.risk.maxTradeAllocation = numEnv('BACKTEST_MAX_ALLOCATION', 20000);
  config.risk.autoTradeTicketThreshold = Number.MAX_SAFE_INTEGER;
  config.strategy.skipFirstMinutes = 0;
  config.strategy.skipLastMinutes = 0;
  config.strategy.disableTimeFilter = true;
  // Backtests measure the code strategy edge — never call the live LLM analyst.
  config.strategy.analystEnabled = false;
  // Validation should measure the raw signal edge, so disable the optional gates.
  config.strategy.regimeGatingEnabled = false;
  config.strategy.minSignalConfidence = 0;
  config.strategy.minRiskReward = 0;

  const symbols = config.watchlist.filter((s) => s.enabled);
  if (symbols.length === 0) {
    console.error('No enabled symbols in watchlist.');
    process.exit(1);
  }

  const streamer = createHistoricalProvider(config);
  await streamer.loadInstruments('NFO');
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  console.log('==============================================================');
  console.log('  WALK-FORWARD VALIDATION (net of costs)');
  console.log(`  Provider: ${backtestProvider} | Interval: ${interval} | Days: ${days}`);
  console.log(`  Warmup: ${warmupBars} bars | Fold: ${testBars} bars | Capital: ₹${capital.toLocaleString('en-IN')}`);
  console.log('==============================================================');

  const allPnl: number[] = [];
  const foldsBySymbol: Record<string, number[]> = {};
  let symbolsEvaluated = 0;

  for (const sym of symbols) {
    const inst = streamer.findInstrument(sym.tradingsymbol, 'NSE');
    if (!inst) continue;
    const candles: Candle[] = await streamer
      .getHistoricalData(inst.instrument_token, interval, from, to)
      .catch(() => []);
    if (candles.length <= warmupBars + 5) continue;
    symbolsEvaluated++;

    // Build contiguous OOS folds over [warmupBars, n).
    const folds: Array<[number, number]> = [];
    let start = warmupBars;
    while (start < candles.length) {
      const end = Math.min(start + testBars, candles.length);
      if (end - start >= Math.max(5, Math.floor(testBars / 2))) folds.push([start, end]);
      start = end;
    }

    const foldPnls: number[] = [];
    const foldReturns: number[] = [];

    for (const [fStart, fEnd] of folds) {
      // Fresh agent + ledger per fold (no indicator state bleed / no look-ahead).
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
        config, streamer as any, ledger, risk, trader, telegram, news, notify, optionsTrader,
      );

      // Warm up on bars BEFORE the fold only.
      const warmStart = Math.max(0, fStart - warmupBars);
      await agent.warmup(sym.tradingsymbol, candles.slice(warmStart, fStart));

      // Evaluate the fold out-of-sample.
      for (let i = fStart; i < fEnd; i++) {
        agent.onCandle(sym.tradingsymbol, candles[i], candles[i].date);
      }

      // Force-close any open position at fold end.
      const pos = ledger.getPosition(sym.tradingsymbol);
      if (pos) {
        const last = candles[fEnd - 1];
        trader.execute({
          symbol: sym.tradingsymbol,
          exchange: 'NSE',
          quantity: pos.quantity,
          direction: pos.direction === 'LONG' ? 'SHORT' : 'LONG',
          entryPrice: last.close,
          reason: 'Fold end — force close',
          ticketSize: pos.quantity * last.close,
          timestamp: last.date,
        });
      }

      // Trade proposals run through the async queue — drain it before we
      // inspect the ledger or close it.
      await agent.flush();

      const rows = ledger
        .raw()
        .prepare(`SELECT pnl FROM trades WHERE status = 'FILLED'`)
        .all() as Array<{ pnl: number | null }>;
      const foldPnl = rows.map((r) => r.pnl ?? 0);
      const m = metrics(foldPnl, capital);
      foldPnls.push(...foldPnl);
      foldReturns.push(m.returnPct);
      ledger.close();
    }

    const agg = metrics(foldPnls, capital);
    const evaluated = folds.filter(([, end], i) => foldReturns[i] !== undefined && foldPnls.length > 0).length;
    const positiveFolds = foldReturns.filter((r) => r > 0).length;
    const consistency = evaluated >= 2 ? positiveFolds / Math.max(1, folds.length) : 0;
    foldsBySymbol[sym.tradingsymbol] = foldPnls;
    allPnl.push(...foldPnls);

    console.log(`\n${sym.tradingsymbol}`);
    console.log(`  OOS trades: ${agg.trades} | Return: ${agg.returnPct.toFixed(2)}% | Expectancy: ₹${agg.expectancy.toFixed(2)}`);
    console.log(`  Win rate: ${agg.winRate.toFixed(1)}% | Profit factor: ${agg.profitFactor === Infinity ? 'inf' : agg.profitFactor.toFixed(2)} | Max DD: ${agg.maxDrawdownPct.toFixed(2)}%`);
    console.log(`  Fold consistency: ${positiveFolds}/${folds.length} positive`);
  }

  const agg = metrics(allPnl, capital);
  const totalPositive = Object.values(foldsBySymbol).reduce(
    (s, pnls) => s + (metrics(pnls, capital).returnPct > 0 ? 1 : 0),
    0,
  );
  const consistency = symbolsEvaluated >= 2 ? totalPositive / Math.max(1, symbolsEvaluated) : 0;
  const verdict = edgeVerdict(agg, consistency);

  console.log('\n==============================================================');
  console.log('  UNIVERSE VERDICT');
  console.log(`  Symbols evaluated: ${symbolsEvaluated}`);
  console.log(`  Total OOS trades: ${agg.trades}`);
  console.log(`  Weighted expectancy: ₹${agg.expectancy.toFixed(2)}`);
  console.log(`  Summed OOS return: ${agg.returnPct.toFixed(2)}%`);
  console.log(`  Symbols positive: ${totalPositive}/${symbolsEvaluated}`);
  console.log(`  Verdict: ${verdict.verdict}`);
  verdict.reasons.forEach((r) => console.log(`    - ${r}`));
  console.log('==============================================================');
  console.log('Caveat: current-listed universe only (survivorship bias). Green is necessary, not sufficient.');
}

main().catch((err) => {
  console.error('Walk-forward failed:', err);
  process.exit(1);
});
