# Plan — Profitability: from "validated edge" to "money in the account"

> **Supersedes** the vision-integration plan (Phases A–G), archived complete at
> `docs/plan/archive/plan-vision-integration-COMPLETE.md`.
>
> **The problem this plan solves.** The momentum edge is validated at **+25.35%
> annualized net** (215 OOS months). End-to-end through the real stack it is
> **~8%**. Most of that ~17-point gap is *leakage inside our own machinery*, not
> a bad strategy. This plan recovers the leaks first, then widens the edge.

---

## Where the numbers stand now

> Updated after Phases 1.1, 1.2, 2.3 and 0.2. **The headline figures below
> replace the ones in the opening paragraph** — that 25.35% was measured with two
> methodological defects (see 2.3), and is not comparable to what follows.

`npm run validate:momentum`, 48 non-overlapping OOS months across 8 windows:

| | Annualized net (pre-tax) | vs Nifty | Positive months | Positive windows |
|---|---|---|---|---|
| **Shipped (topN 5–10, hysteresis)** | **36.99%** | **+26.84pp** | 65% | 6/8 |
| Without hysteresis | 21.66% | +11.51pp | 58% | 5/8 |
| Nifty 50, same months | 10.15% | — | — | — |

Still unmeasured and still capable of eating most of this: survivorship bias
(0.3), deployment drag (0.1), and tax (3.1). Treat 36.99% as the *ceiling*, not
the expectation.

---

