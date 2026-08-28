# 6-Month AI-Backed Mock Trade Report (kite-paper-node as real broker)

> **Strategy:** Cross-sectional momentum (12-month lookback, skip-1, top-5) + AI sentiment-regime switching & per-symbol veto/shrink
> **Capital:** ₹1,00,000 | **Window:** 2026-03-02 → 2026-08-14 (115 trading days, 6 monthly rebalances)
> **Broker:** kite-paper-node mock REST server (real NSE daily CSVs) — orders routed via LiveTrader → POST /orders/:variety
> **Execution:** Real LLM report (regime + bias) → MomentumStrategy → RiskEngine + PaperTrader → LiveTrader → mock broker

## Summary

| Metric | Value |
|---|---|
| Starting capital | ₹1,00,000 |
| Final equity | ₹1,02,187 |
| Total P&L | ₹2,187 (2.19%) |
| Winning days | 58 |
| Losing days | 57 |
| Total realized P&L | ₹-8,244 |
| Rebalance months | 6 |

## Per-Month Table

| Month | Start equity | End equity | Month return | Bought | Sold |
|---|---|---|---|---|---|
| 2026-03 | ₹1,00,000 | ₹94,651 | -5.35% | ASHOKLEY, SHRIRAMFIN, VEDL | — |
| 2026-04 | ₹94,651 | ₹90,312 | -4.58% | — | — |
| 2026-05 | ₹90,312 | ₹93,752 | 3.81% | — | ASHOKLEY |
| 2026-06 | ₹93,752 | ₹1,00,694 | 7.40% | ADANIPOWER, LAURUSLABS, CUMMINSIND | SHRIRAMFIN, VEDL |
| 2026-07 | ₹1,00,694 | ₹1,03,134 | 2.42% | HINDCOPPER, HINDALCO | — |
| 2026-08 | ₹1,03,134 | ₹1,02,187 | -0.92% | — | HINDALCO |

## Rebalance Log

- **2026-03-02** AI regime -0.64 (bearish_volatile) → exposure x0.40; bias [HINDCOPPER:AVOID, ASHOKLEY:CONSIDER_LONG, MUTHOOTFIN:AVOID]
- **2026-03-02** → target [HINDCOPPER, ASHOKLEY, MUTHOOTFIN, SHRIRAMFIN, VEDL] | bought [ASHOKLEY, SHRIRAMFIN, VEDL] | sold []
- **2026-04-01** AI regime 0.72 (bullish) → exposure x1.00; bias [HINDCOPPER:AVOID, ASHOKLEY:HOLD, LAURUSLABS:AVOID]
- **2026-04-01** → target [HINDCOPPER, ASHOKLEY, LAURUSLABS, SHRIRAMFIN, VEDL] | bought [] | sold []
- **2026-05-01** AI regime -0.31 (cautious_to_negative) → exposure x0.40; bias [HINDCOPPER:CONSIDER_LONG, LAURUSLABS:AVOID, CHENNPETRO:CONSIDER_LONG]
- **2026-05-01** → target [HINDCOPPER, LAURUSLABS, CHENNPETRO, VEDL, SHRIRAMFIN] | bought [] | sold [ASHOKLEY]
- **2026-06-01** AI regime 0.12 (cautiously optimistic) → exposure x1.00; bias [HINDCOPPER:AVOID, ADANIPOWER:CONSIDER_LONG, CHENNPETRO:AVOID]
- **2026-06-01** → target [HINDCOPPER, ADANIPOWER, CHENNPETRO, LAURUSLABS, CUMMINSIND] | bought [ADANIPOWER, LAURUSLABS, CUMMINSIND] | sold [SHRIRAMFIN, VEDL]
- **2026-07-01** AI regime 0.17 (cautiously optimistic with global headwinds) → exposure x1.00; bias [LAURUSLABS:HOLD, HINDCOPPER:CONSIDER_LONG, ADANIPOWER:TRIM_25]
- **2026-07-01** → target [LAURUSLABS, HINDCOPPER, ADANIPOWER, HINDALCO, CUMMINSIND] | bought [HINDCOPPER, HINDALCO] | sold []
- **2026-08-03** AI regime 0.62 (Bullish) → exposure x1.00; bias [LAURUSLABS:HOLD, ADANIPOWER:TRIM_25, ADANIENSOL:AVOID]
- **2026-08-03** → target [LAURUSLABS, ADANIPOWER, ADANIENSOL, HINDCOPPER, CUMMINSIND] | bought [] | sold [HINDALCO]

## Per-Day P&L

