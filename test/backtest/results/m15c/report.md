# Mock-Data Backtest — 10 Cases (m15c, 1x capital, Re-focused Strategy, real NSE data)

> Tiers: **all** · Ensemble mode: **fast** · Strategy: regime-adaptive (mean-reversion / pullback / breakout) with re-focused risk caps (single-stock 15%, cash reserve 20%, risk-at-stop 1.5%, sector 30%, drawdown). Paper-only, net of costs. 5-min bars from real historical CSVs.

## Summary

| Case | Holdings | New Cap | Total Cap | Picks | Days | Rebal | Trades | Win% | PF | Net P&L | Return | MaxDD | Final |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| case1 | 0 | ₹20,000 | ₹20,000 | 20 | 30 | 1d | 36 | 33.3% | 0.42 | ₹-173 | -0.86% | ₹249 (1.2%) | ₹19,827 |
| case2 | 2 | ₹20,000 | ₹35,000 | 18 | 30 | 1d | 51 | 19.6% | 0.24 | ₹-676 | -1.93% | ₹687 (2.0%) | ₹34,324 |
| case3 | 10 | ₹30,000 | ₹90,000 | 10 | 30 | 1d | 56 | 23.2% | 0.26 | ₹-1,574 | -1.75% | ₹1,772 (2.0%) | ₹88,426 |
| case4 | 0 | ₹10,000 | ₹10,000 | 10 | 30 | 1d | 36 | 25.0% | 0.23 | ₹-142 | -1.42% | ₹155 (1.5%) | ₹9,858 |
| case5 | 1 | ₹10,000 | ₹40,000 | 5 | 30 | 1d | 1 | 100.0% | inf | ₹3,003 | 7.51% | ₹0 (0.0%) | ₹43,003 |
| case6 | 5 | ₹50,000 | ₹1,00,000 | 15 | 30 | 1d | 71 | 18.3% | 0.19 | ₹-3,469 | -3.47% | ₹3,539 (3.5%) | ₹96,531 |
| case7 | 20 | ₹1,00,000 | ₹3,00,000 | 20 | 30 | 1d | 83 | 22.9% | 0.49 | ₹-5,566 | -1.86% | ₹6,637 (2.2%) | ₹2,94,434 |
| case8 | 0 | ₹50,000 | ₹50,000 | 20 | 60 | 1d | 61 | 24.6% | 0.32 | ₹-1,060 | -2.12% | ₹1,105 (2.2%) | ₹48,940 |
| case9 | 10 | ₹30,000 | ₹90,000 | 10 | 30 | 5d | 49 | 18.4% | 0.40 | ₹-1,454 | -1.62% | ₹1,620 (1.8%) | ₹88,546 |
| case10 | 0 | ₹5,00,000 | ₹5,00,000 | 40 | 30 | 1d | 78 | 20.5% | 0.26 | ₹-15,598 | -3.12% | ₹15,598 (3.1%) | ₹4,84,402 |

## case1

- **Setup:** 0 existing holding(s) worth ₹0 + ₹20,000 new capital = **₹20,000** total. Picked 20 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** CONCOR, INDHOTEL, PFC, IOC, DELHIVERY, BANDHANBNK, TATAMOTORS, NMDC, IRB
- **Result:** 36 round trips, win rate 33.3%, profit factor 0.42, net P&L **₹-173** (-0.86%), max drawdown ₹249 (1.2%), final equity **₹19,827**.

| Symbol | P&L |
|---|---|
| TATAMOTORS | ₹16 |
| CONCOR | ₹9 |
| BANDHANBNK | ₹4 |
| IOC | ₹3 |
| DELHIVERY | ₹-0 |
| INDHOTEL | ₹-29 |
| PFC | ₹-30 |
| NMDC | ₹-45 |
| IRB | ₹-100 |

**Top trades:**
- IRB SHORT 76 @ 19.53 → ₹-40 (Closed LONG position. rebalance TRIM)
- IRB SHORT 147 @ 20.28 → ₹-25 (Closed LONG position. Bollinger target hit (price 20.28 >= middle band 19.98))
- NMDC SHORT 17 @ 83.78 → ₹-25 (Closed LONG position. rebalance TRIM)
- TATAMOTORS SHORT 8 @ 342.33 → ₹22 (Closed LONG position. Bollinger target hit (price 342.40 >= middle band 339.61))
- IRB SHORT 151 @ 19.76 → ₹-21 (Closed LONG position. Bollinger target hit (price 19.76 >= middle band 19.76))
- PFC SHORT 7 @ 418.17 → ₹-21 (Closed LONG position. Bollinger target hit (price 418.25 >= middle band 417.54))
- BANDHANBNK SHORT 14 @ 212.80 → ₹20 (Closed LONG position. Bollinger target hit (price 212.84 >= middle band 212.77))
- CONCOR SHORT 2 @ 514.90 → ₹-18 (Closed LONG position. rebalance TRIM)

**Gate counters (why signals died):**
- total_evaluations: 4812
- rsi_not_oversold: 2582
- no_mode: 1048
- executed: 65
- proposed: 36
- volume: 31
- bollinger_band: 11
- circuit_breaker: 8
- cooldown: 2
- risk_blocked: 2

**RiskEngine block reasons:**
- Ticket size 3047.3099327087402 exceeds single-stock cap 3000 (15% of capital).: 1
- Ticket size 3017.9101009368896 exceeds single-stock cap 3000 (15% of capital).: 1

## case2

- **Setup:** 2 existing holding(s) worth ₹15,000 + ₹20,000 new capital = **₹35,000** total. Picked 18 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** LICI, NATCOPHARM, COALINDIA, TATASTEEL, AXISBANK, ICICIBANK, INFY, HINDALCO, DRREDDY, MOTHERSON, ADANIGREEN, IDFCFIRSTB
- **Result:** 51 round trips, win rate 19.6%, profit factor 0.24, net P&L **₹-676** (-1.93%), max drawdown ₹687 (2.0%), final equity **₹34,324**.

| Symbol | P&L |
|---|---|
| AXISBANK | ₹-15 |
| COALINDIA | ₹-16 |
| INFY | ₹-19 |
| DRREDDY | ₹-24 |
| TATASTEEL | ₹-35 |
| IDFCFIRSTB | ₹-49 |
| MOTHERSON | ₹-61 |
| ICICIBANK | ₹-76 |
| HINDALCO | ₹-81 |
| ADANIGREEN | ₹-91 |
| LICI | ₹-103 |
| NATCOPHARM | ₹-105 |

**Top trades:**
- ADANIGREEN SHORT 1 @ 1475.30 → ₹-87 (Closed LONG position. rebalance TRIM)
- ICICIBANK SHORT 1 @ 1420.72 → ₹-76 (Closed LONG position. rebalance TRIM)
- NATCOPHARM SHORT 2 @ 942.96 → ₹-57 (Closed LONG position. rebalance TRIM)
- AXISBANK SHORT 4 @ 1271.75 → ₹52 (Closed LONG position. RSI 85.0 overbought (>70))
- HINDALCO SHORT 5 @ 967.01 → ₹-38 (Closed LONG position. Bollinger target hit (price 967.20 >= middle band 961.26))
- ADANIGREEN SHORT 3 @ 1541.89 → ₹-38 (Closed LONG position. Bollinger target hit (price 1542.20 >= middle band 1528.22))
- MOTHERSON SHORT 32 @ 163.17 → ₹37 (Closed LONG position. RSI 79.4 overbought (>70))
- AXISBANK SHORT 2 @ 1256.75 → ₹-36 (Closed LONG position. rebalance TRIM)

