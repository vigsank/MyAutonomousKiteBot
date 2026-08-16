# Daily Cycle Simulation — Full Bot Loop

**Window:** 2026-07-27 → 2026-08-14 (15 trading days)  
**Capital:** ₹5,00,000 · **Universe:** 59 NSE symbols · **Strategy:** top 6 momentum, 12-month lookback  
**Caps:** single-stock 15%, per-trade ₹20,00,000, cash reserve 20%

## Result

| Metric | Value |
| --- | --- |
| Starting capital | ₹5,00,000 |
| Final equity | ₹4,90,289 |
| **Net P&L** | **₹-9,711 (-1.94%)** |
| Realized | ₹0 |
| Unrealized | ₹-9,711 |
| Positive days | 6/15 |
| Open positions at end | 6 (₹3,29,730 deployed) |
| Benchmark (equal-weight buy & hold) | ₹5,09,267 (+1.85%) |
| **vs benchmark** | **-3.80%** |
| Avg deployment | 57% of capital |

## Weekly

| Week | Dates | Days | Open | Close | Return | Orders |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-07-27 → 2026-07-31 | 5 | ₹5,00,000 | ₹4,95,589 | -0.88% | 5 |
| 2 | 2026-08-03 → 2026-08-07 | 5 | ₹4,95,589 | ₹4,95,207 | -0.08% | 0 |
| 3 | 2026-08-10 → 2026-08-14 | 5 | ₹4,95,207 | ₹4,90,289 | -0.99% | 1 |

## Per day

| Day | Date | Regime | Breadth | Positions | Deployed | Equity | Benchmark | Realized (day) | Day P&L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-07-27 Mon | 0.20 (NEUTRAL_MIXED) | 8% | 4 | ₹2,60,344 | ₹4,99,948 | ₹5,00,000 | — | -0.01% |
| 2 | 2026-07-28 Tue | -0.02 (NEUTRAL_MIXED) | 2% | 4 | ₹2,54,142 | ₹4,93,746 | ₹4,99,103 | — | -1.24% |
| 3 | 2026-07-29 Wed | 0.32 (BULLISH_CONSTRUCTIVE) | 25% | 4 | ₹2,54,226 | ₹4,93,830 | ₹5,03,881 | — | +0.02% |
| 4 | 2026-07-30 Thu | 0.15 (NEUTRAL_MIXED) | 19% | 4 | ₹2,53,478 | ₹4,93,082 | ₹5,04,538 | — | -0.15% |
| 5 | 2026-07-31 Fri | 0.23 (NEUTRAL_MIXED) | 19% | 5 | ₹2,95,931 | ₹4,95,589 | ₹5,08,005 | — | +0.51% |
| 6 | 2026-08-03 Mon | 0.54 (BULLISH_CONSTRUCTIVE) | 46% | 5 | ₹2,97,777 | ₹4,97,435 | ₹5,15,637 | — | +0.37% |
| 7 | 2026-08-04 Tue | 0.11 (NEUTRAL_MIXED) | 29% | 5 | ₹2,96,687 | ₹4,96,345 | ₹5,12,574 | — | -0.22% |
| 8 | 2026-08-05 Wed | 0.25 (BULLISH_CONSTRUCTIVE) | 32% | 5 | ₹2,95,274 | ₹4,94,932 | ₹5,13,560 | — | -0.28% |
| 9 | 2026-08-06 Thu | 0.14 (NEUTRAL_MIXED) | 25% | 5 | ₹2,93,541 | ₹4,93,199 | ₹5,12,187 | — | -0.35% |
| 10 | 2026-08-07 Fri | 0.15 (NEUTRAL_MIXED) | 25% | 5 | ₹2,95,549 | ₹4,95,207 | ₹5,11,300 | — | +0.41% |
| 11 | 2026-08-10 Mon | 0.15 (NEUTRAL_MIXED) | 19% | 5 | ₹2,91,622 | ₹4,91,280 | ₹5,11,940 | — | -0.79% |
| 12 | 2026-08-11 Tue | 0.02 (NEUTRAL_MIXED) | 8% | 5 | ₹2,87,933 | ₹4,87,591 | ₹5,10,657 | — | -0.75% |
| 13 | 2026-08-12 Wed | 0.08 (NEUTRAL_MIXED) | 12% | 5 | ₹2,90,142 | ₹4,89,800 | ₹5,10,429 | — | +0.45% |
| 14 | 2026-08-13 Thu | 0.09 (NEUTRAL_MIXED) | 15% | 5 | ₹2,88,995 | ₹4,88,653 | ₹5,09,985 | — | -0.23% |
| 15 | 2026-08-14 Fri | 0.04 (NEUTRAL_MIXED) | 8% | 6 | ₹3,29,730 | ₹4,90,289 | ₹5,09,267 | — | +0.33% |

