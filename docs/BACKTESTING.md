# Backtesting & Optimization Guide

This document covers everything about **backtesting** and **parameter
optimization** in My Autonomous Kite Vault. All backtest tooling lives in
`test/backtest/` (kept out of `src/` so the source folder stays pure).

---

## 1. Overview

| Tool | File | Purpose |
|------|------|---------|
| Backtest | `test/backtest/backtest.ts` | Run the strategy on real historical candles, no real orders |
| Optimizer | `test/backtest/optimize.ts` | Sweep parameters + multi-fold walk-forward validation |
| Simulate | `test/backtest/simulate.ts` | Synthetic market simulation (quick sanity check) |
| Run all modes | `test/backtest/run_all_modes.ts` | Run the optimizer across quick/mid/large/xl |
| Self-test | `test/backtest/test_backtest_path.ts` | Verify the onCandle backtest path works |

> **Important:** backtesting never places real orders. All execution is
> simulated via `PaperTrader` and persisted to an isolated SQLite database.

---

## 2. Data providers for backtesting

Backtests use the **`BACKTEST_PROVIDER`** (default `yahoo`, account-free):

| Provider | Account? | Notes |
|----------|----------|-------|
| `yahoo` (default) | ❌ none | Free historical candles. Occasionally rate-limited; retries automatically. |
| `openbb` | ❌ none | OpenBB local REST API (Python). Run `openbb-api` first. |
| `kite` | Zerodha | Real Kite history (needs credentials). |

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
| `BACKTEST_VOLUME_MULT` | 1.0 | Volume confirmation multiplier |

### Outputs
- **`data/backtest_report.csv`** — every trade (timestamp, symbol, direction,
  quantity, price, PnL, reason).
- **`data/backtest/ledger.db`** — isolated SQLite DB with full trade history.
- Console summary: round trips, win rate, total P&L, return %, max drawdown,
  approx Sharpe.

---

## 4. Parameter optimization

The optimizer sweeps a grid of strategy parameters and validates each combo
across **multiple walk-forward windows** (guards against overfitting).

```bash
npm run optimize -- --mid
```

### Sweep modes

| Mode | Grid size | Use for |
|------|-----------|---------|
| `--quick` | 1 combo | Sanity check / baseline |
| `--mid` | 243 combos | Reasonable exploration |
| `--large` (default) | 900 combos | Thorough search |
| `--xl` | 6300 combos | Exhaustive (very slow) |

You can also set `OPT_MODE=mid` instead of the CLI flag.

### Grid axes (override any with `OPT_*`)

| Axis | Env | `--mid` | `--large` | `--xl` |
|------|-----|---------|-----------|--------|
| RSI entry | `OPT_RSI_ENTRY` | 25,30,35 | 25,28,30,32,35 | 20,25,28,30,32,35 |
| RSI exit | `OPT_RSI_EXIT` | 65,70,75 | 65,68,70,72,75 | 60,65,68,70,72,75,80 |
| ATR mult | `OPT_ATR_MULT` | 1.5,2,2.5 | 1.5,2,2.5,3 | 1,1.5,2,2.5,3,3.5 |
| ADX | `OPT_ADX` | 20,25,30 | 20,25,30 | 15,20,25,30,35 |
| Stop loss | `OPT_STOP_LOSS` | 3,4,5 | 3,4,5 | 2,3,4,5,6 |

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
  the top combos (chart these).
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

## 7. Caveats & honesty

- **Backtest ≠ future profit.** Past performance does not guarantee results.
- **Yahoo data** is delayed and coverage is incomplete; intraday history is
  limited (~60 days for 5-min).
- **Optimization can overfit.** The walk-forward check reduces but does not
  eliminate this. Always validate on unseen data.
- **The strategy is one family** (RSI + ADX + ATR). It is a solid v1, not a
  guaranteed edge.
- **No real orders** are ever placed by any of these tools.

---

## Walk-forward / out-of-sample validation

A single in-sample backtest proves nothing. `npm run validate:strategy`
(`test/backtest/walk_forward.ts`) runs the **live signal engine** on rolling
out-of-sample folds, **net of costs** (the paper cost model), and prints a blunt
`VALIDATED` / `NOT VALIDATED` verdict.

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

> The default intraday strategy may produce few/zero trades on **daily** bars —
> validate on the interval the strategy actually trades. And a green verdict is
> **necessary, not sufficient**: the universe is current-listed names only
> (survivorship bias), and historical bars can't capture gaps, circuit limits, or
> thin liquidity.
