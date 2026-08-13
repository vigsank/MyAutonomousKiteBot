/**
 * Global configuration with sensible defaults.
 */

import type {
  AuthConfig,
  MarketHoursConfig,
  MockEngineConfig,
  Product,
  ServerConfig,
  TickerConfig,
} from '../types';

export interface ResolvedConfig {
  startingCapital: number;
  defaultProduct: Product;
  marketHours: MarketHoursConfig;
  auth: AuthConfig;
  ticker: TickerConfig;
  server: ServerConfig;
  partialFills: boolean;
  marginRate: number;
}

export const DEFAULT_CONFIG: ResolvedConfig = {
  startingCapital: 1_000_000,
  defaultProduct: 'MIS',
  marketHours: {
    start: '09:15',
    end: '15:30',
    timezone: 'Asia/Kolkata',
  },
  auth: {
    strict: false,
    validApiKeys: ['mock_key'],
    validAccessTokens: ['mock_access_token'],
    tokenExpiryMs: 0,
    failureRate: 0,
  },
  ticker: {
    mode: 'random-walk',
    randomWalk: {
      volatility: 0.0001,
      tickIntervalMs: 1000,
      bidAskSpread: 0.05,
      enableRealismFeatures: true,
      regimeSwitchBars: 1200,
      regimePersistence: 0.5,
      enableSeasonality: true,
      shockProbability: 0.01,
      shockSize: 0.01,
    },
  },
  server: {
    port: 4000,
    host: '127.0.0.1',
    enableCORS: false,
    enableBinaryWS: true,
  },
  partialFills: false,
  marginRate: 0.2,
};

/** Merge a partial user config over the defaults. */
export function resolveConfig(config?: MockEngineConfig): ResolvedConfig {
  const base = DEFAULT_CONFIG;
  return {
    startingCapital: config?.startingCapital ?? base.startingCapital,
    defaultProduct: config?.defaultProduct ?? base.defaultProduct,
    marketHours: {
      ...base.marketHours,
      ...config?.marketHours,
    },
    auth: {
      ...base.auth,
      ...config?.auth,
    },
    ticker: {
      ...base.ticker,
      ...config?.ticker,
      randomWalk: {
        ...base.ticker.randomWalk,
        ...config?.ticker?.randomWalk,
      },
      historicalReplay: {
        source: [],
        replaySpeed: 1,
        loopMode: 'once',
        ...config?.ticker?.historicalReplay,
      },
    },
    server: {
      ...base.server,
    },
    partialFills: config?.partialFills ?? base.partialFills,
    marginRate: config?.marginRate ?? base.marginRate,
  };
}
