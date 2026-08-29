# Plan — INDmoney (INDstocks) as a second trading platform

> **Status:** DESIGN — not yet implemented
> **Branch:** `feature/indmoney-integration`
> **Goal:** run the same bot against **either** Zerodha Kite **or** INDmoney
> (INDstocks), switched by one env var, with the same strategy, risk engine,
> ledger, and AI layer. INDstocks API access is **free**; only order execution
> costs (flat ₹10/order).

---

## 0. Scope decisions (confirmed with user)

| # | Decision | Outcome |
|---|----------|---------|
| 1 | Auth | **Manual** access-token paste now; TOTP auto-refresh **deferred** |
| 2 | Asset scope | **Equity only** (NSE/BSE cash). No F&O, no options, no indices |
| 3 | INDmoney role | **Data source for paper trading**, not an order-execution broker yet |
| 4 | API usage | **Real INDstocks GET APIs only** (market data, quotes, history, holdings, positions, funds). **No `POST /order`** |
| 5 | Order execution | **Stubbed + persisted as a DB snapshot** — no real order, but the exact payload the bot *would* have sent is recorded for later audit |

---

## 1. Why this is a clean fit (and what already exists)

The codebase was deliberately built around narrow seams that make a second
broker a *new implementation*, not a rewrite:

| Seam | File | What it abstracts |
|------|------|-------------------|
| `BrokerAccount` | `src/server/BrokerAccount.ts` | Order placement + reconciliation (holdings, positions, cash) |
| `LiveDataProvider` / `HistoricalDataProvider` | `src/server/MarketDataProvider.ts` | Quotes, ticks, historical candles, instrument resolution |
| `LiveTrader` | `src/server/LiveTrader.ts` | The **only** place a real order can fire |
| `Reconciler` | `src/server/Reconciler.ts` | Ledger ⇄ broker drift detection |
| `providers/factory.ts` | `src/server/providers/factory.ts` | Selects the data provider |

**Key finding — a real gap exists today:** `BrokerAccount` is only implemented by
*test stubs* (`MockBrokerAccount` in `test/backtest/*.ts`). There is **no
production `KiteBrokerAccount`** in `src/server/`. `index.ts` wires `LiveTrader`
with `broker = null` and `reconciler = null`, so live order routing is currently
unreachable even for Kite. This plan delivers the INDmoney data stack now, and
leaves real order routing (Kite or INDmoney) behind the existing
`ALLOW_LIVE_ORDERS` gate for a later pass.

---

## 2. INDstocks API surface (the facts that drive the design)

Source: `indstocks-api-docs.md` (full OpenAPI + guides).

### 2.1 Auth

- Raw access token in the `Authorization` header — **no `Bearer` prefix**.
- Token valid **24 hours**; regenerated via dashboard or TOTP (`/generate/token`).
- Base URL: `https://api.indstocks.com`.

### 2.2 Instrument identifiers (the single most important mapping)

INDstocks `security_id` is a **numeric string** (`"2885"`, `"3045"`, `"500112"`).
This maps cleanly onto the bot's existing `instrument_token: number` via
`Number(security_id)`. The segment travels as a **prefix** in scrip codes:

| Context | Format | Example |
|---------|--------|---------|
| REST `scrip-codes` | `SEGMENT_TOKEN` (underscore) | `NSE_3045` |
| WebSocket `instruments` | `SEGMENT:TOKEN` (colon) | `NSE:2885` |
| Order `security_id` | bare token | `2885` |

Segment prefixes: `NSE`, `BSE`, `NFO`, `BFO`, `NIDX`, `BIDX`.

### 2.3 Endpoints the bot needs (GET-only for this pass)

| Capability | INDstocks endpoint | Kite equivalent |
|-----------|--------------------|-----------------|
| Instrument master | `GET /market/instruments?source=equity` → **CSV** | `getInstruments()` → JSON |
| Historical candles | `GET /market/historical/{interval}?scrip-codes=…&start_time=…&end_time=…` | `getHistoricalData()` |
| Full quote | `GET /market/quotes/full?scrip-codes=…` | `getQuote()` |
| LTP | `GET /market/quotes/ltp?scrip-codes=…` | `getLTP()` |
| Holdings | `GET /portfolio/holdings` | `getHoldings()` |
| Positions | `GET /portfolio/positions?segment=equity&product=cnc` | `getPositions()` |
| Funds/cash | `GET /funds` → `detailed_avl_balance.eq_cnc` | `getMargins()` |
| Price feed | `wss://ws-prices.indstocks.com/api/v1/ws/prices` | `KiteTicker` |

