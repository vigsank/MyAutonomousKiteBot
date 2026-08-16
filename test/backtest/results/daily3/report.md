# Mock-Data Backtest — 10 Cases (daily3, 1x capital, Re-focused Strategy, real NSE data)

> Tiers: **all** · Ensemble mode: **fast** · Strategy: regime-adaptive (mean-reversion / pullback / breakout) with re-focused risk caps (single-stock 15%, cash reserve 20%, risk-at-stop 1.5%, sector 30%, drawdown). Paper-only, net of costs. 5-min bars from real historical CSVs.

## Summary

| Case | Holdings | New Cap | Total Cap | Picks | Days | Rebal | Trades | Win% | PF | Net P&L | Return | MaxDD | Final |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| case1 | 0 | ₹20,000 | ₹20,000 | 20 | 90 | 1d | 2 | 0.0% | 0.00 | ₹-17 | -0.09% | ₹17 (0.1%) | ₹19,983 |
| case2 | 2 | ₹20,000 | ₹35,000 | 18 | 90 | 1d | 3 | 0.0% | 0.00 | ₹-59 | -0.17% | ₹59 (0.2%) | ₹34,941 |
| case3 | 10 | ₹30,000 | ₹90,000 | 10 | 90 | 1d | 9 | 44.4% | 1.10 | ₹127 | 0.14% | ₹953 (1.1%) | ₹90,127 |
| case4 | 0 | ₹10,000 | ₹10,000 | 10 | 90 | 1d | 0 | 0.0% | 0.00 | ₹0 | 0.00% | ₹0 (0.0%) | ₹10,000 |
| case5 | 1 | ₹10,000 | ₹40,000 | 5 | 90 | 1d | 1 | 100.0% | inf | ₹2,428 | 6.07% | ₹0 (0.0%) | ₹42,428 |
| case6 | 5 | ₹50,000 | ₹1,00,000 | 15 | 90 | 1d | 6 | 33.3% | 0.70 | ₹-412 | -0.41% | ₹1,323 (1.3%) | ₹99,588 |
| case7 | 20 | ₹1,00,000 | ₹3,00,000 | 20 | 90 | 1d | 20 | 55.0% | 1.38 | ₹1,510 | 0.50% | ₹2,668 (0.9%) | ₹3,01,510 |
| case8 | 0 | ₹50,000 | ₹50,000 | 20 | 90 | 1d | 1 | 0.0% | 0.00 | ₹-23 | -0.05% | ₹23 (0.0%) | ₹49,977 |
| case9 | 10 | ₹30,000 | ₹90,000 | 10 | 90 | 5d | 8 | 50.0% | 1.00 | ₹0 | 0.00% | ₹1,045 (1.2%) | ₹90,000 |
| case10 | 0 | ₹5,00,000 | ₹5,00,000 | 40 | 90 | 1d | 2 | 0.0% | 0.00 | ₹-453 | -0.09% | ₹453 (0.1%) | ₹4,99,547 |

## case1

- **Setup:** 0 existing holding(s) worth ₹0 + ₹20,000 new capital = **₹20,000** total. Picked 20 symbols, 90 days, rebalance every 1 day(s).
- **Symbols:** CONCOR, INDHOTEL, PFC, IOC, DELHIVERY, BANDHANBNK, TATAMOTORS, NMDC, IRB
- **Result:** 2 round trips, win rate 0.0%, profit factor 0.00, net P&L **₹-17** (-0.09%), max drawdown ₹17 (0.1%), final equity **₹19,983**.

| Symbol | P&L |
|---|---|
| TATAMOTORS | ₹-17 |

**Top trades:**
- TATAMOTORS SHORT 3 @ 395.37 → ₹-9 (Closed LONG position. rebalance TRIM)
- TATAMOTORS SHORT 3 @ 390.77 → ₹-9 (Closed LONG position. rebalance TRIM)

**Gate counters (why signals died):**
- total_evaluations: 683
- no_mode: 90
- rsi_not_oversold: 65
- bollinger_band: 4
- volume: 3
- proposed: 2
- executed: 2

**RiskEngine block reasons:**

## case2

