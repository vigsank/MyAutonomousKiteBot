import { AppConfig } from './AppConfig';
import { Ledger } from './Ledger';
import { MomentumStrategy } from './MomentumStrategy';
import { LiveDataProvider } from './MarketDataProvider';
import { sma, ClosePoint } from './signals/momentum';
import { logger } from './Logger';

/**
 * DmaBreakMonitor — the daily 220-DMA-break stop (master-class rule #4).
 *
 * The one master-class overlay that survived validation: exiting a held name
 * whose close breaks below its 220-DMA cut max drawdown ~8pp at no return cost
 * (see test/backtest/entry_tracker_validation.ts). This engine runs that check
 * against the live provider's daily history and routes exits through
 * MomentumStrategy.defensiveExit (RiskEngine is the final arbiter).
 *
 * Disabled by default (`ENTRY_TRACKER_ENABLED=false`).
 */
export class DmaBreakMonitor {
  constructor(
    private readonly config: AppConfig,
    private readonly ledger: Ledger,
    private readonly momentum: MomentumStrategy,
    private readonly streamer: LiveDataProvider,
  ) {}

  /** One check: exit any held name whose latest close is below its DMA. */
  async check(now: Date): Promise<{ exited: string[] }> {
    if (!this.config.strategy.entryTrackerEnabled) return { exited: [] };
    if (!this.streamer.isConfigured) return { exited: [] };

    const positions = this.ledger.getOpenPositions();
    if (positions.length === 0) return { exited: [] };

    const period = this.config.strategy.entryScreenDmaPeriod;
    const to = new Date();
    // Enough history for the DMA plus a buffer for weekends/holidays.
    const from = new Date(to.getTime() - (period + 30) * 24 * 60 * 60 * 1000);

    const exited: string[] = [];
    for (const pos of positions) {
      try {
        const inst = this.streamer.findInstrument(pos.symbol, 'NSE');
        if (!inst) continue;
        const candles = await this.streamer.getHistoricalData(inst.instrument_token, 'day', from, to);
        const closes: ClosePoint[] = candles
          .map((c) => ({ date: c.date.toISOString().slice(0, 10), close: c.close }))
          .filter((p) => Number.isFinite(p.close) && p.close > 0)
          .sort((a, b) => (a.date < b.date ? -1 : 1));
        const avg = sma(closes, period);
        const last = closes.length ? closes[closes.length - 1].close : null;
        if (avg === null || last === null) continue;
        if (last < avg) {
          const ok = this.momentum.defensiveExit(
            pos.symbol,
            last,
            now,
            `DMA break: close ${last.toFixed(2)} < ${period}-DMA ${avg.toFixed(2)}`,
          );
          if (ok) exited.push(pos.symbol);
          logger.info(
            { symbol: pos.symbol, ok, dma: avg.toFixed(2), close: last.toFixed(2) },
            'DmaBreakMonitor: defensive exit',
          );
        }
      } catch (err) {
        logger.warn({ symbol: pos.symbol, err: (err as Error)?.message }, 'DmaBreakMonitor: check failed');
      }
    }
    return { exited };
  }
}
