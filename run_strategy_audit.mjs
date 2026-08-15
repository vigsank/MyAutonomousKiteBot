#!/usr/bin/env node
/**
 * run_strategy_audit.mjs — Node.js CLI that audits the trading/market logic of
 * the src/server codebase with an Ollama Cloud model, rating/grading the
 * strategy and producing an actionable plan to improve market sensing and
 * profitability. Writes a Markdown report.
 *
 * It reuses the project's existing Ollama config from `.env`:
 *   OLLAMA_BASE_URL  (OpenAI-compatible endpoint, e.g. https://ollama.com/v1)
 *   OLLAMA_API_KEY
 * These are the same values the bot's LlmManager uses, so no extra setup.
 *
 * Usage:
 *   npm run audit:strategy
 *
 * Report is written to src/server/audit-report/strategy_audit_report.md.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import OpenAI from 'openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = join(__dirname, 'src', 'server');
const OUTPUT_DIR = join(SOURCE_DIR, 'audit-report');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'audit-report', '.git']);
const EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs', '.json', '.sql']);

/** Recursively read every source file into a single context string. */
function buildContext(dir) {
  let ctx = '';
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
      } else {
        const ext = entry.name.slice(entry.name.lastIndexOf('.'));
        if (EXTENSIONS.has(ext)) {
          ctx += `\n\n--- FILE: ${relative(SOURCE_DIR, full)} ---\n`;
          try {
            ctx += readFileSync(full, 'utf8');
          } catch (e) {
            ctx += `// Error reading file: ${e.message}`;
          }
        }
      }
    }
  };
  walk(dir);
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Strategy audit task — model overridable via AUDIT_MODEL_STRATEGY.   */
/* ------------------------------------------------------------------ */