**Gate counters (why signals died):**
- total_evaluations: 6429
- rsi_not_oversold: 3297
- no_mode: 1305
- executed: 87
- proposed: 49
- bollinger_band: 32
- circuit_breaker: 20
- volume: 18
- concentration_cap: 6
- risk_blocked: 5
- cooldown: 1

**RiskEngine block reasons:**
- Ticket size 6799.8001708984375 exceeds single-stock cap 5250 (15% of capital).: 2
- Ticket size 6806.8001708984375 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6792.8001708984375 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6796.3001708984375 exceeds single-stock cap 5250 (15% of capital).: 1

## case3

- **Setup:** 10 existing holding(s) worth ₹60,000 + ₹30,000 new capital = **₹90,000** total. Picked 10 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** KEC, SBILIFE, GAIL, LICI, NAUKRI, MUTHOOTFIN, GMRINFRA, AUBANK, AUROPHARMA
- **Result:** 56 round trips, win rate 23.2%, profit factor 0.26, net P&L **₹-1,574** (-1.75%), max drawdown ₹1,772 (2.0%), final equity **₹88,426**.

| Symbol | P&L |
|---|---|
| LICI | ₹115 |
| MUTHOOTFIN | ₹-12 |
| GMRINFRA | ₹-92 |
| NAUKRI | ₹-145 |
| SBILIFE | ₹-153 |
| GAIL | ₹-167 |
| AUROPHARMA | ₹-175 |
| KEC | ₹-373 |
| AUBANK | ₹-573 |

**Top trades:**
- KEC SHORT 14 @ 452.11 → ₹-253 (Closed LONG position. rebalance TRIM)
- AUBANK SHORT 12 @ 1084.38 → ₹-120 (Closed LONG position. RSI 70.9 overbought (>70))
- GMRINFRA SHORT 58 @ 111.70 → ₹-118 (Closed LONG position. Bollinger target hit (price 111.72 >= middle band 111.57))
- LICI SHORT 15 @ 441.71 → ₹112 (Closed LONG position. RSI 73.3 overbought (>70))
- SBILIFE SHORT 7 @ 1884.62 → ₹-91 (Closed LONG position. Bollinger target hit (price 1885.00 >= middle band 1879.65))
- GAIL SHORT 38 @ 174.27 → ₹86 (Closed LONG position. RSI 74.0 overbought (>70))
- NAUKRI SHORT 11 @ 1218.51 → ₹-85 (Closed LONG position. Bollinger target hit (price 1218.75 >= middle band 1200.24))
- AUBANK SHORT 12 @ 1092.08 → ₹-83 (Closed LONG position. RSI 72.0 overbought (>70))

**Gate counters (why signals died):**
- total_evaluations: 4815
- rsi_not_oversold: 2217
- no_mode: 1147
- executed: 96
- proposed: 47
- volume: 15
- circuit_breaker: 15
- bollinger_band: 7
- concentration_cap: 1

**RiskEngine block reasons:**

## case4

- **Setup:** 0 existing holding(s) worth ₹0 + ₹10,000 new capital = **₹10,000** total. Picked 10 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** MOTILALOFS, SYNGENE, POONAWALLA, WHIRLPOOL, MARICO, INDUSINDBK
- **Result:** 36 round trips, win rate 25.0%, profit factor 0.23, net P&L **₹-142** (-1.42%), max drawdown ₹155 (1.5%), final equity **₹9,858**.

| Symbol | P&L |
|---|---|
| MARICO | ₹3 |
| INDUSINDBK | ₹-3 |
| SYNGENE | ₹-11 |
| WHIRLPOOL | ₹-12 |
| POONAWALLA | ₹-45 |
| MOTILALOFS | ₹-74 |

**Top trades:**
- MOTILALOFS SHORT 1 @ 866.33 → ₹-52 (Closed LONG position. Bollinger target hit (price 866.50 >= middle band 865.33))
- POONAWALLA SHORT 3 @ 480.70 → ₹-14 (Closed LONG position. Bollinger target hit (price 480.80 >= middle band 476.94))
- POONAWALLA SHORT 3 @ 480.55 → ₹-12 (Closed LONG position. RSI 72.2 overbought (>70))
- SYNGENE SHORT 3 @ 416.12 → ₹11 (Closed LONG position. Bollinger target hit (price 416.20 >= middle band 416.10))
- SYNGENE SHORT 3 @ 408.07 → ₹-11 (Closed LONG position. RSI 71.2 overbought (>70))
- MARICO SHORT 1 @ 870.93 → ₹10 (Closed LONG position. Bollinger target hit (price 871.10 >= middle band 869.10))
- SYNGENE SHORT 3 @ 413.07 → ₹-10 (Closed LONG position. Bollinger target hit (price 413.15 >= middle band 411.20))
- MOTILALOFS SHORT 1 @ 945.56 → ₹-9 (Closed LONG position. Bollinger target hit (price 945.75 >= middle band 940.94))

**Gate counters (why signals died):**
- total_evaluations: 3212
- rsi_not_oversold: 1733
- no_mode: 503
- executed: 70
- proposed: 36
- volume: 23
- risk_blocked: 2

**RiskEngine block reasons:**
- Ticket size 1509.4499816894531 exceeds single-stock cap 1500 (15% of capital).: 1
- Ticket size 1509 exceeds single-stock cap 1500 (15% of capital).: 1

## case5

- **Setup:** 1 existing holding(s) worth ₹30,000 + ₹10,000 new capital = **₹40,000** total. Picked 5 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** TECHM, COFORGE, HAVELLS, JIOFIN
- **Result:** 1 round trips, win rate 100.0%, profit factor inf, net P&L **₹3,003** (7.51%), max drawdown ₹0 (0.0%), final equity **₹43,003**.

| Symbol | P&L |
|---|---|
| TECHM | ₹3,003 |

**Top trades:**
- TECHM SHORT 20 @ 1638.67 → ₹3,003 (Closed LONG position. Backtest end — force close)

**Gate counters (why signals died):**
- total_evaluations: 2146
- rsi_not_oversold: 635
- risk_blocked: 565
- no_mode: 318
- proposed: 34
- volume: 11
- bollinger_band: 2

