# Mock-Data Backtest — 10 Cases (m15, 1x capital, Re-focused Strategy, real NSE data)

> Tiers: **all** · Ensemble mode: **fast** · Strategy: regime-adaptive (mean-reversion / pullback / breakout) with re-focused risk caps (single-stock 15%, cash reserve 20%, risk-at-stop 1.5%, sector 30%, drawdown). Paper-only, net of costs. 5-min bars from real historical CSVs.

## Summary

| Case | Holdings | New Cap | Total Cap | Picks | Days | Rebal | Trades | Win% | PF | Net P&L | Return | MaxDD | Final |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| case1 | 0 | ₹20,000 | ₹20,000 | 20 | 30 | 1d | 13 | 38.5% | 0.32 | ₹-97 | -0.49% | ₹120 (0.6%) | ₹19,903 |
| case2 | 2 | ₹20,000 | ₹35,000 | 18 | 30 | 1d | 14 | 28.6% | 0.23 | ₹-215 | -0.61% | ₹215 (0.6%) | ₹34,785 |
| case3 | 10 | ₹30,000 | ₹90,000 | 10 | 30 | 1d | 19 | 52.6% | 1.12 | ₹45 | 0.05% | ₹230 (0.3%) | ₹90,045 |
| case4 | 0 | ₹10,000 | ₹10,000 | 10 | 30 | 1d | 5 | 60.0% | 1.03 | ₹0 | 0.00% | ₹14 (0.1%) | ₹10,000 |
| case5 | 1 | ₹10,000 | ₹40,000 | 5 | 30 | 1d | 1 | 100.0% | inf | ₹3,003 | 7.51% | ₹0 (0.0%) | ₹43,003 |
| case6 | 5 | ₹50,000 | ₹1,00,000 | 15 | 30 | 1d | 17 | 41.2% | 0.76 | ₹-186 | -0.19% | ₹524 (0.5%) | ₹99,814 |
| case7 | 20 | ₹1,00,000 | ₹3,00,000 | 20 | 30 | 1d | 35 | 54.3% | 0.89 | ₹-388 | -0.13% | ₹1,553 (0.5%) | ₹2,99,612 |
| case8 | 0 | ₹50,000 | ₹50,000 | 20 | 60 | 1d | 13 | 46.2% | 1.11 | ₹22 | 0.04% | ₹112 (0.2%) | ₹50,022 |
| case9 | 10 | ₹30,000 | ₹90,000 | 10 | 30 | 5d | 19 | 42.1% | 1.13 | ₹109 | 0.12% | ₹716 (0.8%) | ₹90,109 |
| case10 | 0 | ₹5,00,000 | ₹5,00,000 | 40 | 30 | 1d | 29 | 41.4% | 0.57 | ₹-2,735 | -0.55% | ₹3,263 (0.7%) | ₹4,97,265 |

## case1

- **Setup:** 0 existing holding(s) worth ₹0 + ₹20,000 new capital = **₹20,000** total. Picked 20 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** CONCOR, INDHOTEL, PFC, IOC, DELHIVERY, BANDHANBNK, TATAMOTORS, NMDC, IRB
- **Result:** 13 round trips, win rate 38.5%, profit factor 0.32, net P&L **₹-97** (-0.49%), max drawdown ₹120 (0.6%), final equity **₹19,903**.

| Symbol | P&L |
|---|---|
| INDHOTEL | ₹12 |
| BANDHANBNK | ₹11 |
| PFC | ₹6 |
| IOC | ₹3 |
| CONCOR | ₹-21 |
| NMDC | ₹-25 |
| IRB | ₹-84 |

