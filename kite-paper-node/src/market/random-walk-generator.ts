/**
 * Random Walk Generator — produces realistic JIT market data for a single
 * instrument using Geometric Brownian Motion enhanced with realism features
 * (GARCH-like volatility clustering, mean reversion, momentum, volume spikes,
 * bid-ask bounce, tick-size rounding).
 */

import type { Depth, OHLC, Tick } from '../types';
import { DEFAULT_CIRCUIT_LIMIT } from '../protocol/constants';
import { clamp, roundToTickSize } from '../utils/price-utils';
import { createPRNG, type PRNG } from '../utils/random';

export interface GeneratorState {
  currentPrice: number;
  previousPrice: number;
  lastReturn: number;
  volatility: number;
  tickCount: number;
}

export interface RandomWalkGeneratorOptions {
  instrumentToken: number;
  basePrice: number;
  tickSize?: number;
  volatility?: number;
  bidAskSpread?: number;
  volumeMean?: number;
  volumeStdDev?: number;
  seed?: number;
  enableRealismFeatures?: boolean;
  circuitLimit?: number;
  /** Whether the instrument is tradable (indices are not). */
  tradable?: boolean;
}

export class RandomWalkGenerator {
  public readonly instrumentToken: number;
  public readonly basePrice: number;
  public readonly tickSize: number;
  public readonly bidAskSpread: number;
  public readonly volumeMean: number;
  public readonly volumeStdDev: number;
  public readonly enableRealismFeatures: boolean;
  public readonly circuitLimit: number;
  public readonly tradable: boolean;

  private prng: PRNG;
  private state: GeneratorState;

  constructor(options: RandomWalkGeneratorOptions) {
    this.instrumentToken = options.instrumentToken;
    this.basePrice = options.basePrice;
    this.tickSize = options.tickSize ?? 0.05;
    this.bidAskSpread = options.bidAskSpread ?? 0.05;
    this.volumeMean = options.volumeMean ?? 500;
    this.volumeStdDev = options.volumeStdDev ?? 200;
    this.enableRealismFeatures = options.enableRealismFeatures ?? true;
    this.circuitLimit = options.circuitLimit ?? DEFAULT_CIRCUIT_LIMIT;
    this.tradable = options.tradable ?? true;

    this.prng = createPRNG(options.seed);
    this.state = {
      currentPrice: options.basePrice,
      previousPrice: options.basePrice,
      lastReturn: 0,
      volatility: options.volatility ?? 0.002,
      tickCount: 0,
    };
  }

  getState(): GeneratorState {
    return { ...this.state };
  }

  getCurrentPrice(): number {
    return this.state.currentPrice;
  }

  setCurrentPrice(price: number): void {
    this.state.currentPrice = price;
    this.state.previousPrice = price;
  }

  saveState(): GeneratorState {
    return { ...this.state };
  }

  restoreState(state: GeneratorState): void {
    this.state = { ...state };
  }

  /** Generate the next tick for this instrument. */
  generateTick(): Tick {
    const g = this.state;
    const dt = 1; // normalized per-tick time step

    let newPrice: number;

    if (this.enableRealismFeatures) {
      // 1. GARCH-like volatility clustering.
      g.volatility = g.volatility * 0.95 + Math.abs(g.lastReturn) * 0.05;

      // 2. Ornstein-Uhlenbeck mean-reverting drift.
      const meanReversionStrength = 0.001;
      const drift = meanReversionStrength * (this.basePrice - g.currentPrice) * dt;

      // 3. Random shock with momentum (10% autocorrelation).
      const momentum = g.lastReturn * 0.1;
      const shock = g.volatility * this.prng.normal() * Math.sqrt(dt);
      const totalReturn = drift + momentum + shock;

      newPrice = g.currentPrice * Math.exp(totalReturn);
    } else {
      // Pure GBM.
      const shock = g.volatility * this.prng.normal();
      newPrice = g.currentPrice * Math.exp(shock);
    }

    // 4. Clamp to circuit limits.
    const clamped = clamp(
      newPrice,
      this.basePrice * (1 - this.circuitLimit),
      this.basePrice * (1 + this.circuitLimit)
    );

    // 5. Round to tick size.
    const rounded = roundToTickSize(clamped, this.tickSize);

    // 6. Volume with occasional spikes (2% chance of 3-10x).
    const baseVolume = Math.max(
      1,
      Math.round(this.prng.normalDist(this.volumeMean, this.volumeStdDev))
    );
    const spikeMultiplier = this.prng.chance(0.02) ? this.prng.range(3, 10) : 1;
    const volume = Math.round(baseVolume * spikeMultiplier);

    // 7. Bid/ask with spread.
    const halfSpread = this.bidAskSpread / 2;
    const bid = roundToTickSize(rounded - halfSpread, this.tickSize);
    const ask = roundToTickSize(rounded + halfSpread, this.tickSize);

    // 8. OHLC from micro-movements.
    const microHigh = rounded * (1 + Math.abs(this.prng.normal()) * 0.0005);
    const microLow = rounded * (1 - Math.abs(this.prng.normal()) * 0.0005);
    const ohlc: OHLC = {
      open: g.previousPrice,
      high: Math.max(g.previousPrice, rounded, microHigh),
      low: Math.min(g.previousPrice, rounded, microLow),
      close: rounded,
    };

    // 9. Buy/sell quantities.
    const buyQty = Math.round(volume * this.prng.range(0.3, 0.7));
    const sellQty = volume - buyQty;

    // 10. Update state.
    g.lastReturn = rounded / g.currentPrice - 1;
    g.previousPrice = g.currentPrice;
    g.currentPrice = rounded;
    g.tickCount++;

    const now = new Date();
    return {
      tradable: this.tradable,
      mode: 'full',
      instrument_token: this.instrumentToken,
      last_price: rounded,
      last_traded_quantity: Math.round(volume * 0.1),
      average_traded_price: rounded,
      volume_traded: volume,
      total_buy_quantity: buyQty,
      total_sell_quantity: sellQty,
      ohlc,
      change: rounded - this.basePrice,
      last_trade_time: now,
      exchange_timestamp: now,
      bid,
      ask,
      bid_quantity: Math.round(buyQty * 0.3),
      ask_quantity: Math.round(sellQty * 0.3),
      depth: this.generateDepth(rounded, bid, ask),
    };
  }

  /** Generate a 5-level market depth around the current price. */
  private generateDepth(price: number, bid: number, ask: number): { buy: Depth[]; sell: Depth[] } {
    const buy: Depth[] = [];
    const sell: Depth[] = [];
    for (let i = 0; i < 5; i++) {
      const offset = (i + 1) * this.tickSize;
      buy.push({
        price: roundToTickSize(bid - offset, this.tickSize),
        quantity: Math.max(1, Math.round(this.prng.normalDist(200, 100))),
        orders: this.prng.int(1, 20),
      });
      sell.push({
        price: roundToTickSize(ask + offset, this.tickSize),
        quantity: Math.max(1, Math.round(this.prng.normalDist(200, 100))),
        orders: this.prng.int(1, 20),
      });
    }
    return { buy, sell };
  }
}