> **Deferred (order execution):** `POST /order`, `POST /order/modify`,
> `POST /order/cancel`, `GET /order-book`, `GET /trade-book`, order-update WS.
> These are documented below for completeness but **not implemented** in this pass.

### 2.4 Order payload (INDstocks) — for the snapshot shape only

```json
{
  "txn_type": "BUY",            // BUY | SELL
  "exchange": "NSE",            // NSE | BSE
  "segment": "EQUITY",          // EQUITY | DERIVATIVE
  "product": "CNC",             // CNC | INTRADAY | MARGIN
  "order_type": "LIMIT",        // LIMIT | MARKET (MARKET auto→LIMIT at LTP)
  "validity": "DAY",            // DAY | IOC
  "security_id": "2885",        // bare token
  "qty": 1,
  "algo_id": "99999",           // 99999 (NSE) | 9999999999999999 (BSE)
  "limit_price": 2450.0,        // required for LIMIT
  "is_amo": false,
  "remarks": "momentum-v2/sig-4471"   // ≤100 chars, correlation key
}
```

### 2.5 Historical data constraints (critical for warmup/backtest)

- Max **5 instruments** per request.
- Max range per call: `1day`/`1week`/`1month` → **1 year**; intraday → 7–15 days.
- `start_time`/`end_time` are epoch **milliseconds** (IST); candle `ts` is epoch
  **seconds**.
- Response wraps in `success` (not `status`); `data` is keyed by scrip code.

### 2.6 Pricing

