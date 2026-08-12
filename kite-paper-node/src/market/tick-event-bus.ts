/**
 * Central tick pub/sub bus.
 *
 * All market data sources (random walk generators, historical replay, manual
 * injection) publish ticks here. All consumers (matching engine, GTT engine,
 * OHLC aggregator, ticker facade, WebSocket server) subscribe here.
 */

import { EventEmitter } from 'events';
import type { Tick } from '../types';

export class TickEventBus {
  private emitter = new EventEmitter();
  private tickCount = 0;

  /** Publish a tick to all subscribers. */
  publish(tick: Tick): void {
    this.tickCount++;
    this.emitter.emit('tick', tick);
  }

  /** Subscribe to ticks. Returns an unsubscribe function. */
  subscribe(listener: (tick: Tick) => void): () => void {
    this.emitter.on('tick', listener);
    return () => this.emitter.off('tick', listener);
  }

  /** Subscribe to a named event. */
  on(event: string, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener);
  }

  /** Remove a named-event listener. */
  off(event: string, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener);
  }

  /** Emit a named event. */
  emit(event: string, ...args: any[]): void {
    this.emitter.emit(event, ...args);
  }

  getTickCount(): number {
    return this.tickCount;
  }

  /** Remove all listeners (used on reset). */
  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
