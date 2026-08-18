# Running kite-paper-node & wiring the parent bot

This guide explains how to run `kite-paper-node` (a local, npm-unpublished paper
mock of the Zerodha **Kite Connect** SDK + REST/WebSocket/MCP server) and how the
parent `MyAutonomousKiteBot` project connects to it — either as an **in-process
SDK mock** (zero network) or as a **standalone REST/WebSocket/MCP server**
serving the parent's real NSE daily CSVs.

---

## 1. Build the mock (once)

`kite-paper-node` is consumed locally. Build it first so the parent can resolve
its compiled `dist/`:

```bash
cd kite-paper-node
npm install          # if not already done
npm run build        # tsc → dist/ AND copies instruments.json into dist/data/
```

> `npm run build` runs `tsc` then `build:data`, which copies
> `src/data/instruments.json` into `dist/data/` so the compiled mock can resolve
> the instrument master. The historical candles are **not** embedded in JS —
> they are read from `data/*.csv` at runtime.

---

## 2. The two ways the parent talks to the mock

There are **two independent integration paths** in the parent project; you can
use one or both.

### 2a. In-process SDK mock (KiteStreamer)

The parent's `src/server/KiteStreamer.ts` resolves the Kite SDK classes
conditionally:

```ts
function resolveKiteSdk() {
  if (process.env.PAPER_TRADING === 'true') {
    const mock = require('../../kite-paper-node/dist');
    return {
      KiteConnect: mock.KiteConnect ?? mock.MockKiteConnect,
      KiteTicker: mock.KiteTicker ?? mock.MockKiteTicker,
    };
  }
  return require('kiteconnect');
}
```

- `PAPER_TRADING=true` → uses the **mock in-process** (zero network; ticks and
  candles generated/bridged in memory).
- otherwise → uses the **real** `kiteconnect` SDK (unchanged behavior).

The mock classes extend the real `kiteconnect` classes, so `instanceof` and the
whole `KiteStreamer` call surface work unchanged.

### 2b. Standalone REST / WebSocket / MCP server

`kite-paper-node` also ships a standalone server exposing a Kite-shaped REST
API, a WebSocket ticker, and an optional **MCP (Model Context Protocol)**
endpoint. This is what serves the parent's **real NSE historical CSVs**
(`data/*.csv`, ~210 symbols × 1d/5min/15min/1min). The parent's read-only
`KiteMcpClient` (`KITE_MCP_ENABLED=true`, `KITE_MCP_URL=...`) talks to it.

---

## 3. Run the standalone server (REST + WS + MCP)

```bash
cd kite-paper-node
# REST + WebSocket on :4000, MCP mounted at /mcp (hybrid)
npx ts-node src/bin/cli.ts --port=4000 --mcp=hybrid --mcp-path=/mcp

# or from compiled dist:
node dist/bin/cli.js --port=4000 --mcp=http
```

CLI flags that matter for the parent:

| Flag | Default | Meaning |
|------|---------|---------|
| `--port` | `4000` | REST + WebSocket port |
| `--host` | `0.0.0.0` | Bind host |
| `--mcp` | `off` | `off` \| `stdio` \| `http` \| `hybrid` — MCP mode |
| `--mcp-path` | `/mcp` | HTTP path the MCP handler is mounted at |
| `--mcp-exclude` | `` | Comma-separated tool names to exclude from MCP |
| `--ticker` | `random-walk` | `random-walk` or `replay` |
| `--replay-source` | — | CSV glob for historical replay (ticker=replay) |
| `--state-file` | — | SQLite file to persist orders/positions/ledger across restarts |

### 2c. Persistent broker state (`--state-file`)

By default the mock is **in-memory** — restarting the server loses all orders,
positions and P&L. To make it behave like a **real Zerodha backend that survives
restarts**, point it at a SQLite file:

```bash
npx ts-node src/bin/cli.ts --port=4000 --mcp=hybrid --state-file=./mock-broker.db
```

Every order/GTT/position mutation is written to the DB (via the optional
`better-sqlite3` dependency, resolved from the parent project). On boot the
engine restores the saved state, so a stopped-and-restarted mock retains the
account just like a live broker. Leave `--state-file` unset to keep the old
in-memory behaviour.

With `--mcp=http|hybrid` you get:
- REST: `http://host:4000` (Kite-shaped endpoints)
- WS: `ws://host:4000/ticker`
- MCP: `http://host:4000/mcp`

---

## 4. Point the parent bot at it

Set in the parent's `.env`:

