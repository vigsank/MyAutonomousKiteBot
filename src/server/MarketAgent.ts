import { RSI, ADX, ATR, SMA } from '@debut/indicators';
import { AppConfig } from './AppConfig';
import { LiveDataProvider } from './MarketDataProvider';
import { Ledger } from './Ledger';
import { RiskEngine } from './RiskEngine';
import { PaperTrader } from './PaperTrader';
import { TelegramHITL, ApprovalResult } from './TelegramHITL';
import { NewsSentimentEngine, AnalystVerdict } from './NewsSentimentEngine';
import { NotificationService } from './NotificationService';
import { OptionsTrader } from './OptionsTrader';
import { OptionsEngine } from './OptionsEngine';
import { kellyFraction } from './TechnicalIndicators';
import { logger } from './Logger';
import {
  Position,
  Signal,
  Tick,
  TradeRequest,
  Candle,
} from './types';

/**
 * MarketAgent - the strategy brain.
 *
 * Two independent loops run in parallel:
 *  1. A 3-second coalescing tick loop that computes indicators from live ticks
 *     and generates entry/exit signals.
 *  2. A 10-minute AI/news analysis loop that factors sentiment into signals.
 *
 * Strategy guards (all configurable, all designed to prevent the "falling
 * knife" / whipsaw problem):
 *  - ADX regime filter: skip entries in trending markets (mean-reversion only
 *    works in ranging markets).
 *  - Volume confirmation: require volume above a multiple of the average.
 *  - Time-of-day filter: skip first/last N minutes of the session.
 *  - Correlation cap: limit simultaneous entries to avoid concentrated risk.
 *  - Volatility-based position sizing: size quantity by risk-per-trade budget
 *    and ATR.
 *  - Circuit breaker: halt entries after N trades in a window.
 *  - ATR-based stop-loss: adaptive, never wider than the fixed hard cap.
 */
export class MarketAgent {
  /** Per-symbol rolling RSI(14). */
  private rsi = new Map<string, RSI>();
  private rsiValues = new Map<string, number>();
  /** Per-symbol ADX(14) for regime detection. */
  private adx = new Map<string, ADX>();
  private adxValues = new Map<string, number>();
  /** Per-symbol ATR(14) for adaptive stops and position sizing. */
  private atr = new Map<string, ATR>();
  private atrValues = new Map<string, number>();
  /** Per-symbol fast/slow SMA for the pullback-in-uptrend strategy. */
  private smaFast = new Map<string, SMA>();
  private smaSlow = new Map<string, SMA>();
  private smaFastValues = new Map<string, number>();
  private smaSlowValues = new Map<string, number>();
  /** Rolling window of recent highs per symbol (for breakout detection). */
  private breakoutHighs = new Map<string, number[]>();
  /** Highest price since entry per symbol (for ATR trailing stop). */
  private trailingHighs = new Map<string, number>();

  /** Per-symbol last coalesced price. */
  private lastPrices = new Map<string, number>();
  /** Per-symbol sentiment score cached from the news loop. */
  private sentiment = new Map<string, number>();
  /** Last "no entry" reason recorded per symbol (throttle to avoid flooding). */
  private lastSkipReason = new Map<string, string>();
  /** When the news loop last ran per symbol. */
  private lastNewsRun = new Map<string, number>();

  /**
   * Diagnostic counters: how many candidate signals were rejected at each gate
   * (and how many were proposed). Lets us see exactly where signals die.
   */
  private gateCounters = new Map<string, number>();
  private totalEvaluations = 0;

  /** Current accumulating OHLC bar per symbol (for ADX/ATR). */
  private bars = new Map<string, { open: number; high: number; low: number; close: number; volume: number; start: number }>();
  /** Rolling volume samples per symbol (for confirmation). */
  private volumeSamples = new Map<string, number[]>();
  /** Rolling closes per symbol (for Bollinger bands). */
  private bollingerCloses = new Map<string, number[]>();

  /** Opening Range Breakout tracking per symbol. */
  private orbHigh = new Map<string, number>();
  private orbLow = new Map<string, number>();
  private orbEstablished = new Map<string, boolean>();
  private lastOrbDayKey = '';

  /** Action bias per symbol from the latest daily report (Reasoning Layer veto). */
  private reportBias = new Map<string, string>();
  private reportBiasLoadedAt = '';

  /** Symbols whose stop has ratcheted to breakeven (persistent within a run). */
  private breakevenTriggered = new Map<string, boolean>();

  /** Timestamps of recent filled trades (circuit breaker). */
  private tradeTimes: number[] = [];
  /** Timestamp until which entries are halted (circuit breaker). */
  private circuitBreakerUntil = 0;

  /**
   * Serializes risk-check + execution so concurrent proposals can't both pass
   * the capital gate. Each proposal runs only after the previous completes.
   */
  private tradeQueue: Promise<void> = Promise.resolve();

  private readonly NEWS_INTERVAL_MS = 10 * 60 * 1000;
  private readonly NEWS_DETAIL_INTERVAL_MS = 5 * 60 * 1000;
  private lastNewsDetailRun = new Map<string, number>();

  constructor(
    private readonly config: AppConfig,
    private readonly streamer: LiveDataProvider,
    private readonly ledger: Ledger,
    private readonly risk: RiskEngine,
    private readonly trader: PaperTrader,
    private readonly telegram: TelegramHITL,
    private readonly news: NewsSentimentEngine,
    private readonly notify: NotificationService,
    private readonly options: OptionsTrader,
  ) {
    // Restore persisted runtime state (e.g. circuit breaker) across restarts.
    this.restoreState();
  }

  /* ================================================================ */
  /* Indicator helpers                                                  */
  /* ================================================================ */

  private rsiFor(symbol: string): RSI {
    const existing = this.rsi.get(symbol);
    if (existing) return existing;
    const inst = new RSI(14);
    this.rsi.set(symbol, inst);
    return inst;
  }

  private adxFor(symbol: string): ADX {
    const existing = this.adx.get(symbol);
    if (existing) return existing;
    const inst = new ADX(14);
    this.adx.set(symbol, inst);
    return inst;
  }

  private atrFor(symbol: string): ATR {
    const existing = this.atr.get(symbol);
    if (existing) return existing;
    const inst = new ATR(14);
    this.atr.set(symbol, inst);
    return inst;
  }

  private smaFastFor(symbol: string): SMA {
    const existing = this.smaFast.get(symbol);
    if (existing) return existing;
    const inst = new SMA(this.config.strategy.pullbackFastSma);
    this.smaFast.set(symbol, inst);
    return inst;
  }

  private smaSlowFor(symbol: string): SMA {
    const existing = this.smaSlow.get(symbol);
    if (existing) return existing;
    const inst = new SMA(this.config.strategy.pullbackSlowSma);
    this.smaSlow.set(symbol, inst);
    return inst;
  }

  /* ================================================================ */
  /* Tick processing                                                    */
  /* ================================================================ */

