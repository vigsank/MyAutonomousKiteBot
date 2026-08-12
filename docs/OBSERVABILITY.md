# Observability — LLM Audits & `llm_traces`

This document covers two observability surfaces built on top of the bot:
**LLM audit scripts** (multi-model code/strategy reviews) and the **`llm_traces`
table** (per-call LLM observability, a lightweight LangSmith-style trace log).

Both reuse the project's existing `.env` LLM config (`OLLAMA_BASE_URL` +
`OLLAMA_API_KEY`), so there is no extra setup.

## 1. LLM audit scripts

Two Node.js CLIs run Ollama Cloud models against the entire `src/server`
codebase and write Markdown reports to `src/server/audit-report/`:

| Command | File | What it audits |
| ------- | ---- | -------------- |
| `npm run audit:code` | `run_code_audit.mjs` | **Architecture** (glm) + **guardrails** (gemma), in parallel |
| `npm run audit:strategy` | `run_strategy_audit.mjs` | **Strategy / market-logic** audit (rate, grade, profitability plan) |
| `npm run audit:profit` | `run_strategy_profit_audit.mjs` | **Profitability** audit of the whole project as an expert trader — feasibility of a ₹5k/₹10k → ₹1L/month goal, "no monthly loss" guardrails, growth plan |

Each prompt asks for a strict, evidence-based report with per-finding severity,
file:line, evidence, impact, and a prioritized action list. Models are
overridable via `AUDIT_MODEL_ARCH`, `AUDIT_MODEL_GUARD`, `AUDIT_MODEL_STRATEGY`
(they must exist on your Ollama Cloud; see `ollama list`).

## 2. `llm_traces` — per-call LLM observability

Every LLM call (news **sentiment** and the **analyst verdict**) records a row in
the `llm_traces` table:

- `purpose` (`sentiment` | `analyst`), `symbol`, `model`
- the exact **prompt** and **response**
- `latency_ms`, `tokens_in`, `tokens_out`, `created_at`

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

## 3. The analyst verdict

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
