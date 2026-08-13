# AI Agent-Driven Trading — Implementation Plan

> Status: **DRAFT — awaiting review.**
> Scope: evolve the current *code-driven* bot into an *AI-agent-driven* bot, where a fleet
> of agents analyses the market agentically and the **final execution call is the only thing
> that crosses the rule-based RiskEngine.**

---

## 1. Vision & goal

We started this project wanting **AI to trade for us**, with *some* code underneath. What was
built became a **pure code-driven** bot where the LLM is only a soft pre-trade filter. The real
goal is the inverse:

- **AI agents decide** what to trade (news, sentiment, patterns, holdings, regime).
- A **strategist agent** builds a concrete execution plan.
- That plan is the **only** thing that crosses the hard, deterministic **RiskEngine**.
- RiskEngine vetoes on size / concentration / drawdown / cost / circuit-breaker rules.

- Everything already built (indicators, PaperTrader, Ledger, cost model, circuit breakers,
TelegramHITL, LLM traces) becomes the **guardrail layer underneath** — repurposed, not wasted.
- **Precondition:** the agent layer is built on top of a *healthy code signal*. If the code
signal doesn't generate good candidates, the agents have nothing to act on (see Step 0 in §7).

---

## 2. Current state (the baseline we build on)

- **Stack:** Node.js/TS. `src/server/` bot + Express REST/WebSocket API; `src/client/` React
  dashboard; SQLite `Ledger`; migrations V001–V005.
- **Paper-first:** real Kite orders off by default. Mock SDK (`kite-paper-node`) when
  `PAPER_TRADING=true`.
- **Known working fixes:** serialized trade queue, drawdown-includes-unrealized, cost model
  (slippage + NSE fees), circuit-breaker persistence, LLM JSON validation, mock tick delivery
  (connect-before-subscribe ordering), live candles/signals/positions persist + served to UI.
- **Strategy reality (from A/B backtest, `ab_compare.ts`):**
  - Current strategy fired **1 trade in 30 days** across 8 symbols → sample too small for a
    verdict; the strategy **rarely triggers**.
  - Mean-reversion ≈ **21% win rate**; OOS walk-forward `NOT VALIDATED`.
  - This is a **signal-generation problem**, not a UI bug. Adding LLM context does NOT create
    entries the code never generates.
- **Tools/scripts:** `backtest`, `optimize`, `walk_forward`, `ab:compare`, `validate:strategy`,
  `audit:code/strategy/profit`.

**Implication:** the agent layer must be validated against this code baseline before it "drives."
We do not abandon the code-driven baseline — it is the floor and the A/B control.

---

## 3. The agent fleet (full menu — 8 domains)

> This is the *full* menu, not the MVP. Build in the order in section 7.
> Legend: source = `code` (deterministic) | `LLM` (judgment) | `MCP` (live account, read-only).

### Domain A — Data ingestion *(parallel; code/mock; MCP when live)*
| Agent | Source | Cadence |
|---|---|---|
| A1 History-data | code (mock/Yahoo/MCP) | 10 min |
| A2 Live-quote / LTP | code (streamer) | continuous |
| A3 Instrument-master | code | daily |
| A4 Order/trade history | MCP (live) | per pass |
| A5 Holdings / positions / margins | MCP (live) | per pass |
| A6 Option-chain / F&O data | MCP (live, future) | per pass |

### Domain B — Technical analysis *(parallel within B; depends on A; code computes → LLM interprets)*
| Agent | Source |
|---|---|
| B1 Indicator (RSI/SMA/ATR/ADX/Bollinger/VWAP) | code |
| B2 Trend / regime detection | code + LLM verdict |
| B3 Support/resistance (pivots, swing H/L) | code |
| B4 Volume / profile (VWAP dev, volume profile) | code |
| B5 Candlestick-pattern (names them) | code detect + LLM |
| B6 Chart-pattern (H&S, flag, cup-handle) | LLM hypothesize + code verify |
| B7 Momentum / divergence (RSI/MACD div) | code |

