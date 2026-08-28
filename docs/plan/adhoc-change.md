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

---

## Full AI-backed 6-month test + date-scoped news (2026-08-17)

### Adhoc 6 — date-scoped news sentiment (removes look-ahead)

Backtesting an AI-news strategy against LIVE headlines for historical rebalance
dates is look-ahead. The user pointed out TinyFish has a time-range filter. Added
`NewsSentimentEngine.sentimentForDate(symbol, date)` (reuses the existing
`fetchArticlesForDate` which already calls TinyFish `after_date`/`before_date`),
and threaded an optional `asOf` (YYYY-MM-DD) through
`DailyReportEngine.generate(reportType, symbols, now, asOf?)` → `analyzeSymbols`
so per-symbol news sentiment reflects the rebalance date's period.

**Residual limitation:** the global-macro headline input (`fetchGlobalMacro()` +
`fetchMacroNews()`) was originally the CURRENT snapshot, not date-scoped. **This was
subsequently fixed** — see Adhoc 6b below.

### Adhoc 7 — full AI-backed 6-month harness

`test/backtest/mock_ai_backed.ts` runs the REAL LLM (Ollama) + news at every
monthly rebalance through the mock broker. At each month it calls
`DailyReportEngine.generate('pre_open', top3, now, rebalanceDate)`, then the
momentum strategy consumes the persisted report (regime scaling + per-symbol
veto/shrink) and executes via `LiveTrader` → mock. `AI_SYMBOLS` env (default 3)
limits the per-report symbol count to keep LLM calls tractable.

**6-month result (Mar–Aug 2026, ₹1L): +₹929 (+0.93%)** →
`test/backtest/results/mock_ai_backed_report_6m.md`.

**Key observation:** the LLM read a cautious-to-bearish regime (-0.31..-0.40) for
ALL six months (driven by the non-date-scoped macro), so the regime gate held
position size at the 0.40 floor the whole window. This cut the March drawdown
(-5% vs -12% for pure momentum) but also suppressed the June recovery (+5% vs
+12%). Net: +0.93% vs pure-momentum +11.77% on the same window. That is the
honest cost of a persistently risk-off regime filter on a window that was
actually a recovery. In a real bear regime the protection would show as smaller
losses.

`test:unit` all pass; `validate:momentum` VALIDATED (36.99%).

### Adhoc 6b — date-scoped global macro (removes the persistent-regime artifact)

