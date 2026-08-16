# Plan — Super Bot: Full Vision Integration

> **Purpose.** The momentum edge is built and validated. This plan closes the gap
> between the current code (~80% infrastructure) and the user's full vision: a
> **News + AI driven daily cycle** where the 3-stage reports and LLM advisor
> **actually drive the algo's trading decisions**, blended with the momentum
> strategy. It also adds the missing data/features and live-trading readiness.
>
> **Guiding principle:** the reports must *feed* the algo, not just be generated.
> The core of this plan is the **integration layer** (Phase A).

---

## Status legend
- `[ ]` not started · `[~]` in progress · `[x]` done

---

## Phase A — The Integration Layer (THE core of the vision)

> This is the single most important gap: reports are generated but the momentum
> strategy ignores them. These pieces make the reports and LLM advisor actually
> drive trading.

**A1. Report → entry decision** `[x]`
- The 9 AM report's `action_bias` (CONSIDER_LONG / AVOID) and `stocks_to_watch`
  gate the momentum entries (a real input, not just a soft veto).
- Files: `MomentumStrategy.ts`, `DailyReportEngine.ts`.

**A2. Report → sizing** `[x]`
- The LLM's `suggested_quantity` / `suggested_allocation_inr` tilt the position
  size, clamped by the RiskEngine caps.
- Files: `MomentumStrategy.ts`, `RiskEngine.ts`.

**A3. 11 AM report → intraday adjustment** `[x]`
- The mid-day report's "hold / sell / buy more" triggers position adjustments
  intraday.
- Files: `MomentumStrategy.ts`, `AgentsRuntime.ts`.

**A4. 3:15 PM report → rebalancing** `[x]`
- The EOD report's rebalancing recommendation drives the next day's rebalance.
- Files: `MomentumStrategy.ts`, `EodEngine.ts`.

**A5. Report → RiskEngine posture** `[x]`
- The report's overall market sentiment / major events set a risk posture
  (tighten caps, go risk-off) that the RiskEngine enforces.
- Files: `RiskEngine.ts`, `DailyReportEngine.ts`.

**A6. News filter → momentum (full integration)** `[x]`
- The news-risk filter (entry veto + exit trigger) is fully wired and validated.
- Files: `MomentumStrategy.ts`, `index.ts`.

**A7. LLM advisor → capital-aware sizing** `[x]`
- The advisor's diversification + capital-free guidance feeds actual sizing.
- Files: `MomentumStrategy.ts`, `DailyReportEngine.ts`.

---

## Phase B — Missing Data & Market Context

**B1. Economic calendar (live feed)** `[x]` — `LiveDataService` reads
`kite-paper-node/data/economic_calendar.json`; wired into the EOD overnight
matrix.
**B2. Corporate actions** `[x]` — `LiveDataService` reads
`kite-paper-node/data/corporate_actions.json`; momentum skips entries with
upcoming earnings.
**B3. Index data** `[x]` — Bank Nifty added to `GlobalMacro`.
**B4. India VIX** `[x]` — added to `GlobalMacro` (risk-off signal).
**B5. FII/DII flows** `[x]` — `LiveDataService` reads
`kite-paper-node/data/fii_dii.json`; wired into the report.
**B6. Market breadth (price-based)** `[x]` — `MarketBreadth.ts` (advance/decline,
new highs/lows), wired into the report.

> **Live provider:** kite-paper-node is treated as the live data source for
> market data (Kite API/MCP shape unchanged). The **static reference datasets**
> (economic calendar, corporate actions, FII/DII, sectors, index constituents)
> live in the **parent project's `data/`** — NOT kite-paper-node — because
> Zerodha Kite does not provide them in live trading. They are generated for the
> full financial year (Apr–Mar) by `scripts/generate_market_data.ts` and read by
> `LiveDataService` (default `data/`).

---

## Phase C — Additional Technical Analysis

**C1. MACD, Stochastic, VWAP, Volume Profile** `[x]` — added to
`TechnicalIndicators.ts` (unit-tested).
**C2. More candlestick patterns** `[x]` — doji, hammer, shooting star, engulfing.
**C3. Gap analysis** `[x]` — `detectGap`.
**C4. Event detection** `[x]` — `EventDetector.ts` (RBI/Fed/budget/regulatory/
earnings/geopolitical), wired into the report.

