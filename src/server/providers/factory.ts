import { AppConfig } from '../AppConfig';
import { KiteStreamer } from '../KiteStreamer';
import { YahooFinanceProvider } from './YahooFinanceProvider';
import { OpenBBProvider } from './OpenBBProvider';
import {
  HistoricalDataProvider,
  LiveDataProvider,
} from '../MarketDataProvider';

function strEnv(key: string, fallback: string): string {
  const raw = process.env[key];
  return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
}

/**
 * Create the BACKTEST data provider (historical only). Used by backtest.ts,
 * optimize.ts, and any simulation that reads real history.
 *
 *   BACKTEST_PROVIDER=yahoo   (default) — account-free Yahoo Finance
 *   BACKTEST_PROVIDER=openbb           — account-free OpenBB local REST API
 *   BACKTEST_PROVIDER=kite             — real Kite historical (needs creds)
 */
export function createHistoricalProvider(config: AppConfig): HistoricalDataProvider {
  const provider = strEnv('BACKTEST_PROVIDER', 'yahoo').toLowerCase();
  switch (provider) {
    case 'kite':
      return new KiteStreamer(config);
    case 'openbb':
      return new OpenBBProvider();
    case 'yahoo':
    default:
      return new YahooFinanceProvider();
  }
}

/**
 * Create the LIVE data provider (real-time ticks + quotes). Used by index.ts
 * for paper/live trading.
 *
 *   LIVE_PROVIDER=kite   (default) — Zerodha Kite websocket
 */
export function createLiveProvider(config: AppConfig): LiveDataProvider {
  return new KiteStreamer(config);
}
