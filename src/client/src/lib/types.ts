/**
 * Client-side types mirroring the server's REST API responses
 * (see src/server/api/queries.ts).
 */

export interface Overview {
  capital: { total: number; available: number; used: number };
  daily: DailySummary | null;
  drawdown: number;
  counts: {
    openPositions: number;
    tradesToday: number;
    signalsToday: number;
    notificationsToday: number;
  };
  lastTradeTime: string | null;
  mode: string;
  strategyMode: string;
  watchlistCount: number;
}

export interface Position {
  symbol: string;
  exchange: string;
  quantity: number;
  avgPrice: number;
  lastPrice: number | null;
  direction: 'LONG' | 'SHORT';
  entryTime: string;
  unrealizedPnl: number;
}

export interface Order {
  orderId: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  status: string;
  orderType: string;
  product: string;
  reason: string;
  createdAt: string;
}

export interface Trade {
  tradeId: string;
  symbol: string;
  direction: string;
  quantity: number;
  price: number;
  pnl: number | null;
  status: string;
  reason: string;
  createdAt: string;
}

export interface Signal {
  signalId: number;
  symbol: string;
  direction: string;
  rsi: number | null;
  price: number;
  sentimentScore: number | null;
  reason: string;
  createdAt: string;
}

export interface RiskEvent {
  riskEventId: number;
  symbol: string | null;
  eventType: string;
  details: string;
  createdAt: string;
}

export interface Notification {
  notificationId: number;
  channel: string;
  severity: string;
  title: string;
  body: string;
  metadata: string | null;
  createdAt: string;
}

export interface DailySummary {
  date: string;
  startingCapital: number;
  endingCapital: number;
  realizedPnl: number;
  unrealizedPnl: number | null;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  maxDrawdown: number | null;
}

export interface Health {
  component: string;
  status: string;
  latencyMs: number | null;
  details: string | null;
  checkedAt: string;
}

export interface WatchItem {
  symbol: string;
  exchange: string;
  quantity: number;
  lastPrice: number | null;
}

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LlmTrace {
  purpose: string;
  symbol: string | null;
  model: string;
  prompt: string;
  response: string;
  latencyMs: number;
  tokensIn: number | null;
  tokensOut: number | null;
  createdAt: string;
}
