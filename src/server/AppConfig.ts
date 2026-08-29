import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Segment, WatchSymbol } from './types';
import { logger } from './Logger';

// Load the env file selected by ENV_FILE (default .env). Test scripts set
// ENV_FILE=.env.test so real runs (.env) and test runs (.env.test) stay
// isolated while keeping the same keys. NODE_ENV=test also selects .env.test.
const envFile =
  process.env.ENV_FILE ||
  (process.env.NODE_ENV === 'test' ? '.env.test' : '.env');
dotenv.config({ path: envFile });

/**
 * Central configuration loader. Reads from environment variables and the
 * watchlist file. All values have sane defaults so the bot can boot in a
 * degraded "dry" mode even before credentials are configured.
 */

/** Supported LLM providers. All expose an OpenAI-compatible API. */
export type LlmProvider = 'openai' | 'ollama' | 'litellm' | 'none';

/** Configuration for the AI/LLM layer used for sentiment analysis. */
export interface LlmConfig {
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  models: string[];
  /** Subset of `models` used by the multi-model ensemble (≤3). Always ⊆ models. */
  ensembleModels: string[];
  /** Fast subset of `models` (≤3) for high-frequency loops (e.g. backtests). */
  fastEnsembleModels: string[];
  activeModel: string;
  jsonMode: boolean;
  enabled: boolean;
  /** Per-request timeout (ms) so a hung model can't block the ensemble/run. */
  timeoutMs: number;
}