**RiskEngine block reasons:**
- Ticket size 33000 exceeds max trade allocation 8000.: 7
- Ticket size 33000 exceeds single-stock cap 6000 (15% of capital).: 7
- Insufficient capital: used 29685.94 + ticket 33000.00 > spendable 32000.00 (after 20% cash reserve).: 7
- Ticket size 32900 exceeds max trade allocation 8000.: 7
- Ticket size 32900 exceeds single-stock cap 6000 (15% of capital).: 7
- Insufficient capital: used 29685.94 + ticket 32900.00 > spendable 32000.00 (after 20% cash reserve).: 7
- Ticket size 32800 exceeds max trade allocation 8000.: 6
- Ticket size 32800 exceeds single-stock cap 6000 (15% of capital).: 6
- Insufficient capital: used 29685.94 + ticket 32800.00 > spendable 32000.00 (after 20% cash reserve).: 6
- Ticket size 32700 exceeds max trade allocation 8000.: 5
- Ticket size 32700 exceeds single-stock cap 6000 (15% of capital).: 5
- Insufficient capital: used 29685.94 + ticket 32700.00 > spendable 32000.00 (after 20% cash reserve).: 5
- Ticket size 31640 exceeds max trade allocation 8000.: 4
- Ticket size 31640 exceeds single-stock cap 6000 (15% of capital).: 4
- Insufficient capital: used 29685.94 + ticket 31640.00 > spendable 32000.00 (after 20% cash reserve).: 4
- Ticket size 32970 exceeds max trade allocation 8000.: 4
- Ticket size 32970 exceeds single-stock cap 6000 (15% of capital).: 4
- Insufficient capital: used 29685.94 + ticket 32970.00 > spendable 32000.00 (after 20% cash reserve).: 4
- Ticket size 32968.00048828125 exceeds max trade allocation 8000.: 4
- Ticket size 32968.00048828125 exceeds single-stock cap 6000 (15% of capital).: 4
- Insufficient capital: used 29685.94 + ticket 32968.00 > spendable 32000.00 (after 20% cash reserve).: 4
- Ticket size 32923.9990234375 exceeds max trade allocation 8000.: 4
- Ticket size 32923.9990234375 exceeds single-stock cap 6000 (15% of capital).: 4
- Insufficient capital: used 29685.94 + ticket 32924.00 > spendable 32000.00 (after 20% cash reserve).: 4
- Ticket size 32860 exceeds max trade allocation 8000.: 4
- Ticket size 32860 exceeds single-stock cap 6000 (15% of capital).: 4
- Insufficient capital: used 29685.94 + ticket 32860.00 > spendable 32000.00 (after 20% cash reserve).: 4
- Ticket size 32958.00048828125 exceeds max trade allocation 8000.: 4
- Ticket size 32958.00048828125 exceeds single-stock cap 6000 (15% of capital).: 4
- Insufficient capital: used 29685.94 + ticket 32958.00 > spendable 32000.00 (after 20% cash reserve).: 4
- Ticket size 32840 exceeds max trade allocation 8000.: 4
- Ticket size 32840 exceeds single-stock cap 6000 (15% of capital).: 4
- Insufficient capital: used 29685.94 + ticket 32840.00 > spendable 32000.00 (after 20% cash reserve).: 4
- Ticket size 32940 exceeds max trade allocation 8000.: 4
- Ticket size 32940 exceeds single-stock cap 6000 (15% of capital).: 4
- Insufficient capital: used 29685.94 + ticket 32940.00 > spendable 32000.00 (after 20% cash reserve).: 4
- Ticket size 32780 exceeds max trade allocation 8000.: 4
- Ticket size 32780 exceeds single-stock cap 6000 (15% of capital).: 4
- Insufficient capital: used 29685.94 + ticket 32780.00 > spendable 32000.00 (after 20% cash reserve).: 4
- Ticket size 31540 exceeds max trade allocation 8000.: 3
- Ticket size 31540 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 31540.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 31548.00048828125 exceeds max trade allocation 8000.: 3
- Ticket size 31548.00048828125 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 31548.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 31213.9990234375 exceeds max trade allocation 8000.: 3
- Ticket size 31213.9990234375 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 31214.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 31188.00048828125 exceeds max trade allocation 8000.: 3
- Ticket size 31188.00048828125 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 31188.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 31196.0009765625 exceeds max trade allocation 8000.: 3
- Ticket size 31196.0009765625 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 31196.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 33036.0009765625 exceeds max trade allocation 8000.: 3
- Ticket size 33036.0009765625 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 33036.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 32950 exceeds max trade allocation 8000.: 3
- Ticket size 32950 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 32950.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 32850 exceeds max trade allocation 8000.: 3
- Ticket size 32850 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 32850.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 32891.99951171875 exceeds max trade allocation 8000.: 3
- Ticket size 32891.99951171875 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 32892.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 33001.99951171875 exceeds max trade allocation 8000.: 3
- Ticket size 33001.99951171875 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 33002.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 32913.9990234375 exceeds max trade allocation 8000.: 3
- Ticket size 32913.9990234375 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 32914.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 32980 exceeds max trade allocation 8000.: 3
- Ticket size 32980 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 32980.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 33003.9990234375 exceeds max trade allocation 8000.: 3
- Ticket size 33003.9990234375 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 33004.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 32941.99951171875 exceeds max trade allocation 8000.: 3
- Ticket size 32941.99951171875 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 32942.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 32876.0009765625 exceeds max trade allocation 8000.: 3
- Ticket size 32876.0009765625 exceeds single-stock cap 6000 (15% of capital).: 3
- Insufficient capital: used 29685.94 + ticket 32876.00 > spendable 32000.00 (after 20% cash reserve).: 3
- Ticket size 30380 exceeds max trade allocation 8000.: 2
- Ticket size 30380 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 30380.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 30481.99951171875 exceeds max trade allocation 8000.: 2
- Ticket size 30481.99951171875 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 30482.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31126.0009765625 exceeds max trade allocation 8000.: 2
- Ticket size 31126.0009765625 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31126.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 30776.0009765625 exceeds max trade allocation 8000.: 2
- Ticket size 30776.0009765625 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 30776.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31526.0009765625 exceeds max trade allocation 8000.: 2
- Ticket size 31526.0009765625 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31526.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31493.9990234375 exceeds max trade allocation 8000.: 2
- Ticket size 31493.9990234375 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31494.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31651.99951171875 exceeds max trade allocation 8000.: 2
- Ticket size 31651.99951171875 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31652.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31736.0009765625 exceeds max trade allocation 8000.: 2
- Ticket size 31736.0009765625 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31736.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31630 exceeds max trade allocation 8000.: 2
- Ticket size 31630 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31630.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31653.9990234375 exceeds max trade allocation 8000.: 2
- Ticket size 31653.9990234375 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31654.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31541.99951171875 exceeds max trade allocation 8000.: 2
- Ticket size 31541.99951171875 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31542.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31760 exceeds max trade allocation 8000.: 2
- Ticket size 31760 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31760.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31728.00048828125 exceeds max trade allocation 8000.: 2
- Ticket size 31728.00048828125 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31728.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31246.0009765625 exceeds max trade allocation 8000.: 2
- Ticket size 31246.0009765625 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31246.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31310 exceeds max trade allocation 8000.: 2
- Ticket size 31310 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31310.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31191.99951171875 exceeds max trade allocation 8000.: 2
- Ticket size 31191.99951171875 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31192.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31168.00048828125 exceeds max trade allocation 8000.: 2
- Ticket size 31168.00048828125 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31168.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 31040 exceeds max trade allocation 8000.: 2
- Ticket size 31040 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 31040.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 30800 exceeds max trade allocation 8000.: 2
- Ticket size 30800 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 30800.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32766.0009765625 exceeds max trade allocation 8000.: 2
- Ticket size 32766.0009765625 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32766.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32600 exceeds max trade allocation 8000.: 2
- Ticket size 32600 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32600.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32558.00048828125 exceeds max trade allocation 8000.: 2
- Ticket size 32558.00048828125 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32558.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32541.99951171875 exceeds max trade allocation 8000.: 2
- Ticket size 32541.99951171875 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32542.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33210 exceeds max trade allocation 8000.: 2
- Ticket size 33210 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33210.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33070 exceeds max trade allocation 8000.: 2
- Ticket size 33070 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33070.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32990 exceeds max trade allocation 8000.: 2
- Ticket size 32990 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32990.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32971.99951171875 exceeds max trade allocation 8000.: 2
- Ticket size 32971.99951171875 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32972.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32983.9990234375 exceeds max trade allocation 8000.: 2
- Ticket size 32983.9990234375 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32984.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33300 exceeds max trade allocation 8000.: 2
- Ticket size 33300 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33300.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33463.9990234375 exceeds max trade allocation 8000.: 2
- Ticket size 33463.9990234375 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33464.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33471.99951171875 exceeds max trade allocation 8000.: 2
- Ticket size 33471.99951171875 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33472.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33613.9990234375 exceeds max trade allocation 8000.: 2
- Ticket size 33613.9990234375 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33614.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33618.00048828125 exceeds max trade allocation 8000.: 2
- Ticket size 33618.00048828125 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33618.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33576.0009765625 exceeds max trade allocation 8000.: 2
- Ticket size 33576.0009765625 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33576.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33400 exceeds max trade allocation 8000.: 2
- Ticket size 33400 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33400.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33053.9990234375 exceeds max trade allocation 8000.: 2
- Ticket size 33053.9990234375 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33054.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32981.99951171875 exceeds max trade allocation 8000.: 2
- Ticket size 32981.99951171875 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32982.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33020 exceeds max trade allocation 8000.: 2
- Ticket size 33020 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33020.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33090 exceeds max trade allocation 8000.: 2
- Ticket size 33090 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33090.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33138.00048828125 exceeds max trade allocation 8000.: 2
- Ticket size 33138.00048828125 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33138.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33196.0009765625 exceeds max trade allocation 8000.: 2
- Ticket size 33196.0009765625 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33196.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33131.99951171875 exceeds max trade allocation 8000.: 2
- Ticket size 33131.99951171875 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33132.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32843.9990234375 exceeds max trade allocation 8000.: 2
- Ticket size 32843.9990234375 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32844.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32778.00048828125 exceeds max trade allocation 8000.: 2
- Ticket size 32778.00048828125 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32778.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32960 exceeds max trade allocation 8000.: 2
- Ticket size 32960 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32960.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32886.0009765625 exceeds max trade allocation 8000.: 2
- Ticket size 32886.0009765625 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32886.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32880 exceeds max trade allocation 8000.: 2
- Ticket size 32880 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32880.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32973.9990234375 exceeds max trade allocation 8000.: 2
- Ticket size 32973.9990234375 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32974.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33010 exceeds max trade allocation 8000.: 2
- Ticket size 33010 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33010.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32966.0009765625 exceeds max trade allocation 8000.: 2
- Ticket size 32966.0009765625 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32966.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32938.00048828125 exceeds max trade allocation 8000.: 2
- Ticket size 32938.00048828125 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32938.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32996.0009765625 exceeds max trade allocation 8000.: 2
- Ticket size 32996.0009765625 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32996.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33208.00048828125 exceeds max trade allocation 8000.: 2
- Ticket size 33208.00048828125 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33208.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33193.9990234375 exceeds max trade allocation 8000.: 2
- Ticket size 33193.9990234375 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33194.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33156.0009765625 exceeds max trade allocation 8000.: 2
- Ticket size 33156.0009765625 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33156.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33078.00048828125 exceeds max trade allocation 8000.: 2
- Ticket size 33078.00048828125 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33078.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33058.00048828125 exceeds max trade allocation 8000.: 2
- Ticket size 33058.00048828125 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33058.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32833.9990234375 exceeds max trade allocation 8000.: 2
- Ticket size 32833.9990234375 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32834.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32788.00048828125 exceeds max trade allocation 8000.: 2
- Ticket size 32788.00048828125 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32788.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32643.9990234375 exceeds max trade allocation 8000.: 2
- Ticket size 32643.9990234375 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32644.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32798.00048828125 exceeds max trade allocation 8000.: 2
- Ticket size 32798.00048828125 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32798.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 33180 exceeds max trade allocation 8000.: 2
- Ticket size 33180 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 33180.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32921.99951171875 exceeds max trade allocation 8000.: 2
- Ticket size 32921.99951171875 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32922.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32521.99951171875 exceeds max trade allocation 8000.: 2
- Ticket size 32521.99951171875 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32522.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 32500 exceeds max trade allocation 8000.: 2
- Ticket size 32500 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 29685.94 + ticket 32500.00 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 14840 exceeds max trade allocation 8000.: 1
- Ticket size 14840 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 14840.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29970 exceeds max trade allocation 8000.: 1
- Ticket size 29970 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 29970.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30076.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 30076.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30076.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30020 exceeds max trade allocation 8000.: 1
- Ticket size 30020 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30020.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30023.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 30023.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30024.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29931.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 29931.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 29932.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29908.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 29908.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 29908.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29973.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 29973.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 29974.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 14986.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 14986.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 14987.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30408.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 30408.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30408.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30553.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 30553.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30554.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30520 exceeds max trade allocation 8000.: 1
- Ticket size 30520 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30520.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30536.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 30536.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30536.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30618.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 30618.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30618.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30580 exceeds max trade allocation 8000.: 1
- Ticket size 30580 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30580.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30500 exceeds max trade allocation 8000.: 1
- Ticket size 30500 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30500.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30491.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 30491.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30492.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30388.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 30388.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30388.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30493.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 30493.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30494.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30460 exceeds max trade allocation 8000.: 1
- Ticket size 30460 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30460.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30353.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 30353.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30354.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30316.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 30316.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30316.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30311.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 30311.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30312.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30308.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 30308.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30308.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30200 exceeds max trade allocation 8000.: 1
- Ticket size 30200 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30200.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30310 exceeds max trade allocation 8000.: 1
- Ticket size 30310 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30310.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30291.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 30291.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30292.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30283.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 30283.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30284.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30218.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 30218.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30218.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30260 exceeds max trade allocation 8000.: 1
- Ticket size 30260 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30260.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 15130 exceeds max trade allocation 8000.: 1
- Ticket size 15130 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 15130.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30920 exceeds max trade allocation 8000.: 1
- Ticket size 30920 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30920.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31000 exceeds max trade allocation 8000.: 1
- Ticket size 31000 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31000.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31048.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31048.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31048.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30708.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 30708.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30708.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30700 exceeds max trade allocation 8000.: 1
- Ticket size 30700 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30700.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30688.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 30688.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30688.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30676.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 30676.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30676.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30608.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 30608.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30608.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30801.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 30801.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30802.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31038.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31038.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31038.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31103.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31103.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31104.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31261.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31261.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31262.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31211.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31211.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31212.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31383.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31383.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31384.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31433.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31433.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31434.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31556.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31556.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31556.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31601.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31601.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31602.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31611.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31611.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31612.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31420 exceeds max trade allocation 8000.: 1
- Ticket size 31420 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31420.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5967.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 15710 exceeds max trade allocation 8000.: 1
- Ticket size 15710 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 15710.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31766.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31766.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31766.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31741.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31741.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31742.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31733.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31733.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31734.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31580 exceeds max trade allocation 8000.: 1
- Ticket size 31580 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31580.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31710 exceeds max trade allocation 8000.: 1
- Ticket size 31710 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31710.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31746.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31746.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31746.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31731.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31731.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31732.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31621.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31621.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31622.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31616.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31616.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31616.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31670 exceeds max trade allocation 8000.: 1
- Ticket size 31670 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31670.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31661.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31661.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31662.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31720 exceeds max trade allocation 8000.: 1
- Ticket size 31720 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31720.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31623.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31623.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31624.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31613.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31613.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31614.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31628.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31628.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31628.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31546.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31546.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31546.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31508.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31508.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31508.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 15754.000244140625 exceeds max trade allocation 8000.: 1
- Ticket size 15754.000244140625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 15754.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32150 exceeds max trade allocation 8000.: 1
- Ticket size 32150 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32150.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32028.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32028.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32028.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31990 exceeds max trade allocation 8000.: 1
- Ticket size 31990 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31990.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32071.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 32071.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32072.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31793.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31793.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31794.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31791.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31791.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31792.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31781.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31781.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31782.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31778.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31778.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31778.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31770 exceeds max trade allocation 8000.: 1
- Ticket size 31770 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31770.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31666.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31666.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31666.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31573.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31573.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31574.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31578.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31578.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31578.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31560 exceeds max trade allocation 8000.: 1
- Ticket size 31560 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31560.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31503.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31503.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31504.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31488.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31488.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31488.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 15774.000244140625 exceeds max trade allocation 8000.: 1
- Ticket size 15774.000244140625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 15774.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31271.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31271.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31272.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31303.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31303.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31304.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31203.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31203.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31204.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31250 exceeds max trade allocation 8000.: 1
- Ticket size 31250 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31250.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31266.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31266.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31266.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31333.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31333.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31334.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31360 exceeds max trade allocation 8000.: 1
- Ticket size 31360 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31360.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31180 exceeds max trade allocation 8000.: 1
- Ticket size 31180 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31180.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31190 exceeds max trade allocation 8000.: 1
- Ticket size 31190 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31190.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31251.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31251.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31252.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31236.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31236.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31236.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31171.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31171.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31172.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31216.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31216.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31216.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5875.50 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 15584.000244140625 exceeds max trade allocation 8000.: 1
- Ticket size 15584.000244140625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 15584.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31220 exceeds max trade allocation 8000.: 1
- Ticket size 31220 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31220.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31270 exceeds max trade allocation 8000.: 1
- Ticket size 31270 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31270.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31160 exceeds max trade allocation 8000.: 1
- Ticket size 31160 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31160.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31240 exceeds max trade allocation 8000.: 1
- Ticket size 31240 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31240.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31130 exceeds max trade allocation 8000.: 1
- Ticket size 31130 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31130.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31170 exceeds max trade allocation 8000.: 1
- Ticket size 31170 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31170.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31221.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31221.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31222.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31150 exceeds max trade allocation 8000.: 1
- Ticket size 31150 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31150.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31078.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31078.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31078.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30963.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 30963.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30964.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30923.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 30923.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30924.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30971.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 30971.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30972.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31058.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31058.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31058.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31098.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31098.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31098.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31090 exceeds max trade allocation 8000.: 1
- Ticket size 31090 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31090.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31153.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31153.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31154.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31096.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31096.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31096.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31083.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31083.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31084.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31068.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31068.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31068.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31116.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31116.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31116.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 15558.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 15558.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 15558.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31278.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31278.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31278.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31043.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31043.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31044.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30926.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 30926.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30926.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30866.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 30866.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30866.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30790 exceeds max trade allocation 8000.: 1
- Ticket size 30790 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30790.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30771.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 30771.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30772.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30751.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 30751.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30752.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30720 exceeds max trade allocation 8000.: 1
- Ticket size 30720 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30720.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30806.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 30806.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30806.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30743.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 30743.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30744.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30856.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 30856.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30856.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30940 exceeds max trade allocation 8000.: 1
- Ticket size 30940 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30940.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30901.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 30901.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30902.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30966.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 30966.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30966.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31060 exceeds max trade allocation 8000.: 1
- Ticket size 31060 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31060.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30956.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 30956.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 30956.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31128.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31128.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31128.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31146.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31146.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31146.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31226.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31226.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31226.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31120 exceeds max trade allocation 8000.: 1
- Ticket size 31120 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31120.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5942.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 15560 exceeds max trade allocation 8000.: 1
- Ticket size 15560 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 15560.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31701.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31701.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31702.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31841.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31841.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31842.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31950 exceeds max trade allocation 8000.: 1
- Ticket size 31950 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31950.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31926.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31926.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31926.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31856.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31856.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31856.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31818.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31818.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31818.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31800 exceeds max trade allocation 8000.: 1
- Ticket size 31800 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31800.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31788.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31788.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31788.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31786.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31786.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31786.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31798.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31798.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31798.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31723.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 31723.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31724.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31691.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31691.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31692.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31528.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31528.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31528.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31516.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 31516.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31516.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31531.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 31531.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31532.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31518.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 31518.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31518.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31510 exceeds max trade allocation 8000.: 1
- Ticket size 31510 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31510.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31470 exceeds max trade allocation 8000.: 1
- Ticket size 31470 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 31470.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 4570.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 4586.40 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5913.25 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 15770 exceeds max trade allocation 8000.: 1
- Ticket size 15770 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 15770.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32400 exceeds max trade allocation 8000.: 1
- Ticket size 32400 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32400.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32463.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32463.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32464.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32423.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32423.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32424.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32398.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32398.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32398.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32453.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32453.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32454.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32378.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32378.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32378.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32570 exceeds max trade allocation 8000.: 1
- Ticket size 32570 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32570.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32650 exceeds max trade allocation 8000.: 1
- Ticket size 32650 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32650.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32603.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32603.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32604.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32610 exceeds max trade allocation 8000.: 1
- Ticket size 32610 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32610.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32590 exceeds max trade allocation 8000.: 1
- Ticket size 32590 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32590.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32618.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32618.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32618.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32606.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32606.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32606.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32668.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32668.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32668.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32681.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 32681.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32682.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32758.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32758.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32758.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32781.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 32781.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32782.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32731.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 32731.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32732.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32703.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32703.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32704.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 4922.70 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5013.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5961.50 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 16351.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 16351.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16352.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33321.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 33321.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33322.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33103.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 33103.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33104.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33121.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 33121.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33122.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33171.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 33171.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33172.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33110 exceeds max trade allocation 8000.: 1
- Ticket size 33110 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33110.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33063.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 33063.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33064.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33021.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 33021.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33022.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33091.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 33091.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33092.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32978.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32978.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32978.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32928.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32928.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32928.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32931.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 32931.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32932.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32920 exceeds max trade allocation 8000.: 1
- Ticket size 32920 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32920.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32888.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32888.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32888.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5266.50 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5785.44 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5823.36 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5820.61 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 16444.000244140625 exceeds max trade allocation 8000.: 1
- Ticket size 16444.000244140625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16444.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33603.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 33603.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33604.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33640 exceeds max trade allocation 8000.: 1
- Ticket size 33640 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33640.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33558.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 33558.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33558.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33393.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 33393.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33394.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33578.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 33578.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33578.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33586.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 33586.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33586.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33600 exceeds max trade allocation 8000.: 1
- Ticket size 33600 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33600.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33666.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 33666.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33666.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33540 exceeds max trade allocation 8000.: 1
- Ticket size 33540 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33540.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33488.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 33488.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33488.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33350 exceeds max trade allocation 8000.: 1
- Ticket size 33350 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33350.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33313.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 33313.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33314.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33380 exceeds max trade allocation 8000.: 1
- Ticket size 33380 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33380.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5001.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5027.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5052.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 16690 exceeds max trade allocation 8000.: 1
- Ticket size 16690 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16690.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33060 exceeds max trade allocation 8000.: 1
- Ticket size 33060 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33060.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32998.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32998.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32998.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33050 exceeds max trade allocation 8000.: 1
- Ticket size 33050 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33050.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33133.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 33133.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33134.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33013.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 33013.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33014.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33026.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 33026.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33026.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5750.92 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5769.55 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5771.85 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5859.25 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5873.05 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5889.15 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 16513.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 16513.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16513.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33176.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 33176.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33176.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33116.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 33116.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33116.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33018.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 33018.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33018.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32943.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32943.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32944.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32870 exceeds max trade allocation 8000.: 1
- Ticket size 32870 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32870.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32763.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32763.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32764.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32736.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32736.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32736.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32883.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32883.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32884.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32823.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32823.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32824.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32773.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32773.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32774.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32828.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32828.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32828.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32856.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32856.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32856.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32890 exceeds max trade allocation 8000.: 1
- Ticket size 32890 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32890.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5251.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5272.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5303.70 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5066.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5120.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5124.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5140.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5772.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 16490 exceeds max trade allocation 8000.: 1
- Ticket size 16490 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16490.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32948.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32948.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32948.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32976.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32976.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32976.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5197.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 16485 exceeds max trade allocation 8000.: 1
- Ticket size 16485 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16485.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33093.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 33093.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33094.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33098.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 33098.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33098.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33113.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 33113.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33114.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33143.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 33143.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33144.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33260 exceeds max trade allocation 8000.: 1
- Ticket size 33260 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33260.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33258.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 33258.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33258.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33200 exceeds max trade allocation 8000.: 1
- Ticket size 33200 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33200.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33241.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 33241.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33242.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33126.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 33126.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33126.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32956.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32956.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32956.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32801.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 32801.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32802.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32936.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32936.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32936.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5309.10 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5339.70 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 16500 exceeds max trade allocation 8000.: 1
- Ticket size 16500 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16500.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33140 exceeds max trade allocation 8000.: 1
- Ticket size 33140 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33140.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33083.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 33083.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33084.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33040 exceeds max trade allocation 8000.: 1
- Ticket size 33040 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33040.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33073.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 33073.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33074.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33068.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 33068.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33068.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33061.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 33061.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33062.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32926.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32926.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32926.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32760 exceeds max trade allocation 8000.: 1
- Ticket size 32760 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32760.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32756.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32756.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32756.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32738.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32738.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32738.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32696.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32696.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32696.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 16321.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 16321.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16322.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33560 exceeds max trade allocation 8000.: 1
- Ticket size 33560 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33560.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33266.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 33266.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33266.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33081.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 33081.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33082.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32961.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 32961.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32962.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32848.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32848.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32848.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32818.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32818.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32818.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32753.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32753.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32754.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32836.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32836.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32836.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32893.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32893.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32894.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32878.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32878.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32878.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32776.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32776.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32776.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 16350 exceeds max trade allocation 8000.: 1
- Ticket size 16350 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16350.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33146.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 33146.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33146.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33141.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 33141.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33142.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33250 exceeds max trade allocation 8000.: 1
- Ticket size 33250 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33250.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33118.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 33118.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33118.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33106.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 33106.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33106.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33150 exceeds max trade allocation 8000.: 1
- Ticket size 33150 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33150.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33148.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 33148.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33148.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32986.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32986.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32986.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32993.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32993.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32994.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32811.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 32811.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32812.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32723.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32723.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32724.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32750 exceeds max trade allocation 8000.: 1
- Ticket size 32750 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32750.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32710 exceeds max trade allocation 8000.: 1
- Ticket size 32710 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32710.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32706.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32706.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32706.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32666.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32666.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32666.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32641.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 32641.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32642.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 16400 exceeds max trade allocation 8000.: 1
- Ticket size 16400 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16400.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33066.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 33066.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33066.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32910 exceeds max trade allocation 8000.: 1
- Ticket size 32910 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32910.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32953.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32953.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32954.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33033.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 33033.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33034.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32846.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32846.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32846.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32898.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32898.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32898.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32901.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 32901.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32902.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32911.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 32911.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32912.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32830 exceeds max trade allocation 8000.: 1
- Ticket size 32830 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32830.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 16430 exceeds max trade allocation 8000.: 1
- Ticket size 16430 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16430.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33071.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 33071.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33072.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33101.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 33101.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33102.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 33028.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 33028.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 33028.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32838.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32838.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32838.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32583.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32583.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32584.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32663.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32663.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32664.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32593.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32593.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32594.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32520 exceeds max trade allocation 8000.: 1
- Ticket size 32520 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32520.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32573.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32573.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32574.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32556.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32556.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32556.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32550 exceeds max trade allocation 8000.: 1
- Ticket size 32550 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32550.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32493.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32493.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32494.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32530 exceeds max trade allocation 8000.: 1
- Ticket size 32530 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32530.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32523.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32523.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32524.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32518.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32518.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32518.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32503.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32503.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32504.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 16250 exceeds max trade allocation 8000.: 1
- Ticket size 16250 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16250.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32786.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32786.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32786.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32783.9990234375 exceeds max trade allocation 8000.: 1
- Ticket size 32783.9990234375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32784.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32991.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 32991.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32992.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32701.99951171875 exceeds max trade allocation 8000.: 1
- Ticket size 32701.99951171875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32702.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Insufficient capital: used 29685.94 + ticket 5925.95 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 16390 exceeds max trade allocation 8000.: 1
- Ticket size 16390 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16390.00 > spendable 32000.00 (after 20% cash reserve).: 1

