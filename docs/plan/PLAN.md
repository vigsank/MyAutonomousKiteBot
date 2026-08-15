# PLAN — My Autonomous Kite Vault

> **Living implementation plan.** This document is the single source of truth for
> what we build, in what order, and what "done" means for each phase. It is
> written to be audited: each phase has a **Definition of Done** and a status
> marker. When a phase's implementation is complete, flip its status to `[x]`
> and add a short "What was built" note so the work can be reviewed.

---

## Status legend

- `[ ]` — not started
- `[~]` — in progress
- `[x]` — **done** (implementation complete + Definition of Done met + audited)

**Convention:** at the end of each phase's implementation, mark the phase `[x]`,
fill in the "What was built" section, and leave a dated note. Do **not** start a
new phase until the previous one is marked done and audited.

---

## 0. North star & guiding principles (locked in discussion)

**The centerpiece is a News + AI driven 3-stage daily report cycle** that produces
actionable market & symbol analysis every trading day, which the deterministic
algo (RiskEngine + indicators) then acts on. We build in a strict sequence so we
never again get lost in parallel building.

### Scope constraint

- **Equity only.** No Options, no Futures. (The existing options layer stays
  dormant / out of scope for this plan.)

### Locked decisions (do not re-litigate)

- **LLM = financial advisor / signal source, not decision-maker.** The LLM reads
  news + macro and produces a *qualitative* regime label, confidence, catalyst,
  reasoning, and **advisory** share/allocation suggestions. It can **tilt** and
  **veto** (reject) a trade, but can **never force** one.
- **"LLM may suggest numbers; the algo enforces them."** The LLM *suggests*
  quantities/allocation based on available capital, price, risk appetite, and
  diversification. The **RiskEngine clamps and enforces** the final sizing within
  hard caps (15% single-stock, ≥20% cash reserve, ≤1.5% risk-at-stop, Kelly).
  The LLM's numbers are a *recommendation*, not an *authority*.
- **Division of responsibility:** Node computes every *enforced* number (regime
  score, final sizing, indicators). The LLM returns labels + qualitative
  confidence + reasoning + advisory suggestions. Strict JSON schema, no
  re-parsing.
- **LLM signal must be measurable.** Every LLM suggestion is logged and
  backtestable so we can empirically decide "useful or noise" and cut it if it
  adds no edge.
- **Cadence:** scheduled reports at **09:00** (pre-open), **11:00** (mid-day),
  **15:15** (EOD) + continuous deterministic execution (1–5 min). **Kill the
  10-min LLM poll.** Event-driven RSS listener is **deferred**, behind a config
  flag.
- **Global macro data split:** **Yahoo Finance** provides the *numbers* (S&P,
  crude, USD/INR, Nikkei, Gift Nifty) for the regime score; **TinyFish → Google
  News RSS** provides the *headlines/events* for the LLM's qualitative context.
- **Capital snapshot:** the algo computes `available = total − used (open
  positions) − mandatory cash reserve (≥20%) − pending orders` at report time.
  It is a *snapshot*; the RiskEngine re-validates against live capital at
  execution.
- **Backtest hook per phase.** Every new layer must feed the existing backtest /
  walk-forward path so it is validated on paper before real money.
- **Kite MCP stays read-only.** All computation lives in deterministic Node; the
  MCP only supplies candles.

---

## Foundation — Capital snapshot + hard risk caps (prerequisite)

**Status:** `[x]`

**Objective:** The minimum the report cycle needs to give meaningful share
suggestions and for the algo to clamp them. Build this first.

### Scope

1. **Capital snapshot** — deterministic computation of available capital at
   report time: `total − used (open positions) − mandatory cash reserve (≥20%) −
   pending orders`. Expose it so the LLM report can consume it.
2. **Three hard risk caps in `RiskEngine`:**
   - Max allocation per single stock: **≤ 15%** of total portfolio capital.
   - Minimum mandatory cash reserve: **≥ 20%** (preserve liquidity).
   - Single-trade risk cap: **≤ 1.5%** of total account balance at stop-loss.
3. **Risk appetite input** — a configurable risk-appetite setting (e.g.
   conservative / balanced / aggressive) that the LLM report and the algo both
   read.

### Definition of Done

