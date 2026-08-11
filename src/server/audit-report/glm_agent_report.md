## Executive Summary

- **[FAIL]** The bot is non-functional when Kite credentials are present: `index.ts` loads NFO instruments but then searches for NSE equity symbols, causing all warmup and live-tick subscription to silently fail.
- **[FAIL]** `MarketAgent.proposeTrade` is `async` but called without `await` from all entry/exit paths, creating unhandled promise rejections and a race condition where concurrent proposals can bypass the `RiskEngine` capital gatekeeper.
- **[FAIL]** `TelegramHITL.requestApproval` registers independent message listeners for each pending trade; a single "approve" message resolves all simultaneously-pending approvals, enabling unintended multi-trade execution.
- **[WARN]** `OptionsTrader` maintains positions and P&L entirely in memory with zero ledger persistence; option exposure is invisible to the `RiskEngine` and all option state is lost on restart.
- **[PASS]** The dependency-injection wiring in `index.ts` is complete and acyclic; all constructor parameters are satisfied and no circular dependencies exist.

## Findings

---

- **Severity:** CRITICAL
- **File:** `index.ts:103` (and `index.ts:135`)
- **Issue:** `loadInstruments('NFO')` loads only derivatives; subsequent `findInstrument(symbol, 'NSE')` calls cannot find equity instruments, so warmup and live-tick subscription silently produce zero tokens.
- **Evidence:**
```typescript
await streamer.loadInstruments('NFO');           // line 103
// ...
const inst = streamer.findInstrument(sym.tradingsymbol, 'NSE');  // line 108
// ...
const activeTokens = config.watchlist
    .filter((s) => s.enabled)
    .map((s) => streamer.findInstrument(s.tradingsymbol, 'NSE')) // line 135
```
- **Impact:** With Kite configured, every watchlist equity symbol fails instrument lookup. Warmup is skipped for all symbols, `activeTokens` is empty, and the live ticker never starts. The bot runs in a permanently degraded "watch mode only" state despite having valid credentials.
- **Recommendation:** Call `loadInstruments('NSE')` for equity watchlist symbols. If both NSE and NFO instruments are needed (for options), modify `KiteStreamer.loadInstruments` to merge into the existing map instead of clearing it, or load all exchanges in a single pass.

---

- **Severity:** CRITICAL
- **File:** `MarketAgent.ts:316` (and all callers: `checkEntry:283`, `checkEntryPullback:355`, `checkEntryBreakout:415`, `checkExit:470`)
- **Issue:** `proposeTrade` is `async` but called without `await` (or `.catch()`), causing unhandled promise rejections and a non-atomic risk-check-then-execute race.
- **Evidence:**
```typescript
private async proposeTrade(trade: TradeRequest): Promise<void> {
    const risk = this.risk.evaluate(trade);
    // ...
    const fill = this.trader.execute(trade);
    // ...
}

// Called without await:
this.proposeTrade({                     // line 316
    symbol, exchange: watch.exchange, quantity, direction: 'LONG', ...
});
```
- **Impact:** (1) Any throw inside `proposeTrade` (DB error, Telegram error, trader error) becomes an unhandled promise rejection that can crash the process. (2) `onTicks` evaluates all tracked symbols every 3 seconds; multiple symbols can call `proposeTrade` concurrently. Both calls read `usedCapital()` from the ledger before either executes, so both can pass the capital check and then both execute, exceeding `availableCapital`.
- **Recommendation:** Either make `evaluateSymbol` async and `await proposeTrade`, or serialize proposals through a queue. At minimum, attach `.catch(err => logger.error(...))` to every `proposeTrade` call. For atomicity, move the risk check inside the `Ledger.transaction` in `PaperTrader.execute`.

---

