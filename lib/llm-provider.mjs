/**
 * lib/llm-provider.mjs — shared LLM client helper for the audit scripts.
 *
 * Resolves a primary (Ollama) + optional fallback (LiteLLM) client from .env.
 * Any call that hits a 429 / quota / rate-limit on the primary is transparently
 * retried once on the LiteLLM fallback.
 *
 * Env vars consumed:
 *   Primary  : OLLAMA_BASE_URL, OLLAMA_API_KEY
 *   Fallback : LITELLM_BASE_URL, LITELLM_API_KEY, LITELLM_MODEL (optional)
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
 * `primary` is always required (exits with an error if missing).
 * `fallback` is null when LITELLM_BASE_URL / LITELLM_API_KEY are absent.
 *
 * @returns {{ primary: OpenAI, primaryBase: string, fallback: OpenAI|null, fallbackModel: string }}
 */
export function buildClients(timeoutMs = 180_000) {
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