```dotenv
# --- SDK mock (in-process) ---
PAPER_TRADING=true
KITE_API_KEY=mock_key
KITE_ACCESS_TOKEN=mock_token

# --- OR / AND standalone MCP server ---
KITE_MCP_ENABLED=true
KITE_MCP_URL=http://127.0.0.1:4000/mcp
KITE_MCP_TIMEOUT_MS=5000
```

Required env vars for the SDK-mock path:

| Env | Value | Why |
|-----|-------|-----|
| `PAPER_TRADING` | `true` | Switch KiteStreamer to the in-process mock |
| `KITE_API_KEY` | any non-empty (e.g. `mock_key`) | `KiteStreamer.isConfigured` requires it |
| `KITE_ACCESS_TOKEN` | any non-empty (e.g. `mock_token`) | same |

Optional / defaults:

| Env | Default | Notes |
|-----|---------|-------|
| `KITE_ROOT` | `https://api.kite.trade` | Ignored by the mock (in-process) |
| `LIVE_PROVIDER` | `kite` | Live provider used by `index.ts` |
| `WATCHLIST_FILE` | `data/watchlist.json` | Symbols the algo trades (214 symbols today) |
| `KITE_MCP_URL` | `https://mcp.kite.trade/mcp` | Point at the local server for paper |

The bot boots in **paper mode** (it never places real orders) and streams ticks /
serves candles from the mock for every watchlist symbol.

---

## 5. What the mock provides to the parent

| Parent call | Mock behavior |
|-------------|---------------|
| `kite.getInstruments('NSE')` | Returns the instrument master |
| `kite.getHistoricalData(token, interval, from, to)` | Returns `HistoricalData[]` — reads real NSE daily/intraday CSVs (or synthetic JIT candles) |
| `kite.getQuote('NSE:SYMBOL')` | Returns a live JIT quote (incl. `change`) |
| `ticker.subscribe(tokens)` | Auto-registers a generator for each token and streams ticks |
| `ticker.setMode(ticker.MODE_FULL, tokens)` | Supported (`MODE_FULL`/`MODE_LTP`/`MODE_QUOTE`) |
| `ticker.on('ticks', cb)` | Emits ticks every ~1s per symbol |

The mock auto-registers a generator for any token in its instrument master the
moment you subscribe or query it — so you don't need to pre-seed anything.

The parent's `KiteMcpClient` calls a **read-only allowlist** of MCP tools:
`get_quotes, get_ltp, get_ohlc, get_historical_data, search_instruments,
get_profile, get_margins, get_holdings, get_positions, get_mf_holdings,
get_orders, get_trades, get_order_history, get_order_trades, get_gtts`.

---

## 6. Symbols & data available

- `kite-paper-node/data/` holds **real NSE historical data**: ~210 symbols, each
  with `_1d`, `_5min`, `_15min`, `_1min` CSVs (837 CSV files total; the `_1d`
  series spans ~250 trading days, Aug 2025 → Aug 2026).
- `src/data/instruments.json` is a small bootstrap master (a few base entries);
  the CSV-backed dataset is the real source of breadth.
- The parent's watchlist is `data/watchlist.json` (214 symbols). To trade a
  symbol, ensure it has a matching CSV (or a generator) and a unique
  `instrument_token`.

---

## 7. Deterministic testing (optional)

You can drive prices deterministically from any script by importing the mock
engine directly:

```js
const { mockEngine } = require('./kite-paper-node/dist');
mockEngine.emitTick({ instrument_token: 738561, last_price: 2450.0 }); // e.g. RELIANCE
```

This forces a price that triggers your limit/stop orders exactly.

---

## 8. Switching back to live

Just unset `PAPER_TRADING` (or set it to anything but `true`) and provide real
`KITE_API_KEY` / `KITE_ACCESS_TOKEN` / `KITE_ROOT`. No code changes needed.

---

## Troubleshooting

- **"Cannot find module '../../kite-paper-node/dist'"** → run `npm run build`
  inside `kite-paper-node` first.
- **No ticks for a symbol** → the symbol must be in the instrument master / CSV
  set (the mock only generates ticks for known tokens).
- **`Kite configured: false`** → set `KITE_API_KEY` and `KITE_ACCESS_TOKEN` to
  non-empty values.
- **MCP not responding** → start the standalone server with `--mcp=http|hybrid`
  and confirm `KITE_MCP_URL` points at `http://127.0.0.1:<port>/mcp`.
- **Wrong data range** → the `_1d` CSVs hold ~250 trading days; longer lookbacks
  than that are not supported by the bundled data.
