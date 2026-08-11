import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const INR_PRECISE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUM = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const currency = (n: number) => INR.format(n);
export const currencyPrecise = (n: number) => INR_PRECISE.format(n);
export const number = (n: number) => NUM.format(n);
export const percent = (n: number, digits = 1) =>
  `${n.toFixed(digits)}%`;

/** Sign-aware formatting for PnL (always shows +/- and color intent). */
export function signedCurrency(n: number) {
  const s = n >= 0 ? '+' : '-';
  return `${s}${INR.format(Math.abs(n))}`;
}

export function signedPercent(n: number, digits = 2) {
  const s = n >= 0 ? '+' : '-';
  return `${s}${Math.abs(n).toFixed(digits)}%`;
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return format(d, 'MMM d, HH:mm');
}

export function shortTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return format(d, 'HH:mm:ss');
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}