  /**
   * Feed a coalesced batch of ticks into the strategy. Called on the 3s loop.
   */
  onTicks(ticks: Tick[], now: Date = new Date()): void {
    for (const tick of ticks) {
      const token = tick.instrument_token;
      const inst = this.streamer.getInstrument(token);
      if (!inst) continue;
      const symbol = inst.tradingsymbol;
      if (!this.isTracked(symbol)) continue;

      const price = tick.last_price;
      this.lastPrices.set(symbol, price);
      // Persist the latest price so the RiskEngine's drawdown (which includes
      // unrealized PnL on open positions) actually sees live prices.
      this.ledger.updateLastPrice(token, price);

      // Accumulate OHLC bar. Indicators (RSI/SMA/ADX/ATR) are updated on bar
      // close in finalizeBar — never on raw ticks — to avoid signal noise.
      this.accumulateBar(symbol, price, tick.volume_traded ?? 0, now);
      this.updateOrb(symbol, price, now);
    }

    // Evaluate each tracked symbol on this batch.
    for (const symbol of this.trackedSymbols()) {
      this.evaluateSymbol(symbol, now);
    }
  }

  /**
   * Feed historical candles for indicator warmup at startup.
   */
  async warmup(
    symbol: string,
    candles: Candle[],
  ): Promise<{ rsi: number | null; adx: number | null; atr: number | null }> {
    const rsi = this.rsiFor(symbol);
    const adx = this.adxFor(symbol);
    const atr = this.atrFor(symbol);
    let rsiV: number | null = null;
    let adxV: number | null = null;
    let atrV: number | null = null;

    for (const c of candles) {
      const r = rsi.nextValue(c.close);
      if (r !== undefined) {
        rsiV = r;
        this.rsiValues.set(symbol, r);
      }
      const a = adx.nextValue(c.high, c.low, c.close);
      if (a && a.adx !== undefined) {
        adxV = a.adx;
        this.adxValues.set(symbol, a.adx);
      }
      const t = atr.nextValue(c.high, c.low, c.close);
      if (t !== undefined) {
        atrV = t;
        this.atrValues.set(symbol, t);
      }
      this.feedSma(symbol, c.close);

      // Track rolling highs for breakout detection.
      const lookback = this.config.strategy.breakoutLookback;
      const highs = this.breakoutHighs.get(symbol) ?? [];
      highs.push(c.high);
      if (highs.length > lookback) highs.shift();
      this.breakoutHighs.set(symbol, highs);

      // Volume sample for confirmation.
      const samples = this.volumeSamples.get(symbol) ?? [];
      samples.push(c.volume || 1);
      if (samples.length > 30) samples.shift();
      this.volumeSamples.set(symbol, samples);
    }
    return { rsi: rsiV, adx: adxV, atr: atrV };
  }

  /**
   * Feed a single OHLC candle directly into the indicators and evaluate the
   * symbol (used for backtesting against historical candles).
   */
  onCandle(symbol: string, candle: Candle, now: Date = candle.date): void {
    if (!this.isTracked(symbol)) return;
    if (!Number.isFinite(candle.close)) return;

    this.lastPrices.set(symbol, candle.close);
    this.updateOrb(symbol, candle.close, now);

    const r = this.rsiFor(symbol).nextValue(candle.close);
    if (r !== undefined) this.rsiValues.set(symbol, r);

    const a = this.adxFor(symbol).nextValue(candle.high, candle.low, candle.close);
    if (a && a.adx !== undefined) this.adxValues.set(symbol, a.adx);

    const t = this.atrFor(symbol).nextValue(candle.high, candle.low, candle.close);
    if (t !== undefined) this.atrValues.set(symbol, t);

    this.feedSma(symbol, candle.close);

    // Track rolling highs for breakout detection.
    const lookback = this.config.strategy.breakoutLookback;
    const highs = this.breakoutHighs.get(symbol) ?? [];
    highs.push(candle.high);
    if (highs.length > lookback) highs.shift();
    this.breakoutHighs.set(symbol, highs);

    // Volume sample for confirmation.
    const samples = this.volumeSamples.get(symbol) ?? [];
    samples.push(candle.volume || 1);
    if (samples.length > 30) samples.shift();
    this.volumeSamples.set(symbol, samples);

    // Feed Bollinger bands (rolling close window).
    this.feedBollinger(symbol, candle.close);

    this.evaluateSymbol(symbol, now);
  }

  /** Feed both fast and slow SMAs for a symbol. */
  private feedSma(symbol: string, price: number): void {
    const f = this.smaFastFor(symbol).nextValue(price);
    if (f !== undefined) this.smaFastValues.set(symbol, f);
    const s = this.smaSlowFor(symbol).nextValue(price);
    if (s !== undefined) this.smaSlowValues.set(symbol, s);
  }

  /** Feed a close into the rolling Bollinger window. */
  private feedBollinger(symbol: string, price: number): void {
    const cfg = this.config.strategy;
    const closes = this.bollingerCloses.get(symbol) ?? [];
    closes.push(price);
    if (closes.length > cfg.bollingerPeriod) closes.shift();
    this.bollingerCloses.set(symbol, closes);
  }

  /** Current Bollinger bands for a symbol, or null until the window is full. */
  private bollingerFor(symbol: string): { lower: number; middle: number; upper: number } | null {
    const cfg = this.config.strategy;
    const closes = this.bollingerCloses.get(symbol) ?? [];
    if (closes.length < cfg.bollingerPeriod) return null;
    const mean = closes.reduce((s, v) => s + v, 0) / closes.length;
    const variance = closes.reduce((s, v) => s + (v - mean) ** 2, 0) / closes.length;
    const sd = Math.sqrt(variance);
    return {
      lower: mean - cfg.bollingerStdDev * sd,
      middle: mean,
      upper: mean + cfg.bollingerStdDev * sd,
    };
  }

  /** Accumulate the current OHLC bar and finalize it after the bar interval. */
  private accumulateBar(symbol: string, price: number, volume: number, now: Date): void {
    const intervalMs = this.config.strategy.barIntervalSeconds * 1000;
    let bar = this.bars.get(symbol);

    if (!bar || now.getTime() - bar.start >= intervalMs) {
      // Finalize the previous bar into ADX/ATR before starting a new one.
      if (bar) this.finalizeBar(symbol, bar);
      bar = { open: price, high: price, low: price, close: price, volume, start: now.getTime() };
      this.bars.set(symbol, bar);
    } else {
      bar.high = Math.max(bar.high, price);
      bar.low = Math.min(bar.low, price);
      bar.close = price;
      // tick.volume_traded is cumulative — capture the latest value, don't sum.
      bar.volume = volume;
    }
  }

  private finalizeBar(symbol: string, bar: { open: number; high: number; low: number; close: number; volume: number; start: number }): void {
    // Update indicators on the CLOSED bar only (not on raw ticks).
    const r = this.rsiFor(symbol).nextValue(bar.close);
    if (r !== undefined) this.rsiValues.set(symbol, r);
    this.feedSma(symbol, bar.close);

    const adxRes = this.adxFor(symbol).nextValue(bar.high, bar.low, bar.close);
    if (adxRes && adxRes.adx !== undefined) this.adxValues.set(symbol, adxRes.adx);

    const atr = this.atrFor(symbol).nextValue(bar.high, bar.low, bar.close);
    if (atr !== undefined) this.atrValues.set(symbol, atr);

    // Track rolling highs for breakout detection (live path).
    const lookback = this.config.strategy.breakoutLookback;
    const highs = this.breakoutHighs.get(symbol) ?? [];
    highs.push(bar.high);
    if (highs.length > lookback) highs.shift();
    this.breakoutHighs.set(symbol, highs);

    // Track volume sample for confirmation.
    const samples = this.volumeSamples.get(symbol) ?? [];
    samples.push(bar.close > 0 ? bar.volume || 1 : 1);
    if (samples.length > 30) samples.shift();
    this.volumeSamples.set(symbol, samples);

    // Persist the closed bar so the UI Market chart shows live prices.
    try {
      this.ledger.recordCandle(symbol, this.exchangeFor(symbol), this.barIntervalLabel(), {
        timestamp: new Date(bar.start).toISOString(),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      });
    } catch {
      /* non-fatal: candle persistence must never disrupt trading */
    }
  }