The first AI-backed run showed the LLM reading a cautious/bearish regime for ALL
six months because `fetchGlobalMacro()` used Yahoo `quote()` (today's numbers).
Date-scoped it:
- `fetchGlobalMacro(asOf?)` now computes each index's **day-over-day % change on
the asOf date** from Yahoo chart history (close vs prior close) instead of the
live quote.
- `DailyReportEngine.generate(..., asOf)` passes the date through to
`fetchGlobalMacro(asOf)` AND `fetchMacroNews(asOf)`; macro headlines are
backfilled via a new `NewsSentimentEngine.fetchArticlesForQueryDate(query, date)`
using the TinyFish time-range filter.

**Re-run (6-month, ₹1L):** regimes now vary by month (Apr/Jun/Jul/Aug bullish →
exposure x1.0; Mar/May risk-off → x0.40) → **+₹2,187 (+2.19%)** (up from +0.93%).

**Honest finding:** still below pure momentum (+11.77%) on the same window. The
AI per-symbol vetoes removed several strong momentum names (e.g. HINDCOPPER,
CHENNPETRO — quiet winners without bullish headlines), so the AI filter can
subtract value by vetoing momentum winners that aren't in the news. That is the
AI-filter-vs-momentum tension, worth monitoring with the shadow book.

### Adhoc 8 — AI veto audit + shrink-not-block veto

**Veto audit** (`test/backtest/veto_audit.ts` → `results/veto_audit_report.md`):
measured the AI's AVOID calls against the pure-momentum baseline over the same
6-month window. Verdict: **PROTECTIVE overall** — vetoed names averaged +2.95%
vs the book's +6.54% (4 of 5 months protective). BUT May was **HARMFUL**: the AI
fully blocked LAURUSLABS, which returned **+26%**. That is the exact case for
softening the veto.

**Shrink-not-block** (built): new config `MOMENTUM_VETO_MODE` (`block`|`shrink`,
default `block`) + `MOMENTUM_VETO_SHRINK_PCT` (default 50). In `shrink` mode an
AI `AVOID` name is **allowed but sized down** to a fraction of its slot instead
of fully blocked (`reportBlocksEntry` in the rebalance loop + shrink in
`quantityFor`). `EXIT_FULL` still blocks. Tests 25–26 in `momentum_test.ts`.

**Re-run (6-month, ₹1L, shrink-not-block): +₹4,647 (+4.65%)** →
`results/mock_ai_backed_shrink_report_6m.md`. AVOID names (HINDCOPPER, LAURUSLABS,
ADANIPOWER) are now bought at reduced size instead of skipped.

**Comparison (same 6-month window, ₹1L):**

| Variant | Total P&L |
|---|---|
| Pure momentum | +11.77% |
| AI-backed, block veto | +2.19% |
| AI-backed, shrink-not-block | **+4.65%** |

Shrink-not-block more than doubled the AI-backed return by capturing upside the
hard veto was throwing away, while keeping the protective regime gate. Still
below pure momentum — the AI filter (regime de-risk + shrink) trades upside for
lower drawdown, which is the intended tradeoff.

### Adhoc 9 — Event-driven news monitor (Phase 4.4, core built)

Built the core of the event-driven news monitor that closes the "monthly gap".
- **Seen-article store** — `migrations/V016__seen_articles.sql` + `Ledger`
  `recordSeenArticle` / `isArticleSeen` (dedupes so each story triggers once).
- **Config** — `newsMonitor` section: `NEWS_MONITOR_ENABLED` (false),
  `NEWS_MONITOR_INTERVAL_MS` (900000 = 15 min),
  `NEWS_MONITOR_SENTIMENT_EXIT_THRESHOLD` (-0.5),
  `NEWS_MONITOR_OPPORTUNISTIC_ENABLED` (true),
  `NEWS_MONITOR_OPPORTUNISTIC_PARTIAL_PCT` (50).
- **`MomentumStrategy.defensiveExit()`** — exits a HELD position immediately on
  negative news (routes through RiskEngine + LiveTrader).
- **`MomentumStrategy.opportunisticEntry()`** — enters a PARTIAL position on a
  momentum candidate with positive news (pull-forward of the monthly entry).
- **`NewsMonitorEngine`** — polls Google News RSS per watchlist symbol, diffs vs
  the seen-article store, scores sentiment once per symbol with new news, and
  decides/executes the defensive or opportunistic path. Momentum stays the
  originator; the RiskEngine is the final arbiter.
- **Wired into `index.ts`** — creates the momentum stack + news monitor and runs
  a poll loop at `NEWS_MONITOR_INTERVAL_MS`.
- **Tests** — `test/news_monitor_test.ts` (`npm run test:newsmonitor`, in
  `test:unit`): seen-article dedupe, `decide` (held+negative→EXIT,
  held+positive→NONE), `defensiveExit` closes a held position,
  `opportunisticEntry` opens a partial position. All pass.
- **Docs** — `.env.example` + `docs/CONFIGURATION.md` §3.1.

**Not yet done (per plan §4.4):** walk-forward validation of both paths on the
5-year CSV data (does defensive exit cut left-tail without whipsaw? does
opportunistic entry beat waiting for the monthly rebalance, net of turnover?).
The opportunistic path also needs the momentum ranking to be fresh at poll time.

### Adhoc 10 — News-monitor walk-forward + mock-harness integration

**Walk-forward validation** (`test/backtest/news_monitor_walk_forward.ts` →
`results/news_monitor_walk_forward_report.md`). Since the CSVs have prices but
no historical news, it uses PRICE proxies for the news triggers: defensive = exit
a held name on a single-day drop ≥ 4%; opportunistic = partial entry on a
20-day-high breakout of a momentum candidate. Over the full 5-year window
(48 rebalances, ₹1L):

| Variant | Return | Max drawdown |
|---|---|---|
| Baseline (monthly momentum) | +174% | 40.9% |
| + Defensive exit | +121% | **20.9%** |
| + Opportunistic entry | +1067% | 25.0% |
| + Both | +497% | 29.8% |

**Key finding:** the defensive path **halves max drawdown (40.9% → 20.9%)** at a
cost to total return — validating the crash-catch value. The opportunistic
number (+1067%) is likely inflated by the proxy (repeated partial entries
compounding) and needs more careful modeling before trusting it.

**Refined (Adhoc 10b):** the opportunistic proxy was inflated because it sized
against *remaining cash* (50% each time, compounding). Refined to size against
**one slot** (equal-weight target) and cap at **MAX_OPPORTUNISTIC=2** concurrent
positions. Re-run:

| Variant | Return | Max drawdown | Trades | Opp entries |
|---|---|---|---|---|
| Baseline (monthly momentum) | +174% | 40.9% | 5 | 0 |
| + Defensive exit | +121% | 20.9% | 194 | 0 |
| + Opportunistic entry | +333% | 31.1% | 5 | 2 |
| + Both | +116% | 16.6% | 291 | 82 |

The opportunistic-only variant fires only 2 entries because the book is fully
deployed (no spare cash) — a realistic constraint. When defensive frees cash
(+Both), 82 opportunistic entries fire. The combined effect is lower return but
much lower drawdown (16.6% vs 40.9%) — the tail-risk tradeoff.

**Ranking freshness (Adhoc 10c):** the mock harness now refreshes the momentum
ranking as-of each day before the news-monitor poll, so the opportunistic
candidacy check is fresh (not the last monthly-rebalance ranking). The monitor
now fires many more opportunistic entries intraday.

### Adhoc 11 — Real-news validation + 6-month news-monitor mock

**Real-news validation** (`test/backtest/news_real_validation.ts` →
`results/news_real_validation_report.md`): fetched real date-scoped news
sentiment (TinyFish time-range) for 60 samples (6 rebalance dates × 10 symbols)
and compared to the same-day price move. **Only 57% aligned (34/60)** — the
price proxies align **weakly** with real news. So the walk-forward's price-proxy
assumption is a weak stand-in; interpret it with caution.

**6-month mock with the news monitor** (`mock_ai_backed.ts` MONTHS=6): the
monitor (price-proxy) fired 94 defensive/opportunistic events over the window.
Result: **₹0 (0.00%)** — the aggressive triggers (exit on any ≥4% drop, enter on
any breakout) caused excessive churn that offset the gains. Compare:

| Variant (same 6-month window) | Return |
|---|---|
| Pure momentum | +11.77% |
| AI-backed, shrink-not-block (no news monitor) | +4.65% |
| AI-backed + news monitor (price-proxy) | **0.00%** |

**Honest conclusion:** as configured (aggressive price-proxy triggers that align
only weakly with real news), the news monitor **subtracts value via churn** in
this backtest. The real-news validation confirms the price proxies are unreliable
stand-ins. The path forward: (a) tighten the triggers (higher drop/breakout
thresholds, fewer opportunities), and (b) where possible use real date-scoped
news sentiment rather than price proxies. This is a genuine negative result — it
stops us from shipping a churning overlay.

**Mock-harness integration** — `mock_ai_backed.ts` now wires the real
`NewsMonitorEngine` with a `PriceProxyNewsEngine` stub (sharp drop = negative
news, breakout = positive news) and polls it each day. The monitor fires
**defensive exits** (LAURUSLABS, RBLBANK, CHENNPETRO, ADANIPOWER, …) and
**opportunistic entries** (GLENMARK, RBLBANK, WELCORP, SAIL, …) end-to-end
through the mock broker. Caveat: the high-frequency news-monitor orders hit the
mock broker's fire-and-log limit (`LIVE order FAILED`), but the paper ledger
(system of record) records correct P&L.

## Phase 6 — A-core, B-earned: shadow blackboard harness (2026-08-20)

Built the shadow-blackboard promotion framework per plan §6.

**Adhoc 12 — `signals/meanReversion.ts` (new signal agent).** Pure, deterministic
RSI (Wilder) + Bollinger mean-reversion signal, `rankByReversion()`. Gives the
blackboard a genuinely different second view (contrarian) vs momentum
(extrapolative). Reuses `ClosePoint` from momentum.ts; `rankByReversion` ranks
by how oversold a name is (negative z-score vs a 20-day mean, blended with RSI).

**Adhoc 13 — `test/backtest/shadow_blackboard.ts` + `npm run validate:shadowblackboard`.**
Self-contained harness reading the 5-year CSVs directly (no server spin-up). Runs
the validated momentum book (A) and a composite blackboard (B = momentum 0.7 +
mean-reversion 0.3, regime-scaled) in **shadow**, same capital/costs, and scores
both + applies the §6.3 promotion gate. Gate thresholds are env-configurable
(`GATE_EDGE_PP`, `GATE_WINDOW_MONTHS`, `GATE_DD_TOL_PP`, `GATE_WIN_TOL_PP`).
Adds both a full-window gate and a **rolling 6-month** gate. Benchmark is the
equal-weight cross-sectional market proxy (NOT Nifty) — labelled clearly;
A-vs-B comparison is unaffected. Report:
`test/backtest/results/shadow_blackboard_report.md`.

**Result (2022-09 → 2026-08, 48 monthly rebalances, ₹1L, TopN 6, band 8):**

| Metric | A (momentum) | B (blackboard, shadow) |
| --- | --- | --- |
| Annualized (net) | 31.54% | 13.88% |
| Market proxy | 19.88% | 19.88% |
| Win rate | 60.42% | 62.50% |
| Max drawdown | 31.03% | 36.81% |
| Sharpe | 1.04 | 0.71 |
| Turnover | 1.1 buys/mo | 4.0 buys/mo |

**Verdict: KEEP B IN SHADOW** — it fails every gate but win rate (edge -17.6pp,
Sharpe 0.71<1.04, maxDD 36.8>33.0, below market). The naive blend dilutes the
strong momentum edge in a mostly-bull window. **Rolling gate:** B promotes in
only 6/43 trailing 6-month windows, all clustered in the 2025 H1 bear/choppy
regime (e.g. 2025-02→2025-07 edge +40.4pp, maxDD 13.8 vs 25.4). Two honest
findings for the user:

1. **The gate works as designed** — it does not blindly promote B.
2. **B's only edge is regime-resilience** (diversification helps in drawdowns,
   hurts in bull runs). That hints B could earn a *regime-conditional* role (the
   risk-off book) rather than a full co-originator seat — a future refinement,
   not a promotion.

