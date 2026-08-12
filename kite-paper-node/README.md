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
| `--ticker-mode` | `KITE_MOCK_TICKER` | `random-walk` | `random-walk` or `historical` |
| `--volatility` | `KITE_MOCK_VOLATILITY` | `0.002` | Price volatility (σ) |
| `--tick-interval` | `KITE_MOCK_TICK_MS` | `1000` | ms between ticks |
| `--historical-csv` | `KITE_MOCK_CSV` | — | Historical CSV path |
| `--replay-speed` | `KITE_MOCK_SPEED` | `1` | Replay speed multiplier |
| `--loop` | `KITE_MOCK_LOOP` | `false` | Loop historical replay |
| `--enable-cors` | `KITE_MOCK_CORS` | `false` | Enable CORS |
| `--log-level` | `KITE_MOCK_LOG` | `info` | Logging level |
| `--config` | — | — | JSON config file |
| `--no-realism` | `KITE_MOCK_NO_REALISM` | `false` | Disable realism features |

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
