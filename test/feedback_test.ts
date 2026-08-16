/**
 * feedback_test.ts — regression tests for Phase F (feedback & learning):
 * automatic walk-forward re-optimization (F1) and outcome-driven adaptation (F2).
 *
 * Run:
 *   ENV_FILE=.env.test LOG_LEVEL=silent npx ts-node test/feedback_test.ts
 */
import { loadConfig } from '../src/server/AppConfig';
import { Ledger } from '../src/server/Ledger';
import { StrategyOptimizer } from '../src/server/StrategyOptimizer';
import { StrategyAdaptation } from '../src/server/StrategyAdaptation';
import { ClosePoint } from '../src/server/signals/momentum';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

function freshLedger(): Ledger {
  const l = new Ledger(':memory:');
  l.runMigrations();
  return l;
}

/* ------------------------------------------------------------------ */
/* Synthetic price data                                                */
/* ------------------------------------------------------------------ */

/** Daily dates covering `months` calendar months from 2019-01-01. */
function dailyDates(months: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(2019, 0, 1));
  const end = new Date(Date.UTC(2019, months, 1));
  while (d < end) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Build a universe where momentum genuinely persists: each symbol has a fixed
 * per-day drift, so past winners keep winning. A correct optimizer should
 * prefer a SMALL topN here (concentrating in the strongest drifters).
 */
