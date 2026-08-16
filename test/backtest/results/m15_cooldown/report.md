# Mock-Data Backtest — 10 Cases (m15_cooldown, 1x capital, Re-focused Strategy, real NSE data)

> Tiers: **all** · Ensemble mode: **fast** · Strategy: regime-adaptive (mean-reversion / pullback / breakout) with re-focused risk caps (single-stock 15%, cash reserve 20%, risk-at-stop 1.5%, sector 30%, drawdown). Paper-only, net of costs. 5-min bars from real historical CSVs.

## Summary

| Case | Holdings | New Cap | Total Cap | Picks | Days | Rebal | Trades | Win% | PF | Net P&L | Return | MaxDD | Final |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| case1 | 0 | ₹20,000 | ₹20,000 | 20 | 30 | 5d | 32 | 46.9% | 1.04 | ₹8 | 0.04% | ₹180 (0.9%) | ₹20,008 |
| case2 | 2 | ₹20,000 | ₹35,000 | 18 | 30 | 5d | 40 | 27.5% | 0.25 | ₹-754 | -2.15% | ₹754 (2.2%) | ₹34,246 |
| case3 | 10 | ₹30,000 | ₹90,000 | 10 | 30 | 5d | 45 | 35.6% | 0.43 | ₹-1,187 | -1.32% | ₹1,385 (1.5%) | ₹88,813 |
| case4 | 0 | ₹10,000 | ₹10,000 | 10 | 30 | 5d | 31 | 22.6% | 0.21 | ₹-142 | -1.42% | ₹155 (1.5%) | ₹9,858 |
| case5 | 1 | ₹10,000 | ₹40,000 | 5 | 30 | 5d | 1 | 100.0% | inf | ₹3,003 | 7.51% | ₹0 (0.0%) | ₹43,003 |
| case6 | 5 | ₹50,000 | ₹1,00,000 | 15 | 30 | 5d | 47 | 19.1% | 0.25 | ₹-3,401 | -3.40% | ₹3,427 (3.4%) | ₹96,599 |
| case7 | 20 | ₹1,00,000 | ₹3,00,000 | 20 | 30 | 5d | 70 | 32.9% | 1.31 | ₹2,326 | 0.78% | ₹4,720 (1.6%) | ₹3,02,326 |
| case8 | 0 | ₹50,000 | ₹50,000 | 20 | 60 | 5d | 48 | 37.5% | 0.82 | ₹-231 | -0.46% | ₹540 (1.1%) | ₹49,769 |
| case9 | 10 | ₹30,000 | ₹90,000 | 10 | 30 | 5d | 42 | 19.0% | 0.44 | ₹-1,262 | -1.40% | ₹1,433 (1.6%) | ₹88,738 |
| case10 | 0 | ₹5,00,000 | ₹5,00,000 | 40 | 30 | 5d | 56 | 26.8% | 0.88 | ₹-1,834 | -0.37% | ₹10,176 (2.0%) | ₹4,98,166 |

## case1

- **Setup:** 0 existing holding(s) worth ₹0 + ₹20,000 new capital = **₹20,000** total. Picked 20 symbols, 30 days, rebalance every 5 day(s).
- **Symbols:** CONCOR, INDHOTEL, PFC, IOC, DELHIVERY, BANDHANBNK, TATAMOTORS, NMDC, IRB
- **Result:** 32 round trips, win rate 46.9%, profit factor 1.04, net P&L **₹8** (0.04%), max drawdown ₹180 (0.9%), final equity **₹20,008**.

| Symbol | P&L |
|---|---|
| BANDHANBNK | ₹105 |
| CONCOR | ₹89 |
| IOC | ₹3 |
| DELHIVERY | ₹-0 |
| TATAMOTORS | ₹-5 |
| PFC | ₹-30 |
| NMDC | ₹-39 |
| INDHOTEL | ₹-54 |
| IRB | ₹-61 |

**Top trades:**
- BANDHANBNK SHORT 17 @ 176.36 → ₹92 (Closed LONG position. Bollinger target hit (price 176.40 >= middle band 174.87))
- INDHOTEL SHORT 4 @ 725.30 → ₹-34 (Closed LONG position. Bollinger target hit (price 725.45 >= middle band 725.34))
- CONCOR SHORT 5 @ 523.85 → ₹27 (Closed LONG position. Bollinger target hit (price 523.95 >= middle band 518.65))
- IRB SHORT 147 @ 20.28 → ₹-25 (Closed LONG position. Bollinger target hit (price 20.28 >= middle band 19.98))
- NMDC SHORT 17 @ 83.78 → ₹-25 (Closed LONG position. rebalance TRIM)
- IRB SHORT 151 @ 19.76 → ₹-21 (Closed LONG position. Bollinger target hit (price 19.76 >= middle band 19.76))
- PFC SHORT 7 @ 418.17 → ₹-21 (Closed LONG position. Bollinger target hit (price 418.25 >= middle band 417.54))
- BANDHANBNK SHORT 14 @ 212.80 → ₹20 (Closed LONG position. Bollinger target hit (price 212.84 >= middle band 212.77))

**Gate counters (why signals died):**
- total_evaluations: 4812
- rsi_not_oversold: 2593
- no_mode: 1072
- executed: 63
- proposed: 32
- volume: 20
- cooldown: 18
- bollinger_band: 11
- circuit_breaker: 5
- risk_blocked: 2

