import { AppConfig } from './AppConfig';
import { Ledger, directionToSide } from './Ledger';
import { logger } from './Logger';
import { PaperTrader } from './PaperTrader';
import { BrokerAccount } from './BrokerAccount';
import { Reconciler } from './Reconciler';
import { OrderGuard } from './OrderGuard';
import { TradeFill, TradeRequest } from './types';

/**
 * LiveTrader (E3) — the ONLY place in the codebase that can send a real order.
 *
 * Design: the paper ledger stays the system of record in every mode. All P&L,
 * reporting, risk state and reconciliation read from it. LiveTrader wraps
 * PaperTrader and, when (and only when) every gate is open, additionally
 * forwards the order to the broker.
 *
 * That means going live changes exactly one thing — whether the broker call
 * fires — instead of swapping in a parallel, less-tested execution path.
 *
 * Three gates, all of which must pass:
 *   1. `ALLOW_LIVE_ORDERS=true`   — master switch, opt-in, defaults false.
 *   2. `LIVE_SHADOW_MODE=false`   — opt-out, defaults true (payload logged only).
 *   3. Reconciliation is clean    — refuses to trade on a drifted book.
 *   4. Notional ≤ MAX_LIVE_ORDER_VALUE — a blast radius cap independent of the
 *      RiskEngine, so a sizing bug cannot send a huge order.
 *
 * Idempotency (E1) is enforced by the OrderGuard *before* execution, so a
 * retried or restarted flow cannot double-send.
 */
export class LiveTrader {
  constructor(
    private readonly config: AppConfig,
    private readonly ledger: Ledger,
    private readonly paper: PaperTrader,
    private readonly guard: OrderGuard,
    private readonly broker: BrokerAccount | null,
    private readonly reconciler: Reconciler | null,
  ) {}

  /** Human-readable mode, for logs and the daily report header. */
  get mode(): 'PAPER' | 'SHADOW' | 'LIVE' {
    if (!this.config.live.allowLiveOrders) return 'PAPER';
    return this.config.live.shadowMode ? 'SHADOW' : 'LIVE';
  }

  /**
   * Execute a trade exactly once per (intent, bucket).
   *
   * @returns the fill, or `null` when suppressed as a duplicate or blocked by
   *   a safety gate. Callers must treat `null` as "did not trade".
   */
  execute(request: TradeRequest, intent: string, bucket?: string): TradeFill | null {
    const blocked = this.blockReason(request);
    if (blocked) {
      logger.warn({ symbol: request.symbol, intent, reason: blocked }, 'Trade blocked');
      return null;
    }

    return this.guard.once(request, intent, () => {
      // The paper ledger is always written first: it is the system of record,
      // and a broker failure must never leave us with an untracked position.
      const fill = this.paper.execute(request);
      this.forwardToBroker(request, fill, intent);
      return fill;
    }, bucket);
  }

  /**
   * Pre-trade safety gates that are independent of the RiskEngine.
   * Returns a reason string when the trade must not proceed, else null.
   */
  private blockReason(request: TradeRequest): string | null {
    // A drifted book means we do not know what we own. Do not add to it.
    if (this.reconciler?.shouldHalt) {
      return 'reconciliation drift detected (HALT_ON_DRIFT)';
    }
    if (this.mode === 'LIVE') {
      const notional = Math.abs(request.ticketSize);
      if (notional > this.config.live.maxLiveOrderValue) {
        return (
          `order notional ${notional.toFixed(0)} exceeds MAX_LIVE_ORDER_VALUE ` +
          `${this.config.live.maxLiveOrderValue}`
        );
      }
      if (!this.broker) {
        return 'live orders enabled but no broker account is configured';
      }
    }
    return null;
  }

  /** Build the broker payload; send it only in LIVE mode. */
  private forwardToBroker(request: TradeRequest, fill: TradeFill, intent: string): void {
    if (this.mode === 'PAPER') return;

    const payload = {
      tradingsymbol: request.symbol,
      exchange: request.exchange,
      transaction_type: directionToSide(request.direction),
      quantity: request.quantity,
      product: request.product ?? 'CNC',
      order_type: 'MARKET',
      tag: intent.slice(0, 20),
    } as const;

    if (this.mode === 'SHADOW') {
      logger.info({ payload, intent }, 'SHADOW: order NOT sent (LIVE_SHADOW_MODE=true)');
      return;
    }

    // Fire-and-log: the ledger already reflects the intended state, so a broker
    // error surfaces as reconciliation drift on the next cycle rather than
    // silently diverging.
    this.broker!
      .placeOrder({ ...payload })
      .then((brokerOrderId) => {
        if (brokerOrderId) {
          this.ledger.setBrokerOrderIdForTrade(fill.tradeId, brokerOrderId);
        }
        logger.info({ symbol: request.symbol, brokerOrderId, intent }, 'LIVE order placed');
      })
      .catch((err: Error) => {
        this.ledger.recordReconciliation({
          status: 'ERROR',
          symbol: request.symbol,
          issue: 'MISSING_AT_BROKER',
          ledgerQty: request.quantity,
          brokerQty: 0,
          detail: `Live order failed: ${err?.message}. Ledger may be ahead of broker.`,
        });
        logger.error({ symbol: request.symbol, err: err?.message }, 'LIVE order FAILED');
      });
  }

  /** Log the active execution mode at startup so it is never ambiguous. */
  logMode(): void {
    const m = this.mode;
    const detail = {
      mode: m,
      allowLiveOrders: this.config.live.allowLiveOrders,
      shadowMode: this.config.live.shadowMode,
      haltOnDrift: this.config.live.haltOnDrift,
      maxLiveOrderValue: this.config.live.maxLiveOrderValue,
    };
    if (m === 'LIVE') {
      logger.warn(detail, '*** LIVE ORDER ROUTING ENABLED — REAL MONEY AT RISK ***');
    } else {
      logger.info(detail, `Execution mode: ${m}`);
    }
  }
}
