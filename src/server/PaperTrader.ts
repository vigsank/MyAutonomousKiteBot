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
 */
export class PaperTrader {
  constructor(
    private readonly config: AppConfig,
    private readonly ledger: Ledger,
  ) {}

  /**
   * Execute a paper trade request and return the fill. The risk engine must
   * already have approved this request; this method just simulates the fill.
   */
  execute(request: TradeRequest): TradeFill {
    const side = directionToSide(request.direction);

    const fill = this.ledger.transaction(() => {
      // Existing position for the symbol.
      const existing = this.ledger.getPosition(request.symbol);

      if (existing) {
        // Close existing position if we trade in the opposite direction.
        if (existing.direction !== request.direction) {
          const closePnl = this.computeClosePnl(existing, request.entryPrice);
          const tradeId = newTradeId();
          const fillOut: TradeFill = {
            tradeId,
            symbol: request.symbol,
            exchange: request.exchange,
            direction: request.direction,
            quantity: request.quantity,
            price: request.entryPrice,
            ticketSize: request.ticketSize,
            pnl: closePnl,
            status: 'FILLED',
            reason: `Closed ${existing.direction} position. ${request.reason}`,
            timestamp: request.timestamp,
          };
          this.ledger.recordTrade(fillOut);
          this.recordOrder(request, side, tradeId, 'CLOSE');
          this.ledger.closePosition(request.symbol, request.entryPrice, closePnl);
          return fillOut;
        }
        // Same direction: augment position (weighted average price).
        const newQty = existing.quantity + request.quantity;
        const newAvg =
          (existing.avgPrice * existing.quantity +
            request.entryPrice * request.quantity) /
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

      // New position.
      this.ledger.upsertPosition({
        symbol: request.symbol,
        exchange: request.exchange,
        quantity: request.quantity,
        avgPrice: request.entryPrice,
        entryTime: request.timestamp,
        direction: request.direction,
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
      price: request.entryPrice,
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
    action: 'OPEN' | 'ADD' | 'CLOSE',
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

  private computeClosePnl(position: Position, closePrice: number): number {
    if (position.direction === 'LONG') {
      return (closePrice - position.avgPrice) * position.quantity;
    }
    return (position.avgPrice - closePrice) * position.quantity;
  }
}
