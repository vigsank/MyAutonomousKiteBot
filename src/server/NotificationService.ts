import Database from 'better-sqlite3';
import { AppConfig } from './AppConfig';
import { Ledger } from './Ledger';
import { logger } from './Logger';

export type NotificationSeverity =
  | 'INFO'
  | 'WARN'
  | 'ERROR'
  | 'TRADE'
  | 'APPROVAL'
  | 'SENTIMENT';

export type NotificationChannel = 'DB' | 'TELEGRAM' | 'BOTH';

export interface NotificationRecord {
  notification_id: number;
  channel: NotificationChannel;
  severity: NotificationSeverity;
  title: string;
  body: string;
  metadata: string | null;
  telegram_sent: number;
  created_at: string;
}

/**
 * NotificationService — all bot messages flow through here.
 *
 * Every notification is persisted to the `notifications` SQLite table.
 * If Telegram is enabled, the message is also forwarded to the configured
 * chat. This means you can turn off Telegram entirely and still have a
 * complete audit trail in the database.
 *
 * Usage:
 *   notify.info('RSI warmup complete', 'INFY RSI(14) = 45.2');
 *   notify.trade('BUY FILLED', 'INFY 50 @ 1850', { tradeId: '...' });
 *   notify.error('Kite disconnected', 'WebSocket closed unexpectedly');
 */
export class NotificationService {
  private db: Database.Database;
  private readonly ledger: Ledger;
  private telegramSender: ((text: string) => Promise<void>) | null = null;
  private telegramEnabled: boolean;

  constructor(
    ledger: Ledger,
    private readonly config: AppConfig,
  ) {
    this.ledger = ledger;
    this.db = ledger.raw();
    this.telegramEnabled = config.telegram.enabled;
  }

  /** Register a Telegram send function (called by TelegramHITL after init). */
  setTelegramSender(fn: (text: string) => Promise<void>): void {
    this.telegramSender = fn;
  }

  get isTelegramEnabled(): boolean {
    return this.telegramEnabled && this.telegramSender !== null;
  }

  /* ---- severity shortcuts ---- */

  info(title: string, body: string, metadata?: Record<string, unknown>): void {
    this.notify('INFO', title, body, metadata);
  }

  warn(title: string, body: string, metadata?: Record<string, unknown>): void {
    this.notify('WARN', title, body, metadata);
  }

  error(title: string, body: string, metadata?: Record<string, unknown>): void {
    this.notify('ERROR', title, body, metadata);
  }

  trade(title: string, body: string, metadata?: Record<string, unknown>): void {
    this.notify('TRADE', title, body, metadata);
  }

  approval(title: string, body: string, metadata?: Record<string, unknown>): void {
    this.notify('APPROVAL', title, body, metadata);
  }

  sentiment(title: string, body: string, metadata?: Record<string, unknown>): void {
    this.notify('SENTIMENT', title, body, metadata);
  }

  /* ---- core ---- */

  private notify(
    severity: NotificationSeverity,
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
  ): void {
    const channel: NotificationChannel = this.isTelegramEnabled ? 'BOTH' : 'DB';
    const metaJson = metadata ? JSON.stringify(metadata) : null;

    this.ledger.recordNotification({
      channel,
      severity,
      title,
      body,
      metadata: metaJson,
      telegramSent: this.isTelegramEnabled ? 1 : 0,
    });

    // Forward to Telegram asynchronously (fire-and-forget).
    if (this.isTelegramEnabled && this.telegramSender) {
      const text = this.formatForTelegram(severity, title, body);
      this.telegramSender(text).catch((err) => {
        logger.error({ err }, 'Telegram forward failed');
      });
    }
  }

  private formatForTelegram(
    severity: NotificationSeverity,
    title: string,
    body: string,
  ): string {
    const icons: Record<NotificationSeverity, string> = {
      INFO: 'ℹ️',
      WARN: '⚠️',
      ERROR: '🚨',
      TRADE: '💰',
      APPROVAL: '👤',
      SENTIMENT: '📰',
    };
    const icon = icons[severity] ?? '📌';
    return `${icon} <b>${title}</b>\n${body}`;
  }

  /* ---- query ---- */

  /** Return the most recent N notifications. */
  recent(limit = 50): NotificationRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as NotificationRecord[];
  }

  /** Count notifications by severity since a given date. */
  countBySeverity(since: string): Array<{ severity: string; count: number }> {
    return this.db
      .prepare(
        `SELECT severity, COUNT(*) AS count
           FROM notifications
          WHERE created_at >= ?
          GROUP BY severity`,
      )
      .all(since) as Array<{ severity: string; count: number }>;
  }
}
