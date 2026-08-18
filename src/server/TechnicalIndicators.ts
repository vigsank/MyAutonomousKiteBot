/**
 * TechnicalIndicators — pure, deterministic technical math for the Execution
 * layer. These are computed in Node (never by the LLM) and passed to the LLM
 * as numeric context, per the division-of-responsibility principle.
 */

export interface PivotLevels {
  pivot: number;
  r1: number;
  r2: number;
  s1: number;
  s2: number;
}

export interface SupportResistance {
  support: number;
  resistance: number;
}

/** Classic floor-trader pivot points from the previous day's OHLC. */
export function computePivots(high: number, low: number, close: number): PivotLevels {
  const pivot = (high + low + close) / 3;
  return {
    pivot,
    r1: 2 * pivot - low,
    r2: pivot + (high - low),
    s1: 2 * pivot - high,
    s2: pivot - (high - low),
  };
}

/** Simple moving average of the last `period` closes. Returns null if insufficient. */
export function computeSma(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  return window.reduce((s, v) => s + v, 0) / period;
}

/**
 * 7-day support & resistance zones from recent daily candles.
 * Support = the lowest low, resistance = the highest high, over the window.
 */
export function computeSupportResistance(
  candles: Array<{ high: number; low: number }>,
  period = 7,
): SupportResistance | null {
  if (candles.length === 0) return null;
  const window = candles.slice(-period);
  let support = Infinity;
  let resistance = -Infinity;
  for (const c of window) {
    if (c.low < support) support = c.low;
    if (c.high > resistance) resistance = c.high;
  }
  if (!Number.isFinite(support) || !Number.isFinite(resistance)) return null;
  return { support, resistance };
}

/** Exponential moving average of the last `period` closes. Returns null if insufficient. */
export function computeEma(closes: number[], period: number): number | null {
  if (closes.length < period || period <= 0) return null;
  const k = 2 / (period + 1);
  // Seed with the SMA of the first `period` values.
  const seed = closes.slice(0, period).reduce((s, v) => s + v, 0) / period;
  let ema = seed;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

/** MACD line, signal line and histogram from a close series (12/26/9). */
export function computeMacd(
  closes: number[],
): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < 35) return null;
  const emaFast = computeEma(closes, 12);
  const emaSlow = computeEma(closes, 26);
  if (emaFast === null || emaSlow === null) return null;
  // Signal is the 9-EMA of the MACD line; approximate from the current legs.
  const macd = emaFast - emaSlow;
  const signal = computeEma(macdSeries(closes), 9);
  if (signal === null) return null;
  return { macd, signal, histogram: macd - signal };
}

/** Running MACD line series used to derive the 9-EMA signal line. */
function macdSeries(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 26; i < closes.length; i++) {
    const slice = closes.slice(0, i + 1);
    const f = computeEma(slice, 12);
    const s = computeEma(slice, 26);
    if (f !== null && s !== null) out.push(f - s);
  }
  return out;
}

/** Stochastic oscillator %K and %D (14-period). */
export function computeStochastic(
  candles: Array<{ high: number; low: number; close: number }>,
  period = 14,
): { k: number; d: number } | null {
  if (candles.length < period) return null;
  const kValues: number[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1);
    const high = Math.max(...window.map((c) => c.high));
    const low = Math.min(...window.map((c) => c.low));
    const close = candles[i].close;
    if (high === low) {
      kValues.push(50);
    } else {
      kValues.push(((close - low) / (high - low)) * 100);
    }
  }
  const k = kValues[kValues.length - 1];
  const d =
    kValues.length >= 3
      ? kValues.slice(-3).reduce((s, v) => s + v, 0) / 3
      : kValues.reduce((s, v) => s + v, 0) / kValues.length;
  return { k, d };
}

/** Volume-weighted average price over the candles (needs volume). */
export function computeVwap(
  candles: Array<{ high: number; low: number; close: number; volume: number }>,
): number | null {
  let pv = 0;
  let vol = 0;
  for (const c of candles) {
    if (c.volume <= 0) continue;
    const typical = (c.high + c.low + c.close) / 3;
    pv += typical * c.volume;
    vol += c.volume;
  }
  return vol > 0 ? pv / vol : null;
}

/** Volume profile — price level (POC) with the most traded volume, plus a value area. */
export function computeVolumeProfile(
  candles: Array<{ high: number; low: number; close: number; volume: number }>,
  bins = 12,
): { poc: number; valueAreaLow: number; valueAreaHigh: number } | null {
  if (candles.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return { poc: (min + max) / 2, valueAreaLow: min, valueAreaHigh: max };
  }
  const width = (max - min) / bins;
  const volByBin = new Array<number>(bins).fill(0);
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    const idx = Math.min(bins - 1, Math.floor((typical - min) / width));
    if (idx >= 0) volByBin[idx] += c.volume;
  }
  let pocIdx = 0;
  for (let i = 1; i < bins; i++) if (volByBin[i] > volByBin[pocIdx]) pocIdx = i;
  const poc = min + width * (pocIdx + 0.5);
  return { poc, valueAreaLow: min, valueAreaHigh: max };
}

/** % gap between previous close and open; null when prev close is zero. */
export function detectGap(prevClose: number, open: number): number | null {
  if (prevClose === 0) return null;
  return ((open - prevClose) / prevClose) * 100;
}

/**
 * Volatility-adjusted Kelly position sizing.
 *
 * Kelly fraction f = p - (1-p)/b, where p = win probability (from the LLM
 * confidence / signal confidence) and b = win/loss ratio (reward:risk). The
 * result is scaled by a fraction of the Kelly fraction (fractional Kelly, safer
 * than full Kelly) and bounded by the caller's hard caps.
 *
 * Returns the fraction of available capital to deploy (0..1).
 */
export function kellyFraction(
  winProbability: number,
  rewardRiskRatio: number,
  kellyScale = 0.5,
): number {
  if (winProbability <= 0 || winProbability >= 1) return 0;
  if (rewardRiskRatio <= 0) return 0;
  const f = winProbability - (1 - winProbability) / rewardRiskRatio;
  if (f <= 0) return 0;
  return Math.min(1, f * kellyScale);
}
