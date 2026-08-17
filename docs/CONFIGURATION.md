# Configuration Guide — My Autonomous Kite Bot

This document walks through **every configurable entity** in the bot, from
obtaining credentials to tuning the strategy. Most configuration lives in
environment variables (loaded from `.env`). A few things live in JSON files
(`data/watchlist.json`, `data/overnight_events.json`).

> **Authoritative source:** everything in this guide is reconciled against
> `src/server/AppConfig.ts` — the single loader that reads the environment at
> startup. If a key is not listed here, `AppConfig.ts` does not read it.

## Table of contents

1. [Environment variables overview](#environment-variables-overview)
2. [Market data providers (backtest vs live)](#market-data-providers-backtest-vs-live)
3. [1. Zerodha Kite Connect](#1-zerodha-kite-connect)
4. [2. AI / LLM provider](#2-ai--llm-provider)
5. [3. News feeds](#3-news-feeds)
6. [4. Telegram (human-in-the-loop)](#4-telegram-human-in-the-loop)
7. [5. Notification system](#5-notification-system)
8. [6. Logging (pino)](#6-logging-pino)
9. [7. Database schema & migrations](#7-database-schema--migrations)
10. [8. Quantitative risk configuration](#8-quantitative-risk-configuration)
11. [9. Paper trading costs (realism)](#9-paper-trading-costs-realism)
12. [10. Strategy tuning](#10-strategy-tuning)
13. [11. Agent probes](#11-agent-probes)
14. [12. End-of-day (EOD) layer](#12-end-of-day-eod-layer)
15. [13. Watchlist file](#13-watchlist-file)
16. [14. Verifying each piece works](#14-verifying-each-piece-works)
17. [15. Troubleshooting](#15-troubleshooting)
18. [16. UI / dashboard](#16-ui--dashboard)
19. [17. Walk-forward validation (script)](#17-walk-forward-validation-script)
20. [18. Momentum & live-trading keys (present in `.env`, NOT yet read)](#18-momentum--live-trading-keys-present-in-env-not-yet-read)

---

## Environment variables overview

All values are read from `.env` (see `.env.example`). The bot loads them at
startup via `dotenv` in `src/server/AppConfig.ts`. **Never commit `.env`** — it is
git-ignored. A different file can be selected with `ENV_FILE` (the loader also
switches to `.env.test` automatically when `NODE_ENV=test`).

The table below is the **complete** set of keys `AppConfig.ts` reads. Defaults are
what the loader uses when the variable is unset or empty.

| Variable | Purpose | Default |
| -------- | ------- | ------- |
| `ENV_FILE` | Path of the env file to load (overrides auto-detect) | `.env` |
| `DATA_DIR` | Where `watchlist.json`, `overnight_events.json` and the SQLite DB live | `./data` |
| `WATCHLIST_FILE` | Override path to the watchlist JSON file | `<DATA_DIR>/watchlist.json` |
| `LOG_LEVEL` | Pino log level: trace/debug/info/warn/error/fatal | `info` |
| `KITE_API_KEY` | Zerodha app API key | — |
| `KITE_API_SECRET` | Zerodha app API secret | — |
| `KITE_ACCESS_TOKEN` | Your login access token | — |
| `KITE_ROOT` | Kite API base URL | `https://api.kite.trade` |
| `LIVE_PROVIDER` | Real-time source: `kite` (also in-process paper mock) | `kite` |
| `BACKTEST_PROVIDER` | Historical source: `yahoo`, `openbb`, or `kite` | `yahoo` |
| `OPENBB_BASE_URL` | OpenBB local REST API base (when `BACKTEST_PROVIDER=openbb`) | `http://127.0.0.1:6900` |
| `LLM_PROVIDER` | LLM provider: `openai`, `ollama`, `litellm`, or `none` | auto-detect |
| `OLLAMA_BASE_URL` | Ollama OpenAI-compatible endpoint | `https://ollama.com/v1` |
| `OLLAMA_API_KEY` | Ollama API key | — |
| `OLLAMA_MODEL` | Active Ollama model | `llama3.3` |
| `OLLAMA_MODELS` | Comma-separated Ollama models to choose from | derived |
| `LITELLM_BASE_URL` | LiteLLM proxy base URL | — |
| `LITELLM_API_KEY` | LiteLLM API key | — |
| `LITELLM_MODEL` | Active LiteLLM model | `anthropic--claude-sonnet-latest` |
| `LITELLM_MODELS` | Comma-separated LiteLLM models | derived |
| `OPENAI_BASE_URL` | OpenAI-compatible endpoint | `https://api.openai.com/v1` |
| `OPENAI_API_KEY` | OpenAI API key | — |
| `OPENAI_MODEL` | Active OpenAI model | `gpt-4o-mini` |
| `OPENAI_MODELS` | Comma-separated OpenAI models | derived |
| `LLM_JSON_MODE` | Force strict JSON mode on/off (overrides provider default) | per provider |
| `LLM_TIMEOUT_MS` | Per-request LLM timeout | `60000` |
| `LLM_ENSEMBLE_MODELS` | Ensemble model subset (≤3, ⊆ models) | first 3 models |
| `LLM_FAST_ENSEMBLE_MODELS` | Fast ensemble subset (≤3, ⊆ models) | first 3 models |
| `TINYFISH_API_KEY` | TinyFish key (empty = disabled; Google RSS always on) | — |
| `TINYFISH_MAX_RESULTS` | Max results per TinyFish search | `5` |
| `TINYFISH_TIMEOUT_MS` | HTTP timeout per TinyFish call | `15000` |
| `KITE_MCP_ENABLED` | Enable the Kite MCP server client | `false` |
| `KITE_MCP_URL` | Kite MCP server URL | `https://mcp.kite.trade/mcp` |
| `KITE_MCP_TIMEOUT_MS` | Kite MCP call timeout | `5000` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (leave empty to disable Telegram) | — |
| `TELEGRAM_CHAT_ID` | Your Telegram chat id | — |
| `AGENTS_ENABLED` | Enable the agent probe runtime | `false` |
| `AGENTS_INTERVAL_MS` | Probe cadence | `600000` (10 min) |
| `AGENTS_PROBE_PRE_OPEN` | Pre-open probe time (IST) | `09:00` |
| `AGENTS_PROBE_MID_SESSION` | Mid-session probe time (IST) | `11:00` |
| `AGENTS_PROBE_PRE_CLOSE` | Pre-close probe time (IST) | `15:15` |
| `AGENTS_PROBE_ALWAYS` | Dev: run probe immediately on start regardless of time | `false` |
| `AGENTS_FORCE_SIGNAL` | Dev: force the strategist to propose a trade | `false` |
| `AGENTS_FORCE_SIGNAL_SYMBOL` | Dev: symbol to force a signal for | `ITC` |
| `AGENTS_EVENT_DRIVEN` | Event-driven LLM trigger (deferred) | `false` |
| `ANALYST_ENABLED` | Enable the LLM analyst pre-trade filter (soft) | `false` |
| `ANALYST_REJECT_THRESHOLD` | Analyst risk score (0-100) above which it blocks | `70` |
| `AVAILABLE_CAPITAL` | Virtual paper capital (INR) | `500000` |
| `MAX_DAILY_DRAWDOWN` | Max realised loss in a day before blocking (INR) | `15000` |
| `MAX_TRADE_ALLOCATION` | Max ticket size for a single trade (INR) | `20000` |
| `MAX_POSITION_WEIGHT_PCT` | Max % of capital a single position may use | `20` |
| `AUTO_TRADE_TICKET_THRESHOLD` | Ticket ≤ this auto-trades; above → Telegram approval | `5000` |
| `MAX_SINGLE_STOCK_PCT` | Max % of total capital a single stock may use | `15` |
| `MIN_CASH_RESERVE_PCT` | Mandatory cash reserve % kept free | `20` |
| `MAX_RISK_PER_TRADE_PCT` | Single-trade risk cap at stop-loss (% of balance) | `1.5` |
| `MAX_SECTOR_WEIGHT_PCT` | Max % of capital a single sector may use | `30` |
| `MAX_PORTFOLIO_DRAWDOWN_PCT` | Halt if the book is down this % of capital | `10` |
| `MAX_MONTHLY_DRAWDOWN_PCT` | Halt for the month if P&L is down this % | `2` |
| `RISK_APPETITE` | `conservative`, `balanced`, or `aggressive` | `balanced` |
| `PAPER_SLIPPAGE_BPS` | Adverse slippage on fills (bps) | `2` |
| `PAPER_BROKERAGE_BPS` | Brokerage as bps of notional | `3` |
| `PAPER_BROKERAGE_MAX` | Per-order brokerage cap (INR; 0 = uncapped) | `20` |
| `PAPER_STATUTORY_BPS` | Combined STT + txn + SEBI + stamp as bps | `10` |
| `PAPER_GST_PCT` | GST as % of brokerage | `18` |
| `OPTIONS_ENABLED` | Turn the options layer on/off | `false` |
| `MAX_OPTION_PREMIUM_PER_TRADE` | Max premium (INR) per option trade | `5000` |
| `MAX_OPTIONS_EXPOSURE` | Max total premium (INR) at risk in open options | `20000` |
| `OPTION_EXPIRY_DAYS` | Days to expiry for bought options | `30` |
| `OPTION_STRIKE_OFFSET_PCT` | Strike offset % toward OTM | `2` |
| `EOD_SQUARE_OFF_ENABLED` | Square off open positions at close | `true` |
| `EOD_SQUARE_OFF_TIME` | Square-off time (IST) | `15:15` |
| `EOD_OVERNIGHT_GAP_RISK_PCT` | Gap-risk threshold for overnight events (%) | `2` |
| `STRATEGY_MODE` | `mean_reversion`, `pullback_trend`, or `breakout` | `mean_reversion` |
| `RSI_ENTRY_THRESHOLD` | Oversold entry RSI | `30` |
| `RSI_EXIT_THRESHOLD` | Overbought exit RSI | `70` |
| `STOP_LOSS_PERCENT` | Stop-loss below entry (%) | `4` |
| `TRADE_COOLDOWN_MINUTES` | Cooldown between trades (min) | `15` |
| `ATR_STOP_MULTIPLIER` | Dynamic stop = entry ± (ATR × multiplier) | `2` |
| `ADX_TREND_THRESHOLD` | ADX below this = ranging (entry regime gate) | `25` |
| `VOLUME_CONFIRM_MULTIPLIER` | Require bar volume ≥ avg × this to enter | `1.5` |
| `CIRCUIT_BREAKER_TRADES` | Halt after this many trades in the window | `3` |
| `CIRCUIT_BREAKER_WINDOW_MINUTES` | Rolling window for the breaker | `30` |
| `CIRCUIT_BREAKER_HALT_MINUTES` | How long entries are halted | `60` |
| `MAX_SIMULTANEOUS_ENTRIES` | Cap on concurrent open positions | `2` |
| `RISK_PER_TRADE_PERCENT` | Risk-per-trade budget (% of capital) | `1` |
| `SKIP_FIRST_MINUTES` | Skip first N minutes of session | `30` |
| `SKIP_LAST_MINUTES` | Skip last N minutes of session | `30` |
| `BAR_INTERVAL_SECONDS` | Seconds per OHLC bar | `60` |
| `DISABLE_TIME_FILTER` | Disable the session time window | `false` |
| `PULLBACK_RSI_ENTRY` | RSI entry for pullback mode | `45` |
| `PULLBACK_FAST_SMA` | Fast SMA for pullback trend | `20` |
| `PULLBACK_SLOW_SMA` | Slow SMA for pullback trend | `50` |
| `BREAKOUT_LOOKBACK` | N-bar high to break above (breakout mode) | `20` |
| `BREAKOUT_TRAIL_ATR_MULT` | ATR trailing-stop multiplier (breakout) | `2` |
| `MIN_RISK_REWARD` | Minimum target/stop reward:risk for an entry | `1.5` |
| `TARGET_ATR_MULTIPLIER` | Target distance as a multiple of ATR | `3` |
| `REGIME_GATING_ENABLED` | Gate entries by detected market regime | `false` |
| `MIN_SIGNAL_CONFIDENCE` | Evidence-based confidence floor (0 = disabled) | `0` |
| `BREAKEVEN_ATR_MULT` | Move stop to breakeven after this many favorable ATRs | `1` |
| `DEEP_OVERSOLD_BUFFER` | RSI buffer below entry that overrides ADX gate | `10` |
| `REGIME_ADAPTIVE` | Auto-select mode from detected regime | `true` |
| `BOLLINGER_ENTRY` | Bollinger mean-reversion entry | `true` |
| `BOLLINGER_PERIOD` | Bollinger lookback period | `20` |
| `BOLLINGER_STD_DEV` | Bollinger standard-deviation width | `2` |
| `BOLLINGER_RSI_ENTRY` | Bollinger RSI oversold entry | `30` |
| `HOLDINGS_PROFIT_TARGET_PCT` | Book partial profit above this unrealized gain % | `8` |
| `HOLDINGS_TARGET_WEIGHT_PCT` | Trim a position above this % of capital | `10` |
| `ORB_ENABLED` | Opening Range Breakout filter | `true` |
| `ORB_MINUTES` | Opening-range window length (min) | `15` |
| `ORB_VOLUME_MULTIPLIER` | Volume multiple to confirm an ORB breakout | `1.5` |
| `KELLY_ENABLED` | Volatility-adjusted Kelly sizing | `false` |
| `KELLY_SCALE` | Fractional-Kelly scale (0..1) | `0.5` |

> **Graceful degradation:** the bot boots with sensible defaults even with no
> credentials, in a degraded "watch/simulation" mode. It only fully engages when
> Kite and/or Telegram are configured. See §18 for keys that **exist in `.env` but
> are not read** by `AppConfig.ts`.

---

## Market data providers (backtest vs live)

The bot keeps **two independent data providers** so you never mix the free
historical source with the real-time live source:

| Setting | Used by | Default | Purpose |
| ------- | ------- | ------- | ------- |
| `BACKTEST_PROVIDER` | backtest harnesses (`test/backtest/…`) | `yahoo` | **Historical only** — fetch candles to test/optimize the strategy |
| `LIVE_PROVIDER` | `src/server/index.ts` | `kite` | **Live** — real-time ticks for paper/real trading |

### Backtest provider (account-free)

```dotenv
BACKTEST_PROVIDER=yahoo
```

- **`yahoo` (default, account-free):** uses Yahoo Finance. **No account, no API
  key, no signup.**
- **`openbb` (account-free):** uses the **OpenBB Platform** — an open-source
  Python server that aggregates many free data sources behind one local REST
  API. Run it once: `pip install "openbb[all]"` then `openbb-api`, and set
  `OPENBB_BASE_URL` (default `http://127.0.0.1:6900`). -- **NOT TESTED THOUGH! PROBABLY FUTURE?**
- **`kite`:** uses real Zerodha Kite history. Requires `KITE_API_KEY` and
  `KITE_ACCESS_TOKEN`.

> ⚠️ **Yahoo caveat:** Yahoo's free historical endpoint is sometimes rate-limited
> or geo-blocked (it may briefly return `Data doesn't exist` / `Too Many
> Requests`). The provider retries automatically with backoff. If it keeps
> failing from your network, switch to `BACKTEST_PROVIDER=kite`. `quote()`
> (delayed prices) is generally more reliable than intraday history.

### Live provider (real-time)

```dotenv
LIVE_PROVIDER=kite
```

- **`kite` (default):** Zerodha Kite websocket — real-time ticks + live history.
  The production choice for paper/real trading. When `PAPER_TRADING=true`, the
  in-process `kite-paper-node` mock provides simulated fills against the same
  provider interface.

> **Rule of thumb:** keep `BACKTEST_PROVIDER=yahoo` (free, no account) and
> `LIVE_PROVIDER=kite`. Backtests run free; live runs need Kite.

---

## 1. Zerodha Kite Connect

The bot talks to Zerodha through the **Kite Connect v3** API. You need an app
registration and a login access token. Note: `npmjs.com` is login-walled for the
SDK docs — use the official GitHub/Kite docs referenced below.

### 1.1 Create a Kite Connect app

1. Go to **<https://developers.kite.trade/apps/>** and sign in with your Zerodha
   account.
2. Click **Create App** and fill in:
   - **App name:** e.g. `MyAutonomousKiteBot`
   - **Redirect URL:** any valid HTTPS URL. The bot itself doesn't use the OAuth
     redirect for paper trading, but the app needs one to be registered.
3. After creation you receive an **API Key** and an **API Secret**.
4. Put them in `.env`:

```dotenv
KITE_API_KEY=your_api_key_here
KITE_API_SECRET=your_api_secret_here
```

### 1.2 Generate your access token

The bot uses a long-lived **access token** (not the refresh flow). Generate it
via the OAuth login flow:

1. Open in a browser:
   ```
   https://kite.trade/connect/login?api_key=YOUR_API_KEY&v=3
   ```
2. Log in and approve. You'll be redirected to your redirect URL with a
   `?request_token=...` parameter. Copy that `request_token`.
3. Exchange it for an access token using your API secret. With the SDK:

```javascript
const { KiteConnect } = require('kiteconnect');
const kc = new KiteConnect({ api_key: 'YOUR_API_KEY' });
kc.generateSession('REQUEST_TOKEN', 'YOUR_API_SECRET')
  .then((res) => {
    console.log('Access token:', res.access_token);
  });
```

> Alternatively use Kite's official **Kite Connect Login** helper tools or a
> library like `kiteconnect-login`. The token is valid for **1 day** by default
> (longer if you configure a token duration in your app settings), so plan to
> refresh it before each trading session.

4. Put it in `.env`:

```dotenv
KITE_ACCESS_TOKEN=your_access_token_here
```

### 1.3 Kite API root

Only change `KITE_ROOT` if you're using a sandbox/proxy. Default:
`https://api.kite.trade`.

### 1.4 How the bot uses Kite

| Capability | SDK method | Used for |
| ---------- | ---------- | -------- |
| Historical candles | `getHistoricalData(instrument_token, interval, from, to)` | Warmup / backtest |
| Instrument master | `getInstruments('NFO')` | Build option chains / resolve tokens |
| Live quotes | `getQuote('NSE:SYMBOL')` | On-demand price checks |
| Real-time ticks | `KiteTicker` websocket | Live signal loop |

**Important SDK quirks (verified):**

- `getHistoricalData` takes **positional arguments**, not a params object:
  `getHistoricalData(instrument_token, interval, from_date, to_date, continuous?, oi?)`.
- `getQuote` / `getLTP` / `getOHLC` use the `exchange:tradingsymbol` format
  (e.g. `NSE:INFY`).
- `KiteTicker.autoReconnect(true, maxRetries, intervalSec)` — the interval is in
  **seconds**; `noreconnect` exits the process automatically after retries are
  exhausted.
- There is **no SDK option-chain method** — chains are built manually by
  filtering `getInstruments('NFO')`.

There is also an optional **Kite MCP** client (`KITE_MCP_ENABLED`, default
`false`; `KITE_MCP_URL`, default `https://mcp.kite.trade/mcp`; `KITE_MCP_TIMEOUT_MS`,
default `5000`) for read-only broker data access.

---

## 2. AI / LLM provider

The AI layer turns news into a **structured sentiment score** used by the
strategy as a confirmation filter (avoid entries into strongly bearish news),
and (optionally) provides an analyst pre-trade verdict.

The bot supports **three LLM providers** — **Ollama**, **LiteLLM**, and **OpenAI**
— plus an explicit **`none`** to disable the LLM entirely. All three expose an
**OpenAI-compatible** API, so the code is provider-agnostic: you only change the
**base URL**, **API key**, and **model**. Provider selection is governed solely by
`LLM_PROVIDER` — the old enable-flag is gone and must not be set.

### 2.1 Choosing a provider

Set `LLM_PROVIDER` to one of `openai`, `ollama`, `litellm`, or `none`.

```dotenv
LLM_PROVIDER=ollama
```

If `LLM_PROVIDER` is **unset**, the loader auto-detects in this order:

1. `ollama` — if any of `OLLAMA_API_KEY` / `OLLAMA_BASE_URL` / `OLLAMA_MODEL` is set
2. `litellm` — if **both** `LITELLM_BASE_URL` and `LITELLM_API_KEY` are set
3. `openai` — if `OPENAI_API_KEY` is set
4. `none` — otherwise (LLM disabled)

### 2.2 Option A — Ollama Cloud (default)

Ollama Cloud hosts large open-weight models on remote hardware, so you get
models like Llama, Qwen, Mistral, Gemma, and DeepSeek without running them
locally. It exposes an OpenAI-compatible endpoint, so the bot talks to it
directly.

**How to get an Ollama Cloud API key:**

1. Sign up / log in at **<https://ollama.com>**.
2. Go to **Settings → API Keys** (or your account menu) and click **Create**.
3. Copy the generated key (it usually starts with something like `ollama_...`).
4. Keep it secret — it's billed to your account.

**Configure it in `.env`:**

```dotenv
LLM_PROVIDER=ollama
OLLAMA_API_KEY=your_ollama_api_key
OLLAMA_BASE_URL=https://ollama.com/v1
OLLAMA_MODEL=llama3.3
OLLAMA_MODELS=llama3.3,qwen2.5,mistral,gemma3
```

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `OLLAMA_API_KEY` | Your Ollama Cloud key. **Optional** for self-hosted Ollama (it accepts any value). | — |
| `OLLAMA_BASE_URL` | The OpenAI-compatible endpoint. Cloud: `https://ollama.com/v1`. Self-hosted: `http://localhost:11434/v1`. | `https://ollama.com/v1` |
| `OLLAMA_MODEL` | The model active at startup. The tag must exist on your account. | `llama3.3` |
| `OLLAMA_MODELS` | Comma-separated models you can choose from. If unset, defaults to the active model only. | derived |

> Ollama defaults `jsonMode` to **false** (some Ollama models reject
> `response_format`); see §2.8.

### 2.3 Option B — LiteLLM (any OpenAI-compatible proxy)

LiteLLM is a proxy that fronts multiple LLM providers under one OpenAI-compatible
endpoint. Use this when you have a corporate LiteLLM deployment.
or want to route through a self-hosted gateway. Setting `LLM_PROVIDER=litellm`
fully disables the Ollama path and routes **all** LLM calls through the LiteLLM
endpoint — there is **no automatic fallback**.

```dotenv
LLM_PROVIDER=litellm
LITELLM_BASE_URL=http://localhost:6655/litellm/v1
LITELLM_API_KEY=your_litellm_key
LITELLM_MODEL=anthropic--claude-sonnet-latest
LITELLM_MODELS=anthropic--claude-sonnet-latest,gemini-2.5-pro,gpt-5.5
LLM_ENSEMBLE_MODELS=anthropic--claude-sonnet-latest,gemini-2.5-pro,gpt-5.5
LLM_FAST_ENSEMBLE_MODELS=anthropic--claude-haiku-latest,anthropic--claude-sonnet-latest
```

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `LITELLM_BASE_URL` | Your LiteLLM proxy base URL. | — |
| `LITELLM_API_KEY` | Your LiteLLM API key. | — |
| `LITELLM_MODEL` | The model active at startup. | `anthropic--claude-sonnet-latest` |
| `LITELLM_MODELS` | Comma-separated models you can choose from. | derived |

> LiteLLM defaults `jsonMode` to **true**; see §2.8.

### 2.4 Option C — OpenAI

1. Go to **<https://platform.openai.com/api-keys>**.
2. Create a key (e.g. `sk-...`).
3. Configure `.env`:

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MODELS=gpt-4o-mini,gpt-4o
```

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `OPENAI_BASE_URL` | The OpenAI-compatible endpoint. | `https://api.openai.com/v1` |
| `OPENAI_API_KEY` | Your OpenAI API key. | — |
| `OPENAI_MODEL` | The model active at startup. | `gpt-4o-mini` |
| `OPENAI_MODELS` | Comma-separated models you can choose from. | derived |

> OpenAI defaults `jsonMode` to **true**; see §2.8.

### 2.5 Shared LLM settings

These apply regardless of provider:

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `LLM_JSON_MODE` | Force strict JSON mode on/off. Overrides the provider default (`true` for openai/litellm, `false` for ollama). | per provider |
| `LLM_TIMEOUT_MS` | Per-request timeout so a hung model can't block the ensemble/run. | `60000` |
| `LLM_ENSEMBLE_MODELS` | CSV subset of `*_MODELS` used by the multi-model ensemble. Entries not in the model list are dropped; always ≤3 and ⊆ models. Falls back to the first 3 models (active first). | first 3 models |
| `LLM_FAST_ENSEMBLE_MODELS` | Same validation as above, for high-frequency loops (e.g. backtests). | first 3 models |

### 2.6 Switching models

There are **two ways** to switch models:

- **At startup (static):** set `OLLAMA_MODEL` / `LITELLM_MODEL` / `OPENAI_MODEL` and restart.
- **Live via Telegram (no restart):**
  - `/models` — list all available models and highlight the active one.
  - `/model <name>` — switch the active model immediately, e.g. `/model qwen2.5`.
  - `/llm <question>` — send a test prompt to the active model and see its
    reply, so you can sanity-check any model before letting it score sentiment.

> Model switches are **in-memory** — they last until the bot restarts. To make a
> switch permanent, update the relevant `*_MODEL` variable in `.env`.

### 2.7 How sentiment is computed

1. **News-first** — the bot pulls recent headlines for each watchlist symbol from
   **Google News RSS** (free, keyless, deterministic) plus optional **TinyFish**
   web search for depth/backfill (see §3).
2. **AI scoring** — headlines are sent to the active LLM with a prompt that asks
   for strict JSON:
   ```json
   { "score": 0.5, "label": "bullish", "summary": "..." }
   ```
   where `score` is a continuous `-1 (bearish)` .. `+1 (bullish)` value.
3. **Fallback** — if no LLM is configured, the bot uses a keyword heuristic
   (bullish/bearish word matching) so sentiment still functions.

The optional **analyst verdict** (`ANALYST_ENABLED`) is a separate soft
pre-trade filter: the LLM returns `AGREE` / `CAUTION` / `AVOID` with a risk score
(0–100); scores above `ANALYST_REJECT_THRESHOLD` (default `70`) block the trade.
The `RiskEngine` remains the hard gate regardless.

### 2.8 JSON mode (`LLM_JSON_MODE`)

The bot asks for strict JSON using the `response_format` parameter. OpenAI and
most cloud models support it. **Some Ollama models reject `response_format`** —
for those the bot automatically retries without it and tolerantly extracts JSON
from the reply (including markdown fences).

- OpenAI and LiteLLM default to `jsonMode = true`; Ollama defaults to `false`.
- Force either way with `LLM_JSON_MODE=true` / `LLM_JSON_MODE=false` (this
  overrides the provider default).

### 2.9 Cost / privacy notes

- Each analysis cycle sends ~1 short prompt per watchlist symbol. With a small
  watchlist this is cheap on any provider.
- Headlines are sent to your chosen provider's API. Do not include any private
  trading data in `data/watchlist.json` beyond public ticker symbols.
- Keep the LLM out of the live tick loop — it runs on the async probe cadence
  (`AGENTS_INTERVAL_MS`), so it never adds latency to trade execution.

### 2.10 TinyFish (live web search) — free

TinyFish gives the AI **live web access** so sentiment isn't limited to Google
News RSS. **Search and Fetch are always free** (no credits). Google News RSS is
always on; TinyFish adds depth and date-scoped backfill.

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `TINYFISH_API_KEY` | TinyFish key. Empty = TinyFish disabled (Google RSS only). | — |
| `TINYFISH_MAX_RESULTS` | Max results per search | `5` |
| `TINYFISH_TIMEOUT_MS` | HTTP timeout per TinyFish call | `15000` |

---

## 3. News feeds

News sourcing is **hard-coded in `src/server/NewsSentimentEngine.ts`** — there is
no env variable to add feeds. Two sources are always available:

1. **Google News RSS** — free, keyless, always-on. For each watchlist symbol the
   engine queries Google News RSS with the symbol name (e.g.
   `https://news.google.com/rss/search?q=INFY+stock&hl=en-IN&gl=IN&ceid=IN:en`)
   and parses the headlines with `rss-parser`.
2. **TinyFish web search** — optional live web-search fallback for depth and
   date-scoped backfill. Enabled by setting `TINYFISH_API_KEY` (see §2.10).

Only items whose **title or snippet mentions a watchlist symbol** are kept
(case-insensitive), so results are scoped to the ticker. Articles are
de-duplicated by title and capped per symbol per cycle.

> **News-first philosophy:** the LLM is used only to *score* the headlines, not
> to discover them. The primary signal stays deterministic and keyless.

---

## 4. Telegram (human-in-the-loop)

Telegram is the approval + notification bridge. It's the backbone of the
**HITL** design.

### 4.1 Create a bot

1. Message **@BotFather** on Telegram.
2. `/newbot` → choose a name and username. BotFather returns a **token**.
3. Put the token in `.env`:

```dotenv
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
```

### 4.2 Find your chat id

1. Message your bot once (any text).
2. Open in a browser:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
3. Find `"chat": { "id": 123456789, ... }` in the response. That numeric value is
   your `TELEGRAM_CHAT_ID`.

```dotenv
TELEGRAM_CHAT_ID=123456789
```

### 4.3 Behaviour

- **Notifications:** fills, risk blocks, sentiment briefs, and status are sent
  to your chat.
- **Approval flow:** when a trade's ticket size exceeds
  `AUTO_TRADE_TICKET_THRESHOLD`, the bot sends an approve/reject prompt. Reply
  `approve`/`yes`/`ok` or `reject`/`no`/`cancel` within a short window.
- **Commands:**
  - `/stop` — kill-switch, gracefully stops the bot.
  - `/status` — current state + watchlist + active LLM model.
  - `/models` — list available LLM models (highlights the active one).
  - `/model <name>` — switch the active LLM model live.
  - `/llm <question>` — test the active LLM model and see its reply.
- Telegram is **enabled automatically** when both `TELEGRAM_BOT_TOKEN` and
  `TELEGRAM_CHAT_ID` are present. If either is missing, trades auto-approve in
  paper mode (still gated by `RiskEngine`).

---

## 5. Notification system

All bot messages flow through `NotificationService` (`src/server/NotificationService.ts`).
Every notification is **persisted to the `notifications` SQLite table** with a
severity level, title, body, and optional structured metadata. If Telegram is
enabled, the message is also forwarded to your chat.

### 5.1 How it works

- **DB-first:** every notification is written to SQLite regardless of Telegram
  status. This gives you a complete, queryable audit trail.
- **Telegram optional:** if `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set,
  notifications are also forwarded to Telegram. If either is empty, the bot
  runs silently with all notifications in the database only.
- **Severity levels:** e.g. `INFO`, `WARN`, `ERROR`, `TRADE`, `APPROVAL`,
  `SENTIMENT`. Each maps to a distinct icon in Telegram and is filterable in SQL.

### 5.2 Querying notifications

```sql
-- Recent 50 notifications
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50;

-- Count by severity today
SELECT severity, COUNT(*) FROM notifications
 WHERE created_at >= date('now') GROUP BY severity;

-- All trade fills
SELECT * FROM notifications WHERE severity = 'TRADE' ORDER BY created_at DESC;
```

### 5.3 Disabling Telegram entirely

Leave `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` empty in `.env`. The bot will
boot with Telegram disabled and all notifications go to SQLite only. The
interactive approval flow is also disabled — trades auto-approve (still gated
by `RiskEngine`).

---

## 6. Logging (pino)

The bot uses **pino** — the fastest Node.js structured logger. Every component
emits JSON-structured log entries with contextual metadata.

### 6.1 Log levels

Set `LOG_LEVEL` in `.env`:

| Level | What you see |
| ----- | ------------ |
| `trace` | Everything — tick-by-tick, every DB write |
| `debug` | Strategy decisions, cooldown skips, migration skips |
| `info` | Startup/shutdown, warmup, connections, trade fills (default) |
| `warn` | Recoverable issues (API retries, degraded services) |
| `error` | Failures that need attention |
| `fatal` | Process-crashing errors only |

### 6.2 Output format

- **Development** (`NODE_ENV != production`): pretty-printed with colours and
  timestamps via `pino-pretty`.
- **Production** (`NODE_ENV=production`): newline-delimited JSON for ingestion
  by log aggregators (Datadog, Grafana Loki, ELK, etc.).

---

## 7. Database schema & migrations

The bot uses a **normalized SQLite schema** managed by a custom migration runner
(`src/server/MigrationRunner.ts`) — a lightweight Liquibase equivalent. The full
list of tables is created by the migrations under `migrations/`.

### 7.1 Tables

Key tables (current, per `migrations/`):

| Table | Purpose |
| ----- | ------- |
| `instruments` | Normalized instrument reference (token, symbol, exchange, lot size) |
| `watchlist` | Which instruments are actively traded |
| `candles` | Historical OHLC data (for warmup/backtesting) |
| `ticks` | Real-time tick archive |
| `signals` | Every strategy signal (RSI, sentiment, reason) |
| `risk_events` | Audit trail of every risk gate decision |
| `orders` | Paper order records |
| `order_intents` | Proposed order intents |
| `positions` | Open/closed positions with realized PnL |
| `trades` | Filled trades (fills) |
| `notifications` | All bot messages (DB-first, Telegram optional) |
| `daily_summary` | Per-day performance (win rate, drawdown, PnL) |
| `daily_reports` | Generated daily report documents |
| `sessions` | Trading session lifecycle |
| `health_checks` | Component health heartbeat |
| `config_audit` | Configuration change tracking |
| `strategy_params` | Stored strategy parameters |
| `llm_traces` | LLM request/response traces |
| `probe_runs` | Agent probe run records |
| `agent_proposals` | Proposed trades from the agent runtime |
| `news_articles` | Cached news articles |
| `news_backfill` | News backfill tracking |
| `bot_state` | Bot runtime state |
| `option_fills` / `option_positions` | Options-layer records |
| `overnight_matrix` / `eod_performance` | End-of-day layer records |
| `reconciliation_log` | Broker reconciliation audit |
| `tax_accrual` | Tax accrual records |
| `schema_migrations` | Migration version tracking |

### 7.2 How migrations work

1. Migration files live in `migrations/` and are named `V{NNN}__{description}.sql`.
2. On startup, `MigrationRunner` reads all `.sql` files, sorted by version.
3. It checks `schema_migrations` to see which are already applied (matched by
   version + checksum).
4. Pending migrations run inside a transaction and are recorded with their
   SHA-256 checksum and execution time.
5. Migrations are **idempotent** by convention (use `CREATE TABLE IF NOT EXISTS`).

### 7.3 Adding a new migration

```bash
# Create a new migration file
touch migrations/V015__add_new_feature.sql
```

Write your DDL (use `IF NOT EXISTS` / `IF EXISTS` for idempotency), then
restart the bot. The runner picks it up automatically.

### 7.4 Auto-bootstrap

The database and all tables are created automatically on first run — **zero
manual setup**. The `data/` directory and `data/ledger.db` file are created if
they don't exist, and all tables are created by the initial migrations.

---

## 8. Quantitative risk configuration

These are the **hard guardrails** in `src/server/RiskEngine.ts`. The AI/strategy
can **never** override them.

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `AVAILABLE_CAPITAL` | Total virtual capital (INR). Sum of ticket sizes of open positions + the proposed trade must be ≤ this. | `500000` |
| `MAX_DAILY_DRAWDOWN` | Max realised loss in a single day (INR). Once exceeded, new trades are blocked until reset. | `15000` |
| `MAX_TRADE_ALLOCATION` | Max ticket size for any single trade (INR). | `20000` |
| `MAX_POSITION_WEIGHT_PCT` | Max % of available capital a single position may use (diversification). | `20` |
| `AUTO_TRADE_TICKET_THRESHOLD` | Trades with ticket ≤ this execute automatically; above → Telegram approval. | `5000` |
| `MAX_SINGLE_STOCK_PCT` | Max % of total portfolio capital a single stock may use. | `15` |
| `MIN_CASH_RESERVE_PCT` | Mandatory cash reserve % of total capital kept free for liquidity. | `20` |
| `MAX_RISK_PER_TRADE_PCT` | Single-trade risk cap: max % of total account balance at stop-loss. | `1.5` |
| `MAX_SECTOR_WEIGHT_PCT` | Max % of total capital a single sector may use. | `30` |
| `MAX_PORTFOLIO_DRAWDOWN_PCT` | Portfolio-level guard: halt trading if the book is down this % of capital. | `10` |
| `MAX_MONTHLY_DRAWDOWN_PCT` | Monthly guard: halt for the month if monthly P&L is down this % of capital. | `2` |
| `RISK_APPETITE` | Risk appetite guiding the LLM advisor + algo sizing: `conservative`, `balanced`, or `aggressive`. Any other value maps to `balanced`. | `balanced` |

Example for a ₹5,00,000 account risking modestly:

```dotenv
AVAILABLE_CAPITAL=500000
MAX_DAILY_DRAWDOWN=15000
MAX_TRADE_ALLOCATION=20000
AUTO_TRADE_TICKET_THRESHOLD=5000
```

> All monetary values are in **INR**. Percentages are of total capital unless
> noted otherwise.

---

## 9. Paper trading costs (realism)

The paper trader applies realistic frictions to every simulated fill so paper
PnL is not optimistically clean:

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `PAPER_SLIPPAGE_BPS` | Adverse slippage on fills (basis points) | `2` |
| `PAPER_BROKERAGE_BPS` | Brokerage as bps of notional | `3` |
| `PAPER_BROKERAGE_MAX` | Per-order brokerage cap (INR; 0 = uncapped) | `20` |
| `PAPER_STATUTORY_BPS` | Combined STT + txn + SEBI + stamp as bps | `10` |
| `PAPER_GST_PCT` | GST as % of brokerage | `18` |

---

## 10. Strategy tuning

These tune the strategy in `src/server/MarketAgent.ts`. The strategy has **three
modes**, selected via `STRATEGY_MODE`:

| Mode | Entry idea | Best for |
| ---- | -------- | -------- |
| `mean_reversion` (default) | RSI(14) < entry threshold (oversold) | ranging markets |
| `pullback_trend` | RSI dips below `PULLBACK_RSI_ENTRY` in an uptrend (fast SMA > slow SMA) | trending blue-chips |
| `breakout` | price breaks above a prior N-bar high | trending stocks, **daily bars** |

> `REGIME_ADAPTIVE` (default `true`) auto-selects the mode from the detected
> market regime instead of fixing a single mode. With it on, `STRATEGY_MODE` is
> the starting/default mode and the engine may switch based on regime.

### 10.1 Core entry / exit

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `RSI_ENTRY_THRESHOLD` | Enter long when RSI(14) drops **below** this (oversold). | `30` |
| `RSI_EXIT_THRESHOLD` | Exit when RSI(14) rises **above** this (overbought). | `70` |
| `TRADE_COOLDOWN_MINUTES` | Min minutes between opening trades. **Immutable gate** — AI cannot override. | `15` |
| `PULLBACK_RSI_ENTRY` | RSI entry for `pullback_trend` mode. | `45` |
| `PULLBACK_FAST_SMA` | Fast SMA for pullback trend detection. | `20` |
| `PULLBACK_SLOW_SMA` | Slow SMA for pullback trend detection. | `50` |
| `BREAKOUT_LOOKBACK` | N-bar high to break above (`breakout` mode). | `20` |
| `BREAKOUT_TRAIL_ATR_MULT` | ATR trailing-stop multiplier (`breakout` mode). | `2` |

### 10.2 Volatility-adaptive risk

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `STOP_LOSS_PERCENT` | Hard cap on stop distance (% below entry for longs). The ATR stop is never wider than this. | `4` |
| `ATR_STOP_MULTIPLIER` | Dynamic stop = entry ± (ATR × multiplier). ATR(14) adapts to volatility. | `2` |
| `RISK_PER_TRADE_PERCENT` | Risk-per-trade budget (% of capital) used to size quantity, capped at the watchlist quantity. | `1` |
| `BAR_INTERVAL_SECONDS` | Ticks accumulated into one OHLC bar for ADX/ATR (60s ≈ 1-min bar). | `60` |
| `MIN_RISK_REWARD` | Minimum target/stop reward:risk for an entry. | `1.5` |
| `TARGET_ATR_MULTIPLIER` | Target distance as a multiple of ATR: `target = stopDist × targetAtrMultiplier / atrStopMultiplier`. | `3` |
| `BREAKEVEN_ATR_MULT` | Move the stop to breakeven once price moves favorably by this many ATRs. | `1` |
| `KELLY_ENABLED` | Volatility-adjusted Kelly sizing (bounded by the hard risk caps). | `false` |
| `KELLY_SCALE` | Fractional-Kelly scale (0..1) — safer than full Kelly. | `0.5` |

### 10.3 Regime & confirmation filters

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `ADX_TREND_THRESHOLD` | Only take entries when ADX(14) is **below** this (ranging market). Skips trending markets where mean-reversion fails. Use 25–30. | `25` |
| `VOLUME_CONFIRM_MULTIPLIER` | Require current bar volume ≥ average × this before entering. Set to 0/1 to disable. | `1.5` |
| `MAX_SIMULTANEOUS_ENTRIES` | Cap on concurrent open positions (correlation/concentration risk). | `2` |
| `REGIME_GATING_ENABLED` | Only trade when the regime suits the active strategy mode. | `false` |
| `REGIME_ADAPTIVE` | Auto-select the strategy mode from the detected market regime (replaces single-mode). | `true` |
| `MIN_SIGNAL_CONFIDENCE` | Minimum evidence-based signal confidence (0–1) to propose a trade (0 = disabled). | `0` |
| `DEEP_OVERSOLD_BUFFER` | RSI buffer below the entry threshold that overrides the ADX regime filter. | `10` |

### 10.4 Bollinger mean-reversion entry

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `BOLLINGER_ENTRY` | Buy close < lower band + RSI oversold; exit at middle band. | `true` |
| `BOLLINGER_PERIOD` | Bollinger lookback period. | `20` |
| `BOLLINGER_STD_DEV` | Bollinger standard-deviation width. | `2` |
| `BOLLINGER_RSI_ENTRY` | Bollinger RSI oversold entry. | `30` |

### 10.5 Opening Range Breakout (ORB)

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `ORB_ENABLED` | Gate entries on the first-N-min opening range. | `true` |
| `ORB_MINUTES` | Length of the opening-range window (15–30). | `15` |
| `ORB_VOLUME_MULTIPLIER` | Volume multiple required to confirm an ORB breakout. | `1.5` |

### 10.6 Holdings review

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `HOLDINGS_PROFIT_TARGET_PCT` | Book partial profit above this unrealized gain %. | `8` |
| `HOLDINGS_TARGET_WEIGHT_PCT` | Trim a position above this % of capital (rebalance). | `10` |

### 10.7 LLM analyst verdict

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `ANALYST_ENABLED` | Enable the LLM analyst pre-trade filter (soft; `RiskEngine` stays the hard gate). | `false` |
| `ANALYST_REJECT_THRESHOLD` | Risk score (0–100) above which the analyst blocks the trade. | `70` |

### 10.8 Circuit breaker & session timing

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `CIRCUIT_BREAKER_TRADES` | If this many trades occur within the window, halt entries. | `3` |
| `CIRCUIT_BREAKER_WINDOW_MINUTES` | Rolling window for the circuit breaker count. | `30` |
| `CIRCUIT_BREAKER_HALT_MINUTES` | How long entries are halted after tripping. | `60` |
| `SKIP_FIRST_MINUTES` | Skip the first N minutes of the session (noisy open). 0 = off. | `30` |
| `SKIP_LAST_MINUTES` | Skip the last N minutes of the session (noisy close). 0 = off. | `30` |
| `DISABLE_TIME_FILTER` | Disable the session time window. | `false` |

### 10.9 Options layer (SAFE, switchable)

Options are inherently risky (leverage + theta decay). This layer is **safe by
design** and **fully switchable** via `OPTIONS_ENABLED` (default **OFF**).

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `OPTIONS_ENABLED` | Turn the options layer on/off | `false` |
| `MAX_OPTION_PREMIUM_PER_TRADE` | Max premium (₹) per option trade | `5000` |
| `MAX_OPTIONS_EXPOSURE` | Max total premium (₹) at risk across open options | `20000` |
| `OPTION_EXPIRY_DAYS` | Days to expiry for bought options | `30` |
| `OPTION_STRIKE_OFFSET_PCT` | Strike offset % toward OTM | `2` |

**How it works (safe by design):**
- **Buys options only** — defined risk = premium paid; max loss is the premium.
- **Priced via Black-Scholes** — realistic premium, not a guess.
- **Enforces caps** — a trade is blocked if it exceeds the per-trade premium cap
  or the total exposure cap.

> ⚠️ **Options are still risky.** Even with caps, options can lose the full
> premium. Keep `OPTIONS_ENABLED=false` until you're comfortable with the
> equity strategy, then enable it with modest caps.

---

## 11. Agent probes

The agent runtime (`src/server/AgentsRuntime.ts`) runs scheduled **probes** that
assemble market context, propose trades, and route them through the AI authority
model and risk engine. It is **OFF by default** (`AGENTS_ENABLED=false`).

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `AGENTS_ENABLED` | Enable the agent probe runtime. | `false` |
| `AGENTS_INTERVAL_MS` | Probe cadence. | `600000` (10 min) |
| `AGENTS_PROBE_PRE_OPEN` | Pre-open probe time (IST). Market opens 09:15 IST, so 09:00 is genuinely before the open. | `09:00` |
| `AGENTS_PROBE_MID_SESSION` | Mid-session probe time (IST). | `11:00` |
| `AGENTS_PROBE_PRE_CLOSE` | Pre-close probe time (IST). | `15:15` |
| `AGENTS_PROBE_ALWAYS` | Dev: run the probe immediately on every start, regardless of IST time. | `false` |
| `AGENTS_FORCE_SIGNAL` | Dev: force the strategist to propose a trade (test hook). | `false` |
| `AGENTS_FORCE_SIGNAL_SYMBOL` | Dev: symbol to force a signal for. | `ITC` |
| `AGENTS_EVENT_DRIVEN` | Event-driven LLM trigger (breaking-news listener) — deferred, OFF by default. | `false` |

---

## 12. End-of-day (EOD) layer

The EOD layer (`src/server/EodEngine.ts`) squares off positions and guards
against overnight gap risk from known events.

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `EOD_SQUARE_OFF_ENABLED` | Square off open positions at the close. | `true` |
| `EOD_SQUARE_OFF_TIME` | Square-off time (IST). | `15:15` |
| `EOD_OVERNIGHT_GAP_RISK_PCT` | Gap-risk threshold (%) for holding through an overnight event. | `2` |

Upcoming overnight events are loaded from `data/overnight_events.json`
(`{ "events": [{ "date": "...", "event": "..." }] }`) and combined with the
gap-risk threshold to decide whether to hold or square off ahead of an event.

---

## 13. Watchlist file

The symbols the bot trades are defined in **`data/watchlist.json`** (path
overridable with `WATCHLIST_FILE`; base directory with `DATA_DIR`):

```json
{
  "symbols": [
    { "tradingsymbol": "INFY", "exchange": "NSE", "quantity": 50, "enabled": true }
  ]
}
```

| Field | Meaning |
| ----- | ------- |
| `tradingsymbol` | NSE ticker, e.g. `INFY`, `RELIANCE`. |
| `exchange` | Exchange segment (default `NSE` for equities). |
| `quantity` | Number of shares paper-traded on an entry. |
| `enabled` | `true` = actively traded; `false` = paused. |

> Quantities are **per entry**. The strategy will size every entry using this
> quantity and the live price. If the file is missing/unreadable, the loader
> logs a warning and returns an empty list (no crash).

---

## 14. Verifying each piece works

Run `npm run dev` and watch the startup log. Then confirm:

| Capability | How to verify |
| ---------- | ------------- |
| Config loading | Startup banner prints watchlist count, capital, Telegram/Kite/LLM status. |
| DB migrations | `Migration applied` log lines; `data/ledger.db` created with all tables. |
| Kite history | Warmup log lines per symbol (needs valid token + market data access). |
| Ticker | `Ticker connected, subscribing` log (during market hours). |
| News / sentiment | Sentiment briefs appear in `notifications` (and Telegram if enabled). |
| LLM connection | In Telegram run `/llm` and `/models`; confirm the active model responds. |
| Risk engine | `Risk blocked trade` notifications; `risk_events` table entries. |
| HITL | Approve/reject prompts for large tickets (Telegram only). |
| Persistence | `data/ledger.db` grows; query `notifications`, `trades`, `signals` tables. |
| Daily summary | On shutdown, `daily_summary` is populated with the day's stats. |
| Health checks | `health_checks` table gets entries periodically. |

---

## 15. Troubleshooting

| Symptom | Likely cause / fix |
| ------- | ------------------ |
| `better-sqlite3` build fails on `npm install` | Native module. Run install without sandbox/CI restrictions, or `npm rebuild better-sqlite3`. |
| Warmup skipped / no indicators | `KITE_API_KEY`/`KITE_ACCESS_TOKEN` missing or token expired. Refresh via the login flow (§1.2). |
| `Ticker closed` / reconnect loop | Token expired or network blocked. Refresh token; check the ticker's `noreconnect` log. |
| No Telegram messages | Bot token or chat id wrong, or you haven't messaged the bot. Check `getUpdates`. |
| No sentiment / heuristic used | No LLM configured (no `*_API_KEY` and `LLM_PROVIDER` auto-detects `none`); the keyword fallback is active by design. |
| `/llm` reports a connection error | Wrong `*_BASE_URL`, missing `*_API_KEY`, or invalid model name. Check §2 and run `/models`. |
| `/model` says unknown model | The name isn't in the active provider's `*_MODELS`. Add it to `.env` and restart. |
| LLM returns non-JSON / falls back to heuristic | Some models reject `response_format`; set `LLM_JSON_MODE=false` or use a JSON-capable model. |
| DB file not created | `data/` directory must be writable. Check filesystem permissions. |
| Migration fails | Check `schema_migrations` table for the last applied version; fix the SQL and restart. |
| "Trade in cooldown" repeatedly | `TRADE_COOLDOWN_MINUTES` window since last fill hasn't elapsed. |
| `Risk blocked trade` | A limit (`MAX_DAILY_DRAWDOWN`, `MAX_TRADE_ALLOCATION`, capital) is exceeded — expected behaviour. |

---

## 16. UI / dashboard

The dashboard/API server (`src/server/api/server.ts`) exposes the web UI:

| Env | Default | Meaning |
| --- | --- | --- |
| `UI_PORT` | `3000` | Dashboard/API port |
| `UI_HOST` | `0.0.0.0` | Bind host |
| `UI_API_TARGET` | `http://localhost:3000` | Vite dev proxy target |

---

## 17. Walk-forward validation (script)

The walk-forward / backtest harnesses (`test/backtest/backtest.ts`, `walk_forward.ts`,
`ab_compare.ts`) read their own tuning knobs (not `AppConfig.ts`):

| Env | Default | Meaning |
| --- | --- | --- |
| `BACKTEST_INTERVAL` | `day` | Bar interval for the backtest |
| `BACKTEST_DAYS` | `400` | Lookback window |
| `BACKTEST_WARMUP_BARS` | `60` | Leading warm-up bars (excluded from eval) |
| `BACKTEST_FOLD_BARS` | `50` | Out-of-sample fold size |
| `BACKTEST_MAX_ALLOCATION` | `20000` | Per-trade notional cap (concentration guard) |

---

## 18. Momentum & live-trading keys (present in `.env`, NOT yet read)

> ⚠️ **Read this carefully.** The `.env` file ships with momentum and live-order
> keys (e.g. `MOMENTUM_TOP_N`, `MOMENTUM_HYSTERESIS_BAND`, `EVENT_BLACKOUT_DAYS`,
> `MAX_LIVE_ORDER_VALUE`). **`AppConfig.ts` does NOT read any of these keys today.**
> They have **no effect** on the running bot, and this section does **not** list
> defaults for them (that would be inventing behavior that isn't wired up).

These keys exist in `.env` because the **momentum/live engine** — `MomentumStrategy`,
`LiveTrader`, `OrderGuard`, `Reconciler`, `StrategyOptimizer`, `StrategyAdaptation`
— is **designed but not wired in**. It is not imported by `src/server/index.ts`
and the tree does **not** currently type-check (49 TypeScript errors, mostly
momentum config fields referenced by `StrategyOptimizer.ts` that `AppConfig`
doesn't provide). Concretely:

- The momentum keys present in `.env` (`MOMENTUM_*`, `EVENT_BLACKOUT_*`,
  `MAX_LIVE_ORDER_VALUE`) are **ignored** by the loader.
- `ALLOW_LIVE_ORDERS` and `LIVE_SHADOW_MODE` appear only as a **comment** in
  `.env`; they are not set and not read. The bot is **paper-only** — there is no
  live execution path wired into `index.ts`.
- Until the momentum/live engine is wired in and compiles, treat anything that
  documents these keys as **aspirational**, not current behaviour. The config
  that actually works is the set in §Environment variables overview above.

Do **not** rely on these keys to change trading behaviour today. If you need a
key documented here to actually take effect, it must first be added to
`AppConfig.ts` (and the strategy/risk code that consumes it).

---

*See also the architecture overview and quick start in the root `README.md`, and
`docs/CAPABILITIES.md` / `docs/STRATEGIES_TECHNIQUES.md` for design notes on the
not-yet-wired momentum & live layers.*

---
