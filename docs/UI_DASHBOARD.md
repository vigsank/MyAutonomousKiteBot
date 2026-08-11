# UI Dashboard & Mock UI

The project ships a full **React web dashboard** that visualizes the bot's state
in real time. It reads from the same SQLite ledger the bot writes to, over a
small **Express REST API + WebSocket** backend served by the bot process.

## Stack

- **Framework:** Vite + React 18 + TypeScript + Tailwind (shadcn/ui components).
- **Charts:** TradingView **Lightweight Charts** (candlesticks) + **Recharts**
  (equity curve, PnL bars, allocation donut).
- **State/data:** TanStack Query (auto-refetch + WebSocket-driven invalidation),
  Zustand (toast store), React Router (multi-page).
- **Live updates:** the bot broadcasts a `refresh` event over WebSocket every few
  seconds and pushes new **notifications** as toasts; the client invalidates its
  queries on each refresh.

## Pages

| Route | Shows |
| ----- | ----- |
| `/` Overview | Capital, today's PnL, win rate, drawdown, equity curve, allocation, live ticker, health, activity, signals |
| `/market` | Interactive candlestick chart (symbol + interval selectors) |
| `/positions` | Open positions + unrealized PnL + allocation donut |
| `/orders` | Order book |
| `/trades` | Trade blotter + realized PnL |
| `/signals` | Signal feed (direction, RSI, sentiment, reason) |
| `/risk` | Risk-gate audit trail + component health |
| `/notifications` | Filterable activity feed |
| `/llm-traces` | Every LLM call (prompt/response/latency/tokens) — expandable rows |

## API

The bot's `src/server/api/server.ts` exposes read-only endpoints:

`/api/overview`, `/api/positions`, `/api/orders`, `/api/trades`, `/api/signals`,
`/api/risk-events`, `/api/notifications`, `/api/daily-summary`, `/api/health`,
`/api/watchlist`, `/api/candles?symbol=&interval=`, `/api/candle-intervals`,
`/api/llm-traces`, `/api/healthz`, plus `ws://host/ws`.

## Running

```bash
# One command: build the dashboard, then run bot + API + dashboard on :3000
npm run build:ui && npm run dev

# Development with hot reload (Vite on :5173, proxies /api + /ws to :3000)
npm run dev      # terminal 1
npm run dev:ui   # terminal 2
```

## Mock UI (no broker, no API keys)

`npm run mock:ui` seeds a **throwaway SQLite ledger** (`data/mock_ui/`) with a
large volume of realistic data (instruments, candles, ticks, positions, orders,
trades, signals, risk events, notifications, daily summaries), boots the
dashboard against it, and **deletes the mock DB on exit** — your real
`data/ledger.db` is never touched. Useful for exploring the UI without live data:

```bash
npm run build:ui   # once
npm run mock:ui    # open http://localhost:3000
```

The mock uses a dedicated schema/DB file (not the main tables), so a real bot run
and a mock run never collide. Set `UI_PORT` to change the port (default 3000).

## Config

- `UI_PORT` (default `3000`) and `UI_HOST` (default `0.0.0.0`) — where the UI
  server listens.
- In dev, Vite proxies `/api` and `/ws` to the bot; override with
  `UI_API_TARGET` (default `http://localhost:3000`).
