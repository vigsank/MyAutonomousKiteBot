/**
 * EntryScreen — the weekend entry screen (master-class 1-2-3 workflow).
 *
 * Runs the pure screen over the user's Nifty-100 weekend watchlist and returns
 * ranked entry candidates with a suggested entry band. It is a *feature input*
 * to MomentumStrategy (boost/shrink a momentum candidate), never a separate
 * originator — consistent with the momentum-originates / AI-filters authority
 * model. The daily tracker (`trackDaily`) is the defensive exit path.
 */

import { AppConfig } from './AppConfig';
import { ClosePoint } from './signals/momentum';
import { screenEntry, trackDaily, ScreenVerdict, TrackerSignal, EntryScreenOptions, Candle } from './signals/entryScreen';

export interface EntryCandidate {
  symbol: string;
  verdict: ScreenVerdict;
  /** Rank score: breakout=2, near_ath=1, rejected=0. */
  score: number;
  reasons: string[];
  ath: number | null;
  pullbackLow: number | null;
  last: number | null;
  dma: number | null;
  athDistancePct: number | null;
  /** Suggested entry band (support = prior ATH, ceiling = latest close). */
  entryBand: { low: number; high: number } | null;
}

const VERDICT_SCORE: Record<ScreenVerdict, number> = { breakout: 2, near_ath: 1, rejected: 0 };

export class EntryScreen {
  constructor(private readonly config: AppConfig) {}

  private options(): EntryScreenOptions {
    return {
      dmaPeriod: this.config.strategy.entryScreenDmaPeriod,
      nearAthPct: this.config.strategy.entryScreenNearAthPct,
    };
  }

  /** Screen the watchlist and return candidates ranked best-first. */
  screen(closesBySymbol: Map<string, ClosePoint[]>): EntryCandidate[] {
    const opts = this.options();
    const out: EntryCandidate[] = [];
    for (const [symbol, closes] of closesBySymbol) {
      const r = screenEntry(symbol, closes, opts);
      const band =
        r.pattern.ath !== null && r.pattern.last !== null && r.verdict !== 'rejected'
          ? { low: r.pattern.ath, high: r.pattern.last }
          : null;
      out.push({
        symbol,
        verdict: r.verdict,
        score: VERDICT_SCORE[r.verdict],
        reasons: r.reasons,
        ath: r.pattern.ath,
        pullbackLow: r.pattern.pullbackLow,
        last: r.pattern.last,
        dma: r.dma,
        athDistancePct: r.athDistancePct,
        entryBand: band,
      });
    }
    // Rank: score desc, then closest-to-ATH (least negative distance) first.
    out.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.athDistancePct ?? -Infinity) - (a.athDistancePct ?? -Infinity);
    });
    return out;
  }

  /** Daily tracker: recompute the DMA and decide ENTER/HOLD/EXIT for one name. */
  track(candles: Candle[]): TrackerSignal {
    return trackDaily(candles, {
      dmaPeriod: this.config.strategy.entryScreenDmaPeriod,
      nearAthPct: this.config.strategy.entryScreenNearAthPct,
      requireUptrend: this.config.strategy.entryTrackerRequireUptrend,
      uptrendWindow: this.config.strategy.entryTrackerUptrendWindow,
    });
  }
}