**Adhoc 14 — `test/mean_reversion_test.ts` + `npm run test:meanreversion`.**
Unit test for the new signal (mirrors `test:momentum` style). Caught and fixed a
real bug: `computeRsi` returned 100 for a perfectly flat series (both gain and
loss = 0) — now returns 50 (neutral). Wired into `test:unit`.

**Adhoc 15 — `test/backtest/shadow_blackboard_regime.ts` + `npm run
validate:shadowblackboard:regime`.** Tests the hypothesis from Adhoc 13: does B
earn a *regime-conditional* role (the risk-off book)? Three books compared on
the same 5-year CSVs: A (momentum always), B (blackboard always), C (A when
risk-on, B when risk-off). Regime signal is env-selectable: `REGIME_SIGNAL`
`drawdown` (market % below trailing 12-mo high, trigger `DRAWDOWN_TRIGGER`
default -8%) or `breadth` (mean 12-mo momentum).

**Result (2022-09 → 2026-08, 48 rebalances, ₹1L, TopN 6, band 8, cost 0.16%):**

| Metric | A (momentum) | B (blackboard) | C (regime-conditional) |
| --- | --- | --- | --- |
| Annualized (net) | 31.54% | 13.88% | **35.85%** |
| Max drawdown | 31.03% | 36.81% | 31.03% |
| Sharpe | 1.04 | 0.71 | **1.18** |
| Risk-off avg/mo (10 mo) | -2.41% | -0.98% | -1.02% |
| Risk-on avg/mo (38 mo) | 4.05% | 1.91% | 3.99% |