## Step-by-step audit trail

Every action the bot took, in order, on every simulated day.

### Day 1 — 2026-07-27 (Mon)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime 0.20 (NEUTRAL_MIXED), breadth 8%, cash reserve 20% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | ADANIENSOL(CONSIDER_LONG), BHARATFORG(CONSIDER_LONG), BHEL(CONSIDER_LONG), CUMMINSIND(CONSIDER_LONG) |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | REBALANCE | monthly rebalance due — target [ADANIPOWER, ADANIENSOL, CUMMINSIND, BHARATFORG, BHEL, ADANIGREEN] |
| 10:00 | ORDER BUY | ADANIENSOL 39 @ 1703.30 = ₹66,429 |
| 10:00 | ORDER BUY | CUMMINSIND 11 @ 5629.50 = ₹61,925 |
| 10:00 | ORDER BUY | BHARATFORG 30 @ 2181.30 = ₹65,439 |
| 10:00 | ORDER BUY | BHEL 160 @ 415.95 = ₹66,552 |
| 10:00 | SKIPPED | ADANIPOWER: report veto (AVOID) \| ADANIGREEN: report veto (AVOID) |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIPOWER, ADANIENSOL, CUMMINSIND, BHARATFORG, BHEL, ADANIGREEN] (topN 6) |
| 10:10 | AGENT regime | [done] risk-on (blended 0.157) — breadth 0.08 (neutral); report regime 0.20 (NEUTRAL_MIXED); avg sentiment 0.15 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture risk-on) |
| 10:10 | AGENT strategist | [done] all 2 candidate(s) vetoed by AI — ADANIPOWER: report AVOID, ADANIGREEN: report AVOID |
| 10:10 | AGENT execute | [done] nothing to execute |
| 11:00 | MID-SESSION | report#2 regime 0.20; reviewing 4 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime 0.20; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 4 position(s), deployed ₹2,60,344, equity ₹4,99,948 (day -0.01%) |

**Orders:** BUY ADANIENSOL, CUMMINSIND, BHARATFORG, BHEL

### Day 2 — 2026-07-28 (Tue)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime -0.02 (NEUTRAL_MIXED), breadth 2%, cash reserve 27.5% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | no long candidates today |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | HOLD | no rebalance due (monthly cadence); 4 position(s) held |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIPOWER, ADANIENSOL, CUMMINSIND, BHARATFORG, BHEL, ADANIGREEN] (topN 6) |
| 10:10 | AGENT regime | [done] neutral (blended -0.016) — breadth 0.02 (neutral); report regime -0.02 (NEUTRAL_MIXED); avg sentiment -0.07 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture neutral) |
| 10:10 | AGENT strategist | [done] all 2 candidate(s) vetoed by AI — ADANIPOWER: report AVOID, ADANIGREEN: report AVOID |
| 10:10 | AGENT execute | [done] nothing to execute |
| 11:00 | MID-SESSION | report#2 regime -0.02; reviewing 4 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime -0.02; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 4 position(s), deployed ₹2,54,142, equity ₹4,93,746 (day -1.24%) |