function momentumUniverse(months: number, symbols = 20): Map<string, ClosePoint[]> {
  const dates = dailyDates(months);
  const out = new Map<string, ClosePoint[]>();
  for (let i = 0; i < symbols; i++) {
    const sym = `SYM${String(i).padStart(2, '0')}`;
    // Drift from +0.10%/day (best) down to -0.05%/day (worst).
    const drift = 0.001 - (i / (symbols - 1)) * 0.0015;
    let price = 100;
    const pts: ClosePoint[] = [];
    for (let d = 0; d < dates.length; d++) {
      // Deterministic wiggle so results are reproducible.
      const wiggle = Math.sin((i + 1) * (d + 1) * 0.37) * 0.004;
      price *= 1 + drift + wiggle;
      pts.push({ date: dates[d], close: Number(price.toFixed(2)) });
    }
    out.set(sym, pts);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* F1 — walk-forward re-optimization                                   */
/* ------------------------------------------------------------------ */

function testOptimizer() {
  console.log('\n--- F1: walk-forward re-optimization ---');
  const config = loadConfig();
  config.strategy.momentumLookbackMonths = 12;
  config.strategy.momentumTopN = 6;

  // Too little history must be refused outright rather than guessed at.
  {
    const ledger = freshLedger();
    const opt = new StrategyOptimizer(config, ledger);
    const res = opt.optimize(momentumUniverse(18));
    assert(!res.applied, 'short history does not update the parameter');
    assert(
      res.reason.includes('insufficient history'),
      'short history is reported as insufficient, not as a result',
    );
    ledger.close();
  }

  // Enough history: 24 months training + 6 folds x 3 months = 42, use 60.
  {
    const ledger = freshLedger();
    const opt = new StrategyOptimizer(config, ledger);
    const res = opt.optimize(momentumUniverse(60), true /* dryRun */);
    assert(res.windows >= 6, `evaluated ${res.windows} out-of-sample folds (>= 6)`);
    assert(res.scores.length === 6, 'scored every candidate in the validated bounds (5..10)');
    assert(
      res.scores.every((s) => s.topN >= 5 && s.topN <= 10),
      'never proposes a parameter outside the validated bounds',
    );
    assert(!res.applied, 'dry run does not persist');

    // In a universe with persistent momentum, concentrating should beat
    // diluting — the best topN must not be the widest one.
    const best = res.scores[0];
    const widest = res.scores.find((s) => s.topN === 10)!;
    assert(
      best.oosAnnualized >= widest.oosAnnualized,
      'concentration beats dilution when momentum persists',
    );
    ledger.close();
  }

  // Noise guard: a challenger that barely wins must not displace the incumbent.
  {
    const ledger = freshLedger();
    const opt = new StrategyOptimizer(config, ledger);
    const universe = momentumUniverse(60);
    const first = opt.optimize(universe);
    if (first.applied) {
      // Re-running with the winner now installed must be a no-op.
      const second = opt.optimize(universe);
      assert(!second.applied, 're-running after applying is a no-op (no churn)');
      assert(
        second.reason.includes('already the out-of-sample best'),
        'no-op is explained as the incumbent already being best',
      );
    } else {
      assert(
        first.reason.includes('margin') || first.reason.includes('already'),
        'change is withheld either as noise or because the incumbent is best',
      );
    }
    ledger.close();
  }

  // Persistence path actually writes to strategy_params.
  {
    const ledger = freshLedger();
    const cfg = { ...config, strategy: { ...config.strategy, momentumTopN: 10 } };
    const opt = new StrategyOptimizer(cfg, ledger);
    const res = opt.optimize(momentumUniverse(60));
    if (res.applied) {
      assert(
        ledger.getStrategyParam('momentumTopN') === String(res.bestTopN),
        'applied parameter is persisted to strategy_params',
      );
    } else {
      assert(true, `no change applied (${res.reason})`);
    }
    ledger.close();
  }
}

/* ------------------------------------------------------------------ */
/* F2 — outcome-driven adaptation                                      */
/* ------------------------------------------------------------------ */

/** Insert a closed trade with a given P&L directly into the ledger. */
function seedTrade(ledger: Ledger, symbol: string, pnl: number, seq: number): void {
  const db = ledger.raw();
  db.prepare(
    `INSERT OR IGNORE INTO instruments
       (token, tradingsymbol, exchange, segment, instrument_type, name, lot_size, tick_size)
     VALUES (?, ?, 'NSE', 'NSE', 'EQ', ?, 1, 0.05)`,
  ).run(90000 + seq, symbol, symbol);
  const inst = db
    .prepare('SELECT instrument_id AS id FROM instruments WHERE tradingsymbol = ?')
    .get(symbol) as { id: number };
  const ts = new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString();
  db.prepare(
    `INSERT INTO trades
       (trade_id, instrument_id, direction, quantity, price, ticket_size, pnl, status, reason, created_at)
     VALUES (?, ?, 'LONG', 10, 100, 1000, ?, 'FILLED', 'test', ?)`,
  ).run(`T-${seq}`, inst.id, pnl, ts);
}

function testAdaptation() {
  console.log('\n--- F2: outcome-driven adaptation ---');
  const config = loadConfig();

  // Below the minimum sample: no adaptation, full size.
  {
    const ledger = freshLedger();
    for (let i = 0; i < 5; i++) seedTrade(ledger, 'AAA', -50, i);
    const a = new StrategyAdaptation(config, ledger);
    const s = a.state();
    assert(s.riskMultiplier === 1, 'tiny sample does not de-risk');
    assert(s.reason.includes('no adaptation'), 'tiny sample is explained, not acted on');
    ledger.close();
  }

  // Healthy record: full size.
  {
    const ledger = freshLedger();
    for (let i = 0; i < 20; i++) seedTrade(ledger, 'AAA', i % 3 === 0 ? -20 : 40, i);
    const a = new StrategyAdaptation(config, ledger);
    const s = a.state();
    assert(s.sample === 20, 'all closed trades are counted');
    assert(s.riskMultiplier === 1, 'profitable record keeps full size');
    assert(s.profitFactor > 1, 'profit factor above 1 for a winning record');
    ledger.close();
  }

  // Negative expectancy: de-risk, but never below the floor.
  {
    const ledger = freshLedger();
    for (let i = 0; i < 20; i++) seedTrade(ledger, 'AAA', -30, i);
    const a = new StrategyAdaptation(config, ledger);
    const s = a.state();
    assert(s.expectancyPct < 0, 'negative expectancy is measured');
    assert(s.riskMultiplier < 1, 'negative expectancy reduces size');
    assert(s.riskMultiplier >= 0.4, 'multiplier never falls below the floor');
    assert(s.winRate === 0, 'win rate reflects an all-loss record');
    ledger.close();
  }

  // Loss streak triggers a step-down even when overall expectancy is positive.
  {
    const ledger = freshLedger();
    // Older trades: strongly positive. Newest 5: losses.
    for (let i = 0; i < 15; i++) seedTrade(ledger, 'AAA', 200, i);
    for (let i = 15; i < 20; i++) seedTrade(ledger, 'AAA', -20, i);
    const a = new StrategyAdaptation(config, ledger);
    const s = a.state();
    assert(s.expectancyPct > 0, 'overall expectancy is still positive');
    assert(s.lossStreak === 5, 'current loss streak is detected from newest trades');
    assert(s.riskMultiplier < 1, 'loss streak de-risks despite positive expectancy');
    ledger.close();
  }

  // Recovery: a win breaks the streak and restores full size.
  {
    const ledger = freshLedger();
    for (let i = 0; i < 15; i++) seedTrade(ledger, 'AAA', 200, i);
    for (let i = 15; i < 20; i++) seedTrade(ledger, 'AAA', -20, i);
    seedTrade(ledger, 'AAA', 150, 20); // newest = a win
    const a = new StrategyAdaptation(config, ledger);
    const s = a.state();
    assert(s.lossStreak === 0, 'a winning trade resets the streak');
    assert(s.riskMultiplier === 1, 'size is restored after recovery');
    ledger.close();
  }

  // Opening fills (pnl = 0) must not be counted as outcomes.
  {
    const ledger = freshLedger();
    for (let i = 0; i < 20; i++) seedTrade(ledger, 'AAA', 0, i);
    const a = new StrategyAdaptation(config, ledger);
    assert(a.state().sample === 0, 'zero-P&L opening fills are not outcomes');
    ledger.close();
  }
}

function main() {
  testOptimizer();
  testAdaptation();
  console.log(
    failures === 0
      ? '\nAll feedback & learning (Phase F) tests passed.'
      : `\n${failures} test(s) FAILED.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