**Top trades:**
- IRB SHORT 76 @ 19.53 → ₹-40 (Closed LONG position. rebalance TRIM)
- NMDC SHORT 17 @ 83.78 → ₹-25 (Closed LONG position. rebalance TRIM)
- IRB SHORT 151 @ 19.76 → ₹-21 (Closed LONG position. Bollinger target hit (price 19.76 >= middle band 19.76))
- BANDHANBNK SHORT 14 @ 212.80 → ₹20 (Closed LONG position. Bollinger target hit (price 212.84 >= middle band 212.77))
- CONCOR SHORT 2 @ 514.90 → ₹-18 (Closed LONG position. rebalance TRIM)
- IRB SHORT 154 @ 19.35 → ₹-12 (Closed LONG position. Bollinger target hit (price 19.35 >= middle band 19.33))
- INDHOTEL SHORT 4 @ 728.85 → ₹12 (Closed LONG position. Bollinger target hit (price 729.00 >= middle band 728.86))
- IRB SHORT 154 @ 19.47 → ₹-11 (Closed LONG position. Bollinger target hit (price 19.47 >= middle band 19.45))

**Gate counters (why signals died):**
- total_evaluations: 4812
- rsi_not_oversold: 2346
- no_mode: 1028
- volume: 28
- executed: 21
- proposed: 13
- bollinger_band: 5

**RiskEngine block reasons:**

## case2

- **Setup:** 2 existing holding(s) worth ₹15,000 + ₹20,000 new capital = **₹35,000** total. Picked 18 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** LICI, NATCOPHARM, COALINDIA, TATASTEEL, AXISBANK, ICICIBANK, INFY, HINDALCO, DRREDDY, MOTHERSON, ADANIGREEN, IDFCFIRSTB
- **Result:** 14 round trips, win rate 28.6%, profit factor 0.23, net P&L **₹-215** (-0.61%), max drawdown ₹215 (0.6%), final equity **₹34,785**.

| Symbol | P&L |
|---|---|
| HINDALCO | ₹28 |
| COALINDIA | ₹-8 |
| MOTHERSON | ₹-8 |
| AXISBANK | ₹-12 |
| LICI | ₹-16 |
| DRREDDY | ₹-35 |
| ICICIBANK | ₹-58 |
| NATCOPHARM | ₹-105 |

**Top trades:**
- ICICIBANK SHORT 1 @ 1420.72 → ₹-76 (Closed LONG position. rebalance TRIM)
- NATCOPHARM SHORT 2 @ 942.96 → ₹-57 (Closed LONG position. rebalance TRIM)
- DRREDDY SHORT 4 @ 1137.77 → ₹-35 (Closed LONG position. Bollinger target hit (price 1138.00 >= middle band 1136.79))
- NATCOPHARM SHORT 2 @ 919.72 → ₹-30 (Closed LONG position. rebalance TRIM)
- HINDALCO SHORT 5 @ 945.36 → ₹28 (Closed LONG position. Bollinger target hit (price 945.55 >= middle band 945.44))
- LICI SHORT 8 @ 432.91 → ₹-23 (Closed LONG position. rebalance TRIM)
- ICICIBANK SHORT 3 @ 1441.81 → ₹18 (Closed LONG position. Bollinger target hit (price 1442.10 >= middle band 1441.19))
- NATCOPHARM SHORT 2 @ 910.72 → ₹-14 (Closed LONG position. rebalance TRIM)

**Gate counters (why signals died):**
- total_evaluations: 6429
- rsi_not_oversold: 3137
- no_mode: 1291
- bollinger_band: 29
- volume: 24
- executed: 19
- proposed: 12
- concentration_cap: 6
- risk_blocked: 5
- cooldown: 2
- circuit_breaker: 2

**RiskEngine block reasons:**
- Ticket size 6799.8001708984375 exceeds single-stock cap 5250 (15% of capital).: 2
- Ticket size 6806.8001708984375 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6792.8001708984375 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6796.3001708984375 exceeds single-stock cap 5250 (15% of capital).: 1

## case3

- **Setup:** 10 existing holding(s) worth ₹60,000 + ₹30,000 new capital = **₹90,000** total. Picked 10 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** KEC, SBILIFE, GAIL, LICI, NAUKRI, MUTHOOTFIN, GMRINFRA, AUBANK, AUROPHARMA
- **Result:** 19 round trips, win rate 52.6%, profit factor 1.12, net P&L **₹45** (0.05%), max drawdown ₹230 (0.3%), final equity **₹90,045**.