**Verdict: B EARNS a regime-conditional role.** C beats A by ~4.3pp annualized
(35.85% vs 31.54%) with the SAME max drawdown and a better Sharpe. The drawdown
signal correctly flags the real risk-off periods (2025 Feb–Mar, 2026 Feb–Apr);
in those months C loses far less than A (e.g. 2025-03: A -15.16% vs C -7.81%)
while giving up almost nothing in bull months (3.99% vs 4.05%). This confirms
the Phase 6 finding: B is NOT a full co-originator, but it IS a valuable
risk-off book. Two bugs found & fixed while building: (1) the trailing "high"
was the max of individual stock prices, not the market-level series — fixed;
(2) the market-level series is now precomputed once (was O(n²)).

**Adhoc 16 — regime-conditional overlay wired into the live `MomentumStrategy`.**
The validated risk-off book is now a real, config-gated overlay in the live
strategy (not just a backtest). New config (all OFF by default):
`MOMENTUM_REGIME_CONDITIONAL_ENABLED`, `MOMENTUM_REGIME_CONDITIONAL_TRIGGER`
(default -0.08), `MOMENTUM_REGIME_CONDITIONAL_MOM_WEIGHT` (default 0.7).
`MomentumStrategy.targetPortfolio()` now checks `isMarketRiskOff()` (equal-weight
market level below its trailing 12-mo high by the trigger); when risk-off it
returns `blackboardTarget()` (momentum + mean-reversion blend, hysteresis +
diversify) instead of the pure momentum book. Inert when disabled (returns
immediately, zero cost). New test `test/regime_conditional_test.ts`
(`npm run test:regimeconditional`, in `test:unit`) verifies: disabled → pure
momentum; enabled + drawdown → blackboard book (different names); enabled +
healthy → momentum book unchanged. **`npm run ci` still VALIDATED** (all 14
suites pass + momentum OOS gate green) — the overlay is additive and does not
regress the validated edge.