**RiskEngine block reasons:**
- Ticket size 3047.3099327087402 exceeds single-stock cap 3000 (15% of capital).: 1
- Ticket size 3017.9101009368896 exceeds single-stock cap 3000 (15% of capital).: 1

## case2

- **Setup:** 2 existing holding(s) worth ₹15,000 + ₹20,000 new capital = **₹35,000** total. Picked 18 symbols, 30 days, rebalance every 5 day(s).
- **Symbols:** LICI, NATCOPHARM, COALINDIA, TATASTEEL, AXISBANK, ICICIBANK, INFY, HINDALCO, DRREDDY, MOTHERSON, ADANIGREEN, IDFCFIRSTB
- **Result:** 40 round trips, win rate 27.5%, profit factor 0.25, net P&L **₹-754** (-2.15%), max drawdown ₹754 (2.2%), final equity **₹34,246**.

| Symbol | P&L |
|---|---|
| INFY | ₹47 |
| AXISBANK | ₹28 |
| COALINDIA | ₹-8 |
| HINDALCO | ₹-15 |
| IDFCFIRSTB | ₹-16 |
| DRREDDY | ₹-24 |
| ICICIBANK | ₹-47 |
| TATASTEEL | ₹-54 |
| MOTHERSON | ₹-61 |
| LICI | ₹-76 |
| NATCOPHARM | ₹-122 |
| ADANIGREEN | ₹-405 |

**Top trades:**
- ADANIGREEN SHORT 3 @ 1381.72 → ₹-367 (Closed LONG position. Bollinger target hit (price 1382.00 >= middle band 1381.15))
- NATCOPHARM SHORT 3 @ 951.61 → ₹-124 (Closed LONG position. rebalance TRIM)
- ICICIBANK SHORT 3 @ 1424.32 → ₹-66 (Closed LONG position. Bollinger target hit (price 1424.60 >= middle band 1424.44))
- AXISBANK SHORT 4 @ 1271.75 → ₹52 (Closed LONG position. RSI 85.0 overbought (>70))
- ADANIGREEN SHORT 3 @ 1541.89 → ₹-38 (Closed LONG position. Bollinger target hit (price 1542.20 >= middle band 1528.22))
- MOTHERSON SHORT 32 @ 163.17 → ₹37 (Closed LONG position. RSI 79.4 overbought (>70))
- TATASTEEL SHORT 27 @ 192.26 → ₹-35 (Closed LONG position. Bollinger target hit (price 192.30 >= middle band 191.02))
- LICI SHORT 12 @ 429.11 → ₹-32 (Closed LONG position. Bollinger target hit (price 429.20 >= middle band 424.44))

**Gate counters (why signals died):**
- total_evaluations: 6429
- rsi_not_oversold: 3194
- no_mode: 1259
- risk_blocked: 77
- executed: 75
- proposed: 38
- bollinger_band: 32
- volume: 24
- circuit_breaker: 12
- concentration_cap: 10

**RiskEngine block reasons:**
- Ticket size 7468.950103759766 exceeds max trade allocation 7000.: 2
- Ticket size 7468.950103759766 exceeds single-stock cap 5250 (15% of capital).: 2
- Ticket size 7464.700103759766 exceeds max trade allocation 7000.: 2
- Ticket size 7464.700103759766 exceeds single-stock cap 5250 (15% of capital).: 2
- Ticket size 7476.599792480469 exceeds max trade allocation 7000.: 2
- Ticket size 7476.599792480469 exceeds single-stock cap 5250 (15% of capital).: 2
- Ticket size 6799.8001708984375 exceeds single-stock cap 5250 (15% of capital).: 2
- Ticket size 7480 exceeds max trade allocation 7000.: 2
- Ticket size 7480 exceeds single-stock cap 5250 (15% of capital).: 2
- Ticket size 7361 exceeds max trade allocation 7000.: 2
- Ticket size 7361 exceeds single-stock cap 5250 (15% of capital).: 2
- Ticket size 7510.599792480469 exceeds max trade allocation 7000.: 1
- Ticket size 7510.599792480469 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7474.900207519531 exceeds max trade allocation 7000.: 1
- Ticket size 7474.900207519531 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7472.349792480469 exceeds max trade allocation 7000.: 1
- Ticket size 7472.349792480469 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7473.200103759766 exceeds max trade allocation 7000.: 1
- Ticket size 7473.200103759766 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6806.8001708984375 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6792.8001708984375 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6796.3001708984375 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7470.650207519531 exceeds max trade allocation 7000.: 1
- Ticket size 7470.650207519531 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7478.299896240234 exceeds max trade allocation 7000.: 1
- Ticket size 7478.299896240234 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7474.049896240234 exceeds max trade allocation 7000.: 1
- Ticket size 7474.049896240234 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7487.650207519531 exceeds max trade allocation 7000.: 1
- Ticket size 7487.650207519531 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7483.400207519531 exceeds max trade allocation 7000.: 1
- Ticket size 7483.400207519531 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7482.549896240234 exceeds max trade allocation 7000.: 1
- Ticket size 7482.549896240234 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7451.099792480469 exceeds max trade allocation 7000.: 1
- Ticket size 7451.099792480469 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7459.599792480469 exceeds max trade allocation 7000.: 1
- Ticket size 7459.599792480469 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7449.400207519531 exceeds max trade allocation 7000.: 1
- Ticket size 7449.400207519531 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7447.700103759766 exceeds max trade allocation 7000.: 1
- Ticket size 7447.700103759766 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7455.349792480469 exceeds max trade allocation 7000.: 1
- Ticket size 7455.349792480469 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7468.099792480469 exceeds max trade allocation 7000.: 1
- Ticket size 7468.099792480469 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7453.650207519531 exceeds max trade allocation 7000.: 1
- Ticket size 7453.650207519531 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7446 exceeds max trade allocation 7000.: 1
- Ticket size 7446 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6808.1998291015625 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6830.599914550781 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6806.099914550781 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6818.6998291015625 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6830.9498291015625 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6828.150085449219 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6816.25 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6819.400085449219 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6845.650085449219 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6860.6998291015625 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6839 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6826.75 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7524.200103759766 exceeds max trade allocation 7000.: 1
- Ticket size 7524.200103759766 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7582 exceeds max trade allocation 7000.: 1
- Ticket size 7582 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7531 exceeds max trade allocation 7000.: 1
- Ticket size 7531 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7370.349792480469 exceeds max trade allocation 7000.: 1
- Ticket size 7370.349792480469 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7363.549896240234 exceeds max trade allocation 7000.: 1
- Ticket size 7363.549896240234 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7357.599792480469 exceeds max trade allocation 7000.: 1
- Ticket size 7357.599792480469 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7358.450103759766 exceeds max trade allocation 7000.: 1
- Ticket size 7358.450103759766 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7368.650207519531 exceeds max trade allocation 7000.: 1
- Ticket size 7368.650207519531 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7372.900207519531 exceeds max trade allocation 7000.: 1
- Ticket size 7372.900207519531 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7373.75 exceeds max trade allocation 7000.: 1
- Ticket size 7373.75 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7378.849792480469 exceeds max trade allocation 7000.: 1
- Ticket size 7378.849792480469 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7379.700103759766 exceeds max trade allocation 7000.: 1
- Ticket size 7379.700103759766 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 7375.450103759766 exceeds max trade allocation 7000.: 1
- Ticket size 7375.450103759766 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6705.3001708984375 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6720.6998291015625 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6713.6998291015625 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6707.75 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6710.1998291015625 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6695.849914550781 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6693.75 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6683.9498291015625 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6697.25 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6705.650085449219 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6727 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6754.650085449219 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6783 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6776 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6748 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6754.3001708984375 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6736.099914550781 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6721.75 exceeds single-stock cap 5250 (15% of capital).: 1
- Ticket size 6732.25 exceeds single-stock cap 5250 (15% of capital).: 1