- **Severity:** CRITICAL
- **File:** `TelegramHITL.ts:88-118`
- **Issue:** Each `requestApproval` call registers its own `message` listener on the bot. When multiple trades await approval simultaneously, a single "approve" message fires all listeners, approving all pending trades at once.
- **Evidence:**
```typescript
const handler = (msg: TelegramBot.Message) => {
    const chatId = String(msg.chat.id);
    if (chatId !== String(this.config.telegram.chatId)) return;
    const text = (msg.text ?? '').toLowerCase();
    if (/\b(approve|yes|ok|confirm)\b/.test(text)) {
        cleanup();
        resolve({ decision: 'APPROVED' });
    }
    // ...
};
bot.on('message', handler);   // multiple handlers registered simultaneously
```
- **Impact:** If two trades exceed the auto-trade threshold in the same tick batch, both call `requestApproval`. The user sends one "approve" message, and both trades execute. This bypasses the human's intent to approve only one trade and can cause over-allocation.
- **Recommendation:** Serialize approval requests with a queue, or include a trade ID in the prompt and match it in the handler. Only one `requestApproval` should be pending at a time.

---

- **Severity:** HIGH
- **File:** `OptionsTrader.ts:38-60` (`open`), `OptionsTrader.ts:68-92` (`close`)
- **Issue:** Option positions, exposure, and fills are stored only in memory (`Map`, `array`). No ledger persistence occurs. On restart, all option state is lost.
- **Evidence:**
```typescript
private positions = new Map<string, OptionPosition>();
private exposure = 0;
private fills: OptionFill[] = [];
// ...
this.positions.set(symbol, { contract, quantity: lots, entryTime: now, entryPremium: totalPremium });
this.exposure += totalPremium;
// No ledger call anywhere in open() or close()
```
- **Impact:** After a restart, open option positions are invisible. The bot may open duplicate option positions on the same underlying. Realized option P&L is excluded from `Ledger.currentDrawdown()` and `computeDailySummary()`, so risk metrics understate true exposure and loss.
- **Recommendation:** Persist option fills and positions to the ledger (new tables or reuse existing ones). Call `ledger.recordTrade` and `ledger.recordOrder` for option fills. Factor option exposure into `RiskEngine.evaluate`.

---

- **Severity:** HIGH
- **File:** `MarketAgent.ts:417-427` (`checkEntryBreakout`), `MarketAgent.ts:472-480` (`checkExit`)
- **Issue:** Option trades are opened/closed directly via `this.options.open()` / `this.options.close()`, bypassing `proposeTrade` and the `RiskEngine` gatekeeper entirely.
- **Evidence:**
```typescript
// In checkEntryBreakout, after proposeTrade:
if (this.options.enabled) {
    const fill = this.options.open(symbol, 'LONG', price, now);  // no RiskEngine
    // ...
}

// In checkExit, after proposeTrade:
if (this.options.enabled) {
    const fill = this.options.close(symbol, price, now);  // no RiskEngine
    // ...
}
```
- **Impact:** The `RiskEngine` checks (capital capacity, drawdown, per-trade allocation) are not applied to option trades. `OptionsEngine.riskCheck` only checks premium and exposure caps, not overall portfolio risk. A drawdown breach or capital exhaustion will not block option trades.
- **Recommendation:** Route option trades through `proposeTrade` or a dedicated risk-gated path that calls `RiskEngine.evaluate` before execution.

---

- **Severity:** HIGH
- **File:** `Ledger.ts:175` (`closePosition`), `Ledger.ts:184` (`getPosition`), `Ledger.ts:265` (`recordSignal`), `Ledger.ts:283` (`recordRiskEvent`)
- **Issue:** Multiple `Ledger` methods hardcode `'NSE'` as the exchange when resolving instrument IDs, breaking for any non-NSE instrument.
- **Evidence:**
```typescript
// closePosition
const instId = this.resolveInstrumentId(symbol, 'NSE', instrument_token);

// getPosition
const inst = this.getInstrumentBySymbol(symbol, 'NSE');

// recordSignal
const instId = this.resolveInstrumentId(s.symbol, 'NSE', s.instrument_token);

// recordRiskEvent
instId = this.resolveInstrumentId(symbol, 'NSE', instrument_token);
```
- **Impact:** If the watchlist contains BSE symbols or NFO instruments, `closePosition` creates a stub NSE instrument and updates the wrong row (or no row). `getPosition` returns null for non-NSE positions, causing `MarketAgent` to attempt duplicate entries instead of checking exits. `recordSignal` and `recordRiskEvent` misattribute events to NSE stubs.
- **Recommendation:** Pass the actual exchange through the method signatures. The `Position` and `TradeRequest` types already carry `exchange`; use it instead of hardcoding `'NSE'`.

---

