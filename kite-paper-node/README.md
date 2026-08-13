# kite-paper-node

**Zero-dependency paper trading mock engine for Zerodha Kite Connect.**

`kite-paper-node` is a 1:1, drop-in substitute for the official `kiteconnect`
Node.js client (`KiteConnect` and `KiteTicker`). Algorithmic trading developers
can switch between live Zerodha Kite APIs and this paper-trading mock engine by
changing a single environment variable — **without altering a single line of
their strategy execution logic**.

All market data is generated **Just-In-Time (JIT)** — prices, volumes, bid/ask,
and OHLC are produced algorithmically at runtime for the symbols you choose. No
static price files, no external data source, no broker account required.

---

## Features

- **Dual execution modes**
  - **In-Process SDK Mock** — subclasses `KiteConnect`/`KiteTicker`, zero network overhead.
  - **Standalone Server** — REST + WebSocket server mirroring Zerodha's URLs (`http://localhost:4000/orders`, `ws://localhost:4000/ticker`).
- **Order engine** — `MARKET`, `LIMIT`, `SL`, `SL-M` across `regular`/`amo`/`iceberg` varieties and `MIS`/`CNC`/`NRML` products.
- **Portfolio & ledger** — positions (net/day), holdings, margins, realized/unrealized P&L, cash balance.
- **JIT market data** — Random Walk Generator (GBM + GARCH volatility clustering, mean reversion, momentum, volume spikes, tick-size rounding) with one generator per symbol.
- **Historical replay** — replay CSV/array tick data deterministically.
- **KiteTicker modes** — `modeLTP`, `modeQuote`, `modeFull` with binary packet packing.
- **REST API coverage** — profile, margins, orders, positions, holdings, quotes, historical data, GTT.
- **Deterministic testing** — `mockEngine.emitTick()`, seeded PRNG, state introspection.
- **TypeScript** — full type definitions, autocompletion out of the box.

---

## Installation

```bash
npm install --save-dev kite-paper-node
```

> `kiteconnect` is a peer dependency (used for class extension). `express` and
> `ws` are optional — only needed for standalone server mode.

---

## Quick Start

### 1. Zero-friction switchover

```javascript
const isPaperTesting = process.env.PAPER_TRADING === "true";

const { KiteConnect, KiteTicker } = isPaperTesting
  ? require("kite-paper-node")
  : require("kiteconnect");

// The rest of your strategy code remains 100% identical
const kite = new KiteConnect({ api_key: "mock_key" });
const ticker = new KiteTicker({ api_key: "mock_key", access_token: "mock_token" });
```

### 2. Standalone server (CLI)

```bash
# Start on port 4000 with pre-loaded mock tickers
npx kite-paper-node --port=4000 --seed-symbols=RELIANCE,NIFTY50,BANKNIFTY
```

Then hit it from any language:

```bash
curl "http://localhost:4000/quote?i=NSE:RELIANCE"
curl -X POST http://localhost:4000/orders/regular \
  -H "Content-Type: application/json" \
  -d '{"tradingsymbol":"RELIANCE","exchange":"NSE","transaction_type":"BUY","order_type":"LIMIT","quantity":10,"price":2400,"product":"MIS"}'
```

### 3. Programmatic API

```javascript
const { createMockServer, MockKiteConnect, MockKiteTicker, mockEngine } = require("kite-paper-node");

// In-process mock
const kite = new MockKiteConnect({ api_key: "test" });
const ticker = new MockKiteTicker({ api_key: "test", access_token: "test" });

// Deterministic testing — force a price to trigger limit orders
mockEngine.emitTick({ instrument_token: 738561, last_price: 2450.0 });

// Standalone server
const server = await createMockServer({
  ticker: { mode: "random-walk", randomWalk: { seedSymbols: ["RELIANCE", "NIFTY50"] } },
});
```

---

## JIT Data Generation

`kite-paper-node` generates all market data on the fly. You control which
symbols it works on:

```javascript
// Pre-fill symbols at startup
mockEngine.configure({
  ticker: { mode: "random-walk", randomWalk: { seedSymbols: ["RELIANCE", "NIFTY50"] } },
});

// Or add symbols at runtime
mockEngine.addSymbol("TATASTEEL", { basePrice: 155.0 });
```