| Symbol | P&L |
|---|---|
| LICI | ₹131 |
| GAIL | ₹72 |
| NAUKRI | ₹62 |
| SBILIFE | ₹56 |
| AUROPHARMA | ₹3 |
| KEC | ₹-28 |
| MUTHOOTFIN | ₹-39 |
| AUBANK | ₹-41 |
| GMRINFRA | ₹-169 |

**Top trades:**
- GMRINFRA SHORT 58 @ 111.70 → ₹-118 (Closed LONG position. Bollinger target hit (price 111.72 >= middle band 111.57))
- LICI SHORT 15 @ 441.71 → ₹112 (Closed LONG position. RSI 73.3 overbought (>70))
- GAIL SHORT 38 @ 174.27 → ₹86 (Closed LONG position. RSI 74.0 overbought (>70))
- KEC SHORT 13 @ 507.90 → ₹-79 (Closed LONG position. Bollinger target hit (price 508.00 >= middle band 507.94))
- NAUKRI SHORT 10 @ 1241.75 → ₹71 (Closed LONG position. Bollinger target hit (price 1242.00 >= middle band 1240.35))
- SBILIFE SHORT 3 @ 1866.23 → ₹56 (Closed LONG position. Bollinger target hit (price 1866.60 >= middle band 1863.41))
- AUBANK SHORT 6 @ 1032.49 → ₹-53 (Closed LONG position. Bollinger target hit (price 1032.70 >= middle band 1032.05))
- KEC SHORT 27 @ 487.75 → ₹51 (Closed LONG position. Bollinger target hit (price 487.85 >= middle band 487.46))

**Gate counters (why signals died):**
- total_evaluations: 4815
- rsi_not_oversold: 2066
- no_mode: 1119
- executed: 26
- volume: 25
- proposed: 10
- bollinger_band: 5
- risk_blocked: 1

**RiskEngine block reasons:**
- Ticket size 13723.750114440918 exceeds single-stock cap 13500 (15% of capital).: 1

## case4

- **Setup:** 0 existing holding(s) worth ₹0 + ₹10,000 new capital = **₹10,000** total. Picked 10 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** MOTILALOFS, SYNGENE, POONAWALLA, WHIRLPOOL, MARICO, INDUSINDBK
- **Result:** 5 round trips, win rate 60.0%, profit factor 1.03, net P&L **₹0** (0.00%), max drawdown ₹14 (0.1%), final equity **₹10,000**.

| Symbol | P&L |
|---|---|
| SYNGENE | ₹13 |
| WHIRLPOOL | ₹-4 |
| MOTILALOFS | ₹-9 |

**Top trades:**
- SYNGENE SHORT 3 @ 416.12 → ₹11 (Closed LONG position. Bollinger target hit (price 416.20 >= middle band 416.10))
- MOTILALOFS SHORT 1 @ 945.56 → ₹-9 (Closed LONG position. Bollinger target hit (price 945.75 >= middle band 940.94))
- WHIRLPOOL SHORT 1 @ 788.59 → ₹-5 (Closed LONG position. Bollinger target hit (price 788.75 >= middle band 787.97))
- SYNGENE SHORT 3 @ 407.32 → ₹2 (Closed LONG position. Bollinger target hit (price 407.40 >= middle band 406.98))
- WHIRLPOOL SHORT 1 @ 770.00 → ₹1 (Closed LONG position. Bollinger target hit (price 770.15 >= middle band 769.73))

**Gate counters (why signals died):**
- total_evaluations: 3212
- rsi_not_oversold: 1388
- no_mode: 525
- volume: 19
- executed: 10
- proposed: 5

