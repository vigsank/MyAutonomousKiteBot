# Contributing to kite-paper-node

Thanks for your interest in contributing! This project is a zero-dependency
paper trading mock engine for Zerodha Kite Connect. We welcome contributions of
all kinds — bug reports, feature requests, documentation, and code.

---

## Code of Conduct

Be respectful and constructive. This is a small, focused project; keep
discussions technical and kind.

---

## Getting Started

```bash
# Clone and install
git clone <your-fork-url> kite-paper-node
cd kite-paper-node
npm install

# Run the test suite
npm test

# Build
npm run build
```

---

## Project Structure

```
src/
  core/        # Order, matching, ledger, position, margin, GTT engines
  market/      # Random walk generator, generator pool, tick bus, replay, buffers
  services/    # REST-facing service layer
  server/      # REST + WebSocket servers, binary packer
  state/       # In-memory state store
  protocol/    # Constants, errors
  utils/       # PRNG, price/date helpers, id generation, config
  data/        # Instrument master (static JSON)
  types/       # Public type definitions
  bin/         # CLI entry point
test/
  unit/        # Unit tests
  integration/ # Integration + JIT consistency tests
```

---

## Development Workflow

1. **Fork and branch** — create a feature branch from `main`.
2. **Write a failing test** — add a test in `test/unit` or `test/integration`.
3. **Implement** — keep changes minimal and consistent with the existing style.
4. **Run the suite** — `npm test` must pass.
5. **Type-check** — `npm run typecheck` must pass.
6. **Open a PR** — describe the change and reference any related issue.

---

## Design Principles

- **Zero runtime dependencies** — the core engine uses only Node.js built-ins
  (`events`, `buffer`, `http`, `crypto`, `net`). `express`/`ws` are optional.
- **100% JIT data generation** — no static price data. Only the instrument
  master is static.
- **Determinism first** — every stochastic process is seedable; tests must be
  reproducible.
- **Protocol fidelity** — REST response shapes and binary frames must match
  `kiteconnect`. When changing the binary packer, validate against the real
  `kiteconnect` source and `kiteconnect-mocks` fixtures.
- **Single source of truth** — one generator instance per symbol; WS and REST
  must never diverge.

---

## Testing Guidelines

- Cover every order type × direction × price scenario in the matching engine.
- Use `mockEngine.emitTick()` for deterministic fills.
- Add a JIT consistency test when you touch the market data layer.
- Keep coverage thresholds in `jest.config.js` satisfied.

---

## Adding Instruments

The instrument master lives in `src/data/instruments.json`. To add a symbol:

```json
{
  "instrument_token": 123456,
  "exchange_token": "1929",
  "tradingsymbol": "SYMBOL",
  "name": "FULL NAME",
  "last_price": 100.0,
  "expiry": "",
  "strike": 0,
  "tick_size": 0.05,
  "lot_size": 1,
  "instrument_type": "EQ",
  "segment": "NSE",
  "exchange": "NSE"
}
```

---

## Commit & PR Conventions

- Use clear, imperative commit messages (e.g., "Add SL-M trigger matching").
- Keep PRs focused on a single concern.
- Update `README.md` and `docs/ARCHITECTURE.md` when behavior changes.

---

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
