/**
 * signals/entryScreen.ts — the master-class weekend entry screen + daily DMA
 * tracker, as pure, deterministic, unit-testable functions.
 *
 * FinViz is US-only, so the universe is the user's Nifty-100 weekend pick
 * (data/watchlist.json). This module does the screening + tracking the class
 * does by hand:
 *
 *   - 200/220-DMA guard (reuses `sma` from signals/momentum.ts)
 *   - near-ATH (close within N% of the all-time high)
 *   - the 1-2-3 pattern (ATH → pullback low → break above the prior ATH)
 *   - the daily tracker (recompute the DMA, ENTER on breakout, EXIT below it)
 *
 * No I/O. Close-only series are supported; the OHLC candle-action refinement
 * (higher-highs / higher-lows) is a documented follow-up — see `Candle`.
 */

import { ClosePoint, sma } from './momentum';

/** A single OHLC candle. Close-only series degrade gracefully (o/h/l optional). */
export interface Candle {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

/** The 1-2-3 pattern state. */
export type PatternState = 'none' | 'at_ath' | 'pullback' | 'breakout';

export interface Pattern123 {
  state: PatternState;
  /** The prior all-time high (point 1) — max close excluding the last bar. */
  ath: number | null;
  /** The lowest close after the prior ATH (point 2). */
  pullbackLow: number | null;
  /** The latest close (point 3 candidate). */
  last: number | null;
}

export interface EntryScreenOptions {
  /** SMA period for the DMA guard (220 = the class's guard/stop). */
  dmaPeriod: number;
  /** A name is "near ATH" when its close is within this % of the ATH. */
  nearAthPct: number;
  /** When true, ENTER also requires an uptrend (higher highs/lows). */
  requireUptrend?: boolean;
  /** Number of bars for the uptrend check (default 3). */
  uptrendWindow?: number;
}

export type ScreenVerdict = 'breakout' | 'near_ath' | 'rejected';

export interface ScreenResult {
  symbol: string;
  verdict: ScreenVerdict;
  reasons: string[];
  pattern: Pattern123;
  /** Distance of the latest close from the ATH, in % (positive = above). */
  athDistancePct: number | null;
  /** The DMA value, or null when insufficient data. */
  dma: number | null;
  /** True when the latest close is at/above the DMA (uptrend guard). */
  aboveDma: boolean;
}

/** The maximum close over the series (the all-time-high proxy). */
export function maxClose(closes: ClosePoint[]): number | null {
  if (closes.length === 0) return null;
  let max = -Infinity;
  for (const c of closes) if (c.close > max) max = c.close;
  return max;
}

/** The latest close, or null. */
export function lastClose(closes: ClosePoint[]): number | null {
  if (closes.length === 0) return null;
  const sorted = [...closes].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted[sorted.length - 1].close;
}

/** Distance of the latest close from the ATH, in % (positive = above ATH). */
export function athDistancePct(closes: ClosePoint[]): number | null {
  const ath = maxClose(closes);
  const last = lastClose(closes);
  if (ath === null || last === null || ath <= 0) return null;
  return ((last - ath) / ath) * 100;
}

/** True when the latest close is within `pct`% of the ATH (at or above -pct). */
export function nearAth(closes: ClosePoint[], pct: number): boolean {
  const d = athDistancePct(closes);
  if (d === null) return false;
  return d >= -pct;
}

/**
 * Detect the 1-2-3 pattern: a prior all-time high (point 1), a pullback low
 * after it (point 2), and a break above that prior high (point 3).
 *
 * The "prior ATH" is the max close over all but the last bar, so a breakout is
 * simply "today's close is a new all-time high". This is the clean, testable
 * encoding of the class's "ATH → low → break previous ATH" rule; a
 * minimum-pullback-depth refinement is a documented follow-up.
 */
export function detect123(closes: ClosePoint[]): Pattern123 {
  if (closes.length < 2) return { state: 'none', ath: null, pullbackLow: null, last: null };
  const sorted = [...closes].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = sorted[sorted.length - 1].close;
  let priorAth = -Infinity;
  let priorAthIdx = -1;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].close > priorAth) {
      priorAth = sorted[i].close;
      priorAthIdx = i;
    }
  }
  let pullbackLow = Infinity;
  for (let i = priorAthIdx; i < sorted.length; i++) {
    if (sorted[i].close < pullbackLow) pullbackLow = sorted[i].close;
  }
  const result: Pattern123 = {
    state: 'none',
    ath: priorAth === -Infinity ? null : priorAth,
    pullbackLow: pullbackLow === Infinity ? null : pullbackLow,
    last,
  };
  if (result.ath === null) return result;
  if (last > priorAth) result.state = 'breakout';
  else if (last < priorAth) result.state = 'pullback';
  else result.state = 'at_ath';
  return result;
}