- **Setup:** 2 existing holding(s) worth ₹15,000 + ₹20,000 new capital = **₹35,000** total. Picked 18 symbols, 90 days, rebalance every 1 day(s).
- **Symbols:** LICI, NATCOPHARM, COALINDIA, TATASTEEL, AXISBANK, ICICIBANK, INFY, HINDALCO, DRREDDY, MOTHERSON, ADANIGREEN, IDFCFIRSTB
- **Result:** 3 round trips, win rate 0.0%, profit factor 0.00, net P&L **₹-59** (-0.17%), max drawdown ₹59 (0.2%), final equity **₹34,941**.

| Symbol | P&L |
|---|---|
| LICI | ₹-22 |
| NATCOPHARM | ₹-37 |

**Top trades:**
- NATCOPHARM SHORT 4 @ 904.07 → ₹-22 (Closed LONG position. rebalance TRIM)
- LICI SHORT 8 @ 443.66 → ₹-22 (Closed LONG position. rebalance TRIM)
- NATCOPHARM SHORT 3 @ 795.24 → ₹-15 (Closed LONG position. rebalance TRIM)

**Gate counters (why signals died):**
- total_evaluations: 912
- rsi_not_oversold: 124
- no_mode: 17
- proposed: 1
- executed: 1
- volume: 1

**RiskEngine block reasons:**

## case3

- **Setup:** 10 existing holding(s) worth ₹60,000 + ₹30,000 new capital = **₹90,000** total. Picked 10 symbols, 90 days, rebalance every 1 day(s).
- **Symbols:** KEC, SBILIFE, GAIL, LICI, NAUKRI, MUTHOOTFIN, GMRINFRA, AUBANK, AUROPHARMA
- **Result:** 9 round trips, win rate 44.4%, profit factor 1.10, net P&L **₹127** (0.14%), max drawdown ₹953 (1.1%), final equity **₹90,127**.

| Symbol | P&L |
|---|---|
| KEC | ₹534 |
| MUTHOOTFIN | ₹479 |
| NAUKRI | ₹209 |
| GAIL | ₹194 |
| SBILIFE | ₹-47 |
| LICI | ₹-285 |
| AUBANK | ₹-288 |
| AUROPHARMA | ₹-331 |
| GMRINFRA | ₹-337 |

**Top trades:**
- KEC SHORT 4 @ 861.88 → ₹534 (Closed LONG position. rebalance TRIM)
- MUTHOOTFIN SHORT 1 @ 2756.85 → ₹479 (Closed LONG position. rebalance TRIM)
- GMRINFRA SHORT 73 @ 86.41 → ₹-337 (Closed LONG position. rebalance EXIT)
- AUROPHARMA SHORT 6 @ 1026.09 → ₹-331 (Closed LONG position. rebalance EXIT)
- AUBANK SHORT 9 @ 708.16 → ₹-288 (Closed LONG position. rebalance EXIT)
- LICI SHORT 15 @ 425.99 → ₹-285 (Closed LONG position. rebalance EXIT)
- NAUKRI SHORT 5 @ 1371.63 → ₹209 (Closed LONG position. Bollinger target hit (price 1371.90 >= middle band 1369.31))
- GAIL SHORT 38 @ 178.97 → ₹194 (Closed LONG position. Bollinger target hit (price 179.01 >= middle band 175.02))

**Gate counters (why signals died):**
- total_evaluations: 683
- rsi_not_oversold: 72
- no_mode: 49
- executed: 3

**RiskEngine block reasons:**

## case4

- **Setup:** 0 existing holding(s) worth ₹0 + ₹10,000 new capital = **₹10,000** total. Picked 10 symbols, 90 days, rebalance every 1 day(s).
- **Symbols:** MOTILALOFS, SYNGENE, POONAWALLA, MARICO, INDUSINDBK
- **Result:** 0 round trips, win rate 0.0%, profit factor 0.00, net P&L **₹0** (0.00%), max drawdown ₹0 (0.0%), final equity **₹10,000**.

| Symbol | P&L |
|---|---|

**Top trades:**

**Gate counters (why signals died):**
- total_evaluations: 380
- rsi_not_oversold: 22
- no_mode: 8