### Day 3 — 2026-07-29 (Wed)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime 0.32 (BULLISH_CONSTRUCTIVE), breadth 25%, cash reserve 20% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | no long candidates today |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | HOLD | no rebalance due (monthly cadence); 4 position(s) held |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIPOWER, ADANIENSOL, CUMMINSIND, BHARATFORG, BHEL, ADANIGREEN] (topN 6) |
| 10:10 | AGENT regime | [done] risk-on (blended 0.276) — breadth 0.25 (risk-on); report regime 0.32 (BULLISH_CONSTRUCTIVE); avg sentiment 0.20 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture risk-on) |
| 10:10 | AGENT strategist | [done] all 2 candidate(s) vetoed by AI — ADANIPOWER: report AVOID, ADANIGREEN: report AVOID |
| 10:10 | AGENT execute | [done] nothing to execute |
| 11:00 | MID-SESSION | report#2 regime 0.32; reviewing 4 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime 0.32; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 4 position(s), deployed ₹2,54,226, equity ₹4,93,830 (day +0.02%) |

### Day 4 — 2026-07-30 (Thu)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime 0.15 (NEUTRAL_MIXED), breadth 19%, cash reserve 27.5% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | no long candidates today |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | HOLD | no rebalance due (monthly cadence); 4 position(s) held |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIPOWER, ADANIENSOL, CUMMINSIND, BHARATFORG, BHEL, ADANIGREEN] (topN 6) |
| 10:10 | AGENT regime | [done] neutral (blended 0.146) — breadth 0.19 (neutral); report regime 0.15 (NEUTRAL_MIXED); avg sentiment 0.08 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture neutral) |
| 10:10 | AGENT strategist | [done] all 2 candidate(s) vetoed by AI — ADANIPOWER: report AVOID, ADANIGREEN: report AVOID |
| 10:10 | AGENT execute | [done] nothing to execute |
| 11:00 | MID-SESSION | report#2 regime 0.15; reviewing 4 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime 0.15; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 4 position(s), deployed ₹2,53,478, equity ₹4,93,082 (day -0.15%) |

### Day 5 — 2026-07-31 (Fri)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime 0.23 (NEUTRAL_MIXED), breadth 19%, cash reserve 20% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | ADANIPOWER(CONSIDER_LONG), BHARATFORG(BUY_ACCUMULATE), CUMMINSIND(BUY_ACCUMULATE) |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | HOLD | no rebalance due (monthly cadence); 4 position(s) held |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIPOWER, ADANIENSOL, CUMMINSIND, BHARATFORG, BHEL, ADANIGREEN] (topN 6) |
| 10:10 | AGENT regime | [done] risk-on (blended 0.210) — breadth 0.19 (neutral); report regime 0.23 (NEUTRAL_MIXED); avg sentiment 0.18 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture risk-on) |
| 10:10 | AGENT strategist | [done] BUY 189 ADANIPOWER @ 211.31 (tilt 0.60, 1 vetoed) |
| 10:10 | AGENT execute | [done] executed ADANIPOWER 189@211.35 |
| 11:00 | MID-SESSION | report#2 regime 0.23; reviewing 5 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime 0.23; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 5 position(s), deployed ₹2,95,931, equity ₹4,95,589 (day +0.51%) |

**Orders:** BUY ADANIPOWER

### Day 6 — 2026-08-03 (Mon)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime 0.54 (BULLISH_CONSTRUCTIVE), breadth 46%, cash reserve 20% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | BHARATFORG(BUY_ACCUMULATE) |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | REBALANCE | monthly rebalance due — target [ADANIPOWER, ADANIENSOL, BHARATFORG, CUMMINSIND, ADANIGREEN, BHEL] |
| 10:00 | SKIPPED | ADANIGREEN: report veto (AVOID) |
| 10:00 | NO ACTION | target already held / all candidates blocked |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIPOWER, ADANIENSOL, BHARATFORG, CUMMINSIND, ADANIGREEN, BHEL] (topN 6) |
| 10:10 | AGENT regime | [done] risk-on (blended 0.497) — breadth 0.46 (risk-on); report regime 0.54 (BULLISH_CONSTRUCTIVE); avg sentiment 0.44 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture risk-on) |
| 10:10 | AGENT strategist | [done] all 1 candidate(s) vetoed by AI — ADANIGREEN: report AVOID |
| 10:10 | AGENT execute | [done] nothing to execute |
| 11:00 | MID-SESSION | report#2 regime 0.54; reviewing 5 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime 0.54; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 5 position(s), deployed ₹2,97,777, equity ₹4,97,435 (day +0.37%) |