**Adhoc 17 — end-to-end mock tests with the overlay enabled.**
`mock_30d_trade.ts` now accepts `REGIME_CONDITIONAL=true` (plus
`REGIME_CONDITIONAL_TRIGGER` / `REGIME_CONDITIONAL_MOM_WEIGHT`) to enable the
Phase 6 overlay through the full stack (MomentumStrategy → RiskEngine →
PaperTrader → LiveTrader → kite-paper-node mock broker). Ran two windows:

- **6-month (2026-03-02 → 2026-08-14): +1.85%** (₹1,848 on ₹1L). The rebalance
  log shows the overlay switching to the blackboard blend during risk-off (e.g.
  2026-07 target LAURUSLABS/HINDCOPPER/ADANIPOWER).
- **12-month (2025-09-01 → 2026-08-14): 0.00%** (flat). The account drew down,
  recovered to breakeven (₹1,00,000) by 2026-05-01, then the RiskEngine's
  portfolio-drawdown halt (max 10%) froze it in cash for the final months — the
  risk guard preserved capital but the account did not recover within the window.

Caveat (as always): these are single-window mock tests, not walk-forward. A
single 6/12-month window is dominated by costs and regime luck; the overlay's
edge is best evidenced by the 4-year backtest (+4.3pp annualized, no extra
drawdown). The 12-month flat result is the risk guard working, not a strategy
failure.

**Adhoc 18 — 5-year walk-forward: the overlay does NOT reliably beat momentum.**
`shadow_blackboard_walkforward.ts` (`npm run validate:shadowblackboard:walkforward`)
runs A (momentum) and C (overlay) FRESH on every rolling 12-month window over
the full 5 years (37 windows). Result: **C beats A in only 17/37 windows
(45.95%)** — less than half. The average edge (+4.86%) is positive only because
of a cluster of big wins in the 2025 H1 risk-off period; in the ~15 windows
where the market was NOT in drawdown, C = A exactly (0.00% edge), and in other
windows C trails A by up to -4.8pp. **Verdict: DROP the overlay.** The 4.3pp
full-window edge was over-fit to one regime cluster, not a robust out-of-sample
edge. The overlay stays OFF by default (`MOMENTUM_REGIME_CONDITIONAL_ENABLED`
false) and should NOT be enabled. This confirms the user's observation that
enabling it gave no benefit in the end-to-end tests.

