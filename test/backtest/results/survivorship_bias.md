# Survivorship-Bias Bound (Phase 0.3)

Window: **2023-09-01 → 2026-08-03** (36 months), universe frozen as of 36 months ago  
Config: topN=6, hysteresis band=8, monthly, one-way cost 0.155%

| Universe | Symbols | Annualized (net, pre-tax) |
|---|---:|---:|
| Full (current watchlist) | 203 | 34.32% |
| Frozen (listed before window start) | 199 | 33.83% |

**Survivorship-bias floor: +0.49pp.** 4 symbols listed after the window start and were excluded from the frozen run.

## What this is, and is not

This is a **floor** on the survivorship effect, measured on the data we actually have. It removes names that were **not yet listed** at decision time — the population that, in a naive backtest, silently joins the ranking only after they have already run up. The gap above is the return that depended on them.

It **cannot** see the other half of the bias: names that were listed, got picked, then **delisted or collapsed** and left the current watchlist. Those are gone from the data entirely. So the true survivorship drag is **at least** the number above, likely somewhat larger.

## Verdict

The floor is small (< 3pp). The edge does not appear to live in late-listing survivors. Combined with the walk-forward gate still clearing Nifty by ~27pp, the headline survives a conservative haircut.

_The bot always trades the latest NSE-listed watchlist, and the AI/news layer is meant to react to sudden bad news in real time — so the live system is less exposed to the delisting tail than a static backtest implies. This bound quantifies the residual, it does not eliminate it._