**RiskEngine block reasons:**

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
- rsi_not_oversold: 547
- risk_blocked: 532
- no_mode: 318
- volume: 9
- bollinger_band: 2
- proposed: 1

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
- Ticket size 16490 exceeds max trade allocation 8000.: 1
- Ticket size 16490 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16490.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32948.00048828125 exceeds max trade allocation 8000.: 1
- Ticket size 32948.00048828125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32948.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 32976.0009765625 exceeds max trade allocation 8000.: 1
- Ticket size 32976.0009765625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 32976.00 > spendable 32000.00 (after 20% cash reserve).: 1
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
- Ticket size 16390 exceeds max trade allocation 8000.: 1
- Ticket size 16390 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 29685.94 + ticket 16390.00 > spendable 32000.00 (after 20% cash reserve).: 1

## case6

- **Setup:** 5 existing holding(s) worth ₹50,000 + ₹50,000 new capital = **₹1,00,000** total. Picked 15 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** AUBANK, OIL, HINDCOPPER, DMART, FORTIS, ASTRAL, BLUESTARCO, DELHIVERY, GODREJCP, FEDERALBNK, J&KBANK, HCLTECH, BIOCON, ACC
- **Result:** 17 round trips, win rate 41.2%, profit factor 0.76, net P&L **₹-186** (-0.19%), max drawdown ₹524 (0.5%), final equity **₹99,814**.

| Symbol | P&L |
|---|---|
| BIOCON | ₹226 |
| ASTRAL | ₹103 |
| HCLTECH | ₹67 |
| OIL | ₹55 |
| J&KBANK | ₹15 |
| AUBANK | ₹-66 |
| GODREJCP | ₹-74 |
| DMART | ₹-75 |
| HINDCOPPER | ₹-200 |
| FORTIS | ₹-237 |

**Top trades:**
- FORTIS SHORT 10 @ 951.26 → ₹-237 (Closed LONG position. Bollinger target hit (price 951.45 >= middle band 950.88))
- BIOCON SHORT 34 @ 440.11 → ₹199 (Closed LONG position. Bollinger target hit (price 440.20 >= middle band 438.79))
- HINDCOPPER SHORT 15 @ 474.06 → ₹-179 (Closed LONG position. rebalance TRIM)
- OIL SHORT 17 @ 443.91 → ₹161 (Closed LONG position. rebalance TRIM)
- OIL SHORT 22 @ 436.71 → ₹-106 (Closed LONG position. Bollinger target hit (price 436.80 >= middle band 434.26))
- ASTRAL SHORT 10 @ 1446.81 → ₹103 (Closed LONG position. Bollinger target hit (price 1447.10 >= middle band 1446.22))
- AUBANK SHORT 9 @ 1032.49 → ₹-79 (Closed LONG position. Bollinger target hit (price 1032.70 >= middle band 1032.05))
- GODREJCP SHORT 14 @ 1048.69 → ₹-74 (Closed LONG position. Bollinger target hit (price 1048.90 >= middle band 1048.61))

**Gate counters (why signals died):**
- total_evaluations: 7479
- rsi_not_oversold: 3051
- no_mode: 1485
- volume: 26
- executed: 23
- proposed: 12
- risk_blocked: 7
- circuit_breaker: 5
- bollinger_band: 4
- concentration_cap: 1

**RiskEngine block reasons:**
- Ticket size 15096 exceeds single-stock cap 15000 (15% of capital).: 2
- Ticket size 15009.300415039062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15036.5 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15077.300415039062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15080.699584960938 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15062 exceeds single-stock cap 15000 (15% of capital).: 1

## case7

- **Setup:** 20 existing holding(s) worth ₹2,00,000 + ₹1,00,000 new capital = **₹3,00,000** total. Picked 20 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** CIPLA, ZYDUSLIFE, ICICIPRULI, HINDALCO, MAXHEALTH, TATACONSUM, ADANIPORTS, HINDPETRO, ADANIENSOL, TATATECH, TATAMOTORS, BSE, HCLTECH, M&M, IOC, GICRE, JKCEMENT, CUMMINSIND, ASTRAL
- **Result:** 35 round trips, win rate 54.3%, profit factor 0.89, net P&L **₹-388** (-0.13%), max drawdown ₹1,553 (0.5%), final equity **₹2,99,612**.