- **Severity:** HIGH
- **File:** `MarketAgent.ts:109-111` (`tradeTimes`, `circuitBreakerUntil`)
- **Issue:** Circuit breaker state (`tradeTimes` array and `circuitBreakerUntil` timestamp) is in-memory only and not persisted. On restart, the circuit breaker is fully reset.
- **Evidence:**
```typescript
private tradeTimes: number[] = [];
private circuitBreakerUntil = 0;
```
- **Impact:** If the bot restarts after a circuit-breaker engagement, it immediately resumes entries with no memory of the recent trade burst. This defeats the circuit breaker's purpose of preventing runaway loss spirals.
- **Recommendation:** Persist `tradeTimes` and `circuitBreakerUntil` to the ledger (e.g., in a `bot_state` table or `risk_events`). Restore them on startup.

---

- **Severity:** HIGH
- **File:** `index.ts:140-142`
- **Issue:** The live-tick callback calls `agent.onTicks(ticks)` without a try/catch. Any throw inside `onTicks` is an unhandled error in the KiteTicker callback.
- **Evidence:**
```typescript
streamer.startTicker(activeTokens, (ticks: Tick[]) => {
    agent.onTicks(ticks);   // no try/catch
});
```
- **Impact:** A single malformed tick, DB error in `getPosition`, or indicator computation error throws inside the callback. Depending on the KiteTicker SDK's error handling, this could crash the process or silently kill the tick stream.
- **Recommendation:** Wrap in try/catch:
```typescript
streamer.startTicker(activeTokens, (ticks: Tick[]) => {
    try { agent.onTicks(ticks); }
    catch (err) { logger.error({ err }, 'onTicks failed'); }
});
```

---

- **Severity:** MEDIUM
- **File:** `Ledger.ts:243` (`currentDrawdown`), `Ledger.ts:322` (`computeDailySummary`)
- **Issue:** Both methods compute "today" using `new Date().toISOString().slice(0, 10)`, which is the UTC date. NSE trades in IST (UTC+5:30), so trades between 00:00–05:30 IST are attributed to the previous UTC day.
- **Evidence:**
```typescript
const today = new Date().toISOString().slice(0, 10);
// ...
.get(`${today}%`) as { loss: number };
```
- **Impact:** Drawdown tracking and daily summaries are incorrect for the IST trading session. A drawdown breach occurring in early IST morning may not be caught until the UTC date rolls over.
- **Recommendation:** Compute "today" in IST: `new Date(Date.now() + 5.5*3600*1000).toISOString().slice(0,10)`, or store an explicit session date.

---

- **Severity:** MEDIUM
- **File:** `NewsSentimentEngine.ts:47-56` (`fetchArticles`)
- **Issue:** RSS feeds are fetched sequentially with `await this.parser.parseURL(feed.url)` and no timeout. A hanging feed blocks all subsequent feeds and the entire sentiment loop.
- **Evidence:**
```typescript
for (const feed of RSS_FEEDS) {
    try {
        const parsed = await this.parser.parseURL(feed.url);  // no timeout
        // ...
    } catch (err) { ... }
}
```
- **Impact:** If one RSS feed is slow or unresponsive, the news loop for all symbols stalls. Since the news loop runs every 10 minutes via `setInterval`, a stall longer than 10 minutes causes overlapping concurrent runs.
- **Recommendation:** Add a timeout to each `parseURL` call (e.g., `Promise.race` with `AbortSignal.timeout`), or fetch feeds in parallel with `Promise.allSettled`.

---

- **Severity:** MEDIUM
- **File:** `index.ts:155-172` (`shutdown`)
- **Issue:** Several cleanup operations in the shutdown handler are not wrapped in try/catch. If any throws, subsequent cleanup is skipped and the process may not exit cleanly.
- **Evidence:**
```typescript
streamer.stopTicker();          // no try/catch
telegram.stopPolling();        // no try/catch
await ui.close();              // no try/catch
ledger.endSession(sessionId, 'COMPLETED');  // no try/catch
notify.info('Bot shut down', '...');        // no try/catch
ledger.close();               // no try/catch
```
- **Impact:** If `streamer.stopTicker()` throws (e.g., ticker is null and `close` is undefined), the session is never ended, the ledger is never closed, and the daily summary may not be computed.
- **Recommendation:** Wrap each cleanup step in its own try/catch block, logging errors but continuing to the next step.

