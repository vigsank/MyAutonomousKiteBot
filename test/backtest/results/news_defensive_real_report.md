# Real-News Defensive Trigger Validation (multi-window)

> **Trigger:** exit a held name on a single-day drop >= 5% · **Exit threshold:** sentiment < -0.4
> **News:** REAL date-scoped (TinyFish time-range) via `sentimentForDate`.

## The crux across windows

| Metric | Value |
|---|---|
| Defensive-candidate events | 94 |
| News-checked (sampled) | 48 |
| Confirmed negative news (real crash risk) | 12 (25.00%) |
| Whipsaw (drop with no negative news) | 36 (75.00%) |

## Per-window

| Window | Events | Checked | Confirmed | Baseline ann | Real ann | Baseline DD | Real DD | Baseline Sharpe | Real Sharpe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2023-01-01 → 2023-12-31 | 30 | 12 | 2 | 41.27% | 29.74% | 33.25% | 27.09% | 1.02 | 0.89 |
| 2024-01-01 → 2024-12-31 | 26 | 12 | 2 | 2.30% | 2.90% | 16.40% | 15.91% | 0.21 | 0.23 |
| 2025-01-01 → 2025-12-31 | 20 | 12 | 3 | 52.95% | 27.09% | 16.64% | 16.83% | 1.60 | 1.01 |
| 2026-01-01 → 2026-08-31 | 18 | 12 | 5 | 66.76% | 45.22% | 8.65% | 9.47% | 1.70 | 1.41 |

## Aggregate verdict

| Metric | Baseline (avg) | + Real-news defensive (avg) |
| --- | --- | --- |
| Annualized | 40.82% | 26.24% |
| Max drawdown | 18.74% | 17.33% |
| Sharpe | 1.13 | 0.89 |
| Windows where DD was cut | — | 2/4 |
| Windows where returns kept (>=90%) | — | 1/4 |

**VERDICT: Real-news defensive does not consistently help across windows.**

## Per-event news classification

