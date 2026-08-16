/**
 * indicators_test.ts — unit test for the additional technical indicators (Phase C).
 * Run: ENV_FILE=.env.test npx ts-node test/indicators_test.ts
 */
import {
  computeMacd,
  computeStochastic,
  computeVwap,
  computeVolumeProfile,
  detectGap,
  computeEma,
} from '../src/server/TechnicalIndicators';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

// EMA: simple rising series.
const rising = Array.from({ length: 40 }, (_, i) => 100 + i);
const ema = computeEma(rising, 12);
assert(ema !== null && ema > 100, `EMA of rising series > 100 (got ${ema?.toFixed(2)})`);

// MACD.
const macd = computeMacd(rising);
assert(macd !== null && macd.macd > 0, `MACD of rising series > 0 (got ${macd?.macd.toFixed(3)})`);

// Stochastic: rising series → high %K.
const candles = rising.map((c, i) => ({ high: c + 1, low: c - 1, close: c }));
const stoch = computeStochastic(candles, 14);
assert(stoch !== null && stoch.k > 50, `Stochastic %K of rising series > 50 (got ${stoch?.k.toFixed(1)})`);

// VWAP.
const vwapCandles = candles.map((c) => ({ ...c, volume: 100 }));
const vwap = computeVwap(vwapCandles);
assert(vwap !== null && vwap > 100, `VWAP > 100 (got ${vwap?.toFixed(2)})`);

// Volume profile: point of control within range.
const vp = computeVolumeProfile(vwapCandles);
assert(vp !== null && vp.poc > 99 && vp.poc < 141, `Volume profile POC in range (got ${vp?.poc.toFixed(1)})`);

// Gap: open 2% above prev close.
const gap = detectGap(100, 102);
assert(gap !== null && Math.abs(gap - 2) < 0.01, `Gap up 2% (got ${gap?.toFixed(2)})`);
assert(detectGap(0, 100) === null, 'Gap with zero prev close returns null');

console.log(failures === 0 ? '\nALL INDICATOR TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
