/**
 * signals/momentum.ts — cross-sectional momentum / relative-strength signal.
 *
 * The validated edge (Initiative 0): rank NSE symbols by trailing 12-month
 * momentum (skipping the most recent month to avoid short-term reversal) and
 * long the top 4–6, rebalanced monthly. On real Yahoo data over 4 years this
 * produced ~+15% annualized net of costs with ~59% positive months.
 *
 * Pure, deterministic, unit-testable. No I/O.
 */

/** A single close observation. */
export interface ClosePoint {
  date: string; // YYYY-MM-DD
  close: number;
  /**
   * Optional traded volume (shares) for the day. When present, enables the
   * liquidity floor (2.4). Absent in older cached series and in tests that only
   * care about price, so every consumer must treat it as optional.
   */
  volume?: number;
}

/** A symbol's daily close series (chronological). */
export interface MomentumInput {
  symbol: string;
  closes: ClosePoint[];
}

/** A symbol with its computed momentum score. */
export interface MomentumScore {
  symbol: string;
  momentum: number;
}

/**
 * Compute the momentum of a close series over [now - lookback - skip, now - skip]
 * months. Returns the fractional return, or null if insufficient data.
 */
export function computeMomentum(
  closes: ClosePoint[],
  lookbackMonths: number,
  skipMonths: number,
): number | null {
  if (closes.length < 2) return null;
  const sorted = [...closes].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = sorted[sorted.length - 1].date;
  const skipDate = addMonths(last, -skipMonths);
  const lookbackDate = addMonths(last, -(lookbackMonths + skipMonths));

  const end = closeOnOrBefore(sorted, skipDate);
  const start = closeOnOrBefore(sorted, lookbackDate);
  if (start === null || end === null || start <= 0) return null;
  return end / start - 1;
}

/**
 * Rank symbols by momentum (descending). Symbols with insufficient data are
 * excluded.
 */
export function rankByMomentum(
  inputs: MomentumInput[],
  lookbackMonths: number,
  skipMonths: number,
): MomentumScore[] {
  const scored: MomentumScore[] = [];
  for (const input of inputs) {
    const momentum = computeMomentum(input.closes, lookbackMonths, skipMonths);
    if (momentum !== null) {
      scored.push({ symbol: input.symbol, momentum });
    }
  }
  return scored.sort((a, b) => b.momentum - a.momentum);
}

/** The top `n` symbols by momentum. */
export function topNByMomentum(
  inputs: MomentumInput[],
  lookbackMonths: number,
  skipMonths: number,
  n: number,
): string[] {
  return rankByMomentum(inputs, lookbackMonths, skipMonths)
    .slice(0, n)
    .map((s) => s.symbol);
}

/**
 * Select the target book with rank hysteresis.
 *
 * Without hysteresis a name slipping from rank 6 to rank 7 triggers a full
 * round trip — paying ~0.31% and resetting the holding-period clock — for a
 * rank change that carries almost no information. With a band, an incumbent
 * keeps its slot until it falls out of the top `topN + band`; only then is it
 * replaced. New entrants are still taken strictly from the top of the ranking,
 * so the signal itself is unchanged: the band only makes it *sticky*.
 *
 * Validated out-of-sample (`npm run validate:momentum`, 48 OOS months over 8
 * non-overlapping windows): the band is chosen on the training window only, yet
 * 6 of 8 windows chose a band > 0 (mode 8), lifting annualized net return from
 * 21.66% to 36.99% and positive months from 58% to 65%. Without it the
 * unconstrained sweep does not pass the gate at all.
 *
 * @param ranked  Symbols in descending momentum order.
 * @param held    Symbols currently in the book (the incumbents).
 * @param topN    Number of slots.
 * @param band    Extra ranks an incumbent may slip before losing its slot.
 * @returns       Up to `topN` symbols, in descending rank order.
 */
export function selectWithHysteresis(
  ranked: MomentumScore[],
  held: Iterable<string>,
  topN: number,
  band: number,
): string[] {
  if (topN <= 0) return [];
  if (band <= 0) return ranked.slice(0, topN).map((s) => s.symbol);

  const rankOf = new Map<string, number>();
  ranked.forEach((s, i) => rankOf.set(s.symbol, i));

  const chosen = new Set<string>();
  // Incumbents keep their slot while they remain inside the wider band.
  for (const symbol of held) {
    const r = rankOf.get(symbol);
    if (r !== undefined && r < topN + band) chosen.add(symbol);
  }
  // Fill whatever slots remain from the top of the ranking.
  for (const s of ranked) {
    if (chosen.size >= topN) break;
    chosen.add(s.symbol);
  }

  // More incumbents survived than there are slots: keep the best-ranked. Always
  // return in rank order so downstream (diversification) sees the weakest last.
  return [...chosen]
    .sort((a, b) => (rankOf.get(a) ?? Infinity) - (rankOf.get(b) ?? Infinity))
    .slice(0, topN);
}

/** Add months to a YYYY-MM-DD date string. */
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Average daily traded value (₹) over the last `days` observations that carry a
 * volume, or null when volume is unavailable. This is the standard liquidity
 * proxy: price × shares traded, averaged. A cross-sectional momentum book buys
 * winners, and thin winners are exactly the ones that cannot be exited without
 * moving the price against you — so this gates the universe, not the signal.
 */
export function averageDailyValue(closes: ClosePoint[], days: number): number | null {
  const withVol = closes.filter((c) => typeof c.volume === 'number' && c.volume! > 0);
  if (withVol.length === 0) return null;
  const window = withVol.slice(-days);
  const sum = window.reduce((s, c) => s + c.close * (c.volume ?? 0), 0);
  return sum / window.length;
}

/**
 * Filter an input list to symbols whose average daily traded value clears
 * `floorInr` over the trailing `days` window (2.4 liquidity floor).
 *
 * Symbols with NO volume data are kept (fail-open): the floor must never silently
 * empty the universe just because a data source omitted volume. When `floorInr`
 * is 0 the filter is a no-op, so it is safe to leave wired even when disabled.
 */
export function applyLiquidityFloor(
  inputs: MomentumInput[],
  floorInr: number,
  days: number,
): { kept: MomentumInput[]; droppedForLiquidity: string[] } {
  if (floorInr <= 0) return { kept: inputs, droppedForLiquidity: [] };
  const kept: MomentumInput[] = [];
  const dropped: string[] = [];
  for (const input of inputs) {
    const adv = averageDailyValue(input.closes, days);
    if (adv === null || adv >= floorInr) kept.push(input);
    else dropped.push(input.symbol);
  }
  return { kept, droppedForLiquidity: dropped };
}

/** Close on or before a date, or null. */
function closeOnOrBefore(sorted: ClosePoint[], date: string): number | null {
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].date <= date) return sorted[i].close;
  }
  return null;
}