### Domain C — Fundamental & context *(parallel)*
| Agent | Source |
|---|---|
| C1 News-feed (RSS) | code |
| C2 Web-search news (TinyFish / Tavily) | LLM (batch) |
| C3 Earnings / announcements calendar | **LLM agentic search** |
| C4 Macro / market sentiment | **LLM agentic search** |
| C5 Analyst ratings / consensus | **LLM agentic search** |

### Domain D — Sentiment synthesis *(SEQUENTIAL after C)*
| Agent | Source |
|---|---|
| D1 Per-stock sentiment (news + search) | LLM |
| D2 Sector rotation / relative strength | code (RS rank) + LLM |
| D3 Market breadth / fear-greed | code + LLM |

### Domain E — Portfolio & risk context *(parallel)*
| Agent | Source |
|---|---|
| E1 Holdings exposure | MCP (live) |
| E2 Margins / available capital | MCP (live) |
| E3 Correlation / concentration | code |
| E4 Drawdown / PnL monitor | code |

### Domain F — Decision *(SEQUENTIAL — the critical chain)*
| Agent | Source |
|---|---|
| F1 Regime/context synthesis | LLM (merges A–E; on-demand web) |
| F2 Candidate screener (shortlist) | code |
| F3 Pattern/edge validator | LLM + code confirm; on-demand web |
| F4 Strategist — builds execution plan | LLM → strict JSON |
| F5 Risk pre-check (soft) | code |
| F6 **Final execution agent** | code → RiskEngine hard gate → PaperTrader/HITL |

### Domain G — Post-trade *(SEQUENTIAL after F6)*
| Agent | Source |
|---|---|
| G1 Trade journal | code |
| G2 Performance attribution | code + LLM |
| G3 Post-trade review (why it worked) | LLM |
| G4 Daily / monthly report | LLM |

### Domain H — Governance *(parallel, always-on, wraps everything)*
| Agent | Source |
|---|---|
| H1 Risk/safety watchdog (circuit breaker, drawdown) | code |
| H2 Data-integrity / validation | code |
| H3 Hallucination / consistency guard (re-checks outputs) | **LLM agentic search** |
| H4 Audit / trace (llm_traces) | code |
| H5 Token-budget / cost watchdog | code |

---

## 4. Orchestration — parallel vs sequential

```
A (data) ──► B (technical)
C (context) ──► D (sentiment)
E (portfolio)
B + D + E ──► F1 Regime ──► F2 Screener ──► F3 Validator ──► F4 Strategist
          ──► F5 Risk pre-check ──► F6 RiskEngine GATE ──► G (post-trade)
H (governance) wraps everything
```

- **Parallel (stage 1):** A, C, E — independent sources.
- **Parallel (after data):** B (once A done) and D (once C done) run alongside each other.
- **Strictly sequential (stage 2 — golden path):** `F1 → F2 → F3 → F4 → F5 → F6`.
  This is the only part that MUST be serial.
- **Always-on:** H. **After execution:** G.

**Golden path:** `Data → Indicators → (News→Sentiment ‖ Holdings) → Regime → Screener →
Validator → Strategist → RiskEngine → Execute`.

---

## 4.5 Probe Agent — 3× daily market-window runs

A scheduled **probe agent** that runs **three times per Indian trading day** to give the user
(and the bot) a strong, sentiment-backed verdict at each key market phase. It is a
**verdict/sentiment producer only — it never executes.** The core bot logic (RiskEngine →
PaperTrader / live gate) does all executions.

### Run 1 — 09:00 IST (pre-open)
**Purpose:** gauge how D-Street is likely to perform today.
- Reads overnight/early markets that are open (US close, Asia open: Nikkei, Hang Seng, SGX
  Nifty futures, etc.).
- Aggregates news sentiment for the watchlist + macro (reuse C2 news, C4 macro, D1 sentiment).
- **Output:** a day-level bias (bullish / bearish / neutral), expected sector strength, and a
  "watch" list. No orders.