## case6

- **Setup:** 5 existing holding(s) worth ₹50,000 + ₹50,000 new capital = **₹1,00,000** total. Picked 15 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** AUBANK, OIL, HINDCOPPER, DMART, FORTIS, ASTRAL, BLUESTARCO, DELHIVERY, GODREJCP, FEDERALBNK, J&KBANK, HCLTECH, BIOCON, ACC
- **Result:** 71 round trips, win rate 18.3%, profit factor 0.19, net P&L **₹-3,469** (-3.47%), max drawdown ₹3,539 (3.5%), final equity **₹96,531**.

| Symbol | P&L |
|---|---|
| ACC | ₹39 |
| FEDERALBNK | ₹-24 |
| GODREJCP | ₹-47 |
| ASTRAL | ₹-104 |
| DELHIVERY | ₹-114 |
| HCLTECH | ₹-116 |
| J&KBANK | ₹-131 |
| OIL | ₹-228 |
| FORTIS | ₹-269 |
| DMART | ₹-402 |
| BLUESTARCO | ₹-626 |
| AUBANK | ₹-695 |
| HINDCOPPER | ₹-753 |

**Top trades:**
- BLUESTARCO SHORT 4 @ 1570.69 → ₹-505 (Closed LONG position. rebalance TRIM)
- HINDCOPPER SHORT 26 @ 556.49 → ₹-339 (Closed LONG position. Bollinger target hit (price 556.60 >= middle band 540.46))
- FORTIS SHORT 10 @ 951.26 → ₹-237 (Closed LONG position. Bollinger target hit (price 951.45 >= middle band 950.88))
- HINDCOPPER SHORT 27 @ 542.59 → ₹-196 (Closed LONG position. Bollinger target hit (price 542.70 >= middle band 539.21))
- HINDCOPPER SHORT 15 @ 474.06 → ₹-179 (Closed LONG position. rebalance TRIM)
- OIL SHORT 17 @ 443.91 → ₹161 (Closed LONG position. rebalance TRIM)
- J&KBANK SHORT 41 @ 177.91 → ₹-131 (Closed LONG position. rebalance TRIM)
- AUBANK SHORT 13 @ 1084.38 → ₹-130 (Closed LONG position. RSI 70.9 overbought (>70))

