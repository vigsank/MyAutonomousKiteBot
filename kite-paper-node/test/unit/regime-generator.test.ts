import { describe, it, expect } from '@jest/globals';
import { RandomWalkGenerator } from '../../src/market/random-walk-generator';

/** RSI(14) over a series of closes. */
function rsi(closes: number[], period = 14): number[] {
  const out: number[] = [];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    if (i <= period) {
      gain += g;
      loss += l;
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
    }
    if (i >= period) {
      const rs = loss === 0 ? 100 : gain / loss;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return out;
}

/** Bollinger lower band touches over a series of closes. */
function bollingerTouches(closes: number[], period = 20, mult = 2): number {
  let touches = 0;
  for (let i = period - 1; i < closes.length; i++) {
    const window = closes.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    if (closes[i] < mean - mult * sd) touches++;
  }
  return touches;
}

/** Aggregate ticks into bars (open/high/low/close). */
function toBars(ticks: Array<{ open: number; high: number; low: number; close: number }>, perBar: number) {
  const bars: number[] = [];
  for (let i = 0; i < ticks.length; i += perBar) {
    const chunk = ticks.slice(i, i + perBar);
    if (chunk.length === 0) continue;
    bars.push(chunk[chunk.length - 1].close);
  }
  return bars;
}

describe('Regime generator — realistic price action', () => {
  it('produces oversold stretches (RSI < 30) and Bollinger lower touches', () => {
    const gen = new RandomWalkGenerator({
      instrumentToken: 738561,
      basePrice: 2500,
      seed: 42,
      regimeSwitchBars: 1200,
    });

    const ticks: Array<{ open: number; high: number; low: number; close: number }> = [];
    for (let i = 0; i < 24000; i++) {
      const t = gen.generateTick();
      ticks.push({ open: t.ohlc.open, high: t.ohlc.high, low: t.ohlc.low, close: t.last_price });
    }

    const closes = toBars(ticks, 60); // 1-min bars
    const rsiVals = rsi(closes);
    const touches = bollingerTouches(closes);

    // The whole point: price must reach oversold and touch the lower band.
    expect(Math.min(...rsiVals)).toBeLessThan(30);
    expect(touches).toBeGreaterThan(0);
  });

  it('is reproducible with the same seed', () => {
    const a = new RandomWalkGenerator({ instrumentToken: 1, basePrice: 100, seed: 7 });
    const b = new RandomWalkGenerator({ instrumentToken: 1, basePrice: 100, seed: 7 });
    for (let i = 0; i < 500; i++) {
      expect(a.generateTick().last_price).toBe(b.generateTick().last_price);
    }
  });

  it('stays within circuit limits', () => {
    const gen = new RandomWalkGenerator({ instrumentToken: 1, basePrice: 100, seed: 3 });
    for (let i = 0; i < 5000; i++) {
      const p = gen.generateTick().last_price;
      expect(p).toBeGreaterThanOrEqual(100 * 0.9);
      expect(p).toBeLessThanOrEqual(100 * 1.1);
    }
  });
});
