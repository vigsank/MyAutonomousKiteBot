# Real-News Validation — do price proxies align with real news sentiment?

> **Method:** for each sample date, fetch real date-scoped news sentiment (TinyFish time-range) and compare to the same-day price move.
> **Alignment:** negative news (sent < -0.2) with a drop, positive news (sent > 0.2) with a rise, or neutral with a small move.

## Summary

| Metric | Value |
|---|---|
| Samples | 60 |
| Aligned | 34 (57%) |
| Verdict | **Price proxies align weakly with real news — interpret the walk-forward with caution** |

## Per-Sample

| Date | Symbol | Price move | News sentiment | Alignment |
|---|---|---|---|---|
| 2026-03-02 | RELIANCE | -2.58% | -0.60 | ALIGNED |
| 2026-03-02 | INFY | -0.86% | -0.80 | MISALIGNED |
| 2026-03-02 | TCS | -0.91% | -0.80 | MISALIGNED |
| 2026-03-02 | HDFCBANK | -0.94% | -0.40 | MISALIGNED |
| 2026-03-02 | TATASTEEL | -0.62% | 0.40 | MISALIGNED |
| 2026-03-02 | HINDCOPPER | 1.71% | 0.00 | ALIGNED |
| 2026-03-02 | CHENNPETRO | -2.52% | 0.00 | ALIGNED |
| 2026-03-02 | LAURUSLABS | -1.00% | 0.40 | MISALIGNED |
| 2026-03-02 | ADANIPOWER | -1.53% | 0.65 | MISALIGNED |
| 2026-03-02 | SHRIRAMFIN | -2.49% | 0.00 | ALIGNED |
| 2026-04-01 | RELIANCE | 1.88% | 0.30 | ALIGNED |
| 2026-04-01 | INFY | 2.01% | 0.75 | ALIGNED |
| 2026-04-01 | TCS | 2.09% | 0.20 | ALIGNED |
| 2026-04-01 | HDFCBANK | 1.46% | -0.25 | MISALIGNED |
| 2026-04-01 | TATASTEEL | 1.43% | 0.40 | ALIGNED |
| 2026-04-01 | HINDCOPPER | 9.37% | -0.70 | MISALIGNED |
| 2026-04-01 | CHENNPETRO | 5.22% | 0.00 | ALIGNED |
| 2026-04-01 | LAURUSLABS | 4.64% | -0.40 | MISALIGNED |
| 2026-04-01 | ADANIPOWER | 4.44% | -0.30 | MISALIGNED |
| 2026-04-01 | SHRIRAMFIN | 3.26% | 0.60 | ALIGNED |
| 2026-05-01 | RELIANCE | 0.00% | 0.40 | MISALIGNED |
| 2026-05-01 | INFY | 0.00% | 0.40 | MISALIGNED |
| 2026-05-01 | TCS | 0.00% | -0.60 | MISALIGNED |
| 2026-05-01 | HDFCBANK | 0.00% | 0.50 | MISALIGNED |
| 2026-05-01 | TATASTEEL | 0.00% | 0.00 | ALIGNED |
| 2026-05-01 | HINDCOPPER | 0.00% | 0.00 | ALIGNED |
| 2026-05-01 | CHENNPETRO | 0.00% | 0.00 | ALIGNED |
| 2026-05-01 | LAURUSLABS | 0.00% | 0.00 | ALIGNED |
| 2026-05-01 | ADANIPOWER | 0.00% | 0.75 | MISALIGNED |
| 2026-05-01 | SHRIRAMFIN | 0.00% | 0.00 | ALIGNED |
| 2026-06-01 | RELIANCE | -0.09% | 0.30 | MISALIGNED |
| 2026-06-01 | INFY | 3.58% | 0.80 | ALIGNED |
| 2026-06-01 | TCS | 1.70% | 0.20 | ALIGNED |
| 2026-06-01 | HDFCBANK | -0.25% | -0.75 | MISALIGNED |
| 2026-06-01 | TATASTEEL | 1.23% | 0.70 | ALIGNED |
| 2026-06-01 | HINDCOPPER | 0.23% | 0.00 | ALIGNED |
| 2026-06-01 | CHENNPETRO | 3.66% | 0.00 | ALIGNED |
| 2026-06-01 | LAURUSLABS | 1.94% | 0.00 | ALIGNED |
| 2026-06-01 | ADANIPOWER | -4.55% | -0.20 | ALIGNED |
| 2026-06-01 | SHRIRAMFIN | -2.97% | 0.00 | ALIGNED |
| 2026-07-01 | RELIANCE | 1.09% | 0.60 | ALIGNED |
| 2026-07-01 | INFY | -1.51% | 0.35 | MISALIGNED |
| 2026-07-01 | TCS | -2.41% | -0.10 | ALIGNED |
| 2026-07-01 | HDFCBANK | -0.23% | 0.35 | MISALIGNED |
| 2026-07-01 | TATASTEEL | -1.54% | 0.80 | MISALIGNED |
| 2026-07-01 | HINDCOPPER | -2.10% | 0.00 | ALIGNED |
| 2026-07-01 | CHENNPETRO | -1.93% | 0.00 | ALIGNED |
| 2026-07-01 | LAURUSLABS | -1.59% | 0.30 | MISALIGNED |
| 2026-07-01 | ADANIPOWER | 1.38% | -0.10 | ALIGNED |
| 2026-07-01 | SHRIRAMFIN | 0.57% | 0.80 | MISALIGNED |
| 2026-08-03 | RELIANCE | 0.86% | -0.40 | MISALIGNED |
| 2026-08-03 | INFY | 4.42% | 0.30 | ALIGNED |
| 2026-08-03 | TCS | 4.57% | 0.00 | ALIGNED |
| 2026-08-03 | HDFCBANK | 0.65% | -0.35 | MISALIGNED |
| 2026-08-03 | TATASTEEL | 0.69% | 0.30 | MISALIGNED |
| 2026-08-03 | HINDCOPPER | 0.70% | 0.00 | ALIGNED |
| 2026-08-03 | CHENNPETRO | 5.15% | 0.75 | ALIGNED |
| 2026-08-03 | LAURUSLABS | -0.26% | 0.75 | MISALIGNED |
| 2026-08-03 | ADANIPOWER | 1.11% | -0.10 | ALIGNED |
| 2026-08-03 | SHRIRAMFIN | 4.16% | 0.00 | ALIGNED |

## Caveats

- TinyFish may not retain every article from a historical date; sentiment is best-effort.
- A single-day price move is a noisy proxy for a news event; multi-day windows would be more robust.