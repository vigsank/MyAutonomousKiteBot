/**
 * Position Engine — aggregates net/day positions and computes P&L against
 * the latest market prices, matching the real `kiteconnect` `Position` shape
 * (British spellings: `unrealised`, `realised`, `m2m`, buy/sell legs).
 */

import type { PositionRecord, Product } from '../types';
import { StateStore } from '../state/state-store';
import { roundMoney, weightedAverage } from '../utils/price-utils';

export class PositionEngine {
  constructor(private store: StateStore) {}

  /** Apply a fill to the position for an instrument. */
  applyFill(
    token: number,
    tradingsymbol: string,
    exchange: string,
    product: Product,
    transactionType: 'BUY' | 'SELL',
    quantity: number,
    price: number
  ): PositionRecord {
    const pos = this.store.getOrCreatePosition(token);
    pos.tradingsymbol = tradingsymbol;
    pos.exchange = exchange;
    pos.product = product;

    if (transactionType === 'BUY') {
      // Net position.
      pos.average_price = weightedAverage(pos.average_price, pos.quantity, price, quantity);
      pos.quantity += quantity;

      // Buy leg.
      pos.buy_quantity += quantity;
      pos.buy_price = weightedAverage(pos.buy_price, pos.buy_quantity - quantity, price, quantity);
      pos.buy_value = pos.buy_price * pos.buy_quantity;

      // Day buy leg.
      pos.day_buy_quantity += quantity;
      pos.day_buy_price = weightedAverage(
        pos.day_buy_price,
        pos.day_buy_quantity - quantity,
        price,
        quantity
      );
      pos.day_buy_value = pos.day_buy_price * pos.day_buy_quantity;
    } else {
      // SELL — realize P&L against average price.
      const realised = (price - pos.average_price) * quantity;
      pos.realised = roundMoney(pos.realised + realised);

      // Sell leg.
      pos.sell_quantity += quantity;
      pos.sell_price = weightedAverage(pos.sell_price, pos.sell_quantity - quantity, price, quantity);
      pos.sell_value = pos.sell_price * pos.sell_quantity;

      // Day sell leg.
      pos.day_sell_quantity += quantity;
      pos.day_sell_price = weightedAverage(
        pos.day_sell_price,
        pos.day_sell_quantity - quantity,
        price,
        quantity
      );
      pos.day_sell_value = pos.day_sell_price * pos.day_sell_quantity;

      pos.quantity -= quantity;
      if (pos.quantity === 0) {
        pos.average_price = 0;
      }
    }

    this.store.setPosition(pos);
    return pos;
  }

  /** Update unrealized P&L for all positions using the latest price. */
  markToMarket(token: number, lastPrice: number): void {
    const pos = this.store.getPosition(token);
    if (!pos) return;
    pos.last_price = lastPrice;
    pos.value = lastPrice * pos.quantity;
    pos.pnl = roundMoney((lastPrice - pos.average_price) * pos.quantity);
    pos.m2m = roundMoney((lastPrice - pos.close_price) * pos.quantity);
    pos.unrealised = roundMoney((lastPrice - pos.average_price) * pos.quantity);
    pos.buy_m2m = roundMoney((lastPrice - pos.buy_price) * pos.buy_quantity);
    pos.sell_m2m = roundMoney((lastPrice - pos.sell_price) * pos.sell_quantity);
    this.store.setPosition(pos);
  }

  getPositions(): PositionRecord[] {
    return this.store.getPositions();
  }

  getPosition(token: number): PositionRecord | undefined {
    return this.store.getPosition(token);
  }
}