## case3

- **Setup:** 10 existing holding(s) worth ₹60,000 + ₹30,000 new capital = **₹90,000** total. Picked 10 symbols, 30 days, rebalance every 5 day(s).
- **Symbols:** KEC, SBILIFE, GAIL, LICI, NAUKRI, MUTHOOTFIN, GMRINFRA, AUBANK, AUROPHARMA
- **Result:** 45 round trips, win rate 35.6%, profit factor 0.43, net P&L **₹-1,187** (-1.32%), max drawdown ₹1,385 (1.5%), final equity **₹88,813**.

| Symbol | P&L |
|---|---|
| AUBANK | ₹158 |
| LICI | ₹131 |
| MUTHOOTFIN | ₹-53 |
| SBILIFE | ₹-130 |
| AUROPHARMA | ₹-134 |
| GAIL | ₹-154 |
| NAUKRI | ₹-177 |
| GMRINFRA | ₹-273 |
| KEC | ₹-556 |

**Top trades:**
- KEC SHORT 29 @ 445.61 → ₹-441 (Closed LONG position. Bollinger target hit (price 445.70 >= middle band 444.61))
- AUBANK SHORT 13 @ 1036.49 → ₹265 (Closed LONG position. RSI 80.2 overbought (>70))
- GAIL SHORT 75 @ 175.50 → ₹-222 (Closed LONG position. Bollinger target hit (price 175.54 >= middle band 174.44))
- GMRINFRA SHORT 125 @ 106.71 → ₹-180 (Closed LONG position. Bollinger target hit (price 106.73 >= middle band 106.56))
- GMRINFRA SHORT 58 @ 111.70 → ₹-118 (Closed LONG position. Bollinger target hit (price 111.72 >= middle band 111.57))
- LICI SHORT 15 @ 441.71 → ₹112 (Closed LONG position. RSI 73.3 overbought (>70))
- SBILIFE SHORT 7 @ 1884.62 → ₹-91 (Closed LONG position. Bollinger target hit (price 1885.00 >= middle band 1879.65))
- GAIL SHORT 38 @ 174.27 → ₹86 (Closed LONG position. RSI 74.0 overbought (>70))

**Gate counters (why signals died):**
- total_evaluations: 4815
- rsi_not_oversold: 2203
- no_mode: 1098
- executed: 78
- proposed: 36
- volume: 25
- bollinger_band: 6
- concentration_cap: 3
- risk_blocked: 3
- cooldown: 1
- circuit_breaker: 1

**RiskEngine block reasons:**
- Ticket size 13723.750114440918 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13513.5 exceeds single-stock cap 13500 (15% of capital).: 1
- Ticket size 13530.400634765625 exceeds single-stock cap 13500 (15% of capital).: 1

## case4

- **Setup:** 0 existing holding(s) worth ₹0 + ₹10,000 new capital = **₹10,000** total. Picked 10 symbols, 30 days, rebalance every 5 day(s).
- **Symbols:** MOTILALOFS, SYNGENE, POONAWALLA, WHIRLPOOL, MARICO, INDUSINDBK
- **Result:** 31 round trips, win rate 22.6%, profit factor 0.21, net P&L **₹-142** (-1.42%), max drawdown ₹155 (1.5%), final equity **₹9,858**.