### Day 7 — 2026-08-04 (Tue)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime 0.11 (NEUTRAL_MIXED), breadth 29%, cash reserve 27.5% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | no long candidates today |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | HOLD | no rebalance due (monthly cadence); 5 position(s) held |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIPOWER, ADANIENSOL, CUMMINSIND, BHARATFORG, ADANIGREEN, BHEL] (topN 6) |
| 10:10 | AGENT regime | [done] risk-on (blended 0.173) — breadth 0.29 (risk-on); report regime 0.11 (NEUTRAL_MIXED); avg sentiment 0.14 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture risk-on) |
| 10:10 | AGENT strategist | [done] all 1 candidate(s) vetoed by AI — ADANIGREEN: report AVOID |
| 10:10 | AGENT execute | [done] nothing to execute |
| 11:00 | MID-SESSION | report#2 regime 0.11; reviewing 5 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime 0.11; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 5 position(s), deployed ₹2,96,687, equity ₹4,96,345 (day -0.22%) |

### Day 8 — 2026-08-05 (Wed)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime 0.25 (BULLISH_CONSTRUCTIVE), breadth 32%, cash reserve 20% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | no long candidates today |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | HOLD | no rebalance due (monthly cadence); 5 position(s) held |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIPOWER, ADANIENSOL, CUMMINSIND, BHARATFORG, ADANIGREEN, BHEL] (topN 6) |
| 10:10 | AGENT regime | [done] risk-on (blended 0.273) — breadth 0.32 (risk-on); report regime 0.25 (BULLISH_CONSTRUCTIVE); avg sentiment 0.25 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture risk-on) |
| 10:10 | AGENT strategist | [done] all 1 candidate(s) vetoed by AI — ADANIGREEN: report AVOID |
| 10:10 | AGENT execute | [done] nothing to execute |
| 11:00 | MID-SESSION | report#2 regime 0.25; reviewing 5 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime 0.25; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 5 position(s), deployed ₹2,95,274, equity ₹4,94,932 (day -0.28%) |

### Day 9 — 2026-08-06 (Thu)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime 0.14 (NEUTRAL_MIXED), breadth 25%, cash reserve 27.5% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | no long candidates today |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | HOLD | no rebalance due (monthly cadence); 5 position(s) held |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIPOWER, ADANIENSOL, CUMMINSIND, BHARATFORG, ADANIGREEN, BHEL] (topN 6) |
| 10:10 | AGENT regime | [done] risk-on (blended 0.175) — breadth 0.25 (risk-on); report regime 0.14 (NEUTRAL_MIXED); avg sentiment 0.14 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture risk-on) |
| 10:10 | AGENT strategist | [done] all 1 candidate(s) vetoed by AI — ADANIGREEN: report AVOID |
| 10:10 | AGENT execute | [done] nothing to execute |
| 11:00 | MID-SESSION | report#2 regime 0.14; reviewing 5 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime 0.14; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 5 position(s), deployed ₹2,93,541, equity ₹4,93,199 (day -0.35%) |

