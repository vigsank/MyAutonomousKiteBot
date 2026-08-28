import YahooFinance from 'yahoo-finance2';
import { logger } from './Logger';

/**
 * GlobalMacro — fetches overnight / global market numbers that set the tone for
 * the Indian (Dalal Street) session, and derives a market regime score R.
 *
 * This is the "numbers" half of the global-macro split (the "headlines" half is
 * TinyFish -> Google News RSS, handled by the NewsSentimentEngine). It is
 * best-effort: a fetch failure never throws — the caller proceeds with whatever
 * data is available.
 */

/** A single global market reading. */
export interface GlobalMacroReading {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
}

/** The assembled global-macro snapshot. */
export interface GlobalMacroSnapshot {
  readings: GlobalMacroReading[];
  /** Market regime score R in [-1, +1] derived from the readings. */
  regimeScore: number;
  regimeLabel: 'BULLISH_CONSTRUCTIVE' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'BEARISH_CAUTIOUS';
  summary: string;
  fetchedAt: Date;
}

/** Yahoo symbols that set the overnight tone for the Indian market. */
const GLOBAL_SYMBOLS: Array<{ symbol: string; name: string }> = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'Nasdaq' },
  { symbol: '^N225', name: 'Nikkei 225' },
  { symbol: 'CL=F', name: 'Crude Oil (WTI)' },
  { symbol: 'USDINR=X', name: 'USD/INR' },
  { symbol: '^NSEI', name: 'Nifty 50 (domestic)' },
];

/**
 * Fetch global market numbers and derive a regime score. Never throws — returns
 * a snapshot with whatever readings succeeded (empty readings on total failure).
 *
 * @param asOf  optional YYYY-MM-DD. When set, each index's % change is computed
 *              from Yahoo chart history for THAT date (close vs prior close),
 *              so backtests see the macro tone the market actually had then.
 *              When omitted, uses the live quote snapshot.
 */
export async function fetchGlobalMacro(asOf?: string): Promise<GlobalMacroSnapshot> {
  const fetchedAt = new Date();
  const readings: GlobalMacroReading[] = [];

  try {
    const client = new YahooFinance({ suppressNotices: ['ripHistorical'] });
    if (asOf) {
      for (const meta of GLOBAL_SYMBOLS) {
        const reading = await readingAt(client, meta.symbol, meta.name, asOf);
        if (reading) readings.push(reading);
      }
    } else {
      const quotes = await client.quote(GLOBAL_SYMBOLS.map((s) => s.symbol));
      const list = Array.isArray(quotes) ? quotes : [quotes];
      for (const q of list) {
        const meta = GLOBAL_SYMBOLS.find((s) => s.symbol === q.symbol);
        if (!meta) continue;
        const price = q.regularMarketPrice;
        const changePct = q.regularMarketChangePercent;
        if (typeof price !== 'number' || !Number.isFinite(price)) continue;
        if (typeof changePct !== 'number' || !Number.isFinite(changePct)) continue;
        readings.push({ symbol: meta.symbol, name: meta.name, price, changePct });
      }
    }
  } catch (err) {
    logger.warn({ err: err?.message }, 'GlobalMacro fetch failed (best-effort)');
  }

  const regimeScore = computeRegimeScore(readings);
  const regimeLabel = labelFor(regimeScore);
  const summary = summarize(readings, regimeScore, regimeLabel, asOf);

  return { readings, regimeScore, regimeLabel, summary, fetchedAt };
}

/**
 * Historical reading for one symbol as-of `asOf` (YYYY-MM-DD): close price and
 * day-over-day % change on that date, from Yahoo chart history. Returns null on
 * any failure (missing series, no data on/before the date, etc.).
 */
