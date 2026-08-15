## Executive Summary
- [FAIL] **Volume Sensing is Broken:** `MarketAgent.ts` sums cumulative tick volume per bar, destroying volume confirmation and ORB validity.
- [FAIL] **Mode-Specific Exits are Dead Code:** `checkExit` uses the static `cfg.mode` instead of the active regime-adaptive mode, disabling trailing stops and trend-break exits.
- [FAIL] **ORB Range Leaks Across Days:** Opening range high/low are never reset daily, making breakout detection impossible after day 1.
- [WARN] **Kelly Sizing Misapplied:** Kelly fraction is applied to notional deployment instead of risk budget, leading to incorrect position sizing.
- [WARN] **Daily Metrics Incorrect:** `DailyReportEngine` calculates pivots and previous-day changes using raw intraday candles, feeding garbage data to the LLM.

## Strategy Grade Card
| Dimension | Grade | Score | Justification |
|---|---|---|---|
| Strategy Soundness | C | 5/10 | Good regime-adaptive framework, but Bollinger entries bypass key safety filters. |
| Market Sensing | D | 4/10 | Volume sensing is broken; ORB range leaks across days; pivots use incomplete daily data. |
| Reasoning Layer | B | 8/10 | Well-structured LLM prompt and JSON schema, but feeds it incorrect daily change/pivot data. |
| Risk Management | A | 9/10 | Hard caps are robust and correctly enforced; Kelly sizing is mathematically flawed but safely capped. |
| Execution | C | 5/10 | Synchronous execution is fine, but mode-specific exits are dead code. |
| Profitability | D | 4/10 | Broken volume and exits will lead to false entries and missed trend exits, hurting expectancy. |

## Findings

- **Severity:** CRITICAL
  **File:** MarketAgent.ts: `accumulateBar`
  **Issue:** Cumulative tick volume is summed per bar, destroying volume metrics.
  **Evidence:** `bar.volume += volume;` (where `volume` is `tick.volume_traded`)
  **Impact:** `hasVolumeConfirmation` uses these inflated, increasing values, making the volume filter useless. This allows low-volume fakeouts to trigger entries.
  **Recommendation:** Replace with `bar.volume = volume;` (to capture the last cumulative volume of the bar) or calculate the delta from the previous bar's volume.

- **Severity:** CRITICAL
  **File:** MarketAgent.ts: `checkExit`
  **Issue:** Mode-specific exits (trend break, trailing stop) are never triggered in regime-adaptive mode.
  **Evidence:** `else if (cfg.mode === 'pullback_trend' ...)` and `else if (cfg.mode === 'breakout' ...)`
  **Impact:** If `regimeAdaptive` is true (default), `cfg.mode` remains the static default (`mean_reversion`). Positions opened in `pullback_trend` or `breakout` modes will never trigger their specific exit logic, holding losing positions longer than intended.
  **Recommendation:** Store the entry mode on the `Position` object (e.g., `position.entryMode`) and check that instead of `cfg.mode`.

- **Severity:** CRITICAL
  **File:** MarketAgent.ts: `updateOrb`
  **Issue:** Opening range high/low are never reset at the start of a new day.
  **Evidence:** `this.orbHigh.set(symbol, Math.max(high, price));` without any daily reset logic.
  **Impact:** On day 2, the ORB range includes day 1's high/low, making the breakout threshold artificially high and unbreakable.
  **Recommendation:** Add a daily reset: if `now` is a new day, clear `orbHigh`, `orbLow`, and `orbEstablished` for all symbols.

- **Severity:** HIGH
  **File:** MarketAgent.ts: `sizedQuantity`
  **Issue:** Kelly criterion is applied to notional deployment instead of risk budget.
  **Evidence:** `kellySized = Math.floor(kellyBudget / price);`
  **Impact:** Kelly formula outputs the fraction of capital to *risk*, not to *deploy*. Using it as notional drastically undersizes positions for tight stops and oversizes for wide stops.
  **Recommendation:** Change to `kellySized = Math.floor(kellyBudget / stopDist);` to size based on risk.

- **Severity:** HIGH
  **File:** DailyReportEngine.ts: `previousDayChange` & `pivotsFor`
  **Issue:** Daily metrics are calculated from raw intraday candles without proper day aggregation.
  **Evidence:** `ORDER BY c.timestamp DESC LIMIT 2` for previousDayChange; `dailyCandles(symbol, 1)` for pivots uses the current incomplete day.
  **Impact:** The LLM is fed 1-minute price changes instead of previous-day changes, and pivots are calculated on incomplete OHLC, leading to hallucinated or incorrect advisory suggestions.
  **Recommendation:** Aggregate intraday candles into daily OHLC *first*, then compute changes/pivots from completed daily bars.

