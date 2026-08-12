import { MockEngine } from '../../src/mock-engine';

describe('Order Matching Engine', () => {
  let engine: MockEngine;

  beforeEach(() => {
    engine = new MockEngine({ startingCapital: 1_000_000 });
    engine.addSymbol('RELIANCE', { basePrice: 2500 });
  });

  afterEach(() => {
    engine.destroy();
  });

  it('fills a BUY LIMIT order when price drops to the limit', () => {
    const { order_id } = engine.orderService.placeOrder('regular', {
      tradingsymbol: 'RELIANCE',
      exchange: 'NSE',
      transaction_type: 'BUY',
      order_type: 'LIMIT',
      quantity: 10,
      price: 2450,
      product: 'MIS',
    });

    expect(engine.getOrderById(order_id)!.status).toBe('OPEN');

    engine.emitTick({ instrument_token: 738561, last_price: 2450 });

    const order = engine.getOrderById(order_id)!;
    expect(order.status).toBe('COMPLETE');
    expect(order.average_price).toBe(2450);

    const positions = engine.getPositions();
    expect(positions[0].quantity).toBe(10);
    expect(positions[0].average_price).toBe(2450);
  });

  it('fills a SELL LIMIT order when price rises to the limit', () => {
    const { order_id } = engine.orderService.placeOrder('regular', {
      tradingsymbol: 'RELIANCE',
      exchange: 'NSE',
      transaction_type: 'SELL',
      order_type: 'LIMIT',
      quantity: 5,
      price: 2550,
      product: 'MIS',
    });

    engine.emitTick({ instrument_token: 738561, last_price: 2550 });

    const order = engine.getOrderById(order_id)!;
    expect(order.status).toBe('COMPLETE');
    expect(order.average_price).toBe(2550);
  });

  it('holds SL-M in TRIGGER PENDING then fills at market on trigger', () => {
    const { order_id } = engine.orderService.placeOrder('regular', {
      tradingsymbol: 'RELIANCE',
      exchange: 'NSE',
      transaction_type: 'BUY',
      order_type: 'SL-M',
      quantity: 10,
      trigger_price: 2520,
      product: 'MIS',
    });

    expect(engine.getOrderById(order_id)!.status).toBe('TRIGGER PENDING');

    engine.emitTick({ instrument_token: 738561, last_price: 2520 });

    const order = engine.getOrderById(order_id)!;
    expect(order.status).toBe('COMPLETE');
    expect(order.average_price).toBe(2520);
  });

  it('transitions SL to OPEN on trigger, then fills at limit', () => {
    const { order_id } = engine.orderService.placeOrder('regular', {
      tradingsymbol: 'RELIANCE',
      exchange: 'NSE',
      transaction_type: 'BUY',
      order_type: 'SL',
      quantity: 10,
      price: 2510,
      trigger_price: 2520,
      product: 'MIS',
    });

    // Trigger.
    engine.emitTick({ instrument_token: 738561, last_price: 2520 });
    expect(engine.getOrderById(order_id)!.status).toBe('OPEN');

    // Fill at limit.
    engine.emitTick({ instrument_token: 738561, last_price: 2510 });
    expect(engine.getOrderById(order_id)!.status).toBe('COMPLETE');
    expect(engine.getOrderById(order_id)!.average_price).toBe(2510);
  });

  it('fills a MARKET order immediately on the next tick', () => {
    const { order_id } = engine.orderService.placeOrder('regular', {
      tradingsymbol: 'RELIANCE',
      exchange: 'NSE',
      transaction_type: 'BUY',
      order_type: 'MARKET',
      quantity: 10,
      product: 'MIS',
    });

    engine.emitTick({ instrument_token: 738561, last_price: 2500, ask: 2500.5 });

    const order = engine.getOrderById(order_id)!;
    expect(order.status).toBe('COMPLETE');
    expect(order.average_price).toBe(2500.5); // filled at ask
  });
});
