/**
 * Read-only query layer over the SQLite ledger, powering the UI dashboard.
 *
 * This deliberately lives separate from `Ledger` (which writes/mutates state)
 * so the dashboard can only ever read — never corrupt trading state. All SQL
 * here targets the schema defined in migrations/V001__initial_schema.sql.
 *
 * An optional `schema` prefix lets the dashboard read from a separate schema
 * (e.g. `mock.*`) so a mock run never touches the main tables.
 */
import Database from 'better-sqlite3';
import { AppConfig } from '../AppConfig';

/* ==================================================================== */
/* Row shapes (mirror the normalized schema)                            */
/* ==================================================================== */

export interface PositionRow {
  symbol: string;
  exchange: string;
  quantity: number;
  avgPrice: number;
  lastPrice: number | null;
  direction: 'LONG' | 'SHORT';
  entryTime: string;
}

export interface OrderRow {
  orderId: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  status: string;
  orderType: string;
  product: string;
  reason: string;
  createdAt: string;
}

export interface TradeRow {
  tradeId: string;
  symbol: string;
  direction: string;
  quantity: number;
  price: number;
  pnl: number | null;
  status: string;
  reason: string;
  createdAt: string;
}

export interface SignalRow {
  signalId: number;
  symbol: string;
  direction: string;
  rsi: number | null;
  price: number;
  sentimentScore: number | null;
  reason: string;
  createdAt: string;
}

export interface RiskEventRow {
  riskEventId: number;
  symbol: string | null;
  eventType: string;
  details: string;
  createdAt: string;
}

export interface NotificationRow {
  notificationId: number;
  channel: string;
  severity: string;
  title: string;
  body: string;
  metadata: string | null;
  createdAt: string;
}

export interface DailySummaryRow {
  date: string;
  startingCapital: number;
  endingCapital: number;
  realizedPnl: number;
  unrealizedPnl: number | null;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  maxDrawdown: number | null;
}

export interface HealthRow {
  component: string;
  status: string;
  latencyMs: number | null;
  details: string | null;
  checkedAt: string;
}

export interface CandleRow {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ProbeRunRow {
  runId: string;
  runType: string;
  symbol: string;
  runAt: string;
  dayBias: string | null;
  verdict: string | null;
  summary: string | null;
}

export interface NewsArticleRow {
  symbol: string;
  source: string;
  title: string;
  link: string | null;
  summary: string | null;
  contentSource: string | null;
  publishedAt: string | null;
  fetchedAt: string;
}

export interface AgentSignalRow {
  symbol: string;
  direction: string;
  rsi: number | null;
  price: number;
  reason: string;
  createdAt: string;
}

export interface DailyReportRow {
  reportId: number;
  reportType: string;
  reportDate: string;
  reportJson: string;
  summary: string | null;
  createdAt: string;
}

export interface EodPerformanceRow {
  reportDate: string;
  realizedPnl: number;
  totalTrades: number;
  winning: number;
  losing: number;
  winRate: number | null;
  slippageTotal: number;
  executionAccuracy: number | null;
  summary: string | null;
  createdAt: string;
}

export interface OvernightMatrixRow {
  reportDate: string;
  symbol: string;
  gapRiskPct: number | null;
  flagged: number;
  events: string | null;
  createdAt: string;
}

export interface Overview {
  capital: { total: number; available: number; used: number };
  daily: DailySummaryRow | null;
  drawdown: number;
  counts: {
    openPositions: number;
    tradesToday: number;
    signalsToday: number;
    notificationsToday: number;
  };
  lastTradeTime: string | null;
  mode: string;
  strategyMode: string;
  watchlistCount: number;
}

/* ==================================================================== */
/* Query helpers                                                        */
/* ==================================================================== */

type Rows<T> = T[];

export class UiQueries {
  constructor(
    private readonly db: Database.Database,
    private readonly schema = '',
  ) {}

  /** Qualify a table name with the active schema (e.g. `mock.positions`). */
  private t(name: string): string {
    return this.schema ? `${this.schema}.${name}` : name;
  }