| Symbol | P&L |
|---|---|
| CUMMINSIND | ₹719 |
| HINDPETRO | ₹603 |
| HCLTECH | ₹427 |
| ASTRAL | ₹319 |
| ZYDUSLIFE | ₹250 |
| ICICIPRULI | ₹155 |
| M&M | ₹87 |
| CIPLA | ₹66 |
| TATAMOTORS | ₹62 |
| MAXHEALTH | ₹51 |
| JKCEMENT | ₹41 |
| IOC | ₹9 |
| ADANIENSOL | ₹-49 |
| TATATECH | ₹-70 |
| TATACONSUM | ₹-102 |
| HINDALCO | ₹-159 |
| BSE | ₹-429 |
| GICRE | ₹-1,053 |
| ADANIPORTS | ₹-1,317 |

**Top trades:**
- CUMMINSIND SHORT 8 @ 5548.89 → ₹671 (Closed LONG position. Bollinger target hit (price 5550.00 >= middle band 5522.70))
- ADANIPORTS SHORT 12 @ 1721.66 → ₹-657 (Closed LONG position. rebalance TRIM)
- BSE SHORT 2 @ 3578.88 → ₹-463 (Closed LONG position. rebalance EXIT)
- GICRE SHORT 63 @ 352.73 → ₹-391 (Closed LONG position. rebalance TRIM)
- ADANIPORTS SHORT 12 @ 1779.64 → ₹-364 (Closed LONG position. rebalance TRIM)
- GICRE SHORT 64 @ 348.13 → ₹-356 (Closed LONG position. rebalance TRIM)
- ASTRAL SHORT 31 @ 1446.81 → ₹320 (Closed LONG position. Bollinger target hit (price 1447.10 >= middle band 1446.22))
- ADANIPORTS SHORT 27 @ 1650.47 → ₹-317 (Closed LONG position. Bollinger target hit (price 1650.80 >= middle band 1649.16))

**Gate counters (why signals died):**
- total_evaluations: 10172
- rsi_not_oversold: 4616
- no_mode: 2145
- volume: 49
- executed: 42
- risk_blocked: 20
- proposed: 17
- bollinger_band: 6
- circuit_breaker: 2
- cooldown: 1

**RiskEngine block reasons:**
- Ticket size 45132.601959228516 exceeds single-stock cap 45000 (15% of capital).: 2
- Ticket size 45386.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45316.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45200.748596191406 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45016.751403808594 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45091.5007019043 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45028.248596191406 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45155.069412231445 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45190.3796081543 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45100.5 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45103.708236694336 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45113.33784484863 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45119.759216308594 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45171.1203918457 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45135.81019592285 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45054.39929199219 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45170.39929199219 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45257.39929199219 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45240 exceeds single-stock cap 45000 (15% of capital).: 1

## case8

- **Setup:** 0 existing holding(s) worth ₹0 + ₹50,000 new capital = **₹50,000** total. Picked 20 symbols, 60 days, rebalance every 1 day(s).
- **Symbols:** KEC, HAVELLS, INDUSINDBK, COLPAL, ICICIPRULI, PIDILITIND, HINDALCO, JINDALSAW, INFOSYS, UNITDSPR, FORTIS, RBLBANK, COALINDIA, CONCOR, NESTLEIND, AUROPHARMA, BERGERPAINT, BANDHANBNK
- **Result:** 13 round trips, win rate 46.2%, profit factor 1.11, net P&L **₹22** (0.04%), max drawdown ₹112 (0.2%), final equity **₹50,022**.

| Symbol | P&L |
|---|---|
| JINDALSAW | ₹89 |
| KEC | ₹28 |
| BANDHANBNK | ₹27 |
| RBLBANK | ₹20 |
| COALINDIA | ₹-12 |
| HINDALCO | ₹-36 |
| NESTLEIND | ₹-40 |
| CONCOR | ₹-57 |

