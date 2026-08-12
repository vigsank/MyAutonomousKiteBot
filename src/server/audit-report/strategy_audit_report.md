## Executive Summary
- [FAIL] The bot's daily drawdown calculation is blind to unrealized losses because it queries a `ticks` table that is never populated by the live tick loop, risking unbounded capital exposure.
- [FAIL] The breakout strategy incorrectly excludes the most recent closed bar when calculating the prior high, causing it to miss or delay valid breakout signals.
- [WARN] There is a critical mismatch between the stop-loss distance used for position sizing/R:R filtering and the actual stop-loss enforced by the `RiskEngine`, leading to undersized positions and inaccurate risk-reward calculations.
- [WARN] The strategy calculates a target distance (`targetAtrMultiplier`) to validate the reward:risk ratio but never actually uses it as a take-profit exit, causing winning trades to give back profits.
- [PASS] The core architecture, paper trading cost simulation, and risk gating (capital allocation, circuit breakers) are robust and well-structured.

## Strategy Grade Card

| Dimension | Grade | Score (1-10) | Justification |
| :--- | :---: | :---: | :--- |
| Strategy Soundness | C | 5 | Core logic is standard, but lacks profit targets and has a breakout lookback bug. |
| Market Sensing | D | 4 | Misreads breakout levels and is blind to live unrealized PnL for drawdown. |
| Risk Management | C | 5 | Hard gates exist, but the stop distance mismatch and blind drawdown undermine safety. |
| Execution | B | 8 | Paper trading simulation with slippage and costs is realistic and well-implemented. |
| Profitability | D | 4 | Undersized positions and lack of profit-taking will severely drag down expectancy. |

## Findings

- **Severity:** CRITICAL
- **File:** Ledger.ts:233
- **Issue:** Unrealized PnL in drawdown calculation always returns 0 because the `ticks` table is never populated.
- **Evidence:** `(SELECT last_price FROM ticks t WHERE t.instrument_id = p.instrument_id ORDER BY t.timestamp DESC LIMIT 1) AS last_price` ... `const last = p.last_price ?? p.avg_price;`
- **Impact:** The bot thinks open positions have 0 unrealized loss. The daily drawdown limit (`maxDailyDrawdown`) will only trigger on *realized* losses, allowing massive open losses to accumulate without halting trading.
- **Recommendation:** Update the `last_price` in the `instruments` table or a dedicated in-memory cache on every tick, and use that in `currentDrawdown`, or write ticks to the DB.

- **Severity:** HIGH
- **File:** MarketAgent.ts:318
- **Issue:** Breakout high calculation incorrectly excludes the most recent closed bar.
- **Evidence:** `const priorHigh = Math.max(...highs.slice(0, -1));`
- **Impact:** The breakout level is based on N-1 bars instead of N. If the highest high in the lookback period occurred on the most recently closed bar, the bot will ignore it and set the breakout threshold artificially low, leading to false breakouts.
- **Recommendation:** Change to `const priorHigh = Math.max(...highs);`. The current forming bar is not in the `highs` array yet, so no exclusion is needed.