| Day | Date | Equity | Day P&L | Day % | Cum P&L | Cum % | Day Realized | Holdings |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-03-02 | ₹99,994 | ₹-6 | -0.01% | ₹-6 | -0.01% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 2 | 2026-03-04 | ₹98,854 | ₹-1,140 | -1.14% | ₹-1,146 | -1.15% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 3 | 2026-03-05 | ₹99,414 | ₹560 | 0.56% | ₹-586 | -0.59% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 4 | 2026-03-06 | ₹98,837 | ₹-577 | -0.58% | ₹-1,163 | -1.16% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 5 | 2026-03-09 | ₹98,108 | ₹-729 | -0.73% | ₹-1,892 | -1.89% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 6 | 2026-03-10 | ₹99,353 | ₹1,245 | 1.24% | ₹-647 | -0.65% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 7 | 2026-03-11 | ₹98,616 | ₹-737 | -0.74% | ₹-1,384 | -1.38% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 8 | 2026-03-12 | ₹98,298 | ₹-318 | -0.32% | ₹-1,702 | -1.70% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 9 | 2026-03-13 | ₹97,229 | ₹-1,069 | -1.07% | ₹-2,771 | -2.77% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 10 | 2026-03-16 | ₹97,157 | ₹-72 | -0.07% | ₹-2,843 | -2.84% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 11 | 2026-03-17 | ₹97,633 | ₹475 | 0.48% | ₹-2,367 | -2.37% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 12 | 2026-03-18 | ₹97,636 | ₹3 | 0.00% | ₹-2,364 | -2.36% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 13 | 2026-03-19 | ₹96,254 | ₹-1,381 | -1.38% | ₹-3,746 | -3.75% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 14 | 2026-03-20 | ₹96,253 | ₹-1 | -0.00% | ₹-3,747 | -3.75% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 15 | 2026-03-23 | ₹94,949 | ₹-1,304 | -1.30% | ₹-5,051 | -5.05% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 16 | 2026-03-24 | ₹95,532 | ₹583 | 0.58% | ₹-4,468 | -4.47% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 17 | 2026-03-25 | ₹96,488 | ₹956 | 0.96% | ₹-3,512 | -3.51% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 18 | 2026-03-27 | ₹95,313 | ₹-1,175 | -1.17% | ₹-4,687 | -4.69% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 19 | 2026-03-30 | ₹94,651 | ₹-663 | -0.66% | ₹-5,349 | -5.35% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 20 | 2026-04-01 | ₹95,013 | ₹362 | 0.36% | ₹-4,987 | -4.99% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 21 | 2026-04-02 | ₹95,038 | ₹25 | 0.03% | ₹-4,962 | -4.96% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 22 | 2026-04-06 | ₹95,551 | ₹513 | 0.51% | ₹-4,449 | -4.45% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 23 | 2026-04-07 | ₹95,998 | ₹447 | 0.45% | ₹-4,002 | -4.00% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 24 | 2026-04-08 | ₹97,957 | ₹1,958 | 1.96% | ₹-2,043 | -2.04% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 25 | 2026-04-09 | ₹97,807 | ₹-149 | -0.15% | ₹-2,193 | -2.19% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 26 | 2026-04-10 | ₹98,593 | ₹786 | 0.79% | ₹-1,407 | -1.41% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 27 | 2026-04-13 | ₹98,182 | ₹-411 | -0.41% | ₹-1,818 | -1.82% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 28 | 2026-04-15 | ₹98,700 | ₹518 | 0.52% | ₹-1,300 | -1.30% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 29 | 2026-04-16 | ₹99,012 | ₹312 | 0.31% | ₹-988 | -0.99% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 30 | 2026-04-17 | ₹99,128 | ₹115 | 0.12% | ₹-872 | -0.87% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 31 | 2026-04-20 | ₹99,034 | ₹-94 | -0.09% | ₹-966 | -0.97% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 32 | 2026-04-21 | ₹99,007 | ₹-27 | -0.03% | ₹-993 | -0.99% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 33 | 2026-04-22 | ₹98,974 | ₹-34 | -0.03% | ₹-1,026 | -1.03% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 34 | 2026-04-23 | ₹97,930 | ₹-1,044 | -1.04% | ₹-2,070 | -2.07% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 35 | 2026-04-24 | ₹97,710 | ₹-219 | -0.22% | ₹-2,290 | -2.29% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 36 | 2026-04-27 | ₹97,617 | ₹-93 | -0.09% | ₹-2,383 | -2.38% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 37 | 2026-04-28 | ₹97,275 | ₹-342 | -0.34% | ₹-2,725 | -2.73% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 38 | 2026-04-29 | ₹97,707 | ₹432 | 0.43% | ₹-2,293 | -2.29% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 39 | 2026-04-30 | ₹90,312 | ₹-7,395 | -7.39% | ₹-9,688 | -9.69% | ₹0 | ASHOKLEY×47, SHRIRAMFIN×10, VEDL×14 |
| 40 | 2026-05-01 | ₹92,519 | ₹2,207 | 2.21% | ₹-7,481 | -7.48% | ₹-2,232 | SHRIRAMFIN×10, VEDL×14 |
| 41 | 2026-05-04 | ₹93,074 | ₹554 | 0.55% | ₹-6,926 | -6.93% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 42 | 2026-05-05 | ₹93,243 | ₹169 | 0.17% | ₹-6,757 | -6.76% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 43 | 2026-05-06 | ₹93,815 | ₹572 | 0.57% | ₹-6,185 | -6.19% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 44 | 2026-05-07 | ₹93,776 | ₹-38 | -0.04% | ₹-6,224 | -6.22% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 45 | 2026-05-08 | ₹93,572 | ₹-204 | -0.20% | ₹-6,428 | -6.43% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 46 | 2026-05-11 | ₹93,281 | ₹-291 | -0.29% | ₹-6,719 | -6.72% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 47 | 2026-05-12 | ₹92,919 | ₹-362 | -0.36% | ₹-7,081 | -7.08% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 48 | 2026-05-13 | ₹93,076 | ₹157 | 0.16% | ₹-6,924 | -6.92% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 49 | 2026-05-14 | ₹93,440 | ₹363 | 0.36% | ₹-6,560 | -6.56% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 50 | 2026-05-15 | ₹93,358 | ₹-82 | -0.08% | ₹-6,642 | -6.64% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 51 | 2026-05-18 | ₹93,259 | ₹-99 | -0.10% | ₹-6,741 | -6.74% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 52 | 2026-05-19 | ₹93,345 | ₹86 | 0.09% | ₹-6,655 | -6.66% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 53 | 2026-05-20 | ₹93,251 | ₹-94 | -0.09% | ₹-6,749 | -6.75% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 54 | 2026-05-21 | ₹93,108 | ₹-143 | -0.14% | ₹-6,892 | -6.89% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 55 | 2026-05-22 | ₹93,373 | ₹265 | 0.27% | ₹-6,627 | -6.63% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 56 | 2026-05-25 | ₹93,618 | ₹245 | 0.25% | ₹-6,382 | -6.38% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 57 | 2026-05-26 | ₹93,694 | ₹76 | 0.08% | ₹-6,306 | -6.31% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 58 | 2026-05-27 | ₹93,942 | ₹248 | 0.25% | ₹-6,058 | -6.06% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 59 | 2026-05-28 | ₹93,942 | ₹0 | 0.00% | ₹-6,058 | -6.06% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 60 | 2026-05-29 | ₹93,752 | ₹-190 | -0.19% | ₹-6,248 | -6.25% | ₹0 | SHRIRAMFIN×10, VEDL×14 |
| 61 | 2026-06-01 | ₹99,992 | ₹6,240 | 6.24% | ₹-8 | -0.01% | ₹-6,795 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 62 | 2026-06-02 | ₹1,00,221 | ₹229 | 0.23% | ₹221 | 0.22% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 63 | 2026-06-03 | ₹1,00,089 | ₹-132 | -0.13% | ₹89 | 0.09% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 64 | 2026-06-04 | ₹1,00,449 | ₹360 | 0.36% | ₹449 | 0.45% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 65 | 2026-06-05 | ₹1,00,802 | ₹353 | 0.35% | ₹802 | 0.80% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 66 | 2026-06-08 | ₹99,602 | ₹-1,200 | -1.20% | ₹-398 | -0.40% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 67 | 2026-06-09 | ₹99,848 | ₹246 | 0.25% | ₹-152 | -0.15% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 68 | 2026-06-10 | ₹99,073 | ₹-775 | -0.77% | ₹-927 | -0.93% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 69 | 2026-06-11 | ₹98,694 | ₹-378 | -0.38% | ₹-1,306 | -1.31% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 70 | 2026-06-12 | ₹99,342 | ₹648 | 0.65% | ₹-658 | -0.66% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 71 | 2026-06-15 | ₹99,392 | ₹50 | 0.05% | ₹-608 | -0.61% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 72 | 2026-06-16 | ₹99,337 | ₹-55 | -0.05% | ₹-663 | -0.66% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 73 | 2026-06-17 | ₹99,349 | ₹12 | 0.01% | ₹-651 | -0.65% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 74 | 2026-06-18 | ₹1,00,040 | ₹691 | 0.69% | ₹40 | 0.04% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 75 | 2026-06-19 | ₹1,00,571 | ₹531 | 0.53% | ₹571 | 0.57% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 76 | 2026-06-22 | ₹1,00,729 | ₹157 | 0.16% | ₹729 | 0.73% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 77 | 2026-06-23 | ₹1,00,970 | ₹241 | 0.24% | ₹970 | 0.97% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 78 | 2026-06-24 | ₹1,00,237 | ₹-732 | -0.73% | ₹237 | 0.24% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 79 | 2026-06-25 | ₹1,00,337 | ₹100 | 0.10% | ₹337 | 0.34% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 80 | 2026-06-26 | ₹1,00,337 | ₹0 | 0.00% | ₹337 | 0.34% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 81 | 2026-06-29 | ₹1,00,497 | ₹160 | 0.16% | ₹497 | 0.50% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 82 | 2026-06-30 | ₹1,00,694 | ₹197 | 0.20% | ₹694 | 0.69% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2 |
| 83 | 2026-07-01 | ₹1,00,654 | ₹-40 | -0.04% | ₹654 | 0.65% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 84 | 2026-07-02 | ₹1,00,883 | ₹229 | 0.23% | ₹883 | 0.88% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 85 | 2026-07-03 | ₹1,00,764 | ₹-119 | -0.12% | ₹764 | 0.76% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 86 | 2026-07-06 | ₹1,01,058 | ₹294 | 0.29% | ₹1,058 | 1.06% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 87 | 2026-07-07 | ₹1,00,059 | ₹-998 | -1.00% | ₹59 | 0.06% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 88 | 2026-07-08 | ₹99,855 | ₹-204 | -0.20% | ₹-145 | -0.14% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 89 | 2026-07-09 | ₹1,00,181 | ₹326 | 0.33% | ₹181 | 0.18% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 90 | 2026-07-10 | ₹1,00,998 | ₹817 | 0.82% | ₹998 | 1.00% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 91 | 2026-07-13 | ₹1,00,864 | ₹-134 | -0.13% | ₹864 | 0.86% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 92 | 2026-07-14 | ₹1,01,477 | ₹613 | 0.61% | ₹1,477 | 1.48% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 93 | 2026-07-15 | ₹1,00,780 | ₹-697 | -0.70% | ₹780 | 0.78% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 94 | 2026-07-16 | ₹1,00,709 | ₹-72 | -0.07% | ₹709 | 0.71% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 95 | 2026-07-17 | ₹99,803 | ₹-906 | -0.91% | ₹-197 | -0.20% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 96 | 2026-07-20 | ₹1,00,565 | ₹762 | 0.76% | ₹565 | 0.57% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 97 | 2026-07-21 | ₹1,01,277 | ₹712 | 0.71% | ₹1,277 | 1.28% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 98 | 2026-07-22 | ₹1,00,847 | ₹-429 | -0.43% | ₹847 | 0.85% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 99 | 2026-07-23 | ₹1,00,594 | ₹-253 | -0.25% | ₹594 | 0.59% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 100 | 2026-07-24 | ₹1,00,713 | ₹118 | 0.12% | ₹713 | 0.71% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 101 | 2026-07-27 | ₹1,01,939 | ₹1,226 | 1.23% | ₹1,939 | 1.94% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 102 | 2026-07-28 | ₹1,01,427 | ₹-511 | -0.51% | ₹1,427 | 1.43% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 103 | 2026-07-29 | ₹1,02,112 | ₹685 | 0.68% | ₹2,112 | 2.11% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 104 | 2026-07-30 | ₹1,02,181 | ₹68 | 0.07% | ₹2,181 | 2.18% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 105 | 2026-07-31 | ₹1,03,134 | ₹953 | 0.95% | ₹3,134 | 3.13% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13, HINDALCO×15 |
| 106 | 2026-08-03 | ₹1,02,824 | ₹-310 | -0.31% | ₹2,824 | 2.82% | ₹783 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13 |
| 107 | 2026-08-04 | ₹1,02,938 | ₹114 | 0.11% | ₹2,938 | 2.94% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13 |
| 108 | 2026-08-05 | ₹1,03,045 | ₹107 | 0.11% | ₹3,045 | 3.05% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13 |
| 109 | 2026-08-06 | ₹1,03,022 | ₹-24 | -0.02% | ₹3,022 | 3.02% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13 |
| 110 | 2026-08-07 | ₹1,03,141 | ₹119 | 0.12% | ₹3,141 | 3.14% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13 |
| 111 | 2026-08-10 | ₹1,03,260 | ₹119 | 0.12% | ₹3,260 | 3.26% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13 |
| 112 | 2026-08-11 | ₹1,03,147 | ₹-113 | -0.11% | ₹3,147 | 3.15% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13 |
| 113 | 2026-08-12 | ₹1,03,098 | ₹-48 | -0.05% | ₹3,098 | 3.10% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13 |
| 114 | 2026-08-13 | ₹1,02,916 | ₹-182 | -0.18% | ₹2,916 | 2.92% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13 |
| 115 | 2026-08-14 | ₹1,02,187 | ₹-729 | -0.73% | ₹2,187 | 2.19% | ₹0 | ADANIPOWER×64, LAURUSLABS×10, CUMMINSIND×2, HINDCOPPER×13 |

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