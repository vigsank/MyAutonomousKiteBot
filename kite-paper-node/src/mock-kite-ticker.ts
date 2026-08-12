/**
 * MockKiteTicker — drop-in replacement for `KiteTicker`.
 *
 * Extends the real KiteTicker class (when available) and emits `ticks` and
 * `order_update` events from the in-process mock engine's tick bus. Supports
 * subscribe, unsubscribe, setMode (ltp/quote/full), and auto-reconnect flags.
 *
 * The real KiteTicker (v5+) exposes `on` but no public `emit`, so this class
 * maintains its own listener registry and `emit` implementation to dispatch
 * events reliably regardless of the base class.
 */

import { KiteTickerBaseClass } from './kiteconnect-compat';
import { MockEngine } from './mock-engine';
import { getDefaultEngine } from './mock-kite-connect';
import type { OrderRecord, Tick } from './types';

export interface MockKiteTickerParams {
  api_key: string;
  access_token: string;
  reconnect?: boolean;
  max_retry?: number;
  max_delay?: number;
  engine?: MockEngine;
}

export class MockKiteTicker extends KiteTickerBaseClass {
  // Mode constants (mirror the real KiteTicker).
  public readonly modeFull = 'full';
  public readonly modeLTP = 'ltp';
  public readonly modeQuote = 'quote';

  private engine: MockEngine;
  private unsubscribeTicks: () => void;
  private unsubscribeOrders: () => void;
  private subscribedTokens = new Set<number>();
  private mode: 'ltp' | 'quote' | 'full' = 'full';
  private connectedFlag = false;
  private listeners = new Map<string, Array<(...args: any[]) => void>>();

  constructor(params: MockKiteTickerParams) {
    super({ api_key: params.api_key, access_token: params.access_token });
    this.engine = params.engine ?? getDefaultEngine();
    this.unsubscribeTicks = this.engine.bus.subscribe((tick) => this.onTick(tick));
    this.unsubscribeOrders = this.subscribeOrderUpdates();
  }

  private subscribeOrderUpdates(): () => void {
    const handler = (order: OrderRecord) => this.emit('order_update', order);
    this.engine.bus.on('order_update', handler);
    return () => this.engine.bus.off('order_update', handler);
  }

  /** Register an event listener. */
  on(event: string, listener: (...args: any[]) => void): this {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(listener);
    return this;
  }

  /** Remove an event listener. */
  off(event: string, listener: (...args: any[]) => void): this {
    const list = this.listeners.get(event);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
    }
    return this;
  }

  /** Dispatch an event to all registered listeners. */
  private emit(event: string, ...args: any[]): void {
    const list = this.listeners.get(event);
    if (!list) return;
    for (const listener of list.slice()) {
      try {
        listener(...args);
      } catch {
        /* ignore listener errors */
      }
    }
  }

  private onTick(tick: Tick): void {
    if (!this.connectedFlag) return;
    if (!this.subscribedTokens.has(tick.instrument_token)) return;
    this.emit('ticks', [tick]);
  }

  /** Configure auto-reconnect (accepted for compatibility). */
  autoReconnect(enable: boolean, maxRetry?: number, maxDelay?: number): void {
    // Mock always stays connected; accepted for API compatibility.
  }

  /** Connect — mock connects immediately. */
  connect(): void {
    this.connectedFlag = true;
    this.emit('connect');
  }

  /** Check if connected. */
  connected(): boolean {
    return this.connectedFlag;
  }

  /** Disconnect. */
  disconnect(): void {
    this.connectedFlag = false;
    this.emit('close');
  }

  /** Subscribe to instrument tokens. Returns the tokens. */
  subscribe(tokens: number[]): number[] {
    for (const t of tokens) this.subscribedTokens.add(t);
    return tokens;
  }

  /** Unsubscribe from instrument tokens. Returns the tokens. */
  unsubscribe(tokens: number[]): number[] {
    for (const t of tokens) this.subscribedTokens.delete(t);
    return tokens;
  }

  /** Set the tick mode for the given tokens. */
  setMode(mode: 'ltp' | 'quote' | 'full', tokens: number[]): number[] {
    this.mode = mode;
    return tokens;
  }

  /** Stop listening to the bus. */
  close(): void {
    this.unsubscribeTicks();
    this.unsubscribeOrders();
    this.connectedFlag = false;
  }
}
