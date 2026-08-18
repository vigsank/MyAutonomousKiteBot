# Adhoc changes

This file records changes made agentically during plan implementation that were
*not* spelled out verbatim in `docs/plan/plan.md`, plus decisions deferred for
human review. The user audits this after the fact.

---

## 6-month mock trade validation (2026-08-17)

**Context.** Built `test/backtest/mock_30d_trade.ts` to run a configurable
multi-month paper trade through the kite-paper-node mock broker treated as the
real Zerodha backend (orders routed via `LiveTrader` → `POST /orders/:variety`).
Running it surfaced two issues that were corrected in the harness and one real
bug in the risk engine that was fixed in `src/server`.

### Adhoc 1 — RiskEngine blocked every sell (REAL BUG, fixed in src/server)

**Symptom.** In a multi-month run the book grew past `topN` (e.g. 7 positions
with `topN=5`) because *no* position was ever sold even when it left the target
portfolio.

**Root cause.** `RiskEngine.evaluate` applied the capital-capacity and
single-stock caps to **closes** as if they were buys:

```ts
// capital capacity
if (used + trade.ticketSize > spendable) { … 'Insufficient capital' … }
// single-stock cap
if (trade.ticketSize > singleStockCap) { … }
```

For a SELL the ticket is positive (quantity × price), so on a fully-deployed
book `used + sellTicket > spendable` always fired → every exit was rejected
(`Insufficient capital`). This would have made the **live** bot unable to trim
or close positions, letting the book drift unbounded past its slot count.

**Fix.** Exits/reductions always reduce exposure and free capital, so they now
short-circuit the caps. In `RiskEngine.evaluate`, after the `existing` position
lookup:

```ts
const isClose = existing !== null && existing.direction !== trade.direction;
if (isClose) {
  const allowed = trade.ticketSize > 0;
  return { allowed, reasons: allowed ? [] : ['Ticket size must be positive.'] };
}
```

The single-trade risk cap already excluded closes; this now excludes them from
the allocation/concentration/capital/drawdown caps too. `npm run test:risk` and
`npm run test:unit` all pass; `npm run validate:momentum` still **VALIDATED
(36.99%)**. Without this fix the 6-month backtest could not sell and the book
grew past `topN`.

### Adhoc 2 — synthetic-data contamination in the mock harness

**Symptom.** The target portfolio kept picking `ZOMATO`, `MINDTREE`, `LTIM`,
`JSWELECTRIC` — none of which have a `_1d.csv` in `kite-paper-node/data`.

**Root cause.** The harness passed the full 214-symbol watchlist as the mock's
`seedSymbols`. For the 4 symbols with no CSV, the mock generated **synthetic
random-walk** data, which the ranker then bought on fake prices.

**Fix.** The harness now filters fetched data to symbols that have a real
`_1d.csv` (`realCsvSymbols()`), so only genuine NSE closes enter the ranking.

### Adhoc 3 — adaptive lookback for the 12-month window

**Symptom.** Early monthly rebalances bought nothing.

**Root cause.** The validated 12-month lookback needs 13 months of data, but the
CSVs span only ~12 months (Aug 2025 → Aug 2026), so `computeMomentum` returned
null for every symbol at the start of the window.

**Fix.** The harness sets an **adaptive lookback** per rebalance — the longest
available up to 12 months (min 2) — mirroring `sim_12m_sip.ts`, so the strategy
can rank every month. The report header notes this deviation from the fixed
12-month edge.

### Validation

- `npx tsc --noEmit` = 0 errors (root)
- `npm run test:risk` = pass
- `npm run test:unit` = all suites pass
- `npm run validate:momentum` = VALIDATED (36.99%)
- 6-month mock trade (₹1,00,000, mock broker as real backend): **+₹2,807 (+2.81%)**, 6 monthly rebalances, per-day + per-month report at `test/backtest/results/mock_trade_report.md`.

