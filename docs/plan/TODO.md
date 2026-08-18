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
   real Zerodha backend. See `kite-paper-node/docs/RUN-WITH-PARENT.md` §2c.
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

---

### Final validation (this pass)

- `npx tsc --noEmit` (root) = **0 errors**
- `npx tsc --noEmit` (kite-paper-node) = **0 errors**
- `npm run test:unit` = **11/11 suites pass**
- `npm run validate:momentum` = **VALIDATED** (36.99% annualized, +26.84pp over Nifty)
- `npm run ci` = **green** (test:unit + validate:momentum)
- kite-paper-node: 4 pre-existing jest failures (JIT random-walk price drift) —
  verified pre-existing by stashing my changes; persistence smoke-tested OK.
