# AI Veto Audit — did the AI's AVOID calls help or hurt?

> **Window:** 2026-03-02 -> 2026-08-03 (6 monthly rebalances) | **Baseline:** pure momentum (top-5, 12m lookback, skip-1)
> **Vetoes:** parsed from `mock_ai_backed_report_6m.md` (the AI-backed run)

## Summary

| Metric | Value |
|---|---|
| Avg momentum-book monthly return | 6.54% |
| Avg vetoed-name forward return | 2.95% |
| Vetoed names counted | 8 |
| Verdict | **PROTECTIVE** — the AI vetoed names that lagged the book |

## Per-Month

| Rebalance | Momentum target | Book return | AI AVOID names | Vetoed forward return | Verdict |
|---|---|---|---|---|---|
| 2026-03-02 | ADANIENSOL, LAURUSLABS, HINDCOPPER, ADANIPOWER, BHARATFORG | -0.81% | HINDCOPPER, MUTHOOTFIN | HINDCOPPER -12.6%, MUTHOOTFIN -5.2% | -8.93% | PROTECTIVE (vetoed a loser) |
| 2026-04-01 | ADANIENSOL, LAURUSLABS, HINDCOPPER, ADANIPOWER, BHARATFORG | 24.42% | HINDCOPPER, LAURUSLABS | HINDCOPPER 8.3%, LAURUSLABS 12.3% | 10.32% | PROTECTIVE (vetoed a loser) |
| 2026-05-01 | ADANIENSOL, LAURUSLABS, HINDCOPPER, ADANIPOWER, BHARATFORG | 9.09% | LAURUSLABS | LAURUSLABS 26.1% | 26.11% | HARMFUL (vetoed a winner) |
| 2026-06-01 | ADANIENSOL, LAURUSLABS, HINDCOPPER, ADANIPOWER, BHARATFORG | 1.92% | HINDCOPPER, CHENNPETRO | HINDCOPPER -7.2%, CHENNPETRO 5.4% | -0.89% | PROTECTIVE (vetoed a loser) |
| 2026-07-01 | ADANIENSOL, LAURUSLABS, HINDCOPPER, ADANIPOWER, BHARATFORG | 4.20% | — | — | — | no vetoes |
| 2026-08-03 | ADANIENSOL, LAURUSLABS, HINDCOPPER, ADANIPOWER, BHARATFORG | 0.40% | ADANIENSOL | ADANIENSOL -3.5% | -3.52% | PROTECTIVE (vetoed a loser) |

## Caveats

- Small sample (6 months, a handful of vetoes) — directional, not conclusive.
- Forward return is the next ~21 trading days from the rebalance date.
- The AI-backed run also de-risks via the regime gate, so the veto effect is not fully isolated.