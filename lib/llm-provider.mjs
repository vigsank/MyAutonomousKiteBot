/**
 * lib/llm-provider.mjs — shared LLM client helper for the audit scripts.
 *
 * Resolves a primary (Ollama) + optional fallback (LiteLLM) client from .env.
 * Any call that hits a 429 / quota / rate-limit on the primary is transparently
 * retried once on the LiteLLM fallback — UNLESS LLM_PROVIDER=litellm, in which
 * case LiteLLM is the primary and there is no fallback.
 *
 * Env vars consumed:
 *   LLM_PROVIDER  : ollama | litellm | openai  (controls routing)
 *   Primary (ollama)  : OLLAMA_BASE_URL, OLLAMA_API_KEY
 *   Fallback/direct (litellm): LITELLM_BASE_URL, LITELLM_API_KEY, LITELLM_MODEL
 */
import OpenAI from 'openai';

/** Default LiteLLM model — best single-model choice for deep analysis. */
const LITELLM_DEFAULT_MODEL = 'anthropic--claude-sonnet-latest';

/**
 * True when the error is a quota / rate-limit response from the primary.
 * @param {unknown} err
 */
export function isQuotaError(err) {
  if (!err) return false;
  const msg = String(err?.message ?? '').toLowerCase();
  const status = err?.status ?? err?.statusCode;
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('usage limit') ||
    msg.includes('quota')
  );
}

/**
 * Build and return { primary, fallback } OpenAI-compatible clients.
 *
 * - LLM_PROVIDER=litellm  → LiteLLM is the PRIMARY; fallback is null (fail hard).
 * - LLM_PROVIDER=ollama (default) → Ollama is primary; LiteLLM is fallback on 429.
 * - LLM_PROVIDER=openai   → OpenAI is primary; no fallback.
 *
 * @returns {{ primary: OpenAI, primaryBase: string, fallback: OpenAI|null, fallbackModel: string }}
 */
export function buildClients(timeoutMs = 180_000) {
  const provider = (process.env.LLM_PROVIDER ?? 'ollama').toLowerCase();

  // ── LiteLLM as the sole provider ──────────────────────────────────────────
  if (provider === 'litellm') {
    const base  = process.env.LITELLM_BASE_URL;
    const key   = process.env.LITELLM_API_KEY;
    const model = process.env.LITELLM_MODEL ?? LITELLM_DEFAULT_MODEL;
    if (!base || !key) {
      console.error('LLM_PROVIDER=litellm but LITELLM_BASE_URL / LITELLM_API_KEY are missing in .env.');
      process.exit(1);
    }
    const primary = new OpenAI({ baseURL: base, apiKey: key, timeout: timeoutMs });
    console.log(`🔷 LiteLLM is the primary provider (${model}) — no fallback.`);
    return { primary, primaryBase: base, fallback: null, fallbackModel: model };
  }

  // ── Ollama as primary (default) ───────────────────────────────────────────
  const primaryBase = process.env.OLLAMA_BASE_URL;
  const primaryKey  = process.env.OLLAMA_API_KEY;
  if (!primaryBase || !primaryKey) {
    console.error('Missing OLLAMA_BASE_URL / OLLAMA_API_KEY in .env. Add them (see .env.example).');
    process.exit(1);
  }
  const primary = new OpenAI({ baseURL: primaryBase, apiKey: primaryKey, timeout: timeoutMs });

  const fallbackBase  = process.env.LITELLM_BASE_URL;
  const fallbackKey   = process.env.LITELLM_API_KEY;
  const fallbackModel = process.env.LITELLM_MODEL ?? LITELLM_DEFAULT_MODEL;

  let fallback = null;
  if (fallbackBase && fallbackKey) {
    fallback = new OpenAI({ baseURL: fallbackBase, apiKey: fallbackKey, timeout: timeoutMs });
    console.log(`🔀 LiteLLM fallback configured (${fallbackModel}) — will activate on primary 429/quota.`);
  } else {
    console.log('ℹ️  No LiteLLM fallback — set LITELLM_BASE_URL + LITELLM_API_KEY to enable.');
  }

  return { primary, primaryBase, fallback, fallbackModel };
}

/**
 * Call chat-completions with 429-aware fallback.
 *
 * @param {{ primary: OpenAI, fallback: OpenAI|null, fallbackModel: string }} clients
 * @param {string} model          Primary model name (Ollama slug).
 * @param {string} content        The full user-message content.
 * @param {number} [temperature]  Defaults to 0.2.
 * @returns {Promise<string>}     The model's text response.
 */
export async function callWithFallback(clients, model, content, temperature = 0.2) {
  const { primary, fallback, fallbackModel } = clients;
  const messages = [{ role: 'user', content }];

  // Try primary.
  try {
    const res = await primary.chat.completions.create({ model, temperature, messages });
    return res.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    if (fallback && isQuotaError(err)) {
      console.warn(
        `⚠️  Primary quota/rate-limit hit (${model}) — retrying on LiteLLM fallback (${fallbackModel})…`,
      );
      const res = await fallback.chat.completions.create({
        model: fallbackModel,
        temperature,
        messages,
      });
      return res.choices?.[0]?.message?.content ?? '';
    }
    throw err; // re-throw if not a quota error or no fallback
  }
}