| Window | Date | Symbol | Drop | News sentiment | Kind |
| --- | --- | --- | --- | --- | --- |
| 2023-01 | 2023-01-25 | ADANIENSOL | -8.8% | 0.00 | whipsaw |
| 2023-01 | 2023-01-27 | ADANIPOWER | -5.0% | -0.90 | CONFIRMED |
| 2023-01 | 2023-02-02 | ADANIENSOL | -10.0% | 0.00 | whipsaw |
| 2023-01 | 2023-02-03 | HINDCOPPER | -7.8% | 0.00 | whipsaw |
| 2023-01 | 2023-02-09 | ADANIPOWER | -5.0% | -0.75 | CONFIRMED |
| 2023-01 | 2023-05-08 | ADANIENSOL | -5.0% | 0.00 | whipsaw |
| 2023-01 | 2023-06-30 | ADANIENSOL | -6.3% | 0.00 | whipsaw |
| 2023-01 | 2023-08-23 | ADANIENSOL | -7.3% | 0.00 | whipsaw |
| 2023-01 | 2023-09-12 | HINDCOPPER | -7.1% | 0.00 | whipsaw |
| 2023-01 | 2023-10-23 | LAURUSLABS | -9.6% | 0.00 | whipsaw |
| 2023-01 | 2023-12-08 | ADANIENSOL | -5.6% | 0.00 | whipsaw |
| 2023-01 | 2023-12-13 | ADANIENSOL | -5.3% | 0.00 | whipsaw |
| 2024-01 | 2024-01-08 | HINDCOPPER | -5.5% | 0.00 | whipsaw |
| 2024-01 | 2024-02-09 | HINDCOPPER | -6.7% | 0.00 | whipsaw |
| 2024-01 | 2024-02-12 | BHARATFORG | -13.9% | 0.00 | whipsaw |
| 2024-01 | 2024-03-13 | HINDCOPPER | -8.2% | 0.00 | whipsaw |
| 2024-01 | 2024-06-04 | ADANIENSOL | -20.0% | 0.00 | whipsaw |
| 2024-01 | 2024-06-04 | HINDCOPPER | -19.4% | 0.00 | whipsaw |
| 2024-01 | 2024-08-05 | ADANIENSOL | -8.1% | 0.00 | whipsaw |
| 2024-01 | 2024-08-05 | BHARATFORG | -6.2% | 0.00 | whipsaw |
| 2024-01 | 2024-10-07 | HINDCOPPER | -5.7% | 0.00 | whipsaw |
| 2024-01 | 2024-10-25 | ADANIENSOL | -5.8% | 0.00 | whipsaw |
| 2024-01 | 2024-11-07 | ADANIENSOL | -10.4% | -0.70 | CONFIRMED |
| 2024-01 | 2024-11-21 | ADANIPOWER | -9.1% | -0.70 | CONFIRMED |
| 2025-01 | 2025-01-06 | ADANIENSOL | -6.4% | 0.00 | whipsaw |
| 2025-01 | 2025-01-06 | HINDCOPPER | -5.8% | 0.00 | whipsaw |
| 2025-01 | 2025-01-13 | HINDCOPPER | -6.0% | 0.00 | whipsaw |
| 2025-01 | 2025-01-27 | LAURUSLABS | -11.3% | -0.90 | CONFIRMED |
| 2025-01 | 2025-02-14 | LAURUSLABS | -9.1% | 0.00 | whipsaw |
| 2025-01 | 2025-04-04 | LAURUSLABS | -7.4% | -0.70 | CONFIRMED |
| 2025-01 | 2025-04-04 | BHARATFORG | -8.2% | 0.00 | whipsaw |
| 2025-01 | 2025-04-07 | ADANIENSOL | -5.2% | 0.00 | whipsaw |
| 2025-01 | 2025-04-07 | BHARATFORG | -7.3% | 0.00 | whipsaw |
| 2025-01 | 2025-07-31 | HINDCOPPER | -5.8% | 0.00 | whipsaw |
| 2025-01 | 2025-09-24 | ADANIPOWER | -11.0% | 0.10 | whipsaw |
| 2025-01 | 2025-10-10 | HINDCOPPER | -5.4% | -0.60 | CONFIRMED |
| 2026-01 | 2026-01-08 | HINDCOPPER | -5.5% | -0.85 | CONFIRMED |
| 2026-01 | 2026-01-23 | ADANIENSOL | -12.1% | -0.85 | CONFIRMED |
| 2026-01 | 2026-01-30 | HINDCOPPER | -9.8% | -0.60 | CONFIRMED |
| 2026-01 | 2026-02-02 | HINDCOPPER | -11.0% | 0.70 | whipsaw |
| 2026-01 | 2026-02-13 | ADANIPOWER | -6.6% | 0.70 | whipsaw |
| 2026-01 | 2026-03-04 | HINDCOPPER | -5.1% | 0.00 | whipsaw |
| 2026-01 | 2026-03-13 | BHARATFORG | -5.9% | 0.00 | whipsaw |
| 2026-01 | 2026-03-19 | BHARATFORG | -5.1% | 0.00 | whipsaw |
| 2026-01 | 2026-03-23 | HINDCOPPER | -8.2% | -0.75 | CONFIRMED |
| 2026-01 | 2026-03-30 | HINDCOPPER | -8.1% | -0.60 | CONFIRMED |
| 2026-01 | 2026-05-12 | ADANIPOWER | -5.6% | 0.70 | whipsaw |
| 2026-01 | 2026-05-15 | HINDCOPPER | -6.0% | 0.95 | whipsaw |

## Caveats

- TinyFish may miss historical articles → reads as neutral → "whipsaw".
- Single-day drop is a noisy event proxy; a multi-day confirmation window would be more robust.
- Events are sampled (cap 12 per window) to bound LLM cost; confirmed rate is a sample estimate.