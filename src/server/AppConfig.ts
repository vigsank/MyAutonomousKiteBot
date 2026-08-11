import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Segment, WatchSymbol } from './types';
import { logger } from './Logger';

dotenv.config();

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
    },
    watchlist: loadWatchlist(dataDir),
    dataDir,
  };

  // Telegram is enabled only when both token and chat id are present.
  cfg.telegram.enabled =
    cfg.telegram.botToken.length > 0 && cfg.telegram.chatId.length > 0;

  return cfg;
}