---

## Phase D — Portfolio & Risk Enhancements

**D1. Report-driven rebalancing** `[x]` — via A4 (`applyReportAdjustments` at
3:15 PM).
**D2. Diversification engine** `[x]` — sector-diversified top-N in
`MomentumStrategy.diversify`. Sectors are attached to every watchlist entry at
config-load time from `data/sectors.json` (`enrichSectors` in `AppConfig.ts`),
so both the diversification engine and the RiskEngine sector cap see them.
All 214 enabled symbols are mapped.
**D3. Risk-off / market-neutral mode** `[x]` — **resolved as WON'T DO, with
rationale.** Two findings closed this out:
1. *Shorting is not available.* The bot trades NSE equity delivery (CNC).
   Delivery cannot be sold short; intraday (MIS) shorting would mean abandoning
   the monthly-rebalance holding period the edge was validated on. A
   market-neutral book is therefore not implementable within the stated scope
   ("equity only, no options/futures").
2. *Binary risk-off measurably hurt.* `MOMENTUM_RISK_OFF` (go to cash when
   median momentum is negative) was implemented and measured: it cut returns
   from 8.0% → 7.4% by missing recoveries. It is retained but **off by
   default**, and documented as such in `.env.example`.

Defensive de-risking is instead handled by mechanisms that *were* validated or
are evidence-driven: the A5 report posture (bearish regime halves single-stock
sizing and raises the cash reserve), the portfolio/monthly drawdown guards, and
the F2 adaptation multiplier.

---

## Phase E — Live Trading Readiness `[x]`

> Migration `V012__live_readiness.sql`. Covered by `npm run test:live`
> (37 assertions, all passing). **Every default is the safe one — the bot
> remains paper-only until two separate switches are thrown.**

**E1. Order idempotency** `[x]` — `OrderGuard.ts` + `order_intents` table.
- A trade intent is fingerprinted as `sha1(symbol|exchange|side|intent|bucket)`
  and **claimed atomically before execution** (`INSERT ... ON CONFLICT DO
  NOTHING`). Claiming before, not after, is what makes a mid-flight restart safe.
- Quantity is deliberately excluded from the key so a retry that re-sizes
  slightly is still recognised as the same intent.
- `bucket` scopes the key: daily for rebalances, hourly for the 9/11/15:15
  report windows, so a genuinely new decision is never mistaken for a duplicate.
- A failed execution `ABANDON`s the claim so a legitimate retry can proceed —
  a stuck claim would silently block the trade for the rest of the bucket.

**E2. Broker reconciliation** `[x]` — `Reconciler.ts` + `reconciliation_log`.
- Compares ledger open positions against broker holdings + net positions, in
  both directions: `MISSING_AT_BROKER`, `MISSING_IN_LEDGER` (catches manual
  trades in the Kite app), `QUANTITY_MISMATCH`, `PRICE_DRIFT` (>5%, catches
  corporate actions and partial fills).
- **Reports, never auto-corrects.** Silently rewriting the ledger to match the
  broker would erase the evidence needed to find the bug that caused the drift.
- A drifted book blocks new orders (`HALT_ON_DRIFT`, default on). An
  *unreachable* broker is `inconclusive` and does **not** halt — a transient
  network blip must not take the bot offline.
- Runs every `RECONCILE_INTERVAL_MINUTES` (default 15), first pass scheduled
  before the first rebalance.

**E3. Live order gate** `[x]` — `LiveTrader.ts` + `BrokerAccount.ts`.
- The **only** place in the codebase that can send a real order.
- The paper ledger stays the system of record in every mode; LiveTrader wraps
  PaperTrader and *additionally* forwards to the broker. Going live therefore
  changes exactly one thing (whether the broker call fires) rather than swapping
  in a parallel, less-tested execution path.
- Four gates, all must pass: `ALLOW_LIVE_ORDERS=true` (opt-in, default false) →
  `LIVE_SHADOW_MODE=false` (opt-out, default true) → reconciliation clean →
  notional ≤ `MAX_LIVE_ORDER_VALUE` (blast-radius cap independent of the
  RiskEngine, so a sizing bug cannot send a huge order).
- A failed live order is written to `reconciliation_log` as `ERROR`, so it
  surfaces on the next cycle instead of diverging silently.
