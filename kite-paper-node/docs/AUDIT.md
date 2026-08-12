# Deep Audit — kite-paper-node vs. real Zerodha Kite API

> **Methodology:** This audit compares the implemented mock against the actual
> installed `kiteconnect@5.3.0` package — its TypeScript type definitions
> (`types/connect.d.ts`, `types/ticker.d.ts`) and the compiled ticker source
> (`dist/lib/ticker.js`, including the real `parseBinary` binary protocol
> parser). Every finding is backed by a concrete comparison to the real
> library, not assumption.

---

## Fix Status (all Critical, Major, and Moderate gaps implemented)

| ID | Gap | Status | Notes |
|----|-----|--------|-------|
| C1 | `getPositions()` shape | ✅ Fixed | Returns `{ net, day }` |
| C2 | `getHistoricalData()` shape | ✅ Fixed | Returns `HistoricalData[]` objects |
| C3 | `getQuote()` fields/depth | ✅ Fixed | Real field names, `{buy,sell}` depth |
| C4 | Binary protocol | ✅ Fixed | BE, uint32×100, sizes 8/44/184, framing; validated vs real `parseBinary` |
| C5 | Position fields | ✅ Fixed | British spellings + buy/sell legs |
| C6 | `getOrderHistory()` | ✅ Fixed | Returns `Order[]` |
| C7 | `order_update` postback | ✅ Fixed | Emitted on fills (bus → ticker + WS text frames) |
| M1 | `generateSession` + session hooks | ✅ Fixed | `(token, secret)` → `SessionData`; renew/invalidate/setSessionExpiryHook |
| M2 | Constructor `access_token`/`root` | ✅ Fixed | Accepted |
| M3 | `string \| string[]` inputs | ✅ Fixed | Quote/LTP/OHLC |
| M4 | Varieties `bo`/`co`/`auction` | 🟡 Partial | Accepted/validated; AMO & iceberg not behaviorally differentiated |
| M5 | Missing methods | ✅ Fixed | convertPosition, exitOrder, getTrades, orderMargins, orderBasketMargins, getvirtualContractNote, getLoginURL, getTriggerRange, validatePostback, MF SIP family |
| M6 | `getMargins()` shape | ✅ Fixed | `{equity?, commodity?}` + full `UserMargin` |
| M7 | Order/Trade timestamps + fields | ✅ Fixed | `Date` timestamps, `meta`/`tags`/`exchange_update_timestamp`, Trade fields |
| M8 | GTT status + `modifyGTT` | ✅ Fixed | Lowercase statuses; modify implemented |
| M9 | Instrument master string types | ✅ Fixed | `last_price`/`strike`/`tick_size`/`lot_size` as strings |
| R1 | Partial fills | ✅ Fixed | Configurable (`partialFills: true`) |
| R2 | Margin model | 🟡 Partial | Configurable rate; not instrument-aware SPAN |
| R3 | IOC validity | ✅ Fixed | Unfilled IOC cancelled after first tick |
| R4 | MARKET fill price | ✅ Fixed | Falls back to `last_price` when bid/ask absent |
| R5 | Market-hours gating | 🟡 Partial | `isMarketOpen()` helper; not enforced on placement by default |
| R6 | Tick `tradable` + depth | ✅ Fixed | `tradable` flag, `{buy,sell}` depth |
| R7 | Debug endpoints + logging | ✅ Fixed | `/__debug/*` (behind `ENABLE_DEBUG=true`), structured logger |

> 🟡 Partial items (M4 AMO/iceberg behavior, R2 instrument-aware margin, R5
> enforcement) are accepted-but-not-fully-differentiated. They do not break
> drop-in compatibility but are noted as future realism work.

---

## Original Findings (for reference)

### 🔴 CRITICAL — breaks drop-in compatibility

**C1. `getPositions()` returns the wrong shape.** Real returns
`{ net: Position[]; day: Position[] }` (`connect.d.ts` L1744). Mock returned a
flat array. **Fixed** — now returns `{ net, day }`.

**C2. `getHistoricalData()` returns the wrong shape.** Real SDK returns
`HistoricalData[]` objects `{date, open, high, low, close, volume, oi?}`
(L1554-1592). Mock returned `{ candles: [[...]] }`. **Fixed** — now returns
`HistoricalData[]`.