  /** Human-readable bar interval label for the candles table / UI. */
  private barIntervalLabel(): string {
    const s = this.config.strategy.barIntervalSeconds;
    if (s === 60) return '1minute';
    if (s === 300) return '5minute';
    if (s === 900) return '15minute';
    return `${s}s`;
  }

  /* ================================================================ */
  /* Decision logic                                                     */
  /* ================================================================ */

  private evaluateSymbol(symbol: string, now: Date): void {
    const price = this.lastPrices.get(symbol);
    if (price === undefined) return;

    const rsiValue = this.rsiValues.get(symbol);
    if (rsiValue === undefined || rsiValue === null) return;

    this.totalEvaluations++;

    const position = this.ledger.getPosition(symbol, this.exchangeFor(symbol));
    const sentiment = this.sentiment.get(symbol) ?? 0;

    if (position) {
      this.checkExit(symbol, position, price, rsiValue, now);
      return;
    }

    // Regime-adaptive mode selection: pick the strategy that fits the regime.
    const regime = this.classifyRegime(symbol).regime;
    const mode = this.config.strategy.regimeAdaptive
      ? this.selectModeForRegime(regime)
      : this.config.strategy.mode;

    // Optional regime gate for a fixed (non-adaptive) mode.
    if (!this.config.strategy.regimeAdaptive && this.config.strategy.regimeGatingEnabled) {
      const regimeOk =
        mode === 'mean_reversion'
          ? regime === 'ranging'
          : regime === 'trending_up' || regime === 'trending_down';
      if (!regimeOk) {
        this.countGate('regime_gate');
        this.ledger.recordSignal({
          symbol,
          direction: 'NEUTRAL',
          rsi: rsiValue,
          price,
          reason: `Skipped: regime ${regime} not suitable for ${mode}`,
          timestamp: now,
          exchange: this.exchangeFor(symbol),
        });
        return;
      }
    }

    // No strategy fits this regime (e.g. LONG-only bot in a downtrend).
    if (!mode) {
      this.countGate('no_mode');
      this.recordNoEntry(symbol, rsiValue, price, now, `no strategy for ${regime} regime`);
      return;
    }

    // Evidence-based confidence floor.
    if (this.config.strategy.minSignalConfidence > 0) {
      const conf = this.computeSignalConfidence(symbol, rsiValue, sentiment);
      if (conf < this.config.strategy.minSignalConfidence) {
        this.countGate('confidence');
        this.ledger.recordSignal({
          symbol,
          direction: 'NEUTRAL',
          rsi: rsiValue,
          price,
          reason: `Skipped: confidence ${conf.toFixed(2)} < ${this.config.strategy.minSignalConfidence}`,
          timestamp: now,
          exchange: this.exchangeFor(symbol),
        });
        return;
      }
    }

    // Minimum reward:risk gate (skipped for Bollinger entry — the band IS the edge).
    if (!this.config.strategy.bollingerEntry && this.config.strategy.minRiskReward > 0) {
      const stopDist = this.stopDistance(symbol, price);
      const atr = this.atrValues.get(symbol) ?? 0;
      const targetDist = atr * this.config.strategy.targetAtrMultiplier;
      const rr = stopDist > 0 ? targetDist / stopDist : 0;
      if (rr + 1e-9 < this.config.strategy.minRiskReward) {
        this.countGate('risk_reward');
        this.ledger.recordSignal({
          symbol,
          direction: 'NEUTRAL',
          rsi: rsiValue,
          price,
          reason: `Skipped: R:R ${rr.toFixed(2)} < ${this.config.strategy.minRiskReward}`,
          timestamp: now,
          exchange: this.exchangeFor(symbol),
        });
        return;
      }
    }

    // Opening Range Breakout gate: only for breakout mode. No orders during
    // the range; after it, LONG entries require a breakout above the opening
    // range high with volume. Mean-reversion/pullback entries (which need price
    // low/oversold) must NOT be gated by a breakout filter.
    if (mode === 'breakout' && !this.orbAllowsLong(symbol, price, now)) {
      this.countGate('orb');
      this.ledger.recordSignal({
        symbol,
        direction: 'NEUTRAL',
        rsi: rsiValue,
        price,
        reason: 'Skipped: ORB gate (no breakout above opening range)',
        timestamp: now,
        exchange: this.exchangeFor(symbol),
      });
      return;
    }

    // Reasoning Layer veto: the latest daily report can block entries for
    // symbols it marks AVOID / EXIT_FULL (LLM as a signal source, not a force).
    if (this.reportBlocksEntry(symbol)) {
      this.countGate('report_veto');
      this.ledger.recordSignal({
        symbol,
        direction: 'NEUTRAL',
        rsi: rsiValue,
        price,
        reason: 'Skipped: daily report AVOID/EXIT_FULL',
        timestamp: now,
        exchange: this.exchangeFor(symbol),
      });
      return;
    }

    if (mode === 'breakout') {
      this.checkEntryBreakout(symbol, price, sentiment, now);
    } else if (mode === 'pullback_trend') {
      this.checkEntryPullback(symbol, price, rsiValue, sentiment, now);
    } else {
      this.checkEntry(symbol, price, rsiValue, sentiment, now);
    }

    // Record why no entry was taken (throttled per symbol per reason).
    this.recordNoEntry(symbol, rsiValue, price, now, this.computeNoEntryReason(symbol, mode, rsiValue, price));
  }

  /** Rule-based market regime classifier with a rough confidence estimate. */
  private classifyRegime(
    symbol: string,
  ): { regime: 'trending_up' | 'trending_down' | 'ranging' | 'volatile'; confidence: number } {
    const cfg = this.config.strategy;
    const adx = this.adxValues.get(symbol);
    const atr = this.atrValues.get(symbol);
    const price = this.lastPrices.get(symbol);
    const fast = this.smaFastValues.get(symbol);
    const slow = this.smaSlowValues.get(symbol);

    const volRatio = atr && price ? atr / price : 0;
    const trending = adx !== undefined && adx >= cfg.adxTrendThreshold;
    const upTrend = fast !== undefined && slow !== undefined && fast > slow;
    const downTrend = fast !== undefined && slow !== undefined && fast < slow;
    const highlyTrending = adx !== undefined && adx >= cfg.adxTrendThreshold + 10;
    const volatile = volRatio > 0.005;

    if (volatile && !trending) return { regime: 'volatile', confidence: 0.5 };
    if (trending && upTrend) return { regime: 'trending_up', confidence: highlyTrending ? 0.8 : 0.6 };
    if (trending && downTrend) return { regime: 'trending_down', confidence: highlyTrending ? 0.8 : 0.6 };
    return { regime: 'ranging', confidence: 0.5 };
  }

