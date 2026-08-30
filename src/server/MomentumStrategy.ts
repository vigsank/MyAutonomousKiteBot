import { AppConfig } from './AppConfig';
import { Ledger } from './Ledger';
import { RiskEngine } from './RiskEngine';
import { PaperTrader } from './PaperTrader';
import { logger } from './Logger';
import { TradeRequest } from './types';
import { rankByMomentum, rankByMomentumWithTilt, selectWithHysteresis, applyLiquidityFloor, applyDmaGuard, regimeMultiplier, ClosePoint } from './signals/momentum';
import { LiveDataService } from './LiveDataService';
import { LiveTrader } from './LiveTrader';
import { StrategyAdaptation } from './StrategyAdaptation';
import { istHourBucket } from './OrderGuard';

/**
 * MomentumStrategy — the single decision brain (Initiative 1).
 *
 * Replaces the per-symbol `MarketAgent` as the primary trade generator. It is a
 * portfolio-level, cross-sectional momentum strategy: rank all watchlist symbols
 * by trailing 12-month momentum (skip 1 month) and hold the top `topN`,
 * rebalanced monthly. This is the validated edge (Initiative 0).
 *
 * The LLM/Reasoning Layer, if kept, becomes a *feature input* to this strategy
 * (e.g. a veto), not a separate brain.
 */
