/**
 * entry_screen_test.ts — unit test for the weekend entry screen + daily tracker.
 * Run: ENV_FILE=.env.test npx ts-node test/entry_screen_test.ts
 */
import { ClosePoint } from '../src/server/signals/momentum';
import {
  maxClose,
  lastClose,
  athDistancePct,
  nearAth,
  detect123,
  screenEntry,
  trackDaily,
  uptrend,
  Candle,
  EntryScreenOptions,
} from '../src/server/signals/entryScreen';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

// Build a close series from an explicit list of closes (one per day).
function series(values: number[]): ClosePoint[] {
  const d = new Date('2024-01-01T00:00:00Z');
  return values.map((close, i) => {
    const dt = new Date(d);
    dt.setUTCDate(d.getUTCDate() + i);
    return { date: dt.toISOString().slice(0, 10), close };
  });
}

const OPTS: EntryScreenOptions = { dmaPeriod: 2, nearAthPct: 10 };

/* ------------------------------------------------------------------ */
/* ATH helpers                                                          */
/* ------------------------------------------------------------------ */

// 1. maxClose returns the highest close.
assert(maxClose(series([100, 110, 90])) === 110, 'maxClose = highest close');

// 2. lastClose returns the most recent close.
assert(lastClose(series([100, 110, 90])) === 90, 'lastClose = most recent close');

// 3. athDistancePct is the % distance of the last close from the ATH.
const dist = athDistancePct(series([100, 110, 90]));
assert(dist !== null && Math.abs(dist - (-18.1818)) < 0.01, `athDistancePct = (90-110)/110 (got ${dist?.toFixed(2)})`);

// 4. nearAth is true within pct% of the ATH, false beyond it.
assert(nearAth(series([100, 110, 105]), 10) === true, 'nearAth true within 10% of ATH');
assert(nearAth(series([100, 110, 90]), 10) === false, 'nearAth false beyond 10% of ATH');

/* ------------------------------------------------------------------ */
/* 1-2-3 pattern                                                        */
/* ------------------------------------------------------------------ */

// 5. Breakout: today's close is a new ATH (above the prior max).
assert(detect123(series([100, 90, 110])).state === 'breakout', 'new ATH → breakout');

// 6. Pullback: today's close is below the prior ATH.
assert(detect123(series([100, 110, 90])).state === 'pullback', 'below prior ATH → pullback');

// 7. At ATH: today's close equals the prior ATH.
assert(detect123(series([100, 100, 100])).state === 'at_ath', 'equal to prior ATH → at_ath');

// 8. Insufficient data → none.
assert(detect123(series([100])).state === 'none', 'single bar → none');

// 9. pullbackLow is the lowest close after the prior ATH.
const p = detect123(series([100, 110, 90, 95]));
assert(p.pullbackLow === 90, `pullbackLow = lowest close after the ATH (got ${p.pullbackLow})`);

/* ------------------------------------------------------------------ */
/* Weekend screen                                                       */
/* ------------------------------------------------------------------ */

// 10. Breakout verdict: above DMA + new ATH.
assert(screenEntry('X', series([100, 100, 110]), OPTS).verdict === 'breakout', 'above DMA + new ATH → breakout');

// 11. Near-ATH verdict: above DMA + within 10% of ATH (but not a new ATH).
assert(screenEntry('X', series([110, 105, 105]), OPTS).verdict === 'near_ath', 'above DMA + near ATH → near_ath');

// 12. Rejected: below the DMA.
assert(screenEntry('X', series([110, 100, 90]), OPTS).verdict === 'rejected', 'below DMA → rejected');

// 13. Rejected: above DMA but too far from the ATH.
assert(screenEntry('X', series([110, 90, 90]), OPTS).verdict === 'rejected', 'too far from ATH → rejected');

/* ------------------------------------------------------------------ */
/* Daily tracker                                                        */
/* ------------------------------------------------------------------ */

// 14. ENTER on a new ATH above the DMA.
assert(trackDaily(series([100, 100, 110]), OPTS) === 'ENTER', 'new ATH above DMA → ENTER');

// 15. EXIT when the close breaks below the DMA.
assert(trackDaily(series([110, 100, 90]), OPTS) === 'EXIT', 'close below DMA → EXIT');

// 16. HOLD otherwise (at ATH, not a breakout).
assert(trackDaily(series([100, 100, 100]), OPTS) === 'HOLD', 'no breakout, above DMA → HOLD');

// 17. HOLD on insufficient data (never act on a data gap).
assert(trackDaily(series([100]), OPTS) === 'HOLD', 'insufficient data → HOLD');

/* ------------------------------------------------------------------ */
/* Uptrend confirmation (higher highs/lows)                            */
/* ------------------------------------------------------------------ */

// Build OHLC candles from explicit rows.
function candles(rows: Array<{ o: number; h: number; l: number; c: number }>): Candle[] {
  const d = new Date('2024-01-01T00:00:00Z');
  return rows.map((r, i) => {
    const dt = new Date(d);
    dt.setUTCDate(d.getUTCDate() + i);
    return { date: dt.toISOString().slice(0, 10), open: r.o, high: r.h, low: r.l, close: r.c };
  });
}

// 18. uptrend (close-only): higher closes → true.
assert(uptrend(series([100, 101, 102]), 3) === true, 'higher closes → uptrend');

// 19. uptrend (close-only): a lower close breaks the trend.
assert(uptrend(series([100, 99, 102]), 3) === false, 'lower close breaks the uptrend');

// 20. uptrend (OHLC): higher highs AND higher lows → true.
const upCandles = candles([
  { o: 100, h: 102, l: 99, c: 101 },
  { o: 101, h: 104, l: 100, c: 103 },
  { o: 103, h: 106, l: 102, c: 105 },
]);
assert(uptrend(upCandles, 3) === true, 'higher highs + higher lows → uptrend');

// 21. uptrend (OHLC): a lower low breaks the trend even with higher highs.
const mixedCandles = candles([
  { o: 100, h: 102, l: 99, c: 101 },
  { o: 101, h: 104, l: 98, c: 103 },
  { o: 103, h: 106, l: 102, c: 105 },
]);
assert(uptrend(mixedCandles, 3) === false, 'lower low breaks the uptrend');

// 22. trackDaily with requireUptrend: a clean uptrend breakout → ENTER.
const upOpts: EntryScreenOptions = { dmaPeriod: 2, nearAthPct: 10, requireUptrend: true, uptrendWindow: 3 };
assert(trackDaily(series([100, 101, 102, 110]), upOpts) === 'ENTER', 'uptrend + breakout → ENTER');

// 23. trackDaily with requireUptrend: breakout without an uptrend → HOLD.
assert(trackDaily(series([100, 100, 110]), upOpts) === 'HOLD', 'breakout without uptrend → HOLD');

console.log(failures === 0 ? '\nALL ENTRY SCREEN TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