**Top trades:**
- JINDALSAW SHORT 28 @ 263.15 → ₹89 (Closed LONG position. Bollinger target hit (price 263.20 >= middle band 263.14))
- NESTLEIND SHORT 4 @ 1502.70 → ₹-51 (Closed LONG position. Bollinger target hit (price 1503.00 >= middle band 1501.46))
- BANDHANBNK SHORT 35 @ 212.80 → ₹50 (Closed LONG position. Bollinger target hit (price 212.84 >= middle band 212.77))
- CONCOR SHORT 7 @ 514.90 → ₹-50 (Closed LONG position. rebalance TRIM)
- HINDALCO SHORT 3 @ 953.31 → ₹-35 (Closed LONG position. rebalance TRIM)
- KEC SHORT 15 @ 487.75 → ₹28 (Closed LONG position. Bollinger target hit (price 487.85 >= middle band 487.46))
- BANDHANBNK SHORT 21 @ 170.43 → ₹-23 (Closed LONG position. rebalance TRIM)
- RBLBANK SHORT 20 @ 364.93 → ₹20 (Closed LONG position. Bollinger target hit (price 365.00 >= middle band 364.93))

**Gate counters (why signals died):**
- total_evaluations: 9631
- rsi_not_oversold: 4626
- no_mode: 1585
- volume: 43
- bollinger_band: 26
- executed: 19
- proposed: 13
- risk_blocked: 2

**RiskEngine block reasons:**
- Ticket size 7564.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7552.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1

## case9

- **Setup:** 10 existing holding(s) worth ₹60,000 + ₹30,000 new capital = **₹90,000** total. Picked 10 symbols, 30 days, rebalance every 5 day(s).
- **Symbols:** IRCTC, IRFC, SBILIFE, CHAMBLFERT, CUMMINSIND, INFOSYS, BSE, HINDALCO, ZYDUSLIFE
- **Result:** 19 round trips, win rate 42.1%, profit factor 1.13, net P&L **₹109** (0.12%), max drawdown ₹716 (0.8%), final equity **₹90,109**.

| Symbol | P&L |
|---|---|
| IRFC | ₹348 |
| CUMMINSIND | ₹215 |
| INFOSYS | ₹68 |
| SBILIFE | ₹56 |
| BSE | ₹-28 |
| IRCTC | ₹-56 |
| HINDALCO | ₹-95 |
| CHAMBLFERT | ₹-398 |

**Top trades:**
- IRFC SHORT 77 @ 90.23 → ₹435 (Closed LONG position. rebalance TRIM)
- BSE SHORT 1 @ 3593.28 → ₹-217 (Closed LONG position. Bollinger target hit (price 3594.00 >= middle band 3583.70))
- CUMMINSIND SHORT 2 @ 5548.89 → ₹168 (Closed LONG position. Bollinger target hit (price 5550.00 >= middle band 5522.70))
- CHAMBLFERT SHORT 15 @ 442.96 → ₹-161 (Closed LONG position. rebalance TRIM)
- BSE SHORT 3 @ 3493.70 → ₹146 (Closed LONG position. Bollinger target hit (price 3494.40 >= middle band 3475.44))
- CHAMBLFERT SHORT 31 @ 429.71 → ₹-133 (Closed LONG position. Bollinger target hit (price 429.80 >= middle band 429.73))
- HINDALCO SHORT 6 @ 962.01 → ₹-95 (Closed LONG position. Bollinger target hit (price 962.20 >= middle band 960.67))
- IRCTC SHORT 27 @ 490.35 → ₹-76 (Closed LONG position. Bollinger target hit (price 490.45 >= middle band 488.63))

**Gate counters (why signals died):**
- total_evaluations: 4819
- rsi_not_oversold: 1793
- no_mode: 1220
- risk_blocked: 100
- executed: 28
- volume: 23
- proposed: 11
- concentration_cap: 1

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

## case10

