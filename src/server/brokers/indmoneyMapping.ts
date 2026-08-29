/**
 * indmoneyMapping.ts — pure mapping functions between the bot's domain model
 * and the INDstocks (INDmoney) API. No I/O, no state — unit-testable.
 *
 * The single most important mapping: INDstocks `security_id` is a numeric
 * string, which maps onto the bot's `instrument_token: number` via
 * `Number(security_id)`. The segment travels as a prefix in scrip codes.
 */

import { Segment } from '../types';
import {
  IndExchange,
  IndOrderType,
  IndProduct,
  IndSegment,
  IndValidity,
} from './indmoneyTypes';

/** Map a bot exchange (NSE/BSE) to the INDstocks exchange enum. */
export function toIndExchange(exchange: string): IndExchange {
  return exchange === 'BSE' ? 'BSE' : 'NSE';
}

/** Map a bot product (MIS/CNC) to the INDstocks product enum. */
export function toIndProduct(product: string): IndProduct {
  return product === 'MIS' ? 'INTRADAY' : 'CNC';
}

/** Map a bot order type (MARKET/LIMIT) to the INDstocks order type. */
export function toIndOrderType(orderType: string): IndOrderType {
  return orderType === 'LIMIT' ? 'LIMIT' : 'MARKET';
}

/** Map a bot validity to the INDstocks validity enum (DAY/IOC). */
export function toIndValidity(validity: string): IndValidity {
  return validity === 'IOC' ? 'IOC' : 'DAY';
}

/** Map a bot exchange to the INDstocks segment enum (equity-only for now). */
export function toIndSegment(_exchange: string): IndSegment {
  return 'EQUITY';
}

/**
 * Build a REST scrip code from an exchange + numeric token.
 * Format: `SEGMENT_TOKEN` (underscore), e.g. `NSE_3045`.
 */
export function scripCode(exchange: string, token: number): string {
  const seg = exchange === 'BSE' ? 'BSE' : 'NSE';
  return `${seg}_${token}`;
}

/**
 * Build a WebSocket instrument id from an exchange + numeric token.
 * Format: `SEGMENT:TOKEN` (colon), e.g. `NSE:2885`.
 */
export function wsInstrument(exchange: string, token: number): string {
  const seg = exchange === 'BSE' ? 'BSE' : 'NSE';
  return `${seg}:${token}`;
}

/**
 * Map a bot/Kite interval string to the INDstocks interval value.
 * Kite uses `minute`, `5minute`, `day`, `week`, `month`, etc.
 * INDstocks uses `1minute`, `5minute`, `1day`, `1week`, `1month`, etc.
 */
export function toIndInterval(interval: string): string {
  const map: Record<string, string> = {
    minute: '1minute',
    '2minute': '2minute',
    '3minute': '3minute',
    '4minute': '4minute',
    '5minute': '5minute',
    '10minute': '10minute',
    '15minute': '15minute',
    '30minute': '30minute',
    '60minute': '60minute',
    hour: '60minute',
    '120minute': '120minute',
    '180minute': '180minute',
    '240minute': '240minute',
    day: '1day',
    week: '1week',
    month: '1month',
  };
  return map[interval] ?? '1day';
}

/**
 * Maximum time range (in milliseconds) for a single INDstocks historical call,
 * per interval. Used to page backwards for longer histories.
 */
export function maxRangeMs(interval: string): number {
  const ind = toIndInterval(interval);
  if (ind === '1day' || ind === '1week' || ind === '1month') {
    return 365 * 24 * 60 * 60 * 1000; // 1 year
  }
  if (ind === '60minute' || ind === '120minute' || ind === '180minute' || ind === '240minute') {
    return 15 * 24 * 60 * 60 * 1000; // 15 days
  }
  return 7 * 24 * 60 * 60 * 1000; // 7 days (intraday)
}

/**
 * Map an INDstocks order status to the bot's normalized order status.
 * The bot's `OrderRecord.status` uses free-form strings; we normalize to a
 * small set: OPEN | PENDING | FILLED | PARTIAL | CANCELLED | EXPIRED | FAILED.
 */
export function normalizeOrderStatus(status: string): string {
  const s = (status ?? '').toUpperCase();
  if (s === 'SUCCESS') return 'FILLED';
  if (s.startsWith('PARTIALLY FILLED')) return 'PARTIAL';
  if (s === 'CANCELLED' || s === 'ABORTED') return 'CANCELLED';
  if (s === 'EXPIRED') return 'EXPIRED';
  if (s === 'FAILED') return 'FAILED';
  if (s === 'O-PENDING' || s === 'SL-PENDING') return 'PENDING';
  if (s === 'INITIATED' || s === 'PROCESSING' || s === 'PENDING' || s === 'QUEUED') {
    return 'OPEN';
  }
  return 'OPEN';
}

/**
 * Parse a numeric `security_id` into a numeric token. Returns null when the id
 * is not numeric (e.g. some index/F&O tokens) — the equity-only scope rejects
 * these with a clear log rather than silently mis-mapping.
 */
export function securityIdToToken(securityId: string): number | null {
  const n = Number(securityId);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Map a bot exchange to the INDstocks `algo_id` (NSE vs BSE). */
export function algoIdFor(exchange: string, nse: string, bse: string): string {
  return exchange === 'BSE' ? bse : nse;
}

/** Truncate a correlation tag to the INDstocks `remarks` 100-char limit. */
export function toRemarks(intent: string): string {
  return intent.slice(0, 100);
}

/** Map a bot exchange to the INDstocks segment prefix for scrip codes. */
export function segmentPrefix(exchange: string): string {
  return exchange === 'BSE' ? 'BSE' : 'NSE';
}

/** Re-export the bot's Segment type for convenience in mapping callers. */
export type { Segment };
