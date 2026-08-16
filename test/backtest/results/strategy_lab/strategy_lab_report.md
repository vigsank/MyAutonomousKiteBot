# Strategy Lab — variant comparison

**Window:** 2021-09-30 → 2026-08-14 (4.9y) · **Universe:** 203 NSE symbols · **Capital:** ₹5,00,000

Costs are charged on weight actually traded, not assumed at 100% turnover.
Tax is Indian equity: 20% STCG (<12m), 12.5% LTCG above ₹1.25L/FY, losses netted within the year.

## Benchmarks

| Benchmark | CAGR |
| --- | --- |
| **Nifty 50 (buy & hold)** | **+6.82%** |
| Equal-weight universe (buy & hold) | +20.09% |

## Variants

| Variant | CAGR (pre-tax) | CAGR (after tax) | vs Nifty | Sharpe | Max DD | Turnover/rebal | Avg exposure | Pos. months |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| semiannual+hyst8 | +42.54% | **+40.63%** | +33.81% | 1.26 | -40.01% | 107% | 100% | 38/59 |
| quarterly+hyst8 | +34.03% | **+31.57%** | +24.75% | 1.06 | -38.42% | 77% | 100% | 35/59 |
| shipped | +32.31% | **+29.34%** | +22.53% | 1.00 | -42.85% | 43% | 100% | 34/59 |
| reserve-0 | +32.31% | **+29.34%** | +22.53% | 1.00 | -42.85% | 43% | 100% | 34/59 |
| reserve-5 | +30.86% | **+27.93%** | +21.11% | 1.00 | -41.04% | 41% | 100% | 34/59 |
| reserve-10 | +29.38% | **+26.53%** | +19.71% | 1.00 | -39.18% | 39% | 100% | 34/59 |
| reserve-15 | +27.88% | **+25.14%** | +18.32% | 1.00 | -37.29% | 37% | 100% | 34/59 |
| reserve-20 | +26.36% | **+23.73%** | +16.91% | 1.00 | -35.37% | 35% | 100% | 34/59 |
| hyst8+crash | +26.02% | **+23.20%** | +16.38% | 0.90 | -45.69% | 44% | 92% | 34/59 |
| hysteresis-4 | +24.63% | **+21.50%** | +14.69% | 0.87 | -48.50% | 49% | 100% | 33/59 |
| quarterly | +23.00% | **+20.60%** | +13.79% | 0.83 | -45.47% | 121% | 100% | 35/59 |
| hyst8+vol20 | +21.90% | **+19.45%** | +12.63% | 0.95 | -33.74% | 32% | 69% | 34/59 |
| no-hysteresis | +19.23% | **+16.14%** | +9.32% | 0.72 | -42.43% | 66% | 100% | 34/59 |
| hyst8+vol15 | +16.76% | **+14.82%** | +8.01% | 0.95 | -26.16% | 25% | 53% | 34/59 |
| vol-20 | +14.51% | **+11.90%** | +5.08% | 0.72 | -33.33% | 48% | 70% | 34/59 |
| hyst8+vol15+crash | +13.61% | **+11.86%** | +5.04% | 0.86 | -27.82% | 25% | 49% | 34/59 |
| crash-filter | +13.57% | **+10.67%** | +3.85% | 0.59 | -44.95% | 65% | 92% | 34/59 |
| vol-15 | +11.21% | **+9.12%** | +2.30% | 0.72 | -25.97% | 37% | 53% | 34/59 |

## What each variant is

- **shipped** — what we ship today: top-6 monthly + hysteresis-8
- **no-hysteresis** — the old shipped config, for reference
- **hysteresis-4** — hold until rank > topN+4
- **vol-15** — scale exposure to 15% annualized vol
- **vol-20** — scale exposure to 20% annualized vol
- **crash-filter** — halve exposure below the 200d mean
- **hyst8+vol15** — shipped + 15% vol target
- **hyst8+vol20** — shipped + 20% vol target
- **hyst8+crash** — shipped + crash filter
- **hyst8+vol15+crash** — shipped + both overlays
- **quarterly** — rebalance every 3 months (tax-aware test)
- **quarterly+hyst8** — quarterly at the shipped band
- **semiannual+hyst8** — every 6 months at the shipped band
- **reserve-0** — shipped, 0% cash reserve (fully deployed)
- **reserve-5** — shipped, 5% cash reserve
- **reserve-10** — shipped, 10% cash reserve
- **reserve-15** — shipped, 15% cash reserve
- **reserve-20** — shipped, 20% cash reserve (current default)
