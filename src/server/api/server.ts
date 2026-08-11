/**
 * UI backend: REST API + live WebSocket feed + static client hosting.
 *
 * Boots alongside the trading bot (see index.ts). Exposes the persisted ledger
 * state to the React dashboard and pushes a `refresh` event over WS whenever
 * new data lands, so the client can re-fetch. Serves the built `src/client/dist`
 * bundle so the whole app runs from one process on one port.
 */
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { AppConfig } from '../AppConfig';
import { Ledger } from '../Ledger';
import { UiQueries, PositionRow } from './queries';
import { logger } from '../Logger';

export interface UiServerHandle {
  close: () => Promise<void>;
  /** Broadcast a message to all connected dashboard clients. */
  broadcast: (message: { type: string; data?: unknown; at?: number }) => void;
}

const REFRESH_MS = 5000;

/** Enrich open positions with unrealized PnL computed from last price. */
function withUnrealizedPnl(positions: PositionRow[]) {
  return positions.map((p) => {
    const last = p.lastPrice ?? p.avgPrice;
    const unrealized =
      p.direction === 'LONG'
        ? (last - p.avgPrice) * p.quantity
        : (p.avgPrice - last) * p.quantity;
    return { ...p, lastPrice: last, unrealizedPnl: unrealized };
  });
}

export function startUiServer(
  config: AppConfig,
  ledger: Ledger,
  schema = '',
): Promise<UiServerHandle> {
  const queries = new UiQueries(ledger.raw(), schema);

  const app = express();
  app.use(express.json());

  // Permissive CORS — the client may run on Vite's dev server (different port).
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (_req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  /* ----------------------------- REST API ----------------------------- */
  app.get('/api/overview', (_req, res) => {
    res.json(queries.overview(config));
  });
  app.get('/api/positions', (_req, res) => {
    res.json(withUnrealizedPnl(queries.positions()));
  });
  app.get('/api/orders', (_req, res) => res.json(queries.orders()));
  app.get('/api/trades', (_req, res) => res.json(queries.trades()));
  app.get('/api/signals', (_req, res) => res.json(queries.signals()));
  app.get('/api/risk-events', (_req, res) => res.json(queries.riskEvents()));
  app.get('/api/notifications', (_req, res) =>
    res.json(queries.notifications()),
  );
  app.get('/api/daily-summary', (_req, res) => res.json(queries.dailySummary()));
  app.get('/api/health', (_req, res) => res.json(queries.health()));
  app.get('/api/watchlist', (_req, res) => {
    const ticks = new Map(
      queries.latestTicks().map((t) => [t.symbol, t.price]),
    );
    res.json(
      config.watchlist
        .filter((s) => s.enabled)
        .map((s) => ({
          symbol: s.tradingsymbol,
          exchange: s.exchange,
          quantity: s.quantity,
          lastPrice: ticks.get(s.tradingsymbol) ?? null,
        })),
    );
  });
  app.get('/api/candles', (req, res) => {
    const symbol = String(req.query.symbol ?? '');
    const interval = String(req.query.interval ?? '5minute');
    const limit = Number(req.query.limit ?? 500);
    if (!symbol) return res.status(400).json({ error: 'symbol is required' });
    res.json(queries.candles(symbol, interval, limit));
  });
  app.get('/api/candle-intervals', (_req, res) =>
    res.json(queries.candleIntervals()),
  );
  app.get('/api/llm-traces', (_req, res) => res.json(queries.llmTraces()));

  app.get('/api/healthz', (_req, res) => res.json({ ok: true }));

  /* ------------------- Static client (built) -------------------------- */
  const clientDist = path.join(process.cwd(), 'src', 'client', 'dist');
  const indexFile = path.join(clientDist, 'index.html');
  app.use(express.static(clientDist));
  // SPA fallback: any non-API route returns the client shell.
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    if (fs.existsSync(indexFile)) {
      res.sendFile(indexFile);
    } else {
      res.status(503).json({
        ok: false,
        error: 'Client not built. Run `npm run build:ui` in the project root.',
      });
    }
  });

  const server = http.createServer(app);

  /* --------------------------- WebSocket ------------------------------ */
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    logger.info({ clients: wss.clients.size }, 'Dashboard connected');
    ws.send(JSON.stringify({ type: 'hello', at: Date.now() }));
  });

  const broadcast = (message: { type: string; data?: unknown; at?: number }) => {
    const payload = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  };

  // Track the newest notification already pushed so we only emit new ones.
  let lastNotificationId = 0;

  // Periodically nudge connected dashboards to re-fetch (simple push model)
  // and push any newly-recorded notifications as live toasts.
  const refreshTimer = setInterval(() => {
    for (const n of queries.notifications(50)) {
      if (n.notificationId > lastNotificationId) {
        lastNotificationId = n.notificationId;
        broadcast({ type: 'notification', data: n });
      }
    }
    broadcast({ type: 'refresh', at: Date.now() });
  }, REFRESH_MS);

  const port = Number(process.env.UI_PORT) || 3000;
  const host = process.env.UI_HOST || '0.0.0.0';

  return new Promise<UiServerHandle>((resolve) => {
    server.listen(port, host, () => {
      logger.info(
        { port, ws: `/ws`, client: clientDist },
        'UI server started',
      );
      resolve({
        close: () =>
          new Promise<void>((done) => {
            clearInterval(refreshTimer);
            for (const client of wss.clients) client.terminate();
            wss.close(() => server.close(() => done()));
          }),
        broadcast,
      });
    });
  });
}
