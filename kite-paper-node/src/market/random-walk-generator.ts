/**
 * Random Walk Generator — produces realistic JIT market data for a single
 * instrument.
 *
 * Macro behavior (trends, ranging stretches, sharp moves, oversold/overbought
 * conditions) is driven by a **regime state machine**:
 *   trending_up | trending_down | ranging | volatile
 * Each regime sets a drift and a volatility multiplier. Combined with
 * intraday (U-shaped) seasonality and occasional event shocks, this produces
 * price action that can push RSI into oversold/overbought and touch the
 * Bollinger bands — so strategy signals actually trigger.
 *
 * Microstructure (bid/ask, depth, volume, tick-size rounding) is preserved.
 */

import type { Depth, OHLC, Tick } from '../types';
import { DEFAULT_CIRCUIT_LIMIT } from '../protocol/constants';
import { clamp, roundToTickSize } from '../utils/price-utils';
import { createPRNG, type PRNG } from '../utils/random';

export type Regime = 'trending_up' | 'trending_down' | 'ranging' | 'volatile';

export interface RegimeProbabilities {
  trending_up: number;
  trending_down: number;
  ranging: number;
  volatile: number;
}

export interface GeneratorState {
  currentPrice: number;
  previousPrice: number;
  lastReturn: number;
  volatility: number;
  tickCount: number;
  regime: Regime;
  ticksInRegime: number;
}

export interface RandomWalkGeneratorOptions {
  instrumentToken: number;
  basePrice: number;
  tickSize?: number;
  /** Per-tick base volatility (e.g. 0.0004 = 0.04%). */
  volatility?: number;
  bidAskSpread?: number;
  volumeMean?: number;
  volumeStdDev?: number;
  seed?: number;
  enableRealismFeatures?: boolean;
  circuitLimit?: number;
  /** Whether the instrument is tradable (indices are not). */
  tradable?: boolean;
  /** Ticks between regime switches. */
  regimeSwitchBars?: number;
  /** Probability of each regime on a switch. */
  regimeProbabilities?: Partial<RegimeProbabilities>;
  /** Probability of staying in the current regime on a switch (trend persistence). */
  regimePersistence?: number;
  /** Enable U-shaped intraday volatility (high open/close, low midday). */
  enableSeasonality?: boolean;
  /** Per-tick probability of an event shock (jump/dump). */
  shockProbability?: number;
  /** Magnitude of an event shock (fraction of price). */
  shockSize?: number;
}

// Per-regime behavior: drift per tick, volatility multiplier, mean-reversion
// strength. Mean reversion is strong in `ranging` and weak/absent in trending
// so trends can actually develop.
const REGIME_CONFIG: Record<
  Regime,
  { drift: number; volMult: number; meanReversion: number }
> = {
  trending_up: { drift: 0.00005, volMult: 1.2, meanReversion: 0.0002 },
  trending_down: { drift: -0.00005, volMult: 1.2, meanReversion: 0.0002 },
  ranging: { drift: 0, volMult: 0.6, meanReversion: 0.002 },
  volatile: { drift: 0, volMult: 1.5, meanReversion: 0.0001 },
};

