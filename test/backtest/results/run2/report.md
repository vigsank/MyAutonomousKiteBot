# Mock-Data Backtest — 10 Cases (run2, 2x capital, AI-backed, real NSE data)

> Strategy: Bollinger mean-reversion + AI analyst (news sentiment + LLM verdict) gating entries. Paper-only, net of costs. 5-min bars from real historical CSVs.

## Summary

| Case | Holdings | New Cap | Total Cap | Picks | Days | Rebal | Trades | Win% | PF | Net P&L | Return | MaxDD | Final |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| case1 | 0 | ₹40,000 | ₹40,000 | 20 | 30 | 1d | 1 | 100.0% | inf | ₹3,359 | 8.40% | ₹0 (0.0%) | ₹43,359 |
| case2 | 2 | ₹40,000 | ₹55,000 | 18 | 30 | 1d | 3 | 33.3% | 247.91 | ₹10,202 | 18.55% | ₹41 (0.1%) | ₹65,202 |
| case3 | 10 | ₹60,000 | ₹1,20,000 | 10 | 30 | 1d | 11 | 36.4% | 1.38 | ₹179 | 0.15% | ₹448 (0.4%) | ₹1,20,179 |
| case4 | 0 | ₹20,000 | ₹20,000 | 10 | 30 | 1d | 1 | 100.0% | inf | ₹1,473 | 7.36% | ₹0 (0.0%) | ₹21,473 |
| case5 | 1 | ₹20,000 | ₹50,000 | 5 | 30 | 1d | 2 | 0.0% | 0.00 | ₹-344 | -0.69% | ₹344 (0.7%) | ₹49,656 |
| case6 | 5 | ₹1,00,000 | ₹1,50,000 | 15 | 30 | 1d | 6 | 50.0% | 0.04 | ₹-2,147 | -1.43% | ₹2,200 (1.5%) | ₹1,47,853 |
| case7 | 20 | ₹2,00,000 | ₹4,00,000 | 20 | 30 | 1d | 21 | 61.9% | 6.90 | ₹2,094 | 0.52% | ₹293 (0.1%) | ₹4,02,094 |
| case8 | 0 | ₹1,00,000 | ₹1,00,000 | 20 | 60 | 1d | 1 | 0.0% | 0.00 | ₹-309 | -0.31% | ₹309 (0.3%) | ₹99,691 |
| case9 | 10 | ₹60,000 | ₹1,20,000 | 10 | 30 | 5d | 11 | 63.6% | 5.13 | ₹664 | 0.55% | ₹89 (0.1%) | ₹1,20,664 |
| case10 | 0 | ₹10,00,000 | ₹10,00,000 | 40 | 30 | 1d | 1 | 100.0% | inf | ₹1,91,849 | 19.18% | ₹0 (0.0%) | ₹11,91,849 |

## case1

- **Setup:** 0 existing holding(s) worth ₹0 + ₹40,000 new capital = **₹40,000** total. Picked 20 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** BAJAJFINSV, CUMMINSIND, INDIGO, HDFCLIFE, IOC, MARICO, TVSMOTOR, HINDALCO, VEDL, DABUR, AXISBANK, SBILIFE, IRCTC, SBICARD, ICICIPRULI, MARUTI, BAJAJHLDNG, M&M, BHARTIARTL, TCS
- **Result:** 1 round trips, win rate 100.0%, profit factor inf, net P&L **₹3,359** (8.40%), max drawdown ₹0 (0.0%), final equity **₹43,359**.

| Symbol | P&L |
|---|---|
| BAJAJFINSV | ₹3,359 |

**Top trades:**
- BAJAJFINSV SHORT 21 @ 2024.60 → ₹3,359 (Closed LONG position. Backtest end — force close)

## case2

- **Setup:** 2 existing holding(s) worth ₹15,000 + ₹40,000 new capital = **₹55,000** total. Picked 18 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** NHPC, COFORGE, TATASTEEL, AXISBANK, ICICIBANK, INFY, HAL, TECHM, TITAN, ADANIENT, TATAPOWER, ADANIPOWER, JSWSTEEL, INDHOTEL, DABUR, BAJAJ-AUTO, BAJAJFINSV, SUNPHARMA
- **Result:** 3 round trips, win rate 33.3%, profit factor 247.91, net P&L **₹10,202** (18.55%), max drawdown ₹41 (0.1%), final equity **₹65,202**.

