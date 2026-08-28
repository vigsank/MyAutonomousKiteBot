# Plan — Split `kite-paper-node` into a standalone GitHub repo

> Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked/rejected

## 1. Goal & scope

Split `kite-paper-node/` out of the parent `MyAutonomousKiteBot` repo into its **own GitHub repository**, so the two become independent projects. After the split:

- **`kite-paper-node`** = a standalone, npm-publishable package **and** a standalone REST/WebSocket/MCP server — the "live data provider" / mock Zerodha backend.
- **`MyAutonomousKiteBot`** = the trading bot, consuming kite-paper-node **only** through a package boundary (npm) and/or the network (REST/WS/MCP) — **never** through in-process relative `require()` or hardcoded relative filesystem paths.

**Non-goals (out of scope):**
- No change to the Kite API/MCP tool shapes (must stay drop-in compatible with Zerodha `kiteconnect` / `kite-mcp-server`).
- No change to the bot's strategy/risk/execution logic.
- No change to the parent's own `data/` market-context JSON files (`economic_calendar.json`, `corporate_actions.json`, `fii_dii.json`, `sectors.json`, `index_constituents.json`) — these already live in the parent and stay there (Zerodha Kite does not provide them in live).

## 2. Current coupling inventory (exact)

### 2a. In-process SDK mock (code import)
| # | File | Line | Coupling |
|---|---|---|---|
| 1 | `src/server/KiteStreamer.ts` | 29 | `require('../../kite-paper-node/dist')` when `PAPER_TRADING=true` |

### 2b. `createMockServer` import (code import)
| # | File | Line | Coupling |
|---|---|---|---|
| 2 | `test/backtest/mock_30d_trade.ts` | 28 | `import { createMockServer } from '../../kite-paper-node/src/index'` |
| 3 | `test/backtest/mock_ai_backed.ts` | 37 | same |
| 4 | `test/backtest/momentum_live_pattern.ts` | 25 | same |

### 2c. Data CSV path (hardcoded relative path)
| # | File | Line | Coupling |
|---|---|---|---|
| 5 | `test/backtest/mock_30d_trade.ts` | 34 | `DATA_DIR = path.join(__dirname, '../../kite-paper-node/data')` |
| 6 | `test/backtest/mock_ai_backed.ts` | 44 | same |
| 7 | `test/backtest/mock_backtest.ts` | 24 | `path.join(process.cwd(), 'kite-paper-node', 'data')` |
| 8 | `test/backtest/defensive_exit_validation.ts` | 36 | `path.join(__dirname, '..', '..', 'kite-paper-node', 'data')` |
| 9 | `test/backtest/news_defensive_real.ts` | 39 | same |
| 10 | `test/backtest/news_monitor_walk_forward.ts` | 21 | `path.join(__dirname, '../../kite-paper-node/data')` |
| 11 | `test/backtest/news_real_validation.ts` | 19 | same |
| 12 | `test/backtest/sim_12m_sip.ts` | 14 | same |
| 13 | `test/backtest/veto_audit.ts` | 18 | same |

### 2d. `dataDir: 'kite-paper-node/data'` passed to `createMockServer`
| # | File | Line |
|---|---|---|
| 14 | `test/backtest/mock_30d_trade.ts` | 169 |
| 15 | `test/backtest/mock_ai_backed.ts` | 227 |
| 16 | `test/backtest/momentum_live_pattern.ts` | 56 |

### 2e. Comment-only references (no code coupling, but misleading)
| # | File | Line | Note |
|---|---|---|---|
| 17 | `src/server/BrokerAccount.ts` | 10 | comment mentions "kite-paper-node's drop-in mock" |
| 18 | `src/server/LiveDataService.ts` | 5–14 | comment says "served by kite-paper-node" but actually reads the parent's own `data/` |

### 2f. Already decoupled (no change needed)
- `src/server/KiteMcpClient.ts` — talks to `KITE_MCP_URL` over the network (MCP streamable HTTP). ✅
- `src/server/LiveDataService.ts` — reads `data/*.json` from the parent's own `data/` dir. ✅ (only the comment is stale)
- `test/backtest/momentum_walk_forward.ts` — uses `createHistoricalProvider` (Yahoo), not kite-paper-node CSVs. ✅

