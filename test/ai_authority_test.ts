/**
 * ai_authority_test.ts — Phase 4.3. Verifies the written promote/hold/retire
 * decision rule (`decideAiAuthority`) is conservative: no promotion on thin
 * evidence, no promotion on a tiny edge, and symmetric retirement on a lag.
 *
 * Run:
 *   ENV_FILE=.env.test LOG_LEVEL=silent npx ts-node test/ai_authority_test.ts
 */
import {
  decideAiAuthority,
  ShadowScore,
  DEFAULT_AI_AUTHORITY_CONFIG as CFG,
} from '../src/server/AiAuthorityPolicy';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

function score(originator: string, avgReturnPct: number, scored: number): ShadowScore {
  return {
    originator,
    scored,
    hitRate: 0.5,
    avgReturnPct,
    totalReturnPct: avgReturnPct * scored,
  };
}

console.log('\n--- AI authority policy (Phase 4.3) ---');

// 1. No AI side → HOLD, insufficient evidence.
{
  const d = decideAiAuthority([score('MOMENTUM', 2, 50)], 24);
  assert(d.verdict === 'HOLD' && !d.evidenceSufficient, 'no AI proposals → HOLD (filter-only)');
}

// 2. Big edge but too few months → HOLD (evidence bar not met).
{
  const scores = [score('AI_COMPOSITE', 6, 50), score('MOMENTUM', 2, 50)];
  const d = decideAiAuthority(scores, CFG.minMonths - 1);
  assert(d.verdict === 'HOLD' && !d.evidenceSufficient, 'strong edge but < minMonths → HOLD');
}

// 3. Big edge, enough months, but too few scored → HOLD.
{
  const scores = [score('AI_COMPOSITE', 6, CFG.minScored - 1), score('MOMENTUM', 2, 50)];
  const d = decideAiAuthority(scores, CFG.minMonths + 6);
  assert(d.verdict === 'HOLD' && !d.evidenceSufficient, 'strong edge but < minScored → HOLD');
}

// 4. Enough evidence, material edge → PROMOTE.
{
  const scores = [
    score('AI_COMPOSITE', 2 + CFG.edgePpToActOn + 0.5, CFG.minScored + 5),
    score('MOMENTUM', 2, 60),
  ];
  const d = decideAiAuthority(scores, CFG.minMonths + 1);
  assert(d.verdict === 'PROMOTE' && d.evidenceSufficient, 'material edge + full evidence → PROMOTE');
  assert(d.edgePp >= CFG.edgePpToActOn, 'edgePp reported at/above the action bar');
}

// 5. Enough evidence but tiny edge (inside the band) → HOLD.
{
  const scores = [
    score('AI_COMPOSITE', 2 + CFG.edgePpToActOn - 0.5, CFG.minScored + 5),
    score('MOMENTUM', 2, 60),
  ];
  const d = decideAiAuthority(scores, CFG.minMonths + 1);
  assert(d.verdict === 'HOLD' && d.evidenceSufficient, 'sub-threshold edge → HOLD (no-action band)');
}

// 6. Enough evidence, material lag → RETIRE.
{
  const scores = [
    score('AI_COMPOSITE', 2 - CFG.edgePpToActOn - 0.5, CFG.minScored + 5),
    score('MOMENTUM', 2, 60),
  ];
  const d = decideAiAuthority(scores, CFG.minMonths + 1);
  assert(d.verdict === 'RETIRE' && d.evidenceSufficient, 'material lag + full evidence → RETIRE');
}

console.log(failures === 0 ? '\nALL AI AUTHORITY TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