const DEFAULT_REGIME_PROBS: RegimeProbabilities = {
  trending_up: 0.25,
  trending_down: 0.25,
  ranging: 0.35,
  volatile: 0.15,
};

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
  public readonly regimeSwitchBars: number;
  public readonly regimeProbabilities: RegimeProbabilities;
  public readonly regimePersistence: number;
  public readonly enableSeasonality: boolean;
  public readonly shockProbability: number;
  public readonly shockSize: number;

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
    this.regimeSwitchBars = options.regimeSwitchBars ?? 1200;
    this.regimeProbabilities = {
      ...DEFAULT_REGIME_PROBS,
      ...options.regimeProbabilities,
    };
    this.regimePersistence = options.regimePersistence ?? 0.5;
    this.enableSeasonality = options.enableSeasonality ?? true;
    this.shockProbability = options.shockProbability ?? 0.01;
    this.shockSize = options.shockSize ?? 0.01;

    this.prng = createPRNG(options.seed);
    this.state = {
      currentPrice: options.basePrice,
      previousPrice: options.basePrice,
      lastReturn: 0,
      volatility: options.volatility ?? 0.0004,
      tickCount: 0,
      regime: 'ranging',
      ticksInRegime: 0,
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

  /** Pick a new regime based on the configured probabilities. */
  private switchRegime(): void {
    // Trend persistence: sometimes stay in the current regime.
    if (this.prng.chance(this.regimePersistence)) {
      this.state.ticksInRegime = 0;
      return;
    }
    const r = this.prng.next();
    let acc = 0;
    for (const [regime, prob] of Object.entries(this.regimeProbabilities)) {
      acc += prob;
      if (r < acc) {
        this.state.regime = regime as Regime;
        break;
      }
    }
    this.state.ticksInRegime = 0;
  }

  /** U-shaped intraday volatility: high at open/close, low midday. */
  private seasonalityMultiplier(date: Date): number {
    const minutes = date.getHours() * 60 + date.getMinutes();
    const open = 9 * 60 + 15; // 09:15
    const close = 15 * 60 + 30; // 15:30
    if (minutes <= open || minutes >= close) return 1.5;
    const mid = (open + close) / 2;
    const distFromMid = Math.abs(minutes - mid) / (mid - open); // 0 at mid, 1 at open/close
    return 0.6 + 1.2 * distFromMid; // 0.6 midday → 1.8 at open/close
  }

  /** Generate the next tick for this instrument. */
  generateTick(): Tick {
    const g = this.state;
    const dt = 1; // normalized per-tick time step
    const now = new Date();

    // 0. Regime switching.
    g.ticksInRegime++;
    if (g.ticksInRegime >= this.regimeSwitchBars) {
      this.switchRegime();
    }
    const regime = REGIME_CONFIG[g.regime];

    // 1. Effective volatility = base × regime mult × seasonality.
    const seasonality = this.enableSeasonality ? this.seasonalityMultiplier(now) : 1;
    const effectiveVol = g.volatility * regime.volMult * seasonality;

    // 2. GARCH-like volatility clustering.
    g.volatility = g.volatility * 0.95 + Math.abs(g.lastReturn) * 0.05;

    // 3. Drift = regime drift + regime-dependent mean reversion.
    //    Mean reversion is normalized by basePrice so it's a fraction of the
    //    deviation (not an absolute pull that snaps price back to base).
    const meanReversion =
      (regime.meanReversion * (this.basePrice - g.currentPrice)) / this.basePrice * dt;
    const drift = regime.drift + meanReversion;

    // 4. Random shock with momentum (10% autocorrelation).
    const momentum = g.lastReturn * 0.1;
    const shock = effectiveVol * this.prng.normal() * Math.sqrt(dt);

    // 5. Event shock (news-driven jump/dump).
    let eventShock = 0;
    if (this.prng.chance(this.shockProbability)) {
      const dir = this.prng.chance(0.5) ? 1 : -1;
      eventShock = dir * this.shockSize;
    }

    const totalReturn = drift + momentum + shock + eventShock;
    let newPrice = g.currentPrice * Math.exp(totalReturn);

    // 6. Clamp to circuit limits.
    newPrice = clamp(
      newPrice,
      this.basePrice * (1 - this.circuitLimit),
      this.basePrice * (1 + this.circuitLimit)
    );

    // 7. Round to tick size.
    const rounded = roundToTickSize(newPrice, this.tickSize);

    // 8. Volume with occasional spikes (2% chance of 3-10x).
    const baseVolume = Math.max(
      1,
      Math.round(this.prng.normalDist(this.volumeMean, this.volumeStdDev))
    );
    const spikeMultiplier = this.prng.chance(0.02) ? this.prng.range(3, 10) : 1;
    const volume = Math.round(baseVolume * spikeMultiplier);

    // 9. Bid/ask with spread.
    const halfSpread = this.bidAskSpread / 2;
    const bid = roundToTickSize(rounded - halfSpread, this.tickSize);
    const ask = roundToTickSize(rounded + halfSpread, this.tickSize);

    // 10. OHLC from micro-movements.
    const microHigh = rounded * (1 + Math.abs(this.prng.normal()) * 0.0005);
    const microLow = rounded * (1 - Math.abs(this.prng.normal()) * 0.0005);
    const ohlc: OHLC = {
      open: g.previousPrice,
      high: Math.max(g.previousPrice, rounded, microHigh),
      low: Math.min(g.previousPrice, rounded, microLow),
      close: rounded,
    };

    // 11. Buy/sell quantities.
    const buyQty = Math.round(volume * this.prng.range(0.3, 0.7));
    const sellQty = volume - buyQty;

    // 12. Update state.
    g.lastReturn = rounded / g.currentPrice - 1;
    g.previousPrice = g.currentPrice;
    g.currentPrice = rounded;
    g.tickCount++;

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
