/**
 * Tax.ts — Indian capital-gains tax on realized equity gains.
 *
 * WHY THIS EXISTS
 * Every P&L number this bot produced before now was pre-tax. For a strategy
 * that rebalances monthly and therefore realizes almost everything short-term,
 * that overstates take-home by roughly a fifth — a bigger effect than most of
 * the strategy improvements we spend time on. Worse, it hides a real decision:
 * a lower-gross, lower-turnover strategy can take home MORE than a
 * higher-gross, high-turnover one, because more of its gains cross the
 * 12-month line into the lower long-term rate. That trade-off is invisible
 * until tax is modelled.
 *
 * WHAT IT MODELS (and what it deliberately does not)
 *  - Short-term capital gains: holdings held < 12 months, taxed at 20%
 *    (rate effective 23-Jul-2024).
 *  - Long-term capital gains: holdings held >= 12 months, taxed at 12.5% on
 *    the amount above a ₹1,25,000 annual exemption.
 *  - Losses net against gains within the same financial year, including
 *    across the short/long buckets.
 *
 * Deliberately NOT modelled: carry-forward of losses into future years,
 * surcharge and cess, set-off ordering rules that minimise liability, and any
 * income outside this book. This is an accrual estimate for honest reporting
 * and cadence comparison — it is not tax advice and not a filing.
 *
 * Pure and deterministic. No I/O, no clock, no config lookups.
 */

/** Statutory rates and thresholds. Overridable so a rate change is config, not code. */
export interface TaxRates {
  /** Short-term capital gains rate (fraction, e.g. 0.20). */
  stcgRate: number;
  /** Long-term capital gains rate (fraction, e.g. 0.125). */
  ltcgRate: number;
  /** Annual LTCG exemption in rupees. */
  ltcgExemption: number;
  /** Months a holding must be held to qualify as long-term. */
  longTermMonths: number;
}

export const DEFAULT_TAX_RATES: TaxRates = {
  stcgRate: 0.2,
  ltcgRate: 0.125,
  ltcgExemption: 125_000,
  longTermMonths: 12,
};

/** Realized gains for a period, split by holding period. Either may be negative. */
export interface RealizedGains {
  stcg: number;
  ltcg: number;
}

export interface TaxEstimate extends RealizedGains {
  /** Financial year the gains fall in, e.g. "2025-2026". */
  financialYear: string;
  /** Short-term gains after netting losses across buckets. */
  netStcg: number;
  /** Long-term gains after netting losses across buckets. */
  netLtcg: number;
  /** Estimated tax owed. Never negative. */
  tax: number;
  /** Realized gains minus estimated tax. */
  afterTax: number;
}

/**
 * India's financial year (1 April – 31 March) containing `dateISO`.
 *
 * Matters because both the LTCG exemption and loss netting are annual, and the
 * Indian year boundary is April — using the calendar year would misstate the
 * liability for every trade in January–March.
 *
 * @param dateISO any ISO date string; only the leading YYYY-MM is read.
 */
export function financialYear(dateISO: string): string {
  const year = Number(dateISO.slice(0, 4));
  const month = Number(dateISO.slice(5, 7));
  return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

/** Inclusive [start, end) UTC bounds of a financial year, for SQL range queries. */
export function financialYearBounds(fy: string): { startISO: string; endISO: string } {
  const startYear = Number(fy.split('-')[0]);
  return {
    startISO: `${startYear}-04-01T00:00:00.000Z`,
    endISO: `${startYear + 1}-04-01T00:00:00.000Z`,
  };
}

/** Whole months between two ISO dates (calendar months, day-of-month aware). */
export function monthsHeld(entryISO: string, exitISO: string): number {
  const entry = new Date(entryISO);
  const exit = new Date(exitISO);
  if (Number.isNaN(entry.getTime()) || Number.isNaN(exit.getTime())) return 0;
  let months =
    (exit.getUTCFullYear() - entry.getUTCFullYear()) * 12 +
    (exit.getUTCMonth() - entry.getUTCMonth());
  // Not a full month until the day-of-month is reached.
  if (exit.getUTCDate() < entry.getUTCDate()) months--;
  return Math.max(0, months);
}

/** Whether a holding qualifies for the long-term rate. */
export function isLongTerm(
  entryISO: string,
  exitISO: string,
  rates: TaxRates = DEFAULT_TAX_RATES,
): boolean {
  return monthsHeld(entryISO, exitISO) >= rates.longTermMonths;
}

/**
 * Estimate tax on a financial year's realized gains.
 *
 * Losses in one bucket offset gains in the other before rates are applied,
 * which is why a loss-making month can legitimately REDUCE the year's accrued
 * liability rather than leaving it unchanged.
 */
export function estimateTax(
  gains: RealizedGains,
  financialYearLabel: string,
  rates: TaxRates = DEFAULT_TAX_RATES,
): TaxEstimate {
  let st = gains.stcg;
  let lt = gains.ltcg;

  // A loss in one bucket offsets a gain in the other.
  if (st < 0 && lt > 0) {
    const offset = Math.min(-st, lt);
    lt -= offset;
    st += offset;
  } else if (lt < 0 && st > 0) {
    const offset = Math.min(-lt, st);
    st -= offset;
    lt += offset;
  }

  const stcgTax = st > 0 ? st * rates.stcgRate : 0;
  const ltcgTax = lt > rates.ltcgExemption ? (lt - rates.ltcgExemption) * rates.ltcgRate : 0;
  const tax = stcgTax + ltcgTax;

  return {
    ...gains,
    financialYear: financialYearLabel,
    netStcg: st,
    netLtcg: lt,
    tax,
    afterTax: gains.stcg + gains.ltcg - tax,
  };
}

/**
 * Split a list of closed lots into short- and long-term realized gains.
 *
 * @param lots closed positions with entry/exit timestamps and realized P&L.
 */
export function bucketRealizedGains(
  lots: Array<{ entryISO: string; exitISO: string; pnl: number }>,
  rates: TaxRates = DEFAULT_TAX_RATES,
): RealizedGains {
  let stcg = 0;
  let ltcg = 0;
  for (const lot of lots) {
    if (!Number.isFinite(lot.pnl)) continue;
    if (isLongTerm(lot.entryISO, lot.exitISO, rates)) ltcg += lot.pnl;
    else stcg += lot.pnl;
  }
  return { stcg, ltcg };
}
