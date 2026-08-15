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