**RiskEngine block reasons:**

## case5

- **Setup:** 1 existing holding(s) worth ₹30,000 + ₹10,000 new capital = **₹40,000** total. Picked 5 symbols, 90 days, rebalance every 1 day(s).
- **Symbols:** TECHM, COFORGE, HAVELLS, JIOFIN
- **Result:** 1 round trips, win rate 100.0%, profit factor inf, net P&L **₹2,428** (6.07%), max drawdown ₹0 (0.0%), final equity **₹42,428**.

| Symbol | P&L |
|---|---|
| TECHM | ₹2,428 |

**Top trades:**
- TECHM SHORT 19 @ 1638.67 → ₹2,428 (Closed LONG position. Backtest end — force close)

**Gate counters (why signals died):**
- total_evaluations: 304
- risk_blocked: 44
- rsi_not_oversold: 34
- no_mode: 21
- volume: 4

**RiskEngine block reasons:**
- Ticket size 27344.799072265625 exceeds max trade allocation 8000.: 2
- Ticket size 27344.799072265625 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 28625.42 + ticket 27344.80 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 27244.100463867188 exceeds max trade allocation 8000.: 2
- Ticket size 27244.100463867188 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 28625.42 + ticket 27244.10 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 28399.299072265625 exceeds max trade allocation 8000.: 2
- Ticket size 28399.299072265625 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 28625.42 + ticket 28399.30 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 13452.299560546875 exceeds max trade allocation 8000.: 2
- Ticket size 13452.299560546875 exceeds single-stock cap 6000 (15% of capital).: 2
- Insufficient capital: used 28625.42 + ticket 13452.30 > spendable 32000.00 (after 20% cash reserve).: 2
- Ticket size 13556.700439453125 exceeds max trade allocation 8000.: 1
- Ticket size 13556.700439453125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13556.70 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13380.299560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13380.299560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13380.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13240.799560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13240.799560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13240.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13470.299560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13470.299560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13470.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13716.899780273438 exceeds max trade allocation 8000.: 1
- Ticket size 13716.899780273438 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13716.90 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13691.700439453125 exceeds max trade allocation 8000.: 1
- Ticket size 13691.700439453125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13691.70 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13545 exceeds max trade allocation 8000.: 1
- Ticket size 13545 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13545.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13743.899780273438 exceeds max trade allocation 8000.: 1
- Ticket size 13743.899780273438 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13743.90 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13519.799560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13519.799560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13519.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13460.399780273438 exceeds max trade allocation 8000.: 1
- Ticket size 13460.399780273438 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13460.40 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13332.600219726562 exceeds max trade allocation 8000.: 1
- Ticket size 13332.600219726562 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13332.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13549.5 exceeds max trade allocation 8000.: 1
- Ticket size 13549.5 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13549.50 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13615.200439453125 exceeds max trade allocation 8000.: 1
- Ticket size 13615.200439453125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13615.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13573.799560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13573.799560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13573.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13503.600219726562 exceeds max trade allocation 8000.: 1
- Ticket size 13503.600219726562 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13503.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13301.100219726562 exceeds max trade allocation 8000.: 1
- Ticket size 13301.100219726562 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13301.10 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13146.299560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13146.299560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13146.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13483.799560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13483.799560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13483.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13734 exceeds max trade allocation 8000.: 1
- Ticket size 13734 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13734.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 28902.799072265625 exceeds max trade allocation 8000.: 1
- Ticket size 28902.799072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 28902.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13690.799560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13690.799560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13690.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 28984.5 exceeds max trade allocation 8000.: 1
- Ticket size 28984.5 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 28984.50 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13729.5 exceeds max trade allocation 8000.: 1
- Ticket size 13729.5 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13729.50 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 28876.200927734375 exceeds max trade allocation 8000.: 1
- Ticket size 28876.200927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 28876.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13678.200439453125 exceeds max trade allocation 8000.: 1
- Ticket size 13678.200439453125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13678.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29098.5 exceeds max trade allocation 8000.: 1
- Ticket size 29098.5 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29098.50 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13783.5 exceeds max trade allocation 8000.: 1
- Ticket size 13783.5 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13783.50 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29396.799072265625 exceeds max trade allocation 8000.: 1
- Ticket size 29396.799072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29396.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13924.799560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13924.799560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13924.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29463.299072265625 exceeds max trade allocation 8000.: 1
- Ticket size 29463.299072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29463.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13956.299560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13956.299560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13956.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29522.200927734375 exceeds max trade allocation 8000.: 1
- Ticket size 29522.200927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29522.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13984.200439453125 exceeds max trade allocation 8000.: 1
- Ticket size 13984.200439453125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13984.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13548.600219726562 exceeds max trade allocation 8000.: 1
- Ticket size 13548.600219726562 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13548.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13247.100219726562 exceeds max trade allocation 8000.: 1
- Ticket size 13247.100219726562 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13247.10 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13071.600219726562 exceeds max trade allocation 8000.: 1
- Ticket size 13071.600219726562 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13071.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27441.700927734375 exceeds max trade allocation 8000.: 1
- Ticket size 27441.700927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27441.70 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 26746.299072265625 exceeds max trade allocation 8000.: 1
- Ticket size 26746.299072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 26746.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 26803.299072265625 exceeds max trade allocation 8000.: 1
- Ticket size 26803.299072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 26803.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 26605.700927734375 exceeds max trade allocation 8000.: 1
- Ticket size 26605.700927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 26605.70 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 26904 exceeds max trade allocation 8000.: 1
- Ticket size 26904 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 26904.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 26611.399536132812 exceeds max trade allocation 8000.: 1
- Ticket size 26611.399536132812 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 26611.40 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27346.700927734375 exceeds max trade allocation 8000.: 1
- Ticket size 27346.700927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27346.70 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27339.100463867188 exceeds max trade allocation 8000.: 1
- Ticket size 27339.100463867188 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27339.10 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13123.799560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13123.799560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13123.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13199.399780273438 exceeds max trade allocation 8000.: 1
- Ticket size 13199.399780273438 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13199.40 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13114.799560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13114.799560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13114.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13058.100219726562 exceeds max trade allocation 8000.: 1
- Ticket size 13058.100219726562 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13058.10 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27892 exceeds max trade allocation 8000.: 1
- Ticket size 27892 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27892.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13212 exceeds max trade allocation 8000.: 1
- Ticket size 13212 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13212.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13131 exceeds max trade allocation 8000.: 1
- Ticket size 13131 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13131.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27812.200927734375 exceeds max trade allocation 8000.: 1
- Ticket size 27812.200927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27812.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13174.200439453125 exceeds max trade allocation 8000.: 1
- Ticket size 13174.200439453125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13174.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13028.399780273438 exceeds max trade allocation 8000.: 1
- Ticket size 13028.399780273438 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13028.40 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27443.600463867188 exceeds max trade allocation 8000.: 1
- Ticket size 27443.600463867188 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27443.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27525.299072265625 exceeds max trade allocation 8000.: 1
- Ticket size 27525.299072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27525.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13038.299560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13038.299560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13038.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27804.600463867188 exceeds max trade allocation 8000.: 1
- Ticket size 27804.600463867188 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27804.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13170.600219726562 exceeds max trade allocation 8000.: 1
- Ticket size 13170.600219726562 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13170.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27620.299072265625 exceeds max trade allocation 8000.: 1
- Ticket size 27620.299072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27620.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13083.299560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13083.299560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13083.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27793.200927734375 exceeds max trade allocation 8000.: 1
- Ticket size 27793.200927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27793.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13165.200439453125 exceeds max trade allocation 8000.: 1
- Ticket size 13165.200439453125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13165.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27500.600463867188 exceeds max trade allocation 8000.: 1
- Ticket size 27500.600463867188 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27500.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13026.600219726562 exceeds max trade allocation 8000.: 1
- Ticket size 13026.600219726562 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13026.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27591.799072265625 exceeds max trade allocation 8000.: 1
- Ticket size 27591.799072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27591.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13069.799560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13069.799560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13069.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27242.200927734375 exceeds max trade allocation 8000.: 1
- Ticket size 27242.200927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27242.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27063.600463867188 exceeds max trade allocation 8000.: 1
- Ticket size 27063.600463867188 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27063.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 26976.200927734375 exceeds max trade allocation 8000.: 1
- Ticket size 26976.200927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 26976.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 26774.799072265625 exceeds max trade allocation 8000.: 1
- Ticket size 26774.799072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 26774.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 26858.399536132812 exceeds max trade allocation 8000.: 1
- Ticket size 26858.399536132812 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 26858.40 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 26347.299072265625 exceeds max trade allocation 8000.: 1
- Ticket size 26347.299072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 26347.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 26558.200927734375 exceeds max trade allocation 8000.: 1
- Ticket size 26558.200927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 26558.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 26752 exceeds max trade allocation 8000.: 1
- Ticket size 26752 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 26752.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27665.899536132812 exceeds max trade allocation 8000.: 1
- Ticket size 27665.899536132812 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27665.90 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13104.899780273438 exceeds max trade allocation 8000.: 1
- Ticket size 13104.899780273438 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13104.90 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27576.600463867188 exceeds max trade allocation 8000.: 1
- Ticket size 27576.600463867188 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27576.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13062.600219726562 exceeds max trade allocation 8000.: 1
- Ticket size 13062.600219726562 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13062.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27603.200927734375 exceeds max trade allocation 8000.: 1
- Ticket size 27603.200927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27603.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13075.200439453125 exceeds max trade allocation 8000.: 1
- Ticket size 13075.200439453125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13075.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27018 exceeds max trade allocation 8000.: 1
- Ticket size 27018 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27018.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27664 exceeds max trade allocation 8000.: 1
- Ticket size 27664 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27664.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13104 exceeds max trade allocation 8000.: 1
- Ticket size 13104 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13104.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 27768.5 exceeds max trade allocation 8000.: 1
- Ticket size 27768.5 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 27768.50 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13153.5 exceeds max trade allocation 8000.: 1
- Ticket size 13153.5 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13153.50 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 28887.600463867188 exceeds max trade allocation 8000.: 1
- Ticket size 28887.600463867188 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 28887.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13683.600219726562 exceeds max trade allocation 8000.: 1
- Ticket size 13683.600219726562 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13683.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 28686.200927734375 exceeds max trade allocation 8000.: 1
- Ticket size 28686.200927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 28686.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13588.200439453125 exceeds max trade allocation 8000.: 1
- Ticket size 13588.200439453125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13588.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 28828.700927734375 exceeds max trade allocation 8000.: 1
- Ticket size 28828.700927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 28828.70 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13655.700439453125 exceeds max trade allocation 8000.: 1
- Ticket size 13655.700439453125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13655.70 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29060.5 exceeds max trade allocation 8000.: 1
- Ticket size 29060.5 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29060.50 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13765.5 exceeds max trade allocation 8000.: 1
- Ticket size 13765.5 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13765.50 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29197.299072265625 exceeds max trade allocation 8000.: 1
- Ticket size 29197.299072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29197.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13830.299560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13830.299560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13830.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29292.299072265625 exceeds max trade allocation 8000.: 1
- Ticket size 29292.299072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29292.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13875.299560546875 exceeds max trade allocation 8000.: 1
- Ticket size 13875.299560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13875.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29683.700927734375 exceeds max trade allocation 8000.: 1
- Ticket size 29683.700927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29683.70 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 14060.700439453125 exceeds max trade allocation 8000.: 1
- Ticket size 14060.700439453125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 14060.70 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29845.200927734375 exceeds max trade allocation 8000.: 1
- Ticket size 29845.200927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29845.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 14137.200439453125 exceeds max trade allocation 8000.: 1
- Ticket size 14137.200439453125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 14137.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30244.200927734375 exceeds max trade allocation 8000.: 1
- Ticket size 30244.200927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 30244.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 14326.200439453125 exceeds max trade allocation 8000.: 1
- Ticket size 14326.200439453125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 14326.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29670.399536132812 exceeds max trade allocation 8000.: 1
- Ticket size 29670.399536132812 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29670.40 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 14054.399780273438 exceeds max trade allocation 8000.: 1
- Ticket size 14054.399780273438 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 14054.40 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29465.200927734375 exceeds max trade allocation 8000.: 1
- Ticket size 29465.200927734375 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29465.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 13957.200439453125 exceeds max trade allocation 8000.: 1
- Ticket size 13957.200439453125 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 13957.20 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29795.799072265625 exceeds max trade allocation 8000.: 1
- Ticket size 29795.799072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29795.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 14113.799560546875 exceeds max trade allocation 8000.: 1
- Ticket size 14113.799560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 14113.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29989.600463867188 exceeds max trade allocation 8000.: 1
- Ticket size 29989.600463867188 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29989.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 14205.600219726562 exceeds max trade allocation 8000.: 1
- Ticket size 14205.600219726562 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 14205.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29932.600463867188 exceeds max trade allocation 8000.: 1
- Ticket size 29932.600463867188 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29932.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 14178.600219726562 exceeds max trade allocation 8000.: 1
- Ticket size 14178.600219726562 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 14178.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 29985.799072265625 exceeds max trade allocation 8000.: 1
- Ticket size 29985.799072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 29985.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 14203.799560546875 exceeds max trade allocation 8000.: 1
- Ticket size 14203.799560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 14203.80 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30008.600463867188 exceeds max trade allocation 8000.: 1
- Ticket size 30008.600463867188 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 30008.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 14214.600219726562 exceeds max trade allocation 8000.: 1
- Ticket size 14214.600219726562 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 14214.60 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30506.399536132812 exceeds max trade allocation 8000.: 1
- Ticket size 30506.399536132812 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 30506.40 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 14450.399780273438 exceeds max trade allocation 8000.: 1
- Ticket size 14450.399780273438 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 14450.40 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 30637.5 exceeds max trade allocation 8000.: 1
- Ticket size 30637.5 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 30637.50 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 14512.5 exceeds max trade allocation 8000.: 1
- Ticket size 14512.5 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 14512.50 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31287.299072265625 exceeds max trade allocation 8000.: 1
- Ticket size 31287.299072265625 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 31287.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 14820.299560546875 exceeds max trade allocation 8000.: 1
- Ticket size 14820.299560546875 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 14820.30 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 31027 exceeds max trade allocation 8000.: 1
- Ticket size 31027 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 31027.00 > spendable 32000.00 (after 20% cash reserve).: 1
- Ticket size 14697 exceeds max trade allocation 8000.: 1
- Ticket size 14697 exceeds single-stock cap 6000 (15% of capital).: 1
- Insufficient capital: used 28625.42 + ticket 14697.00 > spendable 32000.00 (after 20% cash reserve).: 1