- API access: **free** (no subscription).
- Brokerage: **flat ₹10/order** (vs Kite's ₹20/order cap in the paper cost model).
  Not relevant this pass — no orders are placed.

---

## 3. Design — a broker abstraction with two implementations

### 3.1 The switch

```dotenv
BROKER_PROVIDER=kite        # default — Zerodha Kite
# BROKER_PROVIDER=indmoney  # INDmoney / INDstocks (data-only for now)
```

`providers/factory.ts` grows a `createBrokerStack(config)` returning:

```ts
interface BrokerStack {
  streamer: LiveDataProvider;          // quotes + ticks + history
  account: BrokerAccount | null;       // order placement + reconciliation
}
```

`index.ts` uses this instead of hardcoding `createLiveProvider` + `null` broker.

### 3.2 New files

| File | Responsibility |
|------|----------------|
| `src/server/brokers/IndMoneyStreamer.ts` | `LiveDataProvider` + `HistoricalDataProvider` over INDstocks REST + WS |
| `src/server/brokers/IndMoneyClient.ts` | Thin typed REST/WS client (auth, scrip-code helpers, pagination) |
| `src/server/brokers/IndMoneyBrokerAccount.ts` | `BrokerAccount` — read side real, `placeOrder` stubbed |
| `src/server/brokers/indmoneyTypes.ts` | INDstocks response/request types + enums |
| `src/server/brokers/indmoneyMapping.ts` | Pure mapping fns (product, order type, status, segment, scrip-code) |

> `KiteBrokerAccount.ts` (real Kite order routing) is **deferred** — the whole
> project stays paper-first, and INDmoney order execution is stubbed.

### 3.3 Type changes (minimal, backward-compatible)

- `Instrument` gains an optional `security_id?: string` (round-trips the
  INDstocks string token; `instrument_token` stays `number`).
- `BrokerAccount.placeOrder` already returns `Promise<string>` (broker order id)
  — no change needed. The stub returns a synthetic id (e.g. `STUB-<ts>`).
- `BrokerHolding` already has `symbol`, `exchange`, `quantity`, `averagePrice`,
  `lastPrice` — INDstocks holdings/positions map onto it directly.

### 3.4 Mapping tables (pure functions, unit-tested)

**Product** (bot `MIS`/`CNC` → broker):

| Bot | Kite | INDstocks |
|-----|------|-----------|
| `CNC` | `CNC` | `CNC` |
| `MIS` | `MIS` | `INTRADAY` |

**Order type** (bot `MARKET`/`LIMIT` → broker):

| Bot | Kite | INDstocks |
|-----|------|-----------|
| `MARKET` | `MARKET` | `MARKET` (auto→LIMIT at LTP) |
| `LIMIT` | `LIMIT` | `LIMIT` |

**Segment** (bot `NSE`/`BSE` → broker):

| Bot | Kite | INDstocks |
|-----|------|-----------|
| `NSE` | `NSE` | `NSE` |
| `BSE` | `BSE` | `BSE` |

**Correlation key**: bot's `intent` (≤20 chars today) → INDstocks `remarks`
(≤100 chars). Kite uses `tag` (≤20 chars). Use a shared `intent` string; the
INDstocks adapter truncates to 100, Kite to 20.

---

## 4. Order-execution stub + DB snapshot (the core of this pass)

### 4.1 What happens on a buy/sell decision

1. The strategy/agent produces a `TradeRequest` (symbol, side, qty, price, intent).
2. `RiskEngine` approves it; `OrderGuard` claims idempotency.
3. `PaperTrader` writes the **paper fill** to `trades`/`orders` (unchanged — this
   is the bot's system of record).
4. `LiveTrader.forwardToBroker()` builds the **broker payload** and, instead of
   sending it, **persists a snapshot** to a new table.

### 4.2 New migration `V017__broker_order_snapshots.sql`

```sql
CREATE TABLE IF NOT EXISTS broker_order_snapshots (
    snapshot_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    broker        TEXT    NOT NULL,          -- 'kite' | 'indmoney'
    trade_id      TEXT,                      -- back-link to the paper fill
    symbol        TEXT    NOT NULL,
    exchange      TEXT    NOT NULL,
    side          TEXT    NOT NULL,          -- BUY | SELL
    quantity      INTEGER NOT NULL,
    product       TEXT,
    order_type    TEXT,
    price         REAL,
    intent        TEXT,
    payload_json  TEXT    NOT NULL,          -- the exact broker order JSON
    status        TEXT    NOT NULL DEFAULT 'STUBBED',  -- STUBBED | SENT | FAILED
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_broker_snapshots_symbol ON broker_order_snapshots(symbol);
CREATE INDEX IF NOT EXISTS idx_broker_snapshots_created ON broker_order_snapshots(created_at);
```

### 4.3 `Ledger.recordBrokerOrderSnapshot(...)`

A single method that inserts a row. Fields mirror the table above.

### 4.4 `LiveTrader.forwardToBroker()` change

- **PAPER mode** (`ALLOW_LIVE_ORDERS=false`): unchanged — no payload, no snapshot.
- **SHADOW mode** (`ALLOW_LIVE_ORDERS=true` + `LIVE_SHADOW_MODE=true`): build the
  payload, **persist the snapshot** (`status='STUBBED'`), and log — do **not** send.
- **LIVE mode** (future): build the payload, persist (`status='SENT'`), and call
  the broker.

### 4.5 `IndMoneyBrokerAccount.placeOrder()` — stubbed

- Does **not** call `POST /order`.
- Returns a synthetic id (e.g. `STUB-<epoch-ms>`).
- The snapshot is what gets persisted (via `LiveTrader`), so the audit trail is
  complete without any network order call.

### 4.6 Audit query (the payoff)

```sql
SELECT created_at, symbol, side, quantity, price, intent, payload_json
FROM broker_order_snapshots
ORDER BY created_at;
```

This answers: *"on day X, the bot wanted to BUY 10 INFY @ ₹1,850 with intent
`REBALANCE_BUY` — here is the exact order it would have sent."*

---

## 5. Implementation phases

### Phase A — INDstocks typed client + mapping (no behaviour change)

1. `indmoneyTypes.ts`: enums + response interfaces (profile, funds, quotes,
   historical, holdings, positions).
2. `indmoneyMapping.ts`: pure fns for product/order-type/segment/status/scrip-code.
3. `IndMoneyClient.ts`: `fetch`-based REST with `Authorization` header, timeout,
   error normalization (`status`/`success`/`error_type` shapes), and helpers:
   - `scripCode(exchange, token)` → `NSE_3045`
   - `wsInstrument(exchange, token)` → `NSE:2885`
   - `paginateHistorical(...)` → walks back in max-range windows, batches 5.
4. Unit tests for mapping + scrip-code + pagination (no network).

### Phase B — `IndMoneyStreamer` (data provider)

1. Implement `HistoricalDataProvider` + `LiveDataProvider`.
2. `loadInstruments`: fetch CSV (`source=equity`), parse 16 columns, build the
   `Instrument` map (`instrument_token = Number(SECURITY_ID)`, `security_id` set).
3. `getHistoricalData`: map interval (`5minute`→`5minute`, `day`→`1day`, …),
   page by max range, batch 5, stitch candles, convert `ts` (s) → `Date`.
4. `getQuote`/`findInstrument`/`getInstrument`: use scrip-code + full-quote endpoint.
5. `startTicker`: open `wss://ws-prices…`, send `subscribe` (mode `ltp`/`quote`),
   map incoming ticks to the bot's `Tick` shape; reconnect on close.
6. `stopTicker`: close the socket.

### Phase C — `IndMoneyBrokerAccount` (read + stubbed order)

1. `getBrokerHoldings()` → `GET /portfolio/holdings` → `BrokerHolding[]`.
2. `getBrokerPositions()` → `GET /portfolio/positions?segment=equity&product=cnc`
   (and `intraday`) → `BrokerHolding[]` (net qty).
3. `getAvailableCash()` → `GET /funds` → `detailed_avl_balance.eq_cnc`.
4. `placeOrder()` → **stubbed** (returns synthetic id; no network call).

### Phase D — snapshot persistence

1. Migration `V017__broker_order_snapshots.sql`.
2. `Ledger.recordBrokerOrderSnapshot(...)`.
3. `LiveTrader.forwardToBroker()` persists the snapshot in SHADOW mode.

### Phase E — factory + config + wiring

1. `AppConfig`: add `broker` block (`provider`, `indmoney` sub-block with
   `accessToken`, `baseUrl`, `wsPricesUrl`, `algoIdNse`, `algoIdBse`, `timeoutMs`).
2. `providers/factory.ts`: `createBrokerStack(config)` selecting Kite vs INDmoney.
3. `index.ts`: instantiate `account` + `reconciler` from the stack (no longer
   hardcoded `null`), pass to `LiveTrader`.
4. `.env.example` + `docs/CONFIGURATION.md`: document `BROKER_PROVIDER` and the
   `INDMONEY_*` keys.

### Phase F — validation

1. `tsc --noEmit` clean (root).
2. Unit tests: mapping, scrip-code, pagination, CSV parser, status mapping,
   snapshot persistence.
3. A mock INDstocks server (in-process) or recorded-fixture test so
   `IndMoneyStreamer` + `IndMoneyBrokerAccount` can be exercised without a live token.
4. A shadow-mode smoke run: momentum strategy end-to-end against the INDmoney
   stack (no real orders), verifying snapshots land in `broker_order_snapshots`.

---

## 6. Config surface (new)

| Variable | Purpose | Default |
|----------|---------|---------|
| `BROKER_PROVIDER` | `kite` or `indmoney` | `kite` |
| `INDMONEY_ACCESS_TOKEN` | INDstocks access token (24h) | — |
| `INDMONEY_BASE_URL` | INDstocks REST base | `https://api.indstocks.com` |
| `INDMONEY_WS_PRICES_URL` | Price feed WS | `wss://ws-prices.indstocks.com/api/v1/ws/prices` |
| `INDMONEY_ALGO_ID_NSE` | `algo_id` for NSE orders (snapshot only) | `99999` |
| `INDMONEY_ALGO_ID_BSE` | `algo_id` for BSE orders (snapshot only) | `9999999999999999` |
| `INDMONEY_TIMEOUT_MS` | Per-request timeout | `15000` |

---

## 7. Risks & gotchas (must be handled explicitly)

1. **Token expiry (24h).** INDstocks tokens die daily. The bot must surface a
   clear "token expired" health state (not silently degrade). TOTP auto-refresh
   is a *later* enhancement.
2. **`segment` casing is context-dependent** (uppercase for orders, lowercase for
   positions, `INDEX`/`EQUITY` for option chain). Centralize in `indmoneyMapping.ts`.
3. **`MARKET` orders are auto-converted to `LIMIT` at LTP.** Not relevant this
   pass (no orders), but document for the future order-execution pass.
4. **Historical pagination** (5 instruments, max range per interval) is easy to
   get wrong — the INDstocks streamer must batch + page internally so callers are
   unchanged.
5. **CSV instrument master** (not JSON) — parse positionally for `source=index`
   (3 cols) vs `equity`/`fno` (16 cols).
6. **`instrument_token` is numeric** — `Number(security_id)` works for NSE/BSE
   equity, but index/F&O tokens may not be numeric. Equity-only scope keeps this
   safe; reject non-numeric tokens with a clear log.
7. **`remarks` is not an idempotency key.** The bot's `OrderGuard` already
   provides idempotency at the ledger layer — don't rely on `remarks` for that.
8. **No `Bearer` prefix** on the `Authorization` header — a common integration bug.
9. **Snapshot ≠ paper fill.** The paper ledger (`trades`/`orders`) remains the
   system of record for P&L; `broker_order_snapshots` is a *separate* audit trail
   of the broker payload. Do not conflate the two.

---

## 8. Definition of done

- `BROKER_PROVIDER=indmoney` boots the bot, loads instruments, warms up
  indicators, streams ticks, and paper-trades using **real INDstocks data** —
  all without touching Kite.
- Every buy/sell decision is captured as a `broker_order_snapshots` row with the
  full payload + intent + symbol + side + qty + price + timestamp.
- **No real order is ever sent** (order execution stubbed; `POST /order`
  unimplemented).
- `BROKER_PROVIDER=kite` still works (unchanged paper path).
- `tsc --noEmit` clean; new unit suites pass; a shadow-mode smoke run completes.
- `docs/CONFIGURATION.md` + `.env.example` document the new keys.