| Symbol | P&L |
|---|---|
| MARICO | ₹6 |
| INDUSINDBK | ₹-3 |
| WHIRLPOOL | ₹-11 |
| SYNGENE | ₹-11 |
| POONAWALLA | ₹-49 |
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
- executed: 62
- proposed: 31
- volume: 20
- cooldown: 3

**RiskEngine block reasons:**

## case5

- **Setup:** 1 existing holding(s) worth ₹30,000 + ₹10,000 new capital = **₹40,000** total. Picked 5 symbols, 30 days, rebalance every 5 day(s).
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

## case6

- **Setup:** 5 existing holding(s) worth ₹50,000 + ₹50,000 new capital = **₹1,00,000** total. Picked 15 symbols, 30 days, rebalance every 5 day(s).
- **Symbols:** AUBANK, OIL, HINDCOPPER, DMART, FORTIS, ASTRAL, BLUESTARCO, DELHIVERY, GODREJCP, FEDERALBNK, J&KBANK, HCLTECH, BIOCON, ACC
- **Result:** 47 round trips, win rate 19.1%, profit factor 0.25, net P&L **₹-3,401** (-3.40%), max drawdown ₹3,427 (3.4%), final equity **₹96,599**.

| Symbol | P&L |
|---|---|
| OIL | ₹200 |
| ACC | ₹177 |
| AUBANK | ₹44 |
| FEDERALBNK | ₹-24 |
| HCLTECH | ₹-122 |
| ASTRAL | ₹-165 |
| FORTIS | ₹-237 |
| DMART | ₹-407 |
| GODREJCP | ₹-448 |
| J&KBANK | ₹-600 |
| HINDCOPPER | ₹-727 |
| BLUESTARCO | ₹-1,093 |

**Top trades:**
- BLUESTARCO SHORT 9 @ 1514.70 → ₹-1,009 (Closed LONG position. Bollinger target hit (price 1515.00 >= middle band 1512.47))
- J&KBANK SHORT 83 @ 173.24 → ₹-519 (Closed LONG position. Bollinger target hit (price 173.27 >= middle band 172.29))
- OIL SHORT 17 @ 452.91 → ₹466 (Closed LONG position. rebalance TRIM)
- GODREJCP SHORT 14 @ 1032.49 → ₹-355 (Closed LONG position. Bollinger target hit (price 1032.70 >= middle band 1032.09))
- HINDCOPPER SHORT 26 @ 556.49 → ₹-339 (Closed LONG position. Bollinger target hit (price 556.60 >= middle band 540.46))
- AUBANK SHORT 14 @ 1039.29 → ₹325 (Closed LONG position. RSI 85.0 overbought (>70))
- FORTIS SHORT 10 @ 951.26 → ₹-237 (Closed LONG position. Bollinger target hit (price 951.45 >= middle band 950.88))
- ACC SHORT 11 @ 1354.13 → ₹199 (Closed LONG position. Bollinger target hit (price 1354.40 >= middle band 1350.48))

**Gate counters (why signals died):**
- total_evaluations: 7479
- rsi_not_oversold: 3686
- no_mode: 1373
- executed: 86
- risk_blocked: 64
- proposed: 42
- circuit_breaker: 23
- volume: 18
- cooldown: 11
- bollinger_band: 10

**RiskEngine block reasons:**
- Ticket size 15096 exceeds single-stock cap 15000 (15% of capital).: 7
- Ticket size 15487 exceeds single-stock cap 15000 (15% of capital).: 4
- Ticket size 15080.699584960938 exceeds single-stock cap 15000 (15% of capital).: 2
- Ticket size 15055.199584960938 exceeds single-stock cap 15000 (15% of capital).: 2
- Ticket size 15102.800415039062 exceeds single-stock cap 15000 (15% of capital).: 2
- Ticket size 15106.199584960938 exceeds single-stock cap 15000 (15% of capital).: 2
- Ticket size 15099.400207519531 exceeds single-stock cap 15000 (15% of capital).: 2
- Ticket size 15101.099792480469 exceeds single-stock cap 15000 (15% of capital).: 2
- Ticket size 15097.699584960938 exceeds single-stock cap 15000 (15% of capital).: 2
- Ticket size 15351 exceeds single-stock cap 15000 (15% of capital).: 2
- Ticket size 15480.199584960938 exceeds single-stock cap 15000 (15% of capital).: 2
- Ticket size 15036.5 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15077.300415039062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15050.099792480469 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15043.300415039062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15087.5 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15107.900207519531 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15070.5 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15111.300415039062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15104.5 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15267.699584960938 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15283 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15276.199584960938 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15279.599792480469 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15291.5 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15237.099792480469 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15128.300415039062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15169.099792480469 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15621.300415039062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15427.5 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15349.300415039062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15454.699584960938 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15471.699584960938 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15417.300415039062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15439.400207519531 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15488.699584960938 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15490.400207519531 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15502.300415039062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15510.800415039062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15531.199584960938 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15515.900207519531 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15425.800415039062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15391.800415039062 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15396.900207519531 exceeds single-stock cap 15000 (15% of capital).: 1
- Ticket size 15402 exceeds single-stock cap 15000 (15% of capital).: 1

## case7

