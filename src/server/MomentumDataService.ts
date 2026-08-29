/**
 * MomentumDataService — fetch daily closes from a live data provider (INDmoney
 * or Kite) and compute the trailing momentum score for each symbol.
 *
 * This is the data-gathering half of the momentum signal: it turns a streamer
 * into a `Map<symbol, momentum>` that the DailyReportEngine feeds to the LLM so
 * the AI can weigh news sentiment against price trend. Pure signal math lives in
 * `signals/momentum.ts`; this module only does the I/O.
 */

import { LiveDataProvider } from './MarketDataProvider';
import { computeMomentum } from './signals/momentum';
import { logger } from './Logger';

/**
 * Compute trailing momentum for each symbol from the provider's daily history.
 * Returns a map of symbol → momentum (fractional return), skipping symbols that
 * cannot be resolved or lack sufficient history. Never throws.
 */
export async function computeMomentumMap(
  streamer: LiveDataProvider,
  symbols: string[],
  lookbackMonths: number,
  skipMonths: number,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!streamer.isConfigured) return map;

  const to = new Date();
  // Fetch enough history for the lookback + skip window, plus a buffer.
  const from = new Date(
    to.getTime() - (lookbackMonths + skipMonths + 2) * 30 * 24 * 60 * 60 * 1000,
  );

  // Surface coverage gaps visibly (INDstocks master omits a few large caps).
  const unresolved = 'unresolvedSymbols' in streamer
    ? (streamer as { unresolvedSymbols?: (s: string[]) => string[] }).unresolvedSymbols?.(symbols) ?? []
    : [];
  if (unresolved.length > 0) {
    logger.warn(
      { unresolved },
      'MomentumDataService: symbols not in instrument master (skipped)',
    );
  }

  for (const sym of symbols) {
    try {
      const inst = streamer.findInstrument(sym, 'NSE');
      if (!inst) continue;
      const candles = await streamer.getHistoricalData(inst.instrument_token, 'day', from, to);
      const closes = candles.map((c) => ({
        date: c.date.toISOString().slice(0, 10),
        close: c.close,
      }));
      const mom = computeMomentum(closes, lookbackMonths, skipMonths);
      if (mom !== null) map.set(sym, mom);
    } catch (err) {
      logger.warn({ symbol: sym, err: (err as Error)?.message }, 'MomentumDataService: fetch failed');
    }
  }
  return map;
}