- **Setup:** 0 existing holding(s) worth ₹0 + ₹5,00,000 new capital = **₹5,00,000** total. Picked 40 symbols, 30 days, rebalance every 1 day(s).
- **Symbols:** TATAELXSI, CUMMINSIND, IDFCFIRSTB, ITC, HDFCBANK, COALINDIA, SHRIRAMFIN, SBICARD, INFOSYS, ATGL, CONCOR, AMBUJACEM, SBILIFE, IRFC, SIEMENS, BHARTIARTL, WIPRO, ABB, TRENT, HAVELLS, HINDPETRO, INDHOTEL, MARICO, ICICIBANK, KOTAKBANK, HINDALCO, HEROMOTOCO, CGPOWER, RELIANCE, HINDUNILVR, HAL, TATAMOTORS, PFC, DRREDDY, BHARATFORG, BAJFINANCE
- **Result:** 29 round trips, win rate 41.4%, profit factor 0.57, net P&L **₹-2,735** (-0.55%), max drawdown ₹3,263 (0.7%), final equity **₹4,97,265**.

| Symbol | P&L |
|---|---|
| CUMMINSIND | ₹1,094 |
| BHARATFORG | ₹473 |
| ABB | ₹385 |
| HINDPETRO | ₹347 |
| HEROMOTOCO | ₹301 |
| INDHOTEL | ₹273 |
| SBICARD | ₹174 |
| PFC | ₹165 |
| HINDALCO | ₹5 |
| ATGL | ₹-100 |
| COALINDIA | ₹-113 |
| BAJFINANCE | ₹-162 |
| CONCOR | ₹-226 |
| ITC | ₹-242 |
| WIPRO | ₹-270 |
| RELIANCE | ₹-347 |
| HDFCBANK | ₹-370 |
| IRFC | ₹-603 |
| TATAELXSI | ₹-966 |
| CGPOWER | ₹-1,233 |
| ICICIBANK | ₹-1,318 |

**Top trades:**
- ICICIBANK SHORT 26 @ 1420.72 → ₹-1,318 (Closed LONG position. rebalance TRIM)
- CGPOWER SHORT 41 @ 883.32 → ₹-1,233 (Closed LONG position. rebalance TRIM)
- CUMMINSIND SHORT 13 @ 5548.89 → ₹1,094 (Closed LONG position. Bollinger target hit (price 5550.00 >= middle band 5522.70))
- TATAELXSI SHORT 10 @ 3711.16 → ₹-966 (Closed LONG position. rebalance TRIM)
- ABB SHORT 10 @ 7224.05 → ₹645 (Closed LONG position. Bollinger target hit (price 7225.50 >= middle band 7193.88))
- HDFCBANK SHORT 100 @ 741.85 → ₹-501 (Closed LONG position. Bollinger target hit (price 742.00 >= middle band 740.55))
- BHARATFORG SHORT 35 @ 2106.88 → ₹473 (Closed LONG position. Bollinger target hit (price 2107.30 >= middle band 2104.63))
- IRFC SHORT 855 @ 87.46 → ₹-398 (Closed LONG position. Bollinger target hit (price 87.48 >= middle band 87.37))

**Gate counters (why signals died):**
- total_evaluations: 19266
- rsi_not_oversold: 9411
- no_mode: 3723
- volume: 80
- bollinger_band: 49
- executed: 37
- proposed: 29
- risk_blocked: 25
- circuit_breaker: 20
- cooldown: 2
- concentration_cap: 2

**RiskEngine block reasons:**
- Ticket size 75027 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 75053.70162963867 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75140.20095825195 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75289.3480834961 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75493.45095825195 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75972.29904174805 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75791.75 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75681.8480834961 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75532.70095825195 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75297.20095825195 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75155.9019165039 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75643.9990234375 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75527.998046875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75087 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75092.14874267578 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75102.45251464844 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75035.5 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75107.60125732422 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75056.10125732422 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75858.64764404297 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75549.85235595703 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75675.30117797852 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75569.14764404297 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75511.25 exceeds single-stock cap 75000 (15% of capital).: 1
