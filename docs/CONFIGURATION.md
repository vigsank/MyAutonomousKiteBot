# Configuration Guide — My Autonomous Kite Vault

This document walks through **every configurable entity** in the bot, from
obtaining credentials to tuning the strategy. Most configuration lives in
environment variables (loaded from `.env`). A few things live in JSON files
(`data/watchlist.json`).

---

## Table of contents

1. [Environment variables overview](#environment-variables-overview)
2. [Zerodha Kite Connect](#1-zerodha-kite-connect)
3. [AI / LLM provider (OpenAI or Ollama Cloud)](#2-ai--llm-provider-openai-or-ollama-cloud)
4. [RSS news feeds](#3-rss-news-feeds)
5. [Telegram (human-in-the-loop)](#4-telegram-human-in-the-loop)
6. [Notification system](#5-notification-system)
7. [Logging (pino)](#6-logging-pino)
8. [Database schema & migrations](#7-database-schema--migrations)
9. [Quantitative risk configuration](#8-quantitative-risk-configuration)
10. [Strategy tuning](#9-strategy-tuning)
11. [Watchlist file](#10-watchlist-file)
12. [Verifying each piece works](#11-verifying-each-piece-works)
13. [Troubleshooting](#12-troubleshooting)

---

## Environment variables overview

All values are read from `.env` (see `.env.example`). The bot loads them at
startup via `dotenv` in `src/server/AppConfig.ts`. **Never commit `.env`** — it is
git-ignored.

| Variable | Purpose | Default |
| -------- | ------- | ------- |
| `KITE_API_KEY` | Zerodha app API key | — |
| `KITE_API_SECRET` | Zerodha app API secret | — |
| `KITE_ACCESS_TOKEN` | Your login access token | — |
| `KITE_ROOT` | Kite API base URL | `https://api.kite.trade` |
| `BACKTEST_PROVIDER` | Historical source: `yahoo` (free), `openbb` (free), or `kite` | `yahoo` |
| `LIVE_PROVIDER` | Real-time source: `kite` | `kite` |
| `OPENBB_BASE_URL` | OpenBB local REST API base (when `BACKTEST_PROVIDER=openbb`) | `http://127.0.0.1:6900` |
| `LOG_LEVEL` | Pino log level: trace/debug/info/warn/error/fatal | `info` |
| `LLM_PROVIDER` | LLM provider: `openai` or `ollama` (auto-detect if unset) | `auto` |
| `OLLAMA_API_KEY` | Ollama Cloud API key | — |
| `OLLAMA_BASE_URL` | Ollama OpenAI-compatible endpoint | `https://ollama.com/v1` |
| `OLLAMA_MODEL` | Active Ollama model | `llama3.3` |
| `OLLAMA_MODELS` | Comma-separated Ollama models to switch between | — |
| `OPENAI_API_KEY` | OpenAI key for sentiment | — |
| `OPENAI_BASE_URL` | OpenAI-compatible endpoint | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Active OpenAI model | `gpt-4o-mini` |
| `OPENAI_MODELS` | Comma-separated OpenAI models to switch between | — |
| `LLM_JSON_MODE` | Force strict JSON mode on/off (provider-specific default) | auto |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (leave empty to disable Telegram) | — |
| `TELEGRAM_CHAT_ID` | Your chat id | — |
| `AVAILABLE_CAPITAL` | Virtual paper capital (INR) | `500000` |
| `MAX_DAILY_DRAWDOWN` | Max daily loss before halt (INR) | `5000` |
| `MAX_TRADE_ALLOCATION` | Max capital per trade (INR) | `20000` |
| `AUTO_TRADE_TICKET_THRESHOLD` | Ticket size for auto-trade (INR) | `5000` |
| `RSI_ENTRY_THRESHOLD` | Oversold entry RSI | `30` |
| `RSI_EXIT_THRESHOLD` | Overbought exit RSI | `70` |
| `STOP_LOSS_PERCENT` | Stop-loss below entry (%) | `4` |
| `TRADE_COOLDOWN_MINUTES` | Cooldown between trades (min) | `15` |

> **Graceful degradation:** the bot boots with sensible defaults even with no
> credentials, in a degraded "watch/simulation" mode. It only fully engages when
> Kite and/or Telegram are configured.

---

## Market data providers (backtest vs live)

The bot keeps **two independent data providers** so you never mix the free
historical source with the real-time live source:

| Setting | Used by | Default | Purpose |
| ------- | ------- | ------- | ------- |
| `BACKTEST_PROVIDER` | `backtest.ts`, `optimize.ts` | `yahoo` | **Historical only** — fetch candles to test/optimize the strategy |
| `LIVE_PROVIDER` | `index.ts` | `kite` | **Live** — real-time websocket ticks for paper/real trading |

### Backtest provider (account-free)

```dotenv
BACKTEST_PROVIDER=yahoo
```

- **`yahoo` (default, account-free):** uses Yahoo Finance. **No account, no API
  key, no signup.** Great for running `npm run backtest` and `npm run optimize`
  with zero setup.
- **`openbb` (account-free):** uses the **OpenBB Platform** — an open-source
  Python server that aggregates many free data sources behind one local REST
  API. Run it once: `pip install "openbb[all]"` then `openbb-api`, and set
  `OPENBB_BASE_URL` (default `http://127.0.0.1:6900`).
- **`kite`:** uses real Zerodha Kite history. Requires `KITE_API_KEY` and
  `KITE_ACCESS_TOKEN`. Use this if you want Kite's exact data / deeper intraday
  history.

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
  The production choice for paper/real trading.

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
   - **App name:** e.g. `MyAutonomousKiteVault`
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

### 1.4 How the bot uses Kite (read-only)

| Capability | SDK method | Used for |
| ---------- | ---------- | -------- |
| Historical candles | `getHistoricalData(instrument_token, interval, from, to)` | RSI warmup |
| Instrument master | `getInstruments('NFO')` | Build option chains / resolve tokens |
| Live quotes | `getQuote('NSE:SYMBOL')` | On-demand price checks |
| Real-time ticks | `KiteTicker` websocket | 3s signal loop |
| Real orders | *(not called in v1)* | Reserved for v2 |

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

---

## 2. AI / LLM provider (OpenAI or Ollama Cloud)

The AI layer turns news into a **structured sentiment score** used by the
strategy as a confirmation filter (avoid entries into strongly bearish news).

The bot supports **two LLM providers** — **OpenAI** and **Ollama Cloud** — and
uses the same OpenAI-compatible API for both. This means the code is
provider-agnostic: you only change the **base URL**, **API key**, and **model**.

### 2.1 Choosing a provider

Set `LLM_PROVIDER` explicitly, or let the bot auto-detect:

```dotenv
LLM_PROVIDER=ollama   # or: openai
```

If `LLM_PROVIDER` is unset, the bot auto-detects: if any `OLLAMA_*` variable is
set it picks `ollama`; otherwise if `OPENAI_API_KEY` is set it picks `openai`.

### 2.2 Option A — Ollama Cloud (recommended)

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

| Variable | Meaning |
| -------- | ------- |
| `OLLAMA_API_KEY` | Your Ollama Cloud key. **Optional** for self-hosted Ollama (it accepts any value). |
| `OLLAMA_BASE_URL` | The OpenAI-compatible endpoint. Cloud: `https://ollama.com/v1`. Self-hosted: `http://localhost:11434/v1`. Check your Ollama dashboard if yours differs. |
| `OLLAMA_MODEL` | The model active at startup. The tag must exist on your account. |
| `OLLAMA_MODELS` | Comma-separated models you can switch between at runtime. |

> **Self-hosted alternative:** if you run Ollama locally, set
> `OLLAMA_BASE_URL=http://localhost:11434/v1` and you can use a dummy
> `OLLAMA_API_KEY` (e.g. `ollama`).

### 2.3 Option B — OpenAI

1. Go to **<https://platform.openai.com/api-keys>**.
2. Create a key (e.g. `sk-...`).
3. Configure `.env`:

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MODELS=gpt-4o-mini,gpt-4o
```

### 2.4 Switching models

There are **two ways** to switch models:

- **At startup (static):** set `OLLAMA_MODEL` / `OPENAI_MODEL` and restart.
- **Live via Telegram (no restart):**
  - `/models` — list all available models and highlight the active one.
  - `/model <name>` — switch the active model immediately, e.g. `/model qwen2.5`.
  - `/llm <question>` — send a test prompt to the active model and see its
    reply, so you can sanity-check any model before letting it score sentiment.

> Model switches are **in-memory** — they last until the bot restarts. To make a
> switch permanent, update `OLLAMA_MODEL` / `OPENAI_MODEL` in `.env`.

### 2.5 How sentiment is computed

1. **RSS-first** — the bot pulls recent headlines for each watchlist symbol from
   curated Indian financial feeds (see next section). No API keys, deterministic.
2. **AI scoring** — headlines are sent to the active LLM with a prompt that asks
   for strict JSON:
   ```json
   { "score": 0.5, "label": "bullish", "summary": "..." }
   ```
   where `score` is a continuous `-1 (bearish)` .. `+1 (bullish)` value.
3. **Fallback** — if no LLM is configured, the bot uses a keyword heuristic
   (bullish/bearish word matching) so sentiment still functions.

The score is cached per symbol and refreshed on a **10-minute cadence**
(`NEWS_INTERVAL_MS` in `src/server/MarketAgent.ts`).

### 2.6 JSON mode (`LLM_JSON_MODE`)

The bot asks for strict JSON using the `response_format` parameter. OpenAI and
most cloud models support it. **Some Ollama models reject `response_format`** —
for those the bot automatically retries without it and tolerantly extracts JSON
from the reply (including markdown fences).

- OpenAI defaults to `jsonMode = true`; Ollama defaults to `false`.
- Force either way with `LLM_JSON_MODE=true` / `LLM_JSON_MODE=false`.

### 2.7 Cost / privacy notes

- Each 10-min cycle sends ~1 short prompt per watchlist symbol. With a small
  watchlist this is cheap on either provider.
- Headlines are sent to your chosen provider's API. Do not include any private
  trading data in `data/watchlist.json` beyond public ticker symbols.
- Keep the LLM out of the live tick loop — it runs only on the async 10-min
  analysis cadence, so it never adds latency to trade execution.

### 2.8 Tavily (live web search) — optional

Tavily gives the AI **live web access** so sentiment isn't limited to the curated
RSS feeds. It is **fully optional** — leave `TAVILY_API_KEY` empty to keep
RSS-only with zero behavior change.

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `TAVILY_API_KEY` | Tavily key (free tier ~1000 credits/mo). Empty = disabled. | — |
| `TAVILY_MAX_RESULTS` | Max results per search | `5` |
| `TAVILY_SEARCH_DEPTH` | `basic` or `advanced` | `basic` |

**How it's used:**
- **Sentiment (10-min loop):** `fetchArticles` merges **RSS + Tavily** headlines
  before the LLM scores them — fresher, broader sentiment.
- **Details (5-min loop):** `runTavilyDetailLoop` pulls deeper Tavily results
  (with an AI answer) for each symbol and notifies.

> ⚠️ **Credit budget:** the free tier is ~1000 credits/month. Each search costs
> credits, so keep `TAVILY_MAX_RESULTS` modest and be mindful of the 5-min loop
> across a large watchlist. Get a key at <https://tavily.com>.

---

## 3. RSS news feeds

RSS feeds are defined **in code** (`src/NewsSentimentEngine.ts`), not `.env`, so
you can freely add or remove sources. The default curated India set:

| Source | Feed URL |
| ------ | -------- |
| Economic Times | `https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms` |
| Moneycontrol | `https://www.moneycontrol.com/rss/Marketnews.xml` |
| Business Standard | `https://www.business-standard.com/rss/markets-106.rss` |
| NDTV Profit | `https://www.ndtv.com/rss/business/news` |

### 3.1 Add / remove a feed

Edit the `RSS_FEEDS` array in `src/NewsSentimentEngine.ts`:

```ts
const RSS_FEEDS: Array<{ name: string; url: string }> = [
  { name: 'EconomicTimes', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms' },
  // add yours:
  { name: 'MySource', url: 'https://example.com/feed.xml' },
];
```

- Each feed is fetched with `rss-parser`.
- Only items whose **title or snippet mentions a watchlist symbol** are kept
  (case-insensitive), so a feed can be broad.
- Articles are de-duplicated by title and capped at 10 per symbol per cycle.

> **RSS-first philosophy:** feeds are free and reliable. The LLM is used only to
> *score* the headlines, not to discover them. Future versions can add an
> LLM web-search "radar" for off-radar symbols, but the primary signal stays
> deterministic.

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
  `approve`/`yes`/`ok` or `reject`/`no`/`cancel` within 2 minutes.
- **Commands:**
  - `/stop` — kill-switch, gracefully stops the bot.
  - `/status` — current state + watchlist + active LLM model.
  - `/models` — list available LLM models (highlights the active one).
  - `/model <name>` — switch the active LLM model live.
  - `/llm <question>` — test the active LLM model and see its reply.
- Telegram is **enabled automatically** when both `TELEGRAM_BOT_TOKEN` and
  `TELEGRAM_CHAT_ID` are present. If either is missing, trades auto-approve in
  paper mode (still gated by RiskEngine).

---

## 5. Notification system

All bot messages flow through `NotificationService` (`src/NotificationService.ts`).
Every notification is **persisted to the `notifications` SQLite table** with a
severity level, title, body, and optional structured metadata. If Telegram is
enabled, the message is also forwarded to your chat.

### 5.1 How it works

- **DB-first:** every notification is written to SQLite regardless of Telegram
  status. This gives you a complete, queryable audit trail.
- **Telegram optional:** if `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set,
  notifications are also forwarded to Telegram. If either is empty, the bot
  runs silently with all notifications in the database only.
- **Severity levels:** `INFO`, `WARN`, `ERROR`, `TRADE`, `APPROVAL`, `SENTIMENT`.
  Each maps to a distinct icon in Telegram and is filterable in SQL.

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
by RiskEngine).

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

### 6.3 Example log output

```
[12:34:56] INFO: RSI warmup
    symbol: "INFY"
    rsi: "45.20"
[12:34:57] INFO: Live ticker started
    tokens: 5
[12:35:00] INFO: Paper FILLED: INFY
    tradeId: "TRD-..."
    pnl: 0
```

---

## 7. Database schema & migrations

The bot uses a **highly normalized SQLite schema** with 16 tables, managed by a
custom migration runner (`src/MigrationRunner.ts`) — a lightweight Liquibase
equivalent.

### 7.1 Tables

| Table | Purpose |
| ----- | ------- |
| `instruments` | Normalized instrument reference (token, symbol, exchange, lot size) |
| `watchlist` | Which instruments are actively traded |
| `candles` | Historical OHLC data (for warmup/backtesting) |
| `ticks` | Real-time tick archive |
| `signals` | Every strategy signal (RSI, sentiment, reason) |
| `risk_events` | Audit trail of every risk gate decision |
| `orders` | Paper order records |
| `positions` | Open/closed positions with realized PnL |
| `trades` | Filled trades (fills) |
| `notifications` | All bot messages (DB-first, Telegram optional) |
| `daily_summary` | Per-day performance (win rate, drawdown, PnL) |
| `sessions` | Trading session lifecycle |
| `health_checks` | Component health heartbeat |
| `config_audit` | Configuration change tracking |
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
touch migrations/V002__add_new_feature.sql
```

Write your DDL (use `IF NOT EXISTS` / `IF EXISTS` for idempotency), then
restart the bot. The runner picks it up automatically.

### 7.4 Auto-bootstrap

The database and all tables are created automatically on first run — **zero
manual setup**. The `data/` directory and `data/ledger.db` file are created if
they don't exist, and all 16 tables are created by the initial migration.

---

## 8. Quantitative risk configuration

These are the **hard guardrails** in `src/server/RiskEngine.ts`. The AI/strategy can
**never** override them.

| Variable | Meaning |
| -------- | ------- |
| `AVAILABLE_CAPITAL` | Total virtual capital. Sum of ticket sizes of open positions + the proposed trade must be ≤ this. |
| `MAX_DAILY_DRAWDOWN` | Max realised loss in a single day. Once exceeded, new trades are blocked until reset. |
| `MAX_TRADE_ALLOCATION` | Max ticket size for any single trade. |
| `AUTO_TRADE_TICKET_THRESHOLD` | Trades with ticket ≤ this execute automatically; above → Telegram approval. |

Example for a ₹5,00,000 account risking modestly:

```dotenv
AVAILABLE_CAPITAL=500000
MAX_DAILY_DRAWDOWN=5000
MAX_TRADE_ALLOCATION=20000
AUTO_TRADE_TICKET_THRESHOLD=5000
```

> All values are in **INR**.

---

## 9. Strategy tuning

These tune the strategy in `src/server/MarketAgent.ts`. The strategy has **three modes**,
selected via `STRATEGY_MODE`:

| Mode | Entry | Best for |
| ---- | ----- | -------- |
| `mean_reversion` (default) | RSI(14) < 30 (oversold) | ranging markets |
| `pullback_trend` | RSI dips < 50 in an uptrend | trending blue-chips |
| `breakout` | price breaks above prior N-bar high | trending stocks, **daily bars** |

### 9.0 Strategy modes

- **`mean_reversion`** — buy oversold, sell overbought. Conservative; few trades.
- **`pullback_trend`** — buy dips in an uptrend (fast SMA > slow SMA). More trades.
- **`breakout`** — buy momentum breakouts with an ATR trailing stop. Best on
  **daily** bars (breakouts are meaningful on daily, noisy on 5-min).

Breakout-specific settings:

| Variable | Meaning | Default |
| -------- | ------- | ------- |
| `BREAKOUT_LOOKBACK` | N-bar high to break above | `20` |
| `BREAKOUT_TRAIL_ATR_MULT` | ATR trailing-stop multiplier | `2` |

### 9.1 Core RSI rules

| Variable | Meaning |
| -------- | ------- |
| `RSI_ENTRY_THRESHOLD` | Enter long when RSI(14) drops **below** this (oversold). |
| `RSI_EXIT_THRESHOLD` | Exit when RSI(14) rises **above** this (overbought). |
| `TRADE_COOLDOWN_MINUTES` | Min minutes between opening trades. **Immutable gate** — AI cannot override. |

### 9.2 Volatility-adaptive risk

| Variable | Meaning |
| -------- | ------- |
| `STOP_LOSS_PERCENT` | Hard cap on stop distance (% below entry for longs). The ATR stop is never wider than this. |
| `ATR_STOP_MULTIPLIER` | Dynamic stop = entry ± (ATR × multiplier). ATR(14) adapts to volatility. |
| `RISK_PER_TRADE_PERCENT` | Risk-per-trade budget (% of capital) used to size quantity: `qty = budget / (ATR × multiplier)`, capped at the watchlist quantity. |
| `BAR_INTERVAL_SECONDS` | Ticks accumulated into one OHLC bar for ADX/ATR (60s ≈ 1-min bar). Smaller = more responsive. |

### 9.3 Regime & confirmation filters

| Variable | Meaning |
| -------- | ------- |
| `ADX_TREND_THRESHOLD` | Only take entries when ADX(14) is **below** this (ranging market). Skips trending markets where mean-reversion fails. Use 25–30. |
| `VOLUME_CONFIRM_MULTIPLIER` | Require current bar volume ≥ average × this before entering. Set to 0/1 to disable. |
| `MAX_SIMULTANEOUS_ENTRIES` | Cap on concurrent open positions (correlation/concentration risk). |

### 9.4 Circuit breaker & session timing

| Variable | Meaning |
| -------- | ------- |
| `CIRCUIT_BREAKER_TRADES` | If this many trades occur within the window, halt entries. |
| `CIRCUIT_BREAKER_WINDOW_MINUTES` | Rolling window for the circuit breaker count. |
| `CIRCUIT_BREAKER_HALT_MINUTES` | How long entries are halted after tripping. |
| `SKIP_FIRST_MINUTES` | Skip the first N minutes of the session (noisy open). 0 = off. |
| `SKIP_LAST_MINUTES` | Skip the last N minutes of the session (noisy close). 0 = off. |

### 9.5 Example tuned configuration

```dotenv
RSI_ENTRY_THRESHOLD=30
RSI_EXIT_THRESHOLD=70
STOP_LOSS_PERCENT=4
TRADE_COOLDOWN_MINUTES=15

ATR_STOP_MULTIPLIER=2
RISK_PER_TRADE_PERCENT=1
BAR_INTERVAL_SECONDS=60

ADX_TREND_THRESHOLD=25
VOLUME_CONFIRM_MULTIPLIER=1.5
MAX_SIMULTANEOUS_ENTRIES=2

CIRCUIT_BREAKER_TRADES=3
CIRCUIT_BREAKER_WINDOW_MINUTES=30
CIRCUIT_BREAKER_HALT_MINUTES=60
SKIP_FIRST_MINUTES=30
SKIP_LAST_MINUTES=30
```

**Sentiment interaction:** a long entry is suppressed when sentiment score
`< -0.4` (strong bearish news). Neutral/positive sentiment passes through.

### 9.6 Options layer (SAFE, switchable)

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
- **Driven by the breakout signal** — on an upside breakout it buys a CALL; on
  a downside breakdown it buys a PUT; it closes the option when the equity exits.

> ⚠️ **Options are still risky.** Even with caps, options can lose the full
> premium. Keep `OPTIONS_ENABLED=false` until you're comfortable with the
> equity strategy, then enable it with modest caps.

---

## 10. Watchlist file

The symbols the bot trades are defined in **`data/watchlist.json`**:

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
> quantity and the live price.

---

## 11. Verifying each piece works

Run `npm run dev` and watch the startup log. Then confirm:

| Capability | How to verify |
| ---------- | ------------- |
| Config loading | Startup banner prints watchlist count, capital, Telegram/Kite/LLM status. |
| DB migrations | `Migration applied` log lines; `data/ledger.db` created with 16 tables. |
| Kite history | `Warmup INFY: RSI(14) = 45.20` lines (needs valid token + market data access). |
| Ticker | `Ticker connected, subscribing` log (during market hours). |
| News/RSS | Sentiment briefs appear in `notifications` table (and Telegram if enabled). |
| LLM connection | In Telegram run `/llm` and `/models`; confirm the active model responds. |
| Risk engine | `Risk blocked trade` notifications; `risk_events` table entries. |
| HITL | Approve/reject prompts for large tickets (Telegram only). |
| Persistence | `data/ledger.db` grows; query `notifications`, `trades`, `signals` tables. |
| Daily summary | On shutdown, `daily_summary` table is populated with the day's stats. |
| Health checks | `health_checks` table gets entries every 5 minutes. |

---

## 12. Troubleshooting

| Symptom | Likely cause / fix |
| ------- | ------------------ |
| `better-sqlite3` build fails on `npm install` | Native module. Run install without sandbox/CI restrictions, or `npm rebuild better-sqlite3`. |
| `Warmup skipped` / no RSI | `KITE_API_KEY`/`KITE_ACCESS_TOKEN` missing or token expired. Refresh via the login flow (§1.2). |
| `Ticker closed` / reconnect loop | Token expired or network blocked. Refresh token; check the ticker's `noreconnect` log. |
| No Telegram messages | Bot token or chat id wrong, or you haven't messaged the bot. Check `getUpdates`. |
| No sentiment / heuristic used | No LLM configured (`OLLAMA_API_KEY` / `OPENAI_API_KEY` empty); the keyword fallback is active by design. |
| `/llm` reports a connection error | Wrong `OLLAMA_BASE_URL`, missing `OLLAMA_API_KEY`, or model name invalid. Check §2 and run `/models`. |
| `/model` says unknown model | The name isn't in `OLLAMA_MODELS` / `OPENAI_MODELS`. Add it to `.env` and restart. |
| LLM returns non-JSON / falls back to heuristic | Some models reject `response_format`; set `LLM_JSON_MODE=false` or use a JSON-capable model. |
| No Telegram messages | Bot token or chat id wrong, or you haven't messaged the bot. Check `getUpdates`. Or Telegram is intentionally disabled — check `notifications` table. |
| DB file not created | `data/` directory must be writable. Check filesystem permissions. |
| Migration fails | Check `schema_migrations` table for the last applied version; fix the SQL and restart. |
| "Trade in cooldown" repeatedly | `TRADE_COOLDOWN_MINUTES` window since last fill hasn't elapsed. |
| `Risk blocked trade` | A limit (`MAX_DAILY_DRAWDOWN`, `MAX_TRADE_ALLOCATION`, capital) is exceeded — expected behaviour. |

---

*See also the architecture overview and quick start in the root `README.md`.*

---

## New configuration knobs

### Paper costs (realism)
| Env | Default | Meaning |
| --- | --- | --- |
| `PAPER_SLIPPAGE_BPS` | `2` | Adverse slippage on fills (basis points) |
| `PAPER_BROKERAGE_BPS` | `3` | Brokerage as bps of notional |
| `PAPER_BROKERAGE_MAX` | `20` | Per-order brokerage cap (INR; 0 = uncapped) |
| `PAPER_STATUTORY_BPS` | `10` | Combined STT + txn + SEBI + stamp as bps |
| `PAPER_GST_PCT` | `18` | GST as % of brokerage |

### Trade-quality gates
| Env | Default | Meaning |
| --- | --- | --- |
| `MIN_RISK_REWARD` | `1.5` | Minimum target/stop reward:risk for an entry |
| `TARGET_ATR_MULTIPLIER` | `3` | Target distance = ATR * this multiple |
| `REGIME_GATING_ENABLED` | `false` | Only trade when regime suits the strategy mode |
| `MIN_SIGNAL_CONFIDENCE` | `0` | Evidence-based confidence floor (0 = disabled) |

### LLM analyst verdict
| Env | Default | Meaning |
| --- | --- | --- |
| `ANALYST_ENABLED` | `false` | Enable the LLM analyst pre-trade filter (soft) |
| `ANALYST_REJECT_THRESHOLD` | `70` | Risk score above which the analyst blocks the trade |

### UI / dashboard
| Env | Default | Meaning |
| --- | --- | --- |
| `UI_PORT` | `3000` | Dashboard/API port |
| `UI_HOST` | `0.0.0.0` | Bind host |
| `UI_API_TARGET` | `http://localhost:3000` | Vite dev proxy target |

### Walk-forward validation (script)
| Env | Default | Meaning |
| --- | --- | --- |
| `BACKTEST_INTERVAL` | `day` | Bar interval for `validate:strategy` |
| `BACKTEST_DAYS` | `400` | Lookback window |
| `BACKTEST_WARMUP_BARS` | `60` | Leading warm-up bars (excluded from eval) |
| `BACKTEST_FOLD_BARS` | `50` | OOS fold size |
