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
  private readonly depthEnsembleModels: string[];
  private readonly fastEnsembleModels: string[];
  private ensembleModels: string[];
  private activeModel: string;
  private readonly jsonMode: boolean;
  private readonly hasKey: boolean;
  private readonly timeoutMs: number;
  readonly provider: LlmConfig['provider'];

  constructor(config: LlmConfig) {
    this.provider = config.provider;
    this.hasKey = config.apiKey.length > 0;
    this.timeoutMs = config.timeoutMs || 60000;

    // Normalise the model list: always non-empty, with the active model first.
    const list = config.models.length > 0 ? config.models : [config.activeModel];
    this.models = list.includes(config.activeModel)
      ? list
      : [config.activeModel, ...list];
    this.activeModel = config.activeModel;

    // Ensemble lists are already validated to be subsets of `models` by the
    // config layer; cap defensively at 3 here too. Default mode = depth.
    this.depthEnsembleModels = this.normaliseEnsemble(config.ensembleModels);
    this.fastEnsembleModels = this.normaliseEnsemble(config.fastEnsembleModels);
    this.ensembleModels = this.depthEnsembleModels;

    this.jsonMode = config.jsonMode;

    // Some providers (notably Ollama) accept any key string; pass a placeholder
    // when no real key is set so the SDK doesn't throw on construction.
    const apiKey = config.apiKey || 'ollama';
    this.client = new OpenAI({
      apiKey,
      baseURL: config.baseUrl || undefined,
      timeout: config.timeoutMs || 60000,
    });
  }

  /** True when a real API key was configured. */
  get configured(): boolean {
    return this.hasKey;
  }

  /** Cap a validated ensemble list to ≤3, active model first. */
  private normaliseEnsemble(list: string[] | undefined): string[] {
    const base = list && list.length ? list : this.models;
    const ordered = base.includes(this.activeModel)
      ? [this.activeModel, ...base.filter((m) => m !== this.activeModel)]
      : base;
    return ordered.slice(0, 3);
  }

  /**
   * Switch the ensemble between the depth (default) and fast model lists.
   * Used by the backtest harness to trade depth for speed on high-frequency
   * verdict loops. Returns the active ensemble list.
   */
  setEnsembleMode(mode: 'fast' | 'depth'): string[] {
    this.ensembleModels =
      mode === 'fast' ? this.fastEnsembleModels : this.depthEnsembleModels;
    return this.ensembleModels;
  }

  get ensembleMode(): 'fast' | 'depth' {
    return this.ensembleModels === this.fastEnsembleModels ? 'fast' : 'depth';
  }

  get availableModels(): string[] {
    return [...this.models];
  }

  /** Models that participate in the ensemble (a validated subset, ≤3). */
  get availableEnsembleModels(): string[] {
    return [...this.ensembleModels];
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

  /** Send a chat prompt and return the raw text response. */
  async chat(prompt: string): Promise<string> {
    const res = await this.createCompletion(prompt);
    return res.text;
  }

  /** Send a prompt and return the text plus trace metadata. */
  async chatWithMeta(
    prompt: string,
  ): Promise<{ text: string; model: string; tokensIn: number | null; tokensOut: number | null }> {
    const res = await this.createCompletion(prompt);
    return {
      text: res.text,
      model: this.activeModel,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
    };
  }

  /**
   * Ensemble: call the same prompt across multiple models and return each
   * model's text + name. Reduces decision variance (AI nondeterminism) by
   * combining verdicts from a few models instead of trusting one. Never throws.
   */
  async chatEnsemble(prompt: string, models?: string[]): Promise<Array<{ text: string; model: string }>> {
    // Prefer an explicit caller-supplied list; otherwise use the validated
    // ensemble subset. Always ≤3.
    const list = (models && models.length ? models : this.ensembleModels).slice(0, 3);
    const results = await Promise.all(
      list.map(async (model) => {
        const attempt = async (useJson: boolean): Promise<string> => {
          const params: any = {
            model,
            temperature: 0,
            messages: [{ role: 'user', content: prompt }],
          };
          if (useJson && this.jsonMode) params.response_format = { type: 'json_object' };
          const res = await this.callModel(params);
          return res.choices?.[0]?.message?.content ?? '';
        };
        try {
          return { text: await attempt(true), model };
        } catch {
          try {
            return { text: await attempt(false), model };
          } catch {
            return { text: '', model };
          }
        }
      }),
    );
    return results.filter((r) => r.text.length > 0);
  }

  /**
   * Call the chat-completions endpoint with a hard timeout so a hung model can
   * never block the ensemble or the run. Uses AbortController (guaranteed abort)
   * rather than relying on the SDK's timeout option.
   */
  private async callModel(params: any): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.client.chat.completions.create({ ...params, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async createCompletion(
    prompt: string,
  ): Promise<{ text: string; tokensIn: number | null; tokensOut: number | null }> {
    const params: any = {
      model: this.activeModel,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    };

    if (this.jsonMode) {
      params.response_format = { type: 'json_object' };
    }

    try {
      const res = await this.callModel(params);
      return this.toResult(res);
    } catch (err) {
      if (this.jsonMode) {
        delete params.response_format;
        const res = await this.callModel(params);
        return this.toResult(res);
      }
      throw err;
    }
  }

  private toResult(
    res: any,
  ): { text: string; tokensIn: number | null; tokensOut: number | null } {
    return {
      text: res.choices[0]?.message?.content ?? '',
      tokensIn: res.usage?.prompt_tokens ?? null,
      tokensOut: res.usage?.completion_tokens ?? null,
    };
  }
}
