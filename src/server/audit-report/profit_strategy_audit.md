## Executive Summary
- [FAIL] The 1-year goal of generating ₹1,00,000/month from a ₹5,000–₹10,000 starting capital is mathematically impossible without extreme leverage or reckless risk. It requires a sustained 55% monthly return to build the necessary capital base, which no equity strategy can achieve.
- [FAIL] The current position sizing logic (`MarketAgent.ts:530`) will reject almost all trades on a ₹10,000 capital base. A 1% risk budget yields ₹100, which is too small to buy even a single share of most NSE stocks with a reasonable ATR stop.
- [FAIL] The "No Monthly Loss" goal is not supported by the current code. The monthly drawdown guard (`RiskEngine.ts:92`) only halts *new* entries; it leaves open positions to bleed, guaranteeing a negative month-end P&L if the threshold is breached.
- [WARN] The default configuration (`AppConfig.ts:122-124`) is calibrated for ₹5,00,000 capital. Deploying with ₹10,000 without adjusting `MAX_DAILY_DRAWDOWN` and `MAX_TRADE_ALLOCATION` will cause logic mismatches and risk engine bypasses.
- [WARN] Transaction costs (`PaperTrader.ts:24`) will consume a disproportionate amount of profit on small ticket sizes. A ₹2,000 trade incurs ~₹50 in round-trip costs, a 2.5% drag that requires significant gross edge to overcome.
- [PASS] The architecture correctly isolates the LLM as a signal source and enforces deterministic risk (`RiskEngine.ts:32`). The system will not blow up the account overnight, but it also will not grow it to the target.

## The Math — Is the Goal Feasible?
The goal is to generate ₹1,00,000/month of income within 12 months, starting with ₹10,000. 

**1. Required Capital Base:**
To sustainably withdraw ₹1,00,000/month without depleting the principal, you need a realistic monthly return of 2–5%. 
- At 5% monthly return: ₹1,00,000 / 0.05 = ₹20,00,000 (20 Lakhs) required capital.
- At 2% monthly return: ₹1,00,000 / 0.02 = ₹50,00,000 (50 Lakhs) required capital.

**2. Required Compounding Rate:**
To grow ₹10,000 to ₹20,00,000 in 12 months via compounding:
- Formula: `Final = Initial * (1 + R)^12`
- `20,00,000 = 10,000 * (1 + R)^12` -> `200 = (1 + R)^12`
- `R = 200^(1/12) - 1 ≈ 0.552` or **55.2% per month**.

**Verdict:** A 55.2% monthly return is mathematically unattainable in equity markets without massive leverage (which is explicitly out of scope) or taking catastrophic risks (which the `RiskEngine` prevents). The 1-year target must be revised.

## Codebase & Algorithm Review

### 1. Execution Layer & Position Sizing
- **File:** `src/server/MarketAgent.ts:530-540`
  ```typescript
  const budget = (this.config.risk.availableCapital * cfg.riskPerTradePercent) / 100;
  const stopDist = this.stopDistance(symbol, price);
  const riskPerShare = stopDist;
  if (riskPerShare <= 0) return watchQuantity;
  const riskSized = Math.floor(budget / riskPerShare);
  if (riskSized <= 0) return 0;
  ```
  **Impact:** With ₹10,000 capital and a 1% risk per trade (`RISK_PER_TRADE_PERCENT=1`), the budget is ₹100. If a stock is priced at ₹500 with an ATR stop of ₹10, `riskSized` = 10 shares. Ticket size = ₹5,000. However, for a stock priced at ₹1,000 with a ₹20 stop, `riskSized` = 5 shares. Ticket size = ₹5,000. If the stop is ₹25, `riskSized` = 4 shares. If the stop is >₹100, `riskSized` = 0, and the trade is skipped. The bot will be unable to trade high-priced stocks or volatile stocks.