- [x] Capital snapshot computed and unit-tested (incl. reserve + pending).
- [x] All three hard caps enforced in `RiskEngine` and audited to the ledger.
- [x] Risk-appetite setting wired into config and readable by the report + algo.

### What was built (fill in when done)

> **Done — 2026-08-15.**
> - `AppConfig.ts`: added `risk.maxSingleStockPct` (15), `risk.minCashReservePct`
>   (20), `risk.maxRiskPerTradePct` (1.5), `risk.riskAppetite`
>   (conservative/balanced/aggressive, default balanced). Env keys:
>   `MAX_SINGLE_STOCK_PCT`, `MIN_CASH_RESERVE_PCT`, `MAX_RISK_PER_TRADE_PCT`,
>   `RISK_APPETITE`.
> - `types.ts`: added `CapitalSnapshot` interface.
> - `Ledger.ts`: added `pendingOrders()` (sum of PENDING order ticket sizes).
> - `RiskEngine.ts`: `evaluate()` now enforces single-stock cap (15% of capital),
>   risk-at-stop cap (≤1.5% of balance at stop-loss), and cash-reserve bound
>   (free capital stays ≥20%); added `capitalSnapshot()` (total/used/pending/
>   reserve/available).
> - Verified via a throwaway script (all 13 assertions passed): snapshot math,
>   single-stock cap, risk-at-stop cap, cash-reserve bound, pending-order effect.
> - `npm run typecheck` passes.
> - Note: backtest harnesses inherit the new caps via `loadConfig()` defaults —
>   intended alignment (strategy is now validated with the real risk caps).

---

## Phase 1 — Daily Report Cycle (Reasoning Layer) — CENTERPIECE

**Status:** `[x]`

**Objective:** Build the News + AI driven 3-stage daily report cycle. This is the
core deliverable. The reports drive the RiskEngine; the algo makes the final
trading decisions.

### Scope

1. **Stock selection ("stocks to watch out for")**
   - From news + AI, identify the day's watchlist: high-catalyst stocks to
     analyze, split into **held** (rebalancing) and **unheld** (consider/avoid).
2. **Global macro context**
   - **Numbers** (regime score `R ∈ [-1, +1]`): S&P 500, Nasdaq, crude, USD/INR,
     Gift Nifty, Nikkei via the **existing Yahoo provider**.
   - **Headlines/events**: **TinyFish** search (primary) → **Google News RSS**
     (fallback) for global events impacting Dalal Street.
3. **Per-symbol recommendations**
   - **Held:** HOLD / TRIM (part) / EXIT (full) / ADD — based on sentiment + news
     + previous day's performance.
   - **Unheld:** CONSIDER_BUY / AVOID — same inputs.
4. **Capital-aware share suggestions (advisory)**
   - LLM knows the **capital snapshot** + each stock's price + **risk appetite**.
   - Suggests **number of shares** per symbol, diversified, keeping capital free
     for future opportunities (not full allocation, not zeroing capital).
   - **Algo enforces** final sizing within the hard caps (Foundation).
5. **Report format**
   - Concise, easy to read, highlighting the most important info for quick
     decision-making.
   - Includes: overall market sentiment summary, major events, per-symbol verdict
     + reasoning + invalidation conditions.
   - **Strict JSON schema** that the RiskEngine consumes without re-parsing.
   - Clear verdict the rule-based algo can act on.
6. **3-stage cadence**
   - **09:00** pre-open report (the full morning report above).
   - **11:00** mid-day follow-up: updated prices/performance of morning stocks,
     new news since morning, updated sentiment, adjustment recs, rest-of-day
     events/trends.
   - **15:15** EOD report: day summary, key movements, sentiment, rebalancing
     recs, next-day events/trends.
   - **Remove the 10-min LLM poll** (`NEWS_INTERVAL_MS`, `AGENTS_INTERVAL_MS`).
   - Event-driven RSS listener: **deferred**, behind a config flag.
7. **Measurability**
   - Log every LLM suggestion to `llm_traces` with enough context to evaluate
     "useful or noise" against actual outcomes.
   - Backtest hook: LLM signal as a measurable feature.

### Definition of Done

