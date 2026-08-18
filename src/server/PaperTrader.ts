import { AppConfig } from './AppConfig';
import {
  Ledger,
  directionToSide,
  newTradeId,
} from './Ledger';
import { Position, TradeFill, TradeRequest } from './types';

/**
 * PaperTrader - simulated execution against virtual capital.
 *
 * All buy/sell actions are simulated. Nothing touches a real Kite order.
 * Every fill is persisted to the SQLite ledger so the strategy can be
 * evaluated and backtested before any real capital is used.
 *
 * Paper fills are made realistic by applying adverse slippage to the fill
 * price and NSE-style charges (brokerage + statutory + GST) so paper P&L is
 * net of costs rather than optimistically zero-fee.
 */
export class PaperTrader {
  constructor(
    private readonly config: AppConfig,
    private readonly ledger: Ledger,
  ) {}

  /** Apply adverse slippage: a BUY fills a touch higher, a SELL a touch lower. */
  private applySlippage(price: number, side: 'BUY' | 'SELL'): number {
    const adj = price * this.config.costs.slippageBps / 10000;
    return side === 'BUY' ? price + adj : price - adj;
  }

  /** Total charges (brokerage capped + statutory + GST) on a leg's notional. */
  private charges(notional: number): number {
    const c = this.config.costs;
    const n = Math.abs(notional);
    let brokerage = (n * c.brokerageBps) / 10000;
    if (c.brokerageMax > 0) brokerage = Math.min(brokerage, c.brokerageMax);
    const statutory = (n * c.statutoryBps) / 10000;
    const gst = (brokerage * c.gstPct) / 100;
    return brokerage + statutory + gst;
  }

  /**
   * Execute a paper trade request and return the fill. The risk engine must
   * already have approved this request; this method just simulates the fill.
   */
  execute(request: TradeRequest): TradeFill {
    const side = directionToSide(request.direction);
    const fillPrice = this.applySlippage(request.entryPrice, side);

    const fill = this.ledger.transaction(() => {
      // Existing position for the symbol.
      const existing = this.ledger.getPosition(request.symbol, request.exchange);

      if (existing) {
        // Opposite direction: reduce (partial) or close (full) the position.
        if (existing.direction !== request.direction) {
          const closeSide = directionToSide(request.direction);
          const exitFill = this.applySlippage(request.entryPrice, closeSide);
          // NSE CNC cannot go short: an oversized sell clamps to what is held.
          const sellQty = Math.min(request.quantity, existing.quantity);
          const grossPnl = this.computeClosePnl(existing, exitFill, sellQty);
          // Net of costs: entry leg on the sold slice + exit leg on the sold slice.
          const totalCharges =
            this.charges(existing.avgPrice * sellQty) +
            this.charges(exitFill * sellQty);
          const closePnl = grossPnl - totalCharges;
          const tradeId = newTradeId();
          const fillOut: TradeFill = {
            tradeId,
            symbol: request.symbol,
            exchange: request.exchange,
            direction: request.direction,
            quantity: sellQty,
            price: exitFill,
            ticketSize: sellQty * exitFill,
            pnl: closePnl,
            status: 'FILLED',
            reason:
              sellQty < existing.quantity
                ? `Reduced ${existing.direction} position (${sellQty} of ${existing.quantity}). ${request.reason}`
                : `Closed ${existing.direction} position. ${request.reason}`,
            timestamp: request.timestamp,
          };
          this.ledger.recordTrade(fillOut);
          this.recordOrder(request, side, tradeId, sellQty < existing.quantity ? 'TRIM' : 'CLOSE');
          if (sellQty >= existing.quantity) {
            this.ledger.closePosition(request.symbol, exitFill, closePnl);
          } else {
            this.ledger.upsertPosition({
              ...existing,
              quantity: existing.quantity - sellQty,
              avgPrice: existing.avgPrice,
            });
          }
          return fillOut;
        }
        // Same direction: augment position (weighted average price, slippage-adjusted).
        const newQty = existing.quantity + request.quantity;
        const newAvg =
          (existing.avgPrice * existing.quantity +
            fillPrice * request.quantity) /
          newQty;
        this.ledger.upsertPosition({
          ...existing,
          quantity: newQty,
          avgPrice: newAvg,
        });
        const tradeId = newTradeId();
        this.recordOrder(request, side, tradeId, 'ADD');
        return this.fill(request, 0, 'Added to existing position', tradeId);
      }

      // New position (avg price reflects slippage).
      this.ledger.upsertPosition({
        symbol: request.symbol,
        exchange: request.exchange,
        quantity: request.quantity,
        avgPrice: fillPrice,
        entryTime: request.timestamp,
        direction: request.direction,
        product: request.product ?? 'CNC',
        entryMode: request.entryMode,
      });
      const tradeId = newTradeId();
      this.recordOrder(request, side, tradeId, 'OPEN');
      return this.fill(request, 0, 'Opened new position', tradeId);
    });

    return fill;
  }

  private fill(
    request: TradeRequest,
    pnl: number,
    reason: string,
    tradeId: string,
  ): TradeFill {
    const f: TradeFill = {
      tradeId,
      symbol: request.symbol,
      exchange: request.exchange,
      direction: request.direction,
      quantity: request.quantity,
      price: this.applySlippage(request.entryPrice, directionToSide(request.direction)),
      ticketSize: request.ticketSize,
      pnl,
      status: 'FILLED',
      reason,
      timestamp: request.timestamp,
    };
    this.ledger.recordTrade(f);
    return f;
  }

  private recordOrder(
    request: TradeRequest,
    side: 'BUY' | 'SELL',
    tradeId: string,
    action: 'OPEN' | 'ADD' | 'TRIM' | 'CLOSE',
  ): void {
    this.ledger.recordOrder({
      orderId: newTradeId(),
      tradeId,
      symbol: request.symbol,
      exchange: request.exchange,
      side,
      quantity: request.quantity,
      price: request.entryPrice,
      ticketSize: request.ticketSize,
      status: 'FILLED',
      variety: 'regular',
      orderType: 'MARKET',
      product: 'CNC',
      reason: `${action}: ${request.reason}`,
      createdAt: request.timestamp,
    });
  }

  private computeClosePnl(position: Position, closePrice: number, qty?: number): number {
    const n = qty ?? position.quantity;
    if (position.direction === 'LONG') {
      return (closePrice - position.avgPrice) * n;
    }
    return (position.avgPrice - closePrice) * n;
  }
}
