#!/usr/bin/env node
/**
 * run_code_audit.mjs — Node.js CLI that audits the ENTIRE src/server codebase
 * with two Ollama Cloud models running IN PARALLEL (architecture + guardrails),
 * each with a tailored prompt, and writes a Markdown report per model.
 *
 * It reuses the project's existing Ollama config from `.env`:
 *   OLLAMA_BASE_URL  (OpenAI-compatible endpoint, e.g. https://ollama.com/v1)
 *   OLLAMA_API_KEY
 * These are the same values the bot's LlmManager uses, so no extra setup.
 *
 * Usage:
 *   npm run audit:code
 *
 * Reports are written to src/server/audit-report/.
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
/* Model matrix — each model gets a tailored, structured prompt.       */
/* Model names can be overridden via env (AUDIT_MODEL_*).              */
/* ------------------------------------------------------------------ */

const auditTasks = [
  {
    model: process.env.AUDIT_MODEL_ARCH || 'glm-5.2:cloud',
    file: 'glm_agent_report.md',
    prompt: `You are a principal software architect and security reviewer performing a rigorous, evidence-based audit of an autonomous paper-trading bot. Ground every claim ONLY in the code provided below — never invent behavior that is not present.

AUDIT FOCUS (in priority order):
1. Architectural soundness: dependency cycles, tight coupling, god objects, missing separation of concerns, and whether the dependency-injection wiring in index.ts is correct and complete.
2. Multi-tool / agentic failure modes: how MarketAgent orchestrates the streamer, ledger, risk engine, trader, LLM, news, and options engines. Look for unbounded loops, missing error handling, swallowed exceptions, retry storms, deadlocks, and state that can drift between components.
3. API execution safety: every place that places orders, mutates the ledger, or calls external APIs (Kite, LLM, Tavily, Telegram). Flag missing try/catch, unvalidated inputs, unsafe type casts, and any path that could place a trade or persist state without going through the RiskEngine gatekeeper.

OUTPUT FORMAT — produce a single Markdown report with EXACTLY these sections:
## Executive Summary
(3-5 bullet verdicts, each tagged [PASS]/[WARN]/[FAIL])
## Findings
For EACH finding use this template:
- **Severity:** CRITICAL | HIGH | MEDIUM | LOW
- **File:** <path>:<line>
- **Issue:** <one-line description>
- **Evidence:** <quote the exact code>
- **Impact:** <what breaks or what risk it creates>
- **Recommendation:** <concrete fix>
## Positive Observations
## Prioritized Action Items
(a numbered list, highest severity first, each with a file reference)

Rules: cite exact file paths and line numbers from the code; never speculate beyond the code; if a claim cannot be verified from the code, say "UNVERIFIED" instead of guessing. Be specific and actionable, not generic.`,
  },
  {
    model: process.env.AUDIT_MODEL_GUARD || 'gemma4',
    file: 'gemma_guardrail_report.md',
    prompt: `You are a security and data-integrity auditor specializing in financial systems and LLM pipelines. Perform a rigorous audit of this trading bot, grounded ONLY in the code below.

AUDIT FOCUS (in priority order):
1. Data validation & integrity: every point where external data enters the system (Kite ticks/quotes, RSS news, Tavily search results, LLM JSON output, config/env). Flag missing validation, unvalidated type casts, and trust of unverified external input.
2. Prompt / input injection: how LLM prompts are constructed from news articles, search results, and symbol names. Identify any place where untrusted text is interpolated into a prompt without sanitization, and any risk of prompt injection or command injection.
3. Math hallucination & numeric correctness: indicator math (RSI/ADX/ATR), PnL/drawdown/capital calculations, and any place a wrong formula or floating-point issue could produce incorrect trading decisions. Flag integer/float misuse, division by zero, and sign errors.
4. Secret handling: any hardcoded keys, tokens, or credentials; confirm secrets come from env/config and are never logged.

OUTPUT FORMAT — produce a single Markdown report with EXACTLY these sections:
## Executive Summary
(3-5 bullet verdicts, each tagged [PASS]/[WARN]/[FAIL])
## Data Validation Findings
For EACH finding use this template:
- **Severity:** CRITICAL | HIGH | MEDIUM | LOW
- **File:** <path>:<line>
- **Issue:** <one-line description>
- **Evidence:** <quote the exact code>
- **Impact:** <what breaks or what risk it creates>
- **Recommendation:** <concrete fix>
## Injection Findings
(same template)
## Numeric / Math Findings
(same template)
## Secret Handling Findings
(same template)
## Positive Observations
## Prioritized Action Items
(numbered, highest severity first, each with a file reference)

Rules: cite exact file paths and line numbers; only report issues you can substantiate from the code; mark unverifiable claims as "UNVERIFIED". Be specific and actionable.`,
  },
];

/* ------------------------------------------------------------------ */
/* Main — run all models in parallel                                  */
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

  // Fire all models concurrently (Ollama Cloud supports parallel calls).
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
  console.log(failed === 0 ? '🎉 All audits complete.' : `⚠️ ${failed} model(s) failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