**Gate counters (why signals died):**
- total_evaluations: 7479
- rsi_not_oversold: 3740
- no_mode: 1493
- executed: 124
- proposed: 66
- circuit_breaker: 37
- volume: 19
- bollinger_band: 10
- risk_blocked: 6
- cooldown: 3
- concentration_cap: 1

**RiskEngine block reasons:**
- Ticket size 15096 exceeds single-stock cap 15000 (15% of capital).: 2
- Ticket size 15036.5 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15077.300415039062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15080.699584960938 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15062 exceeds single-stock cap 15000 (15% of capital).: 1

## case7

- **Setup:** 20 existing holding(s) worth ₹2,00,000 + ₹1,00,000 new capital = **₹3,00,000** total. Picked 20 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** CIPLA, ZYDUSLIFE, ICICIPRULI, HINDALCO, MAXHEALTH, TATACONSUM, ADANIPORTS, HINDPETRO, ADANIENSOL, TATATECH, TATAMOTORS, BSE, HCLTECH, M&M, IOC, GICRE, JKCEMENT, CUMMINSIND, ASTRAL
- **Result:** 83 round trips, win rate 22.9%, profit factor 0.49, net P&L **₹-5,566** (-1.86%), max drawdown ₹6,637 (2.2%), final equity **₹2,94,434**.

