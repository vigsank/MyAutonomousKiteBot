-- ============================================================================
-- V014: Tax accrual on the EOD performance log
-- ============================================================================
-- Until now every P&L number the bot reported was PRE-TAX, which for an equity
-- strategy that realizes gains monthly is not a number anyone can spend. Short-
-- term capital gains are taxed at 20% (holdings under 12 months, post
-- 23-Jul-2024), long-term at 12.5% above a 1,25,000 annual exemption.
--
-- On a strategy realizing most gains inside 12 months that is a ~20% haircut on
-- the entire return, which is larger than most of the strategy improvements we
-- have been chasing. Reporting it makes the trade-off between rebalance cadence
-- and take-home explicit rather than invisible.
--
-- Tax is accrued for the FINANCIAL YEAR TO DATE (April-March), not per day,
-- because that is how it is actually assessed: losses net against gains within
-- the year, and the LTCG exemption is annual. A per-day tax figure would be
-- meaningless -- a loss-making day genuinely reduces the year's liability.
--
-- All three columns are nullable so rows written before this migration (and any
-- code path that does not compute tax) remain valid.

ALTER TABLE eod_performance ADD COLUMN financial_year TEXT;
-- Realized short-term gains, financial-year to date (may be negative).
ALTER TABLE eod_performance ADD COLUMN stcg_fytd REAL;
-- Realized long-term gains, financial-year to date (may be negative).
ALTER TABLE eod_performance ADD COLUMN ltcg_fytd REAL;
-- Estimated tax owed on the above, after netting losses and the LTCG exemption.
ALTER TABLE eod_performance ADD COLUMN tax_accrued REAL;