## case6

- **Setup:** 5 existing holding(s) worth ₹50,000 + ₹50,000 new capital = **₹1,00,000** total. Picked 15 symbols, 90 days, rebalance every 1 day(s).
- **Symbols:** AUBANK, OIL, HINDCOPPER, DMART, FORTIS, ASTRAL, BLUESTARCO, DELHIVERY, GODREJCP, FEDERALBNK, J&KBANK, HCLTECH, BIOCON, ACC
- **Result:** 6 round trips, win rate 33.3%, profit factor 0.70, net P&L **₹-412** (-0.41%), max drawdown ₹1,323 (1.3%), final equity **₹99,588**.

| Symbol | P&L |
|---|---|
| DMART | ₹739 |
| FORTIS | ₹172 |
| AUBANK | ₹-415 |
| OIL | ₹-426 |
| HINDCOPPER | ₹-482 |

**Top trades:**
- DMART SHORT 1 @ 4736.95 → ₹778 (Closed LONG position. rebalance TRIM)
- HINDCOPPER SHORT 41 @ 231.14 → ₹-482 (Closed LONG position. rebalance EXIT)
- OIL SHORT 24 @ 390.42 → ₹-426 (Closed LONG position. rebalance EXIT)
- AUBANK SHORT 13 @ 708.16 → ₹-415 (Closed LONG position. rebalance EXIT)
- FORTIS SHORT 10 @ 965.76 → ₹172 (Closed LONG position. Bollinger target hit (price 965.95 >= middle band 939.96))
- DMART SHORT 1 @ 4201.76 → ₹-39 (Closed LONG position. rebalance TRIM)