export class MomentumStrategy {
  /** Per-symbol action bias + suggested allocation from the latest daily report. */
  private reportBias = new Map<string, { action_bias: string; suggested_allocation_inr: number }>();
  private reportLoadedAt = '';
  /** Latest report's market regime score in [-1, 1] (0 = neutral when no report). */
  private regimeScore = 0;
  /** Last computed ranking, published to the agent blackboard (see lastRanking). */
  private rankingCache: Array<{ symbol: string; momentum: number; inTarget: boolean }> = [];
  private targetCache: string[] = [];
  private rankingComputedAt: string | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly ledger: Ledger,
    private readonly risk: RiskEngine,
    private readonly trader: PaperTrader,
    private readonly liveData: LiveDataService,
    /**
     * Optional live-order router (Phase E). When supplied, every trade is
     * submitted through it so it gains idempotency (E1), the reconciliation
     * halt (E2) and the live gate (E3). Omitted in backtests, which drive
     * PaperTrader directly.
     */
    private readonly liveTrader?: LiveTrader,
    /**
     * Optional outcome-driven risk scaler (Phase F2). When supplied, position
     * sizes shrink after sustained poor realized performance and recover as it
     * improves. Omitted in backtests to keep parameter sweeps comparable.
     */
    private readonly adaptation?: StrategyAdaptation,
  ) {}

  /**
   * Submit an approved trade. Routes through LiveTrader when wired (gaining
   * idempotency + live gating), otherwise straight to PaperTrader.
   *
   * `intent` and `bucket` together define "the same order": a rebalance BUY is
   * allowed once per day, while a report adjustment is allowed once per report
   * window.
   *
   * @returns true when the trade actually executed.
   */
  private submit(trade: TradeRequest, intent: string, bucket?: string): boolean {
    if (this.liveTrader) {
      return this.liveTrader.execute(trade, intent, bucket) !== null;
    }
    this.trader.execute(trade);
    return true;
  }

  /** Load the latest daily report's per-symbol recommendations (reloads on newer report). */
  private loadReportBias(): void {
    try {
      const latest = this.ledger.getLatestReport();
      if (!latest) return;
      if (latest.createdAt === this.reportLoadedAt) return;
      this.reportLoadedAt = latest.createdAt;
      this.reportBias.clear();
      const parsed = JSON.parse(latest.reportJson);
      // Capture the AI market-regime score ([-1,1]) for regime-based sizing.
      const regime = parsed?.market_regime;
      this.regimeScore =
        regime && typeof regime.regime_score === 'number' ? regime.regime_score : 0;
      const recs = parsed?.portfolio_recommendations ?? [];
      for (const rec of recs) {
        if (rec && typeof rec.symbol === 'string' && typeof rec.action_bias === 'string') {
          this.reportBias.set(rec.symbol, {
            action_bias: rec.action_bias,
            suggested_allocation_inr: typeof rec.suggested_allocation_inr === 'number' ? rec.suggested_allocation_inr : 0,
          });
        }
      }
    } catch {
      /* ignore malformed report */
    }
  }

  /** True when the latest report says AVOID / EXIT_FULL for a symbol (A1 veto). */
  private reportVetoes(symbol: string): boolean {
    this.loadReportBias();
    const bias = this.reportBias.get(symbol)?.action_bias;
    return bias === 'AVOID' || bias === 'EXIT_FULL';
  }

  /** The latest report's action_bias for a symbol, or undefined. */
  private reportBiasFor(symbol: string): string | undefined {
    this.loadReportBias();
    return this.reportBias.get(symbol)?.action_bias;
  }

  /**
   * True when the report fully BLOCKS a new entry for a symbol.
   *
   * EXIT_FULL always blocks. AVOID blocks only in 'block' mode; in 'shrink'
   * mode an AVOID name is allowed but sized down (see quantityFor), so the AI
   * can't fully miss a quiet momentum winner while still trimming exposure.
   */
  private reportBlocksEntry(symbol: string): boolean {
    const bias = this.reportBiasFor(symbol);
    if (bias === 'EXIT_FULL') return true;
    if (bias === 'AVOID' && this.config.strategy.momentumVetoMode === 'block') return true;
    return false;
  }

  /**
   * AI sentiment-regime switching (Initiative 6).
   *
   * The daily report's `market_regime.regime_score` ([-1,1]) is a coarse,
   * low-frequency AI read of market weather. This layer converts it to a sizing
   * multiplier that scales EXPOSURE — it never changes which names momentum
   * picks, only how big the book runs:
   *
   *   score >= defensive      → 1.0  (full size)
   *   defensive > score > riskOff → linear 1.0 → floor
   *   score <= riskOff        → floor (0 = go to cash)
   *
   * It is advisory and shrink-only: it can only reduce exposure below the
   * configured caps, never raise it. Inert when no AI report exists (score 0).
   */
  currentRegimeMultiplier(): number {
    if (!this.config.strategy.momentumRegimeEnabled) return 1;
    this.loadReportBias(); // ensure the latest regime_score is loaded
    return regimeMultiplier(this.regimeScore, {
      riskOff: this.config.strategy.momentumRegimeRiskOffThreshold,
      defensive: this.config.strategy.momentumRegimeDefensiveThreshold,
      floor: this.config.strategy.momentumRegimeFloorMultiplier,
    });
  }

  /** The latest report's regime score, or 0 when no report is available. */
  currentRegimeScore(): number {
    this.loadReportBias();
    return this.regimeScore;
  }

  /** Number of symbols to hold (validated: 5–10). Reads from param store, falls back to config. */
  get topN(): number {
    const stored = this.ledger.getStrategyParam('momentumTopN');
    if (stored !== null) {
      const n = Number(stored);
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
    return this.config.strategy.momentumTopN;
  }

  /**
   * Compute the target portfolio (top-N by momentum, with rank hysteresis, then
   * diversified).
   *
   * Incumbents are read from the ledger rather than passed in, so every caller
   * (live loop and every backtest harness) gets the same sticky behaviour
   * without changing its signature.
   */
  targetPortfolio(closesBySymbol: Map<string, ClosePoint[]>): string[] {
    const inputs = [...closesBySymbol.entries()].map(([symbol, closes]) => ({ symbol, closes }));
    // Liquidity floor (2.4): drop names we could not exit at size before ranking.
    // Fail-open when volume is absent, and a no-op when the floor is 0.
    const { kept, droppedForLiquidity } = applyLiquidityFloor(
      inputs,
      this.config.strategy.momentumLiquidityFloorInr,
      this.config.strategy.momentumLiquidityLookbackDays,
    );
    if (droppedForLiquidity.length > 0) {
      logger.debug(
        { dropped: droppedForLiquidity.length, floorInr: this.config.strategy.momentumLiquidityFloorInr },
        'Liquidity floor excluded symbols',
      );
    }
    // DMA trend guard (master-class 200/220-DMA): drop names below their SMA
    // before ranking. One filter implements both the entry guard and the
    // exit/stop — an incumbent below its DMA falls out of the ranking and is
    // sold at the next rebalance. Disabled (period 0) is a no-op.
    const { kept: dmaKept, droppedForDma } = applyDmaGuard(
      kept,
      this.config.strategy.momentumDmaGuardEnabled ? this.config.strategy.momentumDmaGuardPeriod : 0,
    );
    if (droppedForDma.length > 0) {
      logger.debug(
        { dropped: droppedForDma.length, period: this.config.strategy.momentumDmaGuardPeriod },
        'DMA guard excluded symbols',
      );
    }
    const lookback = this.config.strategy.momentumLookbackMonths;
    const ranked =
      this.config.strategy.momentumFactorTilt === 'lowvol'
        ? rankByMomentumWithTilt(
            dmaKept,
            lookback,
            1,
            this.config.strategy.momentumFactorTiltWeight,
            this.config.strategy.momentumFactorVolDays,
          )
        : rankByMomentum(dmaKept, lookback, 1);
    // Risk-off gate (Initiative 4, optional): if enabled and the median momentum
    // is negative (broad weakness), go to cash. Off by default — it reduced
    // returns in validation (missed recoveries).
    if (this.config.strategy.momentumRiskOff && ranked.length > 0) {
      const median = ranked[Math.floor(ranked.length / 2)].momentum;
      if (median < 0) {
        this.cacheRanking(ranked, []);
        return [];
      }
    }
    const held = this.ledger.getOpenPositions().map((p) => p.symbol);
    const top = selectWithHysteresis(
      ranked,
      held,
      this.topN,
      this.config.strategy.momentumHysteresisBand,
    );
    const target = this.diversify(top, ranked.map((s) => s.symbol));
    this.cacheRanking(ranked, target);
    return target;
  }

  /**
   * The most recent ranking, for publication to the agent blackboard.
   *
   * Momentum is the sole ORIGINATOR of trade candidates: the AI layer reads
   * this to veto, shrink or re-rank, but may not add symbols the ranking did
   * not produce. Exposing the cached result (rather than recomputing) keeps a
   * single source of truth and avoids a second 400-day data fetch per pass.
   */
  lastRanking(): {
    candidates: Array<{ symbol: string; momentum: number; inTarget: boolean }>;
    target: string[];
    topN: number;
    computedAt: string | null;
  } {
    return {
      candidates: this.rankingCache,
      target: this.targetCache,
      topN: this.topN,
      computedAt: this.rankingComputedAt,
    };
  }

  /** Store the ranking so the agent fleet can read it without recomputing. */
  private cacheRanking(
    ranked: Array<{ symbol: string; momentum: number }>,
    target: string[],
  ): void {
    const inTarget = new Set(target);
    // Keep a bounded slice: the fleet only needs the plausible candidates, and
    // an unbounded copy of a 214-symbol ranking on every pass is wasteful.
    this.rankingCache = ranked.slice(0, Math.max(this.topN * 3, 15)).map((r) => ({
      symbol: r.symbol,
      momentum: r.momentum,
      inTarget: inTarget.has(r.symbol),
    }));
    this.targetCache = target;
    this.rankingComputedAt = new Date().toISOString();
  }

  /**
   * Diversification (D2): if the top-N are concentrated in one sector, swap in
   * the next-best symbol from an underrepresented sector. Uses the watchlist's
   * optional `sector` field; no-op when sectors aren't mapped.
   */
  private diversify(top: string[], allRanked: string[]): string[] {
    const sectorOf = (sym: string): string | null =>
      this.config.watchlist.find((s) => s.tradingsymbol === sym)?.sector ?? null;
    const sectors = new Map<string, number>();
    for (const sym of top) {
      const s = sectorOf(sym);
      if (s) sectors.set(s, (sectors.get(s) ?? 0) + 1);
    }
    // If any sector holds > half the top-N, replace the weakest with the next
    // best symbol from a different sector.
    const maxPerSector = Math.max(1, Math.ceil(this.topN / 2));
    const result = [...top];
    for (let i = result.length - 1; i >= 0; i--) {
      const s = sectorOf(result[i]);
      if (s && (sectors.get(s) ?? 0) > maxPerSector) {
        const replacement = allRanked.find(
          (cand) => !result.includes(cand) && sectorOf(cand) !== s && sectorOf(cand) !== null,
        );
        if (replacement) {
          sectors.set(s, (sectors.get(s) ?? 0) - 1);
          result[i] = replacement;
        }
      }
    }
    return result;
  }

  /**
   * Rebalance the portfolio toward the target: sell positions no longer in the
   * target, buy target symbols not currently held. All trades route through the
   * RiskEngine (hard gate) → PaperTrader (paper-only).
   */
  rebalance(
    now: Date,
    prices: Map<string, number>,
    target: string[],
    newsScores?: Map<string, number>,
  ): { bought: string[]; sold: string[]; skipped: string[] } {
    const bought: string[] = [];
    const sold: string[] = [];
    const skipped: string[] = [];

    // News-risk filter (AI-backed): a strongly negative news score vetoes
    // entries and triggers early exits on held positions.
    const veto = (sym: string): boolean =>
      !!newsScores && (newsScores.get(sym) ?? 0) < this.config.strategy.newsVetoThreshold;

    // Minimum-capital guard (Initiative 5): on tiny accounts fixed costs dominate.
    const capital = this.risk.capitalSnapshot();
    if (this.config.risk.minCapital > 0 && capital.available < this.config.risk.minCapital) {
      logger.warn(
        { available: capital.available, min: this.config.risk.minCapital },
        'Momentum: below MIN_CAPITAL — skipping rebalance (cost guard)',
      );
      return { bought, sold, skipped: ['below MIN_CAPITAL'] };
    }

    const current = this.ledger.getOpenPositions();
    const currentSymbols = new Set(current.map((p) => p.symbol));
    const targetSet = new Set(target);

    // Sell positions no longer in the target, OR with a news-risk veto (exit
    // trigger), OR ahead of an undiscounted binary event (Phase 4.2 blackout).
    for (const pos of current) {
      const eventBlackout = this.hasUpcomingEvent(pos.symbol, now);
      if (targetSet.has(pos.symbol) && !veto(pos.symbol) && !eventBlackout) continue;
      const price = prices.get(pos.symbol);
      if (!price || price <= 0) {
        skipped.push(`${pos.symbol}: no price`);
        continue;
      }
      const trade: TradeRequest = {
        symbol: pos.symbol,
        exchange: pos.exchange,
        quantity: pos.quantity,
        direction: pos.direction === 'LONG' ? 'SHORT' : 'LONG',
        entryPrice: price,
        reason: veto(pos.symbol)
          ? 'momentum: news-risk exit (bad news)'
          : eventBlackout
            ? 'momentum: event blackout exit (undiscounted binary event)'
            : 'momentum rebalance: exit (no longer in top-N)',
        ticketSize: pos.quantity * price,
        timestamp: now,
        product: 'CNC',
      };
      const decision = this.risk.evaluate(trade);
      if (!decision.allowed) {
        skipped.push(`${pos.symbol}: risk ${decision.reasons.join('; ')}`);
        continue;
      }
      if (!this.submit(trade, 'REBALANCE_EXIT')) {
        skipped.push(`${pos.symbol}: duplicate/blocked`);
        continue;
      }
      sold.push(pos.symbol);
    }

    // Buy target symbols not currently held (skip news-risk + report vetoed symbols).
    //
    // Slot accounting (1.2): size against the number of positions we will
    // ACTUALLY end up holding, not topN. When the AI vetoes 2 of 6 names, their
    // share of the deployable capital would otherwise sit idle; spreading it
    // over the survivors (still clamped by the single-stock cap) is what keeps
    // the book invested instead of drifting to ~53% deployed.
    const entryCandidates = target.filter(
      (sym) =>
        !currentSymbols.has(sym) &&
        !veto(sym) &&
        !this.reportBlocksEntry(sym) &&
        !this.hasUpcomingEvent(sym, now) &&
        (prices.get(sym) ?? 0) > 0,
    );
    const keepers = current.filter(
      (p) => targetSet.has(p.symbol) && !veto(p.symbol) && !this.hasUpcomingEvent(p.symbol, now),
    ).length;
    const slots = Math.max(1, keepers + entryCandidates.length);

    for (const sym of target) {
      if (currentSymbols.has(sym)) continue;
      if (veto(sym)) {
        skipped.push(`${sym}: news veto`);
        continue;
      }
      if (this.reportBlocksEntry(sym)) {
        skipped.push(`${sym}: report veto (${this.reportBiasFor(sym)})`);
        continue;
      }
      if (this.hasUpcomingEvent(sym, now)) {
        skipped.push(`${sym}: upcoming binary event (blackout)`);
        continue;
      }
      const price = prices.get(sym);
      if (!price || price <= 0) {
        skipped.push(`${sym}: no price`);
        continue;
      }
      const quantity = this.quantityFor(sym, price, slots);
      if (quantity <= 0) {
        skipped.push(`${sym}: sizing too small`);
        continue;
      }
      // Cost-aware gate (Initiative 5): skip if round-trip cost > 1% of notional.
      const notional = quantity * price;
      if (this.roundTripCostPct() * notional > notional * 0.01) {
        skipped.push(`${sym}: cost > 1% of notional`);
        continue;
      }
      const trade: TradeRequest = {
        symbol: sym,
        exchange: 'NSE',
        quantity,
        direction: 'LONG',
        entryPrice: price,
        reason: 'momentum rebalance: enter (top-N)',
        ticketSize: quantity * price,
        timestamp: now,
        product: 'CNC',
      };
      const decision = this.risk.evaluate(trade);
      if (!decision.allowed) {
        skipped.push(`${sym}: risk ${decision.reasons.join('; ')}`);
        continue;
      }
      if (!this.submit(trade, 'REBALANCE_ENTRY')) {
        skipped.push(`${sym}: duplicate/blocked`);
        continue;
      }
      bought.push(sym);
    }

    return { bought, sold, skipped };
  }

  /**
   * Apply the latest report's recommendations to HELD positions (A3/A4).
   * Called at the 11 AM (intraday adjustment) and 3:15 PM (EOD rebalancing)
   * windows. Acts on the report's action_bias: EXIT_FULL / TRIM_50 / TRIM_25
   * sell part/full; BUY_ACCUMULATE adds. All through RiskEngine → PaperTrader.
   */
  applyReportAdjustments(
    now: Date,
    prices: Map<string, number>,
  ): { adjusted: string[]; skipped: string[] } {
    this.loadReportBias();
    const adjusted: string[] = [];
    const skipped: string[] = [];

    for (const pos of this.ledger.getOpenPositions()) {
      const bias = this.reportBias.get(pos.symbol)?.action_bias;
      if (!bias) continue;
      const price = prices.get(pos.symbol);
      if (!price || price <= 0) {
        skipped.push(`${pos.symbol}: no price`);
        continue;
      }

      // Sell part/full based on the report bias.
      let sellQty = 0;
      let reason = '';
      if (bias === 'EXIT_FULL') {
        sellQty = pos.quantity;
        reason = 'report: EXIT_FULL';
      } else if (bias === 'TRIM_50') {
        sellQty = Math.max(1, Math.floor(pos.quantity / 2));
        reason = 'report: TRIM_50';
      } else if (bias === 'TRIM_25') {
        sellQty = Math.max(1, Math.floor(pos.quantity / 4));
        reason = 'report: TRIM_25';
      }
      if (sellQty > 0) {
        const trade: TradeRequest = {
          symbol: pos.symbol,
          exchange: pos.exchange,
          quantity: sellQty,
          direction: pos.direction === 'LONG' ? 'SHORT' : 'LONG',
          entryPrice: price,
          reason,
          ticketSize: sellQty * price,
          timestamp: now,
          product: 'CNC',
        };
        const decision = this.risk.evaluate(trade);
        if (decision.allowed) {
          if (this.submit(trade, `REPORT_${bias}`, istHourBucket(now))) {
            adjusted.push(`${pos.symbol}:${bias}`);
          } else {
            skipped.push(`${pos.symbol}: duplicate/blocked`);
          }
        } else {
          skipped.push(`${pos.symbol}: risk ${decision.reasons.join('; ')}`);
        }
      }

      // Buy more if the report says accumulate.
      if (bias === 'BUY_ACCUMULATE') {
        const qty = this.quantityFor(pos.symbol, price);
        if (qty > 0) {
          const trade: TradeRequest = {
            symbol: pos.symbol,
            exchange: pos.exchange,
            quantity: qty,
            direction: 'LONG',
            entryPrice: price,
            reason: 'report: BUY_ACCUMULATE',
            ticketSize: qty * price,
            timestamp: now,
            product: 'CNC',
          };
          const decision = this.risk.evaluate(trade);
          if (decision.allowed) {
            if (this.submit(trade, 'REPORT_BUY_ACCUMULATE', istHourBucket(now))) {
              adjusted.push(`${pos.symbol}:BUY_ACCUMULATE`);
            } else {
              skipped.push(`${pos.symbol}: duplicate/blocked`);
            }
          } else {
            skipped.push(`${pos.symbol}: risk ${decision.reasons.join('; ')}`);
          }
        }
      }
    }

    return { adjusted, skipped };
  }

  /**
   * Position size for a symbol, in shares, honouring every hard cap.
   *
   * Public because the agent fleet's strategist must size with the SAME rule.
   * When it had its own `availableCapital / topN` formula the two brains drifted
   * apart and the agentic path proposed tickets the RiskEngine always refused.
   *
   * @param slots how many positions the deployable capital is being split
   *   across. Defaults to `topN`; the rebalance passes the number of slots it
   *   will *actually* fill so vetoed names don't strand their allocation.
   */
  sizeFor(symbol: string, price: number, slots?: number): number {
    return this.quantityFor(symbol, price, slots);
  }

  /**
   * Defensive exit (Phase 4.4): exit a HELD position immediately on negative
   * news, before the price fully reflects it. Routes through RiskEngine +
   * LiveTrader. Returns true when the position was closed.
   */
  defensiveExit(symbol: string, price: number, now: Date, reason: string): boolean {
    const pos = this.ledger.getPosition(symbol, 'NSE');
    if (!pos) return false;
    const trade: TradeRequest = {
      symbol,
      exchange: 'NSE',
      quantity: pos.quantity,
      direction: pos.direction === 'LONG' ? 'SHORT' : 'LONG',
      entryPrice: price,
      reason,
      ticketSize: pos.quantity * price,
      timestamp: now,
      product: 'CNC',
    };
    const decision = this.risk.evaluate(trade);
    if (!decision.allowed) return false;
    return this.submit(trade, 'NEWS_DEFENSIVE_EXIT', istHourBucket(now));
  }

  /**
   * Opportunistic entry (Phase 4.4): enter a PARTIAL position on a momentum
   * candidate with a strong breakout + positive news, pulling forward the
   * monthly entry. Sized at `newsMonitor.opportunisticPartialPct` of the slot.
   * Routes through RiskEngine + LiveTrader. Returns true when the entry filled.
   */
  opportunisticEntry(symbol: string, price: number, now: Date, reason: string): boolean {
    const full = this.sizeFor(symbol, price, this.topN);
    if (full <= 0) return false;
    const qty = Math.max(1, Math.floor((full * this.config.newsMonitor.opportunisticPartialPct) / 100));
    const trade: TradeRequest = {
      symbol,
      exchange: 'NSE',
      quantity: qty,
      direction: 'LONG',
      entryPrice: price,
      reason,
      ticketSize: qty * price,
      timestamp: now,
      product: 'CNC',
    };
    const decision = this.risk.evaluate(trade);
    if (!decision.allowed) return false;
    return this.submit(trade, 'NEWS_OPPORTUNISTIC_ENTRY', istHourBucket(now));
  }

  /**
   * Sizing: equal-weight against a FIXED denominator, optionally shrunk by the
   * advisor (A2) and the adaptation multiplier (F2), then capped by risk.
   *
   * Order matters: the LLM may suggest, adaptation may shrink, but the hard
   * caps are applied LAST so neither can breach them.
   */
  private quantityFor(symbol: string, price: number, slots: number = this.topN): number {
    const capital = this.risk.capitalSnapshot();

    // Equal-weight target, measured against a FIXED base.
    //
    // This used to be `capital.available / topN`. Because `available` is
    // recomputed from the ledger after every fill, each successive buy in a
    // rebalance was sized off a smaller base — a geometrically shrinking ladder
    // (66k, 56k, 46k, 39k, 32k, 27k) that deployed ~53% of capital instead of
    // the intended 80%, and left the 6th position at 40% the size of the first.
    // Worse, it was invisible: whenever the LLM report supplied an allocation
    // (computed once, against a fixed base) sizing was correct, so capital
    // efficiency silently depended on the LLM being up.
    const deployable =
      (this.config.risk.availableCapital *
        (100 - this.config.risk.minCashReservePct)) /
      100;
    const perNameTarget = deployable / Math.max(1, slots);

    // A2: the advisor may shrink a position; it may never inflate one past its
    // equal-weight slot (the locked authority model is tilt <= 1, shrink-only).
    this.loadReportBias();
    const suggested = this.reportBias.get(symbol)?.suggested_allocation_inr;
    let perSymbol =
      suggested && suggested > 0 ? Math.min(suggested, perNameTarget) : perNameTarget;

    // F2: shrink exposure when realized outcomes have deteriorated. This can
    // only ever reduce size, never raise it.
    if (this.adaptation) {
      perSymbol *= this.adaptation.riskMultiplier();
    }

    // Sentiment-regime switching: scale exposure by the AI report's regime_score.
    perSymbol *= this.currentRegimeMultiplier();

    // Shrink-not-block: in 'shrink' mode an AVOID name is allowed but sized down
    // to a fraction of its slot, so the AI can't fully miss a quiet winner.
    if (this.config.strategy.momentumVetoMode === 'shrink') {
      const bias = this.reportBiasFor(symbol);
      if (bias === 'AVOID') {
        perSymbol *= this.config.strategy.momentumVetoShrinkPct / 100;
      }
    }

    // Never propose more than is actually free right now.
    perSymbol = Math.min(perSymbol, capital.available);

    const qty = Math.floor(perSymbol / price);
    if (qty <= 0) return 0;

    // Clamp by EVERY hard cap the RiskEngine will test, not just one.
    //
    // Previously only the single-stock cap was applied. With the shipped config
    // (capital 500k, topN 4, single-stock 15%, max trade allocation 20k) that
    // produced a ~75k ticket which the RiskEngine then refused on
    // maxTradeAllocation — so every momentum entry was rejected and the bot
    // could never open a position. Sizing must respect the binding cap, not the
    // loosest one.
    const singleStockCap =
      (this.config.risk.availableCapital * this.config.risk.maxSingleStockPct) / 100;
    const hardCap = Math.min(singleStockCap, this.config.risk.maxTradeAllocation);
    const capQty = Math.floor(hardCap / price);
    // If even one share breaches the cap, propose nothing rather than a ticket
    // that is certain to be refused.
    if (capQty <= 0) return 0;
    return Math.min(qty, capQty);
  }

  /**
   * True when a symbol has an undiscounted binary event within the blackout
   * window (Phase 4.2, generalises B2). Used to block new entries AND to exit
   * held positions ahead of the event, so the book is never exposed to a coin
   * flip the price has not already reflected.
   *
   * Event types are driven by config.strategy.eventBlackoutTypes so new NSE
   * corporate action types (SPLIT, BONUS, RIGHTS_ISSUE, …) can be added via
   * EVENT_BLACKOUT_TYPES in .env without a code change.
   */
  private hasUpcomingEvent(symbol: string, now: Date): boolean {
    const action = this.liveData.corporateActionFor(symbol);
    if (!action) return false;
    const types = new Set(this.config.strategy.eventBlackoutTypes.map((t) => t.toUpperCase()));
    if (!types.has(action.type.toUpperCase())) return false;
    const days = Math.round((new Date(action.date + 'T00:00:00Z').getTime() - now.getTime()) / 86400000);
    return days >= 0 && days <= this.config.strategy.eventBlackoutDays;
  }

  /** Round-trip cost as a fraction of notional (mirrors PaperTrader). */
  private roundTripCostPct(): number {
    const c = this.config.costs;
    const brokerage = Math.min(c.brokerageBps / 10000, c.brokerageMax / 10000);
    const statutory = c.statutoryBps / 10000;
    const slippage = c.slippageBps / 10000;
    const gst = brokerage * c.gstPct / 100;
    return (brokerage + statutory + slippage + gst) * 2; // entry + exit
  }
}