  /** Map a detected market regime to the strategy mode that fits it. */
  private selectModeForRegime(
    regime: 'trending_up' | 'trending_down' | 'ranging' | 'volatile',
  ): 'mean_reversion' | 'pullback_trend' | 'breakout' | null {
    switch (regime) {
      case 'ranging':
        return 'mean_reversion';
      case 'trending_up':
        return 'pullback_trend';
      case 'trending_down':
        return null; // stay flat in a downtrend — do not catch falling knives
      case 'volatile':
        return 'mean_reversion'; // oversold bounce even in high volatility
      default:
        return 'mean_reversion';
    }
  }

  /** Evidence-based confidence from indicator/sentiment agreement (0-1). */
  private computeSignalConfidence(symbol: string, rsiValue: number, sentiment: number): number {
    const cfg = this.config.strategy;
    const adx = this.adxValues.get(symbol);
    const fast = this.smaFastValues.get(symbol);
    const slow = this.smaSlowValues.get(symbol);

    let agree = 0;
    let total = 0;

    if (cfg.mode === 'mean_reversion') {
      total += 1;
      if (rsiValue < cfg.rsiEntryThreshold) agree += 1;
    } else {
      total += 1;
      if (fast !== undefined && slow !== undefined && fast > slow) agree += 1;
      if (adx !== undefined && adx >= cfg.adxTrendThreshold) {
        total += 1;
        agree += 1;
      }
    }

    total += 1;
    if (sentiment > 0) agree += 1;

    return total > 0 ? agree / total : 0;
  }

  /** Concise reason the current mode didn't take an entry (primary gate). */
  private computeNoEntryReason(
    symbol: string,
    mode: 'mean_reversion' | 'pullback_trend' | 'breakout',
    rsiValue: number,
    price: number,
  ): string {
    const cfg = this.config.strategy;
    switch (mode) {
      case 'mean_reversion':
        return rsiValue >= cfg.rsiEntryThreshold
          ? `RSI ${rsiValue.toFixed(1)} not oversold (<${cfg.rsiEntryThreshold})`
          : `conditions not met (RSI ${rsiValue.toFixed(1)})`;
      case 'pullback_trend': {
        const fast = this.smaFastValues.get(symbol);
        const slow = this.smaSlowValues.get(symbol);
        if (fast === undefined || slow === undefined || fast <= slow) return 'no uptrend structure';
        return price <= slow ? `price ${price.toFixed(0)} below slow SMA ${slow.toFixed(0)}` : 'conditions not met';
      }
      case 'breakout': {
        const highs = this.breakoutHighs.get(symbol) ?? [];
        const prior = highs.length ? Math.max(...highs) : 0;
        return price <= prior ? `price ${price.toFixed(0)} not above prior high ${prior.toFixed(0)}` : 'conditions not met';
      }
      default:
        return 'conditions not met';
    }
  }

  /** Record a throttled "why not entered" NEUTRAL signal per symbol. */
  private recordNoEntry(symbol: string, rsiValue: number, price: number, now: Date, reason: string): void {
    if (reason === this.lastSkipReason.get(symbol)) return;
    this.lastSkipReason.set(symbol, reason);
    this.ledger.recordSignal({
      symbol,
      direction: 'NEUTRAL',
      rsi: rsiValue,
      price,
      reason: `No entry: ${reason}`,
      timestamp: now,
      exchange: this.exchangeFor(symbol),
    });
  }

  /** Increment a diagnostic gate counter. */
  private countGate(reason: string): void {
    this.gateCounters.set(reason, (this.gateCounters.get(reason) ?? 0) + 1);
  }

  /** Snapshot of the diagnostic gate counters (for backtest reporting). */
  getGateCounters(): Record<string, number> {
    return {
      total_evaluations: this.totalEvaluations,
      ...Object.fromEntries(this.gateCounters),
    };
  }

  /** Volatility-adaptive stop distance for a symbol at a price. */
  private stopDistance(symbol: string, price: number): number {
    const cfg = this.config.strategy;
    const atr = this.atrValues.get(symbol) ?? 0;
    // Mirror RiskEngine.stopLossPrice so sizing/R:R use the actual enforced stop.
    const atrDist = atr * cfg.atrStopMultiplier;
    const maxDist = price * (cfg.stopLossPercent / 100);
    return Math.min(atrDist, maxDist);
  }

  /**
   * Entry logic — every guard must pass before a trade is proposed.
   */
  private checkEntry(
    symbol: string,
    price: number,
    rsiValue: number,
    sentiment: number,
    now: Date,
  ): void {
    const cfg = this.config.strategy;
    const reasons: string[] = [];

    // 1. RSI must be oversold (stricter threshold for Bollinger entry).
    const entryRsi = cfg.bollingerEntry ? cfg.bollingerRsiEntry : cfg.rsiEntryThreshold;
    if (rsiValue >= entryRsi) {
      this.countGate('rsi_not_oversold');
      return;
    }

    // 1b. Bollinger mean-reversion: price must touch the lower band.
    if (cfg.bollingerEntry) {
      const bb = this.bollingerFor(symbol);
      if (!bb || price >= bb.lower) {
        this.countGate('bollinger_band');
        return;
      }
    }

    // 2. Sentiment must not be strongly bearish.
    if (sentiment < -0.4) {
      this.countGate('sentiment_bearish');
      return;
    }

    // 3. Cooldown after last trade.
    if (!this.risk.cooldownElapsed(now)) {
      this.countGate('cooldown');
      logger.debug({ symbol }, 'Skipping: in cooldown');
      return;
    }

    // 4. Circuit breaker — halt after too many trades in a window.
    if (this.isCircuitBreakerHalted(now)) {
      this.countGate('circuit_breaker');
      logger.debug({ symbol }, 'Skipping: circuit breaker active');
      return;
    }

    // 5. Time-of-day filter.
    if (!this.isTradingWindowOpen(now)) {
      this.countGate('trading_window');
      logger.debug({ symbol }, 'Skipping: outside trading window');
      return;
    }

    // 6. ADX regime filter — skip trending markets, unless RSI is deeply oversold
    //    (a deep mean-reversion bounce can work even in a mild trend). Bollinger
    //    entries use a relaxed ADX limit so they don't catch falling knives.
    const adx = this.adxValues.get(symbol);
    const deepOversold = rsiValue < cfg.rsiEntryThreshold - cfg.deepOversoldBuffer;
    const adxLimit = cfg.bollingerEntry ? cfg.adxTrendThreshold - 5 : cfg.adxTrendThreshold;
    if (adx !== undefined && adx >= adxLimit && !deepOversold) {
      this.countGate('adx_trending');
      reasons.push(`ADX ${adx.toFixed(1)} trending (>${cfg.adxTrendThreshold})`);
      logger.debug({ symbol, adx }, 'Skipping: trending market');
      this.ledger.recordSignal({
        symbol,
        direction: 'NEUTRAL',
        rsi: rsiValue,
        price,
        reason: `Skipped entry: ${reasons.join('; ')}`,
        timestamp: new Date(),
        sentiment_score: sentiment,
        exchange: this.exchangeFor(symbol),
      });
      return;
    }

    // 7. Volume confirmation — require volume above average (all entries).
    if (!this.hasVolumeConfirmation(symbol)) {
      this.countGate('volume');
      reasons.push('Insufficient volume confirmation');
      logger.debug({ symbol }, 'Skipping: low volume');
      return;
    }

    // 8. Correlation cap — limit simultaneous entries.
    if (!this.entrySlotAvailable()) {
      this.countGate('concentration_cap');
      reasons.push('Simultaneous-entry cap reached');
      logger.debug('Skipping: concentration cap reached');
      return;
    }

    const watch = this.config.watchlist.find(
      (s) => s.tradingsymbol === symbol && s.enabled,
    );
    if (!watch) return;

    // 9. Volatility-based position sizing (risk parity).
    const quantity = this.sizedQuantity(symbol, watch.quantity, price);
    if (quantity <= 0) {
      this.countGate('sizing');
      logger.debug({ symbol }, 'Skipping: risk-per-trade too small');
      return;
    }
    const ticketSize = quantity * price;

    const reason =
      `RSI ${rsiValue.toFixed(1)} oversold (<${cfg.rsiEntryThreshold}), ` +
      (adx !== undefined ? `ADX ${adx.toFixed(1)} ranging (<${cfg.adxTrendThreshold}), ` : '') +
      `sentiment ${sentiment.toFixed(2)}`;

    this.countGate('proposed');
    this.ledger.recordSignal({
      symbol,
      direction: 'LONG',
      rsi: rsiValue,
      price,
      reason,
      timestamp: new Date(),
      sentiment_score: sentiment,
      exchange: this.exchangeFor(symbol),
    });

    this.proposeTrade({
      symbol,
      exchange: watch.exchange,
      quantity,
      direction: 'LONG',
      entryPrice: price,
      reason,
      ticketSize,
      timestamp: now,
      stopDistance: this.stopDistance(symbol, price),
      entryMode: 'mean_reversion',
    });
  }