### Run 2 — 12:00 IST (mid-session)
**Purpose:** how the day has performed so far; what to acquire / sell; quick intra-day options.
- Uses live ticks + indicators (B1) + sentiment (D1) + holdings (E1).
- Flags stocks to acquire or sell, and short-dated options to buy/sell before close.
- **Output:** a shortlist of candidate actions with verdicts + risk scores — passed to
  RiskEngine for gating. The algo (live ticks + 10-min LLM cadence) then monitors the
  acquisitions, especially short ones.

### Run 3 — 15:00 IST (pre-close)
**Purpose:** how the day went; holding status; close short intra-day positions and options.
- Reviews day P&L, open holdings, short intra-day positions, and options positions.
- Based on sentiment, recommends closing options positions and squaring short intra-day
  trades before close.
- **Output:** end-of-day verdict + recommended closes — again, execution only via core bot logic.

### Rules
- **Verdicts only.** The probe agent produces sentiments + strong verdicts; it never places orders.
- **Execution is the core bot's job** (RiskEngine gate → PaperTrader / live gate).
- **Scheduling:** IST-aware (reuse `scheduler.withinHoldWindow` / IST helpers). Runs are
  idempotent and persisted to the Ledger for the UI timeline.
- **Inputs:** reuse the agent fleet (C2 news, C4 macro, D1 sentiment, B1 indicators, E1
  holdings) + live ticks.

---

## 4.6 A2A (agent-to-agent) protocol

When the probe agent (or any agent) suggests a **symbol + order type**, downstream agents are
invoked for deeper analysis/sentiment. This is agent-to-agent (A2A) orchestration. To keep it
safe, bounded, and reproducible, it is **router-controlled and schema-driven — NOT free-form
LLM spawning.**

### Flow
1. **Producer** (e.g. probe agent) emits a strict suggestion:
   `{ symbol, orderType, confidence, thesis }`.
2. **Router** (deterministic code) maps `orderType` → required downstream agents:
   - `BUY` / `SELL` → sentiment (D1) + pattern/validator (B6/F3) + holdings (E1)
   - `OPTION` → options context + IV + sentiment (D1) + holdings (E1)
   - `CLOSE` → holdings (E1) + day P&L (E4) + sentiment (D1)
3. Each downstream agent emits **strict typed output** (schema-validated) consumed by the next.
4. **H3 hallucination guard** validates each hop's output before it propagates.
5. **RiskEngine is the final gate** — A2A output is a well-researched *candidate*, never a
   directive.

### Bounds (non-negotiable)
- **Max fan-out per producer run** (e.g. ≤ 5 symbols).
- **Max depth** (e.g. ≤ 2 hops) — no runaway chains.
- **Token budget + time budget** per A2A pass.
- **Schema validation at every hop** — invalid output stops the chain.
- **Deterministic router** — the LLM never decides ad hoc which agents to spawn.

### Why this shape
- Free-form A2A (LLM spawning agents arbitrarily) → cost/latency explosion, non-determinism,
  hallucination propagation.
- Router-controlled, typed, bounded A2A → reproducible, auditable, gated. This is the correct
  agentic pattern for a trading bot.

---

## 4.7 Probe data persistence (DB schema)

Every probe result — timestamp, link, summary, **full page content**, and content source — is
persisted to the SQLite Ledger so any agent can later run an **overall summary / pattern run**
(e.g. "what news preceded this symbol's moves over time") without re-fetching the web.

### Why
- **Pattern analysis over time:** correlate a symbol's news/sentiment with its price movement.
- **Re-runnable summaries without re-fetching:** saves TinyFish/Tavily credits + network.
- **Auditability:** every verdict is traceable to its source articles.
- **UI news timeline** for free.

### Design decisions
- **Two tables:** `probe_runs` (one row per probe run) + `news_articles` (one row per article).
- **Dedup:** `news_articles.dedup_key` = hash of normalized title (lowercased, stripped). The
  same article from TinyFish + RSS + across runs collapses to one row.
- **Provenance:** `source` (tinyfish | rss | tavily | google_news) + `content_source`
  (tinyfish_fetch | rss_snippet | null) so agents know where content came from.
