import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MockEngine } from '../../src/mock-engine';
import { MockKiteTicker } from '../../src/mock-kite-ticker';
import { MockKiteConnect } from '../../src/mock-kite-connect';

describe('JIT Data Consistency', () => {
  let engine: MockEngine;

  beforeEach(() => {
    engine = new MockEngine({ startingCapital: 1_000_000 });
    engine.addSymbol('RELIANCE', { basePrice: 2500 });
  });

  afterEach(() => {
    engine.destroy();
  });

  it('returns identical prices from WS stream and REST quote', async () => {
    const kite = new MockKiteConnect({ api_key: 'test', engine });
    const ticker = new MockKiteTicker({ api_key: 'test', access_token: 'test', engine });

    let wsPrice: number | null = null;
    ticker.on('ticks', (ticks: any[]) => {
      wsPrice = ticks[0].last_price;
    });
    ticker.connect();
    ticker.subscribe([738561]);

    // Inject a deterministic tick.
    engine.emitTick({ instrument_token: 738561, last_price: 2500 });

    const quote = await kite.getQuote(['NSE:RELIANCE']);
    const restPrice = quote['NSE:RELIANCE'].last_price;

    expect(restPrice).toBe(2500);
    expect(wsPrice).toBe(2500);
    expect(restPrice).toBe(wsPrice);
    ticker.close();
  });

  it('serves historical candles from the tick history buffer', async () => {
    const kite = new MockKiteConnect({ api_key: 'test', engine });

    // Generate a series of ticks.
    for (let i = 0; i < 10; i++) {
      engine.emitTick({ instrument_token: 738561, last_price: 2500 + i });
    }

    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date().toISOString();
    const hist = await kite.getHistoricalData(738561, 'minute', from, to);

    expect(hist.length).toBeGreaterThan(0);
    expect(hist[0]).toHaveProperty('date');
    expect(hist[0]).toHaveProperty('close');
    expect(hist[0]).toHaveProperty('volume');
  });

  it('adds a symbol at runtime and immediately serves data', async () => {
    const kite = new MockKiteConnect({ api_key: 'test', engine });
    engine.addSymbol('TATASTEEL', { basePrice: 155 });

    engine.emitTick({ instrument_token: 779521, last_price: 155 });

    const quote = await kite.getQuote(['NSE:TATASTEEL']);
    expect(quote['NSE:TATASTEEL'].last_price).toBe(155);
  });
});