**Adhoc 19 — Phase 6 code stripped (dead-end removed).** Per the walk-forward
verdict, all Phase 6 overlay/blackboard code was removed: `signals/meanReversion.ts`,
`test/mean_reversion_test.ts`, `test/regime_conditional_test.ts`, the three
shadow-blackboard harnesses (`shadow_blackboard.ts`, `_regime.ts`, `_walkforward.ts`)
and their reports, the overlay logic in `MomentumStrategy.ts` (`isMarketRiskOff`,
`marketLevelSeries`, `closeOnOrBefore`, `blackboardTarget`, the `targetPortfolio`
check, the `rankByReversion` import), the three config fields in `AppConfig.ts`
(`momentumRegimeConditionalEnabled/Trigger/MomWeight`), the `REGIME_CONDITIONAL`
toggle in `mock_30d_trade.ts`, and the five npm scripts
(`test:meanreversion`, `test:regimeconditional`, `validate:shadowblackboard*`).
`npx tsc --noEmit` (root + test) clean. Momentum (A) remains the sole validated
originator. This is the honest end of the "A-core, B-earned" experiment: the AI
blackboard did not earn a seat.

**Adhoc 20 — defensive-exit validation: cuts drawdown but kills returns (crude
price-proxy trigger).** `defensive_exit_validation.ts`
(`npm run validate:defensive`) tests the AI defensive exit (the one AI feature
worth pursuing) walk-forward: momentum (A) vs momentum + defensive exit (A2),
full window + all 37 rolling 12-month windows. Defensive trigger = exit a held
position on a single-day drop >= 5% (price proxy for negative news).

**Full window:** A2 cuts max drawdown 40.21% → 24.24% (good) but HALVES return
(21.97% → 11.83% annualized) and Sharpe gets worse (0.80 → 0.69).

**Rolling (37 windows):** defensive cuts drawdown in 27/37 (73%), but keeps
returns in only 8/37 (22%) — it kills returns in most windows.

**Verdict: MIXED / not worth it as a blanket rule.** The 5%-drop proxy fires
152 times vs 5 for baseline — it whipsaws winners in bull runs, trading half
the return for a drawdown cut at a worse Sharpe. KEY NUANCE: the live system
uses REAL news sentiment (fires only on genuine negative news), not a 5% drop,
so it whipsaws far less than this proxy. The honest next step is validating the
REAL-news defensive trigger (needs TinyFish/LLM access), not this crude proxy.

**Adhoc 21 — REAL-news defensive trigger validated: it works.**
`news_defensive_real.ts` (`npm run validate:defensive:real`) checks the crux
with REAL date-scoped news (TinyFish time-range via `sentimentForDate`): of the
defensive-candidate events (a held name drops >= 5%), how many are genuinely
news-driven vs whipsaw? Window 2026-02-02 → 2026-08-17, 14 candidate events
news-checked.

- **Only 3/14 (21%) were confirmed negative news; 11/14 (79%) were whipsaw**
  (drops with no negative news). This confirms the price-proxy fired ~5x too
  often — most of its 152 exits were false alarms.
- **A real-news-only defensive book (exit only on confirmed events): max
drawdown 8.00% → 5.42% (cut), return 51.61% → 51.91% (slightly UP), Sharpe
1.16 → 1.27 (better).** No return kill, real drawdown cut.

**Verdict: the real-news defensive trigger is worth enabling** — unlike the crude
price proxy, it cuts drawdown without killing returns. Recommended: gate
`NEWS_MONITOR_ENABLED=true` only after a longer sample confirms this (this is a
single ~6-month window, ~14 events — small n). Caveat: TinyFish misses may read
as neutral → "whipsaw", and single-day drops are a noisy event proxy.