## Status legend
`[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked/rejected

---

## The success bar (agreed)

**Beat Nifty 50 by enough to justify existing.**

A positive return that trails the index is a **failure**, not a win. Every
report must show the index beside our number. This is deliberately harsher than
the bar used so far.

## The honest arithmetic we are fighting

| Step | Effect | Running |
|---|---|---|
| Validated gross (100% deployed, pre-tax, current-listed universe) | — | **25.4%** |
| Survivorship-bias haircut (estimated — Phase 0.3 replaces this) | −4 to −8pp | ~18–21% |
| Deployment 53–80% | ×0.53–0.80 | ~10–17% |
| AI veto drag | unmeasured | ? |
| STCG @ 20% on realized gains | ×0.80 | **~8–13%** |

Nifty 50 does ~11–12% long-run for zero effort. **Today's edge over an index
fund is between zero and modest.** That is the gap to close.

Two facts to keep in view:
- **Income scales with capital, not cleverness.** At ₹5L, a great 15% is
  ₹75k/year. The edge decides *whether* to deploy; capital decides the rupees.
- **Tax is inevitable and therefore must be *visible*.** We model it to report
  honestly, not to contort the strategy around avoiding it.

---

## Rules of engagement

1. **Nothing ships on plausibility.** Every strategy change must pass
   `npm run validate:momentum` out-of-sample, or it is reverted.
2. **Benchmark is Nifty, not zero.**
3. **Bug fixes and strategy changes ship in separate commits**, so attribution
   stays clean.
4. **Measure before optimising.**
5. At the end of each phase, mark it `[x]` here so the work is auditable.

---

## Phase 1 — Recover leaked return (bug fixes, highest certainty)

> Sequenced first (ahead of Phase 0) because 1.1 is a confirmed defect with a
> known magnitude, and every measurement taken before fixing it would have to be
> retaken afterwards.

**1.1 — Fix the sizing denominator** `[x]` ⭐ *Biggest single recoverable win*

`MomentumStrategy.quantityFor()` sized each name as `capital.available / topN`.
`available` is recomputed from the ledger **after every fill**, so successive
buys in one rebalance shrink geometrically:

| Buy | available | perSymbol |
|---|---|---|
| 1 | ₹4,00,000 | ₹66,667 |
| 2 | ₹3,33,571 | ₹55,595 |
| 3 | ₹2,78,000 | ₹46,300 |
| 6 | ₹1,60,900 | ₹26,800 |

Deployed ≈ **53%** against an intended **80%**; the 6th position is 40% the size
of the first. Masked whenever the LLM report supplies
`suggested_allocation_inr` (computed once against a fixed base) — so **capital
efficiency silently depends on the LLM being up**.

- Size against a **fixed** denominator: `(totalCapital × deployablePct) / slots`.
- Cap the advisor's suggestion at equal weight (shrink-only, per the locked
  authority model — it may not inflate a position past its slot).
- Files: `MomentumStrategy.ts`.
- *Expected:* deployment 53% → ~80%; ~+4pp annualized.

**Done.** `quantityFor` now sizes against
`(totalCapital × (100 − minCashReservePct)) / slots`, clamped by
`capital.available` and then by the hard caps. `npm run test:risk` confirms
**79.2% deployed with all six tickets equal at ₹66,000** (was ₹66k/56k/46k/39k/
32k/27k). Locked by `testDeploymentDoesNotDecay()` in
`test/risk_regression_test.ts`.

*Honest note:* the daily-cycle sim's P&L got **worse** after this fix
(−1.79% → −1.94%), because it deployed ₹3.30L instead of ₹2.77L into a basket
that fell during that window. That is the correct behaviour of a correct fix —
not a regression.

**1.2 — Redistribute vetoed slots (residual cash sweep)** `[x]`

When the AI vetoes 2 of 6 names, the freed 27% of capital sits idle. Size
against the number of slots we will *actually* fill, clamped by the single-stock
cap, so survivors absorb the freed allocation.
- Files: `MomentumStrategy.ts`.
- *Expected:* +5–8pp deployment on veto-heavy days.

**Done.** `rebalance()` computes `slots = keepers + entryCandidates.length` and
passes it to `quantityFor`, so a vetoed name's share flows to the survivors
instead of sitting idle. Locked by `testVetoedSlotsAreRedistributed()`.

Deployment now sits at ~57% rather than 80% in the sim, and that is **correct**:
with 2 of 6 names vetoed, the 15% single-stock cap binds on the remaining four.
Policy, not leakage.

**1.3 — Re-tune the veto threshold on evidence** `[ ]`

The 15-day sample showed the veto adding +0.20% — directionally right,
statistically meaningless. Do not touch `newsVetoThreshold` until 0.1 can
measure it over the full OOS period.
- *Accept:* threshold changes only with ≥12 months of attribution behind them.

---

## Phase 0 — Ground truth (measure; change no trading behaviour)

**0.1 — Leak attribution harness** `[x]`

One command producing the waterfall above with *real* numbers: gross signal →
deployment → costs → vetoes → tax → take-home.
- Files: `test/backtest/leak_attribution.ts` (NEW), npm script `attribute:leaks`.
- *Accept:* every rupee between gross and net is attributed to a named cause.

**Done.** The waterfall, on the real 48-rebalance window (2022-09 → 2026-08):

| Stage | Annualized | Δ from prior |
|---|---|---|
| Gross signal | 26.66% | — |
| − trading costs | 25.75% | −0.91pp |
| − 20% cash reserve | 21.13% | **−4.62pp** |
| − single-stock cap | 21.13% | 0.00pp |
| + AI veto | 21.91% | **+0.78pp** |
| − tax (FY netting) | **19.19%** | −2.70pp |
| Nifty 50 (same months) | 9.20% | **+9.99pp over** |

Two findings that steer the rest of the plan:
1. **The 20% cash reserve is the single largest leak — 62% of the gap between
   gross and take-home.** A momentum book that is rarely all-cash pays this every
   month. Whether it should be relaxed is now a live question (see 0.4).
2. **The AI veto *added* 0.78pp on the proxy** — the first quantified evidence
   the filter earns its seat, feeding Phase 4.
3. Tax is 36% of the leak; the single-stock cap costs nothing in this window
   (hysteresis-6 rarely concentrates past 15% anyway). Tax paid: ₹83,975.

**0.2 — Nifty benchmark everywhere** `[x]`

Report Nifty 50 alongside the equal-weight universe in every backtest and sim.
- Files: `daily_cycle_sim.ts`, `momentum_walk_forward.ts`.
- *Accept:* no P&L number is ever printed without the index beside it.

**Both files done.** `momentum_walk_forward.ts`: Nifty loaded via
`findInstrument('^NSEI', 'INDEX')` and aligned **month by month against the exact
OOS months the strategy traded**, so the comparison is like for like rather than
against a calendar-year index figure. Failing to beat it is a **hard verdict
failure** (exit 1) — the success bar is enforced by the gate, not just
documented here. `daily_cycle_sim.ts`: `niftyCurve()` + a `nifty` field on
`DayRecord`, printed in the per-day table, the summary, and the markdown beside
the equal-weight universe figure.

**0.3 — Survivorship-bias estimate** `[x]`

Replace "optimistic, accepted" with a number — reconstruct historical
membership, or bound it by testing on a frozen 3-years-ago universe.
- Files: `test/backtest/survivorship_bias.ts` (NEW), npm script `estimate:survivorship`.

**Done — the bias floor is small.** Freezing the universe as it stood 36 months
ago (only names already listed and scorable then) and running the shipped config
(topN=6, band=8, monthly) over the same 36 OOS months:

| Universe | Symbols | Annualized (net, pre-tax) |
|---|---:|---:|
| Full (current watchlist) | 203 | 34.32% |
| Frozen (listed ≥ 36mo ago) | 199 | 33.83% |

**Survivorship-bias floor: +0.49pp.** Only 4 of 203 symbols listed after the
window start, so late-listing survivors contribute almost nothing to the
headline — the watchlist is a stable large/mid-cap set, not a churn of fresh
IPOs. This is a **floor**: it removes names not-yet-listed at decision time, but
cannot see names that were listed, picked, then delisted/collapsed and left the
current watchlist (that data is gone). The true drag is at least 0.49pp, likely
a little more — but the edge plainly does not live in survivors. Two things
mitigate the invisible tail on the *live* system specifically: the bot always
trades the latest NSE watchlist (I maintain it), and the AI/news layer is meant
to react to sudden bad news in real time, which a static backtest cannot model.

**0.4 — Cash-reserve sensitivity** `[x]` *(new, from 0.1)*

The 20% cash reserve is the single largest leak (−4.62pp, 62% of the gross→net
gap). For an equity momentum book that is almost never all-cash, a fixed 20%
idle sleeve is pure drag. Sweep the reserve (0/5/10/15/20%) through the
walk-forward gate and pick the lowest level that still passes OOS **and** keeps
drawdown inside the 5.1 kill band. This is a *sizing* change, so it must clear
the same gate as any edge change.
- *Accept:* a reserve level chosen on OOS evidence, not habit.

**Done — and the answer is "there is no free lunch, keep it as a risk lever."**
Swept in `strategy_lab` with drawdown tracked (the reserve's whole justification
is downside, not return), on the shipped hysteresis-8 book over 4.9y:

| Reserve | AfterTax | MaxDD | Sharpe |
|---|---|---|---|
| 0% | +29.34% | −42.85% | 1.00 |
| 5% | +27.93% | −41.04% | 1.00 |
| 10% | +26.53% | −39.18% | 1.00 |
| 15% | +25.14% | −37.29% | 1.00 |
| 20% (default) | +23.73% | −35.37% | 1.00 |

Each 5pp of reserve costs ~1.4pp of after-tax return and buys ~1.9pp of
drawdown reduction, at **flat Sharpe (1.00) throughout**. That flat Sharpe is
the finding: the reserve is a pure linear de-scaling of the same book, so it
neither creates nor destroys risk-adjusted edge — it only trades return for
drawdown, roughly 1:1. So this is **not** an optimization to "win"; it is a
capital/risk-appetite dial.

**Decision: the reserve stays, sized in Phase 5.1, not here.** With the
−40%-to-−48% drawdown from Phase 2 still unresolved (both the vol-scale and
crash-filter remedies failed the gate), the cash reserve is currently the *only*
working drawdown control the book has. Cutting it to 0% recovers 5.6pp of return
but pushes MaxDD to −43%. It is therefore folded into 5.1's kill-criteria / risk
budget rather than treated as a leak to close. Note the reserve is orthogonal to
the walk-forward gate (the gate runs fully deployed), so no gate re-run is
needed — the effect is exactly the linear scaling shown above.

---

## Phase 2 — Strengthen the edge (each must pass walk-forward)

> `signals/momentum.ts` is **vanilla rank-by-return** — no volatility scaling, no
> crash filter, no turnover control. That is the textbook-weakest form of
> momentum, which means the documented improvements are still on the table.

**2.1 — Volatility-scaled sizing** `[!]` **REJECTED on evidence**

Scale gross exposure inversely to recent realized portfolio volatility
(Barroso & Santa-Clara). The best-documented improvement to momentum.
- *Accept:* walk-forward Sharpe improves and max drawdown falls. Flat return is
  acceptable if drawdown drops materially.

**Rejected — it fails its own acceptance criterion.** Measured on top of the
shipped hysteresis-8 config (`strategy_lab`, 4.9y, 203 symbols):

| Variant | PreTax | Sharpe | MaxDD | Exposure |
|---|---|---|---|---|
| shipped (hyst-8) | **+32.31%** | **1.00** | −42.85% | 100% |
| hyst8+vol20 | +21.90% | 0.95 | −33.74% | 69% |
| hyst8+vol15 | +16.76% | 0.95 | −26.16% | 53% |

Return halves and **Sharpe gets worse**, so the "flat return for lower drawdown"
escape clause does not apply. Worth recording *why* the earlier read was
positive: against the old no-hysteresis base, vol scaling lifted Sharpe
0.72 → 0.85. It was being credited for suppressing turnover churn — which
hysteresis now removes at the source, and for free. Two overlays were fixing the
same problem; the cheaper one won.

**2.2 — Momentum crash filter** `[!]` **REJECTED on evidence**

Momentum's known failure mode is violent reversal after market bottoms
(Daniel & Moskowitz). De-risk when the market is deeply below its long-run mean
*and* volatility is spiking.
- *Accept:* reduces worst-window loss without gutting return.

**Rejected — it fails on both axes at once.** `hyst8+crash` returned +26.02%
against the shipped +32.31%, and max drawdown got **worse** (−45.69% vs
−42.85%). A de-risking overlay that increases drawdown is not a de-risking
overlay. Halving exposure below the 200-day mean sold into exactly the
recoveries momentum needs — the same failure mode that sank `MOMENTUM_RISK_OFF`.

> **Open risk, now unresolved on purpose.** Every configuration that makes real
> money in this window carries a **−40% to −48% max drawdown**, and both
> candidate remedies have now been tested and rejected. Drawdown control is
> therefore deferred to Phase 5.1 as a *capital* decision (kill criteria, position
> ladder) rather than a strategy overlay. Do not deploy meaningful capital
> without reading 5.1 first.

**2.3 — Rank hysteresis** `[x]` ⭐ *Validated; the largest strategy gain so far*
**2.3 — Rank hysteresis** `[x]` ⭐ *Validated; the largest strategy gain so far*

A name falling from rank 6 to 7 currently triggers a full 0.31% round trip. Hold
until it exits a wider band (e.g. top 10).
- *Expected:* lower turnover → lower cost → **and defers gains toward LTCG**,
  compounding with Phase 3.

**Done, and it is real.** Two independent methods agreed on band = 8: the
`strategy_lab` A/B (hysteresis-8 was the best of 10 variants) and the
walk-forward gate, where the band is chosen **on training data only** yet 6 of 8
windows picked a band > 0 (0×2, 6×2, 8×4).

A 2×2 attribution isolates it from the two correctness fixes that landed in the
same file:

| topN sweep | band ∈ {0} | band ∈ {0,2,4,6,8} | Δ hysteresis |
|---|---|---|---|
| 2..10 | 24.10% — **NOT VALIDATED** (4/8 windows) | 31.93% — VALIDATED (6/8) | **+7.8pp** |
| **5..10** | 21.66% — VALIDATED (5/8) | **36.99% — VALIDATED (6/8)** | **+15.3pp** |

Two findings worth keeping:
1. **Without hysteresis the unconstrained sweep fails the gate outright.** The
   band is not a refinement; it is what makes the edge survive OOS selection.
2. **`topN ≥ 5` scores *better*, not worse.** The 2–4 name books were fragile
   (one window lost 32.6%), and they were never executable under the 15%
   single-stock cap anyway. The more executable configuration is also the better
   one — a rare and welcome alignment.

Shipped: `selectWithHysteresis()` in `signals/momentum.ts` (pure, 13 unit tests
in `test/momentum_test.ts`); `MomentumStrategy.targetPortfolio()` reads
incumbents from the ledger so **every** caller — live loop and all six backtest
harnesses — gets the sticky behaviour without a signature change;
`MOMENTUM_HYSTERESIS_BAND=8` in config/`.env`/`.env.example`;
`StrategyOptimizer.windowReturns()` now carries the book across months and
applies the band, so the auto-optimizer ranks the strategy we actually run.
`PARAM_BOUNDS` raised from 3..8 to **5..10**.

**Two correctness fixes shipped alongside — they, not hysteresis, explain why
the old headline number was 25.35%:**
- *Costs were charged on a full round trip every month regardless of turnover.*
  Now charged on `Σ|Δw|`, with weights carried across rebalances and drifted
  weights renormalised. The old model made any turnover reduction literally
  impossible to detect — which is why hysteresis had never shown up before.
- *Windows overlapped.* The loop stepped 1 month with 6-month windows, counting
  each OOS month up to six times and inflating the sample to "215 months" from a
  6-year dataset. Now steps by `TEST_MONTHS`: **48 months, each counted once.**

**2.4 — Universe expansion + liquidity floor** `[x]`

Cross-sectional momentum improves with breadth; 214 symbols is thin. Expand,
with a turnover/ADV floor so we cannot pick what we cannot exit.

**Done — the liquidity floor is built, tested, and wired; it defaults OFF so it
changes nothing until the watchlist actually expands.** The floor is the
safety half of "expand breadth": expanding the watchlist is the user's job (they
maintain the latest NSE list), but the *moment* they add smaller names, the book
must not pick something it cannot exit at size. So the code-side deliverable is
the guardrail, ready and inert.

Shipped:
- `averageDailyValue()` and `applyLiquidityFloor()` in `signals/momentum.ts` —
  pure, with the standard ADV proxy (close × volume, trailing window). 5 new
  unit tests (13–17) in `test/momentum_test.ts`.
- `ClosePoint.volume?` added (optional, backward-compatible — older cached
  series and price-only callers are unaffected).
- `MomentumStrategy.targetPortfolio()` applies the floor *before* ranking, so a
  thin name never even competes for a slot.
- Config keys `momentumLiquidityFloorInr` (default **0 = disabled**) and
  `momentumLiquidityLookbackDays` (default 20) in `AppConfig`/`.env`/`.env.example`.

Two design choices worth recording:
1. **Fail-open.** A symbol with no volume data is *kept*, never silently
   dropped. A missing data field must not quietly empty the universe.
2. **Off by default.** With the floor at 0 the gate is byte-for-byte unchanged
   (re-ran `validate:momentum`: still 36.99%, +26.84pp over Nifty). The floor is
   a forward-looking valve, not a retroactive edge claim. Backtest caches
   currently store closes without volume, so the floor cannot be *measured*
   historically yet — it activates against live/paper data where volume is
   present. Set `MOMENTUM_LIQUIDITY_FLOOR_INR` (e.g. 5–10 crore ADV) when
   expanding into mid/small caps.

---

## Phase 3 — After-tax reality (currently invisible)

> Zero matches for `tax|STCG|LTCG` anywhere in `src/server/`.

**3.1 — Model STCG/LTCG** `[x]`

20% short-term; 12.5% long-term above the ₹1.25L annual exemption; per-lot
holding clock.
- *Accept:* every backtest reports gross **and** after-tax.

**Done.** `src/server/Tax.ts` — pure, no I/O, 28 assertions in
`test/tax_test.ts` (wired into `test:unit` as `test:tax`). Losses net across
buckets within the financial year, so a losing month legitimately *reduces* the
year's accrual rather than leaving it untouched.

The financial-year boundary is April, not January; getting that wrong would
misfile every January–March trade and misstate both the exemption and the
netting. `Ledger.realizedGainsForFY()` reads **closed positions**, not trades —
holding period is a property of the lot (`entry_time` → `exit_time`) and the
exit trade row alone cannot tell you how long it was held. Gains are attributed
to the FY of the *exit*, when they become taxable.

Wired into the reporting path via `EodEngine.logEodPerformance()` and persisted
by migration `V014__tax_accrual.sql` (`financial_year`, `stcg_fytd`,
`ltcg_fytd`, `tax_accrued`, all nullable so pre-existing rows stay valid).
Accrual is **financial-year-to-date, not per-day** — a single day's tax is not a
meaningful quantity when losses net annually.

The number that makes this worth the effort: ₹3L realized short-term owes
₹60,000; the same ₹3L held past twelve months owes ₹21,875. **₹38,125 of
difference on identical gross return.**

**3.2 — Re-test rebalance cadence after tax** `[x]` — **verdict: stay monthly**

Monthly is validated *pre-tax*. Quarterly may net more take-home despite a lower
gross, because more gains cross the 12-month line. Genuinely open question.
- *Accept:* choose the cadence that wins **after tax**.

**This one nearly fooled us, and is the best argument for Rule 1 in the file.**

In-sample (`strategy_lab`, band held constant at 8) longer cadence looked
emphatically better *after tax*:

| Cadence | PreTax | **AfterTax** | Sharpe | MaxDD |
|---|---|---|---|---|
| monthly (shipped) | +32.31% | +29.34% | 1.00 | −42.85% |
| quarterly | +34.03% | +31.57% | 1.06 | −38.42% |
| **semiannual** | +42.54% | **+40.63%** | 1.26 | −40.01% |

The tax mechanism is real and behaves as theorised — semiannual's tax drag is
1.9pp against monthly's 3.0pp, because hysteresis plus a slower clock pushes
more gains past twelve months.

**But it does not survive out-of-sample selection.** Adding cadence to the
walk-forward sweep *lowered* OOS return from **36.99% to 31.21%**: training
chose `every = 6` in 6 of 8 windows — reproducing the lab's preference exactly —
and that choice lost ~6pp live.

Pinning each cadence instead of selecting it is revealing:

| Fixed cadence | OOS annualized | Positive windows |
|---|---|---|
| 1m | 36.99% | 6/8 |
| 2m | 36.44% | 6/8 |
| 3m | 39.21% | 6/8 |
| 6m | 41.49% | 7/8 |
| *auto-selected* | **31.21%** | 6/8 |

Selection is worse than every option it can choose from. Two things follow:

1. **Cadence is a design decision, not a tunable parameter.** The gate now pins
   `CADENCES=1` by default; the sweep stays available via env for research.
2. **The pinned ranking is not a licence to ship 6m.** Choosing 6m because it
   topped the table across all eight OOS windows is researcher-level in-sample
   selection — the same mistake one level up. At 6m there are only **8 rebalance
   decisions in the entire OOS run**; 41.49% off 8 decisions is not separable
   from luck.

**Decision: stay monthly.** Beyond the statistics, a 6-month cadence would give
the AI layer roughly two decision points a year, which guts the product this is
meant to be. Revisit when there is enough history for 6m to accumulate real
decision count — the finding is filed, not dismissed.

---

## Phase 4 — Make the AI measurably earn its seat

> The AI's honest edge is not stock-picking (momentum does that better). It is
> knowing things price has not reflected yet. Concentrate it there.

**4.1 — Score the shadow book** `[x]`

`agent_proposals` already records AI-originated ideas that never execute. Score
them, so "would the AI have made money?" is answered with data. The only path to
ever promoting AI from filter to originator.

*Done.* `Ledger.scoreShadowBook(horizonDays=21)` computes the forward return of
each logged proposal from the candles this bot has persisted (JOINs
`agent_proposals` → `instruments` on `instrument_id`, finds the first close at/
after `created_at + horizon`, negates for SELL/SHORT), grouped by originator so
MOMENTUM (executed) and AI_COMPOSITE (shadow) are directly comparable; proposals
with no forward candle yet are skipped, so counts grow only as real data
accrues. `scripts/score_shadow_book.ts` (`npm run score:shadow`) prints the
table + a MOMENTUM-vs-AI verdict (now feeding the formal 4.3 rule). Covered by
`test/shadow_book_test.ts` (`npm run test:shadow`, in `test:unit`). No live
history yet → reports "no scorable proposals", as expected.

**4.2 — Event blackout** `[x]` ⭐ *The AI's best genuine job*

Don't hold into binary events the price has not discounted. Tail-risk reduction
is where a news-reading LLM genuinely beats a price-only system.
- *Note:* `hasUpcomingEarnings()` (B2) already blocks **entries** within 3 days
  of earnings. Extend to held positions and to non-earnings events.

*Done.* Generalised `hasUpcomingEarnings()` → `hasUpcomingEvent()` in
`MomentumStrategy.ts`:
- **Broadened the event set.** New `BINARY_EVENT_TYPES` set (EARNINGS, RESULTS,
  RATING, REGULATORY, MERGER, DEMERGER, AGM, BOARD_MEETING) — matched
  case-insensitively against `CorporateAction.type`, so any new binary type in
  the feed flows through the same blackout with no code change. Today's
  `corporate_actions.json` only carries EARNINGS (1,712 rows), so live behaviour
  is unchanged, but the door is open.
- **Extended to held positions.** The `rebalance()` exit loop now sells a held
  name ahead of its undiscounted binary event even when it is still in the
  momentum target (reason: `event blackout exit`). Previously the blackout only
  gated **entries**; a name we already owned rode straight into the coin flip.
- **Slot accounting stays honest.** `keepers` now excludes blackout names (they
  will be exited), so their freed capital is redistributed across the survivors
  rather than stranded — same discipline as the AI-veto path (1.2).
- **Config-driven window.** New `strategy.eventBlackoutDays` (env
  `EVENT_BLACKOUT_DAYS`, default 3; 0 disables) replaces the hard-coded 3-day
  literal in both entry and held-exit paths.
- **Tests.** New `testEventBlackout()` in `test/risk_regression_test.ts` drives a
  full `rebalance()` with a stubbed `LiveDataService`: proves a clean candidate
  enters, an EARNINGS candidate is skipped, a non-earnings RATING candidate is
  also skipped (generalisation), a held name in-target is exited before its
  event, and a held name with no event stays put. All pass.
- **Gate neutrality.** `npm run validate:momentum` re-run: byte-identical
  **36.99% annualized, +26.84pp over Nifty** — backtest caches carry no event
  data, so the blackout is a no-op there and cannot inflate the headline number.
  Its value is realised live, as intended: it trades a little return for a lot
  less left-tail exposure.

**4.3 — Promote or retire on evidence** `[x]`

After 12–18 months of shadow data, either widen the AI's authority or narrow it.
No indefinite limbo.

*Done.* Turned the advisory shadow-book verdict into a **written, auditable
decision rule** so the AI can never sit in limbo forever:
- New `src/server/AiAuthorityPolicy.ts` — pure `decideAiAuthority(scores,
  monthsObserved, cfg)` returning `PROMOTE | HOLD | RETIRE` with a
  human-readable rationale, the measured edge (pp), and an `evidenceSufficient`
  flag. Deliberately conservative: promotion needs a **full trading year**
  (`minMonths=12`), a **large sample** (`minScored=30`) AND a **material edge**
  (`edgePpToActOn=2.0`); a symmetric lag triggers RETIRE; everything else HOLDs.
  Pure and side-effect-free — it decides, it never executes (acting is a
  deliberate Phase 5 ladder step).
- New `Ledger.shadowBookMonths()` — months from the earliest logged proposal to
  now, feeding the evidence bar.
- `scripts/score_shadow_book.ts` (`npm run score:shadow`) now prints the formal
  4.3 verdict + rationale instead of the old one-line advisory.
- New `test/ai_authority_test.ts` (`npm run test:authority`, wired into
  `test:unit`) — 6 assertions covering: no-AI → HOLD, big edge but < minMonths →
  HOLD, big edge but < minScored → HOLD, material edge + full evidence →
  PROMOTE, sub-threshold edge → HOLD (no-action band), material lag → RETIRE.
  All pass. No live shadow history yet, so `score:shadow` still reports "no
  scorable proposals" — the rule activates as real data accrues.

**4.4 — Event-driven news monitor (defensive exit + opportunistic entry)** `[x]`

> **Status: built. Focus is now the DEFENSIVE path only; opportunistic is
deprecated (off by default).** Validation below. The AI defensive exit is the
one AI feature worth pursuing — the live system reacts to REAL negative news to
protect held positions between rebalances.

> Closes the "monthly gap": a pure monthly-rebalance book is blind to news
> between rebalances — it rides a crash to the stop-loss (defensive miss) and
> misses a strong mover until next month (opportunistic miss). This layer reacts
> to news **as it happens**, without the cost of literal hourly polling.

**Design (poll → diff → detail → AI → strategy):**

```
Google News RSS (watchlist)  --poll 15 min-->  diff vs seen  --new news-->
  ├─ HELD symbol  -> TinyFish detail -> AI sentiment -> strategy: EXIT/SHRINK if negative   (defensive)
  └─ non-held momentum candidate -> AI sentiment -> strategy: OPPORTUNISTIC ENTRY if breakout (pull-forward)
