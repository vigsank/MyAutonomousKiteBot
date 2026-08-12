/**
 * GTT Engine — monitors Good-Till-Triggered triggers against incoming ticks
 * and transitions their state when trigger values are breached.
 */

import type { GTTParams, GTTTrigger, Tick } from '../types';
import { StateStore } from '../state/state-store';
import { TickEventBus } from '../market/tick-event-bus';

export class GTTEngine {
  private unsubscribe: () => void;
  private idCounter = 0;

  constructor(
    private store: StateStore,
    bus: TickEventBus
  ) {
    this.unsubscribe = bus.subscribe((tick) => this.onTick(tick));
  }

  private nextId(): number {
    this.idCounter += 1;
    return this.idCounter;
  }

  /** Create a new GTT trigger. */
  createTrigger(input: GTTParams): GTTTrigger {
    const now = new Date();
    const trigger: GTTTrigger = {
      id: this.nextId(),
      user_id: 'AB1234',
      parent_trigger: null,
      type: input.type ?? (input.orders.length > 1 ? 'two-leg' : 'single'),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: input.expires_at ?? new Date(now.getTime() + 30 * 24 * 3600_000).toISOString(),
      status: 'active',
      condition: {
        exchange: input.exchange,
        last_price: 0,
        tradingsymbol: input.tradingsymbol,
        trigger_values: input.trigger_values,
        instrument_token: input.instrument_token,
      },
      orders: input.orders.map((o) => ({ ...o, result: null })),
      meta: {},
    };
    this.store.addGTT(trigger);
    return trigger;
  }

  /** Modify an existing GTT trigger. */
  modifyTrigger(triggerId: string, params: Partial<GTTParams>): GTTTrigger {
    const trigger = this.store.getGTT(triggerId);
    if (!trigger) throw new Error(`GTT trigger not found: ${triggerId}`);
    if (params.trigger_values) trigger.condition.trigger_values = params.trigger_values;
    if (params.orders) trigger.orders = params.orders.map((o) => ({ ...o, result: null }));
    if (params.expires_at) trigger.expires_at = params.expires_at;
    trigger.updated_at = new Date().toISOString();
    this.store.addGTT(trigger);
    return trigger;
  }

  private onTick(tick: Tick): void {
    for (const trigger of this.store.getGTTs()) {
      if (trigger.status !== 'active') continue;
      if (trigger.condition.instrument_token !== tick.instrument_token) continue;

      trigger.condition.last_price = tick.last_price;
      const values = trigger.condition.trigger_values;
      const breached = values.some((v) => {
        // Trigger when price crosses the value (either direction).
        return tick.last_price >= v;
      });

      if (breached) {
        trigger.status = 'triggered';
        trigger.updated_at = new Date().toISOString();
        this.store.addGTT(trigger);
      }
    }
  }

  getGTT(triggerId: string): GTTTrigger | undefined {
    return this.store.getGTT(triggerId);
  }

  getGTTs(): GTTTrigger[] {
    return this.store.getGTTs();
  }

  deleteGTT(triggerId: string): boolean {
    return this.store.deleteGTT(triggerId);
  }

  destroy(): void {
    this.unsubscribe();
  }
}
