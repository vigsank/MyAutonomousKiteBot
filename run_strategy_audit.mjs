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
    prompt: `You are a senior quantitative trading strategist and systematic-trading auditor with deep expertise in Indian equity markets (NSE) and options. Perform a rigorous, evidence-based audit of this paper-trading bot's MARKET LOGIC and STRATEGY, grounded ONLY in the code below.

GOAL: Rate, grade, and deeply audit the trading logic, then give a strong, reliable, actionable plan to make the bot sense the market correctly and yield consistent profits.

AUDIT FOCUS (in priority order):
1. Strategy soundness: evaluate the strategy mode (mean_reversion / pullback_trend / breakout), the indicator set (RSI-14, ADX-14, ATR-14, volume), and the entry/exit/stop rules in MarketAgent. Are the signals statistically sensible? Are thresholds (RSI_ENTRY_THRESHOLD, RSI_EXIT_THRESHOLD, ADX_TREND_THRESHOLD, ATR_STOP_MULTIPLIER, etc.) reasonable for the intended regime?
2. Market-sensing correctness: does the bot correctly interpret price action, trend, momentum, and mean-reversion? Are there logical errors, look-ahead bias, or misapplied indicators that would cause it to misread the market?
3. Risk & money management: assess position sizing (RISK_PER_TRADE_PERCENT), stop-loss logic, drawdown limits, circuit breakers, and capital allocation. Are they robust enough to survive adverse conditions?
4. Profitability levers: identify the highest-impact changes to improve win rate, expectancy, and risk-adjusted returns. Prioritize concrete, implementable improvements.

OUTPUT FORMAT — produce a single Markdown report with EXACTLY these sections:
## Executive Summary
(3-5 bullet verdicts, each tagged [PASS]/[WARN]/[FAIL])
## Strategy Grade Card
A table grading each dimension (Strategy Soundness, Market Sensing, Risk Management, Execution, Profitability) with a letter grade (A-F) and a 1-10 score, plus a one-line justification.
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
