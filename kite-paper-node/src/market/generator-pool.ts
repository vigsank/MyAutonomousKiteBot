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
import { CsvDataProvider, CsvTickGenerator } from './csv-data-provider';

// Common surface shared by RandomWalkGenerator and CsvTickGenerator.
export interface TickGenerator {
  generateTick(): Tick;
  getCurrentPrice(): number;
  setCurrentPrice(price: number): void;
  saveState(): any;
  restoreState(state: any): void;
}

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

export interface GeneratorPoolOptions {
  tickIntervalMs?: number;
  seed?: number;
  /** Per-instrument volatility scale (token → multiplier). */
  volatilityScale?: Record<number, number>;
  regimeSwitchBars?: number;
  regimeProbabilities?: RandomWalkGeneratorOptions['regimeProbabilities'];
  regimePersistence?: number;
  enableSeasonality?: boolean;
  shockProbability?: number;
  shockSize?: number;
  /** Optional CSV data provider — symbols with CSVs use real data. */
  csvDataProvider?: CsvDataProvider;
}

export class GeneratorPool {
  private generators = new Map<number, TickGenerator>();
  private timers = new Map<number, NodeJS.Timeout>();
  private latestTicks = new Map<number, Tick>();
  private defaultTickIntervalMs: number;
  private seed?: number;
  private volatilityScale: Record<number, number>;
  private regimeSwitchBars?: number;
  private regimeProbabilities?: RandomWalkGeneratorOptions['regimeProbabilities'];
  private regimePersistence?: number;
  private enableSeasonality?: boolean;
  private shockProbability?: number;
  private shockSize?: number;
  private csvDataProvider?: CsvDataProvider;

  constructor(
    private bus: TickEventBus,
    options?: GeneratorPoolOptions
  ) {
    this.defaultTickIntervalMs = options?.tickIntervalMs ?? 1000;
    this.seed = options?.seed;
    this.volatilityScale = options?.volatilityScale ?? {};
    this.regimeSwitchBars = options?.regimeSwitchBars;
    this.regimeProbabilities = options?.regimeProbabilities;
    this.regimePersistence = options?.regimePersistence;
    this.enableSeasonality = options?.enableSeasonality;
    this.shockProbability = options?.shockProbability;
    this.shockSize = options?.shockSize;
    this.csvDataProvider = options?.csvDataProvider;
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
    const scale = this.volatilityScale[instrument.instrument_token] ?? 1;
    const genOptions: RandomWalkGeneratorOptions = {
      instrumentToken: instrument.instrument_token,
      basePrice,
      tickSize: Number(instrument.tick_size),
      volatility: options?.volatility !== undefined ? options.volatility * scale : undefined,
      seed: this.seed,
      tradable: instrument.instrument_type !== 'INDEX',
      regimeSwitchBars: this.regimeSwitchBars,
      regimeProbabilities: this.regimeProbabilities,
      regimePersistence: this.regimePersistence,
      enableSeasonality: this.enableSeasonality,
      shockProbability: this.shockProbability,
      shockSize: this.shockSize,
    };

    // Prefer real CSV data when present; fall back to the random walk.
    let generator: TickGenerator;
    const csvRows = this.csvDataProvider?.getLatestDayRows(instrument.instrument_token);
    if (csvRows && csvRows.length > 0) {
      generator = new CsvTickGenerator(csvRows);
    } else {
      generator = new RandomWalkGenerator(genOptions);
    }
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
  getGenerator(token: number): TickGenerator | undefined {
    return this.generators.get(token);
  }

  /**
   * Ensure a generator exists for a token, registering one from the
   * instrument master on demand (JIT) if it does not. Returns the generator.
   */
  ensureGenerator(token: number): TickGenerator | undefined {
    const existing = this.generators.get(token);
    if (existing) return existing;
    const inst = this.resolveToken(token);
    if (inst) {
      this.addInstrument(inst);
      return this.generators.get(token);
    }
    return undefined;
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