**Gate counters (why signals died):**
- total_evaluations: 1064
- rsi_not_oversold: 130
- no_mode: 113
- executed: 2
- volume: 2
- proposed: 1
- cooldown: 1

**RiskEngine block reasons:**

## case7

- **Setup:** 20 existing holding(s) worth ₹2,00,000 + ₹1,00,000 new capital = **₹3,00,000** total. Picked 20 symbols, 90 days, rebalance every 1 day(s).
- **Symbols:** CIPLA, ZYDUSLIFE, ICICIPRULI, HINDALCO, MAXHEALTH, TATACONSUM, ADANIPORTS, HINDPETRO, ADANIENSOL, TATATECH, TATAMOTORS, BSE, HCLTECH, M&M, IOC, GICRE, JKCEMENT, CUMMINSIND, ASTRAL
- **Result:** 20 round trips, win rate 55.0%, profit factor 1.38, net P&L **₹1,510** (0.50%), max drawdown ₹2,668 (0.9%), final equity **₹3,01,510**.

| Symbol | P&L |
|---|---|
| M&M | ₹805 |
| HINDALCO | ₹616 |
| JKCEMENT | ₹576 |
| ZYDUSLIFE | ₹518 |
| TATAMOTORS | ₹513 |
| TATATECH | ₹498 |
| ADANIPORTS | ₹485 |
| CUMMINSIND | ₹434 |
| TATACONSUM | ₹413 |
| ADANIENSOL | ₹324 |
| CIPLA | ₹52 |
| HINDPETRO | ₹-450 |
| IOC | ₹-456 |
| MAXHEALTH | ₹-475 |
| ICICIPRULI | ₹-481 |
| GICRE | ₹-570 |
| HCLTECH | ₹-606 |
| BSE | ₹-687 |