### 2g. Docs to update
- `kite-paper-node/docs/RUN-IN-MYAUTONOMOUSKITEBOT.md` (rewrite for package/network consumption)
- `README.md`, `Agents.md`, `docs/CAPABILITIES.md`, `docs/CONFIGURATION.md`, `docs/plan/TODO.md`, `docs/plan/adhoc-change.md`

## 3. Target architecture

```
┌──────────────────────────────┐        npm package (drop-in SDK mock)
│  MyAutonomousKiteBot (repo)  │ ──────► require('kite-paper-node')
│  - strategy / risk / agents  │
│  - LiveDataService (own data)│        network (REST / WS / MCP)
│  - KiteMcpClient (read-only) │ ──────► http://127.0.0.1:4000/mcp
└──────────────────────────────┘
                 │
                 │  (no relative require / no hardcoded ../kite-paper-node)
                 ▼
┌──────────────────────────────┐
│  kite-paper-node (own repo)  │
│  - MockKiteConnect/Ticker    │
│  - REST + WS + MCP server    │
│  - data/*.csv (5y NSE)       │
└──────────────────────────────┘
```

## 4. Key decisions (with recommendation)

### D1 — How the parent consumes the SDK mock
- **A. npm package** (publish to npm, or a private registry, or a git URL dependency). Parent adds `"kite-paper-node": "github:user/kite-paper-node#v1.0.0"` (or `npm link` for local dev).
- **B. git submodule** (parent references kite-paper-node as a submodule).
- **C. network-only** (drop the in-process SDK mock entirely; parent always runs the standalone server).

**Recommendation: A (npm package) + C (network) as the two supported paths.**
- The SDK mock stays a drop-in `kiteconnect` replacement via a real package boundary (`require('kite-paper-node')`), so `KiteStreamer` needs only a one-line change.
- The "real broker" simulation (mock trades) uses the standalone REST/WS/MCP server over the network — this is the "communication done accordingly" the user asked for.
- Avoid **B (submodule)** — it keeps a nested-git coupling that is exactly what we're trying to remove.

### D2 — Where the 5-year NSE CSVs live
- **A. Stay in kite-paper-node** (it is the data provider; the CSVs are its "live data").
- **B. Move to the parent** (parent owns all data).
- **C. Shared external data dir** (neither repo; a mounted volume / sibling checkout).

**Recommendation: A (stay in kite-paper-node), with a configurable `DATA_DIR` escape hatch.**
- kite-paper-node is the "live data provider" per the user's earlier direction; the CSVs belong with it.
- The parent's backtests must **not** hardcode `../../kite-paper-node/data`. Instead they read from a single `DATA_DIR` env var (defaulting to a sibling checkout path, e.g. `../kite-paper-node/data`), so the two repos can live anywhere.

### D3 — How backtests get historical closes
- **A. Direct CSV read** (fast, offline) via a configurable `DATA_DIR`.
- **B. Fetch via the mock's REST/MCP historical endpoint** (network, "live-like").

**Recommendation: A for pure backtests, B for "live-pattern" mock trades.**
- `sim_12m_sip.ts`, `defensive_exit_validation.ts`, `news_*`, `veto_audit.ts`, `mock_backtest.ts` → direct CSV read from `DATA_DIR` (fast, deterministic).
- `mock_30d_trade.ts`, `mock_ai_backed.ts`, `momentum_live_pattern.ts` → already fetch via REST; keep them network-based (they simulate the real broker).

### D4 — `createMockServer` in backtests
- **A. Import from the npm package** (`import { createMockServer } from 'kite-paper-node'`).
- **B. Spawn the standalone server as a child process** (network-only).

**Recommendation: A (import from package) for in-process test harnesses; B (child process) only for the "real broker" mock-trade scripts that must exercise the network path.**

## 5. Execution phases

### P0 — Repo extraction (git)
- `[ ]` Create the new GitHub repo `kite-paper-node` (owner: User1 `Vigsank`).
- `[ ]` In `kite-paper-node/`, `git init` (or `git filter-repo` to extract its history) and push as its own repo.
- `[ ]` Remove `kite-paper-node/` from the parent's git tracking (add to parent `.gitignore` or `git rm --cached`), so the parent no longer commits it.
- `[ ]` Verify parent git identity is User1 (`Vigsank <vigsank@gmail.com>`) before any push.