### Day 10 — 2026-08-07 (Fri)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime 0.15 (NEUTRAL_MIXED), breadth 25%, cash reserve 27.5% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | BHARATFORG(BUY_ACCUMULATE) |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | HOLD | no rebalance due (monthly cadence); 5 position(s) held |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIENSOL, ADANIPOWER, BHARATFORG, CUMMINSIND, ADANIGREEN, BHEL] (topN 6) |
| 10:10 | AGENT regime | [done] risk-on (blended 0.178) — breadth 0.25 (risk-on); report regime 0.15 (NEUTRAL_MIXED); avg sentiment 0.12 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture risk-on) |
| 10:10 | AGENT strategist | [done] all 1 candidate(s) vetoed by AI — ADANIGREEN: report AVOID |
| 10:10 | AGENT execute | [done] nothing to execute |
| 11:00 | MID-SESSION | report#2 regime 0.15; reviewing 5 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime 0.15; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 5 position(s), deployed ₹2,95,549, equity ₹4,95,207 (day +0.41%) |

### Day 11 — 2026-08-10 (Mon)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime 0.15 (NEUTRAL_MIXED), breadth 19%, cash reserve 27.5% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | no long candidates today |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | HOLD | no rebalance due (monthly cadence); 5 position(s) held |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIENSOL, ADANIPOWER, BHARATFORG, CUMMINSIND, ADANIGREEN, BHEL] (topN 6) |
| 10:10 | AGENT regime | [done] risk-on (blended 0.163) — breadth 0.19 (neutral); report regime 0.15 (NEUTRAL_MIXED); avg sentiment 0.17 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture risk-on) |
| 10:10 | AGENT strategist | [done] all 1 candidate(s) vetoed by AI — ADANIGREEN: report AVOID |
| 10:10 | AGENT execute | [done] nothing to execute |
| 11:00 | MID-SESSION | report#2 regime 0.15; reviewing 5 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime 0.15; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 5 position(s), deployed ₹2,91,622, equity ₹4,91,280 (day -0.79%) |

### Day 12 — 2026-08-11 (Tue)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime 0.02 (NEUTRAL_MIXED), breadth 8%, cash reserve 27.5% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | no long candidates today |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | HOLD | no rebalance due (monthly cadence); 5 position(s) held |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIENSOL, ADANIPOWER, BHARATFORG, CUMMINSIND, ADANIGREEN, BHEL] (topN 6) |
| 10:10 | AGENT regime | [done] neutral (blended 0.045) — breadth 0.08 (neutral); report regime 0.02 (NEUTRAL_MIXED); avg sentiment 0.05 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture neutral) |
| 10:10 | AGENT strategist | [done] all 1 candidate(s) vetoed by AI — ADANIGREEN: report AVOID |
| 10:10 | AGENT execute | [done] nothing to execute |
| 11:00 | MID-SESSION | report#2 regime 0.02; reviewing 5 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime 0.02; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 5 position(s), deployed ₹2,87,933, equity ₹4,87,591 (day -0.75%) |

### Day 13 — 2026-08-12 (Wed)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime 0.08 (NEUTRAL_MIXED), breadth 12%, cash reserve 27.5% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | BHEL(BUY_ACCUMULATE) |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | HOLD | no rebalance due (monthly cadence); 5 position(s) held |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIENSOL, ADANIPOWER, BHARATFORG, CUMMINSIND, ADANIGREEN, BHEL] (topN 6) |
| 10:10 | AGENT regime | [done] neutral (blended 0.090) — breadth 0.12 (neutral); report regime 0.08 (NEUTRAL_MIXED); avg sentiment 0.08 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture neutral) |
| 10:10 | AGENT strategist | [done] all 1 candidate(s) vetoed by AI — ADANIGREEN: report AVOID |
| 10:10 | AGENT execute | [done] nothing to execute |
| 11:00 | MID-SESSION | report#2 regime 0.08; reviewing 5 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime 0.08; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 5 position(s), deployed ₹2,90,142, equity ₹4,89,800 (day +0.45%) |

