/**
 * momentum_test.ts — unit test for the cross-sectional momentum signal.
 * Run: ENV_FILE=.env.test npx ts-node test/momentum_test.ts
 */
import {
  computeMomentum,
  rankByMomentum,
  topNByMomentum,
  selectWithHysteresis,
  averageDailyValue,
  applyLiquidityFloor,
  MomentumInput,
  MomentumScore,
} from '../src/server/signals/momentum';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

// Build a synthetic close series: 13 months of daily closes, rising ~1%/month.
function risingSeries(start: number, months: number): Array<{ date: string; close: number }> {
  const out: Array<{ date: string; close: number }> = [];
  let price = start;
  const d = new Date('2023-01-01T00:00:00Z');
  for (let m = 0; m < months; m++) {
    for (let day = 1; day <= 20; day++) {
      const date = new Date(d);
      date.setUTCMonth(d.getUTCMonth() + m);
      date.setUTCDate(day);
      out.push({ date: date.toISOString().slice(0, 10), close: price });
    }
    price *= 1.01; // +1% per month
  }
  return out;
}

// A flat series (no momentum).
function flatSeries(start: number, months: number): Array<{ date: string; close: number }> {
  const out: Array<{ date: string; close: number }> = [];
  const d = new Date('2023-01-01T00:00:00Z');
  for (let m = 0; m < months; m++) {
    for (let day = 1; day <= 20; day++) {
      const date = new Date(d);
      date.setUTCMonth(d.getUTCMonth() + m);
      date.setUTCDate(day);
      out.push({ date: date.toISOString().slice(0, 10), close: start });
    }
  }
  return out;
}

// 1. computeMomentum: rising series over 12-month lookback, skip 1.
const rising = risingSeries(100, 24);
const mom = computeMomentum(rising, 12, 1);
assert(mom !== null && mom > 0.1, `rising series has positive 12m momentum (got ${mom?.toFixed(3)})`);

// 2. computeMomentum: flat series ≈ 0.
const flat = flatSeries(100, 24);
const flatMom = computeMomentum(flat, 12, 1);
assert(flatMom !== null && Math.abs(flatMom) < 0.001, `flat series has ~0 momentum (got ${flatMom?.toFixed(4)})`);

// 3. computeMomentum: insufficient data → null.
assert(computeMomentum(rising.slice(0, 5), 12, 1) === null, 'insufficient data returns null');

// 4. rankByMomentum: rising ranks above flat.
const inputs: MomentumInput[] = [
  { symbol: 'RISER', closes: rising },
  { symbol: 'FLAT', closes: flat },
];
const ranked = rankByMomentum(inputs, 12, 1);
assert(ranked.length === 2, 'ranks both symbols');
assert(ranked[0].symbol === 'RISER', 'RISER ranks first');

// 5. topNByMomentum: returns top 1 = RISER.
const top = topNByMomentum(inputs, 12, 1, 1);
assert(top.length === 1 && top[0] === 'RISER', 'top 1 is RISER');

/* ------------------------------------------------------------------ */
/* Rank hysteresis                                                     */
/* ------------------------------------------------------------------ */

// A 12-name ranking, best first: R0 (rank 0) .. R11 (rank 11).
const board: MomentumScore[] = Array.from({ length: 12 }, (_, i) => ({
  symbol: `R${i}`,
  momentum: 1 - i * 0.05,
}));

// 6. band = 0 is exactly the old behaviour: pure top-N, holdings irrelevant.
assert(
  selectWithHysteresis(board, ['R9'], 3, 0).join(',') === 'R0,R1,R2',
  'band 0 ignores incumbents (unchanged top-N)',
);

// 7. An incumbent that slipped just outside topN keeps its slot inside the band.
//    R4 is rank 4 (outside top 3) but within topN(3) + band(4) = 7.
const sticky = selectWithHysteresis(board, ['R4'], 3, 4);
assert(sticky.includes('R4'), 'incumbent inside the band keeps its slot');
assert(sticky.length === 3, 'still holds exactly topN names');
assert(
  sticky.join(',') === 'R0,R1,R4',
  `remaining slots fill from the top (got ${sticky.join(',')})`,
);

