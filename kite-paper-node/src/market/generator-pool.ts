/**
 * Generator Pool — manages one RandomWalkGenerator per instrument.
 *
 * Resolves symbol names to instrument tokens via the bundled instrument
 * master, starts/stops per-symbol tick emission loops, and provides the
 * latest tick for REST quote endpoints (JIT data).
 */

import type { Instrument, Tick } from '../types';
import { TickEventBus } from './tick-event-bus';
import { RandomWalkGenerator, type RandomWalkGeneratorOptions } from './random-walk-generator';
import { createPRNG } from '../utils/random';

// Lazy-load the bundled instrument master.
let instrumentMaster: Instrument[] | null = null;
function loadInstruments(): Instrument[] {
  if (instrumentMaster) return instrumentMaster;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const data = require('../data/instruments.json') as { instruments: Instrument[] };
  instrumentMaster = data.instruments;
  return instrumentMaster;
}

export interface AddSymbolOptions {
  basePrice?: number;
  volatility?: number;
  tickIntervalMs?: number;
}

export class GeneratorPool {
  private generators = new Map<number, RandomWalkGenerator>();
  private timers = new Map<number, NodeJS.Timeout>();
  private latestTicks = new Map<number, Tick>();
  private defaultTickIntervalMs: number;
  private seed?: number;

  constructor(
    private bus: TickEventBus,
    options?: { tickIntervalMs?: number; seed?: number }
  ) {
    this.defaultTickIntervalMs = options?.tickIntervalMs ?? 1000;
    this.seed = options?.seed;
  }

  /** Resolve a symbol name to an instrument from the master. */
  resolveSymbol(symbol: string): Instrument | undefined {
    const upper = symbol.toUpperCase();
    return loadInstruments().find(
      (i) => i.tradingsymbol.toUpperCase() === upper
    );
  }

  /** Resolve an instrument token to an instrument. */
  resolveToken(token: number): Instrument | undefined {
    return loadInstruments().find((i) => i.instrument_token === token);
  }

  getInstruments(): Instrument[] {
    return loadInstruments();
  }

  /** Add a symbol (by name or token) and start generating ticks for it. */
  addSymbol(symbolOrToken: string | number, options?: AddSymbolOptions): Instrument {
    let instrument: Instrument | undefined;
    if (typeof symbolOrToken === 'number') {
      instrument = this.resolveToken(symbolOrToken);
    } else {
      instrument = this.resolveSymbol(symbolOrToken);
    }
    if (!instrument) {
      throw new Error(`Instrument not found: ${symbolOrToken}`);
    }
    this.addInstrument(instrument, options);
    return instrument;
  }

  /** Add an instrument directly. */
  addInstrument(instrument: Instrument, options?: AddSymbolOptions): void {
    if (this.generators.has(instrument.instrument_token)) {
      return; // already registered
    }
    const basePrice = options?.basePrice ?? Number(instrument.last_price);
    const genOptions: RandomWalkGeneratorOptions = {
      instrumentToken: instrument.instrument_token,
      basePrice,
      tickSize: Number(instrument.tick_size),
      volatility: options?.volatility,
      seed: this.seed,
      tradable: instrument.instrument_type !== 'INDEX',
    };
    const generator = new RandomWalkGenerator(genOptions);
    this.generators.set(instrument.instrument_token, generator);

    const interval = options?.tickIntervalMs ?? this.defaultTickIntervalMs;
    const timer = setInterval(() => {
      const tick = generator.generateTick();
      this.latestTicks.set(instrument.instrument_token, tick);
      this.bus.publish(tick);
    }, interval);
    // Do not keep the process alive just for the mock ticker.
    timer.unref();
    this.timers.set(instrument.instrument_token, timer);
  }

  /** Remove a symbol and stop its tick loop. */
  removeSymbol(symbolOrToken: string | number): boolean {
    let token: number | undefined;
    if (typeof symbolOrToken === 'number') {
      token = symbolOrToken;
    } else {
      const inst = this.resolveSymbol(symbolOrToken);
      token = inst?.instrument_token;
    }
    if (token === undefined) return false;
    const timer = this.timers.get(token);
    if (timer) clearInterval(timer);
    this.timers.delete(token);
    this.generators.delete(token);
    this.latestTicks.delete(token);
    return true;
  }

  /** Get the latest generated tick for a token (JIT quote data). */
  getLatestTick(token: number): Tick | undefined {
    return this.latestTicks.get(token);
  }

  /** Record an externally-injected tick as the latest for its token. */
  setLatestTick(tick: Tick): void {
    this.latestTicks.set(tick.instrument_token, tick);
  }

  /** Get the generator for a token. */
  getGenerator(token: number): RandomWalkGenerator | undefined {
    return this.generators.get(token);
  }

  /** List all registered tokens. */
  listTokens(): number[] {
    return Array.from(this.generators.keys());
  }

  /** Set the base price for a token's generator. */
  setBasePrice(token: number, price: number): void {
    const gen = this.generators.get(token);
    if (gen) gen.setCurrentPrice(price);
  }

  /** Pause a generator's tick loop. */
  pause(token: number): void {
    const timer = this.timers.get(token);
    if (timer) clearInterval(timer);
    this.timers.delete(token);
  }

  /** Resume a generator's tick loop. */
  resume(token: number, tickIntervalMs?: number): void {
    if (this.timers.has(token)) return;
    const gen = this.generators.get(token);
    if (!gen) return;
    const interval = tickIntervalMs ?? this.defaultTickIntervalMs;
    const timer = setInterval(() => {
      const tick = gen.generateTick();
      this.latestTicks.set(token, tick);
      this.bus.publish(tick);
    }, interval);
    timer.unref();
    this.timers.set(token, timer);
  }

  /** Pause all generators. */
  pauseAll(): void {
    for (const token of Array.from(this.timers.keys())) {
      this.pause(token);
    }
  }

  /** Resume all generators. */
  resumeAll(): void {
    for (const token of this.generators.keys()) {
      this.resume(token);
    }
  }

  /** Stop all generators and clear state. */
  stopAll(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
    this.generators.clear();
    this.latestTicks.clear();
  }

  /** Seed the PRNG for reproducibility (applies to new generators). */
  setSeed(seed: number): void {
    this.seed = seed;
  }
}