- **Retention:** keep `summary`/metadata indefinitely; keep `full_content` for a bounded window
  (e.g. 30–90 days) to bound storage. A cleanup job prunes old `full_content`.
- **Indexes:** `(symbol, fetched_at)` and `(symbol, run_at)` for fast per-symbol pattern queries.

### Proposed migration (V006__probe_news.sql)
```sql
CREATE TABLE IF NOT EXISTS probe_runs (
  run_id   TEXT PRIMARY KEY,          -- uuid
  run_type TEXT NOT NULL,             -- pre_open | mid_session | pre_close | manual
  symbol   TEXT NOT NULL,
  run_at   TEXT NOT NULL,             -- ISO-8601 UTC
  day_bias TEXT,                      -- bullish | bearish | neutral
  verdict  TEXT,                      -- strong verdict text
  summary  TEXT,
  meta     TEXT                       -- JSON: markets read, sector strength, etc.
);
CREATE INDEX IF NOT EXISTS idx_probe_runs_symbol_time ON probe_runs(symbol, run_at);

CREATE TABLE IF NOT EXISTS news_articles (
  article_id     TEXT PRIMARY KEY,    -- hash of dedup_key
  run_id         TEXT REFERENCES probe_runs(run_id),
  symbol         TEXT NOT NULL,
  source         TEXT NOT NULL,       -- tinyfish | rss | tavily | google_news
  title          TEXT NOT NULL,
  link           TEXT,
  summary        TEXT,
  full_content   TEXT,                -- fetched page content (markdown)
  content_source TEXT,                -- tinyfish_fetch | rss_snippet | null
  content_len    INTEGER,
  published_at   TEXT,
  fetched_at     TEXT NOT NULL,
  dedup_key      TEXT NOT NULL UNIQUE -- normalized title hash
);
CREATE INDEX IF NOT EXISTS idx_news_symbol_time ON news_articles(symbol, fetched_at);
CREATE INDEX IF NOT EXISTS idx_news_source ON news_articles(source);
```

### Pattern-run use case
A later agent queries `news_articles` by `symbol` over a date range, groups by `source` and
`content_source`, and feeds the corpus to the LLM to detect recurring themes / sentiment
shifts that preceded price moves — without any live web calls.

### Backfill / reconciliation (self-healing corpus, ON-DEMAND)
The corpus is **forward-accumulating** — it builds history only from the day the bot starts
running. To reconcile gaps (a date that was queried but returned empty), a standalone
**`backfillNews(ctx, symbol, date)`** function is **invoked on demand** — NOT scheduled as a
pass agent. Rules:
- Trigger: any caller (a pattern-analysis agent, a historical-news query, etc.) that finds 0
  rows for a `(symbol, date)` calls `backfillNews` to fill it.
- Source: TinyFish (and optionally Tavily) date-scoped search (`after_date`/`before_date`) —
  **not** Google News RSS (no date-range query).
- **Best-effort**: the live index may not retain every article from that date; it fills the gap
  with what is still findable, not a guaranteed full record.
- Persisted to `news_backfill` (V007) so a gap is reconciled once, not on every call.

---

## 5. Data-source strategy (MCP, SDK, web search)

### 5.1 Zerodha Kite MCP — READ-ONLY only
- Official `zerodha/kite-mcp-server`, hosted `https://mcp.kite.trade/mcp`.
- **Never** expose `place_order` / GTT mutations. Hosted already excludes them; if self-hosting,
  must set:
  ```
  EXCLUDED_TOOLS=place_order,modify_order,cancel_order,place_gtt_order,modify_gtt_order,delete_gtt_order
  ```
- Kite MCP's real value is **live account data**: `get_positions`, `get_holdings`, `get_margins`,
  `get_profile`, `get_orders`, `get_trades`, `get_order_history`, `get_order_trades`, `get_gtts`.
- `get_historical_data` can replace Yahoo **only at the live stage** (needs real account +
  subscription). Yahoo stays the free backtest source.