```

**Components:**
1. **News feed poller** — polls Google News RSS per watchlist symbol (reuses
   `NewsSentimentEngine.fetchGoogleNewsArticles`), diffs against a **seen-article
   store** (persisted URL/title per symbol) to detect *new* items. Interval
   **15 min** (configurable).
2. **Seen-article store** — SQLite table (or persisted map) of seen article URLs
   per symbol, so a story is processed once, not re-triggered every poll.
3. **Detail fetcher** — on new news, fetch the article body via TinyFish
   (`NewsSentimentEngine.fetchPage`) for context.
4. **AI sentiment** — score the new news via the LLM (`aiSentiment`), producing a
   per-symbol sentiment score.
5. **Strategy trigger** — two paths, both routed through `MomentumStrategy` so
   the RiskEngine stays the final arbiter:
   - **Defensive exit/shrink**: if a HELD symbol's new-news sentiment <
     `NEWS_MONITOR_SENTIMENT_EXIT_THRESHOLD`, momentum exits or shrinks that
     position immediately (news-risk exit) — the crash-catch that prevents the
     stop-loss drag.
   - **Opportunistic entry**: if a non-held **momentum candidate** (already in
     the ranking, near the top) shows a strong price breakout **and** positive
     news, enter a **partial position** early — a pull-forward of the monthly
     entry, confirmed/finished at the next rebalance. **DEPRECATED — off by
default (`NEWS_MONITOR_OPPORTUNISTIC_ENABLED=false`).** It added churn/cost and
is an AI-as-originator signal role that failed validation.

**Authority model (unchanged):** momentum stays the originator. The opportunistic
entry only fires on symbols already in the momentum ranking; the AI can boost/shrink
but never invent a symbol outside it (out-of-ranking ideas stay shadow-only). The
defensive exit is a risk overlay on held positions.

**Cost:** event-driven — LLM calls are proportional to *news volume*, not time.
Production-friendly with a dedicated LLM account; throttled in dev/testing via
`NEWS_MONITOR_ENABLED` / `NEWS_MONITOR_INTERVAL_MS`.

**Config (new):** `NEWS_MONITOR_ENABLED`, `NEWS_MONITOR_INTERVAL_MS` (default
900000 = 15 min), `NEWS_MONITOR_SENTIMENT_EXIT_THRESHOLD`,
`NEWS_MONITOR_OPPORTUNISTIC_ENABLED`, `NEWS_MONITOR_OPPORTUNISTIC_PARTIAL_PCT`.

**Validation (before live):**
- Defensive path: does exiting on negative news avoid crashes (lower left-tail)
  without excessive whipsaw? Walk-forward on the 5-year CSV data.
- Opportunistic path: does early entry on breakouts beat waiting for the monthly
  rebalance? Walk-forward, net of the extra turnover/costs.
- Both must pass walk-forward before the ladder promotes them (Phase 5).

**Validation result (Adhoc 20–22):** the defensive path was walk-forwarded
(momentum vs momentum + defensive, all 37 rolling 12-month windows) and
tested with REAL date-scoped news over 4 non-overlapping windows. Findings:

- **Price-proxy trigger** (exit on any 5% drop): cuts maxDD 40.2% → 24.2% but
  halves return (21.97% → 11.83% annualized) and worsens Sharpe (0.80 → 0.69);
  keeps returns in only 8/37 windows. Not worth it.
- **Real-news confirmation**: only 12/48 (25%) of sharp drops are genuinely
  news-driven (75% whipsaw) — real news fires ~4x less than the price proxy.
  The premise holds.
- **But a real-news-only defensive book does NOT consistently help**: aggregate
  annualized 40.82% → 26.24%, Sharpe 1.13 → 0.89, cuts maxDD in only 2/4
  windows, keeps returns in only 1/4. Genuine news crashes often mean-revert, so
  selling on bad news locks in a dip that would have bounced.

**Verdict: keep the defensive exit gated OFF (`NEWS_MONITOR_ENABLED=false`).**
The AI defensive layer does not reliably earn its seat. The honest end of
pursuing AI features: deterministic momentum remains the only thing that beats
the market; AI sentiment/news does not add value as a signal, an overlay, or a
defensive trigger.

---

## Phase 5 — Go-live ladder

**5.1 — Kill criteria, written before real money moves** `[x]`

Max drawdown, consecutive losing months, tracking error vs Nifty.

*Done.* New `src/server/GoLiveLadder.ts` codifies the pre-committed kill
criteria as pure, testable logic:
- `evaluateKillCriteria()` — three objective conditions with defaults sized to
  the walk-forward evidence: **max drawdown 45%** (every profitable config here
  carried ~40–48%, so this is the ceiling to size *around* via the cash reserve
  from 0.4/5.1, not a target to accept), **3 consecutive losing months**, and
  **40% tracking error vs Nifty**. Returns the breached criteria + the measured
  losing-month streak. A breach means "stop, go back to paper, diagnose" — never
  auto-overridden.
- `consecutiveLosingMonths()` — counts only the trailing run of negative months.
- New `Ledger.realizedPnlByMonth()` — realized P&L grouped by IST month, feeding
  the streak criterion.
- Note: the RiskEngine already **enforces** daily / portfolio / monthly drawdown
  halts live (`RiskEngine.evaluate`); this module adds the two it did not watch
  (losing-month streak, tracking error) and unifies all of them into one honest
  operator dashboard: `scripts/go_live_status.ts` (`npm run status:golive`).
- Tests: `test/go_live_ladder_test.ts` (`npm run test:ladder`, in `test:unit`).

**5.2 — Capital ladder** `[x]`

Paper → shadow → ₹25k live → scale. Capital increases on evidence, never on a
good month.

*Done.* `CAPITAL_LADDER` in `GoLiveLadder.ts` — four rungs (PAPER → SHADOW →
LIVE_25K → SCALE), each with a plain-English **evidence gate** you must clear to
advance (e.g. LIVE_25K needs 3+ clean paper/shadow months with after-tax return
beating Nifty; SCALE needs 6+ live months, still beating Nifty after tax, within
the drawdown ceiling). `recommendLadderStage()` is one-directional on bad news:
**any** kill breach recommends dropping straight to PAPER from any rung and
re-earning each step — capital never resumes on a hunch. `npm run status:golive`
prints the ladder, the current stage (`LADDER_STAGE` env), and the
recommendation. Covered by `test:ladder`.

---

## Phase 6 — A-core, B-earned: shadow blackboard promotion path `[x] — REJECTED & REMOVED`

**Status: TRIED, REJECTED, CODE REMOVED (2026-08-20).**

The idea: let a multi-signal AI blackboard (momentum + mean-reversion + regime)
run in shadow and earn a co-originator seat only if it beat momentum
out-of-sample. The framework was built and tested honestly, and the answer was
**no**:

- **Full-window backtest** (2022-09 → 2026-08): the blackboard blend (B) badly
  underperformed momentum (13.88% vs 31.54% annualized) — it dilutes the edge.
- **Regime-conditional overlay (C)** looked promising in one backtest (+4.3pp),
  but the **5-year walk-forward** (`shadow_blackboard_walkforward.ts`) showed C
  beats A in only **17/37 rolling windows (45.95%)** — the edge was over-fit to
  the 2025 H1 risk-off cluster, not robust.

**Verdict: the blackboard does not earn a co-originator seat, and its
regime-conditional risk-off role does not reliably beat momentum.** All Phase 6
code was stripped: `signals/meanReversion.ts`, the three shadow-blackboard
harnesses, the overlay logic in `MomentumStrategy.ts`, the config fields, and
their tests/scripts. Momentum (A) remains the sole validated originator.
Full detail in `docs/plan/adhoc-change.md` (Adhoc 12–19).
