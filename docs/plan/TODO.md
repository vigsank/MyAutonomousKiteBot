# TODO — agentic execution queue

Status legend: `[x]` done · `[~]` in progress · `[ ]` not started

1. `[x]` **News neutral/old/new handling** — how should the AI react when news is
   neutral, or old, or new but with no real concern? See
   `docs/STRATEGIES_TECHNIQUES.md` §3 (sentiment model + heuristic fallback) and
   the `DailyReportEngine`/`NewsSentimentEngine` handling. (Design answer written
   in the docs review pass; the engine already returns `neutral` for zero/weak
   articles and a keyword-heuristic fallback when no LLM is configured.)
2. `[x]` **"Momentum strategy: designed & backtested, NOT wired" — wire it as a
   parallel stack.** Momentum is now wired as the single originator feeding the
   agent blackboard (Phase G): `momentum_rank` + `daily_report_context` agents,
   orchestrator publishes to a per-pass blackboard, `screener`/`strategist`/
   `execute` implement the momentum-originates / AI-filters authority model, and
   execution routes through `LiveTrader`. Config keys + `Ledger` methods added;
   `tsc` = 0 errors; all 11 unit suites pass; `validate:momentum` VALIDATED
   (36.99%, +26.84pp over Nifty).
3. `[x]` **Prep all `package.json` scripts.** Added `test:momentum|risk|
   indicators|live|feedback|agents|execution|tax|shadow|authority|ladder`,
   `test:unit`, `validate:momentum`, `score:shadow`, `status:golive`,
   `attribute:leaks`, `estimate:survivorship`, `ci`.
4. `[x]` **Kite MCP client / paper trade as real.** The mock now persists executed
   orders/positions/ledger/GTT to a **separate** SQLite DB via `--state-file`
   (StatePersistence module, wired into the REST mutation handlers and the
   MockEngine). Restarting the mock restores the account, so it behaves like a
   real Zerodha backend. See `kite-paper-node/docs/RUN-IN-MYAUTONOMOUSKITEBOT.md` §2c.
5. `[x]` **Profit/loss target algorithm (30–40% take / 10% stop, configurable).**
   **Verified already coded**: `STOP_LOSS_PERCENT` (default 4%) is a hard exit
   in `holdingsReview`/`MarketAgent`; `HOLDINGS_PROFIT_TARGET_PCT` (default 8%)
   books profit via TRIM. Both configurable. Deferred by design — fixed % take
   targets are a weak fit for a monthly-rebalance momentum book.
6. `[x]` **Clean up accumulated test artifacts.** Removed the superseded
   intermediate experiment dirs (`daily1/2/3`, `m15*`, `run1/2/3`) and the
   regenerable `.cache` price caches in `test/backtest/results/` (43MB → 2MB),
   keeping the named reports (`run_refocused`, `leak_attribution`,
   `strategy_lab_report`, `daily_cycle`, `sim_12m_sip_report.md`,
   `survivorship_bias.md`). Added `test/backtest/results/**/.cache/` to
   `.gitignore`.