- **Auth:** hosted needs interactive OAuth (not headless-friendly). Self-hosted local server is
  the unattended path. `KITE_API_KEY`/`KITE_API_SECRET` go in the MCP server's own `.env`.
- **Free ≠ free data:** MCP interface is free; live market data still needs the Kite
  subscription. Verify with a `get_ltp` probe before assuming otherwise.
- **Verdict:** keep Kite MCP separate, read-only, for live account data only. It does NOT replace
  mock/Yahoo for paper, does NOT fix the "1 trade in 30 days" signal problem.

### 5.2 News / web-search layer (TinyFish-primary + RSS fallback)
RSS feeds are flaky (failed wholesale on 2026-08-13). Decision (2026-08-13): **TinyFish is the
primary live search; Google News RSS is the automatic fallback** — NOT `both` (which doubles
noise/duplicates). TinyFish returns real article links + full page content via Fetch; RSS returns
Google redirect URLs that need Fetch to resolve anyway, so TinyFish is strictly more useful.

```
TinyFish Search+Fetch (primary, free) → Google News RSS (fallback, free, keyless) → Tavily (optional depth)
```

- **TinyFish:** Search + Fetch are **free** (current policy). `domain_type:'news'` filter;
  `recency_minutes` freshness. Search latency 1–3s; Fetch up to 20s / 150s timeout. Called via
  **direct REST `fetch`** (NOT the ESM-only `@tiny-fish/sdk` — the SDK breaks under
  CommonJS/ts-node). Reads `TINYFISH_API_KEY` from env.
- **Google News RSS:** free, keyless, independent fallback — used only when TinyFish returns 0
  or fails (avoids single-source risk).
- **Tavily** (existing): credit-based; optional depth layer.
- **Provider selection via `.env`:** `NEWS_SEARCH_PROVIDER=tinyfish` (primary) — the RSS
  fallback is always-on; `tavily` / `both` / `none` still supported.
- **SDK vs MCP for web search — decision:** use **direct REST fetch** for the *batch* news pass
  (C2, D1 — fixed per-symbol queries, app fetches + injects). Use **MCP / one guarded tool** for
  the *open-ended research/verification* agents (C3, C4, C5, H3, on-demand F1/F3). Rule:
  **fixed/predictable query → app fetch; open-ended/verification → agentic tool.**

---

## 6. Architecture & code structure

- **Same repo. New module `src/agents/`.** Do NOT fork a fresh server — reuse `src/server/`
  classes (`RiskEngine`, `PaperTrader`, `Ledger`, `NewsSentimentEngine`, `LlmManager`,
  `TelegramHITL`, `NotificationService`, `AppConfig`, `Logger`, `types`).
- **Separation of concerns, not codebases:** agents import server classes. Same DB, same UI,
  same LLM-traces.
- **Process model:** agent orchestrator runs on a 10-min cadence (`setInterval`), separate async
  loop from the 1s tick loop. If contention later becomes an issue, run the orchestrator as a
  separate process sharing the same `Ledger` DB — a deployment choice, not a code rewrite.
- **Planned new files (MVP):**
  - `src/agents/orchestrator.ts` — the 10-min loop, parallelism, hold-window.
  - `src/agents/definitions.ts` — agent registry (name, domain, source, deps).
  - `src/agents/strategist.ts` — F4 strict-JSON proposal builder.
  - `src/agents/pipeline.ts` — stages, parallel/sequential scheduling.
  - `src/agents/scheduler.ts` — cadence, hold-until-10:30 window.
  - `src/server/KiteMcpClient.ts` — read-only Kite MCP client (planned).
  - `src/server/NewsSentimentEngine.ts` — extend for TinyFish + provider choice.

---

## 7. Build roadmap (phased)

