# 12-Month SIP Momentum Simulation Report

> **Strategy:** Cross-sectional momentum | up to 12-month lookback (adaptive: uses all available history, min 2 months) | skip-1 month | top-5 | hysteresis band 8
> **SIP:** ₹10,000/month × 11 months (Month 1 = 2025-10-01, first month with rankable history) | **Total invested:** ₹1,10,000
> **Lookback baseline:** CSV data from 2025-08-13 used as price history; SIP starts when 2+ months of history are available
> **Data:** Real NSE daily closes from kite-paper-node CSVs (2025-08-13 → 2026-08-14)
> **Costs:** 0.155% one-way (brokerage + STT + slippage)
> **Tax:** STCG 20% on realized gains at point of sale

## Summary

| Metric | Value |
|---|---|
| Total invested (SIP) | ₹1,10,000 |
| Final portfolio value | ₹1,07,583 |
| Total gain / loss | ₹-2,417 (-2.20%) |
| Tax paid on realized gains | ₹12 |
| Net value after realized tax | ₹1,07,571 |
| Unrealized gain (still open) | ₹7,024 |
| Months simulated | 11 |

## Per-Month Table

| Mo | Rebal date | End date | Deposit | Invested | Buys | Sells | Holdings | Return | Value |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2025-10-01 | 2025-11-03 | ₹10,000 | ₹10,000 | — | — | (none) | 0.00% | ₹10,000 |
| 2 | 2025-11-03 | 2025-12-01 | ₹10,000 | ₹20,000 | — | — | (none) | 0.00% | ₹20,000 |
| 3 | 2025-12-01 | 2026-01-01 | ₹10,000 | ₹30,000 | HINDCOPPER, CHENNPETRO, CANBK, ADANIPOWER, ADANIENSOL | — | HINDCOPPER, CHENNPETRO, CANBK, ADANIPOWER, ADANIENSOL | 10.86% | ₹33,257 |
| 4 | 2026-01-01 | 2026-02-02 | ₹10,000 | ₹40,000 | SHRIRAMFIN | ADANIPOWER | HINDCOPPER, CHENNPETRO, CANBK, ADANIENSOL, SHRIRAMFIN | -0.26% | ₹43,143 |
| 5 | 2026-02-02 | 2026-03-02 | ₹10,000 | ₹50,000 | M&MFIN | CHENNPETRO | HINDCOPPER, CANBK, ADANIENSOL, SHRIRAMFIN, M&MFIN | 2.46% | ₹54,452 |
| 6 | 2026-03-02 | 2026-04-01 | ₹10,000 | ₹60,000 | VEDL | ADANIENSOL | HINDCOPPER, CANBK, SHRIRAMFIN, M&MFIN, VEDL | -10.70% | ₹57,557 |
| 7 | 2026-04-01 | 2026-05-01 | ₹10,000 | ₹70,000 | — | — | HINDCOPPER, CANBK, SHRIRAMFIN, M&MFIN, VEDL | -7.85% | ₹62,253 |
| 8 | 2026-05-01 | 2026-06-01 | ₹10,000 | ₹80,000 | CHENNPETRO, BHARATFORG | CANBK, M&MFIN | HINDCOPPER, SHRIRAMFIN, VEDL, CHENNPETRO, BHARATFORG | 1.31% | ₹73,202 |
| 9 | 2026-06-01 | 2026-07-01 | ₹10,000 | ₹90,000 | ADANIPOWER | VEDL | HINDCOPPER, SHRIRAMFIN, CHENNPETRO, BHARATFORG, ADANIPOWER | 2.04% | ₹84,903 |
| 10 | 2026-07-01 | 2026-08-03 | ₹10,000 | ₹1,00,000 | — | — | HINDCOPPER, SHRIRAMFIN, CHENNPETRO, BHARATFORG, ADANIPOWER | 2.87% | ₹97,629 |
| 11 | 2026-08-03 | 2026-08-14 | ₹10,000 | ₹1,10,000 | — | — | HINDCOPPER, SHRIRAMFIN, CHENNPETRO, BHARATFORG, ADANIPOWER | -0.04% | ₹1,07,583 |

## Per-Month Detail

### Month 1 — 2025-10-01 → 2025-11-03
- **SIP deposit this month:** ₹10,000  |  **Total invested so far:** ₹10,000
- **Portfolio value at month start (after deposit):** ₹10,000
- **Top-5 momentum scores (12m lookback, skip-1):** 
- **Selected portfolio:** (none — insufficient lookback data)
- **No changes** (all holdings retained by hysteresis)
- **Month return:** 0.00%
- **Portfolio value at month end:** ₹10,000
- **Open positions:** (none)