  /**
   * Pullback-in-uptrend entry: buy dips while the stock is in an uptrend.
   * Suited to trending blue-chips where RSI rarely reaches deep oversold.
   */
  private checkEntryPullback(
    symbol: string,
    price: number,
    rsiValue: number,
    sentiment: number,
    now: Date,
  ): void {
    const cfg = this.config.strategy;
    const reasons: string[] = [];

    // 1. Sentiment must not be strongly bearish.
    if (sentiment < -0.4) return;

    // 2. Cooldown after last trade.
    if (!this.risk.cooldownElapsed(now)) {
      logger.debug({ symbol }, 'Skipping: in cooldown');
      return;
    }

    // 3. Circuit breaker.
    if (this.isCircuitBreakerHalted(now)) {
      logger.debug({ symbol }, 'Skipping: circuit breaker active');
      return;
    }

    // 4. Time-of-day filter.
    if (!this.isTradingWindowOpen(now)) {
      logger.debug({ symbol }, 'Skipping: outside trading window');
      return;
    }

    // 5. Uptrend structure: fast SMA above slow SMA (trend intact).
    const fast = this.smaFastValues.get(symbol);
    const slow = this.smaSlowValues.get(symbol);
    if (fast === undefined || slow === undefined) return;
    if (!(fast > slow)) {
      reasons.push(`No uptrend (fast ${fast.toFixed(0)} <= slow ${slow.toFixed(0)})`);
      logger.debug({ symbol }, 'Skipping: no uptrend structure');
      return;
    }
    // Price must still be above the longer-term trend (a pullback, not a breakdown).
    if (!(price > slow)) {
      reasons.push(`Price ${price.toFixed(0)} below slow SMA ${slow.toFixed(0)}`);
      logger.debug({ symbol }, 'Skipping: price below slow SMA');
      return;
    }

    // 6. Pullback: RSI dipped to a moderate level (not deep oversold).
    if (rsiValue >= cfg.pullbackRsiEntry) {
      reasons.push(`RSI ${rsiValue.toFixed(1)} not pulled back (<${cfg.pullbackRsiEntry})`);
      return;
    }

    // 7. Volume confirmation.
    if (!this.hasVolumeConfirmation(symbol)) {
      reasons.push('Insufficient volume confirmation');
      return;
    }

    // 8. Correlation cap.
    if (!this.entrySlotAvailable()) {
      reasons.push('Simultaneous-entry cap reached');
      return;
    }

    const watch = this.config.watchlist.find(
      (s) => s.tradingsymbol === symbol && s.enabled,
    );
    if (!watch) return;

    // 9. Volatility-based position sizing.
    const quantity = this.sizedQuantity(symbol, watch.quantity, price);
    if (quantity <= 0) return;
    const ticketSize = quantity * price;

    const reason =
      `Pullback in uptrend: RSI ${rsiValue.toFixed(1)} (<${cfg.pullbackRsiEntry}), ` +
      `fast ${fast.toFixed(0)} > slow ${slow.toFixed(0)}, price ${price.toFixed(0)}`;

    this.countGate('proposed');
    this.ledger.recordSignal({
      symbol,
      direction: 'LONG',
      rsi: rsiValue,
      price,
      reason,
      timestamp: new Date(),
      sentiment_score: sentiment,
      exchange: this.exchangeFor(symbol),
    });

    this.proposeTrade({
      symbol,
      exchange: watch.exchange,
      quantity,
      direction: 'LONG',
      entryPrice: price,
      reason,
      ticketSize,
      timestamp: now,
      stopDistance: this.stopDistance(symbol, price),
      entryMode: 'pullback_trend',
    });
  }

