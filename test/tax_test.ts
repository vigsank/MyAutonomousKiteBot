/**
 * tax_test.ts — unit test for the Indian capital-gains tax model (Phase 3.1).
 *
 * These assertions exist because every number the bot reported before this was
 * pre-tax, and a ~20% haircut on the whole return is larger than most of the
 * strategy improvements we spend effort on. Getting the netting and the
 * financial-year boundary right is what makes the monthly-vs-quarterly cadence
 * question answerable.
 *
 * Run: ENV_FILE=.env.test npx ts-node test/tax_test.ts
 */
import {
  DEFAULT_TAX_RATES,
  bucketRealizedGains,
  estimateTax,
  financialYear,
  financialYearBounds,
  isLongTerm,
  monthsHeld,
} from '../src/server/Tax';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}
function near(a: number, b: number, tol = 0.01): boolean {
  return Math.abs(a - b) <= tol;
}

/* ------------------------------------------------------------------ */
/* Financial year                                                      */
/* ------------------------------------------------------------------ */
console.log('\n--- financial year (April–March) ---');

assert(financialYear('2025-04-01') === '2025-2026', 'April 1 starts a new financial year');
assert(financialYear('2026-03-31') === '2025-2026', 'March 31 is still the same financial year');
assert(financialYear('2026-04-01') === '2026-2027', 'the next April rolls the year over');
// The trap this guards: using the calendar year would push every Jan–Mar trade
// into the wrong year, misstating both the exemption and the loss netting.
assert(financialYear('2026-01-15') === '2025-2026', 'January belongs to the PREVIOUS financial year');

{
  const { startISO, endISO } = financialYearBounds('2025-2026');
  assert(startISO.startsWith('2025-04-01'), 'FY bounds start on 1 April');
  assert(endISO.startsWith('2026-04-01'), 'FY bounds end on the following 1 April');
}

/* ------------------------------------------------------------------ */
/* Holding period                                                      */
/* ------------------------------------------------------------------ */
console.log('\n--- holding period ---');

assert(monthsHeld('2025-01-15T00:00:00Z', '2025-04-15T00:00:00Z') === 3, 'three whole months');
assert(
  monthsHeld('2025-01-15T00:00:00Z', '2025-04-14T00:00:00Z') === 2,
  'one day short of the third month does not count it',
);
assert(
  isLongTerm('2024-01-15T00:00:00Z', '2025-01-15T00:00:00Z'),
  'exactly 12 months qualifies as long-term',
);
assert(
  !isLongTerm('2024-01-15T00:00:00Z', '2025-01-14T00:00:00Z'),
  'one day short of 12 months is short-term',
);
assert(!isLongTerm('2025-01-15T00:00:00Z', '2025-02-15T00:00:00Z'), 'a monthly rebalance is short-term');

/* ------------------------------------------------------------------ */
/* Tax estimation                                                      */
/* ------------------------------------------------------------------ */
console.log('\n--- tax estimation ---');

// Pure short-term: a flat 20%.
{
  const t = estimateTax({ stcg: 100_000, ltcg: 0 }, '2025-2026');
  assert(near(t.tax, 20_000), `₹1L short-term gain owes ₹20,000 (got ${t.tax.toFixed(0)})`);
  assert(near(t.afterTax, 80_000), 'after-tax is the gain minus the tax');
}

// Long-term below the exemption: nothing owed.
{
  const t = estimateTax({ stcg: 0, ltcg: 100_000 }, '2025-2026');
  assert(t.tax === 0, '₹1L long-term gain is fully covered by the ₹1.25L exemption');
}

// Long-term above the exemption: only the excess is taxed.
{
  const t = estimateTax({ stcg: 0, ltcg: 225_000 }, '2025-2026');
  assert(near(t.tax, 12_500), `only the ₹1L above the exemption is taxed (got ${t.tax.toFixed(0)})`);
}

// THE POINT OF THE WHOLE MODULE: identical gross, different holding period,
// materially different take-home. This is what makes the cadence question real.
{
  const short = estimateTax({ stcg: 300_000, ltcg: 0 }, '2025-2026');
  const long = estimateTax({ stcg: 0, ltcg: 300_000 }, '2025-2026');
  assert(near(short.tax, 60_000), 'a ₹3L short-term year owes ₹60,000');
  assert(near(long.tax, 21_875), 'the same ₹3L held long-term owes ₹21,875');
  assert(
    long.afterTax - short.afterTax > 38_000,
    `holding past 12 months is worth ₹${(long.afterTax - short.afterTax).toFixed(0)} on ₹3L`,
  );
}

// Losses net against gains — including across buckets.
{
  const t = estimateTax({ stcg: -50_000, ltcg: 200_000 }, '2025-2026');
  // -50k short offsets long down to 150k, of which only 25k exceeds the exemption.
  assert(near(t.netLtcg, 150_000), 'a short-term loss offsets a long-term gain');
  assert(near(t.tax, 3_125), `netted liability is ₹3,125 (got ${t.tax.toFixed(0)})`);
}
{
  const t = estimateTax({ stcg: 200_000, ltcg: -50_000 }, '2025-2026');
  assert(near(t.netStcg, 150_000), 'a long-term loss offsets a short-term gain');
  assert(near(t.tax, 30_000), 'netted short-term liability is ₹30,000');
}

// A losing year owes nothing and must never produce a negative liability.
{
  const t = estimateTax({ stcg: -80_000, ltcg: -20_000 }, '2025-2026');
  assert(t.tax === 0, 'a losing year owes no tax');
  assert(t.afterTax === -100_000, 'after-tax equals the loss (no phantom refund)');
}

/* ------------------------------------------------------------------ */
/* Bucketing closed lots                                               */
/* ------------------------------------------------------------------ */
console.log('\n--- bucketing closed lots ---');

{
  const gains = bucketRealizedGains([
    { entryISO: '2025-01-10T00:00:00Z', exitISO: '2025-02-10T00:00:00Z', pnl: 5_000 }, // 1m  -> ST
    { entryISO: '2024-01-10T00:00:00Z', exitISO: '2025-06-10T00:00:00Z', pnl: 40_000 }, // 17m -> LT
    { entryISO: '2025-03-01T00:00:00Z', exitISO: '2025-05-01T00:00:00Z', pnl: -2_000 }, // 2m  -> ST
  ]);
  assert(near(gains.stcg, 3_000), `short-term bucket nets to ₹3,000 (got ${gains.stcg})`);
  assert(near(gains.ltcg, 40_000), 'long-term bucket holds the 17-month lot');
}

// A lot with no P&L recorded must not be counted as a zero-gain trade.
{
  const gains = bucketRealizedGains([
    { entryISO: '2025-01-10T00:00:00Z', exitISO: '2025-02-10T00:00:00Z', pnl: NaN },
  ]);
  assert(gains.stcg === 0 && gains.ltcg === 0, 'a lot with unusable P&L is ignored, not counted');
}

// Rates are configurable, so a statutory change is config rather than a code edit.
{
  const t = estimateTax({ stcg: 100_000, ltcg: 0 }, '2025-2026', {
    ...DEFAULT_TAX_RATES,
    stcgRate: 0.15,
  });
  assert(near(t.tax, 15_000), 'a custom short-term rate is honoured');
}

console.log(failures === 0 ? '\nALL TAX TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