export interface AppConfig {
  kite: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    root: string;
  };
  /** Broker selection: `kite` (default) or `indmoney` (data-only for now). */
  broker: {
    provider: 'kite' | 'indmoney';
    indmoney: {
      accessToken: string;
      baseUrl: string;
      wsPricesUrl: string;
      algoIdNse: string;
      algoIdBse: string;
      timeoutMs: number;
      /** Throttle before each request (ms) to stay under the rate limit. */
      rateDelayMs: number;
      /** Max attempts on 429 / transient 5xx. */
      maxRetries: number;
      /** Base backoff (ms) for retries. */
      retryBaseMs: number;
      /** Rate-limit / circuit-breaker settings. */
      ratePerSecond: number;
      ratePerDay: number;
      rateWarnPct: number;
      rateMaxWaitMs: number;
      rateHaltOn429: boolean;
      rate429Threshold: number;
      rateCooldownMs: number;
      rateHaltOnLimit: boolean;
    };
  };
  llm: LlmConfig;
  /** Free live web-search via TinyFish (Search/Fetch free; Agent/Browser cost credits). */
  tinyfish: {
    apiKey: string;
    enabled: boolean;
    maxResults: number;
    timeoutMs: number;
  };
  /** Optional read-only Zerodha Kite MCP server (hosted or self-hosted). */
  mcp: {
    enabled: boolean;
    url: string;
    timeoutMs: number;
  };
  /** Agent runtime — probe schedule + cadence (OFF by default). */
  agents: {
    enabled: boolean;
    intervalMs: number;
    probePreOpen: string;
    probeMidSession: string;
    probePreClose: string;
    /** Dev: run the probe immediately on every start, regardless of IST time. */
    probeAlways: boolean;
    /** Dev: force the strategist to propose a trade for a symbol (test hook). */
    forceSignal: boolean;
    forceSignalSymbol: string;
    /** Event-driven LLM trigger (breaking-news listener) — deferred, OFF by default. */
    eventDrivenEnabled: boolean;
  };
  /** Event-driven news monitor (Phase 4.4) — poll RSS, react to new news. */
  newsMonitor: {
    enabled: boolean;
    /** Poll interval in ms (default 15 min). */
    intervalMs: number;
    /** New-news sentiment below this exits/shrinks a HELD position (defensive). */
    sentimentExitThreshold: number;
    /** Allow opportunistic partial entries on momentum candidates with breakout + positive news. */
    opportunisticEnabled: boolean;
    /** Partial-entry size as % of the equal-weight slot (pull-forward). */
    opportunisticPartialPct: number;
  };
  telegram: {
    botToken: string;
    chatId: string;
    enabled: boolean;
  };
  risk: {
    availableCapital: number;
    maxDailyDrawdown: number;
    maxTradeAllocation: number;
    /** Max % of available capital a single position may use (diversification). */
    maxPositionWeightPct: number;
    autoTradeTicketThreshold: number;
    /** Max % of total portfolio capital a single stock may use (single-stock cap). */
    maxSingleStockPct: number;
    /** Mandatory cash reserve % of total capital kept free for liquidity. */
    minCashReservePct: number;
    /** Single-trade risk cap: max % of total account balance at stop-loss. */
    maxRiskPerTradePct: number;
    /** Max % of total capital a single sector may use (diversification). */
    maxSectorWeightPct: number;
    /** Portfolio-level drawdown guard: halt trading if the book is down this % of capital. */
    maxPortfolioDrawdownPct: number;
    /** Monthly drawdown guard: halt trading for the month if monthly P&L is down this % of capital. */
    maxMonthlyDrawdownPct: number;
    /** Risk appetite guiding the LLM advisor + algo sizing. */
    riskAppetite: 'conservative' | 'balanced' | 'aggressive';
    /** Minimum available capital before the momentum rebalance trades at all (0 = off). */
    minCapital: number;
  };
  costs: {
    slippageBps: number;
    brokerageBps: number;
    brokerageMax: number;
    statutoryBps: number;
    gstPct: number;
  };
  options: {
    enabled: boolean;
    maxPremiumPerTrade: number;
    maxOptionsExposure: number;
    expiryDays: number;
    strikeOffsetPct: number;
  };
  /** Live-order routing (Phase E) — opt-in, off by default. */
  live: {
    /** Master switch: allow orders to reach the broker (default false). */
    allowLiveOrders: boolean;
    /** When live orders are on, log payloads only, don't send (default true). */
    shadowMode: boolean;
    /** Blast-radius cap: refuse live orders above this notional. */
    maxLiveOrderValue: number;
    /** Block new entries when the ledger/broker book has drifted. */
    haltOnDrift: boolean;
  };
  strategy: {
    mode: 'mean_reversion' | 'pullback_trend' | 'breakout';
    rsiEntryThreshold: number;
    rsiExitThreshold: number;
    stopLossPercent: number;
    tradeCooldownMinutes: number;
    atrStopMultiplier: number;
    adxTrendThreshold: number;
    volumeConfirmMultiplier: number;
    circuitBreakerTrades: number;
    circuitBreakerWindowMinutes: number;
    circuitBreakerHaltMinutes: number;
    maxSimultaneousEntries: number;
    riskPerTradePercent: number;
    skipFirstMinutes: number;
    skipLastMinutes: number;
    barIntervalSeconds: number;
    disableTimeFilter: boolean;
    pullbackRsiEntry: number;
    pullbackFastSma: number;
    pullbackSlowSma: number;
    breakoutLookback: number;
    breakoutTrailAtrMult: number;
    /** Optional LLM analyst pre-trade filter (soft; RiskEngine stays the hard gate). */
    analystEnabled: boolean;
    /** Risk score (0-100) above which the analyst verdict blocks the trade. */
    analystRejectThreshold: number;
    /** Minimum reward:risk ratio required for an entry (target vs stop). */
    minRiskReward: number;
    /** Target distance as a multiple of ATR (target = stopDist * targetAtrMultiplier / atrStopMultiplier). */
    targetAtrMultiplier: number;
    /** Gate entries by market regime (mean-reversion only in ranging, momentum in trending). */
    regimeGatingEnabled: boolean;
    /** Minimum evidence-based signal confidence (0-1) to propose a trade (0 = disabled). */
    minSignalConfidence: number;
    /** Move the stop to breakeven once price moves favorably by this many ATRs. */
    breakevenAtrMult: number;
    /** RSI buffer below the entry threshold that overrides the ADX regime filter. */
    deepOversoldBuffer: number;
    /** Auto-select the strategy mode from the detected market regime (replaces single-mode). */
    regimeAdaptive: boolean;
    /** Bollinger mean-reversion entry: buy close < lower band + RSI oversold, exit at middle band. */
    bollingerEntry: boolean;
    bollingerPeriod: number;
    bollingerStdDev: number;
    bollingerRsiEntry: number;
    /** Holdings review: book partial profit above this unrealized gain %. */
    holdingsProfitTargetPct: number;
    /** Holdings review: trim a position above this % of capital (rebalance). */
    holdingsTargetWeightPct: number;
    /** Opening Range Breakout filter: gate entries on the first-N-min range. */
    orbEnabled: boolean;
    /** Length of the opening range window in minutes (15–30). */
    orbMinutes: number;
    /** Volume multiple required to confirm an ORB breakout. */
    orbVolumeMultiplier: number;
    /** Volatility-adjusted Kelly sizing (bounded by the hard risk caps). */
    kellyEnabled: boolean;
    /** Fractional-Kelly scale (0..1) — safer than full Kelly. */
    kellyScale: number;
    /** Cross-sectional momentum — number of names to hold (validated 5–10). */
    momentumTopN: number;
    /** Momentum lookback in months (12 default). */
    momentumLookbackMonths: number;
    /** Rank-hysteresis band: incumbents hold their slot within top N+band. */
    momentumHysteresisBand: number;
    /** Liquidity floor in INR (0 = disabled). */
    momentumLiquidityFloorInr: number;
    /** Trailing window (days) for the liquidity ADV proxy. */
    momentumLiquidityLookbackDays: number;
    /** When true, go to cash if the median momentum is negative (OFF default). */
    momentumRiskOff: boolean;
    /** AI sentiment-regime switching: scale exposure by the daily report's regime_score. */
    momentumRegimeEnabled: boolean;
    /** regime_score at/below this → risk-off (shrink to the floor). */
    momentumRegimeRiskOffThreshold: number;
    /** regime_score at/below this starts de-risking (linear down to the floor). */
    momentumRegimeDefensiveThreshold: number;
    /** Floor on the regime sizing multiplier (0 = go to cash on risk-off). */
    momentumRegimeFloorMultiplier: number;
    /** AI AVOID handling: 'block' (hard veto) or 'shrink' (allow at reduced size). */
    momentumVetoMode: 'block' | 'shrink';
    /** When vetoMode='shrink', AVOID names are sized at this % of their slot. */
    momentumVetoShrinkPct: number;
    /** Master-class 200/220-DMA trend guard: drop names below their DMA (entry + exit). */
    momentumDmaGuardEnabled: boolean;
    /** SMA period for the DMA guard (220 = the class's guard/stop). */
    momentumDmaGuardPeriod: number;
    /** Multi-factor tilt: blend a second factor into the momentum score. */
    momentumFactorTilt: 'none' | 'lowvol';
    /** Weight of the tilt factor relative to momentum (0 = pure momentum). */
    momentumFactorTiltWeight: number;
    /** Number of daily returns for the low-volatility factor (≈252 = 12m). */
    momentumFactorVolDays: number;
    /** Weekend entry screen (master-class 1-2-3): enable the screen. */
    entryScreenEnabled: boolean;
    /** SMA period for the entry screen's DMA guard (220). */
    entryScreenDmaPeriod: number;
    /** A name is "near ATH" when its close is within this % of the ATH. */
    entryScreenNearAthPct: number;
    /** Daily tracker: recompute the DMA and ENTER/EXIT on breakout/break. */
    entryTrackerEnabled: boolean;
    /** Daily tracker: require an uptrend (higher highs/lows) before ENTER. */
    entryTrackerRequireUptrend: boolean;
    /** Number of bars for the uptrend confirmation. */
    entryTrackerUptrendWindow: number;
    /** Daily tracker: check interval in ms (default 6h). */
    entryTrackerIntervalMs: number;
    /** News sentiment below this vetoes momentum entries / forces exits. */
    newsVetoThreshold: number;
    /** Binary corporate-action types that trigger the event blackout. */
    eventBlackoutTypes: string[];
    /** Days before a binary event to blackout (0 disables). */
    eventBlackoutDays: number;
  };
  watchlist: WatchSymbol[];
  dataDir: string;
  /** End-of-day layer config (square-off, overnight matrix). */
  eod: {
    squareOffEnabled: boolean;
    squareOffTime: string;
    overnightGapRiskThresholdPct: number;
    overnightEvents: Array<{ date: string; event: string }>;
  };
}

