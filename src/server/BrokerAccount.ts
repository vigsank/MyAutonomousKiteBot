/**
 * BrokerAccount — the narrow slice of the broker API the bot needs for
 * live-trading readiness (Phase E).
 *
 * Deliberately small: reconciliation (E2) and order placement (E3) only. Market
 * data continues to flow through `LiveDataProvider`. Keeping this separate means
 * the reconciler and LiveTrader can be tested against a stub without dragging in
 * the whole Kite streamer.
 *
 * Both the real `kiteconnect` SDK and the `kite-paper-node` npm package's
 * drop-in mock satisfy this shape, so the same code path runs in paper and live.
 */

export interface BrokerHolding {
  symbol: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
}

export interface BrokerAccount {
  /** Delivery (CNC) holdings. */
  getBrokerHoldings(): Promise<BrokerHolding[]>;
  /** Net open positions. */
  getBrokerPositions(): Promise<BrokerHolding[]>;
  /** Available equity cash, or null when unavailable. */
  getAvailableCash(): Promise<number | null>;
  /** Place an order; resolves to the broker's order id. */
  placeOrder(params: {
    tradingsymbol: string;
    exchange: string;
    transaction_type: 'BUY' | 'SELL';
    quantity: number;
    product: string;
    order_type: string;
    price?: number;
    tag?: string;
  }): Promise<string>;
}
