import TelegramBot from 'node-telegram-bot-api';
import { AppConfig } from './AppConfig';
import { LlmManager } from './LlmManager';
import { NotificationService } from './NotificationService';
import { logger } from './Logger';
import { TradeRequest } from './types';

export type ApprovalDecision = 'APPROVED' | 'REJECTED' | 'TIMEOUT' | 'DISABLED';

export interface ApprovalResult {
  decision: ApprovalDecision;
}

/**
 * TelegramHITL - the human-in-the-loop approval bridge.
 *
 * All one-way notifications flow through NotificationService (DB-first,
 * Telegram optional). This class handles only the interactive approval flow
 * and the /stop, /status, /models, /model, /llm commands.
 *
 * When Telegram is disabled, trades auto-approve (still gated by RiskEngine)
 * and all notifications are written to SQLite only.
 */
export class TelegramHITL {
  private bot: TelegramBot | null = null;
  private stopped = false;
  /**
   * Serializes approvals so only one is pending at a time — a single
   * "approve" message can't resolve multiple simultaneously-pending trades.
   */
  private approvalQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly config: AppConfig,
    private readonly llm: LlmManager,
    private readonly notify: NotificationService,
  ) {
    if (config.telegram.enabled) {
      this.bot = new TelegramBot(config.telegram.botToken, { polling: true });
      this.bot.setMyCommands([
        { command: 'stop', description: 'Stop the trading bot' },
        { command: 'status', description: 'Get current bot status' },
        { command: 'models', description: 'List available LLM models' },
        { command: 'model', description: 'Switch LLM model: /model <name>' },
        { command: 'llm', description: 'Test the active LLM: /llm <question>' },
      ]);
      this.bot.onText(/\/stop/, () => this.stop());
      this.bot.onText(/\/status/, async () => {
        await this.sendTelegram(this.statusMessage());
      });
      this.bot.onText(/\/models/, async () => {
        await this.sendTelegram(this.modelsMessage());
      });
      this.bot.onText(/\/model\s+(.+)/, async (_msg, match) => {
        await this.handleModelSwitch(match?.[1]?.trim() ?? '');
      });
      this.bot.onText(/\/llm(?:\s+(.+))?/, async (_msg, match) => {
        await this.testLlm(match?.[1]?.trim());
      });

      // Register the Telegram sender with NotificationService so all
      // DB notifications are also forwarded to Telegram.
      this.notify.setTelegramSender((text) => this.sendTelegram(text));

      logger.info('Telegram bot enabled and polling');
    } else {
      logger.info('Telegram disabled — notifications are DB-only');
    }
  }

  get enabled(): boolean {
    return this.config.telegram.enabled;
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  /** Send a message directly to Telegram (bypasses NotificationService). */
  async sendTelegram(text: string): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.sendMessage(this.config.telegram.chatId, text, {
        parse_mode: 'HTML',
      });
    } catch (err) {
      logger.error({ err }, 'Telegram send failed');
    }
  }

  /**
   * Ask a human to approve or reject a trade. Waits up to timeoutMs for the
   * words "approve"/"yes" or "reject"/"no" in the next message.
   *
   * When Telegram is disabled, returns APPROVED immediately (RiskEngine still
   * gates the trade).
   */
  async requestApproval(
    trade: TradeRequest,
    timeoutMs = 120_000,
  ): Promise<ApprovalResult> {
    if (!this.enabled || !this.bot) {
      return { decision: 'DISABLED' };
    }

    // Serialize: only one approval is pending at a time, so a single
    // "approve"/"reject" message resolves only the current trade.
    const run = this.approvalQueue.then(() => this.runApproval(trade, timeoutMs));
    this.approvalQueue = run.catch(() => undefined);
    return run;
  }

  private async runApproval(
    trade: TradeRequest,
    timeoutMs: number,
  ): Promise<ApprovalResult> {
    const bot = this.bot!;

    await this.sendTelegram(this.tradePrompt(trade));

    return new Promise<ApprovalResult>((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve({ decision: 'TIMEOUT' });
      }, timeoutMs);

      const handler = (msg: TelegramBot.Message) => {
        const chatId = String(msg.chat.id);
        if (chatId !== String(this.config.telegram.chatId)) return;
        const text = (msg.text ?? '').toLowerCase();
        if (/\b(approve|yes|ok|confirm)\b/.test(text)) {
          cleanup();
          resolve({ decision: 'APPROVED' });
        } else if (/\b(reject|no|cancel|decline)\b/.test(text)) {
          cleanup();
          resolve({ decision: 'REJECTED' });
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        bot.removeListener('message', handler);
      };

      bot.on('message', handler);
    });
  }

  /* ---- command handlers ---- */

  private tradePrompt(trade: TradeRequest): string {
    return (
      `⚠️ <b>Human approval required</b>\n` +
      `Trade exceeds auto-ticket threshold.\n\n` +
      `• Symbol: <b>${trade.exchange}:${trade.symbol}</b>\n` +
      `• Direction: <b>${trade.direction}</b>\n` +
      `• Quantity: <b>${trade.quantity}</b>\n` +
      `• Est. price: <b>₹${trade.entryPrice.toFixed(2)}</b>\n` +
      `• Ticket size: <b>₹${trade.ticketSize.toFixed(2)}</b>\n` +
      `• Reason: ${escapeHtml(trade.reason)}\n\n` +
      `Reply <b>approve</b> or <b>reject</b> within 2 minutes.`
    );
  }

  private statusMessage(): string {
    const state = this.isStopped ? '🛑 STOPPED' : '🟢 RUNNING';
    const watch = this.config.watchlist
      .filter((s) => s.enabled)
      .map((s) => s.tradingsymbol)
      .join(', ');
    const llm = this.llm.configured
      ? `${this.llm.provider.toUpperCase()} (${this.llm.currentModel})`
      : 'not configured';
    const tg = this.enabled ? 'enabled' : 'DB-only';
    return (
      `📊 <b>Bot Status</b>\n` +
      `State: ${state}\n` +
      `Watchlist: ${watch || '(none)'}\n` +
      `LLM: ${llm}\n` +
      `Notifications: ${tg}\n` +
      `Auto-trade threshold: ₹${this.config.risk.autoTradeTicketThreshold}`
    );
  }

  private modelsMessage(): string {
    if (!this.llm.configured) {
      return '🤖 <b>LLM not configured.</b> Set OLLAMA_API_KEY / OPENAI_API_KEY in .env.';
    }
    const active = this.llm.currentModel;
    const list = this.llm.availableModels
      .map((m) => (m === active ? `• <b>${m}</b> (active)` : `• ${m}`))
      .join('\n');
    return (
      `🤖 <b>Available models (${this.llm.provider})</b>\n${list}\n\n` +
      `Switch with: /model &lt;name&gt;`
    );
  }

  private async handleModelSwitch(name: string): Promise<void> {
    if (!this.llm.configured) {
      await this.sendTelegram('🤖 LLM not configured.');
      return;
    }
    if (!name) {
      await this.sendTelegram(
        `Usage: /model &lt;name&gt;\n${this.llm.availableModels.join(', ')}`,
      );
      return;
    }
    if (this.llm.switchModel(name)) {
      await this.sendTelegram(`🔄 Switched active LLM model to <b>${name}</b>.`);
    } else {
      await this.sendTelegram(
        `❌ Unknown model <b>${name}</b>. Available: ${this.llm.availableModels.join(', ')}`,
      );
    }
  }

  private async testLlm(prompt?: string): Promise<void> {
    if (!this.llm.configured) {
      await this.sendTelegram('🤖 LLM not configured. Set your API key in .env.');
      return;
    }
    const testPrompt = prompt ?? 'Reply with the single word: OK';
    await this.sendTelegram(`🔎 Testing model <b>${this.llm.currentModel}</b>...`);
    try {
      const start = Date.now();
      const res = await this.llm.chat(testPrompt);
      const ms = Date.now() - start;
      const snippet = escapeHtml((res || '(empty response)').slice(0, 500));
      await this.sendTelegram(
        `✅ <b>${this.llm.currentModel}</b> responded in ${ms}ms.\n<pre>${snippet}</pre>`,
      );
    } catch (err: any) {
      await this.sendTelegram(
        `❌ LLM test failed: ${escapeHtml(String(err?.message ?? err))}`,
      );
    }
  }

  /** Kill-switch: gracefully signals a stop. */
  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.notify.warn('Kill-switch engaged', 'Bot stopped by human command.');
    logger.warn('Kill-switch triggered by human');
  }

  stopPolling(): void {
    try {
      this.bot?.stopPolling?.();
    } catch (err) {
      /* ignore */
    }
  }
}

/** Escape a string for Telegram HTML parse mode. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