  /** Overview KPIs: capital, today's PnL, drawdown, counts, session mode. */
  overview(config: AppConfig): Overview {
    const dailyRow = this.db
      .prepare(
        `SELECT date, starting_capital AS startingCapital,
                ending_capital AS endingCapital, realized_pnl AS realizedPnl,
                unrealized_pnl AS unrealizedPnl, total_trades AS totalTrades,
                winning_trades AS winningTrades, losing_trades AS losingTrades,
                win_rate AS winRate, max_drawdown AS maxDrawdown
         FROM ${this.t('daily_summary')} ORDER BY date DESC LIMIT 1`,
      )
      .get() as DailySummaryRow | undefined;

    const usedCapital = this.usedCapital();
    const total = config.risk.availableCapital;

    const count = (sql: string): number =>
      (this.db.prepare(sql).get() as { n: number }).n;

    return {
      capital: {
        total,
        available: Math.max(0, total - usedCapital),
        used: usedCapital,
      },
      daily: dailyRow ?? null,
      drawdown: dailyRow?.maxDrawdown ?? 0,
      counts: {
        openPositions: count(
          `SELECT COUNT(*) AS n FROM ${this.t('positions')} WHERE status = 'OPEN'`,
        ),
        tradesToday: count(
          `SELECT COUNT(*) AS n FROM ${this.t('trades')} WHERE date(created_at) = date('now')`,
        ),
        signalsToday: count(
          `SELECT COUNT(*) AS n FROM ${this.t('signals')} WHERE date(created_at) = date('now')`,
        ),
        notificationsToday: count(
          `SELECT COUNT(*) AS n FROM ${this.t('notifications')} WHERE date(created_at) = date('now')`,
        ),
      },
      lastTradeTime: this.lastTradeTime(),
      mode: 'PAPER',
      strategyMode: config.strategy.mode,
      watchlistCount: config.watchlist.length,
    };
  }

