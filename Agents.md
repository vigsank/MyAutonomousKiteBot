# AGENTS.md — guidance for coding agents working in this repo

This file tells AI coding agents how to work safely and consistently in
`MyAutonomousKiteBot` (a Node.js/TypeScript Zerodha Kite paper-trading bot with
an AI agent fleet).

## Environment files — real vs. test

The project uses **three env files that must stay in sync (same keys)**:

| File | Purpose | Loaded when |
|------|---------|-------------|
| `.env` | **Real / production** run | default (`ENV_FILE` unset, or `NODE_ENV != test`) |
| `.env.test` | **Test / dev** run (mock data, dev knobs, test capital) | `ENV_FILE=.env.test` or `NODE_ENV=test` |
| `.env.example` | Template / documentation of every key | never loaded |

- `src/server/AppConfig.ts` loads `process.env.ENV_FILE || (NODE_ENV==='test' ? '.env.test' : '.env')`.
- **Real runs** use `.env` (e.g. `npm run dev`, `npm run dev:all`).
- **Test runs** use `.env.test` (all `test:*`, `backtest`, `optimize`, `ab:compare`,
  `agents:dryrun`, `validate:strategy`, `mock:ui`, `simulate`, `chart` npm scripts
  are prefixed with `ENV_FILE=.env.test`).

### Rules for env files
1. **Keep the same keys** across `.env`, `.env.test`, and `.env.example`. Values
   may differ per file (e.g. `.env.test` uses mock Kite keys, `PAPER_TRADING=true`,
   higher test capital, and dev knobs on), but the **key set must match**.
2. When you add a new config key to `AppConfig.ts`, add it to **all three** files.
3. `.env` and `.env.test` are gitignored (never commit real secrets). `.env.example`
   is the committed template — put empty/placeholder values there.
4. Dev/test knobs (e.g. `AGENTS_PROBE_ALWAYS`, `AGENTS_FORCE_SIGNAL`) default to
   **off** in `.env`/`.env.example`; they may be on in `.env.test` for testing.

## UI ↔ server sync rule (IMPORTANT)

Any change to the **server** that affects the **numbers shown in the UI** must be
accompanied by a corresponding change to the **UI** (`src/client/`). Examples:
- Adding/renaming a DB column or API field that the dashboard reads.
- Changing the meaning/format of a value the dashboard displays (P&L, signals,
  positions, probe verdicts, etc.).
- Adding a new data source the dashboard should surface.

If a server change alters what the UI renders, update the relevant client page,
type, and API helper in the same change. Do not leave the UI showing stale or
wrong numbers.

## Architecture notes

- **Server** (`src/server/`): bot, Express REST/WS API, SQLite `Ledger`, `RiskEngine`
  (immutable hard gate), `PaperTrader` (paper-only), `NewsSentimentEngine`,
  `KiteMcpClient` (read-only MCP), `AgentsRuntime` (fleet + probe scheduler).
- **Agents** (`src/agents/`): the AI agent fleet (domains A–H). Each domain file
  (`domainA.ts` … `domainH.ts`) exports `buildDomainAgents(): AgentDef[]`; the
  `def(...)` helper wraps every agent so it never throws. `registry.ts` combines
  them; `orchestrator.ts` runs the pass (parallel/sequential by `deps`).
- **Client** (`src/client/`): React + Vite + shadcn/ui dashboard.
- **Mock** (`kite-paper-node/`): local mock Kite SDK + mock MCP (tool parity with
  Zerodha's `kite-mcp-server`). Used when `PAPER_TRADING=true`.

## Safety invariants (never break)

- **Paper-first**: never place real orders. Execution is `PaperTrader` (paper) or
  gated live via `ALLOW_LIVE_ORDERS=false` + HITL.
- **RiskEngine is the immutable gate**: agents/LLM can never override it.
- **Orders never go through MCP**; MCP is read-only.
- **Agents never throw**: every agent run is wrapped by `def(...)`.

## Validation

- `npm run typecheck` (root + agents) and `npm --prefix src/client run typecheck`
  must pass.
- `npm run build` must pass.
- For agent changes: `npm run agents:dryrun` (uses `.env.test`).
- For UI changes: `npm --prefix src/client run build`.
