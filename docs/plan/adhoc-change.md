# Ad-hoc changes (beyond the plan)

> Log of **unplanned** changes made during implementation that were necessary or
> strongly advisable while building a phase. Each entry records what, why, and
> which phase it relates to. The user reviews these alongside the plan.

---

## Phase 1 — Daily Report Cycle

### 1. News loop interval made configurable (default 30 min, was 10 min)
- **What:** `index.ts` now reads `NEWS_LOOP_MS` from env, defaulting to 30 min
  instead of the hardcoded 10 min.
- **Why:** The plan says "kill the 10-min LLM poll." Fully removing the intraday
  sentiment refresh would strip the strategy's sentiment confirmation filter, so
  I reduced churn (10 → 30 min) rather than removing it outright. The 3-stage
  report cycle is now the primary LLM sentiment source; the intraday loop is a
  lighter refresh. Set `NEWS_LOOP_MS=0` to disable entirely if desired.

### 2. Event-driven listener config flag added (off by default)
- **What:** Added `AGENTS_EVENT_DRIVEN` (default `false`) to `agents` config.
- **Why:** The plan defers the event-driven RSS listener "behind a config flag
  (off by default)." The flag now exists as the placeholder; the listener itself
  is not built yet (still deferred).

### 3. `/api/fleet/reports` endpoint + `dailyReports` query
- **What:** Added a REST endpoint and query to read persisted daily reports.
- **Why:** Not strictly in the plan, but needed so the user can review the
  report cycle output in the dashboard / via API. Mirrors the existing
  `/api/fleet/probes` pattern.

### 4. `daily_reports` table (migration V008)
- **What:** New SQLite table to persist the 3-stage reports.
- **Why:** The plan requires reports to be persisted for audit; this is the
  concrete storage. (Implementation detail of the plan, listed here for
  completeness.)

---

## (end of Phase 1 ad-hoc entries)

---

## Phase 0 — Remaining Execution / Risk hardening

### 1. ORB replaces the blind skip-first-minutes when enabled
- **What:** When `ORB_ENABLED` (default true), the opening window is handled by
  the ORB gate (no orders during the range, breakout after) and the blind
  `SKIP_FIRST_MINUTES` skip is disabled to avoid double-skipping. When ORB is
  off, the old blind skip applies.
- **Why:** The plan says ORB should *replace* the blind skip, not stack on it.

### 2. Backtest harnesses now inherit ORB + Kelly + new risk caps
- **What:** The backtest/walk-forward scripts use `loadConfig()` defaults, so
  ORB, Kelly sizing, and the new caps (single-stock 15%, cash reserve 20%,
  risk-at-stop 1.5%, sector 30%, portfolio drawdown 10%) now apply in backtests.
- **Why:** Intended alignment — the strategy is validated with the real risk
  filters. **Caveat:** this may change backtest/walk-forward results vs before.
  Verified `npm run test:backtest` still passes (4 trades produced).

### 3. Optional `sector` field on `WatchSymbol`
- **What:** Added optional `sector` to the watchlist symbol type so sector
  concentration caps can be enforced. Only enforced when a symbol has a sector
  mapped in `data/watchlist.json`.
- **Why:** The ledger has no sector data; the watchlist is the natural place to
  declare it.

### 4. New config keys
- `ORB_ENABLED`, `ORB_MINUTES` (15), `ORB_VOLUME_MULTIPLIER` (1.5),
  `KELLY_ENABLED`, `KELLY_SCALE` (0.5), `MAX_SECTOR_WEIGHT_PCT` (30),
  `MAX_PORTFOLIO_DRAWDOWN_PCT` (10).

---

## (end of Phase 0 ad-hoc entries)

---

## Phase 2 — End-of-Day layer

### 1. `product` column on positions (migration V009)
- **What:** Added a `product` column (MIS = intraday, CNC = delivery/swing) to
  the positions table, plus `product` on `TradeRequest`/`Position`. `PaperTrader`
  defaults new strategy positions to MIS.
- **Why:** The square-off needs to distinguish intraday (force-liquidated at
  close) from swing (kept for the overnight matrix). The schema had no such
  marker.

### 2. `eod_performance` + `overnight_matrix` tables (migration V009)
- **What:** New tables to persist EOD performance metrics and the overnight
  holding matrix.
- **Why:** The plan requires EOD logging + overnight scan to be persisted for
  audit.

### 3. EOD config section
- **What:** Added `eod` config: `EOD_SQUARE_OFF_ENABLED`, `EOD_SQUARE_OFF_TIME`
  (15:15), `EOD_OVERNIGHT_GAP_RISK_PCT` (2), and upcoming events loaded from
  `data/overnight_events.json`.
- **Why:** The overnight matrix needs a global-calendar input; a configurable
  data file is the pragmatic source (no new external API dependency).

### 4. `/api/eod/performance` + `/api/eod/overnight-matrix` endpoints
- **What:** REST endpoints to review EOD output.
- **Why:** Needed for the user to audit the EOD layer (mirrors existing patterns).

---

## (end of Phase 2 ad-hoc entries)

---

# Audit Cycle 1 (2026-08-15)

Ran `audit:strategy` + `audit:profit` (rewritten to match the focus design).
Implemented the obvious fixes; logged the non-obvious ones.

