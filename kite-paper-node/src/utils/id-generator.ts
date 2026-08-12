/**
 * ID generation for orders, trades, and GTT triggers.
 *
 * Order IDs follow the Kite format: YYMMDD + 9-digit sequence.
 */

import { createHash, randomBytes } from 'crypto';

let orderSequence = 0;
let tradeSequence = 0;
let gttSequence = 0;

function datePrefix(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    String(date.getFullYear()).slice(2) +
    pad(date.getMonth() + 1) +
    pad(date.getDate())
  );
}

/** Generate a Kite-style order ID: "YYMMDDNNNNNNNNN". */
export function generateOrderId(date: Date = new Date()): string {
  orderSequence = (orderSequence + 1) % 1_000_000_000;
  return datePrefix(date) + String(orderSequence).padStart(9, '0');
}

/** Generate a trade ID. */
export function generateTradeId(): string {
  tradeSequence = (tradeSequence + 1) % 1_000_000_000;
  return 'T' + String(tradeSequence).padStart(9, '0');
}

/** Generate a GTT trigger ID. */
export function generateGTTId(): string {
  gttSequence = (gttSequence + 1) % 1_000_000_000;
  return 'G' + String(gttSequence).padStart(9, '0');
}

/** Generate a random GUID (used for the order `guid` field). */
export function generateGuid(): string {
  return createHash('sha1').update(randomBytes(16)).digest('hex').slice(0, 24);
}
