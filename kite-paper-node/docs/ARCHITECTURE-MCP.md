# kite-paper-node — MCP Layer Architecture

> **Status:** Pre-Implementation Design | **Version:** 1.0.0-draft
> **Reference:** `kite-mcp-server` (Zerodha's official Go MCP server) — a
> Model Context Protocol server that exposes Kite Connect as tools for AI
> agents.
> **Goal:** Reuse kite-paper-node's existing **JIT mock data generation** to
> expose the **exact same MCP tool surface** as the real Kite MCP server, so an
> AI agent can be pointed at the mock (local / no broker) or at real Kite
> (hosted) with **no change to how the agent calls tools**.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [How the Real Kite MCP Works (Reference)](#2-how-the-real-kite-mcp-works-reference)
3. [Design Principles](#3-design-principles)
4. [Tool Parity Matrix](#4-tool-parity-matrix)
5. [High-Level Architecture](#5-high-level-architecture)
6. [MCP Server & Transports](#6-mcp-server--transports)
7. [Tool Implementation Pattern](#7-tool-implementation-pattern)
8. [Tool Specifications (Per-Tool)](#8-tool-specifications-per-tool)
9. [Session & Authentication (Mock)](#9-session--authentication-mock)
10. [Pagination](#10-pagination)
11. [Error Handling](#11-error-handling)
12. [Determinism & Testing](#12-determinism--testing)
13. [Packaging & Deployment](#13-packaging--deployment)
14. [Compatibility & Risks](#14-compatibility--risks)
15. [Decision Log](#15-decision-log)

---

## 1. Executive Summary

**What we build:** a new optional runtime mode for `kite-paper-node` that speaks
the **Model Context Protocol (MCP)** and exposes the **same 22 tools** that
Zerodha's `kite-mcp-server` exposes. Instead of calling real Kite REST APIs,
every tool is backed by kite-paper-node's existing **in-memory mock engine and
JIT data generator** (Random Walk Generator, order engine, matching engine,
ledger, positions, holdings, GTT, quotes, historical data).

**Why:** an AI trading agent that already knows how to call Kite MCP tools
(`get_quotes`, `place_order`, `get_positions`, …) can be switched to the mock
by changing the MCP endpoint/transport — no agent-side tool changes. This gives
safe, deterministic, broker-free development/testing for agentic trading
strategies, identical in shape to live.

**Key reuse:** the mock already implements every backing capability. The MCP
layer is a **thin adapter**: MCP tool → mock service → JSON text result.

---

## 2. How the Real Kite MCP Works (Reference)

`kite-mcp-server` is a **Go** server built on `mark3labs/mcp-go`. Its structure:

### 2.1 Tool → Kite API mapping

Every MCP tool wraps **exactly one** Kite Connect client method:

```
MCP Tool  ──Handler──▶  session.Kite.Client.<Method>(...)  ──▶  Kite REST API
```

| MCP tool | Kite client method |
|----------|--------------------|
| `login` | OAuth authorize flow (session) |
| `get_profile` | `GetUserProfile()` |
| `get_margins` | `GetMargins(segment)` |
| `get_holdings` | `GetHoldings()` |
| `get_positions` | `GetPositions()` |
| `get_trades` | `GetTrades()` |
| `get_orders` | `GetOrders()` |
| `get_order_history` | `GetOrderHistory(orderID)` |
| `get_order_trades` | `GetOrderTrades(orderID)` |
| `get_gtts` | `GetGTTs()` |
| `get_mf_holdings` | `GetMFHoldings()` |
| `get_quotes` | `GetQuote(instruments...)` |
| `search_instruments` | instruments manager `Filter()` |
| `get_historical_data` | `GetHistoricalData(token, interval, from, to, continuous, oi)` |
| `get_ltp` | `GetLTP(instruments...)` |
| `get_ohlc` | `GetOHLC(instruments...)` |
| `place_order` | `PlaceOrder(variety, params)` |
| `modify_order` | `ModifyOrder(variety, orderID, params)` |
| `cancel_order` | `CancelOrder(variety, orderID)` |
| `place_gtt_order` | `PlaceGTT(params)` |
| `modify_gtt_order` | `ModifyGTT(triggerID, params)` |
| `delete_gtt_order` | `DeleteGTT(triggerID)` |

### 2.2 Tool definition (mark3labs/mcp-go)

Each tool is declared with `mcp.NewTool(name, WithDescription(...), With*Params(...))`
and a `Handler` that:

1. validates required args (`ValidateRequired`, `SafeAssert*`),
2. wraps the call in `WithSession` (per-MCP-session Kite session),
3. calls the Kite client method,
4. returns `handler.MarshalResponse(data)` → JSON string inside an MCP
   `CallToolResult` text content.

### 2.3 Server & registration

- `mcp.go` → `GetAllTools()` returns the 22 tools; `RegisterTools()` registers
  them on a `server.MCPServer` (with optional exclusion list).
- Transports: **stdio**, **HTTP** (`/mcp`), **SSE** (`/sse`), and hybrid.
- Common helpers: `ValidateRequired`, `SafeAssertString/Int/Float64/Bool/StringArray`,
  `MarshalResponse`, `WithSession`, and pagination
  (`ParsePaginationParams`, `ApplyPagination`, `CreatePaginatedResponse`).

### 2.4 Session model

Per-MCP-session **Kite session**: `login` generates an authorize URL; the user
authorizes; the server exchanges for an `access_token`; subsequent tools run
under that session. `WithSession` enforces this (returns "Please log in first"
if no session).

---

## 3. Design Principles

1. **Tool parity over everything.** Same 22 tool names, same descriptions, same
   parameter schemas, same response shapes as Kite MCP. An agent written for
   live Kite MCP works against the mock with zero changes.
2. **Zero new data logic.** The MCP layer only *routes* — all data comes from
   the existing mock engine (`MockEngine`). No second implementation of quotes,
   orders, or candles.
3. **JIT everywhere.** Quotes, candles, and search all generate on-demand from
   the Random Walk Generator pool, exactly like the REST mode.
4. **Reuse the mock's real-API response shapes.** The mock's services already
   return `kiteconnect`-faithful objects (verified field-for-field). MCP tools
   marshal those same objects to JSON — so the MCP JSON matches what the real
   Kite MCP would return.
5. **Deterministic & local by default.** No broker, no network, seeded PRNG.
6. **Optional, additive.** MCP is a new mode; it does not disturb the existing
   SDK-mock or REST server modes.

---

## 4. Tool Parity Matrix

Maps every Kite MCP tool to the **mock backend** that already produces the JIT
data. Response objects are the same ones the REST/sdk modes already return.

| # | MCP tool | Mock backend | JIT data source |
|---|----------|--------------|-----------------|
| 1 | `login` | mock auth/session | static mock credentials |
| 2 | `get_profile` | `MockEngine.userService.getProfile()` | static mock profile |
| 3 | `get_margins` | `MarginService.getMargins()` | ledger-derived |
| 4 | `get_holdings` | `HoldingService.getHoldings()` | holdings store |
| 5 | `get_positions` | `PositionService.getPositions()` | positions store |
| 6 | `get_trades` | `MockEngine.getTrades()` | ledger trades |
| 7 | `get_orders` | `OrderService.getOrders()` | orders store |
| 8 | `get_order_history` | `OrderService.getOrderHistory(orderId)` | orders store |
| 9 | `get_order_trades` | `OrderService.getOrderTrades(orderId)` | ledger trades |
| 10 | `get_gtts` | `GTTService.getGTTs()` | GTT store |
| 11 | `get_mf_holdings` | stub (`[]`) | — |
| 12 | `get_quotes` | `QuoteService.getQuote(ids)` | generator pool (JIT) |
| 13 | `search_instruments` | `GeneratorPool.getInstruments()` + filter | instrument master |
| 14 | `get_historical_data` | `HistoricalService.getHistoricalData(...)` | tick buffer / synthetic (JIT) |
| 15 | `get_ltp` | `QuoteService.getLTP(ids)` | generator pool (JIT) |
| 16 | `get_ohlc` | `QuoteService.getOHLC(ids)` | generator pool (JIT) |
| 17 | `place_order` | `OrderService.placeOrder(variety, params)` | order engine |
| 18 | `modify_order` | `OrderService.modifyOrder(...)` | order engine |
| 19 | `cancel_order` | `OrderService.cancelOrder(...)` | order engine |
| 20 | `place_gtt_order` | `GTTService.createTrigger(params)` | GTT engine |
| 21 | `modify_gtt_order` | `GTTService.modifyTrigger(id, params)` | GTT engine |
| 22 | `delete_gtt_order` | `GTTService.deleteGTT(id)` | GTT engine |

> **Parity guarantee:** the JSON produced by `MarshalResponse` for each tool
> equals the JSON the real Kite MCP produces for the same tool — because the
> mock's backing services already return kiteconnect-faithful shapes.

---

## 5. High-Level Architecture

```
                     ┌──────────────────────────────────────────────┐
                     │            AI Agent (MCP client)             │
                     │      (Claude / Zed / any MCP client)         │
                     └───────────────┬──────────────────────────────┘
                                     │  MCP protocol
                                     │  tools/list, tools/call
                                     ▼
              ┌──────────────────────────────────────────────┐
              │            kite-paper-node MCP               │
              │                                              │
              │   ┌──────────────────────────────────────┐   │
              │   │        MCP Adapter (thin)            │   │
              │   │  ToolRegistry (22 tools)             │   │
              │   │  per-tool Handler ──► MockEngine     │   │
              │   │  params/result marshalling           │   │
              │   │  pagination, errors, metrics         │   │
              │   └───────────────┬──────────────────────┘   │
              │                   │ calls (reuse)             │
              │   ┌───────────────▼──────────────────────┐   │
              │   │        MockEngine (existing)         │   │
              │   │  GeneratorPool · OrderEngine ·       │   │
              │   │  MatchingEngine · Ledger · Positions  │  │
              │   │  Holdings · Margins · GTT · Quotes    │  │
              │   │  HistoricalService · InstrumentMaster │  │
              │   └──────────────────────────────────────┘   │
              │                                              │
              │  Transports: stdio │ HTTP /mcp │ SSE /sse    │
              └──────────────────────────────────────────────┘
```

**Reuse boundary:** the entire bottom box (`MockEngine` + services) is
**untouched** and shared with the existing SDK-mock and REST modes. The MCP
layer is purely a new top box.

---

## 6. MCP Server & Transports

### 6.1 SDK choice

Implement in **Node.js / TypeScript** using the official
**`@modelcontextprotocol/sdk`** (the TS reference SDK), matching the mock's
language so it reuses the engine in-process with zero network.

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
```

### 6.2 Transports (mirroring Kite MCP's modes)

| Mode | Transport | Use case |
|------|-----------|----------|
| **stdio** | `StdioServerTransport` | Local agent subprocess (Claude Desktop, Zed) |
| **HTTP** | `StreamableHTTPServerTransport` at `/mcp` | Remote / hosted clients |
| **SSE** | SSE transport at `/sse` | Legacy streaming clients |
| **hybrid** | both HTTP + SSE on one port | Production parity |

> The mock starts whichever transport is configured. It can run the MCP server
> **alone** or **alongside** the existing REST/WS server.

### 6.3 Registration

```typescript
const server = new McpServer({ name: "kite-paper-node", version: "1.0.0" });
registerTools(server, engine);   // adds all 22 tools
await server.connect(transport);
```

`registerTools` iterates a tool table (name, description, zod schema, handler)
and registers each. An `excludedTools` filter (comma-separated) mirrors Kite
MCP's exclusion feature.

---

## 7. Tool Implementation Pattern

Every tool follows one shape (mirroring Kite MCP's `Handler`):

```typescript
server.registerTool(
  "get_quotes",
  { description: "...", inputSchema: { type: "object", properties: { instruments: { type: "array", items: { type: "string" } } }, required: ["instruments"] } },
  async ({ instruments }) => {
    // 1. validate required args
    // 2. call mock backend (no session gate in mock, or a mock session gate)
    const data = engine.quoteService.getQuote(instruments);
    // 3. marshal to JSON text
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
);
```

**Shared helpers (mirroring Kite MCP's `common.go`):**

| Mock helper | Mirrors | Purpose |
|-------------|---------|---------|
| `validateRequired(args, ...names)` | `ValidateRequired` | reject missing required params |
| `safeAssertString/Int/Boolean/Array` | `SafeAssert*` | type-safe param extraction |
| `marshalResult(data)` | `MarshalResponse` | JSON-stringify into MCP text content |
| `paginate(list, from, limit)` | `ApplyPagination` / `CreatePaginatedResponse` | pagination for list tools |
| `withMockSession(fn)` | `WithSession` | mock session gate (login) |
| `trackToolCall/Error` | metrics | optional call/error counters |

---

## 8. Tool Specifications (Per-Tool)

> Response JSON equals the real Kite MCP output because the backing services
> already return kiteconnect-faithful shapes (see `docs/AUDIT.md`).

### 8.1 `login`
- **Params:** none.
- **Backend:** mock auth. Returns a fake "login" message + a mock authorize URL.
- **Response:** `{ text: "Already logged in as Paper Trader" }` (mock always
  authorized; no real OAuth).

### 8.2 `get_profile`
- **Params:** none.
- **Backend:** `userService.getProfile()`.
- **Response:** mock profile (kiteconnect `getProfile` shape).

### 8.3 `get_margins`
- **Params:** optional `segment` (`equity`/`commodity`).
- **Backend:** `marginService.getMargins()` / `getMarginsForSegment(segment)`.
- **Response:** `{ equity?: UserMargin, commodity?: UserMargin }`.

### 8.4 `get_holdings`
- **Params:** `from`, `limit` (pagination).
- **Backend:** `holdingService.getHoldings()`.
- **Response:** array of `PortfolioHolding`; paginated when `limit` set.

### 8.5 `get_positions`
- **Params:** `from`, `limit`.
- **Backend:** `positionService.getPositions()`.
- **Response:** `{ net: Position[], day: Position[] }`; paginated.

### 8.6 `get_trades`
- **Params:** `from`, `limit`.
- **Backend:** `engine.getTrades()`.
- **Response:** array of `Trade`; paginated.

### 8.7 `get_orders`
- **Params:** `from`, `limit`.
- **Backend:** `orderService.getOrders()`.
- **Response:** array of `Order`; paginated.

### 8.8 `get_order_history`
- **Params:** `order_id` (required).
- **Backend:** `orderService.getOrderHistory(order_id)`.
- **Response:** array of `Order` (history).

### 8.9 `get_order_trades`
- **Params:** `order_id` (required).
- **Backend:** `orderService.getOrderTrades(order_id)`.
- **Response:** array of `Trade`.

### 8.10 `get_gtts`
- **Params:** `from`, `limit`.
- **Backend:** `gttService.getGTTs()`.
- **Response:** array of `Trigger`; paginated.

### 8.11 `get_mf_holdings`
- **Params:** none.
- **Backend:** stub → `[]` (mutual funds not mocked).
- **Response:** `[]`.

### 8.12 `get_quotes`
- **Params:** `instruments` (required, array of `exchange:tradingsymbol`).
- **Backend:** `quoteService.getQuote(instruments)`.
- **Response:** `Record<id, Quote>` with real `getQuote` shape (net_change,
  `depth{buy,sell}`, circuit limits, etc.).

### 8.13 `search_instruments`
- **Params:** `query` (required), `filter_on` (`id|name|isin|tradingsymbol|underlying`),
  `from`, `limit`.
- **Backend:** filter `pool.getInstruments()` by field (case-insensitive
  substring), with optional underlying/option lookup.
- **Response:** filtered `Instrument[]`; paginated when `limit` set.

### 8.14 `get_historical_data`
- **Params:** `instrument_token` (required), `from_date`, `to_date` (required,
  `YYYY-MM-DD HH:MM:SS`), `interval` (required, enum), `continuous` (bool),
  `oi` (bool).
- **Backend:** `historicalService.getHistoricalData(token, interval, from, to)`
  (tick buffer / synthetic JIT).
- **Response:** array of `HistoricalData` objects.

### 8.15 `get_ltp`
- **Params:** `instruments` (required array).
- **Backend:** `quoteService.getLTP(instruments)`.
- **Response:** `Record<id, { instrument_token, last_price }>`.

### 8.16 `get_ohlc`
- **Params:** `instruments` (required array).
- **Backend:** `quoteService.getOHLC(instruments)`.
- **Response:** `Record<id, { instrument_token, last_price, ohlc }>`.

### 8.17 `place_order`
- **Params:** `variety` (enum, default `regular`), `exchange` (enum), `tradingsymbol`
  (required), `transaction_type` (enum), `quantity` (number), `product` (enum),
  `order_type` (enum), `price` (number), `validity` (enum), `validity_ttl`,
  `disclosed_quantity`, `trigger_price`, `iceberg_legs`, `iceberg_quantity`, `tag`.
- **Backend:** `orderService.placeOrder(variety, params)`.
- **Response:** `{ order_id }`.

### 8.18 `modify_order`
- **Params:** `variety`, `order_id` (required), `quantity`, `price`, `order_type`,
  `validity`, `disclosed_quantity`, `trigger_price`.
- **Backend:** `orderService.modifyOrder(variety, order_id, params)`.
- **Response:** `{ order_id }`.

### 8.19 `cancel_order`
- **Params:** `variety`, `order_id` (required).
- **Backend:** `orderService.cancelOrder(variety, order_id)`.
- **Response:** `{ order_id }`.

### 8.20 `place_gtt_order`
- **Params:** `instrument_token`, `exchange`, `tradingsymbol`, `trigger_values`,
  `orders` (array).
- **Backend:** `gttService.createTrigger(params)`.
- **Response:** `{ trigger_id }`.

### 8.21 `modify_gtt_order`
- **Params:** `trigger_id` (required), mutable fields.
- **Backend:** `gttService.modifyTrigger(trigger_id, params)`.
- **Response:** `{ trigger_id }`.

### 8.22 `delete_gtt_order`
- **Params:** `trigger_id` (required).
- **Backend:** `gttService.deleteGTT(trigger_id)`.
- **Response:** `{ trigger_id }`.

---

## 9. Session & Authentication (Mock)

Mirrors Kite MCP's session model but with **no real OAuth**:

- Each MCP client session maps to a mock session backed by the shared
  `MockEngine` (via `getDefaultEngine()`).
- `login` always succeeds (returns "Already logged in as Paper Trader") — the
  mock accepts any `KITE_API_KEY`/`KITE_ACCESS_TOKEN` (or defaults).
- `withMockSession` enforces the same "call login first" contract as Kite MCP
  for parity, but in the mock the session is trivially satisfied.
- Optionally honor `STRICT_AUTH` from config for parity testing.

---

## 10. Pagination

Replicate Kite MCP's pagination contract exactly so agent-facing responses are
identical in shape:

```
Response (when `limit` provided):
{
  "data": [ ...page items... ],
  "pagination": {
    "total": <original length>,
    "from": <start index>,
    "limit": <requested limit>,
    "returned": <page length>
  }
}
```

Applies to: `get_holdings`, `get_positions`, `get_trades`, `get_orders`,
`get_gtts`, `search_instruments`. When `limit` is absent, return the raw array
(no wrapper) — matching Kite MCP.

---

## 11. Error Handling

Mirror Kite MCP's convention: a failed tool call returns an MCP result with
`isError: true` and a JSON `error_type`-aware message, **not** a thrown
exception (agents handle error results gracefully).

```typescript
return {
  content: [{ type: "text", text: JSON.stringify({ error: "Failed to get quotes" }) }],
  isError: true,
};
```

Mapping:

| Mock error | MCP result |
|------------|------------|
| `KiteError` (InputException/NetworkException/OrderException/MarginException/...) | `isError: true`, message = error message, body includes `error_type` |
| Unknown symbol (`InputException`) | `isError: true` |
| Missing required arg | `isError: true` "Missing required parameter: X" |
| Session not logged in | `isError: true` "Please log in first using the login tool" |

---

## 12. Determinism & Testing

- All MCP tools read from the same `MockEngine`; `mockEngine.emitTick(...)`
  forces exact prices that MCP `get_quotes`/`get_historical_data`/matching
  observe — deterministic agent testing.
- **Seedable**: `mockEngine.seedRandom(seed)` makes quote/candle series
  reproducible across agent runs.
- **Test plan**:
  - Unit: each tool's handler → correct mock service call + JSON shape.
  - Integration: start MCP stdio transport, drive `tools/list` + `tools/call`
    via the SDK client, assert responses.
  - Parity: golden-file compare mock MCP responses vs real Kite MCP response
    schemas (same field sets).
  - End-to-end: an agent loop (login → get_quotes → place_order →
    get_positions) against the mock.

---

## 13. Packaging & Deployment

### 13.1 New CLI modes (extend `bin/cli.ts`)

```bash
# MCP over stdio (local agent subprocess)
npx kite-paper-node --mcp=stdio --seed-symbols=RELIANCE,NIFTY50

# MCP over HTTP + SSE alongside the REST/WS server
npx kite-paper-node --mcp=http --port=4000 --seed-symbols=RELIANCE,NIFTY50
```

Flags:

| Flag | Default | Description |
|------|---------|-------------|
| `--mcp` | `off` | `off` \| `stdio` \| `http` \| `sse` \| `hybrid` |
| `--mcp-path` | `/mcp` | HTTP/SSE endpoint path |
| `--mcp-exclude` | `` | Comma-separated tools to omit (Kite MCP parity) |

### 13.2 Dependencies

- **New runtime dep:** `@modelcontextprotocol/sdk` (the MCP reference SDK) +
  `zod` (schema validation). This is a justified addition — it is the MCP
  protocol, not app logic. It stays **optional**: importing the MCP server must
  not break the existing SDK-mock / REST modes (lazy-load like `express`/`ws`).

### 13.3 Reuse

- `src/mcp/` new folder: `server.ts`, `tools.ts`, `tool-registry.ts`,
  `handlers/*.ts`, `common.ts` (helpers), `pagination.ts`.
- Reuses `MockEngine`, all services, `mockEngine` singleton, and the mock auth.

---

## 14. Compatibility & Risks

| # | Risk | Mitigation |
|---|------|------------|
| R1 | **MCP SDK API drift** (TS SDK changes across versions) | Pin a specific `@modelcontextprotocol/sdk` version; isolate all SDK usage in `src/mcp/server.ts` so core logic is SDK-agnostic |
| R2 | **Tool-schema drift vs Kite MCP** (Kite adds/renames tools or params) | Versioned tool registry; golden-file parity tests against the reference repo's tool list |
| R3 | **Response-shape drift** | MCP returns the same objects the REST mode returns (already field-for-field verified vs `kiteconnect`); any fix propagates to all modes |
| R4 | **Optional dep bloat** | `@modelcontextprotocol/sdk` lazy-loaded only when `--mcp` is used |
| R5 | **Session semantics** | Mock session is trivial; parity enforced via `withMockSession` so agent flows behave the same |
| R6 | **Concurrent JIT state** (MCP + REST sharing the engine) | Single `MockEngine` singleton is already the shared source of truth; MCP is read/write on the same engine (documented) |

---

## 15. Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| AD-M1 | **Node.js + `@modelcontextprotocol/sdk`** (not Go) | Matches the mock's language; reuses `MockEngine` in-process; no cross-language bridge |
| AD-M2 | **Thin adapter only — no data logic in MCP layer** | All data comes from existing services; guarantees parity and avoids duplication |
| AD-M3 | **Same 22 tools / names / params / shapes as Kite MCP** | Zero-change agent switchover between mock and live |
| AD-M4 | **Lazy-load the SDK** | Preserves the project's zero-dependency core for non-MCP use |
| AD-M5 | **Return `isError: true` (not throw)** for tool failures | Matches Kite MCP / MCP convention; agents handle error results |
| AD-M6 | **Replicate Kite MCP pagination wrapper** | Agent-facing responses are byte-compatible with the real server |
| AD-M7 | **`--mcp` CLI flag + `src/mcp/` folder** | Additive, discoverable, keeps existing modes untouched |

---

> **End of MCP architecture.** This is design-only. Next step: implement
> `src/mcp/` per this document, adding `@modelcontextprotocol/sdk` as an
> optional dependency and the `--mcp` CLI flag, then add parity + E2E tests.