- **Setup:** 20 existing holding(s) worth ₹2,00,000 + ₹1,00,000 new capital = **₹3,00,000** total. Picked 20 symbols, 30 days, rebalance every 5 day(s).
- **Symbols:** CIPLA, ZYDUSLIFE, ICICIPRULI, HINDALCO, MAXHEALTH, TATACONSUM, ADANIPORTS, HINDPETRO, ADANIENSOL, TATATECH, TATAMOTORS, BSE, HCLTECH, M&M, IOC, GICRE, JKCEMENT, CUMMINSIND, ASTRAL
- **Result:** 70 round trips, win rate 32.9%, profit factor 1.31, net P&L **₹2,326** (0.78%), max drawdown ₹4,720 (1.6%), final equity **₹3,02,326**.

| Symbol | P&L |
|---|---|
| TATATECH | ₹3,279 |
| HINDALCO | ₹2,059 |
| CUMMINSIND | ₹614 |
| HINDPETRO | ₹334 |
| IOC | ₹161 |
| JKCEMENT | ₹41 |
| ZYDUSLIFE | ₹-6 |
| TATAMOTORS | ₹-80 |
| ICICIPRULI | ₹-98 |
| ASTRAL | ₹-125 |
| TATACONSUM | ₹-232 |
| CIPLA | ₹-278 |
| MAXHEALTH | ₹-280 |
| ADANIENSOL | ₹-325 |
| M&M | ₹-328 |
| BSE | ₹-356 |
| GICRE | ₹-436 |
| ADANIPORTS | ₹-533 |
| HCLTECH | ₹-1,085 |

**Top trades:**
- TATATECH SHORT 27 @ 881.22 → ₹3,661 (Closed LONG position. rebalance TRIM)
- HINDALCO SHORT 24 @ 994.70 → ₹2,635 (Closed LONG position. rebalance TRIM)
- CUMMINSIND SHORT 8 @ 5548.89 → ₹671 (Closed LONG position. Bollinger target hit (price 5550.00 >= middle band 5522.70))
- HINDPETRO SHORT 116 @ 392.82 → ₹555 (Closed LONG position. Backtest end — force close)
- BSE SHORT 2 @ 3593.28 → ₹-434 (Closed LONG position. Bollinger target hit (price 3594.00 >= middle band 3583.70))
- GICRE SHORT 128 @ 348.13 → ₹-356 (Closed LONG position. Backtest end — force close)
- ADANIPORTS SHORT 25 @ 1781.04 → ₹-329 (Closed LONG position. Bollinger target hit (price 1781.40 >= middle band 1776.84))
- HCLTECH SHORT 36 @ 1225.55 → ₹-289 (Closed LONG position. Bollinger target hit (price 1225.80 >= middle band 1217.94))

**Gate counters (why signals died):**
- total_evaluations: 10172
- rsi_not_oversold: 5149
- no_mode: 2127
- risk_blocked: 183
- executed: 116
- proposed: 52
- circuit_breaker: 34
- volume: 32
- cooldown: 13
- bollinger_band: 7
- concentration_cap: 2

**RiskEngine block reasons:**
- Ticket size 45309.60070800781 exceeds single-stock cap 45000 (15% of capital).: 3
- Ticket size 46128 exceeds single-stock cap 45000 (15% of capital).: 2
- Ticket size 46185.6005859375 exceeds single-stock cap 45000 (15% of capital).: 2
- Ticket size 47265.6005859375 exceeds single-stock cap 45000 (15% of capital).: 2
- Ticket size 47392.798828125 exceeds single-stock cap 45000 (15% of capital).: 2
- Ticket size 47520 exceeds single-stock cap 45000 (15% of capital).: 2
- Ticket size 47756.49932861328 exceeds single-stock cap 45000 (15% of capital).: 2
- Ticket size 45367.60070800781 exceeds single-stock cap 45000 (15% of capital).: 2
- Ticket size 45419.798583984375 exceeds single-stock cap 45000 (15% of capital).: 2
- Ticket size 45535.798583984375 exceeds single-stock cap 45000 (15% of capital).: 2
- Ticket size 45121.0198059082 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45386.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45316.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45237.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45256.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45696 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45600 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45746.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45724.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45705.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45904.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45967.201171875 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46104 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46058.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46075.201171875 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46056 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46132.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46149.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46137.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46020 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46022.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46101.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46140 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46147.201171875 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46286.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46641.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46425.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46406.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46161.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46396.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46272 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46377.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46408.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46389.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46305.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46312.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46252.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46291.201171875 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46231.201171875 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46173.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46190.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46293.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46372.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46360.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46310.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46420.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46461.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46627.201171875 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46579.201171875 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46924.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46900.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47167.201171875 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47328 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47280 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47299.201171875 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47239.201171875 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47193.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47133.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47114.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47100 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47032.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47092.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47025.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46963.201171875 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46948.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46946.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46972.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47001.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46965.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47004 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46874.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46706.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 46773.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45005.401611328125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47306.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47253.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47248.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47320.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47210.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47313.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47436 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47452.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47512.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47424 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47414.3994140625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47433.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47460 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47524.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47464.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47620.798828125 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47592 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47553.6005859375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47544 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47755.201171875 exceeds single-stock cap 45000 (15% of capital).: 1
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
- Ticket size 45427.19873046875 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45214 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45253 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47332.99865722656 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47159.75067138672 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47217.5 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47847.25067138672 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48204.75067138672 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48422.00134277344 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47916.00067138672 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47489.75067138672 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 47555.75134277344 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48149.75067138672 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48257.00134277344 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48235 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48515.49865722656 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48691.49932861328 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48617.25067138672 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48529.24865722656 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48438.50067138672 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48358.75 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48347.74932861328 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48081.00067138672 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48015 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48400 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 48477.00134277344 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45054.39929199219 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45170.39929199219 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45257.39929199219 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45240 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45437.201416015625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45501 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45350.201416015625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45408.201416015625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45390.798583984375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45286.39929199219 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45251.60070800781 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45263.201416015625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45332.798583984375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45321.201416015625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45361.798583984375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45472 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45477.798583984375 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45588 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45582.201416015625 exceeds single-stock cap 45000 (15% of capital).: 1
- Ticket size 45576.39929199219 exceeds single-stock cap 45000 (15% of capital).: 1

