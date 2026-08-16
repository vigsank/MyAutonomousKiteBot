import { AppConfig } from './AppConfig';
import { Ledger } from './Ledger';
import { logger } from './Logger';
import { BrokerAccount, BrokerHolding } from './BrokerAccount';

/**
 * Reconciler (E2) — ledger ⇄ broker state reconciliation.
 *
 * The ledger is the bot's belief about what it owns; the broker is the truth.
 * They drift whenever an order is rejected after we recorded it, a fill is
 * partial, a corporate action adjusts quantity, or the user trades manually in
 * the Kite app. Trading on a stale belief is how a bot doubles a position or
 * "sells" stock it does not hold.
 *
 * This reconciler compares the two and **reports** drift. It deliberately does
 * NOT auto-correct: silently rewriting the ledger to match the broker would
 * erase the evidence needed to find the bug that caused the drift. Every
 * finding is persisted to `reconciliation_log` for audit.
 *
 * `HALT_ON_DRIFT` (default on) makes a drifted state block new entries, which
 * is the safe default for real money.
 */

export type ReconIssue =
  | 'MISSING_AT_BROKER'
  | 'MISSING_IN_LEDGER'
  | 'QUANTITY_MISMATCH'
  | 'PRICE_DRIFT'
  | 'CASH_MISMATCH';

export interface ReconFinding {
  symbol: string;
  issue: ReconIssue;
  ledgerQty: number;
  brokerQty: number;
  detail: string;
}

export interface ReconResult {
  ok: boolean;
  checked: number;
  findings: ReconFinding[];
  /** True when the broker could not be reached (inconclusive, not clean). */
  inconclusive: boolean;
}

/** Average price drift beyond this % is worth flagging (corp. actions, splits). */
const PRICE_DRIFT_PCT = 5;

export class Reconciler {
  private lastResult: ReconResult | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly ledger: Ledger,
    private readonly broker: BrokerAccount | null,
  ) {}

  /** The most recent reconciliation outcome (null until the first run). */
  get last(): ReconResult | null {
    return this.lastResult;
  }

  /**
   * True when trading should be blocked because the last reconciliation found
   * drift. Inconclusive runs (broker unreachable) do NOT block — that would
   * make a transient network blip halt the bot.
   */
  get shouldHalt(): boolean {
    if (!this.config.live.haltOnDrift) return false;
    return !!this.lastResult && !this.lastResult.ok && !this.lastResult.inconclusive;
  }

  /** Compare ledger open positions against broker holdings + positions. */
  async reconcile(): Promise<ReconResult> {
    if (!this.broker) {
      const res: ReconResult = { ok: true, checked: 0, findings: [], inconclusive: true };
      this.lastResult = res;
      return res;
    }

    let brokerRows: BrokerHolding[];
    try {
      const [holdings, positions] = await Promise.all([
        this.broker.getBrokerHoldings(),
        this.broker.getBrokerPositions(),
      ]);
      brokerRows = mergeHoldings([...holdings, ...positions]);
    } catch (err) {
      logger.warn({ err: (err as Error)?.message }, 'Reconciler: broker unreachable');
      this.ledger.recordReconciliation({
        status: 'ERROR',
        detail: `Broker unreachable: ${(err as Error)?.message}`,
      });
      const res: ReconResult = { ok: true, checked: 0, findings: [], inconclusive: true };
      this.lastResult = res;
      return res;
    }

    const ledgerRows = this.ledger.getOpenPositions();
    const brokerBySymbol = new Map(brokerRows.map((b) => [b.symbol.toUpperCase(), b]));
    const findings: ReconFinding[] = [];

    // Ledger → broker: does everything we think we own actually exist?
    for (const p of ledgerRows) {
      const b = brokerBySymbol.get(p.symbol.toUpperCase());
      if (!b) {
        findings.push({
          symbol: p.symbol,
          issue: 'MISSING_AT_BROKER',
          ledgerQty: p.quantity,
          brokerQty: 0,
          detail: `Ledger holds ${p.quantity} but the broker reports no position.`,
        });
        continue;
      }
      if (b.quantity !== p.quantity) {
        findings.push({
          symbol: p.symbol,
          issue: 'QUANTITY_MISMATCH',
          ledgerQty: p.quantity,
          brokerQty: b.quantity,
          detail: `Ledger ${p.quantity} vs broker ${b.quantity}.`,
        });
      }
      if (p.avgPrice > 0 && b.averagePrice > 0) {
        const drift = (Math.abs(b.averagePrice - p.avgPrice) / p.avgPrice) * 100;
        if (drift > PRICE_DRIFT_PCT) {
          findings.push({
            symbol: p.symbol,
            issue: 'PRICE_DRIFT',
            ledgerQty: p.quantity,
            brokerQty: b.quantity,
            detail:
              `Avg price ledger ${p.avgPrice.toFixed(2)} vs broker ` +
              `${b.averagePrice.toFixed(2)} (${drift.toFixed(1)}% drift) — ` +
              `possible corporate action or partial fill.`,
          });
        }
      }
    }

    // Broker → ledger: anything held that the bot does not know about (e.g. a
    // manual trade in the Kite app) must not be silently traded over.
    const ledgerSymbols = new Set(ledgerRows.map((p) => p.symbol.toUpperCase()));
    for (const b of brokerRows) {
      if (b.quantity !== 0 && !ledgerSymbols.has(b.symbol.toUpperCase())) {
        findings.push({
          symbol: b.symbol,
          issue: 'MISSING_IN_LEDGER',
          ledgerQty: 0,
          brokerQty: b.quantity,
          detail: `Broker holds ${b.quantity} that the ledger does not track (manual trade?).`,
        });
      }
    }

    const result: ReconResult = {
      ok: findings.length === 0,
      checked: Math.max(ledgerRows.length, brokerRows.length),
      findings,
      inconclusive: false,
    };
    this.persist(result);
    this.lastResult = result;
    return result;
  }

  private persist(result: ReconResult): void {
    if (result.ok) {
      this.ledger.recordReconciliation({
        status: 'OK',
        detail: `Reconciled ${result.checked} position(s); no drift.`,
      });
      logger.info({ checked: result.checked }, 'Reconciliation clean');
      return;
    }
    for (const f of result.findings) {
      this.ledger.recordReconciliation({
        status: 'DRIFT',
        symbol: f.symbol,
        issue: f.issue,
        ledgerQty: f.ledgerQty,
        brokerQty: f.brokerQty,
        detail: f.detail,
      });
    }
    logger.error(
      { findings: result.findings.length, issues: result.findings.map((f) => f.issue) },
      'Reconciliation DRIFT detected — review before trading',
    );
  }
}

/** Sum duplicate symbols (a symbol can appear in both holdings and positions). */
function mergeHoldings(rows: BrokerHolding[]): BrokerHolding[] {
  const map = new Map<string, BrokerHolding>();
  for (const r of rows) {
    const key = r.symbol.toUpperCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...r });
      continue;
    }
    const totalQty = existing.quantity + r.quantity;
    map.set(key, {
      ...existing,
      quantity: totalQty,
      averagePrice:
        totalQty === 0
          ? existing.averagePrice
          : (existing.averagePrice * existing.quantity + r.averagePrice * r.quantity) /
            totalQty,
    });
  }
  return [...map.values()];
}