**Top trades:**
- M&M SHORT 1 @ 3560.59 → ₹805 (Closed LONG position. rebalance TRIM)
- TATAMOTORS SHORT 15 @ 719.36 → ₹791 (Closed LONG position. Target hit (price 719.50 >= 712.81))
- BSE SHORT 4 @ 2331.73 → ₹-687 (Closed LONG position. rebalance EXIT)
- HINDALCO SHORT 15 @ 743.65 → ₹616 (Closed LONG position. Target hit (price 743.80 >= 739.54))
- HCLTECH SHORT 7 @ 1418.72 → ₹-606 (Closed LONG position. rebalance EXIT)
- JKCEMENT SHORT 1 @ 7537.49 → ₹576 (Closed LONG position. rebalance TRIM)
- GICRE SHORT 26 @ 373.03 → ₹-570 (Closed LONG position. rebalance EXIT)
- ZYDUSLIFE SHORT 10 @ 1043.39 → ₹518 (Closed LONG position. Bollinger target hit (price 1043.60 >= middle band 1001.57))

**Gate counters (why signals died):**
- total_evaluations: 1443
- rsi_not_oversold: 250
- no_mode: 78
- executed: 11
- volume: 7
- bollinger_band: 4
- proposed: 2

**RiskEngine block reasons:**

