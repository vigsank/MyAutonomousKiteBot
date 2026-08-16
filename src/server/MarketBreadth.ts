/**
 * MarketBreadth — price-based market breadth from the watchlist (B6).
 *
 * Computes advance/decline and new 20-day highs/lows across the universe, giving
 * a risk-on / risk-off read that complements the news sentiment. Pure,
 * deterministic, no I/O.
 */
import { ClosePoint } from './signals/momentum';

export interface MarketBreadth {
  advancing: number;
  declining: number;
  unchanged: number;
  /** (advancing - declining) / total, in [-1, 1]. */
  breadth: number;
  newHighs: number;
  newLows: number;
  label: 'risk-on' | 'risk-off' | 'neutral';
}

/** Compute market breadth from each symbol's daily closes (chronological). */
export function computeMarketBreadth(closesBySymbol: Map<string, ClosePoint[]>): MarketBreadth {
  let advancing = 0;
  let declining = 0;
  let unchanged = 0;
  let newHighs = 0;
  let newLows = 0;
  let total = 0;

  for (const pts of closesBySymbol.values()) {
    const sorted = [...pts].sort((a, b) => (a.date < b.date ? -1 : 1));
    if (sorted.length < 2) continue;
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    total++;

    if (last.close > prev.close) advancing++;
    else if (last.close < prev.close) declining++;
    else unchanged++;

    // New 20-day high/low.
    const window = sorted.slice(-20);
    const high = Math.max(...window.map((p) => p.close));
    const low = Math.min(...window.map((p) => p.close));
    if (last.close >= high) newHighs++;
    if (last.close <= low) newLows++;
  }

  const breadth = total > 0 ? (advancing - declining) / total : 0;
  const label: MarketBreadth['label'] =
    breadth > 0.2 ? 'risk-on' : breadth < -0.2 ? 'risk-off' : 'neutral';

  return { advancing, declining, unchanged, breadth, newHighs, newLows, label };
}