- `BrokerAccount` is a deliberately narrow interface satisfied by both the real
  Kite SDK and `kite-paper-node`'s mock, so the same path runs in paper and live.

---

## Phase F — Feedback & Learning `[x]`

> Covered by `npm run test:feedback` (25 assertions, all passing).

**F1. Automatic re-optimization schedule** `[x]` — `StrategyOptimizer.ts`.
- **Walk-forward, not "pick the best."** The pre-existing
  `test/backtest/optimize_momentum.ts` swept `topN` over the whole history and
  kept the winner — in-sample fitting. Running *that* on a schedule would let
  the bot quietly overfit itself. The runtime optimizer instead selects on a
  24-month training window and scores out-of-sample on the following 3 months,
  rolling forward.
- Three fail-safe guardrails: ≥6 out-of-sample folds required; candidates
  clamped to the manually-validated range (3–8); a challenger must beat the
  incumbent by ≥2pp annualized or the change is rejected as noise (prevents
  parameter churn).
- **Only `topN` is auto-tuned.** The 12-month lookback / skip-1-month / monthly
  rebalance is the validated hypothesis, not a free parameter.
- Runs quarterly (re-selecting more often than the test window is long would
  just chase noise). A change is logged and notified, never silent.

**F2. Strategy adaptation** `[x]` — `StrategyAdaptation.ts`.
- **The constraint that shapes this:** a monthly rebalance holding ~4 names
  produces ~50 closed trades a year. That is far too few to re-derive an edge
  from outcomes; "learning" on 50 samples fits noise.
- So it does not touch the edge — it adapts **exposure**. It emits a single
  `riskMultiplier` ∈ [0.4, 1.0] that sizing multiplies in. Detecting "things are
  going badly" is a defensible use of a small sample; picking the best rule is
  not.