  /**
   * Breakout / trend-following entry: buy when price breaks above the recent
   * N-bar high. Suits trending stocks (blue-chips and small-caps alike).
   */
  private checkEntryBreakout(
    symbol: string,
    price: number,
    sentiment: number,
    now: Date,
  ): void {
    const cfg = this.config.strategy;
    const reasons: string[] = [];

    // 1. Sentiment must not be strongly bearish.
    if (sentiment < -0.4) return;

    // 2. Cooldown after last trade.
    if (!this.risk.cooldownElapsed(now)) {
      logger.debug({ symbol }, 'Skipping: in cooldown');
      return;
    }

    // 3. Circuit breaker.
    if (this.isCircuitBreakerHalted(now)) {
      logger.debug({ symbol }, 'Skipping: circuit breaker active');
      return;
    }

    // 4. Time-of-day filter.
    if (!this.isTradingWindowOpen(now)) {
      logger.debug({ symbol }, 'Skipping: outside trading window');
      return;
    }

    // 5. Breakout: price must exceed the prior N-bar high (excluding current).
    const highs = this.breakoutHighs.get(symbol) ?? [];
    if (highs.length < cfg.breakoutLookback) return; // not enough history
    const priorHigh = Math.max(...highs);
    if (price <= priorHigh) {
      reasons.push(`No breakout (price ${price.toFixed(0)} <= prior high ${priorHigh.toFixed(0)})`);
      return;
    }

    // 6. Volume confirmation.
    if (!this.hasVolumeConfirmation(symbol)) {
      reasons.push('Insufficient volume confirmation');
      return;
    }

    // 7. Correlation cap.
    if (!this.entrySlotAvailable()) {
      reasons.push('Simultaneous-entry cap reached');
      return;
    }

    const watch = this.config.watchlist.find(
      (s) => s.tradingsymbol === symbol && s.enabled,
    );
    if (!watch) return;

    // 8. Volatility-based position sizing.
    const quantity = this.sizedQuantity(symbol, watch.quantity, price);
    if (quantity <= 0) return;
    const ticketSize = quantity * price;

    const reason =
      `Breakout: price ${price.toFixed(0)} > prior ${cfg.breakoutLookback}-bar high ${priorHigh.toFixed(0)}`;

    // Reset the trailing stop to the entry price.
    this.trailingHighs.set(symbol, price);

    this.countGate('proposed');
    this.ledger.recordSignal({
      symbol,
      direction: 'LONG',
      rsi: 0,
      price,
      reason,
      timestamp: new Date(),
      sentiment_score: sentiment,
      exchange: this.exchangeFor(symbol),
    });

    this.proposeTrade({
      symbol,
      exchange: watch.exchange,
      quantity,
      direction: 'LONG',
      entryPrice: price,
      reason,
      ticketSize,
      timestamp: now,
      stopDistance: this.stopDistance(symbol, price),
      entryMode: 'breakout',
    });

    // Options layer: buy a CALL on the upside breakout (if enabled).
    if (this.options.enabled) {
      const sigma = OptionsEngine.estimateSigmaFromAtr(this.atrValues.get(symbol) ?? 0, price);
      const fill = this.options.open(symbol, 'LONG', price, now, sigma);
      if (fill) {
        this.notify.trade(
          `Option BUY ${fill.symbol} ${fill.type}${fill.strike}`,
          `Premium ₹${fill.totalPremium.toFixed(2)} (${fill.quantity} lot)`,
          { symbol, option: `${fill.type}${fill.strike}`, premium: fill.totalPremium },
        );
      }
    }
  }
  private checkExit(
    symbol: string,
    position: Position,
    price: number,
    rsiValue: number,
    now: Date,
  ): void {
    const cfg = this.config.strategy;
    const atr = this.atrValues.get(symbol);
    const stop = this.risk.stopLossPrice(position, atr);

    // Breakeven stop: once price moves favorably by breakevenAtrMult*ATR, ratchet
    // the stop to breakeven so a winner can't turn into a loss. Persisted so a
    // pullback after breakeven doesn't revert the stop to the original.
    let effectiveStop = stop;
    if (atr && atr > 0) {
      const favorable =
        position.direction === 'LONG' ? price - position.avgPrice : position.avgPrice - price;
      if (favorable >= atr * cfg.breakevenAtrMult) {
        this.breakevenTriggered.set(symbol, true);
      }
      if (this.breakevenTriggered.get(symbol)) {
        effectiveStop = position.avgPrice;
      }
    }

    let exitReason: string | null = null;

    // ATR-based take-profit: lock in gains instead of waiting for RSI to reverse.
    if (atr && atr > 0) {
      const targetDist = atr * cfg.targetAtrMultiplier;
      const target =
        position.direction === 'LONG'
          ? position.avgPrice + targetDist
          : position.avgPrice - targetDist;
      if (
        (position.direction === 'LONG' && price >= target) ||
        (position.direction === 'SHORT' && price <= target)
      ) {
        exitReason = `Target hit (price ${price.toFixed(2)} ${position.direction === 'LONG' ? '>=' : '<='} ${target.toFixed(2)})`;
      }
    }

    if (rsiValue >= cfg.rsiExitThreshold) {
      exitReason = `RSI ${rsiValue.toFixed(1)} overbought (>${cfg.rsiExitThreshold})`;
    } else if (cfg.bollingerEntry && position.direction === 'LONG') {
      // Bollinger mean-reversion target: exit when price reverts to the middle band.
      const bb = this.bollingerFor(symbol);
      if (bb && price >= bb.middle) {
        exitReason = `Bollinger target hit (price ${price.toFixed(2)} >= middle band ${bb.middle.toFixed(2)})`;
      }
    } else if (position.direction === 'LONG' && price <= effectiveStop) {
      exitReason = `Stop-loss hit (price ${price.toFixed(2)} <= ${effectiveStop.toFixed(2)}, ATR ${atr?.toFixed(2) ?? 'n/a'})`;
    } else if (position.direction === 'SHORT' && price >= effectiveStop) {
      exitReason = `Stop-loss hit (price ${price.toFixed(2)} >= ${effectiveStop.toFixed(2)}, ATR ${atr?.toFixed(2) ?? 'n/a'})`;
    } else if (position.entryMode === 'pullback_trend' && position.direction === 'LONG') {
      // Trend break: price fell back below the fast SMA.
      const fast = this.smaFastValues.get(symbol);
      if (fast !== undefined && price < fast) {
        exitReason = `Trend break (price ${price.toFixed(2)} < fast SMA ${fast.toFixed(2)})`;
      }
    } else if (position.entryMode === 'breakout' && position.direction === 'LONG') {
      // ATR trailing stop: ratchet the stop up as price makes new highs.
      const prevHigh = this.trailingHighs.get(symbol) ?? position.avgPrice;
      const newHigh = Math.max(prevHigh, price);
      this.trailingHighs.set(symbol, newHigh);
      const trail = (atr ?? 0) * cfg.breakoutTrailAtrMult;
      const trailStop = newHigh - trail;
      if (price < trailStop) {
        exitReason = `Trailing stop hit (price ${price.toFixed(2)} < ${trailStop.toFixed(2)}, high ${newHigh.toFixed(2)})`;
      }
    }

    if (!exitReason) return;

    this.proposeTrade({
      symbol,
      exchange: position.exchange,
      quantity: position.quantity,
      direction: position.direction === 'LONG' ? 'SHORT' : 'LONG',
      entryPrice: price,
      reason: exitReason,
      ticketSize: position.quantity * price,
      timestamp: now,
    });

    // Options layer: close the option position when the equity exits.
    if (this.options.enabled) {
      const sigma = OptionsEngine.estimateSigmaFromAtr(this.atrValues.get(symbol) ?? 0, price);
      const fill = this.options.close(symbol, price, now, sigma);
      if (fill) {
        this.notify.trade(
          `Option SELL ${fill.symbol} ${fill.type}${fill.strike}`,
          `P&L ₹${fill.pnl.toFixed(2)}`,
          { symbol, option: `${fill.type}${fill.strike}`, pnl: fill.pnl },
        );
      }
    }
  }

  /* ================================================================ */
  /* Strategy guards                                                   */
  /* ================================================================ */

  /** Volume must be above avg * multiplier to confirm the signal. */
  private hasVolumeConfirmation(symbol: string): boolean {
    const samples = this.volumeSamples.get(symbol) ?? [];
    if (samples.length < 5) return true; // not enough history — don't block
    const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
    const current = samples[samples.length - 1];
    return current >= avg * this.config.strategy.volumeConfirmMultiplier;
  }

