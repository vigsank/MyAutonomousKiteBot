# Agents.md — Contribution Guide & Engineering Practices

> **Read this before contributing.** This project is a **money-based stock
> trading bot**. Code quality, correctness, and risk-awareness are not optional
> here. Every change must follow the practices below. This file is a contract
> for **any** agent or human contributor.

---

## 1. Project principles

1. **Paper-first, always.** The bot must never place a real order unless an
   explicit, deliberate "go live" step is taken. Default to simulation.
2. **Risk is immutable.** The `RiskEngine` is a hard gatekeeper. Strategy/AI
   logic can **never** override risk limits.
3. **Correctness over cleverness.** Trading code must be predictable and
   auditable. Favor clarity over micro-optimization.
4. **Everything is persisted.** Trades, signals, risk decisions, and
   notifications go to SQLite. No silent in-memory-only state that matters.
5. **Type-safe and strict.** TypeScript `strict` mode is on. No `any` in
   production `src/` unless unavoidable (and then documented).
6. **Deterministic where possible.** Backtests must be reproducible.

---

## 2. Repository layout

```
MyAutonomousKiteVault/
├── src/                 # PURE source code only (no scripts/tests)
│   ├── types.ts         # shared domain types
│   ├── AppConfig.ts     # config loader
│   ├── Logger.ts        # pino logger
│   ├── MigrationRunner.ts
│   ├── NotificationService.ts
│   ├── RiskEngine.ts    # immutable risk gatekeeper
│   ├── MarketAgent.ts   # strategy brain
│   ├── OptionsEngine.ts # v2 scaffold
│   ├── KiteStreamer.ts  # live provider (Kite)
│   ├── Ledger.ts        # SQLite persistence
│   ├── PaperTrader.ts   # simulated execution
│   ├── NewsSentimentEngine.ts
│   ├── LlmManager.ts
│   ├── TelegramHITL.ts
│   ├── MarketDataProvider.ts   # provider interfaces
│   ├── providers/       # factory + Yahoo/OpenBB providers
│   └── *.d.ts           # ambient declarations
├── test/backtest/       # backtest/simulate/optimize scripts (NOT in src/)
├── migrations/          # SQL migrations (V001__*.sql)
├── data/                # runtime data (git-ignored DBs, watchlist.json)
├── docs/                # documentation
└── Agents.md            # this file
```

**Rule:** `src/` contains **only** production source. Backtest/simulate/optimize
scripts and tests live in `test/backtest/`. Never add a runnable script to
`src/`.

---

## 3. Coding style

- **TypeScript, strict mode.** `noImplicitAny`, `strictNullChecks`, etc. on.
- **2-space indentation**, single quotes, semicolons.
- **Named exports** for classes/functions; default exports only for the entry
  point if needed.
- **No `any`** in `src/` unless documented with a reason. Prefer `unknown` +
  narrowing, or a proper type.
- **Prefer `readonly`** for constructor-injected dependencies and immutable
  config.
- **Use the shared logger** (`import { logger } from './Logger'`). Never
  `console.log` in `src/`.
- **Use the shared types** from `types.ts`. Don't redefine shapes inline.
- **Comments explain "why", not "what".** Avoid restating the code.

### Naming
- Files: `PascalCase.ts` for classes, `camelCase.ts` for utilities.
- Classes: `PascalCase`. Methods/vars: `camelCase`. Constants: `UPPER_SNAKE`.
- Interfaces: `PascalCase` (no `I` prefix).

---

## 4. Architecture & patterns

### Dependency injection
Constructors take their dependencies explicitly. No service locators, no global
singletons for domain logic. Example:

```ts
class MarketAgent {
  constructor(
    private readonly config: AppConfig,
    private readonly streamer: LiveDataProvider,
    private readonly ledger: Ledger,
    private readonly risk: RiskEngine,
    // ...
  ) {}
}
```

### Provider abstraction
Market data goes through `MarketDataProvider` interfaces:
- `HistoricalDataProvider` — for backtests (Yahoo/OpenBB/Kite).
- `LiveDataProvider` — for live ticks (Kite).

Add a new source by implementing the interface and registering it in
`src/providers/factory.ts`. **Never** hardcode a provider into strategy logic.

### Strategy guards
All entry guards live in `MarketAgent.checkEntry`. Each guard is a small,
named, testable step. Add new guards as separate private methods returning a
reason string (or `null` to allow).

### Risk engine
`RiskEngine` is the **only** place that enforces capital/drawdown/allocation
limits. Strategy code calls `risk.evaluate(trade)` and must respect the result.
Never bypass it.

### Persistence
All state flows through `Ledger` (SQLite). Schema changes go through
`migrations/` (see `MigrationRunner`). Never mutate the DB schema outside a
migration.

### Notifications
All user-facing messages go through `NotificationService` (DB-first, Telegram
optional). Never call Telegram directly from strategy code.

---

## 5. Algorithms & indicators

- Indicators come from `@debut/indicators` (RSI, ADX, ATR). **Do not** hand-roll
  them.
- **RSI(14)** — mean-reversion entry/exit.
- **ADX(14)** — regime filter (only trade when below threshold).
- **ATR(14)** — adaptive stop-loss and position sizing.
- **Volume** — confirmation filter.
- Indicator state is per-symbol and lives in the agent (not global). Warm up
  before use (RSI/ADX/ATR need ~14 bars).

### Known SDK quirks (do not "fix" blindly)
- Kite `getHistoricalData` uses **positional** args.
- `@debut/indicators` RSI has **no `.value()` getter** — capture the return of
  `nextValue()`.
- ADX `nextValue()` returns `{ adx, pdi, mdi }` — use `.adx`.
- Yahoo Finance v4 uses a **class** (`new YahooFinance()`), and intraday needs
  `chart()`, not `historical()`.

---

## 6. Testing & validation

- **Typecheck:** `npm run typecheck` (`tsc --noEmit`) must pass with zero errors.
- **Self-test:** `npm run test:backtest` verifies the onCandle backtest path.
- **Simulate:** `npm run simulate` sanity-checks the pipeline.
- **Backtest:** `npm run backtest` validates against real history.
- **Optimize:** `npm run optimize -- --quick` (fast) before any wide sweep.
- Before merging a strategy change, run a backtest and confirm the result is
  not a regression.

---

## 7. Risk & money-safety rules

1. **Never** place a real order in code paths that run automatically.
2. **Never** let the AI/LLM override `RiskEngine`.
3. **Never** hardcode secrets. Use `.env` (git-ignored).
4. **Never** commit `.env`, `data/*.db`, or logs.
5. **Never** change the DB schema without a migration.
6. **Never** add a dependency without justification (prefer existing deps).
7. **Never** silence errors with empty `catch` unless intentional and commented.
8. **Never** use `console.log` in `src/` — use the logger.

---

## 8. Git & commit practices

- Small, focused commits with clear messages.
- Keep `src/` free of scripts/tests.
- Do not commit generated artifacts (`dist/`, `data/*.db`, `node_modules/`).
- Follow the existing structure; don't reorganize without discussion.

---

## 9. Definition of done

A change is done when:
- [ ] `npm run typecheck` passes (zero errors).
- [ ] No new `any` in `src/` (or documented).
- [ ] Uses the shared logger, types, and DI patterns.
- [ ] Risk limits are respected (not bypassed).
- [ ] Any schema change has a migration.
- [ ] Docs updated if behavior/config changed.
- [ ] A backtest/simulate confirms no regression.
