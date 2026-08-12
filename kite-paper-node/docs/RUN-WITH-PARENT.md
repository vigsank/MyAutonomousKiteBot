# Running kite-paper-node & switching the parent bot to mock mode

This guide explains how to run `kite-paper-node` locally (it is **not** yet
published to npm) and switch the parent `MyAutonomousKiteVault` bot to use it
for paper-trading your algo — with **zero changes to your strategy logic**.

---

## 1. Build the mock (once)

`kite-paper-node` is used locally via a relative require to its compiled
`dist/`. Build it first:

```bash
cd kite-paper-node
npm install          # if not already done
npm run build        # compiles TypeScript → dist/ and copies instruments.json
```

> The build copies `src/data/instruments.json` into `dist/data/` so the
> compiled mock can resolve the instrument master.

---

## 2. What was wired up

The parent's `src/server/KiteStreamer.ts` now resolves the Kite SDK classes
conditionally:

```ts
function resolveKiteSdk() {
  if (process.env.PAPER_TRADING === 'true') {
    const mock = require('../../kite-paper-node/dist');
    return {
      KiteConnect: mock.KiteConnect ?? mock.MockKiteConnect,
      KiteTicker: mock.KiteTicker ?? mock.MockKiteTicker,
    };
  }
  return require('kiteconnect');
}
const { KiteConnect, KiteTicker } = resolveKiteSdk();
```

- `PAPER_TRADING=true` → uses the **mock** (in-process, zero network).
- otherwise → uses the **real** `kiteconnect` SDK (unchanged behavior).

The mock classes extend the real `kiteconnect` classes, so `instanceof` and
the whole `KiteStreamer` call surface work unchanged.

---

## 3. Run the parent bot in mock mode

```bash
# From the parent project root (MyAutonomousKiteVault)
PAPER_TRADING=true \
KITE_API_KEY=mock_key \
KITE_ACCESS_TOKEN=mock_token \
npm run dev
```

Required env vars:

| Env | Value | Why |
|-----|-------|-----|
| `PAPER_TRADING` | `true` | Switch to the mock |
| `KITE_API_KEY` | any non-empty (e.g. `mock_key`) | `KiteStreamer.isConfigured` requires it |
| `KITE_ACCESS_TOKEN` | any non-empty (e.g. `mock_token`) | same |

Optional / defaults:

| Env | Default | Notes |
|-----|---------|-------|
| `KITE_ROOT` | `https://api.kite.trade` | Ignored by the mock (in-process) |
| `WATCHLIST_FILE` | `data/watchlist.json` | Symbols the algo trades |

The bot boots in **paper mode** (it never places real orders) and streams
**JIT-generated ticks** from the mock for every watchlist symbol.

---

## 4. What the mock provides to the parent

| Parent call | Mock behavior |
|-------------|---------------|
| `kite.getInstruments('NSE')` | Returns the 30-symbol instrument master |
| `kite.getHistoricalData(token, interval, from, to)` | Returns `HistoricalData[]` (synthetic candles, JIT) |
| `kite.getQuote('NSE:SYMBOL')` | Returns live JIT quote (incl. `change`) |
| `ticker.subscribe(tokens)` | Auto-registers a generator for each token and streams ticks |
| `ticker.setMode(ticker.MODE_FULL, tokens)` | Supported (`MODE_FULL`/`MODE_LTP`/`MODE_QUOTE` aliases added) |
| `ticker.on('ticks', cb)` | Emits ticks every ~1s per symbol |

The mock auto-registers a generator for any token in its instrument master the
moment you subscribe or query it — so you don't need to pre-seed anything.

---

## 5. Symbols available

The mock's instrument master (`kite-paper-node/src/data/instruments.json`)
contains all 28 NSE symbols from the parent's `data/watchlist.json` plus
`NIFTY50` and `BANKNIFTY`:

```
RELIANCE, NIFTY50, BANKNIFTY, TATASTEEL, INFY, HDFCBANK, TCS, SBIN, ITC,
HINDUNILVR, ICICIBANK, KOTAKBANK, AXISBANK, HCLTECH, WIPRO, ONGC, NTPC,
TATAMOTORS, MARUTI, M&M, NESTLEIND, BHARTIARTL, LT, ULTRACEMCO, JSWSTEEL,
SUNPHARMA, DRREDDY, TITAN, ASIANPAINT, ADANIPORTS
```

To add more symbols, edit `instruments.json` (each needs a **unique**
`instrument_token`) and rebuild.

---

## 6. Deterministic testing (optional)

You can drive prices deterministically from any script by importing the mock
engine directly:

```js
const { mockEngine } = require('./kite-paper-node/dist');
mockEngine.emitTick({ instrument_token: 738561, last_price: 2450.0 }); // RELIANCE
```

This forces a price that triggers your limit/stop orders exactly.

---

## 7. Switching back to live

Just unset `PAPER_TRADING` (or set it to anything but `true`) and provide real
`KITE_API_KEY` / `KITE_ACCESS_TOKEN` / `KITE_ROOT`. No code changes needed.

---

## Troubleshooting

- **"Cannot find module '../../kite-paper-node/dist'"** → run `npm run build`
  inside `kite-paper-node` first.
- **No ticks for a symbol** → the symbol must be in `instruments.json` (the
  mock only generates ticks for known tokens).
- **`Kite configured: false`** → set `KITE_API_KEY` and `KITE_ACCESS_TOKEN` to
  non-empty values.
