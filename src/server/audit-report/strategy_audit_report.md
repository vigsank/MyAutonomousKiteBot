## Executive Summary
- [FAIL] The bot calculates RSI and SMA indicators on every live tick rather than on closed candle prices, causing extreme signal noise and false entries/exits.
- [FAIL] The breakout strategy is completely broken in live trading mode because the `breakoutHighs` array is never populated during live tick accumulation.
- [WARN] Risk management ignores unrealized drawdown; the daily drawdown limit only triggers on realized losses, allowing catastrophic open positions to persist.
- [WARN] Options pricing uses a hardcoded volatility (30%), leading to wildly unrealistic paper-trading fills and poor strategy evaluation.
- [PASS] The core risk-parity position sizing logic and ATR-based stop-loss framework are structurally sound and provide a good foundation for capital protection.

## Strategy Grade Card

| Dimension | Grade | Score (1-10) | Justification |
| :--- | :---: | :---: | :--- |
| Strategy Soundness | D | 4/10 | Tick-based indicators generate noise; breakout mode is non-functional live. |
| Market Sensing | F | 2/10 | Misinterprets momentum and trend by feeding raw ticks into moving averages and RSI. |
| Risk Management | C | 6/10 | Good position sizing, but fails to account for unrealized drawdown. |
| Execution | B | 8/10 | Paper trading ledger and order routing are robust and well-structured. |
| Profitability | D | 3/10 | High likelihood of whipsaw losses and missed breakout entries will erode capital. |

## Findings

- **Severity:** CRITICAL
- **File:** `MarketAgent.ts:108-112`
- **Issue:** RSI and SMA indicators are fed every live tick instead of closed candle prices.
- **Evidence:** 
  ```typescript
  const price = tick.last_price;
  this.lastPrices.set(symbol, price);
  // RSI from close prices.
  const r = this.rsiFor(symbol).nextValue(price);
  if (r !== undefined) this.rsiValues.set(symbol, r);
  // SMAs for the pullback-in-uptrend strategy.
  this.feedSma(symbol, price);
  ```
- **Impact:** RSI and SMA will jitter with every single tick. A momentary price dip could trigger an RSI < 30 entry, immediately followed by a reversal. SMAs will essentially track the current price, making `fast > slow` comparisons meaningless.
- **Recommendation:** Remove indicator updates from `onTicks`. Only update RSI and SMA inside `finalizeBar` using `bar.close`.

- **Severity:** CRITICAL
- **File:** `MarketAgent.ts:118-130`, `MarketAgent.ts:191-195`
- **Issue:** The `breakoutHighs` array is only populated in the backtest path (`onCandle`), never in the live path (`accumulateBar`).
- **Evidence:** 
  ```typescript
  // In onCandle (backtest):
  const highs = this.breakoutHighs.get(symbol) ?? [];
  highs.push(candle.high);
  // In accumulateBar (live): no breakoutHighs update exists.
  ```
- **Impact:** In live mode, `checkEntryBreakout` will always fail at line 352 (`highs.length < cfg.breakoutLookback`), meaning the breakout strategy will never trigger a trade.
- **Recommendation:** Update `breakoutHighs` inside `finalizeBar` by pushing `bar.high` and maintaining the rolling window.

- **Severity:** HIGH
- **File:** `Ledger.ts:112-120`
- **Issue:** `currentDrawdown` only sums realized PnL from closed trades.
- **Evidence:** 
  ```typescript
  `SELECT COALESCE(SUM(CASE WHEN pnl < 0 THEN pnl ELSE 0 END), 0) AS loss
     FROM trades
    WHERE status = 'FILLED' AND created_at LIKE ?`,
  ```
- **Impact:** The bot can hold a massive losing position, and the daily drawdown limit won't trigger until the position is closed, by which point the capital is already gone.
- **Recommendation:** Calculate drawdown including unrealized PnL of open positions by joining `positions` with the latest tick prices.

- **Severity:** HIGH
- **File:** `OptionsEngine.ts:62-63`
- **Issue:** Black-Scholes pricing uses a static volatility of 30%.
- **Evidence:** 
  ```typescript
  private readonly SIGMA = 0.3;
  private readonly RATE = 0.06;
  ```