**Step 0 — Fix the code signal (DO FIRST; profit comes from here).**
The agent layer multiplies the quality of an *existing* edge; it cannot create one from
nothing. Without a healthy signal the fleet has nothing to act on (current: 1 trade / 30 days,
~21% win rate). Concretely:
- Widen the candidate universe: more liquid symbols and/or lower-priced ones (tradeable at ₹10k).
- Loosen over-gating so the strategy generates a meaningful number of entries on the backtest
  window (RSI entry threshold, slow-SMA confirmation, regime filter) — the sample must be big
  enough to judge, not 1 trade.
- Re-run `ab_compare.ts`: strategy must beat buy-and-hold at ₹20L **and** be tradeable at ₹10k.
- **Only proceed to the agent build once the code signal produces a healthy, validated
  candidate stream.** Everything below assumes a working signal layer.

1. **Golden path first:** A1–A2, B1, C1–C2, D1, E4 → F1→F2→F4→F5→F6. ~10 agents = a working
   AI-driven loop through RiskEngine, persisted to DB, with the hold-until-10:30 window.
2. **News resilience:** TinyFish SDK + `NEWS_SEARCH_PROVIDER` + Google News RSS fallback +
   "news source degraded" logging.
3. **Technical depth:** B3–B7 (support/resistance, volume profile, patterns, momentum).
4. **Sentiment depth:** D2–D3 (sector rotation, breadth).
5. **Live account (needs MCP + real sub):** E1–E3, A4–A6; swap `get_historical_data` for Yahoo.
6. **Research/verification agents:** C3–C5, H3 — add the single guarded agentic web-search tool.
7. **Post-trade & reports:** G1–G4.
8. **Governance hardening:** H1–H5.

---

## 8. Safety guardrails (non-negotiable)

- **RiskEngine is the immutable hard gate.** Agents can NEVER loosen a cap.
- **F6 is the only execution path.** Orders never go through MCP; execution is PaperTrader
  (paper) or gated live via `ALLOW_LIVE_ORDERS=false` + HITL.
- **Proposal schema validation** — strategist must return strict JSON; invalid → no trade.
- **Iteration/time caps + max proposals per pass** — no runaway agent loops.
- **HITL for live** — agents decide, a human approves real money (`TelegramHITL`).
- **Agentic web-search tool** is read-only context, rate-limited, never execution.
- **Degradation logging** — RSS/news-source failure is loud, not silent.

---

## 9. Honest caveats

- **Agent layer ≠ strategy edge.** It produces *better-informed suggestions*, not entries. The
  "1 trade in 30 days" problem is a code-signal problem and must be fixed at the signal layer.
- **Cost:** fleet × LLM calls × 10-min cadence is heavy. Run cheap code agents every pass;
  run expensive LLM synthesis (D1/F1) every 30–60 min, not every 10.
- **Non-determinism:** same market → slightly different suggestions across runs. Fine for a
  suggestion layer; not a stable signal.
- **Un-backtestable LLM:** you can't replay an LLM over 10k bars; validate the *code-confirmed*
  subset and A/B the agent-driven gated trades vs. the code baseline on paper before live.
- **TinyFish "free" is current policy** — that's why the chain has multiple sources.
- **Live stage needs:** real Kite account + subscription (₹200–500/mo or waived by turnover;
  verify current pricing), and headless OAuth handling for hosted MCP (prefer self-hosted).

---

## 10. Validation plan

**Step 0 gate (signal health):** before any agent work, `ab_compare.ts` must show the code
strategy beating buy-and-hold at ₹20L AND tradeable at ₹10k, on a sample with enough trades to
judge. If this fails, agents are not built yet.

1. **A/B baseline** (`ab_compare.ts`, existing): code strategy vs buy-and-hold at ₹20L and ₹10k.
   Already built.
2. **Agent-driven A/B:** agent-proposed, RiskEngine-gated trades vs. current code baseline over
   weeks on paper. Must beat baseline AND be tradeable at ₹10k.
3. **Hold-window validation:** confirm no execution suggestions before ~10:30 IST.
4. **News-layer validation:** `NEWS_SEARCH_PROVIDER` each value works; degradation logging fires;
   sentiment quality compared across providers.
5. **Live readiness gate:** only after paper agent-driven results pass (1) & (2) and HITL is in
   place.