| Symbol | P&L |
|---|---|
| COFORGE | ₹10,222 |
| NHPC | ₹-19 |

**Top trades:**
- COFORGE SHORT 35 @ 1828.63 → ₹10,244 (Closed LONG position. Backtest end — force close)
- COFORGE SHORT 2 @ 1533.69 → ₹-22 (Closed LONG position. rebalance TRIM)
- NHPC SHORT 47 @ 78.73 → ₹-19 (Closed LONG position. rebalance TRIM)

## case3

- **Setup:** 10 existing holding(s) worth ₹60,000 + ₹60,000 new capital = **₹1,20,000** total. Picked 10 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** TATACONSUM, GODREJCP, NHPC, INDIGO, POWERGRID, MARICO, NAUKRI, ADANIPOWER, TATASTEEL, INFY
- **Result:** 11 round trips, win rate 36.4%, profit factor 1.38, net P&L **₹179** (0.15%), max drawdown ₹448 (0.4%), final equity **₹1,20,179**.

| Symbol | P&L |
|---|---|
| TATACONSUM | ₹409 |
| INDIGO | ₹99 |
| NAUKRI | ₹67 |
| NHPC | ₹23 |
| MARICO | ₹-14 |
| GODREJCP | ₹-20 |
| TATASTEEL | ₹-24 |
| INFY | ₹-76 |
| POWERGRID | ₹-83 |
| ADANIPOWER | ₹-203 |

**Top trades:**
- TATACONSUM SHORT 110 @ 1090.28 → ₹458 (Closed LONG position. Backtest end — force close)
- ADANIPOWER SHORT 26 @ 219.11 → ₹-203 (Closed LONG position. Bollinger target hit (price 219.15 >= middle band 218.99))
- INDIGO SHORT 1 @ 5219.96 → ₹99 (Closed LONG position. RSI 87.1 overbought (>70))
- POWERGRID SHORT 20 @ 282.89 → ₹-83 (Closed LONG position. Bollinger target hit (price 282.95 >= middle band 282.76))
- INFY SHORT 5 @ 1080.18 → ₹-76 (Closed LONG position. Bollinger target hit (price 1080.40 >= middle band 1080.09))
- NAUKRI SHORT 5 @ 1204.56 → ₹67 (Closed LONG position. RSI 73.2 overbought (>70))
- TATACONSUM SHORT 5 @ 1090.18 → ₹-49 (Closed LONG position. Bollinger target hit (price 1090.40 >= middle band 1089.79))
- TATASTEEL SHORT 31 @ 188.27 → ₹-24 (Closed LONG position. Bollinger target hit (price 188.31 >= middle band 188.20))

## case4

- **Setup:** 0 existing holding(s) worth ₹0 + ₹20,000 new capital = **₹20,000** total. Picked 10 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** MARICO, PIDILITIND, NAUKRI, CONCOR, DLF, IOC, LICI, CUMMINSIND, SBICARD, HEROMOTOCO
- **Result:** 1 round trips, win rate 100.0%, profit factor inf, net P&L **₹1,473** (7.36%), max drawdown ₹0 (0.0%), final equity **₹21,473**.

| Symbol | P&L |
|---|---|
| PIDILITIND | ₹1,473 |

**Top trades:**
- PIDILITIND SHORT 12 @ 1695.76 → ₹1,473 (Closed LONG position. Backtest end — force close)

## case5

- **Setup:** 1 existing holding(s) worth ₹30,000 + ₹20,000 new capital = **₹50,000** total. Picked 5 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** VBL, COLPAL, HDFCAMC, MAXHEALTH, AXISBANK
- **Result:** 2 round trips, win rate 0.0%, profit factor 0.00, net P&L **₹-344** (-0.69%), max drawdown ₹344 (0.7%), final equity **₹49,656**.

| Symbol | P&L |
|---|---|
| VBL | ₹-39 |
| COLPAL | ₹-305 |

**Top trades:**
- COLPAL SHORT 24 @ 1995.10 → ₹-305 (Closed LONG position. Backtest end — force close)
- VBL SHORT 31 @ 470.91 → ₹-39 (Closed LONG position. rebalance TRIM)

## case6

- **Setup:** 5 existing holding(s) worth ₹50,000 + ₹1,00,000 new capital = **₹1,50,000** total. Picked 15 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** GODREJPROP, TVSMOTOR, HCLTECH, COFORGE, TECHM, ULTRACEMCO, CGPOWER, ICICIGI, IRCTC, BHARATFORG, BALKRISIND, BAJAJHLDNG, BOSCHLTD, BHARTIARTL, SBICARD
- **Result:** 6 round trips, win rate 50.0%, profit factor 0.04, net P&L **₹-2,147** (-1.43%), max drawdown ₹2,200 (1.5%), final equity **₹1,47,853**.

| Symbol | P&L |
|---|---|
| GODREJPROP | ₹40 |
| COFORGE | ₹34 |
| HCLTECH | ₹15 |
| TVSMOTOR | ₹-8 |
| TECHM | ₹-35 |
| BHARATFORG | ₹-2,192 |

**Top trades:**
- BHARATFORG SHORT 70 @ 2087.58 → ₹-2,192 (Closed LONG position. Backtest end — force close)
- GODREJPROP SHORT 4 @ 2120.38 → ₹40 (Closed LONG position. Bollinger target hit (price 2120.80 >= middle band 2116.08))
- TECHM SHORT 6 @ 1482.30 → ₹-35 (Closed LONG position. Bollinger target hit (price 1482.60 >= middle band 1478.49))
- COFORGE SHORT 6 @ 1544.79 → ₹34 (Closed LONG position. Bollinger target hit (price 1545.10 >= middle band 1545.04))
- HCLTECH SHORT 8 @ 1171.37 → ₹15 (Closed LONG position. Bollinger target hit (price 1171.60 >= middle band 1171.51))
- TVSMOTOR SHORT 2 @ 3611.58 → ₹-8 (Closed LONG position. Bollinger target hit (price 3612.30 >= middle band 3601.11))

## case7

- **Setup:** 20 existing holding(s) worth ₹2,00,000 + ₹2,00,000 new capital = **₹4,00,000** total. Picked 20 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** COALINDIA, IDFCFIRSTB, HAL, PFC, UNIONBANK, ABB, TECHM, ICICIGI, AMBUJACEM, MARUTI, HCLTECH, NESTLEIND, IRCTC, DABUR, JIOFIN, TRENT, EICHERMOT, ONGC, BRITANNIA, TATACONSUM
- **Result:** 21 round trips, win rate 61.9%, profit factor 6.90, net P&L **₹2,094** (0.52%), max drawdown ₹293 (0.1%), final equity **₹4,02,094**.

| Symbol | P&L |
|---|---|
| TATACONSUM | ₹1,599 |
| ICICIGI | ₹121 |
| ABB | ₹105 |
| EICHERMOT | ₹98 |
| IDFCFIRSTB | ₹87 |
| AMBUJACEM | ₹77 |
| NESTLEIND | ₹72 |
| UNIONBANK | ₹67 |
| JIOFIN | ₹65 |
| BRITANNIA | ₹40 |
| PFC | ₹32 |
| TRENT | ₹2 |
| MARUTI | ₹0 |
| IRCTC | ₹-6 |
| HCLTECH | ₹-23 |
| DABUR | ₹-24 |
| TECHM | ₹-35 |
| ONGC | ₹-48 |
| HAL | ₹-49 |
| COALINDIA | ₹-84 |

**Top trades:**
- TATACONSUM SHORT 369 @ 1090.28 → ₹1,684 (Closed LONG position. Backtest end — force close)
- ICICIGI SHORT 5 @ 1815.34 → ₹121 (Closed LONG position. Target hit (price 1815.70 >= 1812.23))
- ABB SHORT 1 @ 7001.10 → ₹105 (Closed LONG position. RSI 73.1 overbought (>70))
- EICHERMOT SHORT 1 @ 7394.52 → ₹98 (Closed LONG position. Bollinger target hit (price 7396.00 >= middle band 7376.60))
- IDFCFIRSTB SHORT 126 @ 80.01 → ₹87 (Closed LONG position. RSI 92.7 overbought (>70))
- TATACONSUM SHORT 9 @ 1090.48 → ₹-85 (Closed LONG position. Bollinger target hit (price 1090.70 >= middle band 1089.69))
- COALINDIA SHORT 23 @ 428.56 → ₹-84 (Closed LONG position. Bollinger target hit (price 428.65 >= middle band 428.57))
- AMBUJACEM SHORT 23 @ 434.41 → ₹77 (Closed LONG position. RSI 72.9 overbought (>70))

## case8

- **Setup:** 0 existing holding(s) worth ₹0 + ₹1,00,000 new capital = **₹1,00,000** total. Picked 20 symbols, 60 days, rebalance every 1 day(s).
- **Symbols:** HDFCAMC, NAUKRI, CONCOR, IDFCFIRSTB, SBICARD, HAL, HAVELLS, JIOFIN, TRENT, COFORGE, CUMMINSIND, BHARTIARTL, ABB, VBL, BHEL, LICI, SIEMENS, COALINDIA, HDFCBANK, CIPLA
- **Result:** 1 round trips, win rate 0.0%, profit factor 0.00, net P&L **₹-309** (-0.31%), max drawdown ₹309 (0.3%), final equity **₹99,691**.

| Symbol | P&L |
|---|---|
| SBICARD | ₹-309 |

**Top trades:**
- SBICARD SHORT 155 @ 640.87 → ₹-309 (Closed LONG position. Backtest end — force close)

## case9

- **Setup:** 10 existing holding(s) worth ₹60,000 + ₹60,000 new capital = **₹1,20,000** total. Picked 10 symbols, 30 days, rebalance every 5 day(s).
- **Symbols:** IRFC, INDUSINDBK, TATACONSUM, DABUR, JIOFIN, HAL, CUMMINSIND, HAVELLS, VBL, EICHERMOT
- **Result:** 11 round trips, win rate 63.6%, profit factor 5.13, net P&L **₹664** (0.55%), max drawdown ₹89 (0.1%), final equity **₹1,20,664**.

| Symbol | P&L |
|---|---|
| TATACONSUM | ₹410 |
| INDUSINDBK | ₹100 |
| EICHERMOT | ₹96 |
| CUMMINSIND | ₹74 |
| JIOFIN | ₹43 |
| IRFC | ₹39 |
| HAL | ₹15 |
| HAVELLS | ₹-1 |
| DABUR | ₹-42 |
| VBL | ₹-70 |

**Top trades:**
- TATACONSUM SHORT 110 @ 1090.28 → ₹458 (Closed LONG position. Backtest end — force close)
- INDUSINDBK SHORT 6 @ 1016.35 → ₹100 (Closed LONG position. RSI 81.5 overbought (>70))
- EICHERMOT SHORT 1 @ 7392.52 → ₹96 (Closed LONG position. RSI 73.2 overbought (>70))
- CUMMINSIND SHORT 1 @ 5582.38 → ₹74 (Closed LONG position. RSI 73.0 overbought (>70))
- VBL SHORT 12 @ 465.66 → ₹-70 (Closed LONG position. Bollinger target hit (price 465.75 >= middle band 465.68))
- TATACONSUM SHORT 5 @ 1090.48 → ₹-47 (Closed LONG position. Bollinger target hit (price 1090.70 >= middle band 1089.69))
- JIOFIN SHORT 25 @ 238.30 → ₹43 (Closed LONG position. RSI 90.7 overbought (>70))
- DABUR SHORT 13 @ 433.11 → ₹-42 (Closed LONG position. Bollinger target hit (price 433.20 >= middle band 433.12))

## case10

- **Setup:** 0 existing holding(s) worth ₹0 + ₹10,00,000 new capital = **₹10,00,000** total. Picked 40 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** DABUR, INDHOTEL, ITC, HDFCBANK, COFORGE, TORNTPHARM, SOLARINDS, JIOFIN, BRITANNIA, ADANIENSOL, CUMMINSIND, APOLLOHOSP, TATACONSUM, INDUSINDBK, TRENT, LT, WIPRO, ADANIENT, ZYDUSLIFE, HDFCAMC, ICICIGI, IOC, PIDILITIND, ICICIBANK, KOTAKBANK, HAL, MUTHOOTFIN, HINDALCO, CHOLAFIN, RELIANCE, HINDUNILVR, HINDPETRO, MARUTI, SBILIFE, TITAN, TECHM, BHEL, MARICO, BAJAJHLDNG, GAIL
- **Result:** 1 round trips, win rate 100.0%, profit factor inf, net P&L **₹1,91,849** (19.18%), max drawdown ₹0 (0.0%), final equity **₹11,91,849**.

| Symbol | P&L |
|---|---|
| COFORGE | ₹1,91,849 |

**Top trades:**
- COFORGE SHORT 653 @ 1828.63 → ₹1,91,849 (Closed LONG position. Backtest end — force close)