**C3. `getQuote()` field names and depth structure differ.** Real uses
`buy_quantity`/`sell_quantity`, `net_change`, `last_quantity`,
`lower_circuit_limit`, `upper_circuit_limit`, `oi_day_high`/`oi_day_low`, and
`depth: { buy, sell }` (L1806-1925). **Fixed** — all renamed and depth
restructured.

**C4. WebSocket binary protocol incompatible with real `KiteTicker`.**
Real protocol (from `parseBinary` L548-664, `splitPackets` L670-679):
- **Big-endian** (`buf2long` L686-692); mock used little-endian.
- Prices as **uint32 = price × 100** (divisor 100 equities, 10000000 NseCD, 10000 BseCD); mock used float32.
- **LTP = 8 bytes**; mock had 44. **Full = 184 bytes**; mock had 492.
- Depth: **10 levels × 12 bytes** (`[qty:4][price×div:4][orders:2][pad:2]`, first 5 buy, next 5 sell).
- **Message framing**: `[num-packets:2 BE]` then per packet `[size:2 BE][packet]`.
**Fixed** — rewritten to match exactly, validated by a test that round-trips a
frame through the real `KiteTicker.parseBinary`.

**C5. Position field names wrong + ~20 fields missing.** Real `Position` uses
British `unrealised`/`realised` and includes `close_price`, `pnl`, `m2m`,
`buy_*`, `day_buy_*`, `sell_*`, `day_sell_*`, `multiplier` (L869-986).
**Fixed** — full shape implemented.

**C6. `getOrderHistory()` returns a single order, not a history array.** Real:
`Promise<Order[]>` (L1726). **Fixed** — returns `Order[]`.

**C7. `order_update` postback never emitted.** Real ticker fires `order_update`
from text messages `{type:'order', data}` (`ticker.js` L538-540). **Fixed** —
matching engine emits `order_update` on the bus; `MockKiteTicker` and the WS
server forward it.

### 🟡 MAJOR — partial incompatibility

- **M1.** `generateSession(request_token, api_secret) → SessionData`; session hooks. **Fixed**.
- **M2.** Constructor `access_token`/`root`. **Fixed**.
- **M3.** `getQuote/getLTP/getOHLC` accept `string | string[]`. **Fixed**.
- **M4.** Varieties `bo`, `co`, `auction`. **Fixed** (accepted; AMO/iceberg not behaviorally differentiated).
- **M5.** Missing methods (`convertPosition`, `exitOrder`, `getTrades`, `orderMargins`, `orderBasketMargins`, `getvirtualContractNote`, `getLoginURL`, `getTriggerRange`, `validatePostback`, MF SIP family). **Fixed**.
- **M6.** `getMargins` → `{equity?, commodity?}` with full `UserMargin`. **Fixed**.
- **M7.** Order/Trade timestamps → `Date`; `meta`/`tags`/`exchange_update_timestamp`; Trade fields. **Fixed**.
- **M8.** GTT status lowercase; `modifyGTT`. **Fixed**.
- **M9.** Instrument master string types. **Fixed**.

### 🟠 MODERATE — realism gaps

- **R1.** No partial fills. **Fixed** (configurable).
- **R2.** Flat 20% margin, not SPAN. **Partial** (configurable rate).
- **R3.** IOC validity not enforced. **Fixed**.
- **R4.** MARKET fill at `last_price` when bid/ask absent. **Fixed** (fallback).
- **R5.** No market-hours gating. **Partial** (`isMarketOpen()` helper).
- **R6.** Tick missing `tradable`; flat depth. **Fixed**.
- **R7.** Debug endpoints + logging. **Fixed**.

---

## Validation

- **30 tests pass** (6 suites), including:
  - C4: binary frame round-trip through the **real** `KiteTicker.parseBinary`.
  - C1/C2/C3/C5/C6/C7, M1, R1, R3 fidelity assertions.
- Typecheck clean, build clean.
- Standalone server verified end-to-end (positions `{net,day}`, historical
  `HistoricalData[]`, quote real fields, trades `average_price`).

## Remaining realism work (non-blocking)

- AMO/iceberg behavioral differentiation (M4).
- Instrument-aware SPAN margin (R2).
- Enforce market-hours gating on order placement (R5).
- Partial-fill tranche modeling closer to real exchange behavior (R1).
