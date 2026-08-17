# Backtesting & Optimization Guide

This document covers everything about **backtesting** and **parameter
optimization** in My Autonomous Kite Vault. All backtest tooling lives in
`test/backtest/` (kept out of `src/` so the source folder stays pure).

---

## 1. Overview

The tooling covers several families: the original mean-reversion/breakout/options
strategy backtests, a separate **momentum** research harness, simulations, live
pipeline tests, and diagnostics. `npm run *` scripts for the ones that ship a
convenience command:

| Tool | File | npm script | Purpose |
|------|------|-----------|---------|
| Backtest | `test/backtest/backtest.ts` | `npm run backtest` | Run the strategy on real historical candles, no real orders |
| Optimizer | `test/backtest/optimize.ts` | `npm run optimize` | Sweep parameters + multi-fold walk-forward validation (mean-reversion / breakout / options axes) |
| Momentum optimizer | `test/backtest/optimize_momentum.ts` | — | Sweep momentum parameters (topN × hysteresis band × cadence) |
| Run all modes | `test/backtest/run_all_modes.ts` | — | Run the optimizer across quick/mid/large/xl |
| Run all cases | `test/backtest/run_all_cases.ts` | — | Run a battery of backtest cases |
| Equity chart | `test/backtest/chart_equity.ts` | `npm run chart` | Render `data/equity_curves/equity_*.csv` to a self-contained HTML chart |
| Self-test | `test/backtest/test_backtest_path.ts` | `npm run test:backtest` | Verify the onCandle backtest path works |
| Simulate | `test/backtest/simulate.ts` | `npm run simulate` | Synthetic market simulation (quick sanity check) |
| A/B compare | `test/backtest/ab_compare.ts` | `npm run ab:compare` | Strategy edge vs equal-weight buy-and-hold, at large & real capital |
| Mock backtest | `test/backtest/mock_backtest.ts` | — | Deterministic (mock-candle) backtest |
| Daily-cycle sim | `test/backtest/daily_cycle_sim.ts` | — | Simulate the daily-cycle reporting flow |
| Strategy lab | `test/backtest/strategy_lab.ts` | — | Experimentation harness for strategy variants |
| 12m SIP sim | `test/backtest/sim_12m_sip.ts` | — | 12-month SIP / compounding simulation |
| Mock UI | `test/backtest/mock_ui.ts` | `npm run mock:ui` | Seed a throwaway ledger + boot the dashboard (see `docs/UI_DASHBOARD.md`) |
| Live pipeline test | `test/backtest/test_live_pipeline.ts` | — | Exercise the live data → signal → trade pipeline |
| Yahoo / OpenBB tests | `test/backtest/test_yahoo.ts`, `test/backtest/test_openbb.ts` | — | Smoke-test the historical data providers |
| Leak attribution | `test/backtest/leak_attribution.ts` | — | Attribute which leak is costing edge |
| Veto attribution | `test/backtest/veto_attribution.ts` | — | Measure how often LLM/AI vetoes reject winners |
| Survivorship-bias estimate | `test/backtest/survivorship_bias.ts` | — | Measure the survivorship/selection floor in the universe |
| Signal prototype | `test/backtest/signal_proto.ts` | — | Prototype signals against saved history |

### Momentum backtest harnesses

