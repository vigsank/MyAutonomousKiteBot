/**
 * go_live_ladder_test.ts — Phase 5. Verifies the pre-committed kill criteria
 * (5.1) and the capital ladder recommendation (5.2) behave conservatively.
 *
 * Run:
 *   ENV_FILE=.env.test LOG_LEVEL=silent npx ts-node test/go_live_ladder_test.ts
 */
import {
  evaluateKillCriteria,
  consecutiveLosingMonths,
  recommendLadderStage,
  DEFAULT_KILL_CRITERIA as CFG,
} from '../src/server/GoLiveLadder';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

function months(pnls: number[]): Array<{ month: string; pnl: number }> {
  return pnls.map((pnl, i) => ({ month: `2025-${String(i + 1).padStart(2, '0')}`, pnl }));
}

console.log('\n--- go-live ladder (Phase 5) ---');

// consecutiveLosingMonths counts only the trailing run.
{
  assert(consecutiveLosingMonths(months([-1, 5, -1, -1])) === 2, 'trailing losing run counted');
  assert(consecutiveLosingMonths(months([-1, -1, 3])) === 0, 'a winning last month resets the run');
  assert(consecutiveLosingMonths([]) === 0, 'empty history → 0');
}

// Healthy account → no kill.
{
  const v = evaluateKillCriteria({
    drawdownPct: 20,
    monthlyPnl: months([5, -2, 4]),
    trackingErrorPct: 15,
  });
  assert(!v.killed && v.breaches.length === 0, 'within all limits → not killed');
}

// Drawdown ceiling breach.
{
  const v = evaluateKillCriteria({ drawdownPct: CFG.maxDrawdownPct + 1, monthlyPnl: months([3]) });
  assert(v.killed && v.breaches.some((b) => b.includes('drawdown')), 'drawdown breach kills');
}

// Consecutive losing months breach.
{
  const losing = months(Array(CFG.maxConsecutiveLosingMonths).fill(-1));
  const v = evaluateKillCriteria({ drawdownPct: 10, monthlyPnl: losing });
  assert(v.killed && v.consecutiveLosingMonths === CFG.maxConsecutiveLosingMonths, 'losing streak kills');
}

// Tracking-error breach (only when supplied).
{
  const v = evaluateKillCriteria({
    drawdownPct: 10,
    monthlyPnl: months([2]),
    trackingErrorPct: CFG.maxTrackingErrorPct + 5,
  });
  assert(v.killed && v.breaches.some((b) => b.includes('Tracking')), 'excess tracking error kills');
  const noTE = evaluateKillCriteria({ drawdownPct: 10, monthlyPnl: months([2]) });
  assert(!noTE.killed, 'omitted tracking error is not a breach');
}

// Ladder: a kill always drops to PAPER; otherwise hold current.
{
  const kill = evaluateKillCriteria({ drawdownPct: CFG.maxDrawdownPct + 1, monthlyPnl: months([-1]) });
  const rec = recommendLadderStage('SCALE', kill);
  assert(rec.recommendedStage === 'PAPER', 'kill breach → recommend PAPER from any rung');

  const ok = evaluateKillCriteria({ drawdownPct: 10, monthlyPnl: months([3]) });
  const hold = recommendLadderStage('LIVE_25K', ok);
  assert(hold.recommendedStage === 'LIVE_25K', 'no breach → hold current rung');
}

console.log(failures === 0 ? '\nALL GO-LIVE LADDER TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