## case8

- **Setup:** 0 existing holding(s) worth ₹0 + ₹50,000 new capital = **₹50,000** total. Picked 20 symbols, 60 days, rebalance every 5 day(s).
- **Symbols:** KEC, HAVELLS, INDUSINDBK, COLPAL, ICICIPRULI, PIDILITIND, HINDALCO, JINDALSAW, INFOSYS, UNITDSPR, FORTIS, RBLBANK, COALINDIA, CONCOR, NESTLEIND, AUROPHARMA, BERGERPAINT, BANDHANBNK
- **Result:** 48 round trips, win rate 37.5%, profit factor 0.82, net P&L **₹-231** (-0.46%), max drawdown ₹540 (1.1%), final equity **₹49,769**.

| Symbol | P&L |
|---|---|
| HINDALCO | ₹434 |
| FORTIS | ₹43 |
| UNITDSPR | ₹39 |
| INFOSYS | ₹30 |
| CONCOR | ₹21 |
| COALINDIA | ₹16 |
| NESTLEIND | ₹11 |
| BERGERPAINT | ₹-8 |
| INDUSINDBK | ₹-17 |
| PIDILITIND | ₹-30 |
| COLPAL | ₹-36 |
| ICICIPRULI | ₹-46 |
| AUROPHARMA | ₹-54 |
| RBLBANK | ₹-103 |
| HAVELLS | ₹-131 |
| JINDALSAW | ₹-138 |
| KEC | ₹-262 |

**Top trades:**
- HINDALCO SHORT 4 @ 994.70 → ₹439 (Closed LONG position. rebalance TRIM)
- KEC SHORT 16 @ 445.61 → ₹-243 (Closed LONG position. Bollinger target hit (price 445.70 >= middle band 444.61))
- JINDALSAW SHORT 27 @ 265.50 → ₹-143 (Closed LONG position. Bollinger target hit (price 265.55 >= middle band 258.94))
- UNITDSPR SHORT 5 @ 1467.51 → ₹119 (Closed LONG position. RSI 78.3 overbought (>70))
- JINDALSAW SHORT 28 @ 263.15 → ₹89 (Closed LONG position. Bollinger target hit (price 263.20 >= middle band 263.14))
- COLPAL SHORT 3 @ 2110.48 → ₹72 (Closed LONG position. RSI 80.3 overbought (>70))
- HAVELLS SHORT 6 @ 1187.06 → ₹-59 (Closed LONG position. Bollinger target hit (price 1187.30 >= middle band 1178.61))
- COLPAL SHORT 3 @ 2139.57 → ₹-52 (Closed LONG position. Bollinger target hit (price 2140.00 >= middle band 2131.35))

**Gate counters (why signals died):**
- total_evaluations: 9631
- rsi_not_oversold: 5245
- no_mode: 1562
- risk_blocked: 102
- executed: 94
- proposed: 48
- volume: 41
- bollinger_band: 28
- circuit_breaker: 15
- cooldown: 10
- concentration_cap: 5

**RiskEngine block reasons:**
- Ticket size 7688 exceeds single-stock cap 7500 (15% of capital).: 2
- Ticket size 7697.60009765625 exceeds single-stock cap 7500 (15% of capital).: 2
- Ticket size 7877.60009765625 exceeds single-stock cap 7500 (15% of capital).: 2
- Ticket size 7898.7998046875 exceeds single-stock cap 7500 (15% of capital).: 2
- Ticket size 7920 exceeds single-stock cap 7500 (15% of capital).: 2
- Ticket size 7564.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7552.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7539.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7542.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7616 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7600 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7624.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7620.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7617.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7650.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7661.2001953125 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7684 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7676.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7679.2001953125 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7676 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7688.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7691.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7689.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7670 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7670.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7683.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7690 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7691.2001953125 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7714.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7773.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7737.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7734.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7693.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7732.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7712 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7729.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7734.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7731.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7717.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7718.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7708.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7715.2001953125 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7705.2001953125 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7695.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7698.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7715.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7728.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7726.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7718.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7736.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7743.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7771.2001953125 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7763.2001953125 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7820.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7816.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7861.2001953125 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7888 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7880 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7883.2001953125 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7873.2001953125 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7865.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7855.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7852.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7850 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7838.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7848.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7837.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7827.2001953125 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7824.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7824.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7828.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7833.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7827.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7834 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7812.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7784.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7795.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7884.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7875.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7874.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7886.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7868.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7885.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7906 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7908.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7918.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7904 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7902.39990234375 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7905.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7910 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7920.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7910.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7936.7998046875 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7932 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7925.60009765625 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7924 exceeds single-stock cap 7500 (15% of capital).: 1
- Ticket size 7959.2001953125 exceeds single-stock cap 7500 (15% of capital).: 1

