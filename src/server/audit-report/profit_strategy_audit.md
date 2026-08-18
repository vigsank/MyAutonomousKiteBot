## Executive Summary
- [FAIL] The 1-year ₹10k stepping goal is mathematically and structurally impossible with the current momentum strategy. Fixed costs (brokerage) and minimum capital requirements will guarantee a net loss in Month 1.
- [FAIL] The cost model in `PaperTrader.ts:30` uses bps for brokerage, yielding ₹0.48 on a ₹1,600 trade instead of the real ₹20 flat fee. This makes your backtests dangerously fake for small accounts.
- [WARN] The 5-10 stock momentum portfolio cannot be properly diversified with ₹10,000. 80% deployed is ₹8,000, leaving ₹1,600 per stock. Fixed costs will consume 2.7% per round trip, destroying the 1.25% expected monthly momentum premium.
- [WARN] The 2% monthly drawdown guard (`RiskEngine.ts:100`) is ₹200 on a ₹10k account. A single normal market fluctuation will trigger a month-long halt, preventing recovery.
- [PASS] The LLM as a filter-only (`AiAuthorityPolicy.ts`) and the hard risk caps in `RiskEngine.ts` are well-designed and prevent catastrophic loss.
- [PASS] The tax model (`Tax.ts:50`) correctly applies 20% STCG, which is crucial for a monthly rebalancing strategy.

## The Math — Is the Goal Feasible?
Let's do the math on your Month 1 goal with ₹10,000.
- **Capital**: ₹10,000. 
- **Cash Reserve**: 20% (`AppConfig.ts`), leaving ₹8,000 deployable.
- **Portfolio**: 5 stocks (`MomentumStrategy.ts:140`), so ₹1,600 per stock.
- **Real Costs (India)**: Zerodha charges a flat ₹20 per trade. STT is 0.1% on buy and sell. 
  - Buy: ₹20 (brokerage) + ₹1.60 (STT) = ₹21.60
  - Sell: ₹20 (brokerage) + ₹1.60 (STT) = ₹21.60
  - Total round-trip cost per stock: ₹43.20.
- **Cost as % of position**: ₹43.20 / ₹1,600 = **2.7%**.
- **Expected Momentum Return**: ~15% annualized = **1.25% per month**.
- **Net Monthly Return per stock**: 1.25% - 2.7% = **-1.45%**.
- **Month 1 P&L**: -1.45% * 5 stocks = **-₹116**. 

**Verdict**: You will fail the goal in Month 1. Cumulative P&L will be negative. To overcome a 2.7% cost drag, you need > 2.7% monthly return (32% annualized), which no momentum strategy sustains.

**Required Capital Base for Sustainable Profit**:
- You need the fixed ₹20 brokerage to be negligible. That happens at ₹16,000 per stock (0.125%).
- For a 5-stock portfolio: 5 * ₹16,000 = ₹80,000 deployable.
- With 20% cash reserve, total capital needed = **₹1,00,000**.
- At ₹1L, expected net monthly profit is ~0.98% = **₹980**.

## Codebase & Algorithm Review
- **`MomentumStrategy.ts:140` (`quantityFor`)**: Divides deployable capital by `slots` (5-10). With 10k, this creates tiny ₹1,600 tickets. There is no minimum capital floor to prevent this.
- **`PaperTrader.ts:30` (`charges`)**: `brokerage = (n * c.brokerageBps) / 10000`. For a ₹1,600 trade at 3bps, this yields ₹0.48. It caps at `c.brokerageMax` (20), but 0.48 is far below 20. This is a fatal flaw for small accounts. The bot thinks costs are 0.3% when they are 2.7%.
- **`RiskEngine.ts:100` (`maxMonthlyDrawdownPct`)**: 2% of 10k is ₹200. `currentDrawdown()` includes unrealized P&L. A single ₹1,600 position moving 12.5% hits this. The bot will halt constantly, making it impossible to recover.
- **`Tax.ts:50` (`estimateTax`)**: 20% STCG. Correct, but adds another drag on monthly rebalances. If you make 1.25% gross, you keep 1.0% after tax.
- **`DailyReportEngine.ts:60`**: LLM suggests allocations, but `RiskEngine` enforces. Good design.
- **`EodEngine.ts:30`**: Squares off MIS. Momentum uses CNC, so this is fine.
- **`GoLiveLadder.ts:30`**: `maxDrawdownPct` 45%. Too wide for a 10k account. 45% of 10k is ₹4,500, which violates your "no cumulative loss" rule.