A parallel research track (`test/backtest/momentum_*.ts`) evaluates a **monthly
momentum / rebalancing** hypothesis distinct from the intraday mean-reversion
strategy. Files: `momentum_backtest.ts`, `momentum_strategy_backtest.ts`,
`momentum_news_backtest.ts`, `momentum_walk_forward.ts`, `momentum_live_pattern.ts`,
`momentum_proto.ts`. See the [Walk-forward / OOS](#walk-forward--out-of-sample-validation)
section for the honest status of these.

> **Important:** backtesting never places real orders. All execution is
> simulated via `PaperTrader` and persisted to an isolated SQLite database.

---

## 2. Data providers for backtesting

Backtests use the **`BACKTEST_PROVIDER`** (default `yahoo`, account-free).
Providers live in `src/server/providers/`:

| Provider | Account? | Class | Notes |
|----------|----------|-------|-------|
| `yahoo` (default) | ❌ none | `YahooFinanceProvider` | Free historical candles. Occasionally rate-limited; retries automatically. |
| `openbb` | ❌ none | `OpenBBProvider` | OpenBB local REST API (Python). Run `openbb-api` first. |
| `kite` | Zerodha | `KiteStreamer` | Real Kite history (needs credentials). |

```dotenv
BACKTEST_PROVIDER=yahoo
OPENBB_BASE_URL=http://127.0.0.1:6900   # only for openbb
```

> Yahoo coverage is spotty for some symbols (e.g. `TATAMOTORS` isn't on Yahoo).
> Use symbols Yahoo actually carries, or switch to `kite`.

---

## 3. Running a backtest

```bash
npm run backtest
# tune it:
BACKTEST_INTERVAL=15minute BACKTEST_DAYS=90 BACKTEST_CAPITAL=500000 npm run backtest
```

### Backtest env options

| Env | Default | Meaning |
|-----|---------|---------|
| `BACKTEST_INTERVAL` | `5minute` | Candle interval: minute/5minute/15minute/day |
| `BACKTEST_DAYS` | 60 | How far back to fetch |
| `BACKTEST_WARMUP_BARS` | 60 | Bars used for indicator warmup |
| `BACKTEST_CAPITAL` | 500000 | Virtual starting capital |
| `BACKTEST_MAX_ALLOCATION` | 20000 | Max notional per position |
| `BACKTEST_VOLUME_MULT` | 1.0 | Volume confirmation multiplier |

### Outputs
- **`data/backtest_report.csv`** — every trade (timestamp, symbol, direction,
  quantity, price, PnL, reason).
- **`data/backtest/ledger.db`** — isolated SQLite DB with full trade history.
- Console summary: round trips, win rate, total P&L, return %, max drawdown,
  approx Sharpe.

---

## 4. Parameter optimization

The optimizer (`test/backtest/optimize.ts`) sweeps a grid of strategy parameters
and validates each combo across **multiple walk-forward windows** (guards against
overfitting).

```bash
npm run optimize -- --mid
```

### Sweep modes

| Mode | Grid size (mean-reversion) | Use for |
|------|-----------|---------|
| `--quick` | 1 combo | Sanity check / baseline |
| `--mid` | 243 combos | Reasonable exploration |
| `--large` (default) | 900 combos | Thorough search |
| `--xl` | 6300 combos | Exhaustive (very slow) |

You can also set `OPT_MODE=mid` instead of the CLI flag. The active grid is
selected by **strategy mode**: set `STRATEGY_MODE=mean_reversion` (default),
`STRATEGY_MODE=breakout`, and/or `OPTIONS_ENABLED=true` to sweep the matching
axis family.

### Grid axes (mean-reversion — override any with `OPT_*`)

| Axis | Env | `--mid` | `--large` | `--xl` |
|------|-----|---------|-----------|--------|
| RSI entry | `OPT_RSI_ENTRY` | 25,30,35 | 25,28,30,32,35 | 20,25,28,30,32,35 |
| RSI exit | `OPT_RSI_EXIT` | 65,70,75 | 65,68,70,72,75 | 60,65,68,70,72,75,80 |
| ATR mult | `OPT_ATR_MULT` | 1.5,2,2.5 | 1.5,2,2.5,3 | 1,1.5,2,2.5,3,3.5 |
| ADX | `OPT_ADX` | 20,25,30 | 20,25,30 | 15,20,25,30,35 |
| Stop loss | `OPT_STOP_LOSS` | 3,4,5 | 3,4,5 | 2,3,4,5,6 |

### Grid axes (breakout & options)

When `STRATEGY_MODE=breakout`:

| Axis | Env | `--mid` | `--large` | `--xl` |
|------|-----|---------|-----------|--------|
| Breakout lookback | `OPT_BREAKOUT_LOOKBACK` | 10,20,30 | 10,15,20,25,30 | 5,10,15,20,25,30 |
| Trail ATR mult | `OPT_BREAKOUT_TRAIL_ATR_MULT` | 1.5,2,2.5 | 1.5,2,2.5,3 | 1,1.5,2,2.5,3,3.5 |

When `OPTIONS_ENABLED=true`:

| Axis | Env | `--mid` | `--large` | `--xl` |
|------|-----|---------|-----------|--------|
| Option premium cap | `OPT_OPTION_PREMIUM_CAP` | 2000,5000,10000 | 2000,5000,10000,15000 | 1000,2000,5000,10000,15000 |
| Strike offset | `OPT_OPTION_STRIKE_OFFSET` | 0,2,5 | 0,2,5,8 | 0,2,5,8,10 |
| Expiry (days) | `OPT_OPTION_EXPIRY` | 15,30,60 | 15,30,45,60 | 7,15,30,45,60 |

### Other optimizer env

| Env | Default | Meaning |
|-----|---------|---------|
| `OPT_DAYS` | 120 | History window |
| `OPT_INTERVAL` | `5minute` | Candle interval |
| `OPT_CAPITAL` | 500000 | Virtual capital |
| `OPT_FOLDS` | 4 | Walk-forward windows |
| `OPT_TOP` | 5 | Equity-curve CSVs to write |

### Outputs
- **`data/optimization_report.csv`** — one row per combo with per-fold P&L.
- **`data/equity_curves/equity_<params>.csv`** — cumulative P&L over time for
  the top combos (chart these with `npm run chart`).
- Console table with `✓ ALL` marking combos profitable in **every** fold.

---

## 5. Running all modes

```bash
npx ts-node test/backtest/run_all_modes.ts
# or:
MODES="quick,mid,large" OPT_DAYS=60 npx ts-node test/backtest/run_all_modes.ts
```

This runs the optimizer for each selected mode and saves
`data/optimization_<mode>.csv`. **Avoid `xl` in this batch** (6300 combos is
very slow) — run it separately.

---

## 6. Rigorous workflow (avoid overfitting)

1. **Sanity check** — `npm run optimize -- --quick` (or `--mid`) with
   `OPT_DAYS=60`.
2. **Widen one axis at a time** — compare `optimization_report.csv` to see
   which parameter actually matters.
3. **Full sweep** — `npm run optimize -- --large` (or `--xl`).
4. **Pick robust combos** — prefer `✓ ALL` (positive in every fold) over the
   single highest-return combo.
5. **Validate on held-out data** — take the winner and run
   `npm run backtest` on a **different period** you did not optimize on. If it
   is still positive, it is likely real; if not, it was overfit.

---

## 7. Data artifacts (`data/`)

Optimization & backtest outputs land in `data/`:

- `optimization_quick.csv`, `optimization_mid.csv`, `optimization_large.csv` —
  per-mode optimizer reports.
- `optimization_report.csv` — most recent optimizer run.
- `backtest_report.csv` — most recent backtest trades.
- `equity_curves/` — per-combo equity curves from `OPT_TOP`.
- `simulation_pnl.csv` — P&L from `npm run simulate`.
- `ledger.db` — the live/paper SQLite ledger (never touched by backtests, which
  write to `data/backtest/ledger.db`).

Reference data (cached/seed inputs, not outputs): `watchlist.json` (214 symbols),
`watchlist_volatile.json` (20 symbols), `sectors.json`, `index_constituents.json`,
`fii_dii.json`, `economic_calendar.json`, `corporate_actions.json`.

---

## 8. Caveats & honesty

- **Backtest ≠ future profit.** Past performance does not guarantee results.
- **Yahoo data** is delayed and coverage is incomplete; intraday history is
  limited (~60 days for 5-min).
- **Optimization can overfit.** The walk-forward check reduces but does not
  eliminate this. Always validate on unseen data.
- **The intraday strategy is one family** (RSI + ADX + ATR, plus breakout /
  options variants). It is a solid v1, not a guaranteed edge.
- **No real orders** are ever placed by any of these tools.

---

## Walk-forward / out-of-sample validation

A single in-sample backtest proves nothing. There are two walk-forward
harnesses in `test/backtest/`, and they are **not** interchangeable.

### `npm run validate:strategy` — the legacy RSI walk-forward (OLD)

`test/backtest/walk_forward.ts` runs the **live signal engine** (`MarketAgent`) on
rolling out-of-sample folds, **net of costs** (the paper cost model), and prints
a blunt `VALIDATED` / `NOT VALIDATED` verdict. **This is the OLD RSI-based
walk-forward.**

```bash
npm run validate:strategy
# tune it:
BACKTEST_INTERVAL=5minute BACKTEST_DAYS=90 BACKTEST_WARMUP_BARS=60 BACKTEST_FOLD_BARS=40 npm run validate:strategy
```

Methodology:
- A **fresh agent + ledger per fold**, warmed up only on bars *before* the fold
  (no look-ahead).
- Each fold is evaluated out-of-sample; realized fill PnL is collected net of
  slippage + charges.
- `VALIDATED` requires **≥ 30 OOS trades**, positive net expectancy AND return,
  and the edge present in **> 50% of folds** (not one lucky window).
- The live LLM analyst is **disabled** during validation so it measures the code
  strategy edge, not live LLM judgment.

> The default intraday strategy may produce few/zero trades on **daily** bars —
> validate on the interval the strategy actually trades. And a green verdict is
> **necessary, not sufficient**: the universe is current-listed names only
> (survivorship bias), and historical bars can't capture gaps, circuit limits, or
> thin liquidity.

### `momentum_walk_forward.ts` — the momentum OOS walk-forward (the plan's gate)

`test/backtest/momentum_walk_forward.ts` is a **different** OOS harness for the
monthly-momentum hypothesis. It ranks the watchlist on a trailing lookback,
rebalances on a cadence with a hysteresis band, and compares net returns to the
**Nifty 50** over the same months, printing an annualized excess and a
`VALIDATED` / `NOT VALIDATED` verdict.

The profitability plan (`docs/plan/`) reports this gate as **VALIDATED — 36.99%
annualized, +26.84pp over Nifty**, and the older vision plan reported a
smaller-window **+25.35% annualized, 215 OOS months**.

**Honest status (verify before relying on it):**
- The momentum backtest harnesses **exist** and the plan documents a validated
  edge, but the momentum/live engine (`src/server/MomentumStrategy.ts`) **is not
  wired into `index.ts`** and **does not currently type-check cleanly** — the
  TypeScript compiler reports errors against the current `AppConfig` / `Ledger`
  surface (e.g. `getStrategyParam`, `momentumTopN`, `momentumLookbackMonths`,
  `newsVetoThreshold`, `minCapital`, `eventBlackoutTypes`).
- There is **no `npm run validate:momentum` script** in `package.json`, so you
  must run the harness directly:
  ```bash
  npx ts-node test/backtest/momentum_walk_forward.ts
  ```
- Several npm scripts referenced by `docs/plan` are **absent** from the current
  `package.json`: `ci`, `validate:momentum`, `test:unit`, `test:momentum`,
  `score:shadow`, `status:golive`, `attribute:leaks`, `estimate:survivorship`.
  The functionality those plans describe (shadow scoring, go-live ladder,
  leak/survivorship estimation) is represented by source files, but the one-shot
  `npm run` entry points have not been (re)wired.
- The momentum harness itself prints a survivorship-bias floor reference that
  names `npm run estimate:survivorship` — that script does not exist; use
  `npx ts-node test/backtest/survivorship_bias.ts` directly.

Same survivorship caveat applies: the universe is current-listed names only.