- **Severity:** HIGH
- **File:** MarketAgent.ts:410, RiskEngine.ts:73
- **Issue:** Stop distance mismatch between sizing/R:R and actual execution.
- **Evidence:** `MarketAgent.ts:410`: `return Math.max(atr * cfg.atrStopMultiplier, price * (cfg.stopLossPercent / 100) * 0.5);` vs `RiskEngine.ts:73`: `dist = Math.min(atrDist, maxDist);`
- **Impact:** `MarketAgent` uses the *larger* of ATR stop and half the fixed stop, while `RiskEngine` enforces the *smaller* of ATR stop and the full fixed stop. This leads to undersized positions (lower profitability) and inaccurate R:R filtering (passing trades that don't actually meet the R:R criteria).
- **Recommendation:** Unify the stop distance logic. Use `RiskEngine.stopLossPrice` logic for both sizing and R:R calculation.

- **Severity:** MEDIUM
- **File:** MarketAgent.ts:355
- **Issue:** Strategy calculates a target distance to validate R:R but never uses it as a take-profit exit.
- **Evidence:** `const targetDist = atr * this.config.strategy.targetAtrMultiplier;` (used only for R:R check). In `checkExit`, only RSI >= 70 or stop loss triggers an exit.
- **Impact:** Winning trades in mean-reversion or pullback modes may give back profits waiting for RSI to hit 70, significantly reducing the win rate and overall expectancy.
- **Recommendation:** Add an ATR-based take-profit check in `checkExit` (e.g., `if (price >= position.avgPrice + targetDist) exitReason = 'Target hit'`).

- **Severity:** LOW
- **File:** MarketAgent.ts:395
- **Issue:** Volume confirmation uses lagging data.
- **Evidence:** `const current = samples[samples.length - 1];`
- **Impact:** `samples` is updated on bar finalization. `current` is the *previous* bar's volume, not the current forming bar. Breakout signals triggered during the current bar won't reflect current bar volume, causing delayed or missed entries.
- **Recommendation:** Compare the current forming bar's accumulated volume (from `this.bars`) against the average, or accept the 1-bar lag as a design choice.

## Market-Sensing Gaps

1. **Blindness to Live Drawdown:** The bot's risk engine queries a database table for the latest tick price to calculate unrealized PnL, but the live tick processing loop (`onTicks`) never writes to this table. The bot is effectively sensing its open risk as zero until a position is closed.
2. **Phantom Breakout Levels:** By slicing off the last element of the `highs` array, the bot misreads the current market structure. If a stock just made a 20-day high on the last closed bar, the bot will look at the 19 bars prior to that, setting an incorrect breakout threshold.
3. **Inconsistent Volatility Sensing:** The bot senses volatility via ATR to size positions and check R:R, but it uses a different formula (`Math.max` with a halved fixed stop) than the risk engine (`Math.min` with the full fixed stop). The bot's "sense" of risk is disconnected from the actual risk enforced.

## Profitability Improvement Plan

1. **Fix Breakout High Calculation** (Expected Effect: Higher win rate on breakout mode)
   - File: `MarketAgent.ts:318`
   - Change `Math.max(...highs.slice(0, -1))` to `Math.max(...highs)`. This ensures the bot correctly identifies the true N-bar high.

2. **Implement ATR-Based Profit Targets** (Expected Effect: Significantly higher expectancy and win rate)
   - File: `MarketAgent.ts:355`
   - In `checkExit`, add a condition: `const target = position.avgPrice + (atr * cfg.targetAtrMultiplier); if (price >= target) exitReason = 'Target hit';`. This locks in gains instead of waiting for RSI to reverse.

3. **Unify Stop Distance Logic** (Expected Effect: Correct position sizing and accurate R:R filtering)
   - File: `MarketAgent.ts:410`
   - Replace the `stopDistance` method body to mirror `RiskEngine.stopLossPrice` logic: `const maxDist = price * (cfg.stopLossPercent / 100); const atrDist = (atr ?? 0) * cfg.atrStopMultiplier; return Math.min(atrDist, maxDist);`. This ensures the bot sizes positions based on the actual stop that will be enforced.

4. **Fix Unrealized PnL Tracking for Drawdown** (Expected Effect: Prevent catastrophic capital loss)
   - File: `Ledger.ts:233` / `MarketAgent.ts:120`
   - In `MarketAgent.onTicks`, update the `last_price` of the instrument in the database or an in-memory cache that `Ledger.currentDrawdown` can access. This ensures the circuit breaker and daily drawdown limits actually function during open trades.

## Positive Observations

- The paper trading engine (`PaperTrader.ts`) realistically simulates adverse slippage and NSE-style brokerage/statutory charges, preventing the overly optimistic P&L common in paper bots.
- The `RiskEngine` acts as an immutable hard gate that the AI/strategy cannot override, which is a best practice for autonomous trading systems.
- The architecture cleanly separates historical data providers (Yahoo, OpenBB) from the live data provider (Kite), making the bot highly testable.
- The inclusion of a circuit breaker that halts trading after N consecutive trades within a window is a strong defense against algorithmic runaway loops.