## case9

- **Setup:** 10 existing holding(s) worth ₹60,000 + ₹30,000 new capital = **₹90,000** total. Picked 10 symbols, 30 days, rebalance every 5 day(s).
- **Symbols:** IRCTC, IRFC, SBILIFE, CHAMBLFERT, CUMMINSIND, INFOSYS, BSE, HINDALCO, ZYDUSLIFE
- **Result:** 42 round trips, win rate 19.0%, profit factor 0.44, net P&L **₹-1,262** (-1.40%), max drawdown ₹1,433 (1.6%), final equity **₹88,738**.

| Symbol | P&L |
|---|---|
| IRFC | ₹348 |
| CUMMINSIND | ₹196 |
| SBILIFE | ₹9 |
| INFOSYS | ₹-40 |
| BSE | ₹-68 |
| ZYDUSLIFE | ₹-118 |
| IRCTC | ₹-217 |
| HINDALCO | ₹-408 |
| CHAMBLFERT | ₹-964 |

**Top trades:**
- IRFC SHORT 77 @ 90.23 → ₹435 (Closed LONG position. rebalance TRIM)
- CHAMBLFERT SHORT 29 @ 441.01 → ₹-429 (Closed LONG position. Bollinger target hit (price 441.10 >= middle band 440.95))
- BSE SHORT 1 @ 3593.28 → ₹-217 (Closed LONG position. Bollinger target hit (price 3594.00 >= middle band 3583.70))
- CUMMINSIND SHORT 2 @ 5548.89 → ₹168 (Closed LONG position. Bollinger target hit (price 5550.00 >= middle band 5522.70))
- CHAMBLFERT SHORT 15 @ 442.96 → ₹-161 (Closed LONG position. rebalance TRIM)
- HINDALCO SHORT 13 @ 1026.34 → ₹-152 (Closed LONG position. Bollinger target hit (price 1026.55 >= middle band 1023.70))
- BSE SHORT 3 @ 3493.70 → ₹146 (Closed LONG position. Bollinger target hit (price 3494.40 >= middle band 3475.44))
- CHAMBLFERT SHORT 31 @ 429.71 → ₹-133 (Closed LONG position. Bollinger target hit (price 429.80 >= middle band 429.73))

**Gate counters (why signals died):**
- total_evaluations: 4819
- rsi_not_oversold: 1924
- no_mode: 1198
- risk_blocked: 101
- executed: 73
- proposed: 34
- volume: 23
- concentration_cap: 2
- circuit_breaker: 1

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

- **Setup:** 0 existing holding(s) worth ₹0 + ₹5,00,000 new capital = **₹5,00,000** total. Picked 40 symbols, 30 days, rebalance every 5 day(s).
- **Symbols:** TATAELXSI, CUMMINSIND, IDFCFIRSTB, ITC, HDFCBANK, COALINDIA, SHRIRAMFIN, SBICARD, INFOSYS, ATGL, CONCOR, AMBUJACEM, SBILIFE, IRFC, SIEMENS, BHARTIARTL, WIPRO, ABB, TRENT, HAVELLS, HINDPETRO, INDHOTEL, MARICO, ICICIBANK, KOTAKBANK, HINDALCO, HEROMOTOCO, CGPOWER, RELIANCE, HINDUNILVR, HAL, TATAMOTORS, PFC, DRREDDY, BHARATFORG, BAJFINANCE
- **Result:** 56 round trips, win rate 26.8%, profit factor 0.88, net P&L **₹-1,834** (-0.37%), max drawdown ₹10,176 (2.0%), final equity **₹4,98,166**.

| Symbol | P&L |
|---|---|
| AMBUJACEM | ₹4,305 |
| CONCOR | ₹3,077 |
| RELIANCE | ₹2,393 |
| CUMMINSIND | ₹787 |
| INFOSYS | ₹331 |
| INDHOTEL | ₹273 |
| SBICARD | ₹-10 |
| COALINDIA | ₹-57 |
| HEROMOTOCO | ₹-61 |
| SBILIFE | ₹-88 |
| HINDALCO | ₹-120 |
| HINDUNILVR | ₹-126 |
| MARICO | ₹-146 |
| TRENT | ₹-240 |
| ITC | ₹-268 |
| DRREDDY | ₹-300 |
| ABB | ₹-315 |
| WIPRO | ₹-373 |
| PFC | ₹-529 |
| HDFCBANK | ₹-576 |
| HAVELLS | ₹-603 |
| SHRIRAMFIN | ₹-624 |
| IRFC | ₹-705 |
| TATAELXSI | ₹-854 |
| BHARTIARTL | ₹-857 |
| HAL | ₹-1,028 |
| IDFCFIRSTB | ₹-1,269 |
| KOTAKBANK | ₹-1,567 |
| ATGL | ₹-2,285 |

