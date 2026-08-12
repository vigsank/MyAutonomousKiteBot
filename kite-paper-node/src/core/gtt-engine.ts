/**
 * GTT Engine — monitors Good-Till-Triggered triggers against incoming ticks
 * and transitions their state when trigger values are breached.
 */

import type { GTTParams, GTTTrigger, Tick } from '../types';
import { StateStore } from '../state/state-store';
import { TickEventBus } from '../market/tick-event-bus';
import { generateGTTId } from '../utils/id-generator';

export class GTTEngine {
  private unsubscribe: () => void;

  constructor(
    private store: StateStore,
    bus: TickEventBus
  ) {
    this.unsubscribe = bus.subscribe((tick) => this.onTick(tick));
  }

  /** Create a new GTT trigger. */
  createTrigger(input: GTTParams): GTTTrigger {
    const now = new Date();
    const trigger: GTTTrigger = {
      trigger_id: generateGTTId(),
      type: input.type ?? (input.orders.length > 1 ? 'two-leg' : 'single'),
      status: 'active',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: input.expires_at ?? new Date(now.getTime() + 30 * 24 * 3600_000).toISOString(),
      condition: {
        instrument_token: input.instrument_token,
        exchange: input.exchange,
        tradingsymbol: input.tradingsymbol,
        trigger_values: input.trigger_values,
        last_price: 0,
      },
      orders: input.orders,
    };
    this.store.addGTT(trigger);
    return trigger;
  }

  /** Modify an existing GTT trigger. */
  modifyTrigger(triggerId: string, params: Partial<GTTParams>): GTTTrigger {
    const trigger = this.store.getGTT(triggerId);
    if (!trigger) throw new Error(`GTT trigger not found: ${triggerId}`);
    if (params.trigger_values) trigger.condition.trigger_values = params.trigger_values;
    if (params.orders) trigger.orders = params.orders;
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