- **Severity:** HIGH
  **File:** MarketAgent.ts: `checkEntry`
  **Issue:** Bollinger band entries bypass ADX trend and volume confirmation filters.
  **Evidence:** `if (!cfg.bollingerEntry && adx !== undefined ...)` and `if (!cfg.bollingerEntry && !this.hasVolumeConfirmation...)`
  **Impact:** Mean-reversion buys in strong trends (catching falling knives) and on low volume, increasing false signals.
  **Recommendation:** Apply a relaxed ADX filter (e.g., ADX < 30) and volume confirmation to Bollinger entries.

- **Severity:** MEDIUM
  **File:** MarketAgent.ts: `checkExit`
  **Issue:** Breakeven stop is not persistent; it reverts to the original stop if price pulls back.
  **Evidence:** `if (favorable >= atr * cfg.breakevenAtrMult) { effectiveStop = position.avgPrice; }` (no persistence)
  **Impact:** A winner can turn into a loser if the price triggers breakeven, pulls back, and then hits the original stop.
  **Recommendation:** Persist the breakeven state on the position (e.g., `position.breakevenTriggered = true`) so `effectiveStop` stays at `avgPrice`.

- **Severity:** MEDIUM
  **File:** MarketAgent.ts: `loadReportBias`
  **Issue:** LLM report bias is loaded only once per runtime and never updated.
  **Evidence:** `if (this.reportBiasLoaded) return;`
  **Impact:** The 11:00 and 15:15 reports are ignored for entry vetoes; the bot is stuck with the 09:00 bias all day.
  **Recommendation:** Check the report timestamp and reload if a newer report is available.

- **Severity:** MEDIUM
  **File:** MarketAgent.ts: `isTradingWindowOpen`
  **Issue:** `skipFirstMinutes` is bypassed for all modes if ORB is enabled.
  **Evidence:** `if (!cfg.orbEnabled && minutes < open + cfg.skipFirstMinutes) return false;`
  **Impact:** Mean-reversion and pullback entries can trigger in the volatile opening minutes, which ORB is supposed to protect against.
  **Recommendation:** Apply `skipFirstMinutes` to non-breakout modes regardless of `orbEnabled`.

## Market-Sensing Gaps
- **Volume Sensing:** Completely broken due to summing cumulative tick volume. The bot is blind to volume confirmation.
- **ORB Range:** Leaks across days, making breakout detection impossible after day 1.
- **Daily Metrics:** Pivots and previous-day changes are calculated on intraday/incomplete data, feeding garbage to the LLM.
- **Regime Classification:** The `volatile` threshold (`volRatio > 0.002`) is too sensitive, causing most stocks to be classified as volatile, defaulting to mean-reversion even in clear trends.

## Reasoning Layer Review
- **Prompt Quality:** Excellent. Clearly defines the LLM's role, provides deterministic capital and symbol context, and enforces a strict JSON schema.
- **Advisory-Only:** Correctly clamps suggestions to available capital and relies on RiskEngine for final enforcement.
- **Data Quality:** The major flaw is feeding incorrect `previousDayChange` and `pivots` to the LLM. If the input data is wrong, the LLM's advisory output will be wrong.

## Execution Layer Review
- **Indicator Math:** RSI, ADX, ATR, Bollinger are correctly computed on bar close.
- **Kelly Sizing:** Mathematically misapplied (notional instead of risk).
- **Exit Logic:** The biggest flaw is the dead code for mode-specific exits. The bot cannot properly manage pullback or breakout trades.

## Risk & Capital Guardrails Review
- **Hard Caps:** Single-stock 15%, cash reserve 20%, risk-at-stop 1.5%, sector 30%, drawdown 10% are all correctly enforced in `RiskEngine.evaluate`.
- **Position Sizing:** The risk-parity sizing (`budget / stopDist`) is correct and capped by `maxTradeAllocation`. The Kelly sizing is flawed but safely capped by the risk sizing.

## Profitability Improvement Plan
1. **Fix Volume Calculation:** Change `bar.volume += volume` to `bar.volume = volume`. This instantly restores volume confirmation and ORB validity.
2. **Fix Mode-Specific Exits:** Add `entryMode` to `Position` and use it in `checkExit` to enable trend-break and trailing stops.
3. **Fix ORB Daily Reset:** Clear ORB state at the start of each day to ensure accurate breakout detection.
4. **Fix Kelly Sizing:** Change `kellyBudget / price` to `kellyBudget / stopDist` to correctly size based on risk.
5. **Fix Daily Metrics:** Aggregate intraday candles to daily OHLC before calculating pivots and previous-day change for the LLM.
6. **Fix Breakeven Persistence:** Store breakeven state on the position to prevent winners from turning into losers.
7. **Fix Report Bias Reload:** Check report timestamp to load the latest bias.
8. **Apply Safety Filters to Bollinger:** Re-enable ADX and volume filters for Bollinger entries to avoid catching falling knives.

## Positive Observations
- The division of responsibility between LLM (advisory) and RiskEngine (hard gate) is architecturally sound.
- The regime-adaptive mode selection is a sophisticated approach to multi-regime trading.
- The hard risk caps (single-stock, sector, drawdown, risk-at-stop) are robust and well-implemented.
- The JSON schema validation and ensemble merging for LLM reports are resilient.