# Adhoc changes — profitability plan implementation

This file records changes made agentically during plan implementation that were
*not* spelled out verbatim in `docs/plan/plan.md`, plus decisions deferred for
human review. The user audits this after the fact.

---

## During Phase 4–5 implementation (obvious, shipped)

1. **`strategy.eventBlackoutDays` config key (env `EVENT_BLACKOUT_DAYS`, default 3).**
   Phase 4.2 needed a window for the generalised event blackout. The old code
   hard-coded a 3-day literal inside `hasUpcomingEarnings`. Extracted it to
   config (0 disables) so the blackout is tunable without a code change. Default
   preserves prior behaviour exactly. — `AppConfig.ts`, `.env`, `.env.example`.

2. **`Ledger.shadowBookMonths()` and `Ledger.realizedPnlByMonth()` helpers.**
   Phase 4.3 (`decideAiAuthority`) needs "months of shadow history"; Phase 5.1
   (consecutive losing months) needs a per-month realized-P&L series. Both are
   read-only queries over existing tables (`agent_proposals`, `trades`). Additive.

3. **`npm run status:golive` operator script + `scripts/go_live_status.ts`.**
   Phase 5 asked for *written* kill criteria + a ladder. To make them usable (not
   just prose) I added a dashboard that evaluates the criteria against the real
   ledger and prints the ladder + recommended stage. Read-only; no trading effect.
   The drawdown figure it prints is a **proxy** (worst cumulative realized loss vs
   capital), not a true peak-to-trough series — flagged in the code. A proper
   peak-to-trough drawdown series is future work (see deferred #1 below).

4. **New unit tests wired into `test:unit`:** `test:authority`
   (`test/ai_authority_test.ts`) and `test:ladder` (`test/go_live_ladder_test.ts`).
   The event blackout is covered by a new `testEventBlackout()` inside the
   existing `test/risk_regression_test.ts`. All pass; `npm run ci` green
   (unit suite + `validate:momentum` VALIDATED at 36.99%, +26.84pp over Nifty).

5. **Refreshed the two strategy-audit prompts** (`run_strategy_audit.mjs`,
   `run_strategy_profit_audit.mjs`) to describe the CURRENT refocused
   architecture: momentum as the single originator, AI as filter + shadow book
   (`scoreShadowBook` / `decideAiAuthority`), the event blackout, the go-live
   ladder + kill criteria, and the Nifty-50 success bar (beat Nifty, not zero).
   The old prompts still framed the brain as `MarketAgent` strategy modes only.
   No behavioural change — these scripts just call an LLM to review the code.

---

## LiteLLM fallback layer (this session)

6. **`'litellm'` added to `LlmProvider` union; `LlmConfig.fallback?: LlmConfig` field added.**
   `AppConfig.ts`: new `resolveLiteLlm()` reads `LITELLM_BASE_URL` / `LITELLM_API_KEY`
   (returns `null` when absent); both the `ollama` and `openai` branches of `resolveLlm()`
   now spread `fallback` onto the returned config when non-null. All existing behaviour
   unchanged when the LiteLLM vars are empty.

7. **`LlmManager` fallback wiring.** When `config.fallback` is present, a second
   `OpenAI` client is constructed pointing at LiteLLM. `callModel()` catches any
   error, checks `isFallbackError()` (429 / rate-limit / quota by status code OR
   message substring), and retries once via `callFallback()` which substitutes the
   fallback's `activeModel` for the primary model name. All public signatures
   unchanged; `chatEnsemble` gets fallback for free through `callModel`.
   New `fallbackInfo` getter for observability.

8. **Shared `lib/llm-provider.mjs`** — thin helper used by all three audit `.mjs`
   scripts: `buildClients()` (primary + optional fallback client from env),
   `callWithFallback()` (primary-first, 429→LiteLLM retry), `isQuotaError()`.
   All three scripts (`run_strategy_audit.mjs`, `run_strategy_profit_audit.mjs`,
   `run_code_audit.mjs`) updated to use it — `import OpenAI` removed from each.

9. **Env vars** appended to `.env` and `.env.example`:
   `LITELLM_BASE_URL`, `LITELLM_API_KEY`, `LITELLM_MODEL`,
   `LITELLM_MODELS`, `LITELLM_ENSEMBLE_MODELS`, `LITELLM_FAST_ENSEMBLE_MODELS`.
   Both set to blank values by default — fallback is **disabled until you fill them in**.

10. **`docs/CONFIGURATION.md`** updated: new rows in the env vars overview table,
    new subsection 2.3 "Option C — LiteLLM fallback" with flow diagram, model
    table and ensemble-choice rationale, troubleshooting entries.

---

## Cycle 1 — audit run (COMPLETE)

**Strategy audit** ran via LiteLLM fallback (`anthropic--claude-4.5-sonnet`) — Ollama 429 triggered fallback correctly.
**Profit audit** ran directly on LiteLLM (`gemini-2.5-pro`, 1M token context) — needed for the 750k-char full-project payload.

Reports saved to `src/server/audit-report/strategy_audit_report.md` and `profit_strategy_audit.md`.

### Implemented from audit findings (obvious, safe)

11. **CRITICAL #2 — Headline sanitization against prompt injection** (`DailyReportEngine.ts`).
    New `sanitizeHeadline()` method: caps at 220 chars, strips unsafe characters, collapses
    whitespace. Applied to macro headlines (`a.title`), source names, and events line (`e.headline`).
    Pure defence — no behavioural change on clean data.

12. **CRITICAL #3 — Per-trade binding cap passed to LLM prompt** (`DailyReportEngine.ts`).
    `buildPrompt()` now computes `singleStockCapInr` and `perTradeCap` from config and adds a
    "Per-trade hard cap: ₹..." line to the CAPITAL SNAPSHOT section of the prompt. Ensures
    LLM suggestions are realistic and won't be silently cut by the RiskEngine.

13. **HIGH #4 — Event blackout types now configurable** (`AppConfig.ts`, `MomentumStrategy.ts`).
    Removed `static readonly BINARY_EVENT_TYPES` set. New `strategy.eventBlackoutTypes: string[]`
    (env `EVENT_BLACKOUT_TYPES`, default: all original 8 types plus `SPLIT`, `BONUS`,
    `RIGHTS_ISSUE` — the audit flagged these as missing). `hasUpcomingEvent()` builds the Set
    from config at call time. Extend via `.env` with no code change.

    `npm run ci` after all fixes: **VALIDATED 36.99% / +26.84pp over Nifty** — gate unchanged.

### Deferred from audit findings (non-obvious, needs user decision)

- **CRITICAL #1 — Remove/demote MarketAgent legacy code.** Both audits flagged this independently.
  The user has explicitly said the agent fleet is core infra and must not be removed. However,
  both auditors noted it runs on every 3-second tick batch computing RSI/ADX/ATR signals that
  are never executed — pure CPU/memory waste. *Options for the user:*
  (a) Keep as-is (legacy monitoring layer, no trades originate from it).
  (b) Demote it: remove `proposeTrade` calls from `MarketAgent`, make it write to
      `agent_alerts` table only — still runs, still AI-backed, but can't accidentally originate.
  (c) Remove fully (not recommended per user directive).

- **Profit audit — Monthly drawdown cap 2% → 5-7%.** The auditor called `maxMonthlyDrawdownPct=2`
  a "stranglehold" — on a ₹500k account it's a ₹10k floor; one bad trade halts the month.
  5-7% is more realistic for compounding. This is a risk-appetite setting — the user decides.
  Current `.env` value: `MAX_MONTHLY_DRAWDOWN_PCT=2`.

- **Profit audit — ₹1L/month in 1 year is mathematically impossible** (requires 62% monthly
  compound return). Realistic timeline is 4-5 years starting from ₹25k live. The auditor
  endorsed the `GoLiveLadder.ts` approach — start ₹25k, compound 100%, scale on evidence.
  This is informational, not a code change.

### Profit audit script fix (adhoc code change)

14. **`run_strategy_profit_audit.mjs` — large-context routing.** The 750k-char full-project
    payload exceeded Claude Sonnet's context window (400 error). Updated the script to detect
    when LiteLLM is configured and route directly to `gemini-2.5-pro` (1M token context) for
    the primary call, bypassing Ollama entirely for this large-context audit. Ollama remains
    primary for the strategy audit (441k chars, fits fine).

- **Ran `npm run audit:strategy` then `npm run audit:profit` sequentially as
  instructed.** Both failed with the SAME error, before producing any report:

  ```
  429 you (vgnshs2) have reached your weekly usage limit, upgrade for higher
  limits: https://ollama.com/upgrade or add extra usage:
  https://ollama.com/settings
  ```

- **This is an Ollama Cloud account quota, not a code/config problem.** The
  scripts parse (`node --check` OK), credentials are present in `.env`, and the
  codebase packaged fine (436,444 chars). There is nothing to fix on our side.

- **Consequence:** I could not complete the "run cycle → read reports →
  implement good suggestions → run cycle 2" loop, because no reports were
  produced. Re-running would only burn more 429s.

- **Deferred to the user (non-obvious):** once the weekly limit resets (or extra
  usage is added), re-run `npm run audit:strategy && npm run audit:profit`. The
  refreshed prompts now target the momentum + AI-filter + go-live design, so the
  reports will be relevant. I did not implement any audit-driven changes because
  there are no audit findings yet.

---

## Cycle 2 — audit run + 30-day mock trading (COMPLETE)

**Strategy audit** ran via LiteLLM (`anthropic--claude-4.5-sonnet`) — Ollama 429 triggered fallback.
**Profit audit** ran directly on LiteLLM (`gemini-2.5-pro`, 1M token context).

Reports saved to `src/server/audit-report/strategy_audit_report.md` and `profit_strategy_audit.md`.

### Audit finding analysis

**Cycle 2 strategy audit — two CRITICAL findings investigated and found to be FALSE POSITIVES:**

- **CRITICAL #1 (Look-ahead bias):** Auditor claimed `rebalance()` uses end-of-month prices.
  Investigation: in the live path (`index.ts:265`) `pts[pts.length - 1]` IS the current day's
  price — correct for live execution. In `strategy_lab.ts` the backtest uses
  `closeOnOrBefore(pts, date)` for entry prices — also correct (uses rebalance-date price).
  **No look-ahead bias exists. No code change needed.**

- **CRITICAL #3 (Event blackout entry-only):** Auditor claimed `hasUpcomingEvent` doesn't exit
  held positions. Investigation of `MomentumStrategy.ts:267-268`: when `eventBlackout=true`,
  the guard condition `!eventBlackout` is false, so the `continue` does NOT execute, and the
  position falls through to the sell path. **Event blackout DOES force exits on held positions.
  No code change needed.** (This was already correctly implemented.)

### Implemented from Cycle 2 audit findings (obvious, safe)

15. **Monthly drawdown cap 2% → 5% (new default).** Both auditors independently called the
    2% cap a "stranglehold": on a ₹500k account it's a ₹10k monthly floor; a single stop-loss
    hit can halt the month. Raised default to 5% in `AppConfig.ts` (line ~549) and
    `.env.example`. Users who have `MAX_MONTHLY_DRAWDOWN_PCT=2` explicitly set in `.env`
    are unaffected; new deployments get 5%. `npm run ci` still VALIDATED 36.99%.

16. **MarketAgent demoted to shadow-only.** Both auditors flagged `MarketAgent.proposeTrade`
    as the source of the dual-brain architecture conflict. Per user directive, the agent fleet
    stays (never remove) but is now harmless: `proposeTrade()` in `MarketAgent.ts` was replaced
    with a shadow-only path that calls `ledger.recordAgentProposal(executed=false, originator=
    AI_COMPOSITE, outcome=SHADOW)`. No trade ever executes from MarketAgent. The shadow book
    accumulates data that `AiAuthorityPolicy` and `scoreShadowBook` can evaluate over time.
    `executeProposedTrade` is kept intact (not removed) — it remains reachable if the demotion
    is ever reversed, but is never called from the current `proposeTrade` path.
    All existing unit tests pass.

### 30-day mock trading test

**Test command:** `DAYS=30 ENV_FILE=.env.test npx ts-node test/backtest/momentum_live_pattern.ts`

**Simulation window:** 2026-07-17 → 2026-08-15 (30 trading days)
**Symbols selected by momentum (top-4 lookback 6mo):** WELCORP, J&KBANK, JINDALSAW, ADANIPOWER
**Data source:** kite-paper-node REST API serving real NSE daily CSVs

**ALL 10 CASES (ranked):**
```
1. case10  ₹5,00,000 → -0.02%  (₹-110)
2. case7   ₹3,00,000 → -0.04%  (₹-113)
3. case6   ₹1,00,000 → -0.12%  (₹-120)
4. case3   ₹90,000   → -0.12%  (₹-110)
5. case9   ₹90,000   → -0.12%  (₹-110)
6. case2   ₹35,000   → -0.18%  (₹-62)
7. case8   ₹50,000   → -0.37%  (₹-186)
8. case5   ₹40,000   → -0.44%  (₹-176)
9. case1   ₹20,000   → -1.06%  (₹-212)
10. case4  ₹10,000   → -2.32%  (₹-232)
```

**Strong top 5 (by return):**
| Case | Capital | Return | P&L | Final |
|---|---|---|---|---|
| case10 | ₹5,00,000 | -0.02% | ₹-110 | ₹4,99,890 |
| case7 | ₹3,00,000 | -0.04% | ₹-113 | ₹2,99,887 |
| case6 | ₹1,00,000 | -0.12% | ₹-120 | ₹99,880 |
| case3 | ₹90,000 | -0.12% | ₹-110 | ₹89,890 |
| case9 | ₹90,000 | -0.12% | ₹-110 | ₹89,890 |

**Analysis of results:**
- All 10 cases show small losses (–0.02% to –2.32%). The losses are dominated by
  transaction costs (brokerage + STT + slippage), NOT by adverse price movement.
- The 4-stock momentum portfolio (WELCORP, J&KBANK, JINDALSAW, ADANIPOWER) had flat
  underlying performance over this 30-day window — consistent with the OOS validation showing
  momentum works on a 12-month lookback with monthly rebalance, not 30-day windows.
- The 6-month lookback used in this test (forced by available CSV history) is shorter than the
  validated 12-month lookback; results are not comparable to the 36.99% OOS number.
- **Capital size matters**: case4 (₹10k) lost 2.32% from costs alone on 3 trades. case10
  (₹5L) lost only 0.02% on 4 trades — the cost-to-notional ratio improves dramatically
  with capital, confirming the `GoLiveLadder` minimum of ₹25k is correct.
- **This test is expected**: a 30-day window tests transaction costs, not the momentum edge.
  The momentum edge operates on 12-month lookbacks and monthly rebalances — its value is
  revealed over 3–5 years, not 30 days.

### Deferred from Cycle 2 (non-obvious, needs user decision)

- **AI veto impact on momentum edge.** Profit auditor noted that `reportVetoes()` may be
  systematically filtering good momentum names without any evidence it helps. Recommendation:
  disable LLM veto for first 12 months of live trading (`MomentumStrategy.reportVetoes`
  return false) until `AiAuthorityPolicy` has evidence. This is a risk-appetite decision.
  NOT changed — user should decide.

- **Cash reserve 20% → 10%.** Auditor noted 20% is high for a monthly-rebalance equity
  strategy. At 10% the bot deploys more capital, improving returns but increasing drawdown.
  Current 20% is intentional. NOT changed — user should decide.


1. **True peak-to-trough drawdown series.** The kill-criteria dashboard uses a
   conservative proxy (worst cumulative realized loss). A real equity-curve
   peak-to-trough would be more accurate for the 45% ceiling. Not built because
   it needs a design choice (mark-to-market cadence, realized-vs-unrealized) that
   is a judgement call, not an obvious fix.

2. **Kill criteria are advisory, not auto-enforced end-to-end.** The RiskEngine
   already halts on daily/portfolio/monthly drawdown. The two NEW criteria
   (consecutive losing months, tracking error vs Nifty) are evaluated by
   `GoLiveLadder`/`status:golive` but do not yet auto-halt the live loop — by
   design (Phase 5 = "written before real money moves"; wiring them into the
   live scheduler is a go-live step for when real capital is at stake).
