# 2-Month AI-Backed Mock Trade Report (shrink-not-block veto)

> **Strategy:** Cross-sectional momentum (12-month lookback, skip-1, top-5) + AI sentiment-regime switching & per-symbol veto (shrink-not-block)
> **Capital:** ₹1,00,000 | **Window:** 2026-07-01 → 2026-08-14 (33 trading days, 2 monthly rebalances)
> **Broker:** kite-paper-node mock REST server (real NSE daily CSVs) — orders routed via LiveTrader → POST /orders/:variety
> **Execution:** Real LLM report (regime + bias) → MomentumStrategy → RiskEngine + PaperTrader → LiveTrader → mock broker

## Summary

| Metric | Value |
|---|---|
| Starting capital | ₹1,00,000 |
| Final equity | ₹99,991 |
| Total P&L | ₹-9 (-0.01%) |
| Winning days | 16 |
| Losing days | 17 |
| Total realized P&L | ₹1,830 |
| Rebalance months | 2 |

## Per-Month Table

| Month | Start equity | End equity | Month return | Bought | Sold |
|---|---|---|---|---|---|
| 2026-07 | ₹1,00,000 | ₹1,00,170 | 0.17% | LAURUSLABS, HINDCOPPER, ADANIPOWER, HINDALCO, CUMMINSIND | — |
| 2026-08 | ₹1,00,170 | ₹99,991 | -0.18% | — | HINDALCO, SAIL, WELCORP, POLYCAB, RBLBANK, BSE |

## Rebalance Log

- **2026-07-01** AI regime 0.05 (cautiously optimistic with global headwinds) → exposure x1.00; bias [LAURUSLABS:CONSIDER_LONG, HINDCOPPER:AVOID, ADANIPOWER:AVOID]
- **2026-07-01** → target [LAURUSLABS, HINDCOPPER, ADANIPOWER, HINDALCO, CUMMINSIND] | bought [LAURUSLABS, HINDCOPPER, ADANIPOWER, HINDALCO, CUMMINSIND] | sold []
- **2026-08-03** AI regime 0.60 (Bullish) → exposure x1.00; bias [LAURUSLABS:BUY_ACCUMULATE, HINDCOPPER:TRIM_25, BHARATFORG:HOLD, RELIANCE:CONSIDER_LONG, TCS:CONSIDER_LONG]
- **2026-08-03** → target [LAURUSLABS, HINDCOPPER, BHARATFORG, CUMMINSIND, CHENNPETRO] | bought [] | sold [HINDALCO, SAIL, WELCORP, POLYCAB, RBLBANK, BSE]

## Per-Day P&L

