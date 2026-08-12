import { MockKiteConnect, MockKiteTicker, mockEngine } from '../../src/index';

describe('SDK Mock (In-Process Mode)', () => {
  beforeEach(() => {
    mockEngine.reset({ startingCapital: 1_000_000 });
    mockEngine.addSymbol('RELIANCE', { basePrice: 2500 });
  });

  it('exposes a kiteconnect-compatible profile', async () => {
    const kite = new MockKiteConnect({ api_key: 'test' });
    const profile = await kite.getProfile();
    expect(profile.user_id).toBe('AB1234');
    expect(profile.broker).toBe('ZERODHA');
  });

  it('places and fills an order through the SDK facade', async () => {
    const kite = new MockKiteConnect({ api_key: 'test' });
    const { order_id } = await kite.placeOrder('regular', {
      tradingsymbol: 'RELIANCE',
      exchange: 'NSE',
      transaction_type: 'BUY',
      order_type: 'LIMIT',
      quantity: 10,
      price: 2450,
      product: 'MIS',
    });

    mockEngine.emitTick({ instrument_token: 738561, last_price: 2450 });

    const orders = await kite.getOrders();
    expect(orders[0].order_id).toBe(order_id);
    expect(orders[0].status).toBe('COMPLETE');

    const positions = await kite.getPositions();
    expect(positions[0].quantity).toBe(10);
  });

  it('streams ticks through the ticker facade', async () => {
    const ticker = new MockKiteTicker({ api_key: 'test', access_token: 'test' });
    const received: any[] = [];
    ticker.on('ticks', (ticks: any[]) => received.push(...ticks));

    ticker.connect();
    ticker.subscribe([738561]);

    mockEngine.emitTick({ instrument_token: 738561, last_price: 2500 });

    expect(received.length).toBe(1);
    expect(received[0].last_price).toBe(2500);
    ticker.close();
  });

  it('returns JIT quote data via getQuote', async () => {
    const kite = new MockKiteConnect({ api_key: 'test' });
    mockEngine.emitTick({ instrument_token: 738561, last_price: 2500 });

    const quote = await kite.getQuote(['NSE:RELIANCE']);
    expect(quote['NSE:RELIANCE'].last_price).toBe(2500);
  });
});