| Symbol | P&L |
|---|---|
| TATATECH | ₹1,769 |
| IOC | ₹161 |
| JKCEMENT | ₹41 |
| HINDPETRO | ₹-2 |
| CUMMINSIND | ₹-58 |
| GICRE | ₹-79 |
| ASTRAL | ₹-125 |
| TATAMOTORS | ₹-250 |
| M&M | ₹-272 |
| ADANIENSOL | ₹-325 |
| MAXHEALTH | ₹-378 |
| ICICIPRULI | ₹-386 |
| TATACONSUM | ₹-407 |
| BSE | ₹-525 |
| ZYDUSLIFE | ₹-555 |
| CIPLA | ₹-563 |
| ADANIPORTS | ₹-660 |
| HCLTECH | ₹-913 |
| HINDALCO | ₹-2,039 |

**Top trades:**
- TATATECH SHORT 27 @ 872.88 → ₹3,203 (Closed LONG position. rebalance TRIM)
- TATATECH SHORT 26 @ 835.93 → ₹-987 (Closed LONG position. rebalance TRIM)
- BSE SHORT 2 @ 3578.88 → ₹-463 (Closed LONG position. rebalance EXIT)
- ADANIPORTS SHORT 12 @ 1779.64 → ₹-364 (Closed LONG position. rebalance TRIM)
- HINDALCO SHORT 46 @ 967.01 → ₹-346 (Closed LONG position. Bollinger target hit (price 967.20 >= middle band 961.26))
- CIPLA SHORT 30 @ 1458.11 → ₹-340 (Closed LONG position. RSI 72.5 overbought (>70))
- HINDALCO SHORT 44 @ 1005.80 → ₹-334 (Closed LONG position. RSI 71.8 overbought (>70))
- ADANIPORTS SHORT 27 @ 1650.47 → ₹-317 (Closed LONG position. Bollinger target hit (price 1650.80 >= middle band 1649.16))