  usedCapital(): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(quantity * avg_price), 0) AS used
         FROM ${this.t('positions')} WHERE status = 'OPEN'`,
      )
      .get() as { used: number };
    return row.used;
  }

  lastTradeTime(): string | null {
    const row = this.db
      .prepare(
        `SELECT created_at AS t FROM ${this.t('trades')} ORDER BY created_at DESC LIMIT 1`,
      )
      .get() as { t: string } | undefined;
    return row?.t ?? null;
  }

  positions(limit = 200): PositionRow[] {
    const rows = this.db
      .prepare(
        `SELECT i.tradingsymbol AS symbol, i.exchange AS exchange,
                p.quantity AS quantity, p.avg_price AS avgPrice,
                p.direction AS direction, p.entry_time AS entryTime,
                (SELECT last_price FROM ${this.t('ticks')} t
                   WHERE t.instrument_id = p.instrument_id
                   ORDER BY t.timestamp DESC LIMIT 1) AS lastPrice
         FROM ${this.t('positions')} p
         JOIN ${this.t('instruments')} i ON i.instrument_id = p.instrument_id
         WHERE p.status = 'OPEN'
         ORDER BY p.entry_time DESC
         LIMIT ?`,
      )
      .all(limit) as PositionRow[];

    return rows.map((r) => ({
      ...r,
      lastPrice: r.lastPrice ?? r.avgPrice,
    }));
  }

  orders(limit = 200): OrderRow[] {
    return this.db
      .prepare(
        `SELECT o.order_id AS orderId, i.tradingsymbol AS symbol,
                o.side AS side, o.quantity AS quantity, o.price AS price,
                o.status AS status, o.order_type AS orderType,
                o.product AS product, o.reason AS reason,
                o.created_at AS createdAt
         FROM ${this.t('orders')} o
         JOIN ${this.t('instruments')} i ON i.instrument_id = o.instrument_id
         ORDER BY o.created_at DESC
         LIMIT ?`,
      )
      .all(limit) as OrderRow[];
  }

  trades(limit = 200): TradeRow[] {
    return this.db
      .prepare(
        `SELECT t.trade_id AS tradeId, i.tradingsymbol AS symbol,
                t.direction AS direction, t.quantity AS quantity,
                t.price AS price, t.pnl AS pnl, t.status AS status,
                t.reason AS reason, t.created_at AS createdAt
         FROM ${this.t('trades')} t
         JOIN ${this.t('instruments')} i ON i.instrument_id = t.instrument_id
         ORDER BY t.created_at DESC
         LIMIT ?`,
      )
      .all(limit) as TradeRow[];
  }

  signals(limit = 200): SignalRow[] {
    return this.db
      .prepare(
        `SELECT s.signal_id AS signalId, i.tradingsymbol AS symbol,
                s.direction AS direction, s.rsi_value AS rsi,
                s.price AS price, s.sentiment_score AS sentimentScore,
                s.reason AS reason, s.created_at AS createdAt
         FROM ${this.t('signals')} s
         JOIN ${this.t('instruments')} i ON i.instrument_id = s.instrument_id
         ORDER BY s.created_at DESC
         LIMIT ?`,
      )
      .all(limit) as SignalRow[];
  }

  riskEvents(limit = 200): RiskEventRow[] {
    return this.db
      .prepare(
        `SELECT re.risk_event_id AS riskEventId,
                i.tradingsymbol AS symbol, re.event_type AS eventType,
                re.details AS details, re.created_at AS createdAt
         FROM ${this.t('risk_events')} re
         LEFT JOIN ${this.t('instruments')} i ON i.instrument_id = re.instrument_id
         ORDER BY re.created_at DESC
         LIMIT ?`,
      )
      .all(limit) as RiskEventRow[];
  }

  notifications(limit = 200): NotificationRow[] {
    return this.db
      .prepare(
        `SELECT notification_id AS notificationId, channel AS channel,
                severity AS severity, title AS title, body AS body,
                metadata AS metadata, created_at AS createdAt
         FROM ${this.t('notifications')}
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(limit) as NotificationRow[];
  }

  dailySummary(limit = 60): DailySummaryRow[] {
    return this.db
      .prepare(
        `SELECT date AS date, starting_capital AS startingCapital,
                ending_capital AS endingCapital, realized_pnl AS realizedPnl,
                unrealized_pnl AS unrealizedPnl, total_trades AS totalTrades,
                winning_trades AS winningTrades, losing_trades AS losingTrades,
                win_rate AS winRate, max_drawdown AS maxDrawdown
         FROM ${this.t('daily_summary')}
         ORDER BY date DESC
         LIMIT ?`,
      )
      .all(limit) as DailySummaryRow[];
  }

  health(limit = 50): HealthRow[] {
    return this.db
      .prepare(
        `SELECT component AS component, status AS status,
                latency_ms AS latencyMs, details AS details,
                checked_at AS checkedAt
         FROM ${this.t('health_checks')}
         ORDER BY checked_at DESC
         LIMIT ?`,
      )
      .all(limit) as HealthRow[];
  }

  /** Latest tick per symbol in the watchlist (for the live ticker). */
  latestTicks(): Rows<{ symbol: string; price: number; ts: string }> {
    return this.db
      .prepare(
        `SELECT i.tradingsymbol AS symbol, t.last_price AS price,
                t.timestamp AS ts
         FROM ${this.t('ticks')} t
         JOIN ${this.t('instruments')} i ON i.instrument_id = t.instrument_id
         WHERE t.timestamp = (
           SELECT MAX(t2.timestamp) FROM ${this.t('ticks')} t2
           WHERE t2.instrument_id = t.instrument_id
         )`,
      )
      .all() as Rows<{ symbol: string; price: number; ts: string }>;
  }

  candles(symbol: string, interval = '5minute', limit = 500): CandleRow[] {
    const rows = this.db
      .prepare(
        `SELECT c.timestamp AS timestamp, c.open AS open, c.high AS high,
                c.low AS low, c.close AS close, c.volume AS volume
         FROM ${this.t('candles')} c
         JOIN ${this.t('instruments')} i ON i.instrument_id = c.instrument_id
         WHERE i.tradingsymbol = ? AND c.interval = ?
         ORDER BY c.timestamp DESC
         LIMIT ?`,
      )
      .all(symbol, interval, limit) as CandleRow[];
    return rows.reverse();
  }

  /** Recent LLM call traces (observability — inspect why the agent decided X). */
  llmTraces(limit = 100): Array<{
    purpose: string;
    symbol: string | null;
    model: string;
    prompt: string;
    response: string;
    latencyMs: number;
    tokensIn: number | null;
    tokensOut: number | null;
    createdAt: string;
  }> {
    return this.db
      .prepare(
        `SELECT purpose, symbol, model, prompt, response,
                latency_ms AS latencyMs, tokens_in AS tokensIn,
                tokens_out AS tokensOut, created_at AS createdAt
           FROM llm_traces ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as any[];
  }

  /** Recent probe runs (fleet observability — what the agents concluded). */
  probeRuns(symbol?: string, limit = 100): ProbeRunRow[] {
    const base = `SELECT run_id AS runId, run_type AS runType,
                         symbol AS symbol, run_at AS runAt,
                         day_bias AS dayBias, verdict AS verdict,
                         summary AS summary
                  FROM ${this.t('probe_runs')}`;
    const rows = symbol
      ? this.db
          .prepare(`${base} WHERE symbol = ? ORDER BY run_at DESC LIMIT ?`)
          .all(symbol, limit)
      : this.db.prepare(`${base} ORDER BY run_at DESC LIMIT ?`).all(limit);
    return rows as ProbeRunRow[];
  }

  /** Recent news articles (fleet observability — what the agents read). */
  newsArticles(symbol?: string, limit = 100): NewsArticleRow[] {
    const base = `SELECT symbol AS symbol, source AS source,
                         title AS title, link AS link, summary AS summary,
                         content_source AS contentSource,
                         published_at AS publishedAt, fetched_at AS fetchedAt
                  FROM ${this.t('news_articles')}`;
    const rows = symbol
      ? this.db
          .prepare(`${base} WHERE symbol = ? ORDER BY fetched_at DESC LIMIT ?`)
          .all(symbol, limit)
      : this.db.prepare(`${base} ORDER BY fetched_at DESC LIMIT ?`).all(limit);
    return rows as NewsArticleRow[];
  }

  /** Recent daily reports (Reasoning Layer — the 3-stage report cycle). */
  dailyReports(reportType?: string, limit = 20): DailyReportRow[] {
    const base = `SELECT report_id AS reportId, report_type AS reportType,
                         report_date AS reportDate, report_json AS reportJson,
                         summary AS summary, created_at AS createdAt
                  FROM ${this.t('daily_reports')}`;
    const rows = reportType
      ? this.db
          .prepare(`${base} WHERE report_type = ? ORDER BY created_at DESC LIMIT ?`)
          .all(reportType, limit)
      : this.db.prepare(`${base} ORDER BY created_at DESC LIMIT ?`).all(limit);
    return rows as DailyReportRow[];
  }

  /** Recent EOD performance records. */
  eodPerformance(limit = 20): EodPerformanceRow[] {
    return this.db
      .prepare(
        `SELECT report_date AS reportDate, realized_pnl AS realizedPnl,
                total_trades AS totalTrades, winning_trades AS winning,
                losing_trades AS losing, win_rate AS winRate,
                slippage_total AS slippageTotal,
                execution_accuracy AS executionAccuracy, summary AS summary,
                created_at AS createdAt
           FROM ${this.t('eod_performance')} ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as EodPerformanceRow[];
  }

  /** Recent overnight holding-matrix rows. */
  overnightMatrix(limit = 50): OvernightMatrixRow[] {
    return this.db
      .prepare(
        `SELECT report_date AS reportDate, symbol AS symbol,
                gap_risk_pct AS gapRiskPct, flagged AS flagged,
                events AS events, created_at AS createdAt
           FROM ${this.t('overnight_matrix')} ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as OvernightMatrixRow[];
  }

  /** Recent agent signals (fleet observability — what the agents decided). */
  agentSignals(symbol?: string, limit = 100): AgentSignalRow[] {
    const base = `SELECT i.tradingsymbol AS symbol, s.direction AS direction,
                         s.rsi_value AS rsi, s.price AS price,
                         s.reason AS reason, s.created_at AS createdAt
                  FROM ${this.t('signals')} s
                  JOIN ${this.t('instruments')} i ON i.instrument_id = s.instrument_id`;
    const rows = symbol
      ? this.db
          .prepare(`${base} WHERE i.tradingsymbol = ? ORDER BY s.created_at DESC LIMIT ?`)
          .all(symbol, limit)
      : this.db.prepare(`${base} ORDER BY s.created_at DESC LIMIT ?`).all(limit);
    return rows as AgentSignalRow[];
  }

  /** Distinct intervals that exist in the candles table. */
  
  candleIntervals(): string[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT interval AS i FROM ${this.t('candles')} ORDER BY interval`,
      )
      .all() as Rows<{ i: string }>;
    return rows.map((r) => r.i);
  }
}
