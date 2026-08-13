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

/** Supported LLM providers. Both expose an OpenAI-compatible API. */
export type LlmProvider = 'openai' | 'ollama' | 'none';

/** Configuration for the AI/LLM layer used for sentiment analysis. */
export interface LlmConfig {
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  models: string[];
  activeModel: string;
  jsonMode: boolean;
  enabled: boolean;
}

export interface AppConfig {
  kite: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    root: string;
  };
  llm: LlmConfig;
  tavily: {
    apiKey: string;
    enabled: boolean;
    maxResults: number;
    searchDepth: 'basic' | 'advanced';
  };
  /** Optional free live web-search via TinyFish (Search/Fetch free; Agent/Browser cost credits). */
  tinyfish: {
    apiKey: string;
    enabled: boolean;
    maxResults: number;
    timeoutMs: number;
  };
  /** Which live web-search provider feeds the news/sentiment agents. */
  newsSearchProvider: 'tavily' | 'tinyfish' | 'both' | 'none';
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
    autoTradeTicketThreshold: number;
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
  };
  watchlist: WatchSymbol[];
  dataDir: string;
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

/** Resolve the news search provider from env (tavily | tinyfish | both | none). */
function resolveNewsProvider(): 'tavily' | 'tinyfish' | 'both' | 'none' {
  const v = str('NEWS_SEARCH_PROVIDER', 'tavily').toLowerCase();
  return v === 'tinyfish' || v === 'both' || v === 'none' ? v : 'tavily';
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

/**
 * Resolve the AI/LLM configuration from environment variables.
 *
 * Provider selection:
 *   - LLM_PROVIDER=ollama | openai  -> explicit
 *   - LLM_PROVIDER unset            -> auto-detect from which keys exist
 *
 * When provider=ollama the OpenAI-compatible endpoint defaults to
 * https://ollama.com/v1 and is fully configurable via OLLAMA_BASE_URL.
 */
function resolveLlm(): LlmConfig {
  const requested = str('LLM_PROVIDER').toLowerCase();
  const hasOllama =
    str('OLLAMA_API_KEY').length > 0 ||
    str('OLLAMA_BASE_URL').length > 0 ||
    str('OLLAMA_MODEL').length > 0;
  const hasOpenai = str('OPENAI_API_KEY').length > 0;

  let provider: LlmProvider = 'none';
  if (requested === 'openai') provider = 'openai';
  else if (requested === 'ollama') provider = 'ollama';
  else if (hasOllama) provider = 'ollama';
  else if (hasOpenai) provider = 'openai';

  if (provider === 'none') {
    return {
      provider,
      baseUrl: '',
      apiKey: '',
      models: [],
      activeModel: '',
      jsonMode: false,
      enabled: false,
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
      activeModel,
      jsonMode:
        str('LLM_JSON_MODE') !== '' ? str('LLM_JSON_MODE') === 'true' : false,
      enabled: true,
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
    activeModel,
    jsonMode:
      str('LLM_JSON_MODE') !== '' ? str('LLM_JSON_MODE') === 'true' : true,
    enabled: true,
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
    llm: resolveLlm(),
    tavily: {
      apiKey: str('TAVILY_API_KEY'),
      enabled: str('TAVILY_API_KEY').length > 0,
      maxResults: num('TAVILY_MAX_RESULTS', 5),
      searchDepth: str('TAVILY_SEARCH_DEPTH', 'basic') === 'advanced' ? 'advanced' : 'basic',
    },
    tinyfish: {
      apiKey: str('TINYFISH_API_KEY'),
      enabled: str('TINYFISH_API_KEY').length > 0,
      maxResults: num('TINYFISH_MAX_RESULTS', 5),
      timeoutMs: num('TINYFISH_TIMEOUT_MS', 15000),
    },
    newsSearchProvider: resolveNewsProvider(),
    mcp: {
      enabled: str('KITE_MCP_ENABLED') === 'true',
      url: str('KITE_MCP_URL', 'https://mcp.kite.trade/mcp'),
      timeoutMs: num('KITE_MCP_TIMEOUT_MS', 5000),
    },
    agents: {
      enabled: str('AGENTS_ENABLED') === 'true',
      intervalMs: num('AGENTS_INTERVAL_MS', 10 * 60 * 1000),
      probePreOpen: str('AGENTS_PROBE_PRE_OPEN', '09:00'),
      probeMidSession: str('AGENTS_PROBE_MID_SESSION', '12:00'),
      probePreClose: str('AGENTS_PROBE_PRE_CLOSE', '15:00'),
      probeAlways: str('AGENTS_PROBE_ALWAYS') === 'true',
      forceSignal: str('AGENTS_FORCE_SIGNAL') === 'true',
      forceSignalSymbol: str('AGENTS_FORCE_SIGNAL_SYMBOL', 'ITC'),
    },
    telegram: {
      botToken: str('TELEGRAM_BOT_TOKEN'),
      chatId: str('TELEGRAM_CHAT_ID'),
      enabled: false,
    },
    risk: {
      availableCapital: num('AVAILABLE_CAPITAL', 500000),
      maxDailyDrawdown: num('MAX_DAILY_DRAWDOWN', 5000),
      maxTradeAllocation: num('MAX_TRADE_ALLOCATION', 20000),
      autoTradeTicketThreshold: num('AUTO_TRADE_TICKET_THRESHOLD', 5000),
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
    },
    watchlist: loadWatchlist(dataDir),
    dataDir,
  };

  // Telegram is enabled only when both token and chat id are present.
  cfg.telegram.enabled =
    cfg.telegram.botToken.length > 0 && cfg.telegram.chatId.length > 0;

  return cfg;
}