// 8. An incumbent that fell outside the band is dropped.
const dropped = selectWithHysteresis(board, ['R9'], 3, 4);
assert(!dropped.includes('R9'), 'incumbent outside the band is replaced');
assert(dropped.join(',') === 'R0,R1,R2', 'replaced by the best available');

// 9. More survivors than slots: keep the best-ranked, drop the rest.
const crowded = selectWithHysteresis(board, ['R2', 'R3', 'R4', 'R5'], 3, 8);
assert(crowded.length === 3, 'never exceeds topN even when many incumbents survive');
assert(crowded.join(',') === 'R2,R3,R4', `keeps the best-ranked survivors (got ${crowded.join(',')})`);

// 10. Output is always in rank order, so diversification sees the weakest last.
const ordered = selectWithHysteresis(board, ['R6'], 4, 4);
const ranks = ordered.map((s) => board.findIndex((b) => b.symbol === s));
assert(
  ranks.every((r, i) => i === 0 || r > ranks[i - 1]),
  `output is in descending rank order (got ${ordered.join(',')})`,
);

// 11. An incumbent no longer in the ranking at all (delisted, data gap) is dropped.
assert(
  !selectWithHysteresis(board, ['GONE'], 3, 8).includes('GONE'),
  'unranked incumbent is dropped, not carried',
);

// 12. Degenerate inputs do not throw or over-allocate.
assert(selectWithHysteresis(board, [], 0, 8).length === 0, 'topN 0 selects nothing');
assert(selectWithHysteresis([], ['R0'], 3, 8).length === 0, 'empty ranking selects nothing');

/* ------------------------------------------------------------------ */
/* Liquidity floor (2.4)                                               */
/* ------------------------------------------------------------------ */

// A series with a constant ₹ turnover of price*volume per day.
function seriesWithValue(price: number, volume: number, days: number) {
  const out: Array<{ date: string; close: number; volume: number }> = [];
  const d = new Date('2024-01-01T00:00:00Z');
  for (let i = 0; i < days; i++) {
    const dt = new Date(d);
    dt.setUTCDate(d.getUTCDate() + i);
    out.push({ date: dt.toISOString().slice(0, 10), close: price, volume });
  }
  return out;
}

// 13. averageDailyValue computes price*volume averaged over the window.
const liquid = seriesWithValue(100, 10_000, 30); // ₹1,000,000/day
assert(
  averageDailyValue(liquid, 20) === 1_000_000,
  `ADV = price*volume (got ${averageDailyValue(liquid, 20)})`,
);

// 14. No volume anywhere → null (unknown, not zero).
assert(averageDailyValue(rising, 20) === null, 'ADV is null when volume is absent');

// 15. applyLiquidityFloor drops thin names, keeps liquid ones.
const thin = seriesWithValue(10, 100, 30); // ₹1,000/day
const floorInputs: MomentumInput[] = [
  { symbol: 'LIQUID', closes: liquid },
  { symbol: 'THIN', closes: thin },
];
const floored = applyLiquidityFloor(floorInputs, 500_000, 20);
assert(floored.kept.map((i) => i.symbol).join(',') === 'LIQUID', 'floor keeps only the liquid name');
assert(floored.droppedForLiquidity.join(',') === 'THIN', 'floor reports the dropped name');

// 16. Floor of 0 is a no-op.
assert(
  applyLiquidityFloor(floorInputs, 0, 20).kept.length === 2,
  'floor 0 keeps everything (disabled)',
);

// 17. Fail-open: a symbol with no volume data is kept, never silently dropped.
const noVol: MomentumInput = { symbol: 'NOVOL', closes: rising };
const failOpen = applyLiquidityFloor([noVol, { symbol: 'THIN', closes: thin }], 500_000, 20);
assert(
  failOpen.kept.some((i) => i.symbol === 'NOVOL'),
  'symbol without volume data is kept (fail-open)',
);

console.log(failures === 0 ? '\nALL MOMENTUM TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