---

- **Severity:** MEDIUM
- **File:** `NotificationService.ts:73-79` (`notify`)
- **Issue:** `NotificationService` receives `ledger.raw()` (the raw `better-sqlite3` Database) and writes directly to the `notifications` table, bypassing the `Ledger` abstraction that is documented as the "single source of truth."
- **Evidence:**
```typescript
// index.ts
const notify = new NotificationService(ledger.raw(), config);

// NotificationService
this.db
    .prepare(`INSERT INTO notifications (channel, severity, title, body, metadata) VALUES (?, ?, ?, ?, ?)`)
    .run(channel, severity, title, body, metaJson);
```
- **Impact:** The `Ledger` class cannot enforce invariants or transactions over notification writes. If the `notifications` table schema changes, `NotificationService` must be updated independently. The DB insert is also not wrapped in try/catch; if it throws, the error propagates to callers that may not expect it (e.g., `MarketAgent.proposeTrade`).
- **Recommendation:** Route notification persistence through a `Ledger` method (e.g., `ledger.recordNotification(...)`) so all DB writes go through one abstraction.

---

- **Severity:** MEDIUM
- **File:** `MarketAgent.ts:48-69` (in-memory state maps)
- **Issue:** `MarketAgent` maintains extensive in-memory state (`volumeSamples`, `breakoutHighs`, `trailingHighs`, `smaFastValues`, `smaSlowValues`) that is not restored on restart. Only RSI, ADX, and ATR are warmed up from historical data.
- **Evidence:**
```typescript
private breakoutHighs = new Map<string, number[]>();
private trailingHighs = new Map<string, number>();
private volumeSamples = new Map<string, number[]>();
private smaFastValues = new Map<string, number>();
private smaSlowValues = new Map<string, number>();
// warmup() only restores rsiValues, adxValues, atrValues
```
- **Impact:** After restart: breakout detection has no price history (returns early due to `highs.length < breakoutLookback`); volume confirmation always passes (`samples.length < 5` returns `true`); trailing stops reset to entry price; SMA crossover state is lost. The strategy behaves differently after restart than during continuous operation.
- **Recommendation:** Extend `warmup` to also feed `breakoutHighs`, `volumeSamples`, `smaFastValues`, and `smaSlowValues` from historical candles.

---

- **Severity:** LOW
- **File:** `MarketAgent.ts:497`
- **Issue:** `currentSymbol` is declared but never read or written — dead code.
- **Evidence:**
```typescript
/** Temporary symbol cursor used by sizedQuantity (avoid threading). */
private currentSymbol = '';
```
- **Impact:** No functional impact, but indicates an abandoned design decision. Misleading to maintainers.
- **Recommendation:** Remove the field.

---

- **Severity:** LOW
- **File:** `api/queries.ts:196` (`positions`), `api/queries.ts:271` (`candles`)
- **Issue:** The `positions` query references a `ticks` table and the `candles` query references a `candles` table, but no code in the codebase ever writes to either table.
- **Evidence:**
```typescript
// positions query:
(SELECT last_price FROM ${this.t('ticks')} t
   WHERE t.instrument_id = p.instrument_id
   ORDER BY t.timestamp DESC LIMIT 1) AS lastPrice

// candles query:
FROM ${this.t('candles')} c
JOIN ${this.t('instruments')} i ON i.instrument_id = c.instrument_id
```
- **Impact:** `positions.lastPrice` always returns null (falls back to `avgPrice`). The `/api/candles` endpoint always returns an empty array. The dashboard's live price and chart features are non-functional.
- **Recommendation:** Either implement tick and candle persistence in `Ledger`, or document these as future features and return a clear "not available" response from the API.

---

- **Severity:** LOW
- **File:** `api/server.ts:30-35`
- **Issue:** CORS is set to `Access-Control-Allow-Origin: '*'` with no authentication on any endpoint.
- **Evidence:**
```typescript
res.header('Access-Control-Allow-Origin', '*');
```
- **Impact:** Any website can read the bot's trading state, positions, and P&L. For a local dashboard this is low risk, but if exposed to a network it leaks sensitive trading data.
- **Recommendation:** Restrict to `localhost` or a configured origin. Add at least a shared-secret header check if the server binds to `0.0.0.0`.