  /** Risk-parity position sizing, capped at the per-trade allocation limit. */
  private sizedQuantity(symbol: string, watchQuantity: number, price: number): number {
    const cfg = this.config.strategy;
    const budget = (this.config.risk.availableCapital * cfg.riskPerTradePercent) / 100;
    const stopDist = this.stopDistance(symbol, price); // unified with RiskEngine
    const riskPerShare = stopDist;
    if (riskPerShare <= 0) return watchQuantity;

    const riskSized = Math.floor(budget / riskPerShare);
    if (riskSized <= 0) return 0;

    // Volatility-adjusted Kelly sizing (bounded by the hard risk caps).
    let kellySized = Number.MAX_SAFE_INTEGER;
    if (cfg.kellyEnabled) {
      const winProb = this.computeSignalConfidence(
        symbol,
        this.rsiValues.get(symbol) ?? 0,
        this.sentiment.get(symbol) ?? 0,
      );
      const atr = this.atrValues.get(symbol) ?? 0;
      const targetDist = atr * cfg.targetAtrMultiplier;
      const rr = stopDist > 0 ? targetDist / stopDist : 0;
      const frac = kellyFraction(winProb, rr, cfg.kellyScale);
      const kellyBudget = this.risk.capitalSnapshot().available * frac;
      // Kelly sizes the RISK budget, not notional — divide by stop distance.
      kellySized = Math.floor(kellyBudget / stopDist);
      if (kellySized <= 0) return 0; // Kelly says no position
    }

    // Concentration guard: never exceed the per-trade allocation cap (by notional).
    const allocCap =
      this.config.risk.maxTradeAllocation > 0
        ? Math.floor(this.config.risk.maxTradeAllocation / price)
        : Number.MAX_SAFE_INTEGER;
    return Math.max(1, Math.min(riskSized, kellySized, allocCap));
  }

  /** Limit how many positions can be opened at the same time (correlation). */
  private entrySlotAvailable(): boolean {
    const open = this.ledger.getOpenPositions().length;
    return open < this.config.strategy.maxSimultaneousEntries;
  }

  /** Circuit breaker: halt entries after N trades within the window. */
  private isCircuitBreakerHalted(now: Date): boolean {
    if (now.getTime() < this.circuitBreakerUntil) return true;
    const cfg = this.config.strategy;
    const windowMs = cfg.circuitBreakerWindowMinutes * 60 * 1000;
    const recent = this.tradeTimes.filter((t) => now.getTime() - t < windowMs);
    if (recent.length >= cfg.circuitBreakerTrades) {
      this.circuitBreakerUntil =
        now.getTime() + cfg.circuitBreakerHaltMinutes * 60 * 1000;
      this.persistCircuitBreaker();
      this.notify.warn(
        'Circuit breaker engaged',
        `${recent.length} trades in ${cfg.circuitBreakerWindowMinutes} min. Halting entries for ${cfg.circuitBreakerHaltMinutes} min.`,
      );
      return true;
    }
    return false;
  }

  /** Record a fill timestamp for the circuit breaker. */
  private recordTradeTime(now: Date): void {
    this.tradeTimes.push(now.getTime());
    if (this.tradeTimes.length > 100) this.tradeTimes.shift();
    this.persistCircuitBreaker();
  }

  /** Persist circuit-breaker state so it survives a restart. */
  private persistCircuitBreaker(): void {
    this.ledger.setState('cb.tradeTimes', JSON.stringify(this.tradeTimes));
    this.ledger.setState('cb.circuitBreakerUntil', String(this.circuitBreakerUntil));
  }

  /** Restore circuit-breaker state from the ledger at startup. */
  restoreState(): void {
    const times = this.ledger.getState('cb.tradeTimes');
    if (times) {
      try {
        const parsed = JSON.parse(times);
        if (Array.isArray(parsed)) {
          this.tradeTimes = parsed.filter((n) => typeof n === 'number');
        }
      } catch {
        /* ignore malformed state */
      }
    }
    const until = this.ledger.getState('cb.circuitBreakerUntil');
    if (until) {
      const n = Number(until);
      if (Number.isFinite(n)) this.circuitBreakerUntil = n;
    }
  }

  /**
   * Time-of-day filter for NSE equities (09:15–15:30 IST). Skips the first
   * and last N minutes of the session.
   */
  private isTradingWindowOpen(now: Date): boolean {
    const cfg = this.config.strategy;
    if (cfg.disableTimeFilter) return true;
    // NSE session is 09:15–15:30 IST (UTC+5:30). Convert to IST and use UTC
    // getters so the check is correct regardless of the server's timezone.
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    const open = 9 * 60 + 15;
    const close = 15 * 60 + 30;
    if (minutes < open || minutes > close) return false;
    // Skip first N minutes (ORB handles breakout's opening separately).
    if (minutes < open + cfg.skipFirstMinutes) return false;
    // Skip last N minutes.
    if (minutes > close - cfg.skipLastMinutes) return false;
    return true;
  }

  /** True when `now` is inside the opening-range window (no orders placed). */
  private isInOrbWindow(now: Date): boolean {
    const cfg = this.config.strategy;
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    const open = 9 * 60 + 15;
    return minutes >= open && minutes < open + cfg.orbMinutes;
  }

  /**
   * Track the opening range (high/low) during the first `orbMinutes` of the
   * session. Marks the range established once the window passes. Resets the
   * range at the start of each new day so it never leaks across sessions.
   */
  private updateOrb(symbol: string, price: number, now: Date): void {
    const cfg = this.config.strategy;
    if (!cfg.orbEnabled) return;
    const dayKey = now.toISOString().slice(0, 10);
    if (this.lastOrbDayKey !== dayKey) {
      this.lastOrbDayKey = dayKey;
      this.orbHigh.clear();
      this.orbLow.clear();
      this.orbEstablished.clear();
    }
    if (this.isInOrbWindow(now)) {
      const high = this.orbHigh.get(symbol) ?? -Infinity;
      const low = this.orbLow.get(symbol) ?? Infinity;
      this.orbHigh.set(symbol, Math.max(high, price));
      this.orbLow.set(symbol, Math.min(low, price));
    } else if (!this.orbEstablished.get(symbol)) {
      // Window has passed — freeze the range and mark it established.
      this.orbEstablished.set(symbol, true);
    }
  }

  /**
   * ORB gate for LONG entries: no orders during the window; after it, require
   * a breakout above the opening-range high with volume confirmation.
   */
  private orbAllowsLong(symbol: string, price: number, now: Date): boolean {
    const cfg = this.config.strategy;
    if (!cfg.orbEnabled) return true;
    if (this.isInOrbWindow(now)) return false; // no orders during the range
    if (!this.orbEstablished.get(symbol)) return true; // no range yet — don't block
    const high = this.orbHigh.get(symbol);
    if (high === undefined || !Number.isFinite(high)) return true;
    return price > high && this.hasVolumeConfirmation(symbol);
  }

  /** Load the latest daily report's per-symbol action bias (reloads on newer report). */
  private loadReportBias(): void {
    try {
      const latest = this.ledger.getLatestReport();
      if (!latest) return;
      if (latest.createdAt === this.reportBiasLoadedAt) return; // already loaded
      this.reportBiasLoadedAt = latest.createdAt;
      this.reportBias.clear();
      const parsed = JSON.parse(latest.reportJson);
      const recs = parsed?.portfolio_recommendations ?? [];
      for (const rec of recs) {
        if (rec && typeof rec.symbol === 'string' && typeof rec.action_bias === 'string') {
          this.reportBias.set(rec.symbol, rec.action_bias);
        }
      }
    } catch {
      /* ignore malformed report */
    }
  }

  /** True when the latest daily report says AVOID / EXIT_FULL for a symbol. */
  private reportBlocksEntry(symbol: string): boolean {
    this.loadReportBias();
    const bias = this.reportBias.get(symbol);
    return bias === 'AVOID' || bias === 'EXIT_FULL';
  }