The **same generator instance** for a symbol feeds the WebSocket stream, the
REST `/quote`/`/ltp`/`/ohlc` endpoints, the order matching engine, and the
historical data service — so there is **zero divergence** between streaming and
polling consumers.

---

## Realistic Price Action (regime generator)

The random-walk generator uses a **regime state machine** so price actually
trends, ranges, and makes sharp moves — producing the oversold/overbought
conditions that trigger RSI/Bollinger signals:

| Regime | Behavior | Effect on signals |
|--------|----------|-------------------|
| `trending_up` | positive drift, moderate vol | RSI climbs, price → upper band |
| `trending_down` | negative drift | **RSI < 30, price → lower band** (LONG signal) |
| `ranging` | near-zero drift, low vol, mean-reversion | consolidation |
| `volatile` | high vol, no drift | sharp swings both ways |

Plus **intraday seasonality** (U-shaped vol: high at 09:15 open / 15:30 close,
low midday) and occasional **event shocks** (1% jumps/dumps).

```bash
# Tune for more/faster signals
npx kite-paper-node --seed-symbols=RELIANCE \
  --volatility=0.0001 \
  --regime-switch-bars=1200 \
  --regime-persistence=0.5 \
  --seed=42

# Highest fidelity: replay real NSE candles as ticks
npx kite-paper-node --ticker-mode=replay --replay-source=./data/RELIANCE_1min.csv
```

> **Note:** a random walk, however tuned, is still synthetic. For the most
> reliable signal generation, use **real NSE data** (below).

---

## Real NSE Data (CSV-backed)

Fetch **real historical NSE data** from Yahoo and the mock will serve it
instead of the random walk — **latest day = live, prior days = historical**.

```bash
# 1. Fetch real data for every watchlist symbol (1m/5m/15m/1d)
cd kite-paper-node
node scripts/fetch-watchlist-csv.js --sync-watchlist
# → data/RELIANCE_1min.csv, data/RELIANCE_5min.csv, ... (one per symbol per interval)

# 2. Run the mock — it auto-prefers the CSVs
npx kite-paper-node --seed-symbols=RELIANCE,TCS
```

How the mock uses the CSVs:

| Call | Source |
|------|--------|
| `getQuote` / `getLTP` / `getOHLC` / MCP quotes | **Latest day** of the finest CSV (live) |
| `getHistoricalData` / MCP historical | **Days before** the latest day (exact interval, or aggregated up) |
| WebSocket / ticker | Streams the **latest day** as ticks |
| Symbol with no CSV | Falls back to the **random walk** |

Fetch options:

```bash
node scripts/fetch-watchlist-csv.js --symbols=RELIANCE,TCS   # only these
node scripts/fetch-watchlist-csv.js --sync-watchlist          # also rewrite parent watchlist
```

---

## Example Strategies

### Moving Average Crossover

```javascript
const { MockKiteConnect, MockKiteTicker, mockEngine } = require("kite-paper-node");

const kite = new MockKiteConnect({ api_key: "test" });
const ticker = new MockKiteTicker({ api_key: "test", access_token: "test" });

let prices = [];
ticker.on("ticks", async (ticks) => {
  for (const t of ticks) {
    prices.push(t.last_price);
    if (prices.length < 20) continue;
    const fast = avg(prices.slice(-5));
    const slow = avg(prices.slice(-20));
    if (fast > slow) {
      await kite.placeOrder("regular", {
        tradingsymbol: "RELIANCE", exchange: "NSE",
        transaction_type: "BUY", order_type: "MARKET",
        quantity: 1, product: "MIS",
      });
    }
  }
});

ticker.connect();
ticker.subscribe([738561]);
```

### Limit Order Grid

```javascript
const { MockKiteConnect, mockEngine } = require("kite-paper-node");
const kite = new MockKiteConnect({ api_key: "test" });

// Place a grid of buy limits below the current price
for (let i = 1; i <= 5; i++) {
  await kite.placeOrder("regular", {
    tradingsymbol: "RELIANCE", exchange: "NSE",
    transaction_type: "BUY", order_type: "LIMIT",
    quantity: 10, price: 2500 - i * 10, product: "MIS",
  });
}

// Drive the price down to fill the grid deterministically
for (let p = 2500; p >= 2440; p -= 10) {
  mockEngine.emitTick({ instrument_token: 738561, last_price: p });
}
```