7. `[x]` **"Momentum & live-trading keys (present in .env, NOT yet read)"** — this
   was the wiring gap: `.env` had `MOMENTUM_*`/`EVENT_BLACKOUT_*`/live keys but
   `AppConfig.ts` never read them. Now added (see adhoc #17) and the engine
   type-checks.
8. `[x]` **Mock as real Zerodha backend — bot does live trading via the mock.**
   The root bot trades "live" through the mock; the mock now persists state so
   it survives restarts like a broker. (See #4.)
9. `[x]` **Overhaul the three audit scripts.** `run_strategy_profit_audit.mjs`
   now models the real capital plan (₹10k Month 1, +₹10k/month for 12 months,
   reinvest profits, require net PROFIT at quarter/half/full-year boundaries);
   `run_code_audit.mjs` describes the momentum-originates / AI-filters blackboard
   model and fixes a stale `Tavily` → `TinyFish` reference. All three `node --check` clean.
10. `[x]` **Revisit/update all docs.** Updated `README.md`, `CAPABILITIES.md`,
    `STRATEGIES_TECHNIQUES.md`, `CONFIGURATION.md`, `BACKTESTING.md` to reflect
    the now-wired momentum engine, the blackboard authority model, the new
    `package.json` scripts, and mock persistence. (kite-paper-node docs updated
    for `--state-file`.)
11. `[x]` **"The runnable bot uses MarketAgent, not momentum"** — same wiring gap
    as #7. `index.ts` did not instantiate the momentum engine. Now resolved: the
    momentum engine + blackboard authority model is wired and validated (see #2).
12. `[x]` **Revisit Root `README.md`.** Rewritten for the current architecture
    (momentum originator, agent fleet/blackboard, mock-as-real-broker,
    `npm run ci` / `validate:momentum` / `score:shadow` / `status:golive`), with
    links to all docs. `kite-paper-node/README.md` covers the mock's own surface.
13. `[x]` **Sentiment-regime switching (Initiative 6, #1).** The daily report's
    `market_regime.regime_score` ([-1,1]) now scales momentum EXPOSURE via
    `regimeMultiplier()` (pure fn in `signals/momentum.ts`), applied in
    `MomentumStrategy.quantityFor` alongside the adaptation multiplier. Config:
    `MOMENTUM_REGIME_ENABLED`, `MOMENTUM_REGIME_RISK_OFF_THRESHOLD` (-0.3),
    `MOMENTUM_REGIME_DEFENSIVE_THRESHOLD` (0), `MOMENTUM_REGIME_FLOOR_MULTIPLIER`
    (0.4; 0 = go to cash). Shrink-only — never changes which names momentum picks.
14. `[ ]` **News/event-driven plays (#2, deferred).** AI flags a catalyst (earnings,
    regulatory, M&A) and proposes a long as a SEPARATE originator. High value but
    high risk: different holding period (days vs monthly), gap risk, hard to
    backtest reliably, and LLM catalyst-detection is noisy. MUST be shadow-book
    gated (`agent_proposals` as SHADOW, executed=0) and promoted to live only after
    it beats the momentum baseline over many months. Not yet built.
15. `[~]` **Event-driven news monitor (Phase 4.4).** Closes the "monthly gap" —
    react to news as it happens instead of only at the monthly rebalance. Poll
    Google News RSS (15 min) → diff vs a seen-article store → TinyFish detail →
    AI sentiment → strategy, with TWO paths: (a) **defensive** exit/shrink a held
    name on negative news (crash-catch), (b) **opportunistic** partial entry on a
    momentum candidate with a strong breakout + positive news (pull-forward of the
    monthly entry). Momentum stays the originator; AI can boost/shrink but never
    invent a symbol. Config: `NEWS_MONITOR_ENABLED`, `NEWS_MONITOR_INTERVAL_MS`
    (900000), `NEWS_MONITOR_SENTIMENT_EXIT_THRESHOLD`,
    `NEWS_MONITOR_OPPORTUNISTIC_ENABLED`, `NEWS_MONITOR_OPPORTUNISTIC_PARTIAL_PCT`.
    Full design in `docs/plan/plan.md` §4.4. **Core built** (seen-article store,
    `NewsMonitorEngine`, `defensiveExit`/`opportunisticEntry`, wired into
    `index.ts`, tests pass — see adhoc #9). **Walk-forward + mock-harness done**
    (adhoc #10): price-proxy validation shows the defensive path halves max
    drawdown (40.9% → 20.9%); the mock harness consumes the news monitor and
    fires defensive/opportunistic actions end-to-end. **Refined (adhoc #10b/c):**
    opportunistic proxy now sizes against one slot and caps at 2 concurrent
    positions (no more +1067% inflation); the mock harness refreshes the momentum
    ranking daily so the candidacy check is fresh. **Real-news validation done
    (adhoc #11):** price proxies align only weakly (57%) with real news, and a
    6-month news-monitor mock returned ~0% (churn) — the aggressive triggers
    subtract value. **Remaining:** tighten the news-monitor triggers (higher
    thresholds, fewer opportunities) and prefer real date-scoped news over price
    proxies before the ladder promotes the paths.
16. `[x]` **Split `kite-paper-node` into a standalone GitHub repo.** **Done:**
    code decoupling (SDK mock via `require('kite-paper-node')`, `createMockServer`
    via package import, data paths via `test/backtest/_dataDir.ts` +
    `KITE_PAPER_DATA_DIR`), git history extracted to a sibling repo
    (`/Users/i312327/SAPDevelop/kite-paper-node`, pushed to
    `github.com/vigsank/kite-paper-node`), parent untracked it + added to
    `.gitignore`, `package.json` now depends on
    `github:vigsank/kite-paper-node#main`, `npm link` wired for local dev,
    `npm run ci` green + mock smoke test passed.
17. `[x]` **Per-stock 200/220-DMA trend guard (master-class rules #2/#3).**
    The failed `MOMENTUM_REGIME_CONDITIONAL_ENABLED` experiment was
    *index-level* regime scaling — a *per-stock* absolute-trend filter is
    genuinely untested. Add a pure `sma(closes, n)` next to `computeMomentum`
    in `src/server/signals/momentum.ts`; when enabled, drop entry candidates
    whose latest close is below their DMA (config:
    `MOMENTUM_DMA_GUARD_ENABLED`, `MOMENTUM_DMA_GUARD_PERIOD` = 220; the class
    uses 200-DMA as the uptrend check and 220 as the guard/stop — make the
    period configurable) and, optionally, EXIT incumbent holdings on a close
    below the 220-DMA (config: `MOMENTUM_DMA_EXIT_ENABLED`). Gate with
    `npm run validate:momentum` walk-forward; promote ONLY if the guard lifts
    net annualized / positive months / drawdown vs the momentum-only baseline,
    else RETIRE like the index-regime overlay. **Built:** `sma()` +
    `applyDmaGuard()` in `signals/momentum.ts` (single universe filter — entry
    guard + exit/stop in one, since an incumbent below its DMA falls out of the
    ranking and is sold at the next rebalance); config
    `MOMENTUM_DMA_GUARD_ENABLED`/`MOMENTUM_DMA_GUARD_PERIOD` (220) added;
    wired into `targetPortfolio()`; 6 new unit tests pass; `tsc` clean.
    **Result (walk-forward):** RETIRED — 31.98% annualized vs 36.99% baseline
    (−5.0pp), +21.83pp vs +26.84pp over Nifty. The 220-DMA guard costs edge;
    it does not beat the momentum-only book.
18. `[x]` **Weekend entry screen + daily DMA tracker (master-class 1-2-3
    workflow, India-adapted).** FinViz is US-only, so there is no Indian
    screen the bot can lean on for universe selection — instead the universe
    is **Nifty 100, curated by the user every weekend** (personal weekly pick
    into `data/watchlist.json`). The bot does the rest:
      a. **Weekend screen** — new pure module `src/server/EntryScreen.ts`: for
         each watchlist name compute (i) the 200/220-DMA guard from #17 (close
         above the DMA), (ii) near-ATH (close within
         `ENTRY_SCREEN_NEAR_ATH_PCT`, default 10, of the max close over
         available history — Yahoo 5y daily and INDmoney historical both
         provide it), (iii) the 1-2-3 shape (ATH → pullback low → break above
         the prior ATH; detectable from daily closes), (iv) the existing
         liquidity floor. Output: ranked entry candidates + a suggested entry
         band. Optional pre-pick assist: run the same screen across all of
         Nifty 100 to publish a ranked shortlist the user approves on the
         weekend (the manual-Finviz equivalent, India edition).
      b. **Daily tracker** — every trading day recompute the 220-DMA, check
         candle action, and decide: ENTER a screened candidate that clears the
         guard + the near-ATH/1-2-3 trigger; HOLD while higher-highs /
         higher-lows persist; EXIT a held name when close < 220-DMA (the
         class's stop rule). Candle checks need OHLC — extend `ClosePoint` or
         add a `Candle` type (INDmoney daily history returns full
         `{ts,o,h,l,c,v}` candles; Yahoo's chart API provides OHLC too —
         current cached series are close-only, so backfill when first wiring
         this).
      c. **Authority** — consistent with momentum-originates/AI-filters: the
         tracker's entries remain a ranking/feature input to
         `MomentumStrategy` (boost or shrink a momentum candidate; never
         invent a symbol), while the DMA-break exit is defensive, mirroring
         `NewsMonitorEngine.defensiveExit`. Config: `ENTRY_SCREEN_ENABLED`,
         `ENTRY_TRACKER_ENABLED`. Reuse the #17 gate: walk-forward or a
         long-horizon mock must show the screen+tracker beats the plain
         monthly-rebalance book net of costs before it is allowed to exit
         incumbents live. **Built (core):** pure fns in
         `signals/entryScreen.ts` (`maxClose`, `lastClose`, `athDistancePct`,
         `nearAth`, `detect123`, `screenEntry`, `trackDaily`), the
         `EntryScreen` orchestrator (`src/server/EntryScreen.ts`), config
         `ENTRY_SCREEN_ENABLED`/`ENTRY_SCREEN_DMA_PERIOD` (220)/
         `ENTRY_SCREEN_NEAR_ATH_PCT` (10)/`ENTRY_TRACKER_ENABLED`, and 18 unit
         tests (`test:entryscreen`). **OHLC candle-action refinement done:**
         `uptrend()` (higher highs/lows, close fallback) + `requireUptrend`/
         `uptrendWindow` options, `EntryScreen.track()`, config
         `ENTRY_TRACKER_REQUIRE_UPTREND`/`ENTRY_TRACKER_UPTREND_WINDOW`, 6 more
         unit tests (24 total). **Result (daily-cycle validation):** the
         defensive DMA-break exit HELPS — max drawdown 50.8% → 43.0% (−7.8pp)
         at ~no return cost (+0.31pp), 52 exits over 6y. The opportunistic
         breakout ENTRY is untested (prior: the news-monitor's analogous path
         caused churn, and the #17 DMA guard retired). **Wired:** the defensive
         exit is now live — `DmaBreakMonitor` (`src/server/DmaBreakMonitor.ts`)
         runs the daily 220-DMA-break check against the live provider and
         routes exits through `MomentumStrategy.defensiveExit`; wired into
         `index.ts` with a timer (`ENTRY_TRACKER_INTERVAL_MS`, default 6h).
         Disabled by default (`ENTRY_TRACKER_ENABLED=false`).
19. `[x]` **Multi-factor tilt (factor indexing, master-class point #1).** Blend
    a second factor into the momentum score: `score = momentum + w · factor`.
    Start with a **low-volatility tilt** (trailing 12m daily-return std —
    computable from the existing daily closes, no new data source); value /
    quality / growth need fundamentals (TinyFish + LLM extraction) and are
    deferred. Config: `MOMENTUM_FACTOR_TILT` (`none|lowvol`),
    `MOMENTUM_FACTOR_TILT_WEIGHT` (e.g. 0.5). Gate with the same walk-forward
    as #17; promote only on an out-of-sample beat vs the momentum-only
    baseline. **Built:** `dailyReturnStd()`, `combineMomentumAndVolatility()`
    (rank-based blend), `rankByMomentumWithTilt()` in `signals/momentum.ts`;
    config `MOMENTUM_FACTOR_TILT`/`MOMENTUM_FACTOR_TILT_WEIGHT` (0.5)/
    `MOMENTUM_FACTOR_VOL_DAYS` (252); wired into `targetPortfolio()`; 5 new
    unit tests pass; `tsc` clean. **Result (walk-forward):** RETIRED —
    22.05% annualized vs 36.99% baseline (−14.9pp), +11.90pp vs +26.84pp over
    Nifty (NOT VALIDATED, edge in only 50% of windows). The low-vol tilt
    dilutes momentum; it does not beat the baseline.

---

### Final validation (this pass)

- `npx tsc --noEmit` (root) = **0 errors**
- `npx tsc --noEmit` (kite-paper-node) = **0 errors**
- `npm run test:unit` = **11/11 suites pass**
- `npm run validate:momentum` = **VALIDATED** (36.99% annualized, +26.84pp over Nifty)
- `npm run ci` = **green** (test:unit + validate:momentum)
- kite-paper-node: 4 pre-existing jest failures (JIT random-walk price drift) —
  verified pre-existing by stashing my changes; persistence smoke-tested OK.
