import { RSI, SMA } from "@debut/indicators";
import { def } from "./helpers";
import { AgentContext, AgentDef } from "./types";

/**
 * Domain B — technical analysis agents.
 *
 * Each agent is a real, read-only implementation that never throws (the `def`
 * wrapper converts any error into a 'failed' result). They read candle data
 * from the ledger's `candles` table, joined to `instruments` on `instrument_id`
 * to resolve the trading symbol.
 *
 * Note: the orchestrator does not pass dependency payloads into the context, so
 * agents that declare `deps` recompute the same underlying data from the ledger
 * via the shared helpers below. The `deps` declaration still guarantees ordering.
 */

/** A single OHLCV candle as read from the ledger. */
interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Fetch the most recent `limit` candles for a symbol, in chronological order. */
function fetchCandles(ctx: AgentContext, symbol: string, limit: number): Candle[] {
  const rows = ctx.ledger
    .raw()
    .prepare(
      `SELECT c.timestamp, c.open, c.high, c.low, c.close, c.volume
         FROM candles c
         JOIN instruments i ON i.instrument_id = c.instrument_id
        WHERE i.tradingsymbol = ?
        ORDER BY c.timestamp DESC
        LIMIT ?`,
    )
    .all(symbol, limit) as Array<{
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  return rows.reverse();
}

/** Per-symbol indicator snapshot produced by the `indicator` agent. */
interface IndicatorSnapshot {
  rsi: number | null;
  sma20: number | null;
  close: number | null;
}

/** Compute RSI(14) and SMA(20) over the last ~60 closes (chronological). */
function computeIndicatorSnapshot(ctx: AgentContext, symbol: string): IndicatorSnapshot {
  const candles = fetchCandles(ctx, symbol, 60);
  if (candles.length === 0) {
    return { rsi: null, sma20: null, close: null };
  }
  const closes = candles.map((c) => c.close);
  const rsi = new RSI(14);
  const sma = new SMA(20);
  let rsiVal: number | undefined;
  let smaVal: number | undefined;
  for (const c of closes) {
    const r = rsi.nextValue(c);
    if (r !== undefined) rsiVal = r;
    const s = sma.nextValue(c);
    if (s !== undefined) smaVal = s;
  }
  return { rsi: rsiVal ?? null, sma20: smaVal ?? null, close: closes[closes.length - 1] };
}

/** Per-symbol support/resistance levels produced by the `support_resistance` agent. */
interface SupportResistance {
  support: number | null;
  resistance: number | null;
  bars: number;
}

/** Compute recent swing high/low (max high / min low) over the last 20 bars. */
function computeSupportResistance(ctx: AgentContext, symbol: string): SupportResistance {
  const candles = fetchCandles(ctx, symbol, 20);
  if (candles.length === 0) {
    return { support: null, resistance: null, bars: 0 };
  }
  let high = -Infinity;
  let low = Infinity;
  for (const c of candles) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  return { support: low, resistance: high, bars: candles.length };
}

/** B1 — indicator: RSI(14) and SMA(20) snapshot per symbol. */
const indicator = def(
  "indicator",
  "Indicator",
  "B",
  true,
  [],
  async (ctx: AgentContext) => {
    const snapshot: Record<string, IndicatorSnapshot> = {};
    let withData = 0;
    for (const sym of ctx.symbols) {
      const snap = computeIndicatorSnapshot(ctx, sym);
      snapshot[sym] = snap;
      if (snap.close !== null) withData += 1;
    }
    return {
      summary: `indicator: computed RSI(14)/SMA(20) for ${withData}/${ctx.symbols.length} symbols`,
      payload: { snapshot },
    };
  },
);

/** B2 — trend_regime: classify each symbol's regime from close vs SMA20. */
const trendRegime = def(
  "trend_regime",
  "Trend Regime",
  "B",
  true,
  ["indicator"],
  async (ctx: AgentContext) => {
    const regime: Record<string, string> = {};
    let classified = 0;
    for (const sym of ctx.symbols) {
      const snap = computeIndicatorSnapshot(ctx, sym);
      if (snap.close === null || snap.sma20 === null) {
        regime[sym] = "no_data";
        continue;
      }
      if (snap.close > snap.sma20) {
        regime[sym] = "trending_up";
      } else if (snap.close < snap.sma20) {
        regime[sym] = "trending_down";
      } else {
        regime[sym] = "ranging";
      }
      classified += 1;
    }
    return {
      summary: `trend_regime: classified ${classified}/${ctx.symbols.length} symbols`,
      payload: { regime },
    };
  },
);

/** B3 — support_resistance: recent swing high/low per symbol. */
const supportResistance = def(
  "support_resistance",
  "Support & Resistance",
  "B",
  true,
  [],
  async (ctx: AgentContext) => {
    const levels: Record<string, SupportResistance> = {};
    let withData = 0;
    for (const sym of ctx.symbols) {
      const lvl = computeSupportResistance(ctx, sym);
      levels[sym] = lvl;
      if (lvl.bars > 0) withData += 1;
    }
    return {
      summary: `support_resistance: swing levels for ${withData}/${ctx.symbols.length} symbols`,
      payload: { levels },
    };
  },
);

/** B4 — volume_profile: average volume over the last 20 bars per symbol. */
const volumeProfile = def(
  "volume_profile",
  "Volume Profile",
  "B",
  true,
  [],
  async (ctx: AgentContext) => {
    const avgVolume: Record<string, number | null> = {};
    let withData = 0;
    for (const sym of ctx.symbols) {
      const candles = fetchCandles(ctx, sym, 20);
      if (candles.length === 0) {
        avgVolume[sym] = null;
        continue;
      }
      let sum = 0;
      for (const c of candles) sum += c.volume;
      avgVolume[sym] = sum / candles.length;
      withData += 1;
    }
    return {
      summary: `volume_profile: avg volume (20 bars) for ${withData}/${ctx.symbols.length} symbols`,
      payload: { avgVolume },
    };
  },
);

/** B5 — candlestick_pattern: simple engulfing detection from the last 2 bars. */
const candlestickPattern = def(
  "candlestick_pattern",
  "Candlestick Pattern",
  "B",
  true,
  [],
  async (ctx: AgentContext) => {
    const patterns: Record<string, string> = {};
    let detected = 0;
    for (const sym of ctx.symbols) {
      const candles = fetchCandles(ctx, sym, 3);
      if (candles.length < 2) {
        patterns[sym] = "no_data";
        continue;
      }
      const prev = candles[candles.length - 2];
      const last = candles[candles.length - 1];
      let pattern = "none";
      if (last.close > prev.open && prev.close < prev.open) {
        pattern = "bullish_engulfing";
      } else if (last.close < prev.open && prev.close > prev.open) {
        pattern = "bearish_engulfing";
      }
      patterns[sym] = pattern;
      if (pattern !== "none") detected += 1;
    }
    return {
      summary: `candlestick_pattern: detected ${detected} engulfing pattern(s) across ${ctx.symbols.length} symbols`,
      payload: { patterns },
    };
  },
);

/** B6 — chart_pattern: LLM hypothesize + code verify (stub), with S/R levels. */
const chartPattern = def(
  "chart_pattern",
  "Chart Pattern",
  "B",
  true,
  ["support_resistance"],
  async (ctx: AgentContext) => {
    const levels: Record<string, SupportResistance> = {};
    for (const sym of ctx.symbols) {
      levels[sym] = computeSupportResistance(ctx, sym);
    }
    return {
      summary:
        "chart_pattern: LLM hypothesize + code verify (stub) — carrying support/resistance levels",
      payload: { note: "LLM hypothesize + code verify (stub)", levels },
    };
  },
);

/** B7 — momentum_divergence: flag price/RSI divergences from the indicator snapshot. */
const momentumDivergence = def(
  "momentum_divergence",
  "Momentum Divergence",
  "B",
  true,
  ["indicator"],
  async (ctx: AgentContext) => {
    const flags: Record<string, string> = {};
    let flagged = 0;
    for (const sym of ctx.symbols) {
      const candles = fetchCandles(ctx, sym, 60);
      const snap = computeIndicatorSnapshot(ctx, sym);
      if (candles.length < 2 || snap.rsi === null) {
        flags[sym] = "no_data";
        continue;
      }
      const prev = candles[candles.length - 2];
      const last = candles[candles.length - 1];
      // Recompute RSI at the previous bar to compare momentum direction.
      const closes = candles.map((c) => c.close);
      const rsi = new RSI(14);
      let prevRsi: number | undefined;
      for (let i = 0; i < closes.length - 1; i += 1) {
        const r = rsi.nextValue(closes[i]);
        if (r !== undefined) prevRsi = r;
      }
      let flag = "none";
      if (prevRsi !== undefined) {
        if (last.close > prev.close && snap.rsi < prevRsi) {
          flag = "bearish_divergence";
        } else if (last.close < prev.close && snap.rsi > prevRsi) {
          flag = "bullish_divergence";
        }
      }
      flags[sym] = flag;
      if (flag !== "none") flagged += 1;
    }
    return {
      summary: `momentum_divergence: flagged ${flagged} divergence(s) across ${ctx.symbols.length} symbols`,
      payload: { flags },
    };
  },
);

/** Build and return all Domain B agents. */
export function buildDomainAgents(): AgentDef[] {
  return [
    indicator,
    trendRegime,
    supportResistance,
    volumeProfile,
    candlestickPattern,
    chartPattern,
    momentumDivergence,
  ];
}