/**
 * Screen a single symbol for entry. Verdict:
 *   - 'breakout' : above the DMA AND a new ATH (1-2-3 completed).
 *   - 'near_ath' : above the DMA AND within nearAthPct% of the ATH.
 *   - 'rejected' : below the DMA, or too far from the ATH.
 */
export function screenEntry(
  symbol: string,
  closes: ClosePoint[],
  opts: EntryScreenOptions,
): ScreenResult {
  const reasons: string[] = [];
  const dma = sma(closes, opts.dmaPeriod);
  const last = lastClose(closes);
  const aboveDma = dma !== null && last !== null && last >= dma;
  const pattern = detect123(closes);
  const dist = athDistancePct(closes);

  if (!aboveDma) reasons.push('below DMA');
  if (dist !== null && dist < -opts.nearAthPct) reasons.push(`too far from ATH (${dist.toFixed(1)}%)`);

  let verdict: ScreenVerdict;
  if (aboveDma && pattern.state === 'breakout') verdict = 'breakout';
  else if (aboveDma && dist !== null && dist >= -opts.nearAthPct) verdict = 'near_ath';
  else verdict = 'rejected';

  return { symbol, verdict, reasons, pattern, athDistancePct: dist, dma, aboveDma };
}

/** The daily tracker signal. */
export type TrackerSignal = 'ENTER' | 'HOLD' | 'EXIT';

/**
 * True when the last `n` bars are making higher highs AND higher lows (an
 * uptrend). Uses high/low when present; falls back to close for close-only
 * series, so "higher highs" degrades to "higher closes". This is the class's
 * "check candle movements" confirmation for a breakout.
 */
export function uptrend(candles: Candle[], n: number): boolean {
  if (n < 2 || candles.length < n) return false;
  const sorted = [...candles].sort((a, b) => (a.date < b.date ? -1 : 1));
  const window = sorted.slice(-n);
  for (let i = 1; i < window.length; i++) {
    const prevHigh = window[i - 1].high ?? window[i - 1].close;
    const prevLow = window[i - 1].low ?? window[i - 1].close;
    const curHigh = window[i].high ?? window[i].close;
    const curLow = window[i].low ?? window[i].close;
    if (curHigh <= prevHigh || curLow <= prevLow) return false;
  }
  return true;
}

/**
 * Daily tracker: recompute the DMA and decide.
 *   - EXIT  when the close breaks below the DMA (the class's stop rule).
 *   - ENTER when the close is a new ATH above the DMA (1-2-3 breakout),
 *          optionally confirmed by an uptrend (higher highs/lows).
 *   - HOLD  otherwise.
 * Insufficient data → HOLD (never act on a data gap).
 */
export function trackDaily(candles: Candle[], opts: EntryScreenOptions): TrackerSignal {
  const dma = sma(candles, opts.dmaPeriod);
  const last = lastClose(candles);
  if (dma === null || last === null) return 'HOLD';
  if (last < dma) return 'EXIT';
  if (detect123(candles).state === 'breakout') {
    if (opts.requireUptrend && !uptrend(candles, opts.uptrendWindow ?? 3)) return 'HOLD';
    return 'ENTER';
  }
  return 'HOLD';
}