function num(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function str(key: string, fallback = ''): string {
  const raw = process.env[key];
  return raw === undefined ? fallback : raw.trim();
}

function csv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function loadWatchlist(dataDir: string): WatchSymbol[] {
  // Allow overriding the watchlist file (e.g. a volatile-symbols list).
  const custom = process.env.WATCHLIST_FILE;
  const file = custom ? path.resolve(process.cwd(), custom) : path.join(dataDir, 'watchlist.json');
  try {
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const symbols: WatchSymbol[] = parsed.symbols ?? [];
    return symbols.filter((s) => s && s.tradingsymbol);
  } catch (err) {
    logger.warn({ file, err }, 'Failed to read watchlist');
    return [];
  }
}

/** Load upcoming overnight events from data/overnight_events.json (best-effort). */
function loadOvernightEvents(dataDir: string): Array<{ date: string; event: string }> {
  const file = path.join(dataDir, 'overnight_events.json');
  try {
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const events = parsed.events ?? [];
    return events.filter((e: any) => e && typeof e.date === 'string' && typeof e.event === 'string');
  } catch (err) {
    logger.warn({ file, err }, 'Failed to read overnight events');
    return [];
  }
}

/**
 * Resolve the AI/LLM configuration from environment variables.
 *
 * Provider selection:
 *   - LLM_PROVIDER=ollama    -> Ollama Cloud (OLLAMA_* vars)
 *   - LLM_PROVIDER=litellm  -> LiteLLM proxy / SAP AI Core (LITELLM_* vars)
 *   - LLM_PROVIDER=openai   -> OpenAI direct (OPENAI_* vars)
 *   - LLM_PROVIDER unset    -> auto-detect from which keys are present
 *
 * Setting LLM_PROVIDER=litellm fully disables the Ollama path and routes
 * all LLM calls through the LiteLLM endpoint — no automatic fallback.
 */
/**
 * Resolve an ensemble model list from an env var, validating it is a subset of
 * the provider's full model list. Entries not present in `models` are dropped.
 * If nothing valid is configured, fall back to the first 3 of `models` (active
 * model first). Always returns 1..3 models ⊆ models.
 */
function resolveEnsemble(models: string[], activeModel: string, envKey: string): string[] {
  const want = csv(str(envKey));
  const pool = new Set(models);
  const valid = want.filter((m) => pool.has(m));
  const base = valid.length > 0 ? valid : models;
  const ordered = base.includes(activeModel)
    ? [activeModel, ...base.filter((m) => m !== activeModel)]
    : base;
  return ordered.slice(0, 3);
}

function resolveLlm(): LlmConfig {
  const requested = str('LLM_PROVIDER').toLowerCase();
  const hasOllama =
    str('OLLAMA_API_KEY').length > 0 ||
    str('OLLAMA_BASE_URL').length > 0 ||
    str('OLLAMA_MODEL').length > 0;
  const hasOpenai = str('OPENAI_API_KEY').length > 0;

  const hasLitellm =
    str('LITELLM_BASE_URL').length > 0 && str('LITELLM_API_KEY').length > 0;

  let provider: LlmProvider = 'none';
  if (requested === 'openai') provider = 'openai';
  else if (requested === 'ollama') provider = 'ollama';
  else if (requested === 'litellm') provider = 'litellm';
  else if (hasOllama) provider = 'ollama';
  else if (hasLitellm) provider = 'litellm';
  else if (hasOpenai) provider = 'openai';

  if (provider === 'none') {
    return {
      provider,
      baseUrl: '',
      apiKey: '',
      models: [],
      ensembleModels: [],
      fastEnsembleModels: [],
      activeModel: '',
      jsonMode: false,
      enabled: false,
      timeoutMs: 60000,
    };
  }

  if (provider === 'ollama') {
    const baseUrl = str('OLLAMA_BASE_URL', 'https://ollama.com/v1');
    const apiKey = str('OLLAMA_API_KEY');
    let models = csv(str('OLLAMA_MODELS'));
    const activeModel = str('OLLAMA_MODEL', models[0] ?? 'llama3.3');
    if (models.length === 0) models = [activeModel];
    if (!models.includes(activeModel)) models = [activeModel, ...models];
    return {
      provider,
      baseUrl,
      apiKey,
      models,
      ensembleModels: resolveEnsemble(models, activeModel, 'LLM_ENSEMBLE_MODELS'),
      fastEnsembleModels: resolveEnsemble(models, activeModel, 'LLM_FAST_ENSEMBLE_MODELS'),
      activeModel,
      jsonMode:
        str('LLM_JSON_MODE') !== '' ? str('LLM_JSON_MODE') === 'true' : false,
      enabled: true,
      timeoutMs: num('LLM_TIMEOUT_MS', 60000),
    };
  }

  if (provider === 'litellm') {
    const baseUrl = str('LITELLM_BASE_URL');
    const apiKey = str('LITELLM_API_KEY');
    let models = csv(str('LITELLM_MODELS'));
    const activeModel = str('LITELLM_MODEL', models[0] ?? 'anthropic--claude-sonnet-latest');
    if (models.length === 0) models = [activeModel];
    if (!models.includes(activeModel)) models = [activeModel, ...models];
    return {
      provider,
      baseUrl,
      apiKey,
      models,
      ensembleModels: resolveEnsemble(models, activeModel, 'LITELLM_ENSEMBLE_MODELS'),
      fastEnsembleModels: resolveEnsemble(models, activeModel, 'LITELLM_FAST_ENSEMBLE_MODELS'),
      activeModel,
      jsonMode: str('LLM_JSON_MODE') !== '' ? str('LLM_JSON_MODE') === 'true' : true,
      enabled: true,
      timeoutMs: num('LLM_TIMEOUT_MS', 60000),
    };
  }

  // provider === 'openai'
  const baseUrl = str('OPENAI_BASE_URL', 'https://api.openai.com/v1');
  const apiKey = str('OPENAI_API_KEY');
  let models = csv(str('OPENAI_MODELS'));
  const activeModel = str('OPENAI_MODEL', models[0] ?? 'gpt-4o-mini');
  if (models.length === 0) models = [activeModel];
  if (!models.includes(activeModel)) models = [activeModel, ...models];
  return {
    provider,
    baseUrl,
    apiKey,
    models,
    ensembleModels: resolveEnsemble(models, activeModel, 'LLM_ENSEMBLE_MODELS'),
    fastEnsembleModels: resolveEnsemble(models, activeModel, 'LLM_FAST_ENSEMBLE_MODELS'),
    activeModel,
    jsonMode: str('LLM_JSON_MODE') !== '' ? str('LLM_JSON_MODE') === 'true' : true,
    enabled: true,
    timeoutMs: num('LLM_TIMEOUT_MS', 60000),
  };
}

export function loadConfig(): AppConfig {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');

  const cfg: AppConfig = {
    kite: {
      apiKey: str('KITE_API_KEY'),
      apiSecret: str('KITE_API_SECRET'),
      accessToken: str('KITE_ACCESS_TOKEN'),
      root: str('KITE_ROOT', 'https://api.kite.trade'),
    },
    broker: {
      provider: str('BROKER_PROVIDER', 'kite').toLowerCase() === 'indmoney' ? 'indmoney' : 'kite',
      indmoney: {
        accessToken: str('INDMONEY_ACCESS_TOKEN'),
        baseUrl: str('INDMONEY_BASE_URL', 'https://api.indstocks.com'),
        wsPricesUrl: str('INDMONEY_WS_PRICES_URL', 'wss://ws-prices.indstocks.com/api/v1/ws/prices'),
        algoIdNse: str('INDMONEY_ALGO_ID_NSE', '99999'),
        algoIdBse: str('INDMONEY_ALGO_ID_BSE', '9999999999999999'),
        timeoutMs: num('INDMONEY_TIMEOUT_MS', 15000),
        rateDelayMs: num('INDMONEY_RATE_DELAY_MS', 300),
        maxRetries: num('INDMONEY_MAX_RETRIES', 4),
        retryBaseMs: num('INDMONEY_RETRY_BASE_MS', 500),
        ratePerSecond: num('INDMONEY_RATE_PER_SECOND', 5),
        ratePerDay: num('INDMONEY_RATE_PER_DAY', 100000),
        rateWarnPct: num('INDMONEY_RATE_WARN_PCT', 80),
        rateMaxWaitMs: num('INDMONEY_RATE_MAX_WAIT_MS', 5000),
        rateHaltOn429: str('INDMONEY_RATE_HALT_ON_429') !== 'false',
        rate429Threshold: num('INDMONEY_RATE_429_THRESHOLD', 5),
        rateCooldownMs: num('INDMONEY_RATE_COOLDOWN_MS', 900000),
        rateHaltOnLimit: str('INDMONEY_RATE_HALT_ON_LIMIT') !== 'false',
      },
    },
    llm: resolveLlm(),
    tinyfish: {
      apiKey: str('TINYFISH_API_KEY'),
      enabled: str('TINYFISH_API_KEY').length > 0,
      maxResults: num('TINYFISH_MAX_RESULTS', 5),
      timeoutMs: num('TINYFISH_TIMEOUT_MS', 15000),
    },
    mcp: {
      enabled: str('KITE_MCP_ENABLED') === 'true',
      url: str('KITE_MCP_URL', 'https://mcp.kite.trade/mcp'),
      timeoutMs: num('KITE_MCP_TIMEOUT_MS', 5000),
    },
    agents: {
      enabled: str('AGENTS_ENABLED') === 'true',
      intervalMs: num('AGENTS_INTERVAL_MS', 10 * 60 * 1000),
      probePreOpen: str('AGENTS_PROBE_PRE_OPEN', '09:00'),
      probeMidSession: str('AGENTS_PROBE_MID_SESSION', '11:00'),
      probePreClose: str('AGENTS_PROBE_PRE_CLOSE', '15:15'),
      probeAlways: str('AGENTS_PROBE_ALWAYS') === 'true',
      forceSignal: str('AGENTS_FORCE_SIGNAL') === 'true',
      forceSignalSymbol: str('AGENTS_FORCE_SIGNAL_SYMBOL', 'ITC'),
      eventDrivenEnabled: str('AGENTS_EVENT_DRIVEN') === 'true',
    },
    newsMonitor: {
      enabled: str('NEWS_MONITOR_ENABLED') === 'true',
      intervalMs: num('NEWS_MONITOR_INTERVAL_MS', 15 * 60 * 1000),
      sentimentExitThreshold: num('NEWS_MONITOR_SENTIMENT_EXIT_THRESHOLD', -0.5),
      opportunisticEnabled: str('NEWS_MONITOR_OPPORTUNISTIC_ENABLED') === 'true',
      opportunisticPartialPct: num('NEWS_MONITOR_OPPORTUNISTIC_PARTIAL_PCT', 50),
    },
    telegram: {
      botToken: str('TELEGRAM_BOT_TOKEN'),
      chatId: str('TELEGRAM_CHAT_ID'),
      enabled: false,
    },
    risk: {
      availableCapital: num('AVAILABLE_CAPITAL', 500000),
      maxDailyDrawdown: num('MAX_DAILY_DRAWDOWN', 15000),
      maxTradeAllocation: num('MAX_TRADE_ALLOCATION', 20000),
      maxPositionWeightPct: num('MAX_POSITION_WEIGHT_PCT', 20),
      autoTradeTicketThreshold: num('AUTO_TRADE_TICKET_THRESHOLD', 5000),
      maxSingleStockPct: num('MAX_SINGLE_STOCK_PCT', 15),
      minCashReservePct: num('MIN_CASH_RESERVE_PCT', 20),
      maxRiskPerTradePct: num('MAX_RISK_PER_TRADE_PCT', 1.5),
      maxSectorWeightPct: num('MAX_SECTOR_WEIGHT_PCT', 30),
      maxPortfolioDrawdownPct: num('MAX_PORTFOLIO_DRAWDOWN_PCT', 10),
      maxMonthlyDrawdownPct: num('MAX_MONTHLY_DRAWDOWN_PCT', 2),
      riskAppetite: (() => {
        const v = str('RISK_APPETITE', 'balanced').toLowerCase();
        return v === 'conservative' || v === 'aggressive' ? v : 'balanced';
      })(),
      minCapital: num('MIN_CAPITAL', 0),
    },
    costs: {
      slippageBps: num('PAPER_SLIPPAGE_BPS', 2),
      brokerageBps: num('PAPER_BROKERAGE_BPS', 3),
      brokerageMax: num('PAPER_BROKERAGE_MAX', 20),
      statutoryBps: num('PAPER_STATUTORY_BPS', 10),
      gstPct: num('PAPER_GST_PCT', 18),
    },
    options: {
      enabled: str('OPTIONS_ENABLED') === 'true',
      maxPremiumPerTrade: num('MAX_OPTION_PREMIUM_PER_TRADE', 5000),
      maxOptionsExposure: num('MAX_OPTIONS_EXPOSURE', 20000),
      expiryDays: num('OPTION_EXPIRY_DAYS', 30),
      strikeOffsetPct: num('OPTION_STRIKE_OFFSET_PCT', 2),
    },
    live: {
      allowLiveOrders: str('ALLOW_LIVE_ORDERS') === 'true',
      shadowMode: str('LIVE_SHADOW_MODE') !== 'false',
      maxLiveOrderValue: num('MAX_LIVE_ORDER_VALUE', 25000),
      haltOnDrift: str('HALT_ON_DRIFT') !== 'false',
    },
    strategy: {
      mode: (str('STRATEGY_MODE', 'mean_reversion') === 'pullback_trend' ? 'pullback_trend' : str('STRATEGY_MODE', 'mean_reversion') === 'breakout' ? 'breakout' : 'mean_reversion'),
      rsiEntryThreshold: num('RSI_ENTRY_THRESHOLD', 30),
      rsiExitThreshold: num('RSI_EXIT_THRESHOLD', 70),
      stopLossPercent: num('STOP_LOSS_PERCENT', 4),
      tradeCooldownMinutes: num('TRADE_COOLDOWN_MINUTES', 15),
      atrStopMultiplier: num('ATR_STOP_MULTIPLIER', 2),
      adxTrendThreshold: num('ADX_TREND_THRESHOLD', 25),
      volumeConfirmMultiplier: num('VOLUME_CONFIRM_MULTIPLIER', 1.5),
      circuitBreakerTrades: num('CIRCUIT_BREAKER_TRADES', 3),
      circuitBreakerWindowMinutes: num('CIRCUIT_BREAKER_WINDOW_MINUTES', 30),
      circuitBreakerHaltMinutes: num('CIRCUIT_BREAKER_HALT_MINUTES', 60),
      maxSimultaneousEntries: num('MAX_SIMULTANEOUS_ENTRIES', 2),
      riskPerTradePercent: num('RISK_PER_TRADE_PERCENT', 1),
      skipFirstMinutes: num('SKIP_FIRST_MINUTES', 30),
      skipLastMinutes: num('SKIP_LAST_MINUTES', 30),
      barIntervalSeconds: num('BAR_INTERVAL_SECONDS', 60),
      disableTimeFilter: str('DISABLE_TIME_FILTER') === 'true',
      pullbackRsiEntry: num('PULLBACK_RSI_ENTRY', 45),
      pullbackFastSma: num('PULLBACK_FAST_SMA', 20),
      pullbackSlowSma: num('PULLBACK_SLOW_SMA', 50),
      breakoutLookback: num('BREAKOUT_LOOKBACK', 20),
      breakoutTrailAtrMult: num('BREAKOUT_TRAIL_ATR_MULT', 2),
      analystEnabled: str('ANALYST_ENABLED') === 'true',
      analystRejectThreshold: num('ANALYST_REJECT_THRESHOLD', 70),
      minRiskReward: num('MIN_RISK_REWARD', 1.5),
      targetAtrMultiplier: num('TARGET_ATR_MULTIPLIER', 3),
      regimeGatingEnabled: str('REGIME_GATING_ENABLED') === 'true',
      minSignalConfidence: num('MIN_SIGNAL_CONFIDENCE', 0),
      breakevenAtrMult: num('BREAKEVEN_ATR_MULT', 1),
      deepOversoldBuffer: num('DEEP_OVERSOLD_BUFFER', 10),
      regimeAdaptive: str('REGIME_ADAPTIVE') !== 'false',
      bollingerEntry: str('BOLLINGER_ENTRY') !== 'false',
      bollingerPeriod: num('BOLLINGER_PERIOD', 20),
      bollingerStdDev: num('BOLLINGER_STD_DEV', 2),
      bollingerRsiEntry: num('BOLLINGER_RSI_ENTRY', 30),
      holdingsProfitTargetPct: num('HOLDINGS_PROFIT_TARGET_PCT', 8),
      holdingsTargetWeightPct: num('HOLDINGS_TARGET_WEIGHT_PCT', 10),
      orbEnabled: str('ORB_ENABLED') !== 'false',
      orbMinutes: num('ORB_MINUTES', 15),
      orbVolumeMultiplier: num('ORB_VOLUME_MULTIPLIER', 1.5),
      kellyEnabled: str('KELLY_ENABLED') === 'true',
      kellyScale: num('KELLY_SCALE', 0.5),
      momentumTopN: num('MOMENTUM_TOP_N', 6),
      momentumLookbackMonths: num('MOMENTUM_LOOKBACK_MONTHS', 12),
      momentumHysteresisBand: num('MOMENTUM_HYSTERESIS_BAND', 8),
      momentumLiquidityFloorInr: num('MOMENTUM_LIQUIDITY_FLOOR_INR', 0),
      momentumLiquidityLookbackDays: num('MOMENTUM_LIQUIDITY_LOOKBACK_DAYS', 20),
      momentumRiskOff: str('MOMENTUM_RISK_OFF') === 'true',
      momentumRegimeEnabled: str('MOMENTUM_REGIME_ENABLED') !== 'false',
      momentumRegimeRiskOffThreshold: num('MOMENTUM_REGIME_RISK_OFF_THRESHOLD', -0.3),
      momentumRegimeDefensiveThreshold: num('MOMENTUM_REGIME_DEFENSIVE_THRESHOLD', 0),
      momentumRegimeFloorMultiplier: num('MOMENTUM_REGIME_FLOOR_MULTIPLIER', 0.4),
      momentumVetoMode: str('MOMENTUM_VETO_MODE') === 'shrink' ? 'shrink' : 'block',
      momentumVetoShrinkPct: num('MOMENTUM_VETO_SHRINK_PCT', 50),
      momentumDmaGuardEnabled: str('MOMENTUM_DMA_GUARD_ENABLED') === 'true',
      momentumDmaGuardPeriod: num('MOMENTUM_DMA_GUARD_PERIOD', 220),
      momentumFactorTilt: str('MOMENTUM_FACTOR_TILT', 'none') === 'lowvol' ? 'lowvol' : 'none',
      momentumFactorTiltWeight: num('MOMENTUM_FACTOR_TILT_WEIGHT', 0.5),
      momentumFactorVolDays: num('MOMENTUM_FACTOR_VOL_DAYS', 252),
      entryScreenEnabled: str('ENTRY_SCREEN_ENABLED') === 'true',
      entryScreenDmaPeriod: num('ENTRY_SCREEN_DMA_PERIOD', 220),
      entryScreenNearAthPct: num('ENTRY_SCREEN_NEAR_ATH_PCT', 10),
      entryTrackerEnabled: str('ENTRY_TRACKER_ENABLED') === 'true',
      entryTrackerRequireUptrend: str('ENTRY_TRACKER_REQUIRE_UPTREND') === 'true',
      entryTrackerUptrendWindow: num('ENTRY_TRACKER_UPTREND_WINDOW', 3),
      entryTrackerIntervalMs: num('ENTRY_TRACKER_INTERVAL_MS', 6 * 60 * 60 * 1000),
      newsVetoThreshold: num('NEWS_VETO_THRESHOLD', -0.5),
      eventBlackoutTypes: csv(str('EVENT_BLACKOUT_TYPES', 'EARNINGS,RESULTS,RATING,REGULATORY,MERGER,DEMERGER,AGM,BOARD_MEETING,SPLIT,BONUS,RIGHTS_ISSUE')),
      eventBlackoutDays: num('EVENT_BLACKOUT_DAYS', 3),
    },
    watchlist: loadWatchlist(dataDir),
    dataDir,
    eod: {
      squareOffEnabled: str('EOD_SQUARE_OFF_ENABLED') !== 'false',
      squareOffTime: str('EOD_SQUARE_OFF_TIME', '15:15'),
      overnightGapRiskThresholdPct: num('EOD_OVERNIGHT_GAP_RISK_PCT', 2),
      overnightEvents: loadOvernightEvents(dataDir),
    },
  };

  // Telegram is enabled only when both token and chat id are present.
  cfg.telegram.enabled =
    cfg.telegram.botToken.length > 0 && cfg.telegram.chatId.length > 0;

  return cfg;
}