---

## CLI Reference

| Flag | Env | Default | Description |
|------|-----|---------|-------------|
| `--port` | `KITE_MOCK_PORT` | `4000` | HTTP/WS port |
| `--host` | `KITE_MOCK_HOST` | `127.0.0.1` | Bind address |
| `--seed-symbols` | `KITE_MOCK_SYMBOLS` | — | Comma-separated symbols |
| `--starting-capital` | `KITE_MOCK_CAPITAL` | `1000000` | Initial virtual capital |
| `--ticker-mode` | `KITE_MOCK_TICKER` | `random-walk` | `random-walk`, `historical`, or `replay` |
| `--volatility` | `KITE_MOCK_VOLATILITY` | `0.0001` | Per-tick base volatility (σ) |
| `--volatility-scale` | — | — | Per-instrument vol scale: `738561:1.5,779521:2.0` |
| `--tick-interval` | `KITE_MOCK_TICK_MS` | `1000` | ms between ticks |
| `--seed` | — | — | PRNG seed (reproducible price path) |
| `--regime-switch-bars` | — | `1200` | Ticks between regime switches |
| `--regime-probabilities` | — | — | `trending_up:0.25,trending_down:0.25,ranging:0.35,volatile:0.15` |
| `--regime-persistence` | — | `0.5` | Chance to stay in current regime (trend length) |
| `--seasonality` | — | `true` | U-shaped intraday volatility (open/close) |
| `--shock-probability` | — | `0.01` | Per-tick chance of an event shock |
| `--shock-size` | — | `0.01` | Event shock magnitude (fraction) |
| `--historical-csv` | `KITE_MOCK_CSV` | — | Historical CSV path |
| `--replay-source` | — | — | Replay source (CSV path) for `--ticker-mode=replay` |
| `--replay-speed` | `KITE_MOCK_SPEED` | `1` | Replay speed multiplier |
| `--loop` | `KITE_MOCK_LOOP` | `false` | Loop historical replay |
| `--enable-cors` | `KITE_MOCK_CORS` | `false` | Enable CORS |
| `--log-level` | `KITE_MOCK_LOG` | `info` | Logging level |
| `--config` | — | — | JSON config file |
| `--no-realism` | `KITE_MOCK_NO_REALISM` | `false` | Disable realism features |
| `--mcp` | `KITE_MOCK_MCP` | `off` | MCP mode: `off` \| `stdio` \| `http` \| `hybrid` |
| `--mcp-path` | — | `/mcp` | MCP HTTP endpoint path |
| `--mcp-exclude` | — | `` | Comma-separated tools to omit (Kite MCP parity) |

---

## Model Context Protocol (MCP)

`kite-paper-node` can expose the **same 22 MCP tools** as Zerodha's official
`kite-mcp-server` (`login`, `get_quotes`, `get_positions`, `place_order`, …),
backed by the mock's JIT data — so an AI agent written for live Kite MCP works
against the mock with **zero changes**. See
[`docs/ARCHITECTURE-MCP.md`](docs/ARCHITECTURE-MCP.md).

```bash
# Local agent subprocess (stdio)
npx kite-paper-node --mcp=stdio --seed-symbols=RELIANCE,NIFTY50

# Over HTTP alongside the REST/WS server
npx kite-paper-node --mcp=http --port=4000 --seed-symbols=RELIANCE,NIFTY50
```

Programmatic use:

```javascript
const { MockEngine } = require("kite-paper-node");
const { createMcpServer } = require("kite-paper-node/dist/mcp");
const engine = new MockEngine();
engine.addSymbol("RELIANCE", { basePrice: 2500 });
const mcpServer = createMcpServer(engine); // connect a transport of your choice
```

---

## Testing

```bash
npm test          # run the test suite
npm run build     # compile TypeScript
npm run typecheck # type-check without emitting
```

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — full 540° design document.

---

## License

[MIT](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

> ⚠️ **WARNING:** `kite-paper-node` is a testing tool. Do NOT expose it to the
> public internet. It has no authentication, no encryption, and no rate limiting
> by default. It is designed for `localhost` development only.