| Day | Date | Equity | Day P&L | Day % | Cum P&L | Cum % | Day Realized | Holdings |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-07-01 | ₹99,989 | ₹-11 | -0.01% | ₹-11 | -0.01% | ₹0 | LAURUSLABS×10, HINDCOPPER×16, ADANIPOWER×35, HINDALCO×15, CUMMINSIND×2 |
| 2 | 2026-07-02 | ₹1,00,060 | ₹72 | 0.07% | ₹60 | 0.06% | ₹0 | LAURUSLABS×10, HINDCOPPER×16, ADANIPOWER×35, HINDALCO×15, CUMMINSIND×2, ADANIENSOL×4 |
| 3 | 2026-07-03 | ₹1,00,081 | ₹21 | 0.02% | ₹81 | 0.08% | ₹0 | LAURUSLABS×10, HINDCOPPER×16, ADANIPOWER×35, HINDALCO×15, CUMMINSIND×2, ADANIENSOL×4 |
| 4 | 2026-07-06 | ₹99,946 | ₹-136 | -0.14% | ₹-54 | -0.05% | ₹0 | LAURUSLABS×10, HINDCOPPER×16, ADANIPOWER×35, HINDALCO×15, CUMMINSIND×2, ADANIENSOL×4, GLENMARK×3, RBLBANK×13, WELCORP×1 |
| 5 | 2026-07-07 | ₹99,340 | ₹-606 | -0.61% | ₹-660 | -0.66% | ₹2,889 | HINDCOPPER×16, ADANIPOWER×35, HINDALCO×15, CUMMINSIND×2, ADANIENSOL×4, GLENMARK×3, RBLBANK×13, WELCORP×1 |
| 6 | 2026-07-08 | ₹98,191 | ₹-1,150 | -1.15% | ₹-1,809 | -1.81% | ₹-16 | HINDCOPPER×16, ADANIPOWER×35, HINDALCO×15, CUMMINSIND×2, ADANIENSOL×4, GLENMARK×3, WELCORP×1, CHENNPETRO×5 |
| 7 | 2026-07-09 | ₹97,028 | ₹-1,162 | -1.16% | ₹-2,972 | -2.97% | ₹0 | HINDCOPPER×16, ADANIPOWER×35, HINDALCO×15, CUMMINSIND×2, ADANIENSOL×4, GLENMARK×3, WELCORP×1, CHENNPETRO×5, LAURUSLABS×4, SAIL×28 |
| 8 | 2026-07-10 | ₹98,044 | ₹1,016 | 1.02% | ₹-1,956 | -1.96% | ₹0 | HINDCOPPER×16, ADANIPOWER×35, HINDALCO×15, CUMMINSIND×2, ADANIENSOL×4, GLENMARK×3, WELCORP×1, CHENNPETRO×5, LAURUSLABS×4, SAIL×28, BHEL×5, RBLBANK×3 |
| 9 | 2026-07-13 | ₹97,823 | ₹-221 | -0.22% | ₹-2,177 | -2.18% | ₹0 | HINDCOPPER×16, ADANIPOWER×35, HINDALCO×15, CUMMINSIND×2, ADANIENSOL×4, GLENMARK×3, WELCORP×1, CHENNPETRO×5, LAURUSLABS×4, SAIL×28, BHEL×5, RBLBANK×3 |
| 10 | 2026-07-14 | ₹99,123 | ₹1,301 | 1.30% | ₹-877 | -0.88% | ₹-21 | HINDCOPPER×16, ADANIPOWER×35, HINDALCO×15, CUMMINSIND×2, ADANIENSOL×4, GLENMARK×3, WELCORP×1, LAURUSLABS×4, SAIL×28, BHEL×5, RBLBANK×3 |
| 11 | 2026-07-15 | ₹98,054 | ₹-1,070 | -1.07% | ₹-1,946 | -1.95% | ₹-780 | HINDCOPPER×16, HINDALCO×15, CUMMINSIND×2, ADANIENSOL×4, GLENMARK×3, WELCORP×1, LAURUSLABS×4, SAIL×28, BHEL×5, RBLBANK×3, CHENNPETRO×5 |
| 12 | 2026-07-16 | ₹98,628 | ₹574 | 0.57% | ₹-1,372 | -1.37% | ₹-4 | HINDCOPPER×16, HINDALCO×15, CUMMINSIND×2, ADANIENSOL×4, GLENMARK×3, WELCORP×1, LAURUSLABS×4, SAIL×28, BHEL×5, CHENNPETRO×5 |
| 13 | 2026-07-17 | ₹99,203 | ₹575 | 0.57% | ₹-797 | -0.80% | ₹-593 | HINDCOPPER×16, HINDALCO×15, ADANIENSOL×4, GLENMARK×3, LAURUSLABS×4, SAIL×28, BHARATFORG×2 |
| 14 | 2026-07-20 | ₹98,621 | ₹-582 | -0.58% | ₹-1,379 | -1.38% | ₹0 | HINDCOPPER×16, HINDALCO×15, ADANIENSOL×4, GLENMARK×3, LAURUSLABS×4, SAIL×28, BHARATFORG×2, ADANIPOWER×19, WELCORP×4 |
| 15 | 2026-07-21 | ₹98,800 | ₹179 | 0.18% | ₹-1,200 | -1.20% | ₹0 | HINDCOPPER×16, HINDALCO×15, ADANIENSOL×4, GLENMARK×3, LAURUSLABS×4, SAIL×28, BHARATFORG×2, ADANIPOWER×19, WELCORP×4, CHENNPETRO×5 |
| 16 | 2026-07-22 | ₹98,344 | ₹-457 | -0.46% | ₹-1,656 | -1.66% | ₹0 | HINDCOPPER×16, HINDALCO×15, ADANIENSOL×4, GLENMARK×3, LAURUSLABS×4, SAIL×28, BHARATFORG×2, ADANIPOWER×19, WELCORP×4, CHENNPETRO×5, POLYCAB×1 |
| 17 | 2026-07-23 | ₹98,065 | ₹-279 | -0.28% | ₹-1,935 | -1.94% | ₹-21 | HINDCOPPER×16, HINDALCO×15, ADANIENSOL×4, GLENMARK×3, LAURUSLABS×4, SAIL×28, BHARATFORG×2, ADANIPOWER×19, WELCORP×4, POLYCAB×1 |
| 18 | 2026-07-24 | ₹97,803 | ₹-261 | -0.26% | ₹-2,197 | -2.20% | ₹0 | HINDCOPPER×16, HINDALCO×15, ADANIENSOL×4, GLENMARK×3, LAURUSLABS×4, SAIL×28, BHARATFORG×2, ADANIPOWER×19, WELCORP×4, POLYCAB×1 |
| 19 | 2026-07-27 | ₹98,283 | ₹480 | 0.48% | ₹-1,717 | -1.72% | ₹0 | HINDCOPPER×16, HINDALCO×15, ADANIENSOL×4, GLENMARK×3, LAURUSLABS×4, SAIL×28, BHARATFORG×2, ADANIPOWER×19, WELCORP×4, POLYCAB×1, RBLBANK×10 |
| 20 | 2026-07-28 | ₹97,996 | ₹-287 | -0.29% | ₹-2,004 | -2.00% | ₹-32 | HINDCOPPER×16, HINDALCO×15, GLENMARK×3, LAURUSLABS×4, SAIL×28, BHARATFORG×2, WELCORP×4, POLYCAB×1, RBLBANK×10 |
| 21 | 2026-07-29 | ₹99,204 | ₹1,208 | 1.21% | ₹-796 | -0.80% | ₹0 | HINDCOPPER×16, HINDALCO×15, GLENMARK×3, LAURUSLABS×4, SAIL×28, BHARATFORG×2, WELCORP×4, POLYCAB×1, RBLBANK×10, BSE×2, CHENNPETRO×2 |
| 22 | 2026-07-30 | ₹99,156 | ₹-48 | -0.05% | ₹-844 | -0.84% | ₹-22 | HINDCOPPER×16, HINDALCO×15, LAURUSLABS×4, SAIL×28, BHARATFORG×2, WELCORP×4, POLYCAB×1, RBLBANK×10, BSE×2, CHENNPETRO×2 |
| 23 | 2026-07-31 | ₹1,00,170 | ₹1,014 | 1.01% | ₹170 | 0.17% | ₹0 | HINDCOPPER×16, HINDALCO×15, LAURUSLABS×4, SAIL×28, BHARATFORG×2, WELCORP×4, POLYCAB×1, RBLBANK×10, BSE×2, CHENNPETRO×2, CUMMINSIND×1 |
| 24 | 2026-08-03 | ₹1,00,611 | ₹442 | 0.44% | ₹611 | 0.61% | ₹-75 | HINDCOPPER×16, LAURUSLABS×4, BHARATFORG×2, CHENNPETRO×2, CUMMINSIND×1 |
| 25 | 2026-08-04 | ₹1,00,691 | ₹80 | 0.08% | ₹691 | 0.69% | ₹0 | HINDCOPPER×16, LAURUSLABS×4, BHARATFORG×2, CHENNPETRO×2, CUMMINSIND×1 |
| 26 | 2026-08-05 | ₹1,00,893 | ₹202 | 0.20% | ₹893 | 0.89% | ₹0 | HINDCOPPER×16, LAURUSLABS×4, BHARATFORG×2, CHENNPETRO×2, CUMMINSIND×1, SHRIRAMFIN×6, RBLBANK×19, WELCORP×4 |
| 27 | 2026-08-06 | ₹1,01,531 | ₹638 | 0.64% | ₹1,531 | 1.53% | ₹0 | HINDCOPPER×16, LAURUSLABS×4, BHARATFORG×2, CHENNPETRO×2, CUMMINSIND×1, SHRIRAMFIN×6, RBLBANK×19, WELCORP×4, J&KBANK×48 |
| 28 | 2026-08-07 | ₹1,01,374 | ₹-157 | -0.16% | ₹1,374 | 1.37% | ₹0 | HINDCOPPER×16, LAURUSLABS×4, BHARATFORG×2, CHENNPETRO×2, CUMMINSIND×1, SHRIRAMFIN×6, RBLBANK×19, WELCORP×4, J&KBANK×48 |
| 29 | 2026-08-10 | ₹1,00,986 | ₹-387 | -0.39% | ₹986 | 0.99% | ₹-44 | HINDCOPPER×16, LAURUSLABS×4, CUMMINSIND×1, SHRIRAMFIN×6, RBLBANK×19, WELCORP×4 |
| 30 | 2026-08-11 | ₹1,01,447 | ₹460 | 0.46% | ₹1,447 | 1.45% | ₹0 | HINDCOPPER×16, LAURUSLABS×4, CUMMINSIND×1, SHRIRAMFIN×6, RBLBANK×19, WELCORP×4, CHENNPETRO×5 |
| 31 | 2026-08-12 | ₹1,01,130 | ₹-317 | -0.32% | ₹1,130 | 1.13% | ₹-21 | HINDCOPPER×16, LAURUSLABS×4, CUMMINSIND×1, SHRIRAMFIN×6, RBLBANK×19, WELCORP×4, BHEL×17 |
| 32 | 2026-08-13 | ₹1,01,142 | ₹12 | 0.01% | ₹1,142 | 1.14% | ₹0 | HINDCOPPER×16, LAURUSLABS×4, CUMMINSIND×1, SHRIRAMFIN×6, RBLBANK×19, WELCORP×4, BHEL×17 |
| 33 | 2026-08-14 | ₹99,991 | ₹-1,152 | -1.15% | ₹-9 | -0.01% | ₹568 | CUMMINSIND×1, SHRIRAMFIN×6, RBLBANK×19, WELCORP×4, BHEL×17, ADANIGREEN×5, ADANIENSOL×4 |

## Notes

- The mock broker is treated as the real Zerodha backend: orders are placed through its
  REST API, and the paper ledger (real NSE CSV fills) is the system of record.
- Momentum is a monthly-rebalance strategy: the target portfolio is recomputed at each
  month-start and the book is rebalanced through the mock broker. Day P&L is the
  mark-to-market change between trading days.
- Data is 5 years of real NSE daily closes (Aug 2021 → Aug 2026) from Yahoo, so the
  validated 12-month lookback is used throughout. The portfolio-drawdown guard (10%)
  can halt new entries after a drawdown, which is why some later months show buys blocked.
- The AI layer is REAL: each monthly rebalance calls DailyReportEngine.generate(pre_open),
  which runs the LLM (Ollama) + news sentiment and produces market_regime.regime_score
  (drives exposure scaling) and per-symbol action_bias (drives veto/shrink).
- Per-symbol news sentiment AND the global-macro numbers/headlines are DATE-SCOPED
  to each rebalance date (TinyFish time-range + Yahoo chart history), so the AI reads
  the news and market tone it would have seen then (no look-ahead).