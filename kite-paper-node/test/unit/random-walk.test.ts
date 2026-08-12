import { describe, it, expect } from '@jest/globals';
import { RandomWalkGenerator } from '../../src/market/random-walk-generator';

describe('RandomWalkGenerator', () => {
  it('generates ticks within circuit limits', () => {
    const gen = new RandomWalkGenerator({
      instrumentToken: 738561,
      basePrice: 2500,
      seed: 42,
    });

    for (let i = 0; i < 1000; i++) {
      const tick = gen.generateTick();
      expect(tick.last_price).toBeGreaterThanOrEqual(2500 * 0.95);
      expect(tick.last_price).toBeLessThanOrEqual(2500 * 1.05);
      expect(tick.instrument_token).toBe(738561);
    }
  });

  it('rounds prices to tick size', () => {
    const gen = new RandomWalkGenerator({
      instrumentToken: 738561,
      basePrice: 2500,
      tickSize: 0.05,
      seed: 7,
    });

    for (let i = 0; i < 500; i++) {
      const tick = gen.generateTick();
      const rounded = Math.round(tick.last_price * 20) / 20;
      expect(Math.abs(tick.last_price - rounded)).toBeLessThan(1e-9);
    }
  });

  it('is reproducible with the same seed', () => {
    const a = new RandomWalkGenerator({ instrumentToken: 1, basePrice: 100, seed: 123 });
    const b = new RandomWalkGenerator({ instrumentToken: 1, basePrice: 100, seed: 123 });

    for (let i = 0; i < 100; i++) {
      expect(a.generateTick().last_price).toBe(b.generateTick().last_price);
    }
  });

  it('produces positive volume', () => {
    const gen = new RandomWalkGenerator({ instrumentToken: 1, basePrice: 100, seed: 5 });
    for (let i = 0; i < 200; i++) {
      expect(gen.generateTick().volume_traded).toBeGreaterThan(0);
    }
  });
});