  /** Ask the LLM analyst for a verdict + risk score on a candidate trade. */
  private async analystVerdictFor(trade: TradeRequest): Promise<AnalystVerdict | null> {
    if (!this.news.aiConfigured) return null;
    return this.news.analystVerdict({
      symbol: trade.symbol,
      direction: trade.direction,
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      ticketSize: trade.ticketSize,
      rsi: this.rsiValues.get(trade.symbol) ?? null,
      adx: this.adxValues.get(trade.symbol) ?? null,
      atr: this.atrValues.get(trade.symbol) ?? null,
      sentiment: this.sentiment.get(trade.symbol) ?? 0,
      reason: trade.reason,
    });
  }

  /* ================================================================ */
  /* Trade execution path                                              */
  /* ================================================================ */

  /**
   * Route a proposed trade through the risk engine and HITL approval, then
   * execute in paper mode.
   */
  private proposeTrade(trade: TradeRequest): void {
    const needsApproval = trade.ticketSize > this.config.risk.autoTradeTicketThreshold;
    const hasAsyncGate = needsApproval || this.config.strategy.analystEnabled;
    if (hasAsyncGate) {
      // Serialize HITL/analyst-gated trades so concurrent proposals can't both
      // pass the risk gate before either executes.
      this.tradeQueue = this.tradeQueue
        .then(() => this.executeProposedTrade(trade))
        .catch((err: any) => {
          logger.error({ err: err?.message, symbol: trade.symbol }, 'Trade execution error');
        });
    } else {
      // Auto-trades execute synchronously so positions are visible to subsequent
      // evaluations (critical for the synchronous backtest path).
      try {
        this.executeProposedTrade(trade);
      } catch (err: any) {
        logger.error({ err: err?.message, symbol: trade.symbol }, 'Trade execution error');
      }
    }
  }

  /** Await any pending trade executions (used by backtest/walk-forward harnesses). */
  async flush(): Promise<void> {
    await this.tradeQueue;
  }

  private async executeProposedTrade(trade: TradeRequest): Promise<void> {
    // 1. Hard risk gate - the AI can never override this.
    const risk = this.risk.evaluate(trade);
    if (!risk.allowed) {
      this.countGate('risk_blocked');
      this.notify.warn(
        `Risk blocked trade: ${trade.symbol}`,
        risk.reasons.join('\n'),
        { symbol: trade.symbol, direction: trade.direction },
      );
      return;
    }

    // 2. Optional LLM analyst verdict (soft filter - RiskEngine stays the hard gate).
    if (this.config.strategy.analystEnabled) {
      const verdict = await this.analystVerdictFor(trade);
      if (verdict && (verdict.verdict === 'AVOID' || verdict.riskScore >= this.config.strategy.analystRejectThreshold)) {
        this.countGate('analyst_rejected');
        this.notify.warn(
          `Analyst rejected trade: ${trade.symbol}`,
          `Risk ${verdict.riskScore}/100 (${verdict.verdict}) - ${verdict.rationale}`,
          { symbol: trade.symbol, direction: trade.direction, analystRisk: verdict.riskScore },
        );
        this.ledger.recordSignal({
          symbol: trade.symbol,
          direction: trade.direction,
          rsi: this.rsiValues.get(trade.symbol) ?? 0,
          price: trade.entryPrice,
          reason: `Analyst rejected (${verdict.verdict}, risk ${verdict.riskScore}): ${verdict.rationale}`,
          timestamp: new Date(),
          exchange: trade.exchange,
        });
        return;
      }
    }

    // 3. HITL: auto-trade below threshold, else ask the human.
    const needsApproval =
      trade.ticketSize > this.config.risk.autoTradeTicketThreshold;

    let approval: ApprovalResult = { decision: 'APPROVED' };
    if (needsApproval) {
      approval = await this.telegram.requestApproval(trade);
    }

    switch (approval.decision) {
      case 'APPROVED': {
        const fill = this.trader.execute(trade);
        if (fill.status === 'FILLED') {
          this.countGate('executed');
          this.recordTradeTime(trade.timestamp);
        }
        const pnlLine = fill.pnl !== 0 ? ` | PnL ₹${fill.pnl.toFixed(2)}` : '';
        this.notify.trade(
          `Paper ${fill.status}: ${fill.symbol}`,
          `${fill.direction} ${fill.quantity} @ ₹${fill.price.toFixed(2)}${pnlLine}\nReason: ${fill.reason}`,
          { tradeId: fill.tradeId, symbol: fill.symbol, pnl: fill.pnl },
        );
        break;
      }
      case 'REJECTED':
        this.notify.info(
          `Trade rejected: ${trade.symbol}`,
          'Rejected by human.',
          { symbol: trade.symbol },
        );
        break;
      case 'TIMEOUT':
        this.notify.warn(
          `Approval timeout: ${trade.symbol}`,
          'Trade skipped — no human response within 2 minutes.',
          { symbol: trade.symbol },
        );
        break;
      default:
        break;
    }
  }

  /** True when a symbol is enabled in the watchlist. */
  private isTracked(symbol: string): boolean {
    return this.config.watchlist.some(
      (s) => s.tradingsymbol === symbol && s.enabled,
    );
  }

  /** Exchange for a symbol from the watchlist (defaults to NSE). */
  private exchangeFor(symbol: string): string {
    return (
      this.config.watchlist.find((s) => s.tradingsymbol === symbol)?.exchange ??
      'NSE'
    );
  }

  private trackedSymbols(): string[] {
    return this.config.watchlist
      .filter((s) => s.enabled)
      .map((s) => s.tradingsymbol);
  }

  /* ================================================================ */
  /* News / sentiment loop                                             */
  /* ================================================================ */

  async runNewsLoop(): Promise<void> {
    for (const symbol of this.trackedSymbols()) {
      const now = Date.now();
      const last = this.lastNewsRun.get(symbol) ?? 0;
      if (now - last < this.NEWS_INTERVAL_MS) continue;

      this.lastNewsRun.set(symbol, now);
      try {
        const res = await this.news.sentimentFor(symbol);
        if (res) {
          this.sentiment.set(symbol, res.score);
          this.notify.sentiment(
            `${symbol} sentiment: ${res.label.toUpperCase()}`,
            `${res.summary}\nSources: ${res.sources.length}`,
            { symbol, score: res.score, label: res.label },
          );
        }
      } catch (err) {
        logger.error({ symbol, err }, 'News loop failed');
      }
    }
  }

  /** Every 5 min, pull deeper TinyFish details (fresh sources) for each symbol. */
  async runNewsDetailLoop(): Promise<void> {
    if (!this.news.tinyfishConfigured) return;
    for (const symbol of this.trackedSymbols()) {
      const now = Date.now();
      const last = this.lastNewsDetailRun.get(symbol) ?? 0;
      if (now - last < this.NEWS_DETAIL_INTERVAL_MS) continue;
      this.lastNewsDetailRun.set(symbol, now);
      try {
        const d = await this.news.fetchTinyFishDetails(symbol);
        if (d.articles.length > 0) {
          this.notify.sentiment(
            `${symbol} — TinyFish update`,
            `${d.answer ? d.answer + '\n' : ''}${d.articles.length} fresh sources.`,
            { symbol, sources: d.articles.map((a) => a.link) },
          );
        }
      } catch (err) {
        logger.error({ symbol, err }, 'News detail loop failed');
      }
    }
  }
}