### 2. Risk Engine & Capital Guards
- **File:** `src/server/RiskEngine.ts:92-99`
  ```typescript
  const monthlyPnl = this.ledger.monthlyRealizedPnl();
  const monthlyDdPct = (Math.abs(Math.min(0, monthlyPnl)) / this.config.risk.availableCapital) * 100;
  if (monthlyDdPct > this.config.risk.maxMonthlyDrawdownPct) {
    failures.push(`Monthly drawdown ${monthlyDdPct.toFixed(1)}% exceeds max...`);
  }
  ```
  **Impact:** This guard halts *new* entries if the monthly loss exceeds 2% (default). It does **not** close existing positions. If the bot hits a -2% loss, it stops trading, but open positions remain exposed to market movements, meaning the month-end P&L will almost certainly be a loss, violating the "No Monthly Loss" goal.

- **File:** `src/server/AppConfig.ts:122-124`
  ```typescript
  availableCapital: num('AVAILABLE_CAPITAL', 500000),
  maxDailyDrawdown: num('MAX_DAILY_DRAWDOWN', 15000),
  maxTradeAllocation: num('MAX_TRADE_ALLOCATION', 20000),
  ```
  **Impact:** If the user sets `AVAILABLE_CAPITAL=10000` but leaves the other defaults, `maxDailyDrawdown` is ₹15,000 (150% of capital) and will never trigger. `maxTradeAllocation` is ₹20,000, allowing the bot to deploy 200% of capital in a single trade (blocked later by the cash reserve, but still misconfigured).

### 3. Cost Model
- **File:** `src/server/PaperTrader.ts:24-30`
  ```typescript
  let brokerage = (n * c.brokerageBps) / 10000;
  if (c.brokerageMax > 0) brokerage = Math.min(brokerage, c.brokerageMax);
  const statutory = (n * c.statutoryBps) / 10000;
  const gst = (brokerage * c.gstPct) / 100;
  return brokerage + statutory + gst;
  ```
  **Impact:** On a ₹5,000 trade, brokerage (3 bps) is ₹1.50, but the `brokerageMax` is ₹20. So brokerage is ₹1.50. Statutory (10 bps) is ₹5. GST (18% on brokerage) is ₹0.27. Total charges = ₹6.77 per leg. Round trip = ~₹13.54. This is a 0.27% drag per round trip. While not catastrophic, combined with slippage (2 bps = ₹1 per leg), it requires a gross edge of at least 0.3% just to break even.

### 4. EOD Layer
- **File:** `src/server/EodEngine.ts:28-46`
  **Impact:** The `squareOffIntraday` function only closes `MIS` (intraday) positions. However, `MarketAgent.ts:715` defaults to `CNC` (delivery) positions. Unless explicitly configured to use `MIS`, the bot will hold positions overnight, exposing the ₹10,000 capital to gap risks that could wipe out the account in a single day.

## Profitability Gaps
1. **Position Sizing Floor:** The risk-parity sizing (`MarketAgent.ts:530`) will return 0 for many viable trades on a ₹10,000 capital base, causing the bot to sit idle and miss opportunities.
2. **Cost Drag:** Small position sizes mean fixed costs (like the ₹20 brokerage cap, though it calculates percentage first) and slippage take a larger percentage bite of gross profits.
3. **Monthly Drawdown Locks in Loss:** The current monthly guard (`RiskEngine.ts:92`) stops trading after a loss but doesn't flatten the portfolio, guaranteeing a red month if the threshold is hit.
4. **Overnight Risk:** Defaulting to `CNC` product type (`MarketAgent.ts:715`) without an overnight gap risk management strategy for a ₹10k account is dangerous. A 10% gap down on a ₹5,000 position is a ₹500 loss (5% of capital), which exceeds the monthly drawdown limit in one morning.

## "No Monthly Loss" Guardrails
To guarantee a positive month-end P&L, the bot must actively manage the monthly P&L, not just halt entries. Implement these concrete rules:

1. **Trailing Monthly Profit Lock:**
   - Once the monthly realized P&L reaches a positive threshold (e.g., +1% of capital, or ₹100 on ₹10k), move all open position stop-losses to breakeven.
   - Once the monthly P&L reaches +2% (₹200), close all open positions and halt trading for the remainder of the month. This locks in a green month.