const auditTasks = [
  {
    model: process.env.AUDIT_MODEL_STRATEGY || 'glm-5.2:cloud',
    file: 'strategy_audit_report.md',
    prompt: `You are a senior quantitative trading strategist and systematic-trading auditor with deep expertise in Indian equity markets (NSE). Perform a rigorous, evidence-based audit of this paper-trading bot's MARKET LOGIC and STRATEGY, grounded ONLY in the code below.

ARCHITECTURE CONTEXT (the bot's focus design):
- REASONING LAYER (LLM as a signal source, NOT a decision-maker): DailyReportEngine generates a 3-stage daily report (pre-open / mid-session / pre-close) combining global macro (GlobalMacro: S&P, Nasdaq, Nikkei, crude, USD/INR, Nifty -> regime score R) + headlines (TinyFish -> Google RSS) + per-symbol sentiment/prev-day/holding + a capital snapshot. The LLM SUGGESTS share/allocation numbers; the deterministic RiskEngine ENFORCES them. The LLM can tilt/veto but never force a trade or set a size.
- EXECUTION LAYER (deterministic Node): TechnicalIndicators (pivots, 20/50 SMA, 7-day S/R, fractional Kelly), ORB (opening-range breakout) filter, and hard risk caps in RiskEngine: single-stock <=15% of capital, cash reserve >=20%, risk-at-stop <=1.5% of balance, sector <=30%, portfolio drawdown guard.
- EOD LAYER: EodEngine squares off intraday (MIS) positions, logs EOD performance, and runs an overnight holding matrix.
- EQUITY ONLY (no options/futures in scope).

GOAL: Rate, grade, and deeply audit the trading logic, then give a strong, reliable, actionable plan to make the bot sense the market correctly and yield consistent profits.

AUDIT FOCUS (in priority order):
1. Strategy soundness: evaluate the strategy mode (mean_reversion / pullback_trend / breakout), the indicator set (RSI-14, ADX-14, ATR-14, volume, plus the new pivots / 7-day S/R / Kelly in TechnicalIndicators), and the entry/exit/stop rules in MarketAgent. Are the signals statistically sensible? Are thresholds (RSI_ENTRY_THRESHOLD, RSI_EXIT_THRESHOLD, ADX_TREND_THRESHOLD, ATR_STOP_MULTIPLIER, ORB_MINUTES, etc.) reasonable for the intended regime?
2. Market-sensing correctness: does the bot correctly interpret price action, trend, momentum, and mean-reversion? Does the ORB filter and the global-macro regime score (GlobalMacro) add or subtract signal quality? Are there logical errors, look-ahead bias, or misapplied indicators that would cause it to misread the market?
3. Reasoning Layer quality: is the DailyReportEngine's LLM prompt well-formed? Does it correctly pass deterministic numbers (pivots, S/R, capital snapshot) to the LLM while keeping the LLM advisory-only? Is the strict JSON schema robust? Does the 3-stage cadence (09:00/11:00/15:15) make sense?
4. Risk & money management: assess position sizing (RISK_PER_TRADE_PERCENT, Kelly), stop-loss logic, drawdown limits, circuit breakers, and the new hard caps (single-stock 15%, cash reserve 20%, risk-at-stop 1.5%, sector 30%, portfolio drawdown). Are they robust enough to survive adverse conditions? Is the LLM's advisory share suggestion correctly clamped by the RiskEngine?
5. Profitability levers: identify the highest-impact changes to improve win rate, expectancy, and risk-adjusted returns. Prioritize concrete, implementable improvements.

OUTPUT FORMAT — produce a single Markdown report with EXACTLY these sections:
## Executive Summary
(3-5 bullet verdicts, each tagged [PASS]/[WARN]/[FAIL])
## Strategy Grade Card
A table grading each dimension (Strategy Soundness, Market Sensing, Reasoning Layer, Risk Management, Execution, Profitability) with a letter grade (A-F) and a 1-10 score, plus a one-line justification.
## Findings
For EACH finding use this template:
- **Severity:** CRITICAL | HIGH | MEDIUM | LOW
- **File:** <path>:<line>
- **Issue:** <one-line description>
- **Evidence:** <quote the exact code>
- **Impact:** <how it hurts market sensing or profitability>
- **Recommendation:** <concrete fix>
## Market-Sensing Gaps
(specific ways the bot misreads the market, with fixes)
## Reasoning Layer Review
(assess the DailyReportEngine + GlobalMacro + LLM-as-signal design: prompt quality, JSON schema, capital-aware share suggestions, whether the LLM stays advisory-only)
## Execution Layer Review
(assess TechnicalIndicators, ORB filter, Kelly sizing, and whether the deterministic math is correct and well-integrated)
## Risk & Capital Guardrails Review
(assess the hard caps: single-stock 15%, cash reserve 20%, risk-at-stop 1.5%, sector 30%, portfolio drawdown guard — are they correctly enforced and audited?)
## Profitability Improvement Plan
(a prioritized, numbered list of the highest-impact changes, each with expected effect and file reference)
## Positive Observations

Rules: cite exact file paths and line numbers; only report issues you can substantiate from the code; mark unverifiable claims as "UNVERIFIED". Be specific, quantitative, and actionable — the goal is a plan the developer can implement to make the bot profitable.`,
  },
];

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const baseURL = process.env.OLLAMA_BASE_URL;
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!baseURL || !apiKey) {
    console.error(
      'Missing OLLAMA_BASE_URL / OLLAMA_API_KEY in .env. Add them (see .env.example).',
    );
    process.exit(1);
  }
  const client = new OpenAI({ baseURL, apiKey, timeout: 180_000 });

  if (!existsSync(SOURCE_DIR)) {
    console.error(`Error: source directory '${SOURCE_DIR}' does not exist.`);
    process.exit(1);
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const codeContext = buildContext(SOURCE_DIR);
  console.log(`📦 Packaged ${codeContext.length.toLocaleString()} chars from ${SOURCE_DIR}`);

  const results = await Promise.allSettled(
    auditTasks.map(async (task) => {
      console.log(`🤖 Querying [${task.model}] via ${baseURL}...`);
      const completion = await client.chat.completions.create({
        model: task.model,
        messages: [{ role: 'user', content: `${task.prompt}\n\nCodebase:\n${codeContext}` }],
        temperature: 0.2,
      });
      const text = completion.choices?.[0]?.message?.content ?? '';
      const reportPath = join(OUTPUT_DIR, task.file);
      writeFileSync(reportPath, text);
      console.log(`✅ Saved report to: ${reportPath}`);
    }),
  );

  let failed = 0;
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      failed++;
      console.error(`❌ Failed to run ${auditTasks[i].model}. Error: ${r.reason}`);
    }
  });
  console.log(failed === 0 ? '🎉 Strategy audit complete.' : `⚠️ ${failed} model(s) failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