**Adhoc 22 — multi-window real-news sample: the defensive trigger does NOT
consistently help. (Supersedes the optimistic Adhoc 21 read.)** Ran the same
real-news validation over 4 non-overlapping windows (2023, 2024, 2025, 2026)
covering the whole 5-year data, 48 events news-checked.

- **Confirmation rate holds: 12/48 (25%) of sharp drops are real negative news**
  (75% whipsaw) — real news fires ~4x less than the price proxy. The premise is
  confirmed.
- **But a real-news-only defensive book does NOT consistently help:** aggregate
  avg annualized drops 40.82% → 26.24%, Sharpe 1.13 → 0.89 (worse), and it only
  cuts max DD in 2/4 windows and keeps returns in only 1/4.

Why: even genuine news-driven crashes often MEAN-REVERT — the market overreacts
and the stock recovers, so selling on confirmed bad news locks in a dip that
would have bounced. The single-window "positive" (Adhoc 21, 2026 H1) was a
favorable sustained-crash window, not the norm. **Verdict: keep the defensive
exit gated OFF (`NEWS_MONITOR_ENABLED=false`).** The AI defensive layer does not
eat reliably earn its seat either. This is the honest end of pursuing AI
features: momentum (deterministic) remains the only thing that beats the market;
AI sentiment/news does not add value as a signal, an overlay, OR a defensive
trigger.

---

## Repo split — `kite-paper-node` → standalone GitHub repo (2026-08-28)

**Context.** Split `kite-paper-node/` out of the parent into its own repo so the
two become independent projects, communicating via a package boundary (npm) +
network (REST/WS/MCP) instead of in-process relative `require()` / hardcoded
relative filesystem paths. Full plan: `docs/plan/kite-paper-node-split.md`.

### Adhoc 23 — code decoupling + git extraction

**What changed (parent):**
- `src/server/KiteStreamer.ts` — `require('../../kite-paper-node/dist')` →
  `require('kite-paper-node')` (npm package).
- `test/backtest/{mock_30d_trade,mock_ai_backed,momentum_live_pattern}.ts` —
  `import { createMockServer } from '../../kite-paper-node/src/index'` →
  `from 'kite-paper-node'`.
- New `test/backtest/_dataDir.ts` — single `resolveDataDir()` helper reading
  `KITE_PAPER_DATA_DIR` env, falling back to sibling `../../../kite-paper-node/data`
  then in-parent `../../kite-paper-node/data`. Replaced 9 hardcoded CSV paths +
  3 `dataDir: 'kite-paper-node/data'` strings.
- `src/server/BrokerAccount.ts` + `src/server/LiveDataService.ts` — fixed stale
  comments (LiveDataService reads the parent's own `data/`, not kite-paper-node).
- `package.json` — added `"kite-paper-node": "github:vigsank/kite-paper-node#main"`.
- `.gitignore` — added `kite-paper-node/`.

**What changed (git):**
- Extracted kite-paper-node's 19-commit history (all authored `Vigsank
  <vigsank@gmail.com>`) via `git filter-repo --subdirectory-filter kite-paper-node`
  into a sibling repo at `/Users/i312327/SAPDevelop/kite-paper-node`, remote
  `https://github.com/vigsank/kite-paper-node.git`, identity set to User1.
- Parent: `git rm -r --cached kite-paper-node` (911 files untracked) + deleted the
  in-parent directory.
- `npm link` re-wired from the sibling; sibling built (`npm run build`).

**Validation:** `npm run ci` green (VALIDATED 36.99% / +26.84pp); `require('kite-paper-node')`
resolves to the sibling; `resolveDataDir()` → sibling `data/` (210 `_1d.csv`); mock
REST smoke test (`/quote?i=RELIANCE`) passed.

**Deferred (needs user):** push the sibling repo to github.com — the `gh` CLI here
is authenticated to SAP's GitHub Enterprise (`github.tools.sap` / `github.wdf.sap.corp`),
NOT `github.com`, so I could not create/push the public repo. After the user pushes,
run `npm install` in the parent to pull the git dependency (replacing the `npm link`
symlink).
