/**
 * WebSocket Ticker Server — mirrors Zerodha's KiteTicker WebSocket endpoint.
 *
 * Clients connect to ws://host:port/ticker, subscribe to instrument tokens,
 * and receive binary frames (LTP/Quote/Full) as ticks are generated. Order
 * postbacks are delivered as text messages `{ type: 'order', data }`.
 */

import type { OrderRecord, Tick } from '../types';
import { TickEventBus } from '../market/tick-event-bus';
import { BinaryPacker, type BinaryMode } from './binary-packer';
import {
  WS_ACTION_MODE,
  WS_ACTION_SUBSCRIBE,
  WS_ACTION_UNSUBSCRIBE,
} from '../protocol/constants';

export interface WSServerOptions {
  enableBinaryWS?: boolean;
}

export class WSServer {
  private wss: any;
  private unsubscribeTicks: () => void;
  private unsubscribeOrders: () => void;
  private subscriptions = new Map<any, Set<number>>();
  private clientModes = new Map<any, BinaryMode>();
  private readonly enableBinaryWS: boolean;

  constructor(
    private bus: TickEventBus,
    private packer: BinaryPacker,
    options?: WSServerOptions
  ) {
    this.enableBinaryWS = options?.enableBinaryWS ?? true;
    this.unsubscribeTicks = bus.subscribe((tick) => this.broadcast(tick));
    this.unsubscribeOrders = this.subscribeOrders();
  }

  private subscribeOrders(): () => void {
    const handler = (order: OrderRecord) => {
      for (const ws of this.subscriptions.keys()) {
        if (ws.readyState !== 1) continue;
        ws.send(JSON.stringify({ type: 'order', data: order }));
      }
    };
    this.bus.on('order_update', handler);
    return () => this.bus.off('order_update', handler);
  }

  /** Attach the WebSocket server to an existing HTTP server. */
  attach(httpServer: any): void {
    // Lazy-load `ws` (optional dependency).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const WebSocketServer = require('ws').Server;
    this.wss = new WebSocketServer({ server: httpServer, path: '/ticker' });
    this.wss.on('connection', (ws: any) => this.onConnection(ws));
  }

  private onConnection(ws: any): void {
    this.subscriptions.set(ws, new Set());
    this.clientModes.set(ws, 'full');

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(ws, msg);
      } catch {
        ws.send(JSON.stringify({ a: 'error', v: 'Invalid message' }));
      }
    });

    ws.on('close', () => {
      this.subscriptions.delete(ws);
      this.clientModes.delete(ws);
    });
  }

  private handleMessage(ws: any, msg: any): void {
    const action = msg.a;
    const value = msg.v;

    switch (action) {
      case WS_ACTION_SUBSCRIBE: {
        const set = this.subscriptions.get(ws)!;
        for (const token of value) set.add(token);
        ws.send(JSON.stringify({ a: 'ack', v: 'subscribe' }));
        break;
      }
      case WS_ACTION_UNSUBSCRIBE: {
        const set = this.subscriptions.get(ws)!;
        for (const token of value) set.delete(token);
        ws.send(JSON.stringify({ a: 'ack', v: 'unsubscribe' }));
        break;
      }
      case WS_ACTION_MODE: {
        const mode = String(value).toLowerCase();
        if (['ltp', 'quote', 'full'].includes(mode)) {
          this.clientModes.set(ws, mode as BinaryMode);
          ws.send(JSON.stringify({ a: 'ack', v: 'mode' }));
        } else {
          ws.send(JSON.stringify({ a: 'error', v: 'Invalid mode' }));
        }
        break;
      }
      default:
        ws.send(JSON.stringify({ a: 'error', v: 'Unknown action' }));
    }
  }

  private broadcast(tick: Tick): void {
    // Group ticks per client by their subscribed tokens.
    const perClient = new Map<any, Tick[]>();
    for (const [ws, tokens] of this.subscriptions) {
      if (!tokens.has(tick.instrument_token)) continue;
      if (ws.readyState !== 1) continue; // OPEN
      if (!perClient.has(ws)) perClient.set(ws, []);
      perClient.get(ws)!.push(tick);
    }
    for (const [ws, ticks] of perClient) {
      const mode = this.clientModes.get(ws) ?? 'full';
      if (this.enableBinaryWS) {
        ws.send(this.packer.pack(ticks, mode), { binary: true });
      } else {
        ws.send(JSON.stringify(ticks));
      }
    }
  }

  /** Close all connections and stop listening. */
  close(): void {
    this.unsubscribeTicks();
    this.unsubscribeOrders();
    if (this.wss) {
      for (const ws of this.subscriptions.keys()) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
      this.wss.close();
    }
  }
}