### Day 14 — 2026-08-13 (Thu)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime 0.09 (NEUTRAL_MIXED), breadth 15%, cash reserve 27.5% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | no long candidates today |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | HOLD | no rebalance due (monthly cadence); 5 position(s) held |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIENSOL, ADANIPOWER, BHARATFORG, BHEL, CUMMINSIND, ADANIGREEN] (topN 6) |
| 10:10 | AGENT regime | [done] neutral (blended 0.103) — breadth 0.15 (neutral); report regime 0.09 (NEUTRAL_MIXED); avg sentiment 0.05 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture neutral) |
| 10:10 | AGENT strategist | [done] all 1 candidate(s) vetoed by AI — ADANIGREEN: report AVOID |
| 10:10 | AGENT execute | [done] nothing to execute |
| 11:00 | MID-SESSION | report#2 regime 0.09; reviewing 5 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime 0.09; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 5 position(s), deployed ₹2,88,995, equity ₹4,88,653 (day -0.23%) |

### Day 15 — 2026-08-14 (Fri)

| Time | Stage | What happened |
| --- | --- | --- |
| 09:00 | PRE-OPEN | report#1 regime 0.04 (NEUTRAL_MIXED), breadth 8%, cash reserve 27.5% |
| 09:00 | RISK POSTURE | single-stock cap x1, cash reserve +0pp (driven by report) |
| 09:00 | WATCHLIST | ADANIGREEN(CONSIDER_LONG), BHEL(BUY_ACCUMULATE) |
| 09:15 | MARKET OPEN | 59 instruments marked |
| 09:45 | ORB WINDOW | opening range observed; no orders placed in the first 30 min (noise filter) |
| 10:00 | HOLD | no rebalance due (monthly cadence); 5 position(s) held |
| 10:10 | AGENT momentum_rank | [done] 18 candidate(s), target [ADANIENSOL, ADANIPOWER, BHARATFORG, BHEL, ADANIGREEN, CUMMINSIND] (topN 6) |
| 10:10 | AGENT regime | [done] neutral (blended 0.053) — breadth 0.08 (neutral); report regime 0.04 (NEUTRAL_MIXED); avg sentiment 0.03 |
| 10:10 | AGENT screener | [done] 18 candidate(s) from momentum ranking (posture neutral) |
| 10:10 | AGENT strategist | [done] BUY 29 ADANIGREEN @ 1348.00 (tilt 0.60, 0 vetoed) |
| 10:10 | AGENT execute | [done] executed ADANIGREEN 29@1348.27 |
| 11:00 | MID-SESSION | report#2 regime 0.04; reviewing 6 held position(s) |
| 11:00 | NO CHANGE | hold all (0 blocked/none actionable) |
| 15:15 | PRE-CLOSE | report#3 regime 0.04; end-of-day rebalance review |
| 15:15 | NO CHANGE | no EOD rebalancing required |
| 15:15 | SQUARE-OFF | no intraday (MIS) positions — all holdings are CNC swing |
| 15:15 | EOD LOG | performance + overnight gap matrix persisted |
| CLOSE | MARK | 6 position(s), deployed ₹3,29,730, equity ₹4,90,289 (day +0.33%) |

**Orders:** BUY ADANIGREEN

## What this run does and does not prove

**Proven — these are the real production components, not stand-ins:**

- The 3-stage cycle fires in order every day and persists three reports.
- The report reaches all three consumers: the RiskEngine posture, the
  MomentumStrategy bias/veto, and the agent blackboard.
- Sizing respects the single-stock cap, the per-trade cap and the cash reserve.
- Every order passes the RiskEngine gate and the idempotent order router.
- The EOD layer squares off intraday, logs performance and scans overnight gap risk.
- Prices, costs and slippage are real (Yahoo NSE daily closes + the shipped cost model).

**Not proven — and no simulation can prove it:**

- **The news/AI layer adds alpha.** The reasoning layer here is deterministic and
  derives its view only from data available on the simulated day. A real LLM reading
  real news would change these decisions — for better or worse. That is measurable
  only in forward paper trading.
- **The strategy edge.** 15 trading days is roughly one rebalance of a
  monthly-cadence strategy. The P&L above is essentially the drift of one basket over
  three weeks; it is noise, not evidence. `npm run validate:momentum` (215 out-of-sample
  months) is the statistical claim.