async function readingAt(
  client: YahooFinance,
  symbol: string,
  name: string,
  asOf: string,
): Promise<GlobalMacroReading | null> {
  const end = new Date(`${asOf}T00:00:00Z`);
  const period2 = Math.floor(end.getTime() / 1000) + 86_400; // allow the asOf day itself
  const period1 = period2 - 21 * 24 * 3600; // ~3 weeks of daily history before it
  const res = await client.chart(symbol, { period1, period2, interval: '1d' });
  const quotes = (res.quotes ?? [])
    .filter((q: any) => q.date && typeof q.close === 'number' && Number.isFinite(q.close))
    .map((q: any) => ({
      date: new Date(q.date).toISOString().slice(0, 10),
      close: q.close as number,
    }))
    .sort((a: any, b: any) => (a.date < b.date ? -1 : 1));
  if (quotes.length < 2) return null;

  // Close on/before asOf, and the prior session's close.
  let idx = -1;
  for (let i = quotes.length - 1; i >= 0; i--) {
    if (quotes[i].date <= asOf) { idx = i; break; }
  }
  if (idx <= 0) return null;
  const price = quotes[idx].close;
  const prev = quotes[idx - 1].close;
  if (price <= 0 || prev <= 0) return null;
  return { symbol, name, price, changePct: (price / prev - 1) * 100 };
}

/**
 * Derive a regime score R in [-1, +1] from the readings.
 *
 * Logic (transparent, deterministic):
 *  - Global equity tone: average change% of S&P, Nasdaq, Nikkei (each ±1% maps
 *    to ±0.5 of the score).
 *  - Crude headwind: rising crude is a mild negative for equities.
 *  - FX headwind: a weakening INR (rising USD/INR) is a mild negative.
 *  - Domestic Nifty change reinforces the tone.
 */
function computeRegimeScore(readings: GlobalMacroReading[]): number {
  const get = (symbol: string) => readings.find((r) => r.symbol === symbol)?.changePct;

  const equity = [get('^GSPC'), get('^IXIC'), get('^N225')].filter(
    (v): v is number => v !== undefined,
  );
  const nifty = get('^NSEI');
  const crude = get('CL=F');
  const usdinr = get('USDINR=X');

  let score = 0;
  let weight = 0;

  if (equity.length > 0) {
    const avg = equity.reduce((s, v) => s + v, 0) / equity.length;
    score += clamp(avg / 2, -1, 1) * 0.6;
    weight += 0.6;
  }
  if (nifty !== undefined) {
    score += clamp(nifty / 2, -1, 1) * 0.25;
    weight += 0.25;
  }
  if (crude !== undefined) {
    // Rising crude = headwind: subtract a scaled positive change.
    score -= clamp(crude / 4, -1, 1) * 0.1;
    weight += 0.1;
  }
  if (usdinr !== undefined) {
    // Rising USD/INR = INR weakening = headwind.
    score -= clamp(usdinr / 2, -1, 1) * 0.05;
    weight += 0.05;
  }

  if (weight === 0) return 0;
  return clamp(score / weight, -1, 1);
}

function labelFor(score: number): GlobalMacroSnapshot['regimeLabel'] {
  if (score >= 0.5) return 'BULLISH_CONSTRUCTIVE';
  if (score >= 0.2) return 'BULLISH';
  if (score <= -0.5) return 'BEARISH_CAUTIOUS';
  if (score <= -0.2) return 'BEARISH';
  return 'NEUTRAL';
}

function summarize(
  readings: GlobalMacroReading[],
  score: number,
  label: GlobalMacroSnapshot['regimeLabel'],
  asOf?: string,
): string {
  if (readings.length === 0) {
    return 'Global macro data unavailable. Proceeding on domestic news alone.';
  }
  const when = asOf ? ` (as of ${asOf})` : '';
  const parts = readings.map((r) => `${r.name} ${r.changePct >= 0 ? '+' : ''}${r.changePct.toFixed(2)}%`);
  return `Regime ${label} (score ${score.toFixed(2)})${when}. ${parts.join('; ')}.`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
