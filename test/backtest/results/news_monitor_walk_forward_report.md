# News Monitor Walk-Forward (price-proxy validation)

> **Window:** 2022-09-01 -> 2026-08-17 | **Baseline:** pure momentum (top-5, 12m lookback, skip-1)
> **Proxies:** defensive = exit a held name on a single-day drop >= 4%; opportunistic = partial entry on a 20-day-high breakout of a momentum candidate.

| Variant | Final equity | Total return | Max drawdown | Trades | Opp entries |
|---|---|---|---|---|---|
| Baseline (monthly momentum) | 27,44,753 | 174.48% | 40.9% | 5 | 0 |
| + Defensive exit | 22,13,890 | 121.39% | 20.9% | 194 | 0 |
| + Opportunistic entry | 43,26,950 | 332.70% | 31.1% | 5 | 2 |
| + Both | 21,62,875 | 116.29% | 16.6% | 291 | 82 |

## Reading

- **Defensive** should cut max drawdown (left-tail) at some cost to total return (whipsaw).
- **Opportunistic** should add return if early entry on breakouts beats waiting for the monthly rebalance, net of turnover.
- These use PRICE proxies for news (the CSVs have no historical news). Real news sentiment may differ.