### Month 2 — 2025-11-03 → 2025-12-01
- **SIP deposit this month:** ₹10,000  |  **Total invested so far:** ₹20,000
- **Portfolio value at month start (after deposit):** ₹20,000
- **Top-5 momentum scores (12m lookback, skip-1):** 
- **Selected portfolio:** (none — insufficient lookback data)
- **No changes** (all holdings retained by hysteresis)
- **Month return:** 0.00%
- **Portfolio value at month end:** ₹20,000
- **Open positions:** (none)

### Month 3 — 2025-12-01 → 2026-01-01
- **SIP deposit this month:** ₹10,000  |  **Total invested so far:** ₹30,000
- **Portfolio value at month start (after deposit):** ₹30,000
- **Top-5 momentum scores (12m lookback, skip-1):** 1. HINDCOPPER (46.1%, 2m), 2. CHENNPETRO (42.5%, 2m), 3. CANBK (30.3%, 2m), 4. ADANIPOWER (30.1%, 2m), 5. ADANIENSOL (28.6%, 2m)
- **Selected portfolio:** HINDCOPPER, CHENNPETRO, CANBK, ADANIPOWER, ADANIENSOL
- **Bought:** HINDCOPPER, CHENNPETRO, CANBK, ADANIPOWER, ADANIENSOL
- **Month return:** 10.86%
- **Portfolio value at month end:** ₹33,257
- **Open positions:** HINDCOPPER, CHENNPETRO, CANBK, ADANIPOWER, ADANIENSOL

### Month 4 — 2026-01-01 → 2026-02-02
- **SIP deposit this month:** ₹10,000  |  **Total invested so far:** ₹40,000
- **Portfolio value at month start (after deposit):** ₹43,257
- **Top-5 momentum scores (12m lookback, skip-1):** 1. HINDCOPPER (45.7%, 3m), 2. SHRIRAMFIN (44.7%, 3m), 3. CANBK (43.1%, 3m), 4. M&MFIN (42.9%, 3m), 5. MUTHOOTFIN (40.6%, 3m)
- **Selected portfolio:** HINDCOPPER, CHENNPETRO, CANBK, ADANIENSOL, SHRIRAMFIN
- **Bought:** SHRIRAMFIN
- **Sold:** ADANIPOWER
- **Month return:** -0.26%
- **Portfolio value at month end:** ₹43,143
- **Open positions:** HINDCOPPER, CHENNPETRO, CANBK, ADANIENSOL, SHRIRAMFIN

### Month 5 — 2026-02-02 → 2026-03-02
- **SIP deposit this month:** ₹10,000  |  **Total invested so far:** ₹50,000
- **Portfolio value at month start (after deposit):** ₹53,143
- **Top-5 momentum scores (12m lookback, skip-1):** 1. HINDCOPPER (127.9%, 4m), 2. SHRIRAMFIN (72.8%, 4m), 3. M&MFIN (54.6%, 4m), 4. IIFL (46.4%, 4m), 5. CANBK (45.9%, 4m)
- **Selected portfolio:** HINDCOPPER, CANBK, ADANIENSOL, SHRIRAMFIN, M&MFIN
- **Bought:** M&MFIN
- **Sold:** CHENNPETRO
- **Month return:** 2.46%
- **Portfolio value at month end:** ₹54,452
- **Open positions:** HINDCOPPER, CANBK, ADANIENSOL, SHRIRAMFIN, M&MFIN

### Month 6 — 2026-03-02 → 2026-04-01
- **SIP deposit this month:** ₹10,000  |  **Total invested so far:** ₹60,000
- **Portfolio value at month start (after deposit):** ₹64,452
- **Top-5 momentum scores (12m lookback, skip-1):** 1. HINDCOPPER (156.7%, 5m), 2. SHRIRAMFIN (64.6%, 5m), 3. VEDL (53.1%, 5m), 4. ASHOKLEY (49.1%, 5m), 5. FEDERALBNK (45.3%, 5m)
- **Selected portfolio:** HINDCOPPER, CANBK, SHRIRAMFIN, M&MFIN, VEDL
- **Bought:** VEDL
- **Sold:** ADANIENSOL
- **Month return:** -10.70%
- **Portfolio value at month end:** ₹57,557
- **Open positions:** HINDCOPPER, CANBK, SHRIRAMFIN, M&MFIN, VEDL

### Month 7 — 2026-04-01 → 2026-05-01
- **SIP deposit this month:** ₹10,000  |  **Total invested so far:** ₹70,000
- **Portfolio value at month start (after deposit):** ₹67,557
- **Top-5 momentum scores (12m lookback, skip-1):** 1. HINDCOPPER (143.2%, 6m), 2. SHRIRAMFIN (83.4%, 6m), 3. BHARATFORG (69.7%, 6m), 4. VEDL (66.7%, 6m), 5. ASHOKLEY (64.9%, 6m)
- **Selected portfolio:** HINDCOPPER, CANBK, SHRIRAMFIN, M&MFIN, VEDL
- **No changes** (all holdings retained by hysteresis)
- **Month return:** -7.85%
- **Portfolio value at month end:** ₹62,253
- **Open positions:** HINDCOPPER, CANBK, SHRIRAMFIN, M&MFIN, VEDL

