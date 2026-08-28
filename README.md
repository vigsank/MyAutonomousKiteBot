<div align="center">


<img src="assets/logo.gif" alt="MyAutonomousKiteBot" width="140" height="140" />

# 🪁 MyAutonomousKiteBot

**An autonomous, AI-backed equity trading bot for the Indian (NSE) market.**

A validated **momentum** strategy picks the trade candidates, an **agent fleet +
LLM** reads the news and sentiment to veto / shrink / re-rank them, and a
deterministic **RiskEngine** is the final gate before any order goes out — all
paper-traded against a realistic Zerodha mock before a single rupee is risked.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](tsconfig.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](Agents.md)
[![Paper-only](https://img.shields.io/badge/status-paper--only-orange.svg)](#live-trading)

**Momentum originates. AI filters. RiskEngine decides. Paper first, always.**

</div>

---

## 📖 What is this?

`MyAutonomousKiteBot` is a **personal, agentic, paper-trading stock bot** for the
Indian equity market, written in pure **TypeScript / Node.js** (no Python). It
combines three layers that are deliberately kept separate:

| Layer | Role | Never does |
|-------|------|-----------|
| 🏆 **Momentum engine** | The **single originator** of trade candidates (cross-sectional 12-month momentum, top-N with rank hysteresis, monthly rebalance) | Never invents a symbol from news |
| 🧠 **Agent fleet + LLM** | Reads news/sentiment and may **veto, shrink or re-rank** the momentum ranking | Never originates a live trade on its own |
| 🛡️ **RiskEngine** | The **immutable execution gate** — drawdown, per-trade / stock / sector caps, cash reserve, risk-at-stop | Never overridden by AI or agents |

Everything is **paper-traded** through [`kite-paper-node`](https://github.com/vigsank/kite-paper-node)
(a separate repo/package that persists state like a real broker), with a full
**web dashboard**, and is built to be **validated on paper before any real money**.

> ⚠️ **Paper-only by default.** The bot never places real Kite orders. Every
> buy/sell is simulated and persisted to a local SQLite ledger. Real execution is
> a deliberate, gated step behind `ALLOW_LIVE_ORDERS` (see [Live trading?](#live-trading)).

---

## ✨ Why I built this

I wanted an **autonomous, AI-backed trading bot** for the Indian (NSE) market —
not just another technical-indicator script, but something that could:

- **Read the news and sentiment** every morning (and react to breaking news
  intraday), the way a human trader would.
- **Pick trade candidates** with a statistically validated edge, not gut feel.
- **Let AI advise but never let it gamble** — a deterministic risk engine has the
  final say on every order.
- **Prove itself on paper** — months of backtests, walk-forward validation, and
  mock trading — before a single rupee of real capital is involved.

The result is a **hybrid** design: a validated momentum strategy is the *brain*
that originates candidates, an extensible **agent fleet** (domains A–H on a shared
blackboard) plus an **LLM** (OpenAI, Ollama Cloud, or LiteLLM) add news sentiment
and a 3-stage daily report that *veto / shrink / re-rank* those candidates, and the
deterministic **RiskEngine** is the immutable execution gate.

---

## 🚀 Highlights

- 🏆 **Momentum is the brain** — cross-sectional 12-month momentum (skip-1),
  top-N with rank hysteresis, monthly rebalance, liquidity floor + event
  blackout. Validated out-of-sample: `npm run validate:momentum` → **VALIDATED
  36.99% annualized, +26.84pp over Nifty**. It is the **single originator** of
  trade candidates.
- 🧠 **AI filters, never originates** — the agent fleet (A–H) + `DailyReportEngine`
  (09:00 / 11:00 / 15:15 IST) read the momentum ranking from a shared blackboard
  and may **veto, shrink or re-rank** it — never add to it. AI-originated ideas
  outside the ranking are logged as a **shadow book** (`score:shadow`) and graded
  by `AiAuthorityPolicy` (PROMOTE / HOLD / RETIRE).
- 🛡️ **RiskEngine** — the single immutable arbiter: drawdown (incl. unrealized
  PnL), per-trade / single-stock / sector caps, cash reserve, risk-at-stop.
  Every decision is audited to the DB.
- 🧩 **Agent fleet on a blackboard** — domains A–H (data, technical, fundamental,
  sentiment, portfolio, decision, post-trade, governance) publish to a per-pass
  blackboard; a failed agent degrades its dependents to `skipped`, never
  poisons them.
- 💾 **`kite-paper-node` mock as a real broker** — a **separate repo/package**
  consumed via npm (SDK drop-in) + network (REST/WS/MCP). It serves real NSE
  CSVs (~210 symbols) and can persist orders/positions/ledger to SQLite
  (`--state-file`), so it survives restarts like a live Zerodha backend.
- 🎯 **Trade-quality gates:** optional regime gating, evidence-based signal
  confidence floor, minimum reward:risk, ATR-based adaptive stops, circuit
  breaker, cooldown.
- 📊 **Web dashboard** (`src/client`, Vite + React + shadcn/ui): live overview,
  candlesticks, positions/orders/trades, signals, risk audit, notifications,
  **LLM Traces**, and a **fleet** observability page.
- 💰 **Realistic paper fills:** adverse **slippage** + NSE-style **brokerage /
  statutory / GST** so paper P&L is net of costs. **Tax** modelled (STCG 20% /
  LTCG 12.5%).
- 👤 **Human-in-the-loop** via Telegram (optional): approve/reject large tickets,
  `/stop`, `/status`, `/models`, `/model`, `/llm`.
- 🔍 **Observability:** `llm_traces` records every LLM call (prompt, response,
  latency, tokens); `audit:code|strategy|profit` LLM audits the codebase.
- 🧪 **Validation:** walk-forward OOS gate, leak attribution, survivorship-bias
  estimation, 12-month SIP sim, go-live ladder (`status:golive`).

---

## 🏗️ Architecture

```
src/
├── server/            # the bot + UI backend (Express REST + WebSocket)
│   ├── index.ts       # entrypoint / wiring
│   ├── MomentumStrategy.ts + signals/momentum.ts  # validated originator
│   ├── MarketAgent.ts # live RSI/ADX/ATR loop + gates + execution queue
│   ├── RiskEngine.ts  # immutable risk gatekeeper
│   ├── LiveTrader.ts / OrderGuard.ts / Reconciler.ts  # execution authority
│   ├── PaperTrader.ts # simulated execution (net of costs)
│   ├── Ledger.ts      # SQLite persistence + query layer
│   ├── DailyReportEngine.ts # 3-stage AI daily report
│   ├── NewsSentimentEngine.ts # RSS + TinyFish + LLM sentiment
│   ├── NewsMonitorEngine.ts   # event-driven news monitor (defensive/opportunistic)
│   ├── LlmManager.ts  # OpenAI/Ollama/LiteLLM provider (+ trace)
│   ├── KiteStreamer.ts / providers/  # live + historical data
│   └── api/           # Express routes + read queries + WebSocket
├── agents/            # domain agents A–H + blackboard + orchestrator
└── client/            # React dashboard (Vite + shadcn/ui)
```

The **authority model** is the heart of the design:

```
momentum ranking ──► blackboard ──► agent fleet + LLM (veto/shrink/re-rank)
                                        │
                                        ▼
                              RiskEngine (immutable gate)
                                        │
                                        ▼
                              PaperTrader / LiveTrader
```

---

## ⚡ Quick start

```bash
# 1. Install dependencies (root server + client)
npm install
npm --prefix src/client install

# 2. Configure environment
cp .env.example .env   # see docs/CONFIGURATION.md

# 3. Build the dashboard and run the bot (paper mode) — serves UI on :3000
npm run build:ui
npm run dev

# 4. Validate the momentum edge (OOS gate)
npm run validate:momentum
```

> `better-sqlite3` is a native module. If `npm install` fails during its build,
> run it once without sandbox/CI restrictions, or `--build-from-source`.

---

## 🛠️ Commands

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Run the bot + API + dashboard (paper mode) on `:3000` |
| `npm run build` / `npm start` | Compile / run server `dist/` |
| `npm run typecheck` / `typecheck:test` / `typecheck:ui` | Type-check server / tests / client |
| `npm run build:ui` / `dev:ui` / `mock:ui` | Dashboard build / dev / mock UI |
| `npm run test:unit` | All 12 unit suites (momentum, risk, indicators, live, feedback, agents, execution, tax, shadow, authority, ladder, newsmonitor) |
| `npm run ci` | `test:unit` + `validate:momentum` |
| `npm run validate:momentum` | **OOS walk-forward gate** → VALIDATED / NOT VALIDATED |
| `npm run validate:strategy` | Legacy RSI walk-forward (old MarketAgent harness) |
| `npm run backtest` / `optimize` / `simulate` | Backtest / optimize / simulate |
| `npm run score:shadow` | Score the AI shadow book + AI-authority verdict |
| `npm run status:golive` | Go-live ladder + kill-criteria dashboard |
| `npm run attribute:leaks` | Gross→net leak-attribution waterfall |
| `npm run estimate:survivorship` | Survivorship-bias floor |
| `npm run audit:code` / `audit:strategy` / `audit:profit` | LLM code / strategy / profit audits |

---

## 🔴 Live trading?

**Today the bot is paper-only** (through `kite-paper-node`). The live execution
path is **built** — `LiveTrader` behind a hard `ALLOW_LIVE_ORDERS` gate with
`LIVE_SHADOW_MODE`, order idempotency (`OrderGuard`), and broker reconciliation
(`Reconciler`) — but **off by default**. To go live: set `ALLOW_LIVE_ORDERS=true`
and `LIVE_SHADOW_MODE=false`, point `LIVE_PROVIDER` at the real Zerodha Kite
SDK, and only after passing `npm run validate:momentum` and clearing the
`GoLiveLadder` kill criteria. See `docs/CAPABILITIES.md` and
`docs/STRATEGIES_TECHNIQUES.md` §6.

---

## 📚 Documentation

- [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) — every configurable entity
- [`docs/CAPABILITIES.md`](docs/CAPABILITIES.md) — what the bot can do
- [`docs/BACKTESTING.md`](docs/BACKTESTING.md) — backtest, optimize, walk-forward
- [`docs/STRATEGIES_TECHNIQUES.md`](docs/STRATEGIES_TECHNIQUES.md) — deep strategy/technique analysis
- [`docs/UI_DASHBOARD.md`](docs/UI_DASHBOARD.md) — the web dashboard + mock UI
- [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md) — LLM audit scripts + `llm_traces`
- [`docs/plan/plan.md`](docs/plan/plan.md) — the profitability roadmap
- [`docs/plan/TODO.md`](docs/plan/TODO.md) — the agentic execution queue
- [`Agents.md`](Agents.md) — contribution guide & engineering practices

---

## 🤝 Contributing

Contributions, issues and feature requests are welcome! See
[`Agents.md`](Agents.md) for the engineering practices and safety invariants that
govern this repo.

---

## 📄 Legal & license

- **License:** GPL-3.0 (copyleft — fine for personal/private use).
- **"Kite"** is a trademark of Zerodha; this project is unofficial and not
  affiliated with Zerodha.
- **Not financial advice.** Trading involves risk. This bot is paper-only by
  design; use real capital at your own risk.