- Two triggers, the more defensive wins: negative expectancy (% of notional per
  trade, so large trades don't dominate small ones) and a ≥4 consecutive-loss
  streak. Requires ≥12 closed trades before acting at all.
- Can only ever **reduce** size relative to the configured caps, never raise it.
  Applied before the single-stock cap, which remains the final word.

---

## Phase G — The Agentic Reasoning Layer `[x]`

**Goal.** Make the agent fleet genuinely *orchestrate* the bot rather than run
alongside it, and settle — explicitly — who is allowed to originate a trade.

### The three gaps this phase closed

All three were verified in code before any change was made:

1. **There was no data bus.** `orchestrator.ts` resolved `deps` to decide
   *ordering* but never handed an agent its dependencies' output. Every
   downstream agent recomputed what its upstream had already produced —
   `sentiment`, `sector_rotation`, `market_breadth` and `strategist` each called
   `news.sentimentFor()` across the whole watchlist, **four times per pass**, and
   `market_breadth` was not actually derived from `sentiment` at all, merely
   ordered after it. The fleet was a dependency-ordered list of scripts.
2. **The LLM daily report never reached the fleet.** There were zero references
   to `getLatestReport` / `regime_score` / `action_bias` anywhere in
   `src/agents/`. The reasoning layer drove `MomentumStrategy` but was invisible
   to the agents that were supposed to reason.
3. **Two brains with different safety.** `MomentumStrategy` executed through
   `LiveTrader` (idempotency + live gate + drift halt); the agentic
   `strategist` → `execute` path called `PaperTrader` **directly**, inheriting
   none of it.

### G1 — Blackboard `[x]`

`src/agents/blackboard.ts`. A per-pass shared reasoning surface.

- The orchestrator publishes each agent's payload after it completes, **only when
  `status === "done"`**. A failed or skipped agent leaves its slot empty so
  downstream sees `null` and degrades, rather than trusting a half-built payload.
- Reads are total — `read()` returns `null`, never throws. An agent that cannot
  degrade takes down the pass.
- Typed accessors (`sentiment()`, `breadth()`, `rotation()`, `momentum()`,
  `report()`, `regime()`) encode payload shapes in one place, so a shape change
  breaks at compile time instead of silently returning `undefined` inside a
  scoring function.
- Fresh per pass. Stale reasoning is how a bot acts on a market that no longer
  exists.

`sector_rotation` and `market_breadth` now read D1's scores instead of
recomputing: **the news layer is queried exactly once per symbol per pass.**

### G2 — The report reaches the fleet `[x]`

New agent `daily_report_context` (C6) parses `ledger.getLatestReport()` into a
typed `ReportPayload` (regime score, per-symbol `action_bias`, suggested
allocation, cash reserve) and publishes it. `regime` (F1) then *synthesizes*
instead of restating that synthesis is "planned":

```
blended = 0.5 * regimeScore + 0.3 * breadth + 0.2 * avgSentiment
```

The LLM's considered view carries the most weight, breadth next, raw per-symbol
sentiment least.

### G3 — The authority model: momentum originates, AI filters `[x]`

This was the open design question, and it is now **locked**.

| | Momentum | AI layer |
| --- | --- | --- |
| Propose a symbol | sole originator | never |
| Veto a candidate | — | yes |
| Shrink size | — | yes (tilt ≤ 1) |
| Enlarge size | — | no — hard-capped at 1 |
| Re-rank preference | — | yes |

**Why.** Being wrong costs very different amounts in each direction. A wrong
veto costs a missed winner — bounded, opportunity cost only. A wrong
*origination* costs real capital in a real position. The momentum edge is
walk-forward validated (+25.35% annualized, 215 OOS months). The AI composite is
not validated at all: its weights (`0.5·sent + 0.3·indicator + 0.2·regime`,
threshold `0.2`) are untested constants, and its technical leg (RSI 30/70 +
SMA20) belongs to the same hypothesis family that failed walk-forward at
**−33.5%**. So the unvalidated component is confined to making the cheap kind of
mistake.

**This is a rung, not a ceiling.** The composite still runs on every pass, and
everything it *would* have originated is written to `agent_proposals` as a
`SHADOW` row (migration `V013`) — recorded, never executed. At ~48 trades/year,
an honest shadow book is the only way to answer "does AI origination add alpha?"
If it earns its keep over 12–18 months, origination authority gets promoted on
evidence rather than on the assumption that "AI-backed" must mean "AI picks the
trades".

Concretely:
- `momentum_rank` (F0) publishes the ranking; `MomentumStrategy` caches it during
  `targetPortfolio()` so there is no second 400-day fetch per pass.
- `screener` (F2) shortlists **from the momentum ranking**. It used to take
  `watchlist.slice(0, 5)` — whichever symbols happened to be listed first,
  unrelated to any signal. Under a risk-off posture it narrows to names already
  in the target portfolio: tighten, don't reach.
- `strategist` (F4) applies vetoes (report `AVOID`/`EXIT_FULL`/`TRIM_*`, or
  sentiment < −0.4) and a shrink-only tilt.
- `execute` (F6) routes through `ctx.liveTrader` and **refuses any proposal whose
  `originator !== "MOMENTUM"`** at runtime, not just in the type system — that
  path spends real money.

### G4 — One sizing rule `[x]`

The strategist had its own `availableCapital / topN` formula, `MomentumStrategy`
had another, and they drifted. `MomentumStrategy.sizeFor()` is now the single
sizing implementation; the AI tilt is applied *after* it and can only shrink.

### Tests

`npm run test:agents` — **55 assertions** in `test/agents_blackboard_test.ts`,
wired into `test:unit`. Covers: blackboard mechanics and total reads; failed
upstream publishes nothing and downstream degrades; no cross-pass leakage; the
news layer is queried once per symbol; report parsing including malformed JSON;
screener sources from momentum; the strategist cannot originate a non-momentum
symbol; tilt shrinks but never upsizes; `execute` routes through `LiveTrader`,
is idempotent on replay, and refuses `AI_COMPOSITE`.

---

## Cross-cutting fixes made alongside E & F

- **Timer overflow — the monthly rebalance was firing ~1000x/second.**
  `setInterval(fn, 30 * 24 * 60 * 60 * 1000)` exceeds Node's 32-bit timer limit
  (2,147,483,647 ms ≈ 24.8 days), which Node silently clamps to **1 ms**. The
  only symptom was a `TimeoutOverflowWarning` on stderr. In practice the
  "monthly" momentum rebalance re-ran continuously, hammering the data provider.
  Fixed with `LongInterval.ts`, which chains bounded `setTimeout` chunks and
  adds a re-entrancy guard so a slow async task cannot stack up behind itself.
  Covered by six assertions in `test:live`.
- **Sector data wiring** — `data/sectors.json` is now attached to the watchlist
  at config load, activating D2 and the RiskEngine sector cap (both were silent
  no-ops because watchlist entries carried no `sector`).
- **Agent-fleet `maxRuns` bug** — `scheduleLoop` hard-coded `maxRuns = 10`, so
  with `AGENTS_ENABLED=true` the loop would stop after 10 passes with no error
  and no log line. Now defaults to unbounded, is overridable for bounded
  dry-runs, and logs when it does stop.
- **CI gate** — `npm run ci` = typecheck → unit tests → backtest path →
  `validate:momentum`. Individual gates: `test:momentum`, `test:risk`,
  `test:indicators`, `test:live`, `test:feedback`.
- **`.env.example`** — documents the momentum knobs, the hard risk caps, and the
  full Phase E safety block with the reasoning behind each default.

---

## Sequencing

```
A (integration) ──► B (data) ──► C (technicals) ──► D (portfolio/risk)
                                                          │
E (live readiness) ──► F (feedback/learning) ◄───────────┘
        │
        └──► G (agentic reasoning layer)
```

**Hard rule:** Phase A is the priority — it's what makes the bot match the
vision. Do A first, then B–G.

### The decision path, as built

```
A–E agents + momentum_rank + daily_report_context
                    │
                    ▼
              BLACKBOARD  (per-pass shared reasoning surface)
                    │
                    ▼
         regime → screener → strategist
         AI may veto / shrink / re-rank — never originate
                    │
                    ▼
              RISK ENGINE   ◄─ the single arbiter, unchanged
                    │
                    ▼
              LIVE TRADER   ◄─ idempotency, live gate, drift halt
                    │
                    ▼
              Broker / Paper
```

---

## Status: PLAN COMPLETE

All phases A–G are implemented and validated.

### Validation at completion

| Gate | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run test:unit` (momentum, risk, indicators, live, feedback, agents) | pass |
| `npm run test:backtest` | pass |
| `npm run validate:momentum` | **VALIDATED** — 215 OOS months, 43 windows, **+25.35% annualized net**, 57% positive months, 60% positive windows |

`npm run validate:strategy` still reports NOT VALIDATED. That is **expected and
correct**: it exercises the legacy `MarketAgent` strategy modes, which are no
longer the origination path. `validate:momentum` is the real gate.

### Standing caveats (unchanged, and worth restating)

- **Survivorship bias.** The universe is current-listed NSE symbols only, so
  +25.35% is optimistic. The news/AI layer is the intended mitigation for names
  that fall out.
- **`validate:momentum` measures the signal, not the deployed book.** End-to-end
  through the RiskEngine + PaperTrader with the 15%/20% caps, the same period
  returns ~+8% annualized. That lower number is the realistic expectation.
- **The ₹5k → ₹1L/month-in-a-year goal remains mathematically infeasible**
  (~58%/month compounding). The documented realistic path is 4–5 years.
- **AI origination is unproven, by design.** The shadow book in
  `agent_proposals` is the evidence base. Do not promote it without 12–18 months
  of shadow results.

### Action required before live: check your caps

Startup now warns when the risk caps bind below the strategy's equal-weight
slice. With the shipped `.env` (`AVAILABLE_CAPITAL=500000`,
`MAX_TRADE_ALLOCATION=20000`, `MAX_SINGLE_STOCK_PCT=15`, `MOMENTUM_TOP_N=4`) the
per-trade cap binds at ₹20,000 against a ₹100,000 target slice — so at most
**16% of capital can ever be deployed**. That is a legitimate choice, but it
should be a deliberate one. Raise `MAX_TRADE_ALLOCATION` to ~₹75,000 to let the
single-stock cap be the binding constraint instead.

### Known follow-ups (not blockers)

- Regenerate `data/*.json` when the financial year rolls over
  (`npx ts-node scripts/generate_market_data.ts`).
- `validator` (F3) is still a stub — the one stub left in the 41-agent fleet.
  It is the natural home for an LLM-hypothesize / code-verify step.
- Before any real money: run in `SHADOW` mode (`ALLOW_LIVE_ORDERS=true`,
  `LIVE_SHADOW_MODE=true`) for a full cycle and confirm the logged broker
  payloads and reconciliation are clean.
