# 🪁 My Autonomous Kite Vault

**Personal agentic stock trading bot** for the **Zerodha Kite** ecosystem, written
in pure **TypeScript/Node.js** — no Python. It uses a **hybrid** design: fast
deterministic code handles the market math, and an optional **LLM** (OpenAI or
Ollama Cloud) adds news sentiment and a final **analyst verdict** on candidate
trades. It ships in **paper-trading mode** with a full **web dashboard**, and is
built to be validated on paper before any real money is involved.

> ⚠️ **Paper-only by default.** The bot never places real Kite orders. Every
> buy/sell is simulated and persisted to a local SQLite ledger. Real execution is
> a deliberate, gated future step (see "Live trading?" below).

---

## Highlights

- 📊 **Web dashboard** (`src/client`, Vite + React + shadcn/ui): live overview,
  candlestick charts (TradingView Lightweight Charts), positions/orders/trades,
  signals, risk audit, notifications, and an **LLM Traces** page.
- 📡 **Real-time ticks** via KiteTicker (3s coalescing) + **historical data**
  via Kite Connect v3 REST (for RSI warmup).
- 📈 **Strategies:** `mean_reversion` (RSI-14), `pullback_trend`, `breakout` —
  guarded by **ADX regime filter**, **volume confirmation**, **ATR-based adaptive
  stops**, **volatility-based (risk-parity) sizing**, a **circuit breaker**,
  **time-of-day** filters, and a hard **cooldown**.
- 🎯 **Trade-quality gates:** optional **regime gating** (trade only in a
  compatible market regime), **evidence-based signal confidence** floor, and a
  **minimum reward:risk** (target vs stop) requirement.
- 🧠 **AI/LLM:** news sentiment every 10 min (Google News RSS + free TinyFish web search), plus
  a **final analyst verdict** (AGREE/CAUTION/AVOID + risk score) on candidate
  trades — always subordinate to the immutable `RiskEngine`.
- 💰 **Realistic paper fills:** adverse **slippage** + NSE-style **brokerage /
  statutory / GST** so paper P&L is net of costs.
- 🛡️ **RiskEngine** — immutable guardrails (drawdown incl. unrealized PnL,
  per-trade allocation, capital caps). Every decision is audited to the DB.
- 👤 **Human-in-the-loop** via Telegram (optional): approve/reject large tickets,
  `/stop` kill-switch, `/status`, `/models`, `/model`, `/llm`.
- 💾 **SQLite** persistence (`better-sqlite3`) with a Liquibase-style migration
  runner and a **UI backend** (Express REST + WebSocket).
- 🔍 **Observability:** `llm_traces` records every LLM call (prompt, response,
  latency, tokens) so you can inspect *why* the agent decided something.
- 🧪 **Validation:** parameter optimizer + a new **walk-forward / out-of-sample**
  validation script that gives a blunt `VALIDATED` / `NOT VALIDATED` verdict.

---

## Architecture

```
src/
├── server/            # the bot + UI backend (Express REST + WebSocket)
│   ├── index.ts       # entrypoint / wiring
│   ├── MarketAgent.ts # strategy brain (indicators, gates, execution queue)
│   ├── RiskEngine.ts  # immutable risk gatekeeper
│   ├── PaperTrader.ts # simulated execution (net of costs)
│   ├── Ledger.ts      # SQLite persistence + query layer
│   ├── NewsSentimentEngine.ts # RSS + LLM sentiment + analyst verdict
│   ├── LlmManager.ts  # OpenAI/Ollama provider (+ trace metadata)
│   ├── KiteStreamer.ts / providers/  # live + historical data
│   └── api/           # Express routes + read queries + WebSocket
└── client/            # React dashboard (Vite + shadcn/ui), own package.json
```

## Quick start

```bash
# 1. Install dependencies (root server + client)
npm install
npm --prefix src/client install

# 2. Configure environment
cp .env.example .env   # see docs/CONFIGURATION.md

# 3. Build the dashboard and run the bot (paper mode) — serves UI on :3000
npm run build:ui
npm run dev

# 4. Or run a hot-reloaded UI in dev (Vite on :5173, proxies /api + /ws)
npm run dev          # terminal 1 (bot + API on :3000)
npm run dev:ui       # terminal 2 (dashboard on :5173)
```

> `better-sqlite3` is a native module. If `npm install` fails during its build,
> run it once without sandbox/CI restrictions, or `--build-from-source`.

---

## Commands

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Run the bot + API + dashboard (paper mode) on `:3000` |
| `npm run build` | Compile server to `dist/` |
| `npm start` | Run compiled output |
| `npm run typecheck` / `typecheck:test` / `typecheck:ui` | Type-check server / tests / client |
| `npm run build:ui` | Build the React dashboard |
| `npm run dev:ui` | Vite dev server (hot reload) on `:5173` |
| `npm run mock:ui` | Seed a mock DB + start the dashboard (no broker needed) |
| `npm run backtest` | Backtest vs real history → `data/backtest_report.csv` |
| `npm run optimize` | Parameter sweep + multi-fold walk-forward |
| `npm run simulate` | Synthetic 2-min market simulation |
| `npm run test:backtest` | Self-test the onCandle backtest path |
| `npm run validate:strategy` | **Walk-forward / OOS validation** + edge verdict |
| `npm run audit:code` | LLM code audit (architecture + guardrails reports) |
| `npm run audit:strategy` | LLM strategy/market-logic audit report |

---

## Live trading?

**Today the bot is paper-only** — there is no live execution path. But it is
built on the real **Kite Connect SDK**, so it *can* be extended to live. The
recommended (and codebase-mandated) path mirrors RakshaQuant's safety design:
add a `LiveTrader` behind a hard `ALLOW_LIVE_ORDERS` gate, run it in **shadow
mode** first, add order idempotency + broker reconciliation, and only enable real
orders after extensive paper testing **and** a passing walk-forward verdict. See
`docs/CAPABILITIES.md` → "Live trading readiness".

## Documentation

- [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) — every configurable entity
- [`docs/CAPABILITIES.md`](docs/CAPABILITIES.md) — what the bot can do + live-readiness
- [`docs/BACKTESTING.md`](docs/BACKTESTING.md) — backtest, optimize, **walk-forward**
- [`docs/UI_DASHBOARD.md`](docs/UI_DASHBOARD.md) — the web dashboard + mock UI
- [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md) — LLM audit scripts + `llm_traces`
- [`Agents.md`](Agents.md) — contribution guide & engineering practices

## Legal & license

- **License:** GPL-3.0 (copyleft — fine for personal/private use).
- **"Kite"** is a trademark of Zerodha; this project is unofficial and not
  affiliated with Zerodha.
- **Not financial advice.** Trading involves risk. This bot is paper-only by
  design; use real capital at your own risk.
