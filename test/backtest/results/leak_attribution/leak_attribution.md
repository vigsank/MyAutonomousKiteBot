# Leak Attribution — gross signal to take-home

Generated 2026-08-16T10:38:24.934Z

Window: 2022-09-01 → 2026-08-03 · 203 symbols · capital ₹5,00,000

```

====================================================================================================
  LEAK ATTRIBUTION — gross signal to take-home
====================================================================================================
  Stage                   CAGR      Δ vs prior   Final equity     Exposure  Turn/reb
  ------------------------------------------------------------------------------------------------
  Gross signal             26.66%            —      ₹12,62,733      100%       41%
  − Trading costs          25.74%      -0.91pp      ₹12,27,404      100%       41%
  − Cash reserve           21.12%      -4.62pp      ₹10,59,720       80%       33%
  − Single-stock cap       21.12%       0.00pp      ₹10,59,720       80%       33%
  − AI news veto           21.90%       0.78pp      ₹10,86,676       78%       37%
  − Capital gains tax      19.19%      -2.70pp       ₹9,95,162       78%       37%
  ------------------------------------------------------------------------------------------------
  Total leak               -7.46pp
  Nifty 50 (same window)    9.20%
  Take-home vs Nifty        9.99pp  ← the bot justifies its existence
====================================================================================================

  Leak breakdown (share of the total gap):
    Trading costs          0.91pp    12%  ████
    Cash reserve           4.62pp    62%  █████████████████████
    Single-stock cap       0.00pp     0%  
    AI news veto          -0.78pp   -10%  ███
    Capital gains tax      2.70pp    36%  ████████████

  Tax paid over the run: ₹83,975

  Caveats: current-listed universe (survivorship bias, plan 0.3); the news
  veto uses a deterministic proxy, so its line measures the MECHANISM's cost,
  not this LLM's skill (plan 1.3 governs tuning the threshold).
```