- **Impact:** Option premiums will be wildly inaccurate. In low-volatility environments, the bot overpays; in high-volatility, it underpays. Paper trading PnL will not reflect reality.
- **Recommendation:** Calculate historical volatility (e.g., standard deviation of log returns) from recent candles or use the existing ATR value to derive a dynamic volatility input.

- **Severity:** MEDIUM
- **File:** `MarketAgent.ts:398-404`
- **Issue:** Volume confirmation uses stale data during intra-bar evaluations.
- **Evidence:** 
  ```typescript
  const current = samples[samples.length - 1];
  return current >= avg * this.config.strategy.volumeConfirmMultiplier;
  ```
- **Impact:** `volumeSamples` is only updated on bar close. During a live tick evaluation, it compares against the previous bar's volume, delaying breakout confirmations until the bar closes.
- **Recommendation:** Track the current bar's accumulating volume separately and compare it to the average volume of *closed* bars, or only evaluate entries on bar close.

- **Severity:** MEDIUM
- **File:** `MarketAgent.ts:410-421`
- **Issue:** `sizedQuantity` caps position size at watchlist quantity, breaking risk parity.
- **Evidence:** 
  ```typescript
  const riskSized = Math.floor(budget / riskPerShare);
  if (riskSized <= 0) return 0;
  // Cap at the watchlist quantity but never exceed it.
  return Math.max(1, Math.min(watchQuantity, riskSized));
  ```
- **Impact:** If `watchQuantity` is 100, but the risk budget allows 500, the bot only buys 100, reducing potential returns and not fully utilizing the risk budget.
- **Recommendation:** Remove the `watchQuantity` cap or make it an optional maximum allocation rather than a hard cap.

## Market-Sensing Gaps

1. **Tick Noise Misinterpreted as Momentum:** By feeding raw ticks into RSI, the bot misreads normal bid/ask bounce as extreme oversold/overbought conditions. It senses momentum where none exists.
2. **Blind to Live Breakouts:** The bot is completely blind to breakout signals in live mode because it fails to track rolling highs during tick aggregation. It cannot sense a breakout occurring.
3. **Delayed Volume Sensing:** The bot evaluates volume confirmation using the volume of the *previous* bar. It cannot sense a volume spike occurring in the current forming bar, leading to late entries.
4. **Static Volatility Mispricing:** The options layer senses all market environments as having 30% volatility, leading to incorrect premium valuation and false assumptions about option profitability.

## Profitability Improvement Plan

1. **Move Indicator Updates to Bar Close** (`MarketAgent.ts`): Remove `this.rsiFor(symbol).nextValue(price)` and `this.feedSma(symbol, price)` from `onTicks`. Move them to `finalizeBar` using `bar.close`. This will eliminate 90% of false whipsaw signals and dramatically improve win rate.
2. **Fix Breakout Tracking** (`MarketAgent.ts`): In `finalizeBar`, add logic to push `bar.high` to `breakoutHighs` and shift the array. This will activate the breakout strategy in live mode.
3. **Calculate Unrealized Drawdown** (`Ledger.ts`): Modify `currentDrawdown` to query open positions, multiply by the difference between `avg_price` and current `last_price` from the `ticks` table, and add to realized losses. This prevents catastrophic capital erosion.
4. **Implement Dynamic Volatility** (`OptionsEngine.ts`): Pass the ATR value or a historical volatility calculation from `MarketAgent` into `OptionsEngine.premium()` to replace the hardcoded `SIGMA = 0.3`. This ensures realistic options PnL tracking.
5. **Remove Watchlist Quantity Cap** (`MarketAgent.ts`): Change `Math.min(watchQuantity, riskSized)` to just `riskSized` (or add a separate `maxAllocation` config). This allows the risk-parity model to fully size positions according to the risk budget.

## Positive Observations

- The architecture cleanly separates the strategy (`MarketAgent`), risk (`RiskEngine`), and execution (`PaperTrader`), making the codebase highly maintainable.
- The ATR-based stop-loss logic with a hard percentage cap in `RiskEngine.stopLossPrice` is a robust mechanism for adapting to volatility while maintaining strict risk limits.
- The SQLite ledger provides a comprehensive, normalized audit trail of all signals, trades, and risk events, which is excellent for post-trade analysis.
- The inclusion of a human-in-the-loop (HITL) Telegram approval gate for large tickets adds a strong layer of discretionary safety.