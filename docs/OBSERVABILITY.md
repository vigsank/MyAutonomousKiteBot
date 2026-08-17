# Observability — LLM Audits & `llm_traces`

This document covers two observability surfaces built on top of the bot:
**LLM audit scripts** (multi-model code/strategy reviews) and the **`llm_traces`
table** (per-call LLM observability, a lightweight LangSmith-style trace log).

Both reuse the project's existing `.env` LLM config (`OLLAMA_BASE_URL` +
`OLLAMA_API_KEY`), so there is no extra setup.

## 1. LLM audit scripts

Three Node.js CLIs (one per npm script) run Ollama Cloud models against the
codebase and write Markdown reports to `src/server/audit-report/`:

| Command | File | What it audits |
| ------- | ---- | -------------- |
| `npm run audit:code` | `run_code_audit.mjs` | **Architecture** + **guardrails**, in parallel |
| `npm run audit:strategy` | `run_strategy_audit.mjs` | **Strategy / market-logic** audit (rate, grade, profitability plan) |
| `npm run audit:profit` | `run_strategy_profit_audit.mjs` | **Profitability** audit of the whole project as an expert trader — feasibility of a ₹5k/₹10k → ₹1L/month goal, "no monthly loss" guardrails, growth plan |

All three scripts construct an `OpenAI` client directly against
`OLLAMA_BASE_URL` / `OLLAMA_API_KEY` (the same OpenAI-compatible config the bot's
`LlmManager` uses) and write their reports under `src/server/audit-report/`:

- `run_code_audit.mjs` runs **two** tasks in parallel and writes one report per
  model: **architecture** (`glm_agent_report.md`) and **guardrails**
  (`gemma_guardrail_report.md`).
- `run_strategy_audit.mjs` writes `strategy_audit_report.md`.
- `run_strategy_profit_audit.mjs` writes `profit_strategy_audit.md`.

Each prompt asks for a strict, evidence-based report with per-finding severity,
file:line, evidence, impact, and a prioritized action list. Models are
overridable via env (they must exist on your Ollama Cloud; see `ollama list`):

| Model | Default | Override |
| ----- | ------- | -------- |
| Architecture (audit:code) | `glm-5.2:cloud` | `AUDIT_MODEL_ARCH` |
| Guardrails (audit:code) | `gemma4` | `AUDIT_MODEL_GUARD` |
| Strategy (audit:strategy) | `glm-5.2:cloud` | `AUDIT_MODEL_STRATEGY` |
| Profit (audit:profit) | `glm-5.2:cloud` | `AUDIT_MODEL_PROFIT` |

> **Note on the shared LLM helper.** The project ships a small `lib/llm-provider.mjs`
> helper (described in `docs/plan/adhoc-change.md`) that is meant to resolve a
> primary + LiteLLM fallback client and retry on 429/quota. **As of the current
> source, none of the three audit scripts import it** — each still uses
> `OpenAI` directly against `OLLAMA_BASE_URL`. So a LiteLLM fallback / direct
> `gemini-2.5-pro` routing is **not** currently active in the audit scripts; treat
> `lib/llm-provider.mjs` as an available-but-not-yet-wired helper.

## 2. `llm_traces` — per-call LLM observability

Every LLM call records a row in the `llm_traces` table:

- `purpose`, `symbol`, `model`
- the exact **prompt** and **response**
- `latency_ms`, `tokens_in`, `tokens_out`, `created_at`

The `purpose` values currently written are: **`sentiment`** (news sentiment),
**`analyst`** (pre-trade analyst verdict), **`holdings`** (holding-review verdict),
and **`daily_report_<type>`** (the daily report engine's per-stage calls).

This lets you answer *"why did the agent reject the BUY signal for TCS?"* by
inspecting the recorded trace — the exact prompt, the model's raw JSON, latency,
and cost. View it on the dashboard **`/llm-traces`** page or query
`GET /api/llm-traces`.

Tracing is **failure-isolated**: a trace-write error never disrupts trading.

## 3. Audit-driven hardening (summary)

The LLM audit reports surfaced correctness/safety fixes that have been applied:

- **Live data wiring:** instruments now load both NSE + NFO (the previous NFO-only
  load silently disabled the live ticker).
- **Indicators on closed bars:** RSI/SMA/ADX/ATR update on bar close, not raw
  ticks; live breakout tracking was fixed.
- **Serialized execution:** trade proposals run through a queue so concurrent
  proposals can't both pass the capital gate.
- **Telegram approval serialization:** only one approval pending at a time.
- **Drawdown includes unrealized PnL** on open positions.
- **Options persisted + routed through the RiskEngine** (premium/exposure/capital
  caps) with dynamic ATR-derived volatility.
- **IST (not host-local) market-day boundaries** for drawdown/daily summaries.
- **Realistic paper fills** (slippage + NSE charges) so backtests are net of cost.
- **LLM JSON validation + prompt-injection sanitization** in the sentiment path.
- **Circuit-breaker state persists** across restarts.
- **Live last price persisted** (migration `V005` adds `instruments.last_price`),
  so the RiskEngine's drawdown sees unrealized PnL on open positions instead of
  treating open risk as zero.
- **Breakout high fixed:** the prior N-bar high now uses the full lookback window
  (previously it excluded the most recent closed bar, mis-setting the threshold).
- **Stop distance unified:** position sizing and R:R now use the same stop as the
  `RiskEngine` (min of ATR stop and the full fixed % stop), so positions are sized
  to the actual enforced risk.
- **ATR-based take-profit:** exits now lock in gains at `avgPrice ± ATR ×
  targetAtrMultiplier` instead of always waiting for RSI to reverse.
- **Per-symbol concentration cap:** the RiskEngine now blocks an `ADD` that would
  push a position's total notional past `maxTradeAllocation`, so repeated
  mean-reversion entries can't build a single oversized position.
- **Backtest correctness:** auto-trades now execute synchronously (only HITL /
  analyst-gated trades are queued), so positions are visible during the
  synchronous backtest loop — previously the async queue made backtests see
  almost no trades. The LLM analyst is also disabled in backtest/walk-forward so
  they measure the code strategy edge, not live LLM judgment.

These are reflected in `docs/CAPABILITIES.md` and the config knobs in
`docs/CONFIGURATION.md`.

## 4. The analyst verdict

The bot's `NewsSentimentEngine.analystVerdict()` asks the LLM to act as a final
analyst on a candidate trade, combining code-computed indicators (RSI/ADX/ATR)
and cached news sentiment into:

```json
{ "verdict": "AGREE" | "CAUTION" | "AVOID", "riskScore": 0-100, "rationale": "..." }
```

The verdict is a **soft filter**: the immutable `RiskEngine` always runs first
and the analyst can only *reject* (skip) a trade, never force one past the risk
gate. It is enabled with `ANALYST_ENABLED=true` and governed by
`ANALYST_REJECT_THRESHOLD` (default `70`). If the LLM is unavailable or returns
invalid JSON, the trade proceeds (logged) — an LLM error never blocks execution.
A sibling `holdingsVerdict()` performs a similar soft review of existing holdings
(`purpose = 'holdings'`).