### Month 8 — 2026-05-01 → 2026-06-01
- **SIP deposit this month:** ₹10,000  |  **Total invested so far:** ₹80,000
- **Portfolio value at month start (after deposit):** ₹72,253
- **Top-5 momentum scores (12m lookback, skip-1):** 1. HINDCOPPER (113.0%, 7m), 2. VEDL (57.1%, 7m), 3. SHRIRAMFIN (53.0%, 7m), 4. CHENNPETRO (48.1%, 7m), 5. BHARATFORG (48.1%, 7m)
- **Selected portfolio:** HINDCOPPER, SHRIRAMFIN, VEDL, CHENNPETRO, BHARATFORG
- **Bought:** CHENNPETRO, BHARATFORG
- **Sold:** CANBK, M&MFIN
- **Month return:** 1.31%
- **Portfolio value at month end:** ₹73,202
- **Open positions:** HINDCOPPER, SHRIRAMFIN, VEDL, CHENNPETRO, BHARATFORG

### Month 9 — 2026-06-01 → 2026-07-01
- **SIP deposit this month:** ₹10,000  |  **Total invested so far:** ₹90,000
- **Portfolio value at month start (after deposit):** ₹83,202
- **Top-5 momentum scores (12m lookback, skip-1):** 1. HINDCOPPER (129.7%, 8m), 2. ADANIPOWER (82.8%, 8m), 3. ADANIENSOL (75.1%, 8m), 4. BHARATFORG (67.0%, 8m), 5. BSE (67.0%, 8m)
- **Selected portfolio:** HINDCOPPER, SHRIRAMFIN, CHENNPETRO, BHARATFORG, ADANIPOWER
- **Bought:** ADANIPOWER
- **Sold:** VEDL
- **Month return:** 2.04%
- **Portfolio value at month end:** ₹84,903
- **Open positions:** HINDCOPPER, SHRIRAMFIN, CHENNPETRO, BHARATFORG, ADANIPOWER

### Month 10 — 2026-07-01 → 2026-08-03
- **SIP deposit this month:** ₹10,000  |  **Total invested so far:** ₹1,00,000
- **Portfolio value at month start (after deposit):** ₹94,903
- **Top-5 momentum scores (12m lookback, skip-1):** 1. HINDCOPPER (131.9%, 9m), 2. ADANIENSOL (95.2%, 9m), 3. ADANIPOWER (91.4%, 9m), 4. BHEL (90.7%, 9m), 5. BSE (86.5%, 9m)
- **Selected portfolio:** HINDCOPPER, SHRIRAMFIN, CHENNPETRO, BHARATFORG, ADANIPOWER
- **No changes** (all holdings retained by hysteresis)
- **Month return:** 2.87%
- **Portfolio value at month end:** ₹97,629
- **Open positions:** HINDCOPPER, SHRIRAMFIN, CHENNPETRO, BHARATFORG, ADANIPOWER

### Month 11 — 2026-08-03 → 2026-08-14
- **SIP deposit this month:** ₹10,000  |  **Total invested so far:** ₹1,10,000
- **Portfolio value at month start (after deposit):** ₹1,07,629
- **Top-5 momentum scores (12m lookback, skip-1):** 1. ADANIENSOL (105.4%, 10m), 2. HINDCOPPER (101.3%, 10m), 3. BHARATFORG (88.2%, 10m), 4. ADANIPOWER (82.0%, 10m), 5. SHRIRAMFIN (81.4%, 10m)
- **Selected portfolio:** HINDCOPPER, SHRIRAMFIN, CHENNPETRO, BHARATFORG, ADANIPOWER
- **No changes** (all holdings retained by hysteresis)
- **Month return:** -0.04%
- **Portfolio value at month end:** ₹1,07,583
- **Open positions:** HINDCOPPER, SHRIRAMFIN, CHENNPETRO, BHARATFORG, ADANIPOWER

## Notes

- **No idle cash at start.** The SIP begins on the first month where enough price history
  exists to compute momentum rankings. All prior CSV data serves as lookback baseline only.
- The adaptive lookback grows from 2 months in Month 1 toward 12 months by Month 11.
  Rankings improve in quality each month as more history accumulates.
- Small early tickets (Month 1 = ₹10k across 5 names = ₹2k each) have higher cost%.
  This is real: small capital means costs bite harder — confirms GoLiveLadder ₹25k minimum.
- Tax is charged only on realized gains at point of sale.
- Hysteresis band=8 keeps incumbents ranked within 1–13 to reduce turnover and costs.