#!/usr/bin/env node
/**
 * run_strategy_profit_audit.mjs — Node.js CLI that audits the ENTIRE project
 * (server + client + migrations + config) as a veteran institutional trader and
 * trading-floor trainer, focused on ONE question: can this bot be made to always
 * end each month in PROFIT (never a monthly loss), starting from ₹5k–₹10k and
 * growing to ₹1,00,000/month income within a year?
 *
 * It reuses the project's existing Ollama config from `.env`:
 *   OLLAMA_BASE_URL  (OpenAI-compatible endpoint, e.g. https://ollama.com/v1)
 *   OLLAMA_API_KEY
 *
 * Usage:
 *   npm run audit:profit
 *
 * Report is written to src/server/audit-report/profit_strategy_audit.md.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import OpenAI from 'openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = __dirname; // the script lives in the project root
const OUTPUT_DIR = join(PROJECT_ROOT, 'src', 'server', 'audit-report');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'data', 'audit-report', '.git', '.zed']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.sql', '.json']);
// Only the actual bot source + config — never nested reference projects.
const DIRS = ['src/server', 'src/client', 'migrations'];
const ROOT_FILES = ['package.json', '.env.example', 'tsconfig.json'];

/** Recursively read every source/config file in the project into one context. */
function buildContext(root) {
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
          const st = statSync(full);
          if (st.size > 1_000_000) continue; // skip oversized files
          ctx += `\n\n--- FILE: ${relative(PROJECT_ROOT, full)} ---\n`;
          try {
            ctx += readFileSync(full, 'utf8');
          } catch (e) {
            ctx += `// Error reading file: ${e.message}`;
          }
        }
      }
    }
  };
  for (const d of DIRS) {
    const p = join(root, d);
    if (existsSync(p)) walk(p);
  }
  for (const f of ROOT_FILES) {
    const p = join(root, f);
    if (existsSync(p)) {
      ctx += `\n\n--- FILE: ${f} ---\n`;
      try {
        ctx += readFileSync(p, 'utf8');
      } catch (e) {
        ctx += `// Error reading file: ${e.message}`;
      }
    }
  }
  return ctx;
}

const PROMPT = `You are a veteran institutional equity trader and a trading-floor trainer with 20+ years of experience in Indian (NSE) markets, systematic/quant trading, and strict risk management. You are reviewing an autonomous paper-trading bot (TypeScript/Node, Zerodha Kite, hybrid code + LLM). Your job is a BRUTALLY HONEST profitability audit of the ENTIRE codebase and every algorithm, against a specific personal goal.

THE USER'S GOAL (evaluate it honestly, do not flatter):
- Start with ₹5,000–₹10,000 of capital.
- Through slow, accumulated holdings and profits, reach a stage within 1 year where the bot generates ₹1,00,000/month of income from trading.
- The bot must ALWAYS end each month in overall PROFIT — never a monthly loss (individual losing trades are acceptable, but the month-end P&L must be positive).

YOUR TASKS:
1. ANALYZE THE ENTIRE PROJECT: every strategy mode (mean_reversion / pullback_trend / breakout), every indicator (RSI/ADX/ATR/SMA), entry/exit rules, position sizing, the RiskEngine, the cost model (slippage + NSE fees), the LLM analyst verdict, the trade-quality gates (regime, confidence, min R:R), the concentration cap, the circuit breaker, and the walk-forward validation. Cite file:line where relevant.
2. DO THE MATH on the goal. Be explicit and unsparing: what monthly return % is required to turn ₹5k or ₹10k into ₹1L/month income within 12 months? Is that mathematically feasible without extreme leverage or reckless risk? What capital base is actually required to produce ₹1L/month at a realistic, sustainable monthly return (e.g. 2–5%)? Give the exact numbers.
3. IDENTIFY the specific algorithm changes that would most improve profitability and win-rate (exits, R:R, regime selection, position sizing, drawdown control).
4. DESIGN the "NO MONTHLY LOSS" guardrails: concrete rules so the bot stops trading for the month once a drawdown/loss threshold is hit, protecting the month-end P&L.
5. GIVE A REALISTIC GROWTH PLAN from ₹5k/₹10k toward ₹1L/month, with honest milestones and timelines, and state clearly whether the 1-year target is achievable or must be revised.

OUTPUT FORMAT — produce a single Markdown report with EXACTLY these sections:
## Executive Summary
(3-6 blunt bullet verdicts, each tagged [PASS]/[WARN]/[FAIL], including an honest verdict on the 1-year ₹1L/month goal)
## The Math — Is the Goal Feasible?
(exact numbers: required monthly return %, required capital base, realistic timeline)
## Codebase & Algorithm Review
(per-module findings with file:line, severity, and impact on profitability)
## Profitability Gaps
(specific reasons the current strategy loses money — e.g. low win rate, exit logic, regime mismatch)
## "No Monthly Loss" Guardrails
(concrete, implementable rules to guarantee a positive month-end P&L)
## Realistic Growth Plan (₹5k/₹10k → ₹1L/month)
(honest milestones, capital compounding, and a revised timeline if the 1-year target is unrealistic)
## Prioritized Action Items
(numbered, highest impact first, each with file reference)

Rules: ground every claim in the actual code; cite exact file paths and line numbers; never speculate beyond the code; mark unverifiable claims as "UNVERIFIED". Be specific, quantitative, and brutally honest — the user needs the truth about whether this goal is achievable, not encouragement.`;

async function main() {
  const baseURL = process.env.OLLAMA_BASE_URL;
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!baseURL || !apiKey) {
    console.error('Missing OLLAMA_BASE_URL / OLLAMA_API_KEY in .env. Add them (see .env.example).');
    process.exit(1);
  }
  const client = new OpenAI({ baseURL, apiKey, timeout: 180_000 });

  if (!existsSync(PROJECT_ROOT)) {
    console.error(`Error: project root '${PROJECT_ROOT}' does not exist.`);
    process.exit(1);
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const codeContext = buildContext(PROJECT_ROOT);
  console.log(`📦 Packaged ${codeContext.length.toLocaleString()} chars from ${PROJECT_ROOT}`);

  const model = process.env.AUDIT_MODEL_PROFIT || 'glm-5.2:cloud';
  console.log(`🤖 Querying [${model}] via ${baseURL}...`);
  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: `${PROMPT}\n\nCodebase:\n${codeContext}` }],
    temperature: 0.2,
  });
  const text = completion.choices?.[0]?.message?.content ?? '';
  const reportPath = join(OUTPUT_DIR, 'profit_strategy_audit.md');
  writeFileSync(reportPath, text);
  console.log(`✅ Saved report to: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
