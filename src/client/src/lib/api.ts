import type {
  Candle,
  DailySummary,
  Health,
  Notification,
  Order,
  Overview,
  Position,
  RiskEvent,
  Signal,
  Trade,
  WatchItem,
} from './types';

const BASE = '/api';

async function get<T>(path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  overview: () => get<Overview>('/overview'),
  positions: () => get<Position[]>('/positions'),
  orders: () => get<Order[]>('/orders'),
  trades: () => get<Trade[]>('/trades'),
  signals: () => get<Signal[]>('/signals'),
  riskEvents: () => get<RiskEvent[]>('/risk-events'),
  notifications: () => get<Notification[]>('/notifications'),
  dailySummary: () => get<DailySummary[]>('/daily-summary'),
  health: () => get<Health[]>('/health'),
  watchlist: () => get<WatchItem[]>('/watchlist'),
  candles: (symbol: string, interval?: string, limit?: number) =>
    get<Candle[]>('/candles', { symbol, interval, limit }),
  candleIntervals: () => get<string[]>('/candle-intervals'),
};