**Gate counters (why signals died):**
- total_evaluations: 10172
- rsi_not_oversold: 5201
- no_mode: 2165
- executed: 138
- proposed: 65
- circuit_breaker: 43
- volume: 37
- risk_blocked: 30
- bollinger_band: 7
- cooldown: 2

**RiskEngine block reasons:**
- Ticket size 45121.0198059082 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45386.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45316.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45005.401611328125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45215.49865722656 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45253.99932861328 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45138.50067138672 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45135.75134277344 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45363.99932861328 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46131.25 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45947.00134277344 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45815 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45982.74932861328 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46158.75 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46337.5 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47685 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47462.25067138672 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47503.50067138672 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47338.50067138672 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47288.99932861328 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47618.99932861328 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47844.50134277344 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47772.99865722656 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47866.49932861328 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48017.74932861328 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45054.39929199219 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45170.39929199219 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45257.39929199219 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45240 exceeds single-stock cap 45000 (15% of capital).: 1

## case8

- **Setup:** 0 existing holding(s) worth ₹0 + ₹50,000 new capital = **₹50,000** total. Picked 20 symbols, 60 days, rebalance every 1 day(s).
- **Symbols:** KEC, HAVELLS, INDUSINDBK, COLPAL, ICICIPRULI, PIDILITIND, HINDALCO, JINDALSAW, INFOSYS, UNITDSPR, FORTIS, RBLBANK, COALINDIA, CONCOR, NESTLEIND, AUROPHARMA, BERGERPAINT, BANDHANBNK
- **Result:** 61 round trips, win rate 24.6%, profit factor 0.32, net P&L **₹-1,060** (-2.12%), max drawdown ₹1,105 (2.2%), final equity **₹48,940**.

| Symbol | P&L |
|---|---|
| CONCOR | ₹23 |
| NESTLEIND | ₹11 |
| COLPAL | ₹-0 |
| INFOSYS | ₹-12 |
| COALINDIA | ₹-12 |
| FORTIS | ₹-15 |
| INDUSINDBK | ₹-17 |
| AUROPHARMA | ₹-27 |
| RBLBANK | ₹-38 |
| ICICIPRULI | ₹-46 |
| BERGERPAINT | ₹-49 |
| UNITDSPR | ₹-70 |
| PIDILITIND | ₹-109 |
| HINDALCO | ₹-142 |
| KEC | ₹-161 |
| HAVELLS | ₹-182 |
| JINDALSAW | ₹-216 |

**Top trades:**
- KEC SHORT 8 @ 452.11 → ₹-139 (Closed LONG position. rebalance TRIM)
- UNITDSPR SHORT 5 @ 1467.51 → ₹119 (Closed LONG position. RSI 78.3 overbought (>70))
- JINDALSAW SHORT 14 @ 264.35 → ₹-109 (Closed LONG position. rebalance TRIM)
- UNITDSPR SHORT 5 @ 1460.71 → ₹-101 (Closed LONG position. Bollinger target hit (price 1461.00 >= middle band 1434.49))
- COLPAL SHORT 3 @ 2110.48 → ₹72 (Closed LONG position. RSI 80.3 overbought (>70))
- HAVELLS SHORT 6 @ 1187.06 → ₹-59 (Closed LONG position. Bollinger target hit (price 1187.30 >= middle band 1178.61))
- FORTIS SHORT 7 @ 959.61 → ₹-57 (Closed LONG position. Bollinger target hit (price 959.80 >= middle band 940.19))
- COLPAL SHORT 3 @ 2139.57 → ₹-52 (Closed LONG position. Bollinger target hit (price 2140.00 >= middle band 2131.35))

**Gate counters (why signals died):**
- total_evaluations: 9631
- rsi_not_oversold: 5241
- no_mode: 1562
- executed: 110
- proposed: 61
- volume: 39
- bollinger_band: 27
- circuit_breaker: 20
- risk_blocked: 2
- cooldown: 2
- concentration_cap: 1

**RiskEngine block reasons:**
- Ticket size 7564.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7552.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1

## case9

- **Setup:** 10 existing holding(s) worth ₹60,000 + ₹30,000 new capital = **₹90,000** total. Picked 10 symbols, 30 days, rebalance every 5 day(s).
- **Symbols:** IRCTC, IRFC, SBILIFE, CHAMBLFERT, CUMMINSIND, INFOSYS, BSE, HINDALCO, ZYDUSLIFE
- **Result:** 49 round trips, win rate 18.4%, profit factor 0.40, net P&L **₹-1,454** (-1.62%), max drawdown ₹1,620 (1.8%), final equity **₹88,546**.

| Symbol | P&L |
|---|---|
| IRFC | ₹348 |
| CUMMINSIND | ₹196 |
| INFOSYS | ₹-40 |
| SBILIFE | ₹-51 |
| BSE | ₹-93 |
| ZYDUSLIFE | ₹-235 |
| IRCTC | ₹-249 |
| HINDALCO | ₹-360 |
| CHAMBLFERT | ₹-970 |

