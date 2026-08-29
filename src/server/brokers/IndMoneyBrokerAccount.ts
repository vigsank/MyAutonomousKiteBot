/**
 * IndMoneyBrokerAccount — `BrokerAccount` over the INDstocks (INDmoney) API.
 *
 * READ side is real: holdings, positions, and available cash come from the
 * INDstocks GET endpoints, so the Reconciler can compare the ledger against the
 * real INDmoney account.
 *
 * WRITE side is STUBBED: `placeOrder` does NOT call POST /order. It returns a
 * synthetic id and the caller (LiveTrader) persists the broker-order snapshot to
 * the ledger instead. Real order execution is deferred behind ALLOW_LIVE_ORDERS.
 */

import { AppConfig } from '../AppConfig';
import { logger } from '../Logger';
import { BrokerAccount, BrokerHolding } from '../BrokerAccount';
import { IndMoneyClient } from './IndMoneyClient';
import { securityIdToToken } from './indmoneyMapping';

export class IndMoneyBrokerAccount implements BrokerAccount {
  private client: IndMoneyClient;

  constructor(private readonly config: AppConfig) {
    this.client = new IndMoneyClient({
      accessToken: config.broker.indmoney.accessToken,
      baseUrl: config.broker.indmoney.baseUrl,
      timeoutMs: config.broker.indmoney.timeoutMs,
      rateDelayMs: config.broker.indmoney.rateDelayMs,
      maxRetries: config.broker.indmoney.maxRetries,
      retryBaseMs: config.broker.indmoney.retryBaseMs,
      rateLimit: {
        perSecond: config.broker.indmoney.ratePerSecond,
        perDay: config.broker.indmoney.ratePerDay,
        warnPct: config.broker.indmoney.rateWarnPct,
        maxWaitMs: config.broker.indmoney.rateMaxWaitMs,
        haltOn429: config.broker.indmoney.rateHaltOn429,
        halt429Threshold: config.broker.indmoney.rate429Threshold,
        cooldownMs: config.broker.indmoney.rateCooldownMs,
        haltOnLimit: config.broker.indmoney.rateHaltOnLimit,
      },
    });
  }

  async getBrokerHoldings(): Promise<BrokerHolding[]> {
    const holdings = await this.client.getHoldings();
    return holdings.map((h) => ({
      symbol: h.symbol,
      exchange: 'NSE',
      quantity: h.total_qty ?? 0,
      averagePrice: h.avg_price ?? 0,
      lastPrice: 0,
    }));
  }

  async getBrokerPositions(): Promise<BrokerHolding[]> {
    // Equity positions: CNC (delivery) + INTRADAY (MIS).
    const [cnc, intraday] = await Promise.all([
      this.client.getPositions('equity', 'cnc'),
      this.client.getPositions('equity', 'intraday'),
    ]);
    const rows = [...cnc, ...intraday];
    return rows
      .filter((p) => p.net_qty !== 0)
      .map((p) => ({
        symbol: p.symbol,
        exchange: p.exchange === 'BSE' ? 'BSE' : 'NSE',
        quantity: p.net_qty,
        averagePrice: p.avg_price ?? 0,
        lastPrice: 0,
      }));
  }

  async getAvailableCash(): Promise<number | null> {
    const funds = await this.client.getFunds();
    if (!funds) return null;
    return funds.detailed_avl_balance?.eq_cnc ?? null;
  }

  /**
   * STUBBED — does not place a real order. Returns a synthetic id so the
   * caller's flow is unchanged; the broker-order snapshot is persisted by
   * LiveTrader instead of a network call.
   */
  async placeOrder(params: {
    tradingsymbol: string;
    exchange: string;
    transaction_type: 'BUY' | 'SELL';
    quantity: number;
    product: string;
    order_type: string;
    price?: number;
    tag?: string;
  }): Promise<string> {
    const id = `STUB-${Date.now()}`;
    logger.info(
      {
        symbol: params.tradingsymbol,
        side: params.transaction_type,
        qty: params.quantity,
        id,
      },
      'IndMoneyBrokerAccount: order STUBBED (no real execution)',
    );
    return id;
  }

  /** Resolve a symbol to its INDstocks security_id (for snapshot building). */
  securityIdFor(symbol: string, exchange: string): string | null {
    // The streamer owns the instrument map; the broker account resolves via a
    // best-effort numeric token. Callers that need the real id should use the
    // streamer's findInstrument. Kept minimal here.
    void symbol;
    void exchange;
    return null;
  }
}

/** Re-export for convenience. */
export { securityIdToToken };
