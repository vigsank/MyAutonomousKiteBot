/**
 * shadow_book_test.ts — Phase 4.1. Verifies the shadow-book scorer answers
 * "would the AI have made money?" from persisted proposals + candles.
 *
 * Run:
 *   ENV_FILE=.env.test LOG_LEVEL=silent npx ts-node test/shadow_book_test.ts
 */
import { Ledger } from '../src/server/Ledger';

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

/** ISO timestamp `days` after a base date. */
function iso(base: string, days: number): string {
  return new Date(new Date(base + 'T00:00:00Z').getTime() + days * 86_400_000).toISOString();
}

/* ------------------------------------------------------------------ */

const l = freshLedger();
const BASE = '2025-01-01';

// A momentum LONG proposal at 100, entry logged at BASE. We then persist a
// candle 21 days later at 110 → +10% forward return.
l.recordAgentProposal({
  symbol: 'WINNER',
  originator: 'MOMENTUM',
  direction: 'BUY',
  quantity: 10,
  entryPrice: 100,
  aiTilt: 1,
  thesis: 'top-ranked',
  executed: true,
});
// Force the proposal's created_at to a known instant so the horizon is exact.
(l as unknown as { db: { prepare: (s: string) => { run: (...a: unknown[]) => void } } }).db
  .prepare(`UPDATE agent_proposals SET created_at = ? WHERE symbol = 'WINNER'`)
  .run(iso(BASE, 0).slice(0, 19).replace('T', ' '));
l.recordCandle('WINNER', 'NSE', 'day', {
  timestamp: iso(BASE, 21),
  open: 108,
  high: 112,
  low: 107,
  close: 110,
  volume: 1000,
});

// An AI_COMPOSITE shadow LONG at 100 that DROPS to 90 → −10%.
l.recordAgentProposal({
  symbol: 'LOSER',
  originator: 'AI_COMPOSITE',
  direction: 'BUY',
  quantity: 10,
  entryPrice: 100,
  aiTilt: 0,
  thesis: 'shadow',
  executed: false,
  outcome: 'SHADOW',
});
(l as unknown as { db: { prepare: (s: string) => { run: (...a: unknown[]) => void } } }).db
  .prepare(`UPDATE agent_proposals SET created_at = ? WHERE symbol = 'LOSER'`)
  .run(iso(BASE, 0).slice(0, 19).replace('T', ' '));
l.recordCandle('LOSER', 'NSE', 'day', {
  timestamp: iso(BASE, 22),
  open: 92,
  high: 93,
  low: 89,
  close: 90,
  volume: 1000,
});

// A proposal with no forward candle yet — must be skipped, not scored as 0.
l.recordAgentProposal({
  symbol: 'PENDING',
  originator: 'MOMENTUM',
  direction: 'BUY',
  quantity: 5,
  entryPrice: 200,
  aiTilt: 1,
  thesis: 'no forward data',
  executed: true,
});

const scores = l.scoreShadowBook(21);
const mom = scores.find((s) => s.originator === 'MOMENTUM');
const ai = scores.find((s) => s.originator === 'AI_COMPOSITE');

assert(!!mom, 'MOMENTUM bucket present');
assert(mom!.scored === 1, `only the scorable MOMENTUM proposal is counted (got ${mom!.scored})`);
assert(Math.abs(mom!.avgReturnPct - 10) < 0.01, `MOMENTUM forward return ~+10% (got ${mom!.avgReturnPct.toFixed(2)})`);
assert(mom!.hitRate === 1, 'MOMENTUM hit rate 100%');

assert(!!ai, 'AI_COMPOSITE bucket present');
assert(Math.abs(ai!.avgReturnPct + 10) < 0.01, `AI_COMPOSITE forward return ~-10% (got ${ai!.avgReturnPct.toFixed(2)})`);
assert(ai!.hitRate === 0, 'AI_COMPOSITE hit rate 0%');

// A SELL/short proposal that falls should score positive.
l.recordAgentProposal({
  symbol: 'SHORTWIN',
  originator: 'AI_COMPOSITE',
  direction: 'SELL',
  quantity: 5,
  entryPrice: 100,
  aiTilt: 1,
  thesis: 'short',
  executed: false,
});
(l as unknown as { db: { prepare: (s: string) => { run: (...a: unknown[]) => void } } }).db
  .prepare(`UPDATE agent_proposals SET created_at = ? WHERE symbol = 'SHORTWIN'`)
  .run(iso(BASE, 0).slice(0, 19).replace('T', ' '));
l.recordCandle('SHORTWIN', 'NSE', 'day', {
  timestamp: iso(BASE, 21),
  open: 91,
  high: 92,
  low: 89,
  close: 90,
  volume: 1000,
});
const scores2 = l.scoreShadowBook(21);
const ai2 = scores2.find((s) => s.originator === 'AI_COMPOSITE')!;
assert(ai2.scored === 2, 'AI_COMPOSITE now has both a long and a short scored');
// short winning +10 and long losing -10 net to ~0 avg.
assert(Math.abs(ai2.avgReturnPct) < 0.01, `short direction handled (avg ~0, got ${ai2.avgReturnPct.toFixed(2)})`);

console.log(failures === 0 ? '\nALL SHADOW-BOOK TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