---

- **Severity:** LOW
- **File:** `api/server.ts:73-77`
- **Issue:** The `limit` query parameter for `/api/candles` is parsed with `Number()` without validation; NaN or negative values pass through to SQLite.
- **Evidence:**
```typescript
const limit = Number(req.query.limit ?? 500);
// ...
res.json(queries.candles(symbol, interval, limit));
```
- **Impact:** `NaN` causes SQLite to return 0 rows. Negative values cause a SQLite error. Neither is a security issue (parameterized query), but the API returns confusing responses.
- **Recommendation:** Clamp: `const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 500))`.

## Positive Observations

1. **Clean DI graph:** All dependencies are injected via constructors with no service locators or circular imports. The wiring in `index.ts` is complete and matches every constructor signature.
2. **RiskEngine as gatekeeper:** The `RiskEngine.evaluate` method is called before every trade in `proposeTrade`, and the code comments correctly emphasize that the AI can never override it. The checks for ticket size, drawdown, and capital capacity are sound.
3. **Transactional execution:** `PaperTrader.execute` wraps all position mutations and trade/order recording in a single `ledger.transaction()`, ensuring atomicity at the execution layer.
4. **Graceful degradation:** The bot boots and logs clearly even without Kite, Telegram, or LLM credentials. Each subsystem checks `isConfigured` / `enabled` before use.
5. **Parameterized SQL everywhere:** All queries in `Ledger` and `api/queries.ts` use `?` placeholders or named parameters. No string interpolation of user input into SQL.
6. **Structured logging:** `pino` with JSON output in production and pretty-print in development is a solid choice for observability.
7. **Migration runner:** The `MigrationRunner` with checksums and version tracking is a clean, lightweight schema management approach.

## Prioritized Action Items

1. **Fix `loadInstruments('NFO')` → `loadInstruments('NSE')`** in `index.ts:103` so equity instrument lookup succeeds. If both NSE and NFO are needed, modify `KiteStreamer.loadInstruments` to not clear the map. *(CRITICAL)*
2. **Await or catch `proposeTrade`** in all four callers in `MarketAgent.ts` (lines 316, 355, 415, 470) to prevent unhandled rejections and serialize the risk-check-then-execute path. *(CRITICAL)*
3. **Serialize Telegram approval requests** in `TelegramHITL.ts:88` so only one `requestApproval` is pending at a time, or include a trade ID in the prompt and match it in the handler. *(CRITICAL)*
4. **Persist option positions and fills to the ledger** in `OptionsTrader.ts:38` and `OptionsTrader.ts:68`; factor option exposure into `RiskEngine.evaluate`. *(HIGH)*
5. **Route option trades through `RiskEngine`** in `MarketAgent.ts:417` and `MarketAgent.ts:472` instead of calling `this.options.open/close` directly. *(HIGH)*
6. **Remove hardcoded `'NSE'`** in `Ledger.closePosition:175`, `getPosition:184`, `recordSignal:265`, `recordRiskEvent:283`; pass the actual exchange from the caller. *(HIGH)*
7. **Persist and restore circuit breaker state** (`tradeTimes`, `circuitBreakerUntil`) in `MarketAgent.ts:109-111` via the ledger. *(HIGH)*
8. **Wrap the tick callback in try/catch** in `index.ts:140`. *(HIGH)*
9. **Fix UTC/IST date computation** in `Ledger.currentDrawdown:243` and `computeDailySummary:322`. *(MEDIUM)*
10. **Add timeouts to RSS feed fetches** in `NewsSentimentEngine.ts:47`. *(MEDIUM)*
11. **Wrap each shutdown step in try/catch** in `index.ts:155-172`. *(MEDIUM)*
12. **Route notification writes through `Ledger`** instead of `ledger.raw()` in `NotificationService.ts:73`. *(MEDIUM)*
13. **Extend `warmup`** in `MarketAgent.ts:130` to restore `breakoutHighs`, `volumeSamples`, `smaFastValues`, `smaSlowValues`. *(MEDIUM)*
14. **Remove dead `currentSymbol` field** in `MarketAgent.ts:497`. *(LOW)*
15. **Implement tick/candle persistence or document as unimplemented** for `api/queries.ts:196` and `api/queries.ts:271`. *(LOW)*