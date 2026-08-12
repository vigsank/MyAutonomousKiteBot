import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MockEngine } from '../../src/mock-engine';
import { MockKiteConnect } from '../../src/mock-kite-connect';
import { MockKiteTicker } from '../../src/mock-kite-ticker';
import { BinaryPacker } from '../../src/server/binary-packer';

describe('Fidelity fixes (audit gaps)', () => {
  let engine: MockEngine;

  beforeEach(() => {
    engine = new MockEngine({ startingCapital: 1_000_000 });
    engine.addSymbol('RELIANCE', { basePrice: 2500 });
  });

  afterEach(() => {
    engine.destroy();
  });

  // C1 — getPositions returns { net, day }.
  it('C1: getPositions returns { net, day }', async () => {
    const kite = new MockKiteConnect({ api_key: 'test', engine });
    await kite.placeOrder('regular', {
      tradingsymbol: 'RELIANCE', exchange: 'NSE',
      transaction_type: 'BUY', order_type: 'LIMIT',
      quantity: 10, price: 2450, product: 'MIS',
    });
    engine.emitTick({ instrument_token: 738561, last_price: 2450 });

    const positions = await kite.getPositions();
    expect(Array.isArray(positions.net)).toBe(true);
    expect(Array.isArray(positions.day)).toBe(true);
    expect(positions.net[0].quantity).toBe(10);
  });

  // C2 — getHistoricalData returns HistoricalData[] objects.
  it('C2: getHistoricalData returns HistoricalData[] objects', async () => {
    const kite = new MockKiteConnect({ api_key: 'test', engine });
    for (let i = 0; i < 10; i++) {
      engine.emitTick({ instrument_token: 738561, last_price: 2500 + i });
    }
    const hist = await kite.getHistoricalData(
      738561, 'minute',
      new Date(Date.now() - 60_000), new Date()
    );
    expect(Array.isArray(hist)).toBe(true);
    expect(hist[0]).toHaveProperty('date');
    expect(hist[0]).toHaveProperty('open');
    expect(hist[0]).toHaveProperty('close');
    expect(hist[0]).toHaveProperty('volume');
  });

  // C3 — getQuote uses real field names and { buy, sell } depth.
  it('C3: getQuote uses real field names and depth shape', async () => {
    const kite = new MockKiteConnect({ api_key: 'test', engine });
    engine.emitTick({
      instrument_token: 738561, last_price: 2500,
      total_buy_quantity: 5000, total_sell_quantity: 4000,
      depth: { buy: [{ price: 2499, quantity: 100, orders: 5 }], sell: [] },
    });
    const quote = await kite.getQuote('NSE:RELIANCE');
    const q = quote['NSE:RELIANCE'];
    expect(q.buy_quantity).toBe(5000);
    expect(q.sell_quantity).toBe(4000);
    expect(q).toHaveProperty('net_change');
    expect(q).toHaveProperty('last_quantity');
    expect(q).toHaveProperty('lower_circuit_limit');
    expect(q).toHaveProperty('upper_circuit_limit');
    expect(Array.isArray(q.depth.buy)).toBe(true);
    expect(Array.isArray(q.depth.sell)).toBe(true);
  });

  // C5 — Position uses British spellings.
  it('C5: position uses unrealised/realised', async () => {
    const kite = new MockKiteConnect({ api_key: 'test', engine });
    await kite.placeOrder('regular', {
      tradingsymbol: 'RELIANCE', exchange: 'NSE',
      transaction_type: 'BUY', order_type: 'LIMIT',
      quantity: 10, price: 2450, product: 'MIS',
    });
    engine.emitTick({ instrument_token: 738561, last_price: 2450 });
    const positions = await kite.getPositions();
    const pos = positions.net[0];
    expect(pos).toHaveProperty('unrealised');
    expect(pos).toHaveProperty('realised');
    expect(pos).toHaveProperty('buy_quantity');
    expect(pos).toHaveProperty('m2m');
    expect(pos).toHaveProperty('pnl');
  });

  // C6 — getOrderHistory returns an array.
  it('C6: getOrderHistory returns an array', async () => {
    const kite = new MockKiteConnect({ api_key: 'test', engine });
    const { order_id } = await kite.placeOrder('regular', {
      tradingsymbol: 'RELIANCE', exchange: 'NSE',
      transaction_type: 'BUY', order_type: 'LIMIT',
      quantity: 10, price: 2450, product: 'MIS',
    });
    const history = await kite.getOrderHistory(order_id);
    expect(Array.isArray(history)).toBe(true);
    expect(history[0].order_id).toBe(order_id);
  });

  // C7 — order_update postback is emitted on fill.
  it('C7: order_update is emitted on fill', async () => {
    const kite = new MockKiteConnect({ api_key: 'test', engine });
    const ticker = new MockKiteTicker({ api_key: 'test', access_token: 'test', engine });
    const updates: any[] = [];
    ticker.on('order_update', (order: any) => updates.push(order));
    ticker.connect();

    const { order_id } = await kite.placeOrder('regular', {
      tradingsymbol: 'RELIANCE', exchange: 'NSE',
      transaction_type: 'BUY', order_type: 'LIMIT',
      quantity: 10, price: 2450, product: 'MIS',
    });
    engine.emitTick({ instrument_token: 738561, last_price: 2450 });

    expect(updates.length).toBe(1);
    expect(updates[0].order_id).toBe(order_id);
    expect(updates[0].status).toBe('COMPLETE');
    ticker.close();
  });

  // M1 — generateSession takes (request_token, api_secret) and returns SessionData.
  it('M1: generateSession returns SessionData', async () => {
    const kite = new MockKiteConnect({ api_key: 'test', engine });
    const session = await kite.generateSession('req_token', 'api_secret');
    expect(session.access_token).toBe('req_token');
    expect(session.user_id).toBe('AB1234');
    expect(session).toHaveProperty('refresh_token');
  });

  // R1 — partial fills.
  it('R1: partial fills fill a fraction per tick', async () => {
    const pe = new MockEngine({ startingCapital: 1_000_000, partialFills: true });
    pe.addSymbol('RELIANCE', { basePrice: 2500 });
    const kite = new MockKiteConnect({ api_key: 'test', engine: pe });
    const { order_id } = await kite.placeOrder('regular', {
      tradingsymbol: 'RELIANCE', exchange: 'NSE',
      transaction_type: 'BUY', order_type: 'LIMIT',
      quantity: 100, price: 2450, product: 'MIS',
    });
    pe.emitTick({ instrument_token: 738561, last_price: 2450 });
    const order = pe.getOrderById(order_id)!;
    expect(order.filled_quantity).toBeGreaterThan(0);
    expect(order.filled_quantity).toBeLessThan(100);
    pe.destroy();
  });

  // R3 — IOC orders are cancelled if not filled on the first tick.
  it('R3: IOC order is cancelled when unfilled', async () => {
    const kite = new MockKiteConnect({ api_key: 'test', engine });
    const { order_id } = await kite.placeOrder('regular', {
      tradingsymbol: 'RELIANCE', exchange: 'NSE',
      transaction_type: 'BUY', order_type: 'LIMIT',
      quantity: 10, price: 2000, validity: 'IOC', product: 'MIS',
    });
    // Price is above the limit, so it won't fill.
    engine.emitTick({ instrument_token: 738561, last_price: 2500 });
    expect(engine.getOrderById(order_id)!.status).toBe('CANCELLED');
  });

  // C4 — binary frames round-trip through the REAL KiteTicker.parseBinary.
  it('C4: binary frames parse with the real KiteTicker.parseBinary', () => {
    const packer = new BinaryPacker();
    const tick = {
      tradable: true, mode: 'full' as const, instrument_token: 738561,
      last_price: 2450.5, last_traded_quantity: 100, average_traded_price: 2450,
      volume_traded: 10000, total_buy_quantity: 5000, total_sell_quantity: 4000,
      ohlc: { open: 2440, high: 2460, low: 2435, close: 2450.5 },
      change: 0, last_trade_time: new Date(), exchange_timestamp: new Date(),
      oi: 0, oi_day_high: 0, oi_day_low: 0,
      depth: { buy: [{ price: 2449, quantity: 100, orders: 5 }], sell: [] },
    };

    const frame = packer.pack([tick], 'full');

    // Use the real kiteconnect KiteTicker to parse the frame.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { KiteTicker } = require('kiteconnect');
    const realTicker = new KiteTicker({ api_key: 'x', access_token: 'y' });
    const parsed = realTicker.parseBinary(frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength));

    expect(parsed.length).toBe(1);
    expect(parsed[0].instrument_token).toBe(738561);
    expect(parsed[0].last_price).toBeCloseTo(2450.5, 1);
    expect(parsed[0].mode).toBe('full');
    expect(parsed[0].depth.buy[0].price).toBeCloseTo(2449, 1);
  });
});
