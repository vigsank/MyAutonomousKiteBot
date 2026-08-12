## Executive Summary
- [FAIL] The 1-year goal of generating ₹1,00,000/month from a ₹5,000–₹10,000 starting capital is mathematically impossible without reckless leverage and guaranteed account ruin.
- [FAIL] The constraint to "ALWAYS end each month in overall PROFIT" is a mathematical impossibility in financial markets. You cannot guarantee a winning first trade, and stopping trading after a loss does not erase the loss.
- [WARN] The default risk configuration (`AppConfig.ts:120`, `AppConfig.ts:122`) is calibrated for a ₹5,00,000 account. Running it with ₹10,000 will result in a 50% daily drawdown limit and immediate capital depletion.
- [WARN] Position sizing (`MarketAgent.ts:415`) uses a static capital value from the configuration file rather than dynamic account equity, preventing compounding and misrepresenting actual risk.
- [PASS] The paper trading cost model (`PaperTrader.ts:20`) correctly applies slippage and NSE fees, preventing the false optimism of zero-cost backtests.
- [PASS] The RiskEngine (`RiskEngine.ts:20`) acts as a hard, immutable gate, correctly blocking trades that exceed capital or drawdown limits.

## The Math — Is the Goal Feasible?
The math is brutal and unsparing. 

To generate ₹1,00,000 of monthly income at a realistic, sustainable professional return of 2–5% per month, you need a capital base of:
- At 5% monthly return: ₹20,00,000 (₹20 Lakhs)
- At 2% monthly return: ₹50,00,000 (₹50 Lakhs)

To grow a starting capital of ₹10,000 to ₹20,00,000 in 12 months through compounding, you would need a monthly return of **56%**. 
A 56% monthly return is not trading; it is gambling with extreme leverage (e.g., deep out-of-the-money options). This guarantees a 100% probability of blowing your account to zero within weeks, directly violating your "no monthly loss" constraint.

**Verdict on the Goal:** The 1-year timeline is delusional. The capital base is insufficient by a factor of 200x. You must either inject ₹20,00,000 of external capital today or revise your timeline to 10+ years of aggressive compounding and external deposits.

## Codebase & Algorithm Review
- **AppConfig.ts:120,122**: `maxDailyDrawdown` defaults to 5000 and `maxTradeAllocation` to 20000. If you set `AVAILABLE_CAPITAL=10000`, a 5000 drawdown is a 50% daily loss limit. This is reckless. The `maxTradeAllocation` of 20000 is 200% of your account, meaning the capital check in `RiskEngine.ts:20` will block all trades until you lower this.
- **MarketAgent.ts:415**: `const budget = (this.config.risk.availableCapital * cfg.riskPerTradePercent) / 100;`. The bot reads `availableCapital` from the static config, not the current ledger equity. If the bot grows the account to ₹15,000, it still sizes trades based on ₹10,000. This prevents compounding.
- **MarketAgent.ts:370**: `if (rsiValue >= cfg.rsiExitThreshold) { exitReason = ... }`. The exit logic checks RSI overbought conditions *before* checking if the ATR target is hit. In a strong momentum move, RSI will hit 70 quickly, causing the bot to exit prematurely and miss the full target move, severely damaging the reward:risk ratio.
- **MarketAgent.ts:290**: The mean reversion entry requires `rsiValue < cfg.rsiEntryThreshold` (default 30). On higher timeframe or liquid NSE stocks, RSI 30 is a rare event. The bot will sit in cash for weeks.
- **OptionsEngine.ts**: Options are disabled by default (`OPTIONS_ENABLED=false` in `.env.example`). This is correct. The Black-Scholes pricing model is used, but buying options is a negative expectancy game for retail due to theta decay and IV crush.

## Profitability Gaps
1. **Regime Mismatch**: `REGIME_GATING_ENABLED=false` by default (`.env.example`). The bot will attempt mean-reversion in strong trending markets, leading to a death by a thousand cuts as it buys dips that keep falling.
2. **Cost Drag**: The cost model (`PaperTrader.ts:20`) applies ~15bps per side (slippage + brokerage + statutory). A round trip is ~30bps. With a 4% stop loss (`STOP_LOSS_PERCENT=4`), the cost represents 7.5% of your risk. Your strategy edge must be exceptionally large just to break even.
3. **No Compounding**: Because `MarketAgent.ts:415` uses static config capital, the bot will never increase position sizes as the account grows, capping your upside.
4. **Exit Logic Flaw**: Prioritizing the RSI exit over the ATR target exit (`MarketAgent.ts:370`) systematically cuts winners short, turning a 1:3 risk/reward setup into a 1:1 or worse.

## "No Monthly Loss" Guardrails
It is mathematically impossible to guarantee a profitable month. If your first trade of the month is a loss, the month is in the red. Stopping trading does not reverse the loss. 

However, you can implement a **Monthly Drawdown Limit** to cap losses and protect capital:

1. Add `maxMonthlyDrawdown` to `AppConfig.ts` (e.g., 2% of capital).
2. In `Ledger.ts`, add a `currentMonthlyDrawdown()` method that calculates realized + unrealized PnL since the 1st of the current month.
3. In `RiskEngine.ts:20`, add a check: if `currentMonthlyDrawdown() > maxMonthlyDrawdown`, block all trades and set a flag `monthlyHalt = true`.
4. The bot will remain halted until the 1st of the next month.
5. **To lock in profits**: If the bot reaches a monthly profit target (e.g., 3%), you can set a trailing monthly stop. If the account equity drops back to 1% profit, halt for the month. This guarantees a green month *if* you hit the target early, but does not guarantee you will hit it.

## Realistic Growth Plan (₹5k/₹10k → ₹1L/month)
The 1-year target is unachievable. Here is a realistic path:

- **Phase 1 (Months 1-12): Validation & Survival**
  - Start: ₹10,000.
  - Fix config: `MAX_DAILY_DRAWDOWN=300`, `MAX_TRADE_ALLOCATION=5000`.
  - Target: 2-3% monthly return.
  - End of Year 1: ₹12,600 - ₹13,400. 
  - *You will not make ₹1L/month. You will make enough to buy a nice dinner.*

- **Phase 2 (Years 2-5): Compounding & Capital Injection**
  - To reach ₹1L/month, you need ₹20L - ₹50L capital.
  - You must deposit external savings. If you deposit ₹10,000/month and earn 3%, it will take approximately 7-8 years to reach ₹20,00,000.
  - Only at that point can you withdraw ₹1,00,000/month at a 5% return.

## Prioritized Action Items
1. **Fix Risk Config for Small Capital**: Change `AppConfig.ts:120` and `AppConfig.ts:122` to use percentages or lower the `.env` defaults to `MAX_DAILY_DRAWDOWN=300` and `MAX_TRADE_ALLOCATION=5000` for a ₹10k account.
2. **Enable Regime Gating**: Set `REGIME_GATING_ENABLED=true` in `.env` to stop the bot from mean-reverting in trending markets.
3. **Fix Exit Logic**: In `MarketAgent.ts:370`, move the ATR target check *above* the RSI exit check. Let the target hit, don't exit just because RSI is 70.
4. **Implement Dynamic Sizing**: Refactor `MarketAgent.ts:415` to pull current account equity from `Ledger.ts` instead of using `this.config.risk.availableCapital`.
5. **Implement Monthly Halt**: Add the monthly drawdown guardrail to `RiskEngine.ts` as described above to cap monthly losses.
6. **Revise Your Goal**: Accept that ₹10k cannot yield ₹1L/month in 1 year. Focus on proving the strategy works with small money before scaling capital.