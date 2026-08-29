import { AppConfig } from '../AppConfig';
import { KiteStreamer } from '../KiteStreamer';
import { YahooFinanceProvider } from './YahooFinanceProvider';
import { OpenBBProvider } from './OpenBBProvider';
import { IndMoneyStreamer } from '../brokers/IndMoneyStreamer';
import { IndMoneyBrokerAccount } from '../brokers/IndMoneyBrokerAccount';
import { BrokerAccount } from '../BrokerAccount';
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
 *   BACKTEST_PROVIDER=indmoney         — real INDstocks historical (needs token)
 */
export function createHistoricalProvider(config: AppConfig): HistoricalDataProvider {
  const provider = strEnv('BACKTEST_PROVIDER', 'yahoo').toLowerCase();
  switch (provider) {
    case 'kite':
      return new KiteStreamer(config);
    case 'indmoney':
      return new IndMoneyStreamer(config);
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
 *   LIVE_PROVIDER=kite      (default) — Zerodha Kite websocket
 *   LIVE_PROVIDER=indmoney            — INDstocks websocket (data-only)
 */
export function createLiveProvider(config: AppConfig): LiveDataProvider {
  const provider = strEnv('LIVE_PROVIDER', config.broker.provider).toLowerCase();
  if (provider === 'indmoney') return new IndMoneyStreamer(config);
  return new KiteStreamer(config);
}

/**
 * The broker stack: a data streamer + an order/reconciliation account, selected
 * by `BROKER_PROVIDER`. `index.ts` uses this instead of hardcoding a Kite
 * streamer + null broker.
 *
 *   BROKER_PROVIDER=kite      (default) — Kite streamer, no live account yet
 *   BROKER_PROVIDER=indmoney            — INDstocks streamer + stubbed account
 */
export interface BrokerStack {
  streamer: LiveDataProvider;
  account: BrokerAccount | null;
}

export function createBrokerStack(config: AppConfig): BrokerStack {
  if (config.broker.provider === 'indmoney') {
    return {
      streamer: new IndMoneyStreamer(config),
      account: new IndMoneyBrokerAccount(config),
    };
  }
  return {
    streamer: new KiteStreamer(config),
    account: null, // Kite live order routing is deferred (paper-first).
  };
}