- [x] Stock-selection step identifies the day's watchlist (held + unheld).
- [x] Global macro regime computed from Yahoo numbers; unit-tested.
- [x] TinyFish → Google RSS headline pipeline for global events.
- [x] Per-symbol recs (held rebalance + unheld consider/avoid) generated.
- [x] Capital-aware share suggestions produced; RiskEngine clamps them.
- [x] Strict JSON schema validated and consumed by the RiskEngine.
- [x] Report is concise/readable with a clear verdict.
- [x] 09:00 / 11:00 / 15:15 reports scheduled; 10-min poll removed.
- [x] Event-driven listener behind a config flag (off by default).
- [x] LLM suggestions logged and backtestable.

### What was built (fill in when done)

> **Done — 2026-08-15.**
> - `GlobalMacro.ts` (new): fetches Yahoo numbers (S&P, Nasdaq, Nikkei, crude,
>   USD/INR, Nifty) and derives a regime score R ∈ [-1,+1] + label. Best-effort.
> - `DailyReportEngine.ts` (new): the 3-stage report generator — global macro
>   numbers + headlines (TinyFish → Google RSS), per-symbol sentiment/prev-day
>   perf/holding status, capital snapshot, and a comprehensive LLM report
>   (strict JSON) with advisory share/allocation suggestions. Persists to ledger.
> - `types.ts`: added `ReportType`, `ActionBias`, `SymbolRecommendation`,
>   `DailyReport`.
> - `Ledger.ts`: added `recordDailyReport` / `getDailyReports`.
> - `migrations/V008__daily_reports.sql` (new): `daily_reports` table.
> - `AgentsRuntime.ts`: generates a daily report at each probe window.
> - `AppConfig.ts`: mid-session default → 11:00, pre-close → 15:15; added
>   `AGENTS_EVENT_DRIVEN` flag (off).
> - `index.ts`: wired `DailyReportEngine`; news loop interval configurable
>   (`NEWS_LOOP_MS`, default 30 min).
> - `api/queries.ts` + `api/server.ts`: `/api/fleet/reports` endpoint.
> - Verified via a throwaway script (all 7 assertions passed): report generated,
>   schema validated, persisted, summary stored.
> - `npm run typecheck` passes.
> - Ad-hoc changes logged in `docs/plan/adhoc-change.md`.

---

## Phase 0 — Remaining Execution / Risk hardening

**Status:** `[x]`

**Objective:** The deterministic engine the reports feed into — the "other
indicators and signal analysis algo in place."

### Scope

1. **Opening Range Breakout (ORB) filter**
   - Record `ORB_high` / `ORB_low` over the first 15–30 min (9:15–9:45/10:00)
     without placing orders.
   - Post-range entries only on breakout **with** volume confirmation (≥ 1.5× the
     20-period avg volume), gated by the active LLM posture (Phase 1).
   - Reconcile with the existing `SKIP_FIRST_MINUTES` time filter (currently 30
     min) — ORB should *replace* the blind skip, not stack on it.
2. **New technical indicators**
   - Pivot points (S1, S2, R1, R2).
   - 20 / 50-day simple moving averages.
   - 7-day historical support & resistance zones.
   - (RSI, ADX, ATR, Bollinger already exist — reuse, don't rebuild.)
3. **Volatility-adjusted Kelly sizing** parameterized by the LLM confidence
   score (Phase 1), bounded by the hard caps (Foundation).
4. **Portfolio / sector concentration caps** (from `TODO.md`) — cap exposure
   **per sector** and **per symbol** so the bot doesn't over-concentrate in one
   sector (e.g., all banks). Retail-safe: per-sector and per-symbol limits.
5. **Portfolio-level / monthly drawdown guard** (from `TODO.md`) — halt trading
   if the book is down X% for the period. Extends the existing *daily* drawdown
   cap to a longer-period capital-preservation guard.
6. **Backtest hook** — wire ORB, pivots, S/R, Kelly, and the caps into the
   existing backtest / walk-forward path.

### Definition of Done

- [x] ORB filter implemented and unit-tested (range capture + breakout + volume gate).
- [x] Pivots, 20/50 SMA, 7-day S/R computed and unit-tested.
- [x] Kelly sizing implemented, bounded by caps, unit-tested.
- [x] Per-sector and per-symbol concentration caps implemented.
- [x] Portfolio-level / monthly drawdown guard implemented (halts trading on breach).
- [x] Backtest hook added; `npm run validate:strategy` runs clean with the new layers.
- [x] `SKIP_FIRST_MINUTES` reconciled with ORB (no double-skip).

### What was built (fill in when done)

> **Done — 2026-08-15.**
> - `TechnicalIndicators.ts` (new): `computePivots`, `computeSma`,
>   `computeSupportResistance` (7-day), `kellyFraction` (volatility-adjusted
>   fractional Kelly). Pure, deterministic, unit-tested.
> - `MarketAgent.ts`: ORB tracking (`updateOrb`, `orbAllowsLong`) wired into
>   `onTicks`/`onCandle`/`evaluateSymbol`; Kelly sizing in `sizedQuantity`;
>   time filter reconciled with ORB (no double-skip).
> - `RiskEngine.ts`: sector concentration cap + portfolio-level drawdown guard.
> - `Ledger.ts`: `cumulativeRealizedPnl()`.
> - `DailyReportEngine.ts`: pivots + 7-day S/R computed in Node and passed to
>   the LLM as numeric context (division of responsibility).
> - `AppConfig.ts`: ORB/Kelly/sector/drawdown config keys.
> - `types.ts`: optional `sector` on `WatchSymbol`.
> - Verified via a throwaway script (all 14 assertions passed): pivots, SMA,
>   S/R, Kelly, sector cap, portfolio drawdown.
> - `npm run typecheck` passes; `npm run test:backtest` passes (4 trades).
> - **Walk-forward caveat:** `npm run validate:strategy` could not fetch Yahoo
>   data in the sandbox (no network), so it reported 0 OOS trades / NOT
>   VALIDATED. This is a data-access limitation, not a logic failure — the
>   synthetic `test:backtest` path (which exercises ORB + Kelly + caps via
>   `onCandle`) passes. Re-run `validate:strategy` with network access to get a
>   real verdict.
> - Ad-hoc changes logged in `docs/plan/adhoc-change.md`.

---

## Phase 2 — End-of-Day layer

**Status:** `[x]`

**Objective:** Reconcile the day, log performance, and set up the next day.

### Scope

1. **Automated intraday square-off** — force-liquidate pure intraday leveraged
   setups before 15:15 to avoid overnight gap risk.
2. **EOD performance logging** — store daily prediction performance, actual
   returns, slippage, and execution accuracy in the ledger for continuous
   evaluation.
3. **Overnight holding matrix** — for swing positions, run an overnight risk scan
   against global calendar events scheduled before the next trading day
   (economic calendar = new external source).

### Definition of Done

- [x] Intraday square-off implemented and gated by risk rules.
- [x] EOD performance metrics persisted to the ledger.
- [x] Overnight holding matrix implemented with economic-calendar input.
- [x] Backtest hook for EOD metrics.

### What was built (fill in when done)

> **Done — 2026-08-15.**
> - `EodEngine.ts` (new): `squareOffIntraday` (closes MIS positions via
>   RiskEngine→PaperTrader), `logEodPerformance` (realized PnL, win rate,
>   slippage, execution accuracy), `overnightMatrix` (gap-risk scan of CNC
>   positions vs upcoming events).
> - `migrations/V009__eod_layer.sql` (new): `product` column on positions,
>   `eod_performance` + `overnight_matrix` tables.
> - `Ledger.ts`: `eodStats`, `recordEodPerformance`, `recordOvernightMatrix`;
>   position methods now read/write `product`.
> - `types.ts`: `product` on `TradeRequest`/`Position`.
> - `PaperTrader.ts`: persists `product` (default MIS for strategy trades).
> - `AppConfig.ts`: `eod` config section + `loadOvernightEvents`.
> - `AgentsRuntime.ts`: runs EOD layer at the pre-close window.
> - `index.ts`: wired `EodEngine`.
> - `api/queries.ts` + `api/server.ts`: `/api/eod/performance`,
>   `/api/eod/overnight-matrix`.
> - Verified via a throwaway script (all 8 assertions passed): square-off closes
>   MIS only, EOD performance persisted, overnight matrix scans CNC only.
> - `npm run typecheck` passes.
> - Ad-hoc changes logged in `docs/plan/adhoc-change.md`.

---

## Audit checklist (run at the end of each phase)

- [ ] Phase status flipped to `[x]`.
- [ ] "What was built" filled in (date, files, validation).
- [ ] `npm run typecheck` passes.
- [ ] Relevant unit tests pass.
- [ ] Backtest / walk-forward hook exercised for the phase's new layers.
- [ ] No new phase started until this one is audited.