**Top trades:**
- AMBUJACEM SHORT 89 @ 443.91 → ₹4,305 (Closed LONG position. rebalance TRIM)
- CONCOR SHORT 146 @ 533.54 → ₹2,931 (Closed LONG position. Backtest end — force close)
- RELIANCE SHORT 29 @ 1327.03 → ₹2,393 (Closed LONG position. rebalance TRIM)
- KOTAKBANK SHORT 193 @ 381.22 → ₹-1,567 (Closed LONG position. Bollinger target hit (price 381.30 >= middle band 381.23))
- ATGL SHORT 106 @ 689.36 → ₹-1,491 (Closed LONG position. Bollinger target hit (price 689.50 >= middle band 688.85))
- CUMMINSIND SHORT 13 @ 5548.89 → ₹1,094 (Closed LONG position. Bollinger target hit (price 5550.00 >= middle band 5522.70))
- IDFCFIRSTB SHORT 862 @ 86.30 → ₹-804 (Closed LONG position. RSI 83.4 overbought (>70))
- HAVELLS SHORT 62 @ 1187.06 → ₹-603 (Closed LONG position. Bollinger target hit (price 1187.30 >= middle band 1178.61))

**Gate counters (why signals died):**
- total_evaluations: 19266
- rsi_not_oversold: 9951
- no_mode: 3661
- risk_blocked: 242
- executed: 107
- circuit_breaker: 73
- bollinger_band: 66
- proposed: 56
- volume: 54
- cooldown: 24
- concentration_cap: 4

**RiskEngine block reasons:**
- Ticket size 77310.0989074707 exceeds single-stock cap 75000 (15% of capital).: 3
- Ticket size 77363.8021850586 exceeds single-stock cap 75000 (15% of capital).: 3
- Ticket size 77319.0521850586 exceeds single-stock cap 75000 (15% of capital).: 3
- Ticket size 79386.5 exceeds single-stock cap 75000 (15% of capital).: 3
- Ticket size 79297 exceeds single-stock cap 75000 (15% of capital).: 3
- Ticket size 77462.25 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 77766.5521850586 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 78008.1978149414 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 78777.9010925293 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 78554.1510925293 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 78178.25 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 77489.0989074707 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 77426.4478149414 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 77417.5 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 79207.5 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 79171.6978149414 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 76560 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 76850 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 77140 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 76908 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 77134.20141601562 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 76867.40283203125 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 76925.40283203125 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 76942.79858398438 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 75810.5 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 75993 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 75927.29821777344 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 76664.59643554688 exceeds single-stock cap 75000 (15% of capital).: 2
- Ticket size 75110.00213623047 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75118.75 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75162.5 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75180.00106811523 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75212.10235595703 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75154.19882202148 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75077 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75405.10235595703 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75027 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75053.70162963867 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77077.4010925293 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77113.1978149414 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77641.25 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77650.1978149414 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77900.8021850586 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 78214.0521850586 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 79091.1510925293 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 78858.4478149414 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 78751.0521850586 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 78616.8021850586 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 78312.5 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 78044 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 78026.0989074707 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77981.3489074707 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77865 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77292.1978149414 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77471.1978149414 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76978.9478149414 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77032.6510925293 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77095.3021850586 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77265.3489074707 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77238.5 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77175.8489074707 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76522.5 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76567.25 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76603.0521850586 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76791 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76728.3489074707 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76764.1510925293 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76746.25 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76970 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76817.8489074707 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76755.1978149414 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76844.6978149414 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76943.1510925293 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77104.25 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77954.5 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77936.5989074707 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77891.8489074707 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77838.1510925293 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77578.5989074707 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77551.75 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77596.5 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77480.1510925293 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77372.75 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77453.3021850586 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77507 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77524.9010925293 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77399.5989074707 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77542.8021850586 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75520 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 78106.6510925293 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 78330.4010925293 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 78482.5521850586 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 78124.5521850586 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 78688.4010925293 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 79279.0989074707 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 79180.6510925293 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 79377.5521850586 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 79305.9478149414 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 79100.0989074707 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 79332.8021850586 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 79476 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75094.4415435791 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75111.29871368408 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75086.00974273682 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75018.56819915771 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75069.15257263184 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75266.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75452.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75614.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75446.40283203125 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75400 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75440.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75806 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75881.40283203125 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76206.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76316.40283203125 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76513.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76333.79858398438 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76351.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76594.79858398438 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76583.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76600.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76531 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76571.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76629.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76728.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76664.40283203125 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76658.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76670.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76687.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76577.40283203125 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76734 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76525.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76803.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76792 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77244.40283203125 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77430 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77459 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77267.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77111 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77360.40283203125 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77261.79858398438 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77290.79858398438 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77221.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77180.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77151.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76931.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77192.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77418.40283203125 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75087 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75092.14874267578 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75102.45251464844 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75035.5 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75107.60125732422 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75056.10125732422 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76873.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76763 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76757.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76710.79858398438 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77018.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77000.79858398438 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77029.79858398438 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77174.79858398438 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77198 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76954.40283203125 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76989.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77006.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76902.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76844.20141601562 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76948.59716796875 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76983.40283203125 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75204.59643554688 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75482 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76350.70178222656 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76372.59643554688 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76007.59643554688 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75876.20178222656 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75774 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75898.09643554688 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75562.29821777344 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75759.40356445312 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75795.90356445312 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75963.79821777344 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76102.5 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75744.79821777344 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 75040 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76204.70178222656 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76883.59643554688 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76796 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76518.59643554688 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76394.5 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76708.40356445312 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76693.79821777344 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76591.59643554688 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76635.40356445312 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76628.09643554688 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76598.90356445312 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76533.20178222656 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76504 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 76934.70178222656 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77161 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77876.40356445312 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77584.40356445312 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77599 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77854.5 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77672 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 78022.40356445312 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77964 exceeds single-stock cap 75000 (15% of capital).: 1
- Ticket size 77912.90356445312 exceeds single-stock cap 75000 (15% of capital).: 1