## Implemented (obvious)

1. **ORB gate only for `breakout` mode** (`MarketAgent.ts`). The ORB breakout
   filter was blocking mean-reversion/pullback entries (which need price low,
   not breaking out). Now gated on `mode === 'breakout'`.
2. **`riskAtStop` uses the actual ATR stop distance** (`RiskEngine.ts`,
   `types.ts`, `MarketAgent.ts`). Added `stopDistance` to `TradeRequest`; the
   engine now uses it (falls back to `stopLossPercent`) and skips the check for
   closing trades (you must always be able to exit).
3. **Kelly sizing disabled by default** (`AppConfig.ts`). `KELLY_ENABLED` now
   defaults to `false` — the heuristic win-probability was statistically
   invalid. Fixed fractional sizing (`riskPerTradePercent`/stop) is used until
   a backtested win rate exists.
4. **`MAX_DAILY_DRAWDOWN` default 5000 → 15000** (3%). A single max-size loss
   no longer halts the day.
5. **Regime `trending_down` → stay flat** (`MarketAgent.ts`). No more catching
   falling knives.
6. **Volatility threshold 0.02 → 0.002** (`MarketAgent.ts`) for 1-min bars.
7. **Clamp advisory suggestions to available capital** (`DailyReportEngine.ts`)
   so the report is never misleading.
8. **Default product to CNC (swing holdings)** (`PaperTrader.ts`). Aligns with
   the user's "slow, accumulated holdings" goal — positions are held overnight
   instead of force-squared daily. The EOD square-off still works for any MIS
   positions.
9. **Monthly drawdown guard** (`AppConfig.ts`, `Ledger.ts`, `RiskEngine.ts`).
   New `MAX_MONTHLY_DRAWDOWN_PCT` (2%); `monthlyRealizedPnl()`; RiskEngine
   halts trading for the month on breach — protects month-end P&L.
10. **Ensemble consensus** (`DailyReportEngine.ts`). `mergeReports` averages
    allocations and takes the majority action bias instead of trusting the most
    verbose report.
11. **Connect LLM to execution** (`MarketAgent.ts`, `Ledger.ts`). MarketAgent
    now reads the latest daily report and vetoes entries for symbols marked
    AVOID / EXIT_FULL — the LLM is no longer "dead code".

## Logged (non-obvious, not implemented)

- **Global macro weights** (`GlobalMacro.ts`): 60% global / 25% Nifty may
  underweight domestic drivers. Rebalancing is a judgment call — left as-is.
- **Unrealized losses in daily drawdown** (`Ledger.ts`): `currentDrawdown`
  includes unrealized losses, so a temporary adverse excursion can block new
  entries. Separating realized vs unrealized is a design decision — left as-is.

---

# Audit Cycle 2 (2026-08-15)

Re-ran `audit:strategy` + `audit:profit` after cycle-1 fixes. Implemented the
obvious new findings; logged the non-obvious ones.

## Implemented (obvious)

1. **Volume sensing fixed** (`MarketAgent.ts`). `bar.volume = volume` (was
   `+=`) — `tick.volume_traded` is cumulative, so summing inflated it and
   destroyed volume confirmation / ORB validity.
2. **Mode-specific exits fixed** (`types.ts`, `Ledger.ts`, `PaperTrader.ts`,
   `MarketAgent.ts`, migration V010). Added `entryMode` to `Position`/
   `TradeRequest`; `checkExit` now uses `position.entryMode` instead of the
   static `cfg.mode`, so pullback/breakout trailing/trend-break exits actually
   fire in regime-adaptive mode.
3. **ORB daily reset** (`MarketAgent.ts`). Opening range high/low/established
   now reset at each new day so breakout detection doesn't leak across sessions.
4. **Kelly sizing on risk budget** (`MarketAgent.ts`). `kellyBudget / stopDist`
   (was `/ price`) — Kelly sizes risk, not notional.
5. **Daily metrics fixed** (`DailyReportEngine.ts`). `previousDayChange` and
   `pivotsFor` now aggregate intraday candles into daily OHLC and use the last
   COMPLETED day, so the LLM isn't fed 1-minute changes / incomplete pivots.
6. **Bollinger entries get safety filters** (`MarketAgent.ts`). Volume
   confirmation now applies to all entries; Bollinger uses a relaxed ADX limit
   so it doesn't catch falling knives.
7. **Breakeven persistence** (`MarketAgent.ts`). Breakeven state is tracked so a
   pullback after breakeven doesn't revert the stop to the original.
8. **Report-bias reload** (`MarketAgent.ts`). The Reasoning-Layer veto now
   reloads when a newer daily report exists (11:00/15:15 reports take effect).
9. **`skipFirstMinutes` applies to all modes** (`MarketAgent.ts`). Non-breakout
   entries no longer slip into the volatile opening minutes when ORB is on.

## Logged (non-obvious / tuning)

- **Volatile threshold** (`MarketAgent.ts`): cycle-1 audit said 0.02 was too
  high; cycle-2 said 0.002 was too sensitive. Set a middle value 0.005 (0.5%)
  for 1-min bars. This is a tuning parameter — revisit with backtest data.

---

# Audit Cycle 3 (not run — stopping per instructions)