## Profitability Gaps
1. **Fixed Cost Ignorance**: The bot assumes brokerage scales linearly with bps. In India, discount brokers charge a flat ₹20 per trade. For a ₹1,600 trade, ₹20 is 1.25%, not 0.03%. Your backtests are lying to you.
2. **Over-Diversification on Small Capital**: 5-10 stocks on ₹10,000 means ₹1,000-1,600 per stock. This guarantees fixed costs dominate.
3. **Monthly Drawdown Guard is Too Tight**: 2% of 10k is ₹200. One bad stock will trigger this and halt trading for the month, preventing recovery.
4. **Tax Drag on Monthly Rebalance**: 20% STCG on short-term gains. If you make 1.25%, you keep 1.0%. This leaves almost no margin for error after costs.

## "No Monthly Loss" Guardrails
To guarantee no monthly loss pushes Cum P&L negative, you need a dynamic portfolio stop.
1. **Cumulative Profit Stop**: If `Cum P&L + Unrealized P&L < 0`, close all positions immediately.
   - Implementation in `RiskEngine.ts`: Add a check `if (this.ledger.cumulativeRealizedPnl() + this.ledger.unrealizedPnl() < 0) { failures.push('Cumulative P&L stop breached'); }`
2. **Position Size Floor**: Do not trade if `deployable / slots < 16000`. (i.e., need at least ₹16,000 per stock to make fixed costs manageable).
   - Implementation in `MomentumStrategy.ts:140`: `if (perNameTarget < 16000) return 0;`
3. **Dynamic Drawdown Guard**: Instead of 2% of total capital, use 50% of current Cum P&L. If Cum P&L is ₹500, max loss is ₹250.
   - Implementation in `RiskEngine.ts:100`: `const maxLoss = Math.max(200, this.ledger.cumulativeRealizedPnl() * 0.5);`

## Realistic Growth Plan (₹10k → +₹10k/month stepping)
- **Months 1-9**: Do NOT trade with the bot. Manually invest the ₹10,000/month into a Nifty BeES or a single large-cap stock to accumulate capital without bleeding to brokerage.
- **Month 10**: Capital = ₹1,00,000. Turn on the bot. Deployable = ₹80,000. 5 stocks = ₹16,000 each.
- **Month 11**: Capital = ₹1,10,000 + profits.
- **Month 12**: Capital = ₹1,20,000 + profits.
- **Expected monthly profit at 100k**: ~0.98% = ₹980. Over 3 months (Months 10-12): ~₹3,000.
- **Honest verdict**: The 1-year goal of trading from Month 1 with 10k is dead. The realistic timeline to profitability is Month 10, assuming you save 10k/month manually first.

## Prioritized Action Items
1. **Fix the cost model** in `PaperTrader.ts:30` to use a flat ₹20 per trade instead of bps for small notional. This will show you the truth in backtests.
2. **Add a capital floor** in `MomentumStrategy.ts:140` to refuse trading if `perNameTarget < 16000`.
3. **Implement the `CumulativeProfitStop`** in `RiskEngine.ts` to enforce the "no monthly loss" rule.
4. **Adjust `maxMonthlyDrawdownPct`** in `RiskEngine.ts:100` to be dynamic based on Cum P&L.
5. **Advise the user** to manually accumulate capital to ₹1L before enabling the bot.