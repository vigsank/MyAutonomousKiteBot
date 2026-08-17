# Strategies & Techniques — Deep Analysis

This is a deep-dive for a technical reader (a colleague asking *"what strategies
and techniques are used across this project?"*). It covers **every** strategy,
signal, risk technique, cost/tax model, governance rule, agent-architecture, and
validation method in the repository — and is explicit about what is **wired into
the runnable bot** versus what is **designed / backtested but not wired**.

> **Orientation.** The repo contains **two strategy systems**:
>
> 1. **The runnable bot** — `MarketAgent`'s regime-adaptive RSI/ADX/ATR strategy
>    plus the agent fleet, wired in `src/server/index.ts`. This is what actually
>    trades (on paper) today.
> 2. **The momentum engine** — `MomentumStrategy` + `signals/momentum.ts` +
>    `LiveTrader` + `OrderGuard` + `Reconciler` + `StrategyOptimizer` +
>    `StrategyAdaptation`. This is **designed, backtested, and has migrations,
>    but is NOT wired into `index.ts` and does not currently type-check** against
>    the current `AppConfig`/`Ledger` surface. Everywhere below, this is flagged
>    as **designed-but-not-wired**.

Throughout, "wired" means instantiated by, or reachable from, the runnable
entrypoint `src/server/index.ts`. Everything else is source that exists and is
tested by harnesses but is not part of the live bot.

---

## Table of contents

1. [Momentum strategy (designed / backtested, NOT wired)](#1-momentum-strategy-designed--backtested-not-wired)
2. [MarketAgent: the runnable strategy brain](#2-marketagent-the-runnable-strategy-brain)
3. [AI layer: LLM providers, ensemble, reports, sentiment](#3-ai-layer-llm-providers-ensemble-reports-sentiment)
4. [Risk management techniques](#4-risk-management-techniques)
5. [Cost & tax modelling](#5-cost--tax-modelling)
6. [Go-live governance](#6-go-live-governance)
7. [Agent-fleet blackboard architecture](#7-agent-fleet-blackboard-architecture)
8. [Technical indicators](#8-technical-indicators)
9. [Validation methodology](#9-validation-methodology)

---

## 1. Momentum strategy (designed / backtested, NOT wired)

**Status: designed, validated in backtests, migrations shipped — but NOT wired
into the runnable entrypoint `index.ts`, and does not type-check against the
current `AppConfig`/`Ledger` surface.** The design lives in
`src/server/MomentumStrategy.ts` + `src/server/signals/momentum.ts` (the pure
signal math) and is exercised by the `test/backtest/*` harnesses.

### 1.1 The signal: cross-sectional momentum

`signals/momentum.ts` ranks symbols against each other (cross-sectional, not
time-series) by trailing **12-month** momentum, **skipping the most recent
month** to avoid short-term reversal:

```
momentum = close(t − skip) / close(t − lookback − skip) − 1
         = close(t − 1m) / close(t − 13m) − 1
```

The skip month is deliberate: 1-month-reversal means a name that just ran up is
as likely to pull back; skipping it isolates the persistent (12-month) relative
strength. The strategy **longs the top N names**, rebalanced **monthly**.

### 1.2 Top-N portfolio & rank hysteresis

- `topN` is the number of names held, validated to the range **5–10** (the floor
  is 5, not 3, because sub-5 books scored worse OOS *and* are not executable
  under the 15% single-stock cap). It is read from a param store, falling back
  to config.
- **Rank hysteresis** (`selectWithHysteresis`): an incumbent keeps its slot
  until it falls out of the top `topN + band`, rather than being swapped out the
  moment it slips one rank. This stops a full round trip (≈0.31% cost + a reset
  of the holding-period clock) for a rank change that carries almost no
  information. New entrants are still taken strictly from the top of the
  ranking, so the signal itself is unchanged — the band only makes the book
  *sticky*.

### 1.3 Liquidity floor

`applyLiquidityFloor` drops names whose **average daily traded value** (close ×
volume, trailing window) is below `momentumLiquidityFloorInr`, because a
cross-sectional book buys winners and thin winners are exactly the ones that
cannot be exited at size. It **fails open** when volume data is absent and is a
no-op when the floor is 0 (default = disabled), so it never silently empties the
universe.

### 1.4 Event blackout

`hasUpcomingEvent` avoids entering names with a scheduled corporate event in
`eventBlackoutDays` (types in `eventBlackoutTypes`, e.g. splits, bonuses, rights
issues, earnings). It trades a little return for a lot less left-tail exposure —
a live safeguard; backtest caches carry no event data so the headline backtest
is unaffected.

### 1.5 Risk-off gate & sector diversification

- **Risk-off gate** (`momentumRiskOff`, off by default): if the **median**
  momentum of the ranked universe is negative (broad weakness), the strategy
  goes to cash. It was found to reduce returns in validation (missed recoveries)
  so it ships disabled as a risk lever.
- **Sector diversification** (`diversify`): caps the number of names per sector
  so the book does not silently concentrate into one hot sector.

### 1.6 Position sizing

`quantityFor` sizes each name against `(total capital × (100 − cash reserve %)) /`
slots, then clamps by available capital and the hard single-stock cap. Sizing is
equal-weight by slot (not momentum-weighted), which keeps per-name risk bounded.

### 1.7 Validation record (what the backtests show)

On real Yahoo data over ~5 years, the shipped config (topN 5–10, hysteresis) is
reported at roughly **+37% annualized net, ~+27pp over the Nifty 50**, ~65%
positive months, beating Nifty in 6/8 walk-forward windows; the same config
without hysteresis does not pass the walk-forward gate (≈+22%). These are the
numbers the plan's `validate:momentum` claims were based on. **Caveats:**
current-listed universe only (survivorship bias — see §9), pre-tax in places,
and the npm script that produces the headline is not present in the current
`package.json` (see `CAPABILITIES.md` §5.3).

> Because this engine is not wired, none of the above is currently being
> executed live. It is the validated blueprint for the next phase.

## 2. MarketAgent: the runnable strategy brain

**Status: WIRED.** This is the strategy the runnable bot actually executes
(paper), and the focus of `docs/CAPABILITIES.md`.

`MarketAgent` (`src/server/MarketAgent.ts`) is a **regime-adaptive, intraday**
technical strategy driven by RSI(14), ADX(14), ATR, SMA structure, Bollinger
bands, and ORB. It receives ticks via a **3-second coalescing loop**
(`onTicks`), aggregates them into bars, updates indicators on bar close, and
evaluates every enabled watchlist symbol on each bar.

### 2.1 Regime classification & mode selection

`classifyRegime` buckets each symbol into `trending_up`, `trending_down`,
`ranging`, or `volatile` using ADX vs a trend threshold, SMA fast/slow
relationship, and an ATR/price volatility ratio. `selectModeForRegime` maps the
regime to a mode:

| Regime | Mode | Rationale |
|---|---|---|
| ranging | mean_reversion | buy oversold, sell overbought |
| trending_up | pullback_trend | buy dips in the uptrend |
| trending_down | none | stay flat — don't catch falling knives |
| volatile | mean_reversion | oversold bounce even in high vol |

This replaces a fixed single mode: the bot adapts its strategy to what the
market is doing.

### 2.2 Entry logic (per mode)

- **mean_reversion** (`checkEntry`): buy when RSI(14) < `rsiEntryThreshold`
  (optionally with a Bollinger lower-band + RSI confirmation,
  `bollingerEntry`); a `deepOversoldBuffer` can override the ADX regime filter
  for very oversold bounces. Exits at the ATR target or RSI overbought.
- **pullback_trend** (`checkEntryPullback`): buy a pullback to the slow SMA when
  the fast SMA is above the slow SMA (uptrend structure) and RSI is
  < `pullbackRsiEntry`.
- **breakout** (`checkEntryBreakout`): buy above the prior N-bar high
  (`breakoutLookback`), with volume confirmation and an ATR trailing stop.

### 2.3 Gates before a trade is proposed

- **Regime gate** + **signal-confidence floor** (`MIN_SIGNAL_CONFIDENCE`):
  evidence-based confidence from indicator/sentiment agreement.
- **Minimum reward:risk** (`MIN_RISK_REWARD`): target vs stop distance.
- **ORB filter** (`orbEnabled`): no entries until the first-N-minute range is
  established, and longs must clear the opening-range high.
- **Daily-report veto**: `loadReportBias` reads the latest AI daily report and
  `reportBlocksEntry` blocks AVOID-rated symbols until the report refreshes.
- **Circuit breaker**, **cooldown**, **time-of-day** window, and correlation /
  concentration caps.

### 2.4 Sizing & risk-at-stop

`stopDistance` mirrors the `RiskEngine.stopLossPrice`: the ATR-based stop (`ATR ×
multiplier`), never wider than the fixed `stopLossPercent` hard cap. `sizedQuantity`
sizes to a **risk-per-trade budget** (`riskAtStop = qty × stopDist` must be ≤ a
% of capital), optionally using **fractional Kelly** (`kellyEnabled`) bounded by
that hard cap. `tradeCooldownMinutes` is an immutable gate between trades.

### 2.5 Execution path

`proposeTrade` → `executeProposedTrade`:
1. **Hard risk gate** (`RiskEngine.evaluate`) — the AI can never override this.
2. **Optional LLM analyst** (soft): AVOID or `riskScore ≥ threshold` rejects.
3. **HITL**: trades above `autoTradeTicketThreshold` ask Telegram; below, they
   auto-execute. Serialized via a `tradeQueue` so concurrent proposals can't
   both pass the capital gate.
4. **PaperTrader** simulates the fill (net of costs) and records it.

### 2.6 News loops

`runNewsLoop` (10-min) fetches + scores sentiment per symbol; `runNewsDetailLoop`
(5-min) pulls deeper TinyFish details when configured. Cached sentiment feeds the
confidence score and the analyst prompt.

## 3. AI layer: LLM providers, ensemble, reports, sentiment

**Status: WIRED** (sentiment, analyst, daily reports all run in the live bot;
`AiAuthorityPolicy` shadow-book governance is designed-but-not-wired).

### 3.1 LLM providers (`AppConfig.resolveLlm`)

`LlmProvider = 'openai' | 'ollama' | 'litellm' | 'none'`, selected by
`LLM_PROVIDER`. When unset, auto-detect order is **Ollama → LiteLLM → OpenAI**
(whichever credentials are present). All expose an OpenAI-compatible API. Key
knobs:

- `OLLAMA_BASE_URL` / `OLLAMA_API_KEY` / `OLLAMA_MODELS` / `OLLAMA_MODEL`.
- `LITELLM_BASE_URL` / `LITELLM_API_KEY` / `LITELLM_MODEL` / `LITELLM_MODELS`
  (any OpenAI-compatible proxy).
- `OPENAI_API_KEY` / `OPENAI_MODELS` / `OPENAI_MODEL`.
- `LLM_JSON_MODE` (defaults: off for Ollama, on for OpenAI/LiteLLM),
  `LLM_TIMEOUT_MS` (60s default) so a hung model can't block a run,
  `LLM_ENSEMBLE_MODELS` / `LLM_FAST_ENSEMBLE_MODELS` (validated subsets ≤3).

`LlmManager` exposes `chat`, `chatWithMeta`, and `chatEnsemble`, plus a
`fast`/`depth` ensemble-mode switch and per-call tracing.

### 3.2 Ensemble consensus voting

Multiple models respond to the same prompt and their outputs are combined:

- **Sentiment** — a single model scores `[-1,+1]` (fast path).
- **Analyst verdict** (`analystVerdict`) — AGREE/CAUTION/AVOID per model;
  consensus **escalates to the most conservative** (any AVOID ⇒ AVOID; else any
  CAUTION ⇒ CAUTION) and **averages the risk score**.
- **Holdings verdict** (`holdingsVerdict`) — HOLD/TRIM/EXIT; escalates to the
  most aggressive action and averages risk.
- **Daily report** — see §3.4.

### 3.3 News sentiment scoring & sources

`NewsSentimentEngine` gathers headlines from **Google News RSS** (keyless,
always-on) and **TinyFish** live search (`TINYFISH_API_KEY`, `TINYFISH_MAX_RESULTS`
= 5, `TINYFISH_TIMEOUT_MS` = 15s), including a date-scoped backfill. When an LLM
is configured it scores the headlines to `[-1,+1]` with a structured JSON schema;
otherwise it falls back to a **keyword heuristic** (bullish/bearish word lists).

**Prompt-injection defense**: headlines are labelled as *data, not instructions*,
stripped, and wrapped in explicit `HEADLINES START/END` markers; the model is
instructed to ignore any instructions the headlines contain. Invalid JSON falls
back to the heuristic.

### 3.4 The 3-stage daily report cycle (`DailyReportEngine`)

Driven by `AgentsRuntime` at three IST windows — `pre_open` (09:00),
`mid_session` (11:00), `pre_close` (15:15). Each stage:

1. Gathers **global macro** readings (`fetchGlobalMacro`) + **macro headlines**
   (TinyFish primary, Google RSS fallback).
2. **Analyzes each symbol** deterministically (price, prev-day change, sentiment,
   holding status, weight % of capital, classic pivots, 7-day S/R) — the LLM is
   never asked to compute numbers.
3. Captures a **capital snapshot** (`RiskEngine.capitalSnapshot`).
4. Asks the **ensemble** for structured JSON matching a strict schema
   (`market_regime`, `capital_management`, `stocks_to_watch`,
   `portfolio_recommendations[]` with action bias / quantity / allocation / entry
   strategy / reasoning / invalidation condition, `summary`).
5. **Merges by consensus** (`mergeReports`): average regime score & sentiment,
   majority action-bias label, union of stocks-to-watch, averaged quantities/
   allocations, concatenated reasoning. This deliberately avoids trusting the
   most verbose report (which biases toward hallucination / over-trading).
6. **Clamps** suggested allocations/quantities to `capital.available` so the
   report is never misleading (the RiskEngine enforces the real size regardless).
7. **Persists** the report and an `llm_traces` row for audit.

`Ledger.getLatestReport()` exposes the latest report, consumed by `MarketAgent`
(for the report veto) and by the momentum engine / agents for context.

### 3.5 Shadow book + AiAuthorityPolicy (designed-but-not-wired)

A governance idea from the plan: AI ideas are logged to an `agent_proposals`
shadow book (`recordAgentProposal`) and scored against the executed momentum
book (`scoreShadowBook`). `AiAuthorityPolicy.decideAiAuthority` turns that
evidence into a written, auditable verdict:

- **PROMOTE** — AI shadow ideas beat momentum by ≥ `edgePpToActOn` (default
  2pp) over ≥ `minMonths` (12) with ≥ `minScored` (30) proposals.
- **HOLD** — insufficient evidence, or edge inside the ±2pp no-action band.
- **RETIRE** — AI lagged momentum by ≥ 2pp on a sufficient sample.

Deliberately conservative (promotion needs a long track record AND a material
edge) so a lucky run can't hand the AI the keys. **Not wired** — it requires the
`agent_proposals` table (migration V013 exists) and `Ledger.scoreShadowBook`,
which are not yet in the current `Ledger` surface.

## 4. Risk management techniques

### 4.1 `RiskEngine` — the immutable gatekeeper (WIRED)

The AI/strategy can NEVER override `RiskEngine.evaluate()`. Gates (each a
hard block, logged to `risk_events`):

- **Ticket size > 0**.
- **Per-trade allocation cap** (`maxTradeAllocation`) — absolute ₹ cap.
- **Single-stock cap** (`maxSingleStockPct`) — a position must not exceed % of
  total capital.
- **Per-symbol add cap** — an ADD must not push the position's total notional
  past the single-stock cap (prevents stacking a single oversized position).
- **Sector cap** (`maxSectorWeightPct`) — total notional per sector ≤ % of
  capital (only enforced when the symbol maps to a sector in the watchlist).
- **Daily drawdown** (`maxDailyDrawdown`) — real + unrealized P&L today.
- **Portfolio drawdown** (`maxPortfolioDrawdownPct`) — cumulative realized loss
  vs capital.
- **Monthly drawdown** (`maxMonthlyDrawdownPct`) — protects month-end P&L.
- **Single-trade risk-at-stop** (`maxRiskPerTradePct`) — `qty × stopDist` ≤ % of
  balance, on new entries only.
- **Capital capacity + cash reserve** — after the trade, free capital must stay
  ≥ `minCashReservePct` of total (preserves liquidity).

`capitalSnapshot()` returns `{total, used, pending, reserve, available}` for the
advisory layer; the RiskEngine re-validates against live capital at execution.
`evaluateOption` applies premium/exposure/capital caps to options.

### 4.2 `OrderGuard` — order idempotency (designed-but-not-wired)

Because a bot re-runs the same decision many times (scheduler, retries,
restarts), `OrderGuard` turns a trade intent into a deterministic key
`sha1(symbol|exchange|side|intent|timeBucket)` and **claims it atomically in the
database before execution**. Whoever wins the claim executes; duplicates are told
to stand down. Quantity is deliberately NOT in the key (a retry that re-sizes
must still be recognised as the same intent). `once()` releases the claim on
failure so a legit retry can proceed.

### 4.3 `Reconciler` — ledger ⇄ broker drift (designed-but-not-wired)

The ledger is the bot's belief; the broker is the truth. `Reconciler` compares
open positions (MISSING_AT_BROKER / MISSING_IN_LEDGER / QUANTITY_MISMATCH /
PRICE_DRIFT / CASH_MISMATCH), reports drift, and **never auto-corrects** (silent
rewrites would erase the evidence of the bug). `HALT_ON_DRIFT` (default on)
blocks new entries on a drifted book. Inconclusive runs (broker unreachable) do
NOT block.

### 4.4 `LiveTrader` — shadow / live execution (designed-but-not-wired)

The only place that could send a real order. The paper ledger stays the system
of record in every mode; going live changes only whether the broker call fires.
Four gates must all pass: `ALLOW_LIVE_ORDERS=true`, `LIVE_SHADOW_MODE=false`
(defaults true — payload logged only), clean reconciliation, and notional ≤
`MAX_LIVE_ORDER_VALUE` (a blast-radius cap independent of the RiskEngine).
Idempotency is enforced by the OrderGuard before execution.

### 4.5 `StrategyAdaptation` — de-risk on realized outcomes (designed-but-not-wired)

With only ~50 closed trades/year, re-deriving the edge from outcomes is fitting
noise. So this layer does **not** touch the entry rule — it adapts **exposure**
via a single `riskMultiplier` in `[0.4, 1.0]` (can only REDUCE size vs the caps):

- Negative expectancy (`expectancyPct < 0`) scales down proportionally.
- A **4+ consecutive-loss streak** steps down 15% per loss beyond the trigger.
- Below `MIN_SAMPLE` (12) closed trades it stays at full size (no signal).

### 4.6 `StrategyOptimizer` — walk-forward topN (designed-but-not-wired)

Auto-re-tuning `topN` (only, and bounded to 5–10) using **walk-forward**
selection: score each candidate on a TRAIN window, record only its unseen TEST
return, roll forward. Guardrails: `MIN_OOS_WINDOWS` (6), hard `PARAM_BOUNDS`,
and an `IMPROVEMENT_MARGIN` (2pp) so noise can't cause parameter churn. The
edge itself (12-month lookback, skip-1, monthly rebalance) is deliberately NOT
auto-tuned — it is the validated hypothesis.

## 5. Cost & tax modelling

### 5.1 Paper fill realism (WIRED)

`PaperTrader` applies adverse **slippage** and NSE-style **charges**: brokerage
+ statutory + GST (`PAPER_SLIPPAGE_BPS=2`, `PAPER_BROKERAGE_BPS=3`,
`PAPER_BROKERAGE_MAX=20`, `PAPER_STATUTORY_BPS=10`, `PAPER_GST_PCT=18`), so
paper P&L reflects what a live account would keep. The momentum backtests also
charge one-way costs and model turnover (`Σ|Δw|` with weights carried across
rebalances) — a fix that made turnover-reduction techniques (like hysteresis)
visible.

### 5.2 Indian capital-gains tax (`Tax.ts`, designed-but-not-wired into live)

Every P&L before this was pre-tax; for a monthly-rebalancing strategy that
overstates take-home by ~a fifth and hides a real decision (a lower-gross,
lower-turnover strategy can take home MORE because more gains cross the 12-month
line). The model:

- **STCG**: holdings held < 12 months, taxed at **20%** (rate effective
  23-Jul-2024).
- **LTCG**: holdings held ≥ 12 months, taxed at **12.5%** on the amount above a
  **₹1,25,000 annual exemption**.
- **Netting**: losses in one bucket offset gains in the other within the same
  financial year (why a loss-making month can legitimately reduce accrued
  liability).
- **Financial year** (`financialYear`) is **1 April – 31 March** (India's FY), so
  the exemption and netting align with the tax year, not the calendar year.
- **Per-lot holding clock**: `monthsHeld` is calendar-month aware (a holding is
  long-term only once it crosses the 12-month line); `bucketRealizedGains`
  buckets closed lots by holding period.

Deliberately NOT modelled: loss carry-forward, surcharge/cess, optimal set-off
ordering, outside income. It's an accrual estimate for honest reporting and
cadence comparison — not tax advice. Used by the momentum backtest harnesses
(e.g. `leak_attribution`); migration V014 adds tax accrual tables.

## 6. Go-live governance

### 6.1 Kill criteria (`GoLiveLadder.evaluateKillCriteria`, designed-but-not-wired)

Pre-committed, objective conditions that STOP the bot (a KILL means *stop
naming, go back to paper, diagnose* — never auto-overridden):

- **Max drawdown** 45% (peak-to-trough) — chosen from the walk-forward evidence
  that even profitable configs carried ~40–48% DD, so 45% is a ceiling to size
  AROUND, not accept.
- **3 consecutive losing months** (`maxConsecutiveLosingMonths`) — protects
  compounding.
- **40% tracking error vs Nifty** (`maxTrackingErrorPct`) — a momentum book
  shouldn't wander arbitrarily far from its benchmark.

The RiskEngine already enforces daily/portfolio/monthly drawdown halts live; the
ladder adds the two it doesn't watch (losing-month streak, tracking error) into
one operator dashboard.

### 6.2 Capital ladder (`CAPITAL_LADDER`, designed-but-not-wired)

Capital rises on **evidence**, never on a good month. Any kill breach drops you
back to PAPER, and you re-earn each rung:

| Stage | Capital | Entry gate |
|---|---|---|
| PAPER | 0 | Default; strategy passes OOS validation vs Nifty |
| SHADOW | 0 | Paper stable 1+ mo AND the shadow book is accruing |
| LIVE_25K | ₹25k | 3+ clean paper/shadow months, after-tax return beats Nifty |
| SCALE | ₹100k | 6+ live months, after-tax beats Nifty, DD within ceiling |

`recommendLadderStage` is one-directional on bad news (any kill ⇒ recommend
PAPER). The operator dashboard lives in `scripts/go_live_status.ts` (not wired
to an npm script).

## 7. Agent-fleet blackboard architecture

**Status: WIRED** (fleet runs via `AgentsRuntime`; `AGENTS_ENABLED=false` by
default).

The fleet (`src/agents/`) implements a **blackboard** design:

- **`Blackboard`** — a shared, write-once, per-pass reasoning surface. As each
  agent completes, the orchestrator publishes its typed payload; downstream
  agents **read** it instead of recomputing (e.g. `sentiment`, `sector_rotation`,
  `market_breadth` previously each called `sentimentFor()` over the whole list).
  Writes are per-agent (reproducible & attributable); reads are total (an agent
  degrades, never takes down the pass).
- **`registry`** — the full fleet across domains A–H; every `run` is wrapped so
  a thrown agent becomes a `failed` result.
- **`orchestrator.runPass`** — dependency-ordered execution: parallel agents with
  deps satisfied run concurrently; sequential agents run in order. Cycles / unmet
  deps fail safely.
- **`scheduler`** — IST market-open awareness: the cadence pass holds off for the
  first ~75 minutes after the 09:15 open (skipping `strategist`/`execute`).
- **`probe`** — per-symbol probe: fetch news, optionally fetch the top article's
  page content, score sentiment, persist articles + a probe-run record.

Domains (from `src/agents/types.ts`): **A** data ingestion (`history_data`,
`live_quote`, `instrument_master`, `order_history`, `holdings`,
`positions_margins`, `option_chain`); **B** technical (`indicator`,
`trend_regime`, `support_resistance`, `volume_profile`, `candlestick_pattern`,
`chart_pattern`, `momentum_divergence`); **C** fundamentals/context (`news_feed`,
`web_search_news`, `earnings_calendar`, `macro_sentiment`, `analyst_ratings`);
**D** sentiment synthesis (`sentiment`, `sector_rotation`, `market_breadth`);
**E** portfolio/risk (`holdings_exposure`, `margins_capital`, `correlation`,
`drawdown_monitor`, `holdings_review`); **F** decision golden path (`regime`,
`screener`, `validator`, `strategist`, `risk_precheck`, `execute`); **G**
post-trade (`trade_journal`, `performance_attribution`, `post_trade_review`,
`daily_report`); **H** governance (`risk_watchdog`, `data_integrity`,
`hallucination_guard`, `audit_trace`, `token_budget`).

The decision path (domain F) is real: the `strategist` computes an A2A-style
composite score `0.5·sentiment + 0.3·indicator + 0.2·regime`, picks the strongest
`|composite| > 0.2`, and builds a `TradeProposal`; `execute` runs it through the
RiskEngine and paper-executes (or defers to HITL above the threshold). Many
agents are lightweight or summary-only (e.g. `validator` is a stub, `regime`
notes an LLM synthesis is planned), and several are data-gathering rather than
decision-making — the fleet is a scaffold that grows.

## 8. Technical indicators

Indicators are computed in **deterministic Node code, never by the LLM** (the
LLM is passed numbers as context — a division-of-responsibility principle).

| Indicator | Where / notes |
|---|---|
| **RSI(14)** | `MarketAgent`, agents (`domainF` via `@debut/indicators`). Mean-reversion entry/exit thresholds; confidence input. |
| **ADX(14)** | `MarketAgent` regime classification + trend threshold (`adxTrendThreshold`, default 25). |
| **ATR** | `MarketAgent` stop distance, target, breakeven ratchet, position sizing, and OptionsEngine volatility. |
| **SMA fast/slow** | `MarketAgent` pullback/trend structure (fast>slow = uptrend). |
| **Bollinger Bands** | `MarketAgent` mean-reversion confirmation (buy below lower band + RSI oversold). |
| **Opening Range (ORB)** | first-N-minute high/low gate for breakouts. |
| **Pivots** | `TechnicalIndicators.computePivots` — classic floor-trader pivot + R1/R2/S1/S2 from prev-day OHLC; fed to the daily report. |
| **Support/Resistance** | `computeSupportResistance` — 7-day low/high zones; fed to the daily report. |
| **Kelly fraction** | `kellyFraction(p, b, scale)` — fractional Kelly `f = p - (1-p)/b`, scaled (default 0.5) and bounded by hard caps (`MarketAgent.sizedQuantity`). |
| **Momentum (12m, skip-1m)** | `signals/momentum.ts` — cross-sectional rank, not a technical oscillator. |

## 9. Validation methodology

### 9.1 Walk-forward / out-of-sample (OOS)

The core rule (plan): **nothing ships on plausibility** — every strategy change
must survive out-of-sample validation or it is reverted.

- **For the live signal engine** (`npm run validate:strategy`, WIRED): score the
  live signal engine on rolling OOS folds **net of costs**; require ≥30 OOS
  trades, positive net expectancy + return, and edge in >50% of folds. Prints a
  blunt `VALIDATED`/`NOT VALIDATED` verdict.
- **For the momentum engine** (`test/backtest/momentum_walk_forward.ts`, designed):
  sweep topN × hysteresis band × cadence; select params on TRAIN windows, score
  only on unseen TEST windows; report annualized net return, positive months,
  and positive windows. The shipped config was selected this way.

### 9.2 Benchmark: Nifty 50

Momentum backtests compare against the **Nifty 50 over the same months**, and
excess return (pp over Nifty) is the headline claim rather than absolute
return — so the edge is measured against the market the book would actually be
long in.

### 9.3 Leak attribution (`test/backtest/leak_attribution.ts`, designed)

A staged decomposition that walks from gross signal return down to take-home,
quantifying each friction as a cost line: **costs & slippage → cash reserve →
single-stock cap → AI news veto → capital-gains tax**. This measures the
mechanism's cost (e.g. the tax drag, the capital stranded by concentration
caps), so each technique is justified by what it actually costs/gains. The
published run shows roughly gross-to-net with tax and turnover as the biggest
leaks.

### 9.4 Survivorship-bias estimation (`test/backtest/survivorship_bias.ts`, designed)

Every headline is measured on the **current** watchlist — names that survived.
That inflates momentum returns (a name that later delisted is exactly the
population a current-listed universe can't contain). The harness **bounds** the
bias instead of pretending it away: it re-runs the backtest with the universe
**frozen** at a date (excluding names listed after the window start) and reports
the return gap as a **floor** on the true survivorship effect. The published
bound is ~**+0.5pp** — small, but a floor, and it cannot see delisted names, so
the true drag is likely somewhat larger. A green verdict is *necessary, not
sufficient*.

---

## Summary: wired vs designed-but-not-wired

| Component | Wired into runnable bot? |
|---|---|
| `MarketAgent` regime-adaptive RSI/ADX/ATR | ✅ wired |
| `RiskEngine` hard gates | ✅ wired |
| `PaperTrader` net-of-cost fills | ✅ wired |
| `NewsSentimentEngine` (Google RSS + TinyFish + LLM/heuristic) | ✅ wired |
| `LlmManager` (openai/ollama/litellm, ensemble, JSON mode) | ✅ wired |
| `DailyReportEngine` 3-stage reports + consensus | ✅ wired (via AgentsRuntime) |
| `AgentsRuntime` fleet + blackboard + probes | ✅ wired (`AGENTS_ENABLED=false` default) |
| `EodEngine` square-off / perf / overnight matrix | ✅ wired |
| `OptionsEngine` / `OptionsTrader` | ✅ wired (OFF by default) |
| `TelegramHITL` | ✅ wired (OFF unless creds present) |
| `KiteMcpClient` (read-only MCP) | ✅ wired |
| `MomentumStrategy` + `signals/momentum.ts` | ⛔ designed/backtested, NOT wired |
| `LiveTrader` / `OrderGuard` / `Reconciler` | ⛔ designed, NOT wired |
| `StrategyOptimizer` / `StrategyAdaptation` | ⛔ designed, NOT wired |
| `GoLiveLadder` / `AiAuthorityPolicy` / `Tax` | ⛔ designed (pure, tested), NOT wired |

> The two strategy systems are **not alternatives currently in competition** —
> the runnable bot runs `MarketAgent` today, and the momentum engine is the
> validated blueprint for a future phase. Before wiring it, the momentum stack
> must be reconciled to the current `AppConfig`/`Ledger` surface (see
> `CAPABILITIES.md` §5).