## case8

- **Setup:** 0 existing holding(s) worth ₹0 + ₹50,000 new capital = **₹50,000** total. Picked 20 symbols, 90 days, rebalance every 1 day(s).
- **Symbols:** KEC, HAVELLS, INDUSINDBK, COLPAL, ICICIPRULI, PIDILITIND, HINDALCO, JINDALSAW, INFOSYS, UNITDSPR, FORTIS, RBLBANK, COALINDIA, CONCOR, NESTLEIND, AUROPHARMA, BERGERPAINT, BANDHANBNK
- **Result:** 1 round trips, win rate 0.0%, profit factor 0.00, net P&L **₹-23** (-0.05%), max drawdown ₹23 (0.0%), final equity **₹49,977**.

| Symbol | P&L |
|---|---|
| JINDALSAW | ₹-23 |

**Top trades:**
- JINDALSAW SHORT 20 @ 180.18 → ₹-23 (Closed LONG position. rebalance TRIM)

**Gate counters (why signals died):**
- total_evaluations: 1366
- no_mode: 148
- rsi_not_oversold: 141
- proposed: 1
- executed: 1

**RiskEngine block reasons:**

## case9

- **Setup:** 10 existing holding(s) worth ₹60,000 + ₹30,000 new capital = **₹90,000** total. Picked 10 symbols, 90 days, rebalance every 5 day(s).
- **Symbols:** IRCTC, IRFC, SBILIFE, CHAMBLFERT, CUMMINSIND, INFOSYS, BSE, HINDALCO, ZYDUSLIFE
- **Result:** 8 round trips, win rate 50.0%, profit factor 1.00, net P&L **₹0** (0.00%), max drawdown ₹1,045 (1.2%), final equity **₹90,000**.