**Top trades:**
- IRFC SHORT 77 @ 90.23 → ₹435 (Closed LONG position. rebalance TRIM)
- CHAMBLFERT SHORT 29 @ 441.01 → ₹-429 (Closed LONG position. Bollinger target hit (price 441.10 >= middle band 440.95))
- BSE SHORT 1 @ 3593.28 → ₹-217 (Closed LONG position. Bollinger target hit (price 3594.00 >= middle band 3583.70))
- CUMMINSIND SHORT 2 @ 5548.89 → ₹168 (Closed LONG position. Bollinger target hit (price 5550.00 >= middle band 5522.70))
- CHAMBLFERT SHORT 15 @ 442.96 → ₹-161 (Closed LONG position. rebalance TRIM)
- HINDALCO SHORT 13 @ 1026.34 → ₹-152 (Closed LONG position. Bollinger target hit (price 1026.55 >= middle band 1023.70))
- BSE SHORT 3 @ 3493.70 → ₹146 (Closed LONG position. Bollinger target hit (price 3494.40 >= middle band 3475.44))
- HINDALCO SHORT 6 @ 962.01 → ₹-95 (Closed LONG position. Bollinger target hit (price 962.20 >= middle band 960.67))

**Gate counters (why signals died):**
- total_evaluations: 4819
- rsi_not_oversold: 1924
- no_mode: 1217
- risk_blocked: 101
- executed: 87
- proposed: 41
- volume: 23
- concentration_cap: 2
- circuit_breaker: 2

**RiskEngine block reasons:**
- Ticket size 13661.339859008789 exceeds single-stock cap 13500 (15% of capital).: 4
- Ticket size 13656.72004699707 exceeds single-stock cap 13500 (15% of capital).: 3
- Ticket size 13687.519577026367 exceeds single-stock cap 13500 (15% of capital).: 3
- Ticket size 13747.579483032227 exceeds single-stock cap 13500 (15% of capital).: 3
- Ticket size 13652.100234985352 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13719.859436035156 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13701.380187988281 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13690.600234985352 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13783 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13635.160140991211 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13633.619812011719 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13638.239624023438 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13629 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13759.899765014648 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13721.399765014648 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13726.019577026367 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13744.5 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13900.040328979492 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13913.899765014648 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13875.399765014648 exceeds single-stock cap 13500 (15% of capital).: 2
- Ticket size 13644.399765014648 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13598.200469970703 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13716.77995300293 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13685.980422973633 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13724.480422973633 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13779.920516967773 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13722.94009399414 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13669.040328979492 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13702.920516967773 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13712.160140991211 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13704.459671020508 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13698.299530029297 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13659.799530029297 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13665.959671020508 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13664.420516967773 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13672.119812011719 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13622.839859008789 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13618.22004699707 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13655.179718017578 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13649.019577026367 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13627.459671020508 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13615.140563964844 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13605.899765014648 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13693.679718017578 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13696.760375976562 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13735.260375976562 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13710.619812011719 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13775.299530029297 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13727.55990600586 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13761.44009399414 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13738.339859008789 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13733.72004699707 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13729.100234985352 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13730.640563964844 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13732.179718017578 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13709.079483032227 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13843.05990600586 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13839.980422973633 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13915.44009399414 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13918.519577026367 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13961.640563964844 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13938.540328979492 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13937 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13916.980422973633 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13929.299530029297 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13927.760375976562 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13886.179718017578 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13852.299530029297 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13878.480422973633 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13876.94009399414 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13887.72004699707 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13889.260375976562 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13926.22004699707 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13906.200469970703 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13898.5 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13520 exceeds single-stock cap 13500 (15% of capital).: 1

## case10

- **Setup:** 0 existing holding(s) worth ₹0 + ₹5,00,000 new capital = **₹5,00,000** total. Picked 40 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** TATAELXSI, CUMMINSIND, IDFCFIRSTB, ITC, HDFCBANK, COALINDIA, SHRIRAMFIN, SBICARD, INFOSYS, ATGL, CONCOR, AMBUJACEM, SBILIFE, IRFC, SIEMENS, BHARTIARTL, WIPRO, ABB, TRENT, HAVELLS, HINDPETRO, INDHOTEL, MARICO, ICICIBANK, KOTAKBANK, HINDALCO, HEROMOTOCO, CGPOWER, RELIANCE, HINDUNILVR, HAL, TATAMOTORS, PFC, DRREDDY, BHARATFORG, BAJFINANCE
- **Result:** 78 round trips, win rate 20.5%, profit factor 0.26, net P&L **₹-15,598** (-3.12%), max drawdown ₹15,598 (3.1%), final equity **₹4,84,402**.

| Symbol | P&L |
|---|---|
| AMBUJACEM | ₹1,105 |
| CUMMINSIND | ₹787 |
| INFOSYS | ₹331 |
| HINDPETRO | ₹63 |
| HINDALCO | ₹-120 |
| COALINDIA | ₹-223 |
| MARICO | ₹-226 |
| SHRIRAMFIN | ₹-235 |
| RELIANCE | ₹-283 |
| HEROMOTOCO | ₹-289 |
| DRREDDY | ₹-300 |
| WIPRO | ₹-351 |
| BAJFINANCE | ₹-412 |
| ABB | ₹-511 |
| PFC | ₹-529 |
| ITC | ₹-535 |
| HDFCBANK | ₹-576 |
| HAVELLS | ₹-603 |
| TRENT | ₹-659 |
| CONCOR | ₹-757 |
| BHARTIARTL | ₹-857 |
| IRFC | ₹-930 |
| SBILIFE | ₹-970 |
| SBICARD | ₹-1,094 |
| HAL | ₹-1,250 |
| ICICIBANK | ₹-1,318 |
| IDFCFIRSTB | ₹-1,496 |
| ATGL | ₹-1,627 |
| TATAELXSI | ₹-1,734 |

**Top trades:**
- ICICIBANK SHORT 26 @ 1420.72 → ₹-1,318 (Closed LONG position. rebalance TRIM)
- AMBUJACEM SHORT 89 @ 426.01 → ₹1,105 (Closed LONG position. rebalance TRIM)
- CUMMINSIND SHORT 13 @ 5548.89 → ₹1,094 (Closed LONG position. Bollinger target hit (price 5550.00 >= middle band 5522.70))
- TATAELXSI SHORT 10 @ 3711.16 → ₹-966 (Closed LONG position. rebalance TRIM)
- SHRIRAMFIN SHORT 33 @ 1140.77 → ₹829 (Closed LONG position. rebalance TRIM)
- SBICARD SHORT 114 @ 651.87 → ₹-825 (Closed LONG position. Bollinger target hit (price 652.00 >= middle band 650.62))
- IDFCFIRSTB SHORT 862 @ 86.30 → ₹-804 (Closed LONG position. RSI 83.4 overbought (>70))
- HAVELLS SHORT 62 @ 1187.06 → ₹-603 (Closed LONG position. Bollinger target hit (price 1187.30 >= middle band 1178.61))

**Gate counters (why signals died):**
- total_evaluations: 19266
- rsi_not_oversold: 10006
- no_mode: 3777
- executed: 134
- circuit_breaker: 98
- proposed: 78
- bollinger_band: 66
- volume: 41
- risk_blocked: 27
- cooldown: 4
- concentration_cap: 3

**RiskEngine block reasons:**
- Ticket size 75570 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 75365.40161132812 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 75027 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75053.70162963867 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75543.30358886719 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75520 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75476.0009765625 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75464.00146484375 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75200.80163574219 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75497.40161132812 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75358.80322265625 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75636 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75807.59838867188 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75933 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75761.40161132812 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76111.19677734375 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75959.40161132812 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75556.80322265625 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75642.59838867188 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75576.59838867188 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75550.19677734375 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75484.19677734375 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75141 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75174 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75306 exceeds single-stock cap 75000 (15% of capital).: 1
