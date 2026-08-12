/**
 * Price and quantity helpers.
 */

/** Round a price to the nearest tick size. */
export function roundToTickSize(price: number, tickSize: number): number {
  if (!tickSize || tickSize <= 0) return price;
  const factor = 1 / tickSize;
  return Math.round(price * factor) / factor;
}

/** Clamp a value into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Ensure a quantity is a positive integer. */
export function normalizeQuantity(qty: number): number {
  return Math.max(1, Math.round(qty));
}

/** Compute the trade value (price × quantity). */
export function tradeValue(price: number, quantity: number): number {
  return price * quantity;
}

/** Weighted average of two price/quantity pairs. */
export function weightedAverage(
  priceA: number,
  qtyA: number,
  priceB: number,
  qtyB: number
): number {
  const totalQty = qtyA + qtyB;
  if (totalQty === 0) return 0;
  return (priceA * qtyA + priceB * qtyB) / totalQty;
}

/** Round money to 2 decimal places. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
