# HOW-TO-USE — kite-paper-node

A practical, hands-on guide to using `kite-paper-node` in every mode it
supports. This complements the design document (`ARCHITECTURE.md`) with
concrete, copy-pasteable examples.

---

## Table of Contents

1. [What You Can Do With This](#1-what-you-can-do-with-this)
2. [Installation](#2-installation)
3. [The Two Execution Modes](#3-the-two-execution-modes)
4. [Mode A — In-Process SDK Mock (Class Override)](#4-mode-a--in-process-sdk-mock-class-override)
5. [Mode B — Standalone Server (REST + WebSocket)](#5-mode-b--standalone-server-rest--websocket)
6. [JIT Data Generation — Working With Your Own Symbols](#6-jit-data-generation--working-with-your-own-symbols)
7. [Order Types & Matching Behavior](#7-order-types--matching-behavior)
8. [Deterministic Testing & Tick Injection](#8-deterministic-testing--tick-injection)
9. [Historical Replay Mode](#9-historical-replay-mode)
10. [The CLI in Detail](#10-the-cli-in-detail)
11. [Programmatic API Reference](#11-programmatic-api-reference)
12. [Switching Between Live and Paper (Migration)](#12-switching-between-live-and-paper-migration)
13. [Example Strategies](#13-example-strategies)
14. [Troubleshooting & FAQ](#14-troubleshooting--faq)

---

## 1. What You Can Do With This

| Use case | Mode | How |
|----------|------|-----|
| Develop/debug a strategy locally, no broker account | In-Process | `new MockKiteConnect(...)` |
| Run a strategy in a separate process / another language | Standalone Server | `npx kite-paper-node` |
| Deterministic unit tests with forced prices | In-Process | `mockEngine.emitTick(...)` |
| Replay a historical day of ticks | Standalone or In-Process | Historical replay |
| Test against a realistic evolving price series | Either | Random Walk Generator |
| CI/CD strategy validation | Either | Seed + assert on state |

---

## 2. Installation

```bash
npm install --save-dev kite-paper-node
```

### Optional dependencies

| Package | Needed for | Install |
|---------|-----------|---------|
| `kiteconnect` | Extending the real `KiteConnect`/`KiteTicker` classes (peer) | `npm install kiteconnect` |
| `express` | Standalone REST server | `npm install express` |
| `ws` | Standalone WebSocket server | `npm install ws` |

> The core engine works with **zero** of these installed — the mock classes
> fall back to minimal base classes. Install `express`/`ws` only if you use
> standalone server mode, and `kiteconnect` only if you want the mock classes
> to extend the real ones (preserving `instanceof` checks).

---

## 3. The Two Execution Modes

```
┌─────────────────────────────────────────────────────────────┐
│                    kite-paper-node                          │
│                                                             │
│   MODE A (in-process)          MODE B (standalone server)  │
│   ┌─────────────────────┐      ┌──────────────────────────┐ │
│   │ Your strategy       │      │ Your strategy (any lang)│ │
│   │   └─ MockKiteConnect│      │   └─ HTTP / WebSocket   │ │
│   │   └─ MockKiteTicker │      │        │                │ │
│   │        │            │      │        ▼                │ │
│   │   MockEngine (same  │      │  kite-paper-node server │ │
│   │   process, 0ms)     │      │  :4000 REST + WS        │ │
│   └─────────────────────┘      └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- **Mode A** — everything runs in your process. Zero network, zero latency,
  ideal for unit tests and fast iteration.
- **Mode B** — a standalone HTTP/WS server. Use it from Python, Go, or a
  separate Node.js process, or to test a client against real network I/O.

---

## 4. Mode A — In-Process SDK Mock (Class Override)

### 4.1 Basic usage

```javascript
const { MockKiteConnect, MockKiteTicker, mockEngine } = require("kite-paper-node");

// 1. Configure the engine and pre-load symbols (JIT data).
mockEngine.configure({
  startingCapital: 1_000_000,
  ticker: {
    mode: "random-walk",
    randomWalk: { seedSymbols: ["RELIANCE", "NIFTY50"] },
  },
});

// 2. Create the mock SDK objects — same API as kiteconnect.
const kite = new MockKiteConnect({ api_key: "mock_key" });
const ticker = new MockKiteTicker({ api_key: "mock_key", access_token: "mock_token" });

// 3. Use them exactly like the real library.
async function main() {
  const profile = await kite.getProfile();
  console.log("User:", profile.user_id);

  const { order_id } = await kite.placeOrder("regular", {
    tradingsymbol: "RELIANCE",
    exchange: "NSE",
    transaction_type: "BUY",
    order_type: "LIMIT",
    quantity: 10,
    price: 2400,
    product: "MIS",
  });
  console.log("Placed order:", order_id);

  // 4. Stream ticks.
  ticker.on("ticks", (ticks) => {
    console.log("Tick:", ticks[0].last_price);
  });
  ticker.connect();
  ticker.subscribe([738561]); // RELIANCE token
}
main();
```

### 4.2 What the mock SDK supports

`MockKiteConnect` mirrors the `kiteconnect` method surface:

| Method | Notes |
|--------|-------|
| `generateSession(requestToken, apiSecret)` | Returns full `SessionData` |
| `setAccessToken(token)` | Accepts any token |
| `getProfile()` | Static mock profile |
| `getMargins(segment?)` | `{equity?, commodity?}` from ledger |
| `placeOrder(variety, params)` | All varieties/types/products |
| `modifyOrder(variety, orderId, params)` | Price/qty/trigger |
| `cancelOrder(variety, orderId)` | Open + trigger-pending only |
| `getOrders()` / `getOrderHistory(id)` / `getOrderTrades(id)` / `getTrades()` | Order queries |
| `getPositions()` / `getHoldings()` | Portfolio (`{net, day}`) |
| `convertPosition(params)` | Change product type |
| `getInstruments(exchange?)` | From instrument master |
| `getHistoricalData(token, interval, from, to)` | Returns `HistoricalData[]` objects |
| `getQuote(ids)` / `getOHLC(ids)` / `getLTP(ids)` | JIT market data (accepts string or array) |
| `orderMargins(orders)` / `orderBasketMargins(orders)` | Margin computation |
| `placeGTT` / `getGTTs` / `getGTT` / `modifyGTT` / `deleteGTT` | GTT triggers |
| `getMFOrders` / `getMFHoldings` / `placeMFOrder` / `getMFInstruments` | Stubs (empty/error) |

`MockKiteTicker` mirrors `KiteTicker`:

| Method / Event | Notes |
|----------------|-------|
| `connect()` / `disconnect()` | Mock connects immediately |
| `subscribe(tokens)` / `unsubscribe(tokens)` | Manage subscriptions |
| `setMode('ltp'\|'quote'\|'full')` | Tick mode |
| `on('ticks', cb)` | Receive ticks for subscribed tokens |
| `on('connect'\|'close'\|'error')` | Lifecycle events |

---

## 5. Mode B — Standalone Server (REST + WebSocket)

### 5.1 Start the server

```bash
npx kite-paper-node --port=4000 --seed-symbols=RELIANCE,NIFTY50,BANKNIFTY
```

Output:

```
kite-paper-node mock server running
  REST:  http://127.0.0.1:4000
  WS:    ws://127.0.0.1:4000/ticker
  Symbols: RELIANCE, NIFTY50, BANKNIFTY
  Capital: 1000000
  Press Ctrl+C to stop.
```

### 5.2 REST endpoints

The server mirrors Zerodha's Kite Connect REST API:

```bash
# Profile
curl "http://localhost:4000/user/profile"

# Margins
curl "http://localhost:4000/user/margins"

# Place an order
curl -X POST http://localhost:4000/orders/regular \
  -H "Content-Type: application/json" \
  -d '{"tradingsymbol":"RELIANCE","exchange":"NSE","transaction_type":"BUY","order_type":"LIMIT","quantity":10,"price":2400,"product":"MIS"}'

# List orders
curl "http://localhost:4000/orders"

# Positions / holdings
curl "http://localhost:4000/portfolio/positions"
curl "http://localhost:4000/portfolio/holdings"

# JIT quotes (live generated prices)
curl "http://localhost:4000/quote?i=NSE:RELIANCE,NSE:NIFTY50"
curl "http://localhost:4000/ltp?i=NSE:RELIANCE"
curl "http://localhost:4000/ohlc?i=NSE:RELIANCE"

# Historical candles (JIT)
curl "http://localhost:4000/instruments/historical/738561/minute?from=2025-01-01T09:15:00Z&to=2025-01-01T15:30:00Z"

# Instruments
curl "http://localhost:4000/instruments"
curl "http://localhost:4000/instruments/NSE"

# GTT
curl -X POST http://localhost:4000/gtt/triggers \
  -H "Content-Type: application/json" \
  -d '{"instrument_token":738561,"exchange":"NSE","tradingsymbol":"RELIANCE","trigger_values":[2500],"orders":[{"exchange":"NSE","tradingsymbol":"RELIANCE","transaction_type":"SELL","quantity":10,"order_type":"LIMIT","product":"MIS","price":2500}]}'
```

### 5.3 WebSocket ticker

Connect to `ws://localhost:4000/ticker` and send JSON control messages:

```javascript
// Node.js client
const WebSocket = require("ws");
const ws = new WebSocket("ws://localhost:4000/ticker");

ws.on("open", () => {
  // Subscribe to RELIANCE (738561) and NIFTY50 (256265)
  ws.send(JSON.stringify({ a: "subscribe", v: [738561, 256265] }));
  // Set mode to full (default) / quote / ltp
  ws.send(JSON.stringify({ a: "mode", v: "full" }));
});

ws.on("message", (data) => {
  if (Buffer.isBuffer(data)) {
    // Binary frame — parse per the Kite binary protocol
    const token = data.readUInt32LE(3);
    const lastPrice = data.readFloatLE(7);
    console.log(`Token ${token} @ ${lastPrice}`);
  } else {
    console.log("Control:", data.toString());
  }
});
```

### 5.4 Using it from Python

```python
import requests
import websocket

# REST
r = requests.get("http://localhost:4000/quote", params={"i": "NSE:RELIANCE"})
print(r.json()["data"]["NSE:RELIANCE"]["last_price"])

# WebSocket
ws = websocket.WebSocket()
ws.connect("ws://localhost:4000/ticker")
ws.send('{"a":"subscribe","v":[738561]}')
frame = ws.recv()
print("Received binary frame of", len(frame), "bytes")
```

---

## 6. JIT Data Generation — Working With Your Own Symbols

All market data is generated **Just-In-Time**. You decide which symbols the
engine works on.

### 6.1 Pre-fill symbols at startup

```javascript
// Via config
mockEngine.configure({
  ticker: {
    mode: "random-walk",
    randomWalk: {
      seedSymbols: ["RELIANCE", "NIFTY50", "BANKNIFTY"],
    },
  },
});

// Via CLI
// npx kite-paper-node --seed-symbols=RELIANCE,NIFTY50,BANKNIFTY
```

### 6.2 Add symbols at runtime

```javascript
// Add a symbol with an explicit base price
mockEngine.addSymbol("TATASTEEL", { basePrice: 155.0 });

// Add with custom volatility
mockEngine.addSymbol("INFY", { basePrice: 1450, volatility: 0.003 });

// List what's loaded
console.log(mockEngine.listSymbols());

// Remove a symbol
mockEngine.removeSymbol("TATASTEEL");
```

### 6.3 Control the generators

```javascript
// Set a base price (resets the generator's current price)
mockEngine.setBasePrice(738561, 2500);

// Pause / resume tick generation
mockEngine.pauseTicker(738561);   // one symbol
mockEngine.pauseTicker();          // all symbols
mockEngine.resumeTicker(738561);

// Seed the PRNG for reproducible price series
mockEngine.seedRandom(42);
```

### 6.4 Consistency guarantee

The **same generator instance** for a symbol feeds:

- the WebSocket stream,
- the REST `/quote`, `/ltp`, `/ohlc` endpoints,
- the order matching engine,
- the historical data service.

So a price you see on `/quote` is the same price the matching engine uses to
fill orders, and the same price a WebSocket subscriber receives. There is no
divergence.

---

## 7. Order Types & Matching Behavior

| Order type | Initial state | Fills when |
|-----------|----------------|------------|
| `MARKET` | `OPEN` | Next tick (at `ask` for BUY, `bid` for SELL) |
| `LIMIT` | `OPEN` | `BUY`: `last_price <= price`; `SELL`: `last_price >= price` |
| `SL` | `TRIGGER PENDING` | Trigger hit → `OPEN`, then fills at limit price |
| `SL-M` | `TRIGGER PENDING` | Trigger hit → fills at market price |

```javascript
// MARKET
await kite.placeOrder("regular", {
  tradingsymbol: "RELIANCE", exchange: "NSE",
  transaction_type: "BUY", order_type: "MARKET",
  quantity: 10, product: "MIS",
});

// LIMIT
await kite.placeOrder("regular", {
  tradingsymbol: "RELIANCE", exchange: "NSE",
  transaction_type: "BUY", order_type: "LIMIT",
  quantity: 10, price: 2400, product: "MIS",
});

// SL (stop-loss limit)
await kite.placeOrder("regular", {
  tradingsymbol: "RELIANCE", exchange: "NSE",
  transaction_type: "SELL", order_type: "SL",
  quantity: 10, price: 2350, trigger_price: 2380, product: "MIS",
});

// SL-M (stop-loss market)
await kite.placeOrder("regular", {
  tradingsymbol: "RELIANCE", exchange: "NSE",
  transaction_type: "SELL", order_type: "SL-M",
  quantity: 10, trigger_price: 2380, product: "MIS",
});
```

### Varieties & products

- **Varieties:** `regular`, `amo`, `iceberg`
- **Products:** `MIS` (intraday), `CNC` (delivery), `NRML` (F&O)

---

## 8. Deterministic Testing & Tick Injection

The killer feature for testing: force exact prices and assert on state.

### 8.1 Inject a single tick

```javascript
const { mockEngine } = require("kite-paper-node");

// Force RELIANCE to 2450.0 — triggers any matching limit orders synchronously.
mockEngine.emitTick({ instrument_token: 738561, last_price: 2450.0 });
```

### 8.2 Inject a batch

```javascript
mockEngine.emitTicks([
  { instrument_token: 738561, last_price: 2450 },
  { instrument_token: 738561, last_price: 2449 },
  { instrument_token: 738561, last_price: 2448 },
]);
```

### 8.3 Assert on engine state

```javascript
// Orders
const orders = mockEngine.getOrders({ status: "COMPLETE" });
const order = mockEngine.getOrderById("260812000000001");

// Portfolio
const positions = mockEngine.getPositions();
const holdings = mockEngine.getHoldings();
const margins = mockEngine.getMargins();
const ledger = mockEngine.getLedger();

// GTT
const gtts = mockEngine.getGTTs();
```

### 8.4 Force order state (edge-case testing)

```javascript
mockEngine.forceFillOrder(orderId, 2450);      // force a fill
mockEngine.forceRejectOrder(orderId, "rejected"); // force a rejection
mockEngine.forceCancelOrder(orderId);          // force a cancel
```

### 8.5 Full test example

```javascript
const { MockKiteConnect, mockEngine } = require("kite-paper-node");

test("BUY LIMIT fills when price drops to limit", async () => {
  mockEngine.reset({ startingCapital: 1_000_000 });
  mockEngine.addSymbol("RELIANCE", { basePrice: 2500 });

  const kite = new MockKiteConnect({ api_key: "test" });
  const { order_id } = await kite.placeOrder("regular", {
    tradingsymbol: "RELIANCE", exchange: "NSE",
    transaction_type: "BUY", order_type: "LIMIT",
    quantity: 10, price: 2450, product: "MIS",
  });

  expect(mockEngine.getOrderById(order_id).status).toBe("OPEN");

  mockEngine.emitTick({ instrument_token: 738561, last_price: 2450 });

  expect(mockEngine.getOrderById(order_id).status).toBe("COMPLETE");
  expect(mockEngine.getPositions()[0].quantity).toBe(10);
});
```

---

## 9. Historical Replay Mode

Replay a recorded day of ticks deterministically.

### 9.1 CSV format

```csv
instrument_token,timestamp,last_price,open,high,low,close,volume,bid,ask,buy_quantity,sell_quantity
738561,2025-01-01T09:15:00Z,2450,2445,2455,2440,2450,12000,2449.95,2450.05,6000,6000
738561,2025-01-01T09:16:00Z,2452,2450,2455,2448,2452,9800,2451.95,2452.05,5000,4800
```

### 9.2 Replay via config

```javascript
mockEngine.configure({
  ticker: {
    mode: "historical-replay",
    historicalReplay: {
      source: "./data/RELIANCE_1min.csv",
      replaySpeed: 2,          // 2x real-time
      loopMode: "once",        // once | loop | bounce
    },
  },
});
```

### 9.3 Replay programmatically

```javascript
const { mockEngine } = require("kite-paper-node");

// Instant replay (speed 0) — all ticks emitted immediately.
await mockEngine.loadHistoricalReplay({
  source: "./data/RELIANCE_1min.csv",
  replaySpeed: 0,
});

// Or from an array of records.
await mockEngine.loadHistoricalReplay({
  source: [
    { instrument_token: 738561, timestamp: "2025-01-01T09:15:00Z", last_price: 2450, open: 2445, high: 2455, low: 2440, close: 2450, volume: 12000, bid: 2449.95, ask: 2450.05, buy_quantity: 6000, sell_quantity: 6000 },
  ],
  replaySpeed: 0,
});
```

### 9.4 Replay via CLI

```bash
npx kite-paper-node \
  --ticker-mode=historical \
  --historical-csv=./data/NIFTY50_2024.csv \
  --replay-speed=2 \
  --loop
```

---

## 10. The CLI in Detail

### 10.1 All options

```bash
npx kite-paper-node \
  --port=4000 \
  --host=127.0.0.1 \
  --seed-symbols=RELIANCE,NIFTY50,BANKNIFTY \
  --starting-capital=1000000 \
  --ticker-mode=random-walk \
  --volatility=0.003 \
  --tick-interval=500 \
  --enable-cors \
  --log-level=debug \
  --config=./paper-config.json
```

### 10.2 Config file

```json
{
  "server": { "port": 4000, "host": "127.0.0.1", "enableCORS": false },
  "startingCapital": 1000000,
  "ticker": {
    "mode": "random-walk",
    "randomWalk": {
      "seed": 42,
      "seedSymbols": ["RELIANCE", "NIFTY50"],
      "volatility": 0.002,
      "tickIntervalMs": 1000,
      "enableRealismFeatures": true
    }
  }
}
```

```bash
npx kite-paper-node --config=./paper-config.json
```

---

## 11. Programmatic API Reference

### 11.1 `createMockServer(options)` — start a standalone server in code

```javascript
const { createMockServer } = require("kite-paper-node");

const server = await createMockServer({
  startingCapital: 500000,
  ticker: { mode: "random-walk", randomWalk: { seedSymbols: ["RELIANCE"] } },
  server: { port: 4000, host: "127.0.0.1", enableCORS: false },
});

console.log("REST:", `http://127.0.0.1:${server.port}`);
console.log("WS:", `ws://127.0.0.1:${server.port}/ticker`);

// Access the engine directly for testing
server.engine.emitTick({ instrument_token: 738561, last_price: 2450 });

// Shut down
await server.stop();
```

### 11.2 `mockEngine` — the global singleton

| Method | Purpose |
|--------|---------|
| `configure(config)` | Set configuration |
| `reset(config?)` | Reset all state |
| `addSymbol(symbol, opts?)` | Add a symbol (JIT) |
| `removeSymbol(symbol)` | Remove a symbol |
| `listSymbols()` | List loaded symbols |
| `emitTick(tick)` / `emitTicks(ticks)` | Inject ticks |
| `setBasePrice(token, price)` | Set base price |
| `pauseTicker(token?)` / `resumeTicker(token?)` | Control generators |
| `seedRandom(seed)` | Seed PRNG |
| `getOrders(filter?)` / `getOrderById(id)` | Order state |
| `getPositions()` / `getHoldings()` / `getMargins()` / `getLedger()` | Portfolio state |
| `getGTTs()` | GTT state |
| `forceFillOrder(id, price)` / `forceRejectOrder(id, reason)` / `forceCancelOrder(id)` | Force order state |
| `loadHistoricalReplay(opts)` | Replay history |
| `on(event, cb)` | Subscribe to engine events |
| `getEvents()` / `clearEvents()` | Event recording |
| `snapshot()` / `restore(snapshot)` | Save/restore state |
| `destroy()` | Clean shutdown |

### 11.3 Engine events

```javascript
mockEngine.on("tick", (tick) => console.log("tick", tick.last_price));
mockEngine.on("order_update", (order) => console.log("order", order.status));
mockEngine.on("symbol_added", ({ symbol }) => console.log("added", symbol));
```

---

## 12. Switching Between Live and Paper (Migration)

The whole point: change one environment variable, change nothing else.

```javascript
// strategy.js
const isPaperTesting = process.env.PAPER_TRADING === "true";

const { KiteConnect, KiteTicker } = isPaperTesting
  ? require("kite-paper-node")
  : require("kiteconnect");

// Everything below is identical for live and paper.
const kite = new KiteConnect({ api_key: process.env.KITE_API_KEY });
const ticker = new KiteTicker({
  api_key: process.env.KITE_API_KEY,
  access_token: process.env.KITE_ACCESS_TOKEN,
});

async function run() {
  const profile = await kite.getProfile();
  console.log("Running as", profile.user_id);

  ticker.on("ticks", (ticks) => {
    // ... your strategy logic
  });
  ticker.connect();
  ticker.subscribe([738561]);
}
run();
```

```bash
# Live
PAPER_TRADING=false node strategy.js

# Paper
PAPER_TRADING=true node strategy.js
```

### Migration checklist

- [ ] Install `kite-paper-node` as a devDependency
- [ ] Add the conditional `require` (4 lines)
- [ ] Run your existing test suite — it should pass unchanged
- [ ] Add paper-specific tests using `mockEngine.emitTick()`
- [ ] Add paper mode to CI

---

## 13. Example Strategies

### 13.1 Moving Average Crossover

```javascript
const { MockKiteConnect, MockKiteTicker, mockEngine } = require("kite-paper-node");

mockEngine.configure({
  ticker: { mode: "random-walk", randomWalk: { seedSymbols: ["RELIANCE"] } },
});

const kite = new MockKiteConnect({ api_key: "test" });
const ticker = new MockKiteTicker({ api_key: "test", access_token: "test" });

const prices = [];
const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

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

### 13.2 Limit Order Grid

```javascript
const { MockKiteConnect, mockEngine } = require("kite-paper-node");

mockEngine.configure({
  ticker: { mode: "random-walk", randomWalk: { seedSymbols: ["RELIANCE"] } },
});
const kite = new MockKiteConnect({ api_key: "test" });

// Place a grid of buy limits below the current price.
for (let i = 1; i <= 5; i++) {
  await kite.placeOrder("regular", {
    tradingsymbol: "RELIANCE", exchange: "NSE",
    transaction_type: "BUY", order_type: "LIMIT",
    quantity: 10, price: 2500 - i * 10, product: "MIS",
  });
}

// Drive the price down to fill the grid deterministically.
for (let p = 2500; p >= 2440; p -= 10) {
  mockEngine.emitTick({ instrument_token: 738561, last_price: p });
}

const filled = mockEngine.getOrders({ status: "COMPLETE" });
console.log("Filled orders:", filled.length);
```

### 13.3 SL-M Stop-Loss

```javascript
const { MockKiteConnect, mockEngine } = require("kite-paper-node");

mockEngine.configure({
  ticker: { mode: "random-walk", randomWalk: { seedSymbols: ["RELIANCE"] } },
});
const kite = new MockKiteConnect({ api_key: "test" });

// Buy at market, then protect with an SL-M sell.
await kite.placeOrder("regular", {
  tradingsymbol: "RELIANCE", exchange: "NSE",
  transaction_type: "BUY", order_type: "MARKET",
  quantity: 10, product: "MIS",
});

const { order_id } = await kite.placeOrder("regular", {
  tradingsymbol: "RELIANCE", exchange: "NSE",
  transaction_type: "SELL", order_type: "SL-M",
  quantity: 10, trigger_price: 2400, product: "MIS",
});

// Price drops to the trigger → SL-M fills at market.
mockEngine.emitTick({ instrument_token: 738561, last_price: 2400 });

console.log("SL-M status:", mockEngine.getOrderById(order_id).status); // COMPLETE
```

---

## 14. Troubleshooting & FAQ

### Q: `getQuote` returns "Instrument not found"
The symbol isn't registered. Add it first:

```javascript
mockEngine.addSymbol("TATASTEEL", { basePrice: 155 });
// or pass --seed-symbols=TATASTEEL to the CLI
```

### Q: My order never fills
- Check the order type and price vs. the injected tick.
- For `LIMIT` BUY, the tick `last_price` must be `<=` your limit price.
- For `SL`/`SL-M`, the tick must first cross the `trigger_price`.
- Make sure the symbol is registered and you're emitting ticks for the correct `instrument_token`.

### Q: `express`/`ws` not found
Standalone server mode needs them:

```bash
npm install express ws
```

### Q: `instanceof KiteConnect` returns false
Install `kiteconnect` so the mock classes extend the real ones:

```bash
npm install kiteconnect
```

### Q: How do I make prices reproducible?
```javascript
mockEngine.seedRandom(42);
```
The same seed + same symbol list produces the same price series.

### Q: Can I use this from Python/Go?
Yes — use **Mode B** (standalone server) and talk to it over HTTP/WebSocket.

### Q: Is this safe to expose publicly?
**No.** It has no auth, no encryption, no rate limiting. Bind to `127.0.0.1`
(default) and keep it local.

---

> ⚠️ **WARNING:** `kite-paper-node` is a testing tool. Do NOT expose it to the
> public internet. It is designed for `localhost` development only.