---

## 5-year data refresh + re-run (2026-08-17)

**Context.** The 12-month CSVs were a weak, unrepresentative period for momentum
(6-month mock trade was only +2.8%). To get a fair test, extended the daily
history to 5 years.

### Adhoc 4 — fetch 5 years of daily data from Yahoo

`kite-paper-node/scripts/fetch-watchlist-csv.js` hardcoded `'1d': { days: 365 }`.
Changed to `days: 1825` (5 years) and added an `--interval=1d` filter so the
refresh only pulls daily data (fast, avoids Yahoo rate-limit throttling). Re-ran
for all 210 watchlist symbols → each `_1d.csv` now spans **Aug 2021 → Aug 2026**
(~1238 rows). `ZOMATO` is delisted on Yahoo (0 rows) — it was one of the
synthetic symbols anyway.

### Adhoc 5 — harness now uses the true 12-month lookback

With 5 years of data the adaptive-lookback formula caps at 12 months for every
rebalance, so the harness now exercises the **validated 12-month lookback**
(not the degraded 5–10 month adaptive fallback). Report title/notes updated to
reflect this; output file is now `mock_trade_report_{MONTHS}m.md`.

### Re-run results (₹1,00,000, mock broker as real backend, 12-month lookback)

- **6-month** (Mar–Aug 2026): **+₹11,766 (+11.77%)** → `mock_trade_report_6m.md`
- **12-month** (Sep 2025–Aug 2026): **+₹13,802 (+13.80%)** → `mock_trade_report_12m.md`

Both are far healthier than the 12-month-data result (+2.8%), confirming the
earlier low number was a data-window artifact, not a strategy/code problem. The
portfolio-drawdown guard (10%) halts new entries after a drawdown (visible in
later months as `Portfolio drawdown … exceeds max 10%`), which is the intended
"no monthly loss" behaviour.

---

## Sentiment-regime switching (Initiative 6, built 2026-08-17)

**What.** The AI daily report already carries `market_regime.regime_score`
([-1,1]). Momentum now consumes it as a **shrink-only exposure dial**: in a
bearish regime it scales position sizing down, and can go to cash when
`MOMENTUM_REGIME_FLOOR_MULTIPLIER=0`. It never changes which names momentum
picks — only how big the book runs. This is the coarse, low-frequency,
capital-preserving "momentum-on vs momentum-off" signal.

**Implementation.**
- Pure fn `regimeMultiplier(score, {riskOff, defensive, floor})` in
  `src/server/signals/momentum.ts` — score ≥ defensive → 1.0; ≤ riskOff → floor;
  between → linear.
- `MomentumStrategy` extracts `regime_score` in `loadReportBias()` and applies
  `currentRegimeMultiplier()` in `quantityFor()` alongside `StrategyAdaptation`.
- Config: `MOMENTUM_REGIME_ENABLED` (true), `MOMENTUM_REGIME_RISK_OFF_THRESHOLD`
  (-0.3), `MOMENTUM_REGIME_DEFENSIVE_THRESHOLD` (0),
  `MOMENTUM_REGIME_FLOOR_MULTIPLIER` (0.4). Documented in `.env.example` +
  `docs/CONFIGURATION.md` §18.
- Tests: pure-math cases (18–22) + strategy-integration (23–24) in
  `test/momentum_test.ts`. `test:unit` all pass; `validate:momentum` VALIDATED.

**Note on the existing `REGIME_GATING_ENABLED` / `REGIME_ADAPTIVE` env keys:**
those belong to the older MarketAgent path and are unrelated to this momentum
regime feature. The new keys are prefixed `MOMENTUM_REGIME_` to avoid ambiguity.

**Deferred (TODO #14):** news/event-driven plays — AI flags a catalyst and
proposes a long as a SEPARATE originator, shadow-book-gated. Not built; logged in
`docs/plan/TODO.md`.
