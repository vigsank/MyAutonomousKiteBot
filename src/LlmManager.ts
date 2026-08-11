import OpenAI from 'openai';
import { LlmConfig } from './AppConfig';

/**
 * LlmManager - a thin provider abstraction over the LLM used for sentiment.
 *
 * Both OpenAI and Ollama expose OpenAI-compatible chat-completions endpoints,
 * so a single OpenAI SDK client works for either provider — we only swap the
 * base URL, api key, and model. The active model can be switched at runtime
 * (e.g. from Telegram via `/model <name>`), and tested with `/llm`.
 */
export class LlmManager {
  private client: OpenAI;
  private readonly models: string[];
  private activeModel: string;
  private readonly jsonMode: boolean;
  private readonly hasKey: boolean;
  readonly provider: LlmConfig['provider'];

  constructor(config: LlmConfig) {
    this.provider = config.provider;
    this.hasKey = config.apiKey.length > 0;

    // Normalise the model list: always non-empty, with the active model first.
    const list = config.models.length > 0 ? config.models : [config.activeModel];
    this.models = list.includes(config.activeModel)
      ? list
      : [config.activeModel, ...list];
    this.activeModel = config.activeModel;

    this.jsonMode = config.jsonMode;

    // Some providers (notably Ollama) accept any key string; pass a placeholder
    // when no real key is set so the SDK doesn't throw on construction.
    const apiKey = config.apiKey || 'ollama';
    this.client = new OpenAI({
      apiKey,
      baseURL: config.baseUrl || undefined,
    });
  }

  /** True when a real API key was configured. */
  get configured(): boolean {
    return this.hasKey;
  }

  get availableModels(): string[] {
    return [...this.models];
  }

  get currentModel(): string {
    return this.activeModel;
  }

  /** Switch the active model at runtime. Returns false if the name is unknown. */
  switchModel(name: string): boolean {
    if (!this.models.includes(name)) return false;
    this.activeModel = name;
    return true;
  }

  /**
   * Send a chat prompt and return the raw text response.
   * If jsonMode is enabled and the provider rejects `response_format`, retries
   * without it for robustness (some Ollama models do not support that field).
   */
  async chat(prompt: string): Promise<string> {
    const params: any = {
      model: this.activeModel,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    };

    if (this.jsonMode) {
      params.response_format = { type: 'json_object' };
    }

    try {
      const res = await this.client.chat.completions.create(params);
      return res.choices[0]?.message?.content ?? '';
    } catch (err) {
      if (this.jsonMode) {
        delete params.response_format;
        const res = await this.client.chat.completions.create(params);
        return res.choices[0]?.message?.content ?? '';
      }
      throw err;
    }
  }
}