### P1 — Package boundary (npm)
- `[ ]` In `kite-paper-node/package.json`: confirm `main`/`types`/`files`/`bin` are correct for publishing; add a `version` tag.
- `[ ]` Publish (or set up a git URL dependency). For local dev, document `npm link`.
- `[ ]` Parent `package.json`: add `kite-paper-node` as a dependency (git URL or npm).
- `[ ]` `src/server/KiteStreamer.ts` L29: change `require('../../kite-paper-node/dist')` → `require('kite-paper-node')`.

### P2 — Decouple data paths
- `[ ]` Introduce a single `DATA_DIR` resolution helper (e.g. `test/backtest/_dataDir.ts`) that reads `KITE_PAPER_DATA_DIR` env, falling back to `../kite-paper-node/data` (sibling checkout).
- `[ ]` Replace all hardcoded `../../kite-paper-node/data` / `process.cwd()/kite-paper-node/data` paths (files #5–#13) with the helper.
- `[ ]` Replace `dataDir: 'kite-paper-node/data'` (files #14–#16) with the resolved `DATA_DIR`.

### P3 — Decouple `createMockServer` imports
- `[ ]` Change `import { createMockServer } from '../../kite-paper-node/src/index'` → `from 'kite-paper-node'` (files #2–#4).

### P4 — Fix stale comments
- `[ ]` `src/server/BrokerAccount.ts` L10 — reword to "the `kite-paper-node` npm package's drop-in mock".
- `[ ]` `src/server/LiveDataService.ts` L5–14 — reword to "reads the parent's own `data/` market-context files (not served by kite-paper-node)".

### P5 — Docs
- `[ ]` Rewrite `kite-paper-node/docs/RUN-IN-MYAUTONOMOUSKITEBOT.md` → "Consuming kite-paper-node as a package + server".
- `[ ]` Update parent `README.md`, `Agents.md`, `docs/CAPABILITIES.md`, `docs/CONFIGURATION.md` to reflect the package/network boundary.
- `[ ]` Add a `docs/plan/TODO.md` entry referencing this plan.

### P6 — Validation
- `[ ]` `npm run ci` (parent) — unit + momentum OOS gate still green.
- `[ ]` `npx tsc --noEmit` (parent) and `npx tsc --noEmit` (kite-paper-node) — 0 errors.
- `[ ]` `npm run build` inside kite-paper-node, then confirm `require('kite-paper-node')` resolves from the parent.
- `[ ]` Run one mock trade (`mock_30d_trade.ts`) end-to-end against the standalone server to confirm the network path works.
- `[ ]` Run one direct-CSV backtest (`sim_12m_sip.ts`) to confirm `DATA_DIR` resolution works.

## 6. Config / env changes
- New env: `KITE_PAPER_DATA_DIR` (optional) — overrides the default sibling-checkout CSV path.
- `PAPER_TRADING`, `KITE_MCP_URL`, `KITE_MCP_ENABLED` — unchanged.
- No change to `LLM_PROVIDER` or any strategy/risk keys.

## 7. Docs to update (summary)
- `kite-paper-node/docs/RUN-IN-MYAUTONOMOUSKITEBOT.md` (rewrite)
- `kite-paper-node/README.md` (publish/consume instructions)
- parent `README.md`, `Agents.md`, `docs/CAPABILITIES.md`, `docs/CONFIGURATION.md`
- `docs/plan/TODO.md` (add reference), `docs/plan/adhoc-change.md` (record the split)

## 8. Validation (acceptance criteria)
1. `grep -r "kite-paper-node" src/ test/ scripts/` returns **zero** hardcoded relative-path/`require` hits (only the npm package name and the `DATA_DIR` helper).
2. Parent `npm run ci` green.
3. Both projects typecheck clean.
4. A mock trade runs against the standalone server (network) and a backtest runs against `DATA_DIR` (offline).

## 9. Risks & rollback
- **Risk:** npm package not yet published → use a git URL dependency or `npm link` for local dev (no publish required to proceed).
- **Risk:** 837 CSVs are large → keep them in kite-paper-node (git-lfs if needed); do **not** duplicate into the parent.
- **Risk:** breaking the `KiteStreamer` mock path → the one-line `require('kite-paper-node')` change is the only code change; revert is trivial.
- **Rollback:** every phase is independently revertible; the parent's git history is preserved (extraction uses `git filter-repo` on a copy, not in-place).