| Symbol | P&L |
|---|---|
| HINDALCO | ₹370 |
| CHAMBLFERT | ₹303 |
| INFOSYS | ₹293 |
| CUMMINSIND | ₹217 |
| SBILIFE | ₹-47 |
| IRCTC | ₹-89 |
| IRFC | ₹-395 |
| BSE | ₹-651 |

**Top trades:**
- BSE SHORT 2 @ 2177.96 → ₹-651 (Closed LONG position. rebalance EXIT)
- IRFC SHORT 53 @ 118.56 → ₹-395 (Closed LONG position. rebalance EXIT)
- HINDALCO SHORT 9 @ 743.65 → ₹370 (Closed LONG position. Target hit (price 743.80 >= 739.54))
- CHAMBLFERT SHORT 12 @ 554.09 → ₹303 (Closed LONG position. Bollinger target hit (price 554.20 >= middle band 550.79))
- INFOSYS SHORT 4 @ 1525.29 → ₹293 (Closed LONG position. Bollinger target hit (price 1525.60 >= middle band 1486.24))
- CUMMINSIND SHORT 1 @ 4020.50 → ₹217 (Closed LONG position. RSI 70.2 overbought (>70))
- IRCTC SHORT 9 @ 719.56 → ₹-89 (Closed LONG position. Bollinger target hit (price 719.70 >= middle band 716.58))
- SBILIFE SHORT 3 @ 1829.83 → ₹-47 (Closed LONG position. Bollinger target hit (price 1830.20 >= middle band 1826.71))

**Gate counters (why signals died):**
- total_evaluations: 683
- rsi_not_oversold: 69
- no_mode: 53
- executed: 6
- volume: 5
- bollinger_band: 1

**RiskEngine block reasons:**

## case10

- **Setup:** 0 existing holding(s) worth ₹0 + ₹5,00,000 new capital = **₹5,00,000** total. Picked 40 symbols, 90 days, rebalance every 1 day(s).
- **Symbols:** TATAELXSI, CUMMINSIND, IDFCFIRSTB, ITC, HDFCBANK, COALINDIA, SHRIRAMFIN, SBICARD, INFOSYS, ATGL, CONCOR, AMBUJACEM, SBILIFE, IRFC, SIEMENS, BHARTIARTL, WIPRO, ABB, TRENT, HAVELLS, HINDPETRO, INDHOTEL, MARICO, ICICIBANK, KOTAKBANK, HINDALCO, HEROMOTOCO, CGPOWER, RELIANCE, HINDUNILVR, HAL, TATAMOTORS, PFC, DRREDDY, BHARATFORG, BAJFINANCE
- **Result:** 2 round trips, win rate 0.0%, profit factor 0.00, net P&L **₹-453** (-0.09%), max drawdown ₹453 (0.1%), final equity **₹4,99,547**.

| Symbol | P&L |
|---|---|
| TATAMOTORS | ₹-453 |

**Top trades:**
- TATAMOTORS SHORT 94 @ 395.37 → ₹-227 (Closed LONG position. rebalance TRIM)
- TATAMOTORS SHORT 95 @ 390.77 → ₹-226 (Closed LONG position. rebalance TRIM)

**Gate counters (why signals died):**
- total_evaluations: 2734
- rsi_not_oversold: 296
- no_mode: 187
- volume: 6
- bollinger_band: 4
- proposed: 2
- executed: 2

**RiskEngine block reasons:**