2. **Hard Monthly Stop-Loss (Flatten and Halt):**
   - If the monthly realized P&L drops to -1% (-₹100), immediately close ALL open positions (market orders) and halt all trading for the rest of the month. 
   - This ensures the maximum monthly loss is capped at -1% (plus slippage on the closing orders), preventing a -2% or worse month.

3. **Implementation Location:**
   - Modify `src/server/RiskEngine.ts:evaluate` to check the monthly P&L *before* evaluating the trade. If the monthly halt flag is active, reject the trade.
   - Add a new function in `src/server/EodEngine.ts` or `src/server/MarketAgent.ts` that runs on every tick/candle to check the monthly P&L against the hard stop and trailing lock thresholds, executing the flatten/halt logic.

## Realistic Growth Plan (₹5k/₹10k → ₹1L/month)
The 1-year target is **unachievable**. Here is an honest, realistic timeline:

- **Phase 1: Capital Preservation & Validation (Months 1-3)**
  - Start with ₹10,000.
  - Goal: Do not lose money. Aim for 2-3% per month (₹200-₹300/month).
  - Focus on proving the bot's edge net of costs. 
  - Expected Capital: ₹10,600 - ₹10,900.

- **Phase 2: Slow Compounding (Months 4-12)**
  - Continue aiming for 3-5% monthly.
  - Compound the small gains.
  - Expected Capital at Month 12: ₹10,000 * (1.04)^12 ≈ ₹16,000.
  - Monthly Income at Month 12: ~₹640 (4% of ₹16k).

- **Phase 3: Scaling Capital (Years 2-5)**
  - To reach ₹1L/month at a realistic 5% return, you need ₹20,00,000 capital.
  - You must inject external capital. Compounding ₹10k to ₹20L at 5% monthly takes over 10 years.
  - Add ₹5,000 - ₹10,000 per month from external income to accelerate the capital base growth.

**Revised Target:** Change the goal from "₹1L/month in 1 year" to "Build a ₹2L capital base over 2-3 years through compounding and external deposits, then aim for ₹10k/month (5% return)."

## Prioritized Action Items

1. **Implement Hard Monthly Flatten Logic (Critical for "No Monthly Loss" goal)**
   - **File:** `src/server/MarketAgent.ts` (add check in `onTicks` or `evaluateSymbol`)
   - **Action:** If `ledger.monthlyRealizedPnl() < -1% of capital`, close all open positions and set a `monthlyHalt` flag in `bot_state`. Check this flag at the start of `evaluateSymbol` to skip all logic.

2. **Fix Position Sizing for Small Capital**
   - **File:** `src/server/MarketAgent.ts:530-540`
   - **Action:** Change the sizing logic to allow a minimum of 1 share if `riskSized` is 0 but the `budget` can cover the `stopDist` for 1 share. Alternatively, switch to a fixed fractional model (e.g., 2% of capital per trade) for small accounts, ignoring ATR risk sizing until capital > ₹1L.

3. **Adjust Default Configurations for ₹10k Capital**
   - **File:** `.env` or `AppConfig.ts`
   - **Action:** Set `MAX_DAILY_DRAWDOWN=200` (2% of 10k), `MAX_TRADE_ALLOCATION=2000` (20% of 10k), `MAX_MONTHLY_DRAWDOWN_PCT=1`. 

4. **Switch to Intraday (MIS) Only for Small Capital**
   - **File:** `src/server/MarketAgent.ts:715`
   - **Action:** Change default `product` to `MIS` so `EodEngine.squareOffIntraday` actually squares off positions, eliminating overnight gap risk which is fatal for small accounts.

5. **Implement Trailing Monthly Profit Lock**
   - **File:** `src/server/MarketAgent.ts` (`checkExit` method)
   - **Action:** If `ledger.monthlyRealizedPnl() > 2% of capital`, force exit all open positions and set `monthlyHalt` flag to lock in the green month.