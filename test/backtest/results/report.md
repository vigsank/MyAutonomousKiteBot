# Mock-Data Backtest — 10 Cases (AI-backed, real NSE data)

> Strategy: Bollinger mean-reversion + AI analyst (news sentiment + LLM verdict) gating entries. Paper-only, net of costs. 5-min bars from real historical CSVs.

## Summary

| Case | Holdings | New Cap | Total Cap | Picks | Days | Rebal | Trades | Win% | PF | Net P&L | Return | MaxDD | Final |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| case1 | 0 | ₹20,000 | ₹20,000 | 20 | 30 | 1d | 1 | 100.0% | inf | ₹1,600 | 8.00% | ₹0 (0.0%) | ₹21,600 |
| case2 | 2 | ₹20,000 | ₹35,000 | 18 | 30 | 1d | 3 | 33.3% | 155.83 | ₹6,398 | 18.28% | ₹41 (0.1%) | ₹41,398 |
| case3 | 10 | ₹30,000 | ₹90,000 | 10 | 30 | 1d | 11 | 36.4% | 1.11 | ₹52 | 0.06% | ₹451 (0.5%) | ₹90,052 |
| case4 | 0 | ₹10,000 | ₹10,000 | 10 | 30 | 1d | 1 | 100.0% | inf | ₹736 | 7.36% | ₹0 (0.0%) | ₹10,736 |
| case5 | 1 | ₹10,000 | ₹40,000 | 5 | 30 | 1d | 1 | 0.0% | 0.00 | ₹-1,957 | -4.89% | ₹1,957 (4.9%) | ₹38,043 |
| case6 | 5 | ₹50,000 | ₹1,00,000 | 15 | 30 | 1d | 6 | 50.0% | 0.08 | ₹-1,426 | -1.43% | ₹1,523 (1.5%) | ₹98,574 |
| case7 | 20 | ₹1,00,000 | ₹3,00,000 | 20 | 30 | 1d | 21 | 66.7% | 6.13 | ₹1,704 | 0.57% | ₹262 (0.1%) | ₹3,01,704 |
| case8 | 0 | ₹50,000 | ₹50,000 | 20 | 60 | 1d | 1 | 0.0% | 0.00 | ₹-3 | -0.01% | ₹3 (0.0%) | ₹49,997 |
| case9 | 10 | ₹30,000 | ₹90,000 | 10 | 30 | 5d | 11 | 54.5% | 49.00 | ₹8,073 | 8.97% | ₹152 (0.2%) | ₹98,073 |
| case10 | 0 | ₹5,00,000 | ₹5,00,000 | 40 | 30 | 1d | 1 | 0.0% | 0.00 | ₹-24,691 | -4.94% | ₹24,691 (4.9%) | ₹4,75,309 |

## case1

- **Setup:** 0 existing holding(s) worth ₹0 + ₹20,000 new capital = **₹20,000** total. Picked 20 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** BAJAJFINSV, CUMMINSIND, INDIGO, HDFCLIFE, IOC, MARICO, TVSMOTOR, HINDALCO, VEDL, DABUR, AXISBANK, SBILIFE, IRCTC, SBICARD, ICICIPRULI, MARUTI, BAJAJHLDNG, M&M, BHARTIARTL, TCS
- **Result:** 1 round trips, win rate 100.0%, profit factor inf, net P&L **₹1,600** (8.00%), max drawdown ₹0 (0.0%), final equity **₹21,600**.

| Symbol | P&L |
|---|---|
| BAJAJFINSV | ₹1,600 |

**Top trades:**
- BAJAJFINSV SHORT 10 @ 2024.60 → ₹1,600 (Closed LONG position. Backtest end — force close)

## case2

- **Setup:** 2 existing holding(s) worth ₹15,000 + ₹20,000 new capital = **₹35,000** total. Picked 18 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** NHPC, COFORGE, TATASTEEL, AXISBANK, ICICIBANK, INFY, HAL, TECHM, TITAN, ADANIENT, TATAPOWER, ADANIPOWER, JSWSTEEL, INDHOTEL, DABUR, BAJAJ-AUTO, BAJAJFINSV, SUNPHARMA
- **Result:** 3 round trips, win rate 33.3%, profit factor 155.83, net P&L **₹6,398** (18.28%), max drawdown ₹41 (0.1%), final equity **₹41,398**.

| Symbol | P&L |
|---|---|
| COFORGE | ₹6,417 |
| NHPC | ₹-19 |

**Top trades:**
- COFORGE SHORT 22 @ 1828.63 → ₹6,439 (Closed LONG position. Backtest end — force close)
- COFORGE SHORT 2 @ 1533.69 → ₹-22 (Closed LONG position. rebalance TRIM)
- NHPC SHORT 47 @ 78.73 → ₹-19 (Closed LONG position. rebalance TRIM)

## case3

- **Setup:** 10 existing holding(s) worth ₹60,000 + ₹30,000 new capital = **₹90,000** total. Picked 10 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** TATACONSUM, GODREJCP, NHPC, INDIGO, POWERGRID, MARICO, NAUKRI, ADANIPOWER, TATASTEEL, INFY
- **Result:** 11 round trips, win rate 36.4%, profit factor 1.11, net P&L **₹52** (0.06%), max drawdown ₹451 (0.5%), final equity **₹90,052**.

| Symbol | P&L |
|---|---|
| TATACONSUM | ₹279 |
| INDIGO | ₹99 |
| NAUKRI | ₹67 |
| NHPC | ₹23 |
| MARICO | ₹-12 |
| GODREJCP | ₹-20 |
| TATASTEEL | ₹-24 |
| INFY | ₹-76 |
| POWERGRID | ₹-83 |
| ADANIPOWER | ₹-202 |

**Top trades:**
- TATACONSUM SHORT 83 @ 1090.28 → ₹334 (Closed LONG position. Backtest end — force close)
- ADANIPOWER SHORT 26 @ 219.16 → ₹-202 (Closed LONG position. Bollinger target hit (price 219.20 >= middle band 218.97))
- INDIGO SHORT 1 @ 5219.96 → ₹99 (Closed LONG position. RSI 87.1 overbought (>70))
- POWERGRID SHORT 20 @ 282.89 → ₹-83 (Closed LONG position. Bollinger target hit (price 282.95 >= middle band 282.76))
- INFY SHORT 5 @ 1080.18 → ₹-76 (Closed LONG position. Bollinger target hit (price 1080.40 >= middle band 1080.09))
- NAUKRI SHORT 5 @ 1204.56 → ₹67 (Closed LONG position. RSI 73.2 overbought (>70))
- TATACONSUM SHORT 5 @ 1089.08 → ₹-54 (Closed LONG position. Bollinger target hit (price 1089.30 >= middle band 1089.01))
- TATASTEEL SHORT 31 @ 188.27 → ₹-24 (Closed LONG position. Bollinger target hit (price 188.31 >= middle band 188.20))

## case4

- **Setup:** 0 existing holding(s) worth ₹0 + ₹10,000 new capital = **₹10,000** total. Picked 10 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** MARICO, PIDILITIND, NAUKRI, CONCOR, DLF, IOC, LICI, CUMMINSIND, SBICARD, HEROMOTOCO
- **Result:** 1 round trips, win rate 100.0%, profit factor inf, net P&L **₹736** (7.36%), max drawdown ₹0 (0.0%), final equity **₹10,736**.

| Symbol | P&L |
|---|---|
| PIDILITIND | ₹736 |

**Top trades:**
- PIDILITIND SHORT 6 @ 1695.76 → ₹736 (Closed LONG position. Backtest end — force close)

## case5

- **Setup:** 1 existing holding(s) worth ₹30,000 + ₹10,000 new capital = **₹40,000** total. Picked 5 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** VBL, COLPAL, HDFCAMC, MAXHEALTH, AXISBANK
- **Result:** 1 round trips, win rate 0.0%, profit factor 0.00, net P&L **₹-1,957** (-4.89%), max drawdown ₹1,957 (4.9%), final equity **₹38,043**.

| Symbol | P&L |
|---|---|
| VBL | ₹-1,957 |

**Top trades:**
- VBL SHORT 63 @ 440.41 → ₹-1,957 (Closed LONG position. Backtest end — force close)

## case6

- **Setup:** 5 existing holding(s) worth ₹50,000 + ₹50,000 new capital = **₹1,00,000** total. Picked 15 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** GODREJPROP, TVSMOTOR, HCLTECH, COFORGE, TECHM, ULTRACEMCO, CGPOWER, ICICIGI, IRCTC, BHARATFORG, BALKRISIND, BAJAJHLDNG, BOSCHLTD, BHARTIARTL, SBICARD
- **Result:** 6 round trips, win rate 50.0%, profit factor 0.08, net P&L **₹-1,426** (-1.43%), max drawdown ₹1,523 (1.5%), final equity **₹98,574**.

| Symbol | P&L |
|---|---|
| COFORGE | ₹68 |
| HCLTECH | ₹27 |
| GODREJPROP | ₹25 |
| TECHM | ₹-23 |
| TVSMOTOR | ₹-36 |
| BHARATFORG | ₹-1,487 |

**Top trades:**
- BHARATFORG SHORT 47 @ 2087.58 → ₹-1,487 (Closed LONG position. Backtest end — force close)
- COFORGE SHORT 6 @ 1550.49 → ₹68 (Closed LONG position. Bollinger target hit (price 1550.80 >= middle band 1546.14))
- TVSMOTOR SHORT 2 @ 3597.58 → ₹-36 (Closed LONG position. Bollinger target hit (price 3598.30 >= middle band 3594.99))
- HCLTECH SHORT 8 @ 1172.87 → ₹27 (Closed LONG position. Bollinger target hit (price 1173.10 >= middle band 1172.77))
- GODREJPROP SHORT 4 @ 2116.68 → ₹25 (Closed LONG position. Bollinger target hit (price 2117.10 >= middle band 2115.47))
- TECHM SHORT 6 @ 1484.40 → ₹-23 (Closed LONG position. Bollinger target hit (price 1484.70 >= middle band 1478.53))

## case7

- **Setup:** 20 existing holding(s) worth ₹2,00,000 + ₹1,00,000 new capital = **₹3,00,000** total. Picked 20 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** COALINDIA, IDFCFIRSTB, HAL, PFC, UNIONBANK, ABB, TECHM, ICICIGI, AMBUJACEM, MARUTI, HCLTECH, NESTLEIND, IRCTC, DABUR, JIOFIN, TRENT, EICHERMOT, ONGC, BRITANNIA, TATACONSUM
- **Result:** 21 round trips, win rate 66.7%, profit factor 6.13, net P&L **₹1,704** (0.57%), max drawdown ₹262 (0.1%), final equity **₹3,01,704**.

| Symbol | P&L |
|---|---|
| TATACONSUM | ₹1,162 |
| ICICIGI | ₹121 |
| ABB | ₹105 |
| EICHERMOT | ₹96 |
| IDFCFIRSTB | ₹87 |
| AMBUJACEM | ₹77 |
| UNIONBANK | ₹67 |
| JIOFIN | ₹65 |
| NESTLEIND | ₹64 |
| BRITANNIA | ₹40 |
| PFC | ₹32 |
| HCLTECH | ₹27 |
| TRENT | ₹8 |
| MARUTI | ₹0 |
| IRCTC | ₹-6 |
| DABUR | ₹-24 |
| TECHM | ₹-35 |
| ONGC | ₹-48 |
| HAL | ₹-50 |
| COALINDIA | ₹-84 |

**Top trades:**
- TATACONSUM SHORT 276 @ 1090.28 → ₹1,248 (Closed LONG position. Backtest end — force close)
- ICICIGI SHORT 5 @ 1815.34 → ₹121 (Closed LONG position. Target hit (price 1815.70 >= 1812.23))
- ABB SHORT 1 @ 7001.10 → ₹105 (Closed LONG position. RSI 73.1 overbought (>70))
- EICHERMOT SHORT 1 @ 7392.52 → ₹96 (Closed LONG position. RSI 73.2 overbought (>70))
- IDFCFIRSTB SHORT 126 @ 80.01 → ₹87 (Closed LONG position. RSI 92.7 overbought (>70))
- TATACONSUM SHORT 9 @ 1090.48 → ₹-85 (Closed LONG position. Bollinger target hit (price 1090.70 >= middle band 1089.69))
- COALINDIA SHORT 23 @ 428.56 → ₹-84 (Closed LONG position. Bollinger target hit (price 428.65 >= middle band 428.57))
- AMBUJACEM SHORT 23 @ 434.41 → ₹77 (Closed LONG position. RSI 72.9 overbought (>70))

## case8

- **Setup:** 0 existing holding(s) worth ₹0 + ₹50,000 new capital = **₹50,000** total. Picked 20 symbols, 60 days, rebalance every 1 day(s).
- **Symbols:** HDFCAMC, NAUKRI, CONCOR, IDFCFIRSTB, SBICARD, HAL, HAVELLS, JIOFIN, TRENT, COFORGE, CUMMINSIND, BHARTIARTL, ABB, VBL, BHEL, LICI, SIEMENS, COALINDIA, HDFCBANK, CIPLA
- **Result:** 1 round trips, win rate 0.0%, profit factor 0.00, net P&L **₹-3** (-0.01%), max drawdown ₹3 (0.0%), final equity **₹49,997**.

| Symbol | P&L |
|---|---|
| SBICARD | ₹-3 |

**Top trades:**
- SBICARD SHORT 78 @ 640.87 → ₹-3 (Closed LONG position. Backtest end — force close)

## case9

- **Setup:** 10 existing holding(s) worth ₹60,000 + ₹30,000 new capital = **₹90,000** total. Picked 10 symbols, 30 days, rebalance every 5 day(s).
- **Symbols:** IRFC, INDUSINDBK, TATACONSUM, DABUR, JIOFIN, HAL, CUMMINSIND, HAVELLS, VBL, EICHERMOT
- **Result:** 11 round trips, win rate 54.5%, profit factor 49.00, net P&L **₹8,073** (8.97%), max drawdown ₹152 (0.2%), final equity **₹98,073**.

| Symbol | P&L |
|---|---|
| JIOFIN | ₹7,960 |
| INDUSINDBK | ₹100 |
| EICHERMOT | ₹96 |
| CUMMINSIND | ₹46 |
| IRFC | ₹39 |
| HAVELLS | ₹-1 |
| DABUR | ₹-14 |
| HAL | ₹-20 |
| TATACONSUM | ₹-65 |
| VBL | ₹-67 |

**Top trades:**
- JIOFIN SHORT 384 @ 255.55 → ₹7,922 (Closed LONG position. Backtest end — force close)
- INDUSINDBK SHORT 6 @ 1016.35 → ₹100 (Closed LONG position. RSI 81.5 overbought (>70))
- EICHERMOT SHORT 1 @ 7392.52 → ₹96 (Closed LONG position. RSI 73.2 overbought (>70))
- VBL SHORT 12 @ 465.91 → ₹-67 (Closed LONG position. Bollinger target hit (price 466.00 >= middle band 465.61))
- TATACONSUM SHORT 5 @ 1086.88 → ₹-65 (Closed LONG position. Bollinger target hit (price 1087.10 >= middle band 1086.79))
- CUMMINSIND SHORT 1 @ 5554.89 → ₹46 (Closed LONG position. Bollinger target hit (price 5556.00 >= middle band 5537.07))
- IRFC SHORT 67 @ 89.52 → ₹39 (Closed LONG position. RSI 83.1 overbought (>70))
- JIOFIN SHORT 25 @ 238.13 → ₹39 (Closed LONG position. RSI 90.1 overbought (>70))

## case10

- **Setup:** 0 existing holding(s) worth ₹0 + ₹5,00,000 new capital = **₹5,00,000** total. Picked 40 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** DABUR, INDHOTEL, ITC, HDFCBANK, COFORGE, TORNTPHARM, SOLARINDS, JIOFIN, BRITANNIA, ADANIENSOL, CUMMINSIND, APOLLOHOSP, TATACONSUM, INDUSINDBK, TRENT, LT, WIPRO, ADANIENT, ZYDUSLIFE, HDFCAMC, ICICIGI, IOC, PIDILITIND, ICICIBANK, KOTAKBANK, HAL, MUTHOOTFIN, HINDALCO, CHOLAFIN, RELIANCE, HINDUNILVR, HINDPETRO, MARUTI, SBILIFE, TITAN, TECHM, BHEL, MARICO, BAJAJHLDNG, GAIL
- **Result:** 1 round trips, win rate 0.0%, profit factor 0.00, net P&L **₹-24,691** (-4.94%), max drawdown ₹24,691 (4.9%), final equity **₹4,75,309**.

| Symbol | P&L |
|---|---|
| DABUR | ₹-24,691 |

**Top trades:**
- DABUR SHORT 1162 @ 409.92 → ₹-24,691 (Closed LONG position. Backtest end — force close)
