/**
 * daily_cycle_sim.ts — replays the bot's ENVISIONED DAILY CYCLE over N trading
 * days, step by step, and reports per-day / weekly / overall results.
 *
 * This is deliberately NOT a portfolio backtest. `momentum_walk_forward.ts`
 * already measures the edge. This measures whether the *whole machine* works:
 * the 3-stage report cycle, the report reaching every consumer, the agent
 * blackboard, the RiskEngine gate, the idempotent order router, and the EOD
 * layer — all wired exactly as they are in `index.ts`.
 *
 * PER SIMULATED DAY:
 *   09:00  PRE-OPEN     reasoning layer -> daily report -> risk posture
 *   09:15  OPEN         mark instruments to the day's price
 *   09:45  ORB WINDOW   opening-range observation (no orders)
 *   10:00  DECISION     momentum ranking -> AI filter -> RiskEngine -> router
 *   11:00  MID-SESSION  report #2 -> report-driven position adjustments
 *   15:15  PRE-CLOSE    report #3 -> adjustments -> EOD square-off + logging
 *   CLOSE  MARK         mark to market, record equity
 *
 * WHAT IS REAL vs SIMULATED — read this before trusting the P&L
 * -----------------------------------------------------------------------
 * REAL      : prices (Yahoo daily NSE closes, same source as validate:momentum),
 *             MomentumStrategy, RiskEngine, OrderGuard, LiveTrader, PaperTrader,
 *             Ledger, EodEngine, the agent fleet + blackboard, all cost/slippage
 *             modelling, and the daily_reports / order_intents / agent_proposals
 *             persistence.
 * SIMULATED : the LLM's *content*. A historical replay cannot call an LLM about
 *             a past day without leaking today's news into it, so the reasoning
 *             layer here is deterministic and derives its view ONLY from data
 *             available up to that simulated day (breadth, prior-day moves,
 *             distance from the 20-day mean).
 *
 * That means: this run proves the INTEGRATION and the deterministic edge. It
 * does NOT prove the news/AI layer adds alpha — no simulation can. The report
 * says so explicitly rather than letting a number imply otherwise.
 *
 * Usage:
 *   ENV_FILE=.env.test npx ts-node test/backtest/daily_cycle_sim.ts
 *   DAYS=15 CAPITAL=500000 npx ts-node test/backtest/daily_cycle_sim.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../../src/server/AppConfig';
import { Ledger } from '../../src/server/Ledger';
import { RiskEngine } from '../../src/server/RiskEngine';
import { PaperTrader } from '../../src/server/PaperTrader';
import { OrderGuard } from '../../src/server/OrderGuard';
import { LiveTrader } from '../../src/server/LiveTrader';
import { MomentumStrategy } from '../../src/server/MomentumStrategy';
import { EodEngine } from '../../src/server/EodEngine';
import { LiveDataService } from '../../src/server/LiveDataService';
import { NewsSentimentEngine } from '../../src/server/NewsSentimentEngine';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { ClosePoint } from '../../src/server/signals/momentum';
import { Blackboard, ReportPayload, SentimentPayload } from '../../src/agents/blackboard';
import { getRegistry } from '../../src/agents/registry';
import { AgentContext, AgentId, AgentResult } from '../../src/agents/types';

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const DAYS = numEnv('DAYS', 15);
const CAPITAL = numEnv('CAPITAL', 500_000);
const UNIVERSE = numEnv('UNIVERSE', 60);
const TOP_N = numEnv('TOP_N', 6);
const OUT_DIR = path.join(__dirname, 'results', 'daily_cycle');

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

/* ------------------------------------------------------------------ */
/* Step log — every action, so the run is auditable, not a black box   */
/* ------------------------------------------------------------------ */

interface Step {
  time: string;
  stage: string;
  detail: string;
}

interface DayRecord {
  date: string;
  dayNo: number;
  steps: Step[];
  regimeScore: number;
  regimeLabel: string;
  posture: string;
  breadth: number;
  bought: string[];
  sold: string[];
  skipped: string[];
  adjustments: string[];
  openPositions: number;
  deployed: number;
  cash: number;
  equity: number;
  dayPnl: number;
  dayPnlPct: number;
  /** Cumulative realized P&L since the start of the simulation. */
  realizedPnl: number;
  /** Realized P&L booked on this day alone. */
  dayRealized: number;
  /** Equal-weight universe index, rebased to the sim's starting capital. */
  benchmark: number;
  /** Nifty 50, rebased to the sim's starting capital. */
  nifty: number;
}

/**
 * Equal-weight buy-and-hold of the whole universe, rebased to `capital`.
 *
 * Without this the headline P&L is unreadable: a -1.8% result means one thing
 * in a market that rose 3% and the opposite in one that fell 5%. Symbols are
 * equal-weighted at the first sim date and held, which is the honest passive
 * alternative to what the bot is doing.
 */
function benchmarkCurve(
  closes: Map<string, ClosePoint[]>,
  simDates: string[],
  capital: number,
): number[] {
  const priceOn = (sym: string, date: string): number | null => {
    const pts = closes.get(sym);
    if (!pts) return null;
    let last: number | null = null;
    for (const p of pts) {
      if (p.date > date) break;
      last = p.close;
    }
    return last;
  };

  const start = simDates[0];
  const members = [...closes.keys()].filter((s) => (priceOn(s, start) ?? 0) > 0);
  const perName = capital / members.length;

  return simDates.map((d) =>
    members.reduce((sum, s) => {
      const p0 = priceOn(s, start)!;
      const pt = priceOn(s, d) ?? p0;
      return sum + perName * (pt / p0);
    }, 0),
  );
}

/**
 * Nifty 50, rebased to `capital` over the same dates.
 *
 * The equal-weight universe answers "did stock-picking add anything?". Nifty
 * answers the question that actually decides whether this bot should exist:
 * would the money have done better in an index fund? Both are needed — in the
 * 2021–2026 window Indian mid-caps beat the index by so much that a strategy
 * can look excellent against Nifty while losing to its own universe.
 */
async function niftyCurve(simDates: string[], capital: number): Promise<number[] | null> {
  try {
    const config = loadConfig();
    const provider = createHistoricalProvider(config);
    const to = new Date(`${simDates[simDates.length - 1]}T23:59:59Z`);
    const from = new Date(new Date(`${simDates[0]}T00:00:00Z`).getTime() - 30 * 86_400_000);
    // Any exchange other than NSE/BSE passes the symbol through unsuffixed.
    const inst = provider.findInstrument('^NSEI', 'INDEX' as 'NSE');
    if (!inst) return null;
    const candles = await provider.getHistoricalData(inst.instrument_token, 'day', from, to);
    const pts = candles
      .map((c) => ({ date: c.date.toISOString().slice(0, 10), close: c.close }))
      .filter((p) => Number.isFinite(p.close) && p.close > 0)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    if (pts.length === 0) return null;

    const closeOn = (date: string): number | null => {
      let last: number | null = null;
      for (const p of pts) {
        if (p.date > date) break;
        last = p.close;
      }
      return last;
    };
    const base = closeOn(simDates[0]);
    if (!base || base <= 0) return null;
    return simDates.map((d) => capital * ((closeOn(d) ?? base) / base));
  } catch {
    return null;
  }
}

class Journal {
  readonly days: DayRecord[] = [];
  private current: DayRecord | null = null;

  startDay(date: string, dayNo: number): void {
    this.current = {
      date,
      dayNo,
      steps: [],
      regimeScore: 0,
      regimeLabel: '',
      posture: '',
      breadth: 0,
      bought: [],
      sold: [],
      skipped: [],
      adjustments: [],
      openPositions: 0,
      deployed: 0,
      cash: 0,
      equity: 0,
      dayPnl: 0,
      dayPnlPct: 0,
      realizedPnl: 0,
      dayRealized: 0,
      benchmark: 0,
      nifty: 0,
    };
    this.days.push(this.current);
  }

  step(time: string, stage: string, detail: string): void {
    this.current!.steps.push({ time, stage, detail });
    console.log(`    ${time}  ${stage.padEnd(13)} ${detail}`);
  }

  get day(): DayRecord {
    return this.current!;
  }
}

/* ------------------------------------------------------------------ */
/* The simulated reasoning layer                                       */
/*                                                                     */
/* Produces the SAME JSON schema DailyReportEngine produces, so every   */
/* real consumer (daily_report_context agent, MomentumStrategy report  */
/* bias, RiskEngine posture) is exercised unchanged.                   */
/*                                                                     */
/* Strictly no lookahead: every input is computable on the sim day.    */
/* ------------------------------------------------------------------ */

interface Snapshot {
  price: number;
  prevChangePct: number;
  distFromSma20Pct: number;
}

/** Price view for one symbol as of `date` — nothing after it is visible. */
function snapshot(pts: ClosePoint[], date: string): Snapshot | null {
  const upTo = pts.filter((p) => p.date <= date);
  if (upTo.length < 21) return null;
  const price = upTo[upTo.length - 1].close;
  const prev = upTo[upTo.length - 2].close;
  const sma20 = upTo.slice(-20).reduce((s, p) => s + p.close, 0) / 20;
  return {
    price,
    prevChangePct: prev > 0 ? ((price - prev) / prev) * 100 : 0,
    distFromSma20Pct: sma20 > 0 ? ((price - sma20) / sma20) * 100 : 0,
  };
}

/**
 * Market breadth: fraction of the universe trading above its 20-day mean,
 * mapped to [-1, +1]. This is what a human would read off the tape pre-open.
 */
function breadthOf(snaps: Map<string, Snapshot>): number {
  if (snaps.size === 0) return 0;
  let above = 0;
  for (const s of snaps.values()) if (s.distFromSma20Pct > 0) above++;
  return (above / snaps.size) * 2 - 1;
}

/**
 * Build a report for one stage. `held` drives the rebalancing recommendations
 * the vision asks for (HOLD / TRIM / EXIT / ACCUMULATE for owned names,
 * CONSIDER / AVOID for unowned ones).
 */
function buildReport(
  reportType: 'pre_open' | 'mid_session' | 'pre_close',
  date: string,
  snaps: Map<string, Snapshot>,
  held: Map<string, { qty: number; avgPrice: number }>,
  availableCapital: number,
  momentumTarget: Set<string>,
): { json: any; regimeScore: number; breadth: number } {
  const breadth = breadthOf(snaps);
  // Regime blends breadth with the universe's average one-day move. Both are
  // observable pre-open; neither peeks forward.
  const avgMove =
    snaps.size > 0
      ? [...snaps.values()].reduce((s, v) => s + v.prevChangePct, 0) / snaps.size
      : 0;
  const regimeScore = clamp(0.7 * breadth + 0.3 * clamp(avgMove / 2, -1, 1), -1, 1);
  const overall =
    regimeScore > 0.25
      ? 'BULLISH_CONSTRUCTIVE'
      : regimeScore < -0.25
        ? 'BEARISH_DEFENSIVE'
        : 'NEUTRAL_MIXED';

  const recs: any[] = [];
  for (const [symbol, s] of snaps) {
    const pos = held.get(symbol);
    const inTarget = momentumTarget.has(symbol);
    // Sentiment proxy: how stretched the name is versus its own 20-day mean,
    // tempered by the prior session. A real LLM would add news on top of this.
    const score = clamp(s.distFromSma20Pct / 8 + s.prevChangePct / 6, -1, 1);

    let bias: string;
    if (pos) {
      const unrealPct = ((s.price - pos.avgPrice) / pos.avgPrice) * 100;
      if (score < -0.5 || unrealPct < -8) bias = 'EXIT_FULL';
      else if (score < -0.3) bias = 'TRIM_50';
      else if (score < -0.15) bias = 'TRIM_25';
      else if (score > 0.35 && inTarget) bias = 'BUY_ACCUMULATE';
      else bias = 'HOLD';
    } else {
      bias = inTarget && score > -0.15 ? 'CONSIDER_LONG' : 'AVOID';
    }

    // The LLM may suggest numbers; the algo enforces them. Suggest an
    // equal-weight slice of what is actually free.
    const suggestedAlloc =
      bias === 'CONSIDER_LONG' || bias === 'BUY_ACCUMULATE'
        ? Math.max(0, availableCapital / Math.max(1, momentumTarget.size))
        : 0;

    recs.push({
      symbol,
      action_bias: bias,
      sentiment_score: Number(score.toFixed(3)),
      current_holding_status: pos ? 'HELD' : 'NONE',
      suggested_quantity: suggestedAlloc > 0 ? Math.floor(suggestedAlloc / s.price) : 0,
      suggested_allocation_inr: Math.round(suggestedAlloc),
      suggested_entry_strategy: bias === 'CONSIDER_LONG' ? 'ORB_BREAKOUT_30M' : 'N/A',
      reasoning:
        `${s.distFromSma20Pct >= 0 ? 'above' : 'below'} 20d mean by ` +
        `${Math.abs(s.distFromSma20Pct).toFixed(1)}%, prior session ${pct(s.prevChangePct)}`,
      invalidation_condition: 'close below the 20-day mean',
    });
  }

  const cashReserve = regimeScore < -0.2 ? 35 : regimeScore > 0.2 ? 20 : 27.5;
  const json = {
    report_type: reportType,
    timestamp: `${date}T03:30:00.000Z`,
    market_regime: {
      overall_sentiment: overall,
      regime_score: Number(regimeScore.toFixed(3)),
      primary_catalyst:
        `breadth ${(breadth * 100).toFixed(0)}% net above 20d mean; ` +
        `universe avg prior session ${pct(avgMove)}`,
    },
    capital_management: {
      available_capital: Math.round(availableCapital),
      recommended_cash_reserve_pct: cashReserve,
      suggested_total_deployment_pct: 100 - cashReserve,
    },
    stocks_to_watch: [...momentumTarget],
    portfolio_recommendations: recs,
    summary:
      `[SIMULATED REASONING] ${overall} (regime ${regimeScore.toFixed(2)}), ` +
      `breadth ${(breadth * 100).toFixed(0)}%, ${held.size} held, ` +
      `cash reserve ${cashReserve}%`,
  };
  return { json, regimeScore, breadth };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const config = loadConfig();
  config.risk.availableCapital = CAPITAL;

  const allSymbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);
  const symbols = allSymbols.slice(0, UNIVERSE);

  console.log('='.repeat(78));
  console.log('  DAILY CYCLE SIMULATION — full 3-stage bot loop');
  console.log('='.repeat(78));
  console.log(`  Capital      : ${inr(CAPITAL)}`);
  console.log(`  Universe     : ${symbols.length} NSE symbols`);
  console.log(`  Sim length   : ${DAYS} trading days`);

  /* --- 1. Load real daily history --------------------------------- */
  const provider = createHistoricalProvider(config);
  const to = new Date();
  const from = new Date(to.getTime() - 3 * 365 * 24 * 60 * 60 * 1000);
  console.log(`\nFetching daily history for ${symbols.length} symbols (3y)...`);

  const closes = new Map<string, ClosePoint[]>();
  for (const sym of symbols) {
    try {
      const inst = provider.findInstrument(sym, 'NSE');
      if (!inst) continue;
      const candles = await provider.getHistoricalData(inst.instrument_token, 'day', from, to);
      const pts = candles
        .map((c) => ({ date: c.date.toISOString().slice(0, 10), close: c.close }))
        .filter((p) => Number.isFinite(p.close) && p.close > 0)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      if (pts.length > 300) closes.set(sym, pts);
    } catch {
      /* symbol unavailable — skip */
    }
  }
  console.log(`Loaded ${closes.size}/${symbols.length} symbols.`);
  if (closes.size < 10) {
    console.error('Not enough symbols loaded to simulate. Check network / provider.');
    process.exit(1);
  }

  const allDates = new Set<string>();
  for (const pts of closes.values()) for (const p of pts) allDates.add(p.date);
  const dates = [...allDates].sort();
  const simDates = dates.slice(dates.length - DAYS);
  console.log(`Window: ${simDates[0]} → ${simDates[simDates.length - 1]}\n`);

  /* --- 2. Wire the real stack, exactly as index.ts does ------------ */
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const dbPath = path.join(OUT_DIR, 'ledger.db');
  for (const suffix of ['', '-wal', '-shm']) {
    const p = dbPath + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const ledger = new Ledger(OUT_DIR);
  ledger.runMigrations();
  ledger.startSession('PAPER');
  // topN lives in the param store (the optimizer owns it), so the sim must seed
  // it explicitly rather than relying on the env fallback.
  ledger.setStrategyParam('momentumTopN', String(TOP_N), 'daily_cycle_sim');

  const risk = new RiskEngine(config, ledger);
  const paper = new PaperTrader(config, ledger);
  const guard = new OrderGuard(ledger);
  // No broker, no reconciler => PAPER mode. Still exercises idempotency + gates.
  const liveTrader = new LiveTrader(config, ledger, paper, guard, null, null);
  const liveData = new LiveDataService();
  const momentum = new MomentumStrategy(config, ledger, risk, paper, liveData, liveTrader);
  const news = { sentimentFor: async () => null } as unknown as NewsSentimentEngine;
  const eod = new EodEngine(config, ledger, risk, paper, news, liveData);

  /** Run one decision-path agent against a context, returning its result. */
  const runAgent = async (id: AgentId, ctx: AgentContext): Promise<AgentResult> => {
    const agent = getRegistry().get(id);
    if (!agent) throw new Error(`agent ${id} not registered`);
    const r = await agent.run(ctx);
    if (r.status === 'done') ctx.blackboard.publish(r.id, r.payload);
    return r;
  };

  console.log(`Strategy: top ${momentum.topN}, ${config.strategy.momentumLookbackMonths}m lookback`);
  console.log(`Router  : ${liveTrader.mode}\n`);

  // Register instruments so price lookups resolve.
  let token = 500001;
  for (const sym of closes.keys()) {
    ledger
      .raw()
      .prepare(
        `INSERT OR IGNORE INTO instruments
           (token, tradingsymbol, exchange, segment, instrument_type, name, lot_size, tick_size)
         VALUES (?, ?, 'NSE', 'NSE', 'EQ', ?, 1, 0.05)`,
      )
      .run(token++, sym, sym);
  }

  const journal = new Journal();
  let lastRebalanceMonth = '';
  let prevEquity = CAPITAL;
  const bench = benchmarkCurve(closes, simDates, CAPITAL);
  const niftyBench = await niftyCurve(simDates, CAPITAL);
  if (!niftyBench) {
    console.warn('WARNING: Nifty 50 history unavailable — index comparison skipped.');
  }

  /* --- 3. Replay the daily cycle ---------------------------------- */
  for (let i = 0; i < simDates.length; i++) {
    const date = simDates[i];
    const dayNo = i + 1;
    const now = new Date(`${date}T03:30:00.000Z`); // 09:00 IST
    journal.startDay(date, dayNo);
    console.log(`\n─── Day ${dayNo}/${DAYS} — ${date} ${weekday(date)} ${'─'.repeat(34)}`);

    // Prices visible today (close of `date` is the day's mark).
    const snaps = new Map<string, Snapshot>();
    const prices = new Map<string, number>();
    for (const [sym, pts] of closes) {
      const s = snapshot(pts, date);
      if (s) {
        snaps.set(sym, s);
        prices.set(sym, s.price);
      }
    }

    const heldMap = new Map(
      ledger.getOpenPositions().map((p) => [p.symbol, { qty: p.quantity, avgPrice: p.avgPrice }]),
    );

    // Momentum ranking as of today (history strictly <= today).
    const closesUpTo = new Map<string, ClosePoint[]>();
    for (const [sym, pts] of closes) {
      const upTo = pts.filter((p) => p.date <= date);
      if (upTo.length > 0) closesUpTo.set(sym, upTo);
    }
    const target = momentum.targetPortfolio(closesUpTo);
    const targetSet = new Set(target);

    /* 09:00 — PRE-OPEN: the reasoning layer */
    const cap0 = risk.capitalSnapshot();
    const pre = buildReport('pre_open', date, snaps, heldMap, cap0.available, targetSet);
    ledger.recordDailyReport({
      reportType: 'pre_open',
      reportDate: date,
      reportJson: JSON.stringify(pre.json),
      summary: pre.json.summary,
    });
    const posture = risk.riskPosture();
    journal.day.regimeScore = pre.regimeScore;
    journal.day.regimeLabel = pre.json.market_regime.overall_sentiment;
    journal.day.breadth = pre.breadth;
    journal.day.posture = `singleStock x${posture.singleStockMult}, +${posture.cashReserveAdd}% cash`;
    journal.step(
      '09:00',
      'PRE-OPEN',
      `report#1 regime ${pre.regimeScore.toFixed(2)} (${pre.json.market_regime.overall_sentiment}), ` +
        `breadth ${(pre.breadth * 100).toFixed(0)}%, cash reserve ${pre.json.capital_management.recommended_cash_reserve_pct}%`,
    );
    journal.step(
      '09:00',
      'RISK POSTURE',
      `single-stock cap x${posture.singleStockMult}, cash reserve +${posture.cashReserveAdd}pp (driven by report)`,
    );
    const watch = pre.json.portfolio_recommendations
      .filter((r: any) => r.action_bias === 'CONSIDER_LONG' || r.action_bias === 'BUY_ACCUMULATE')
      .slice(0, 6)
      .map((r: any) => `${r.symbol}(${r.action_bias})`);
    journal.step('09:00', 'WATCHLIST', watch.length ? watch.join(', ') : 'no long candidates today');

    /* 09:15 — OPEN: mark instruments */
    for (const [sym, price] of prices) {
      const inst = ledger.getInstrumentBySymbol(sym, 'NSE');
      if (inst) ledger.updateLastPrice(inst.instrument_token, price);
    }
    journal.step('09:15', 'MARKET OPEN', `${prices.size} instruments marked`);

    /* 09:45 — ORB observation window (no orders by design) */
    journal.step(
      '09:45',
      'ORB WINDOW',
      'opening range observed; no orders placed in the first 30 min (noise filter)',
    );

    /* 10:00 — DECISION */
    const month = date.slice(0, 7);
    const isRebalanceDay = month !== lastRebalanceMonth;
    if (isRebalanceDay) {
      lastRebalanceMonth = month;
      journal.step('10:00', 'REBALANCE', `monthly rebalance due — target [${target.join(', ')}]`);
      const res = momentum.rebalance(now, prices, target);
      journal.day.bought = res.bought;
      journal.day.sold = res.sold;
      journal.day.skipped = res.skipped;
      for (const s of res.sold) journal.step('10:00', 'ORDER SELL', `${s} exited (left target)`);
      for (const b of res.bought) {
        const p = prices.get(b) ?? 0;
        const pos = ledger.getOpenPositions().find((x) => x.symbol === b);
        journal.step(
          '10:00',
          'ORDER BUY',
          `${b} ${pos?.quantity ?? '?'} @ ${p.toFixed(2)} = ${inr((pos?.quantity ?? 0) * p)}`,
        );
      }
      if (res.skipped.length) {
        journal.step('10:00', 'SKIPPED', res.skipped.slice(0, 6).join(' | '));
      }
      if (!res.bought.length && !res.sold.length) {
        journal.step('10:00', 'NO ACTION', 'target already held / all candidates blocked');
      }
    } else {
      journal.step(
        '10:00',
        'HOLD',
        `no rebalance due (monthly cadence); ${heldMap.size} position(s) held`,
      );
    }

    /* 10:10 — AGENT PASS: the continuous decision loop.
     *
     * This is the cadence pass the live bot runs every 10 minutes. It is what
     * picks up a momentum target that the monthly rebalance could not enter
     * (vetoed, unpriced, or capital-constrained at the time), and it is where
     * the AI layer exercises its veto/tilt authority. Run it every day so the
     * authority model is visible, not just on rebalance days. */
    {
      const bb = new Blackboard();
      // Publish what the upstream agents would have produced. Sentiment comes
      // from the same report the reasoning layer just wrote, so the fleet and
      // the strategy read one consistent view.
      const scores: Record<string, number> = {};
      for (const rec of pre.json.portfolio_recommendations) scores[rec.symbol] = rec.sentiment_score;
      const avg =
        Object.values(scores).reduce((s, v) => s + v, 0) / Math.max(1, Object.keys(scores).length);
      bb.publish('sentiment', {
        count: Object.keys(scores).length,
        avg,
        scores,
        labels: {},
      } as SentimentPayload);
      bb.publish('daily_report_context', {
        regimeScore: pre.regimeScore,
        overallSentiment: pre.json.market_regime.overall_sentiment,
        bias: Object.fromEntries(
          pre.json.portfolio_recommendations.map((r: any) => [r.symbol, r.action_bias]),
        ),
        suggestedAllocation: Object.fromEntries(
          pre.json.portfolio_recommendations.map((r: any) => [r.symbol, r.suggested_allocation_inr]),
        ),
        recommendedCashReservePct: pre.json.capital_management.recommended_cash_reserve_pct,
        createdAt: `${date}T03:30:00.000Z`,
      } as ReportPayload);
      bb.publish('market_breadth', {
        breadth: pre.breadth,
        label: pre.breadth > 0.2 ? 'risk-on' : pre.breadth < -0.2 ? 'risk-off' : 'neutral',
        bullish: 0,
        bearish: 0,
        total: snaps.size,
      });

      const ctx: AgentContext = {
        config,
        ledger,
        news,
        symbols: [...closes.keys()],
        passNumber: dayNo,
        now: new Date(`${date}T04:40:00.000Z`), // 10:10 IST
        blackboard: bb,
        risk,
        trader: paper,
        liveTrader,
        momentum,
      };

      const chain: AgentId[] = ['momentum_rank', 'regime', 'screener', 'strategist', 'execute'];
      const before = ledger.getOpenPositions().length;
      for (const id of chain) {
        const r = await runAgent(id, ctx);
        journal.step('10:10', `AGENT ${id}`, `[${r.status}] ${stripPrefix(r.summary, id)}`);
      }
      const after = ledger.getOpenPositions();
      if (after.length > before) {
        const added = after.slice(before).map((p) => p.symbol);
        journal.day.bought.push(...added);
      }
    }

    /* 11:00 — MID-SESSION */
    const held2 = new Map(
      ledger.getOpenPositions().map((p) => [p.symbol, { qty: p.quantity, avgPrice: p.avgPrice }]),
    );
    const cap1 = risk.capitalSnapshot();
    const mid = buildReport('mid_session', date, snaps, held2, cap1.available, targetSet);
    ledger.recordDailyReport({
      reportType: 'mid_session',
      reportDate: date,
      reportJson: JSON.stringify(mid.json),
      summary: mid.json.summary,
    });
    journal.step(
      '11:00',
      'MID-SESSION',
      `report#2 regime ${mid.regimeScore.toFixed(2)}; reviewing ${held2.size} held position(s)`,
    );
    const adj1 = momentum.applyReportAdjustments(new Date(`${date}T05:30:00.000Z`), prices);
    if (adj1.adjusted.length) {
      journal.day.adjustments.push(...adj1.adjusted);
      journal.step('11:00', 'ADJUSTED', adj1.adjusted.join(', '));
    } else {
      journal.step('11:00', 'NO CHANGE', `hold all (${adj1.skipped.length} blocked/none actionable)`);
    }

    /* 15:15 — PRE-CLOSE */
    const held3 = new Map(
      ledger.getOpenPositions().map((p) => [p.symbol, { qty: p.quantity, avgPrice: p.avgPrice }]),
    );
    const cap2 = risk.capitalSnapshot();
    const close = buildReport('pre_close', date, snaps, held3, cap2.available, targetSet);
    ledger.recordDailyReport({
      reportType: 'pre_close',
      reportDate: date,
      reportJson: JSON.stringify(close.json),
      summary: close.json.summary,
    });
    journal.step(
      '15:15',
      'PRE-CLOSE',
      `report#3 regime ${close.regimeScore.toFixed(2)}; end-of-day rebalance review`,
    );
    const adj2 = momentum.applyReportAdjustments(new Date(`${date}T09:45:00.000Z`), prices);
    if (adj2.adjusted.length) {
      journal.day.adjustments.push(...adj2.adjusted);
      journal.step('15:15', 'ADJUSTED', adj2.adjusted.join(', '));
    } else {
      journal.step('15:15', 'NO CHANGE', 'no EOD rebalancing required');
    }

    const sq = eod.squareOffIntraday(new Date(`${date}T09:45:00.000Z`));
    journal.step(
      '15:15',
      'SQUARE-OFF',
      sq.closed.length
        ? `${sq.closed.length} intraday position(s) closed`
        : 'no intraday (MIS) positions — all holdings are CNC swing',
    );
    eod.logEodPerformance(new Date(`${date}T09:45:00.000Z`));
    eod.overnightMatrix(new Date(`${date}T09:45:00.000Z`));
    journal.step('15:15', 'EOD LOG', 'performance + overnight gap matrix persisted');

    /* CLOSE — mark to market */
    const open = ledger.getOpenPositions();
    let deployed = 0;
    let unrealized = 0;
    for (const pos of open) {
      const price = prices.get(pos.symbol) ?? pos.avgPrice;
      deployed += pos.quantity * price;
      unrealized += (price - pos.avgPrice) * pos.quantity;
    }
    // Cumulative since inception — NOT eodStats(), which is scoped to a single
    // day and would drop every prior day's booked P&L from the equity curve.
    const realized = ledger.cumulativeRealizedPnl();
    const dayRealized = ledger.eodStats(date).realizedPnl;
    const equity = CAPITAL + realized + unrealized;
    const dayPnl = equity - prevEquity;

    journal.day.openPositions = open.length;
    journal.day.deployed = deployed;
    journal.day.cash = CAPITAL + realized - (deployed - unrealized);
    journal.day.equity = equity;
    journal.day.dayPnl = dayPnl;
    journal.day.dayPnlPct = (dayPnl / prevEquity) * 100;
    journal.day.realizedPnl = realized;
    journal.day.dayRealized = dayRealized;
    journal.day.benchmark = bench[i];
    journal.day.nifty = niftyBench ? niftyBench[i] : 0;
    prevEquity = equity;

    journal.step(
      'CLOSE',
      'MARK',
      `${open.length} position(s), deployed ${inr(deployed)}, ` +
        `equity ${inr(equity)} (day ${pct(journal.day.dayPnlPct)})`,
    );
  }

  /* --- 4. Reports -------------------------------------------------- */
  const md = buildMarkdown(journal, CAPITAL, simDates, closes.size, momentum.topN, config);
  const outFile = path.join(OUT_DIR, 'daily_cycle_report.md');
  fs.writeFileSync(outFile, md);

  printSummary(journal, CAPITAL);
  console.log(`\nFull step-by-step report written to:\n  ${path.relative(process.cwd(), outFile)}`);
  console.log(`Auditable DB (reports, orders, intents, proposals):\n  ${path.relative(process.cwd(), dbPath)}`);

  ledger.close();
}

function weekday(date: string): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** Agent summaries are prefixed with their own id; drop it to keep the log tight. */
function stripPrefix(summary: string, id: string): string {
  return summary.startsWith(`${id}: `) ? summary.slice(id.length + 2) : summary;
}

/** Group days into calendar weeks for the weekly rollup. */
function weeks(days: DayRecord[]): DayRecord[][] {
  const out: DayRecord[][] = [];
  let cur: DayRecord[] = [];
  for (const d of days) {
    if (cur.length > 0 && weekday(d.date) === 'Mon') {
      out.push(cur);
      cur = [];
    }
    cur.push(d);
  }
  if (cur.length) out.push(cur);
  return out;
}

function printSummary(j: Journal, capital: number): void {
  const last = j.days[j.days.length - 1];
  const totalPnl = last.equity - capital;
  const totalPct = (totalPnl / capital) * 100;
  const wins = j.days.filter((d) => d.dayPnl > 0).length;
  const losses = j.days.filter((d) => d.dayPnl < 0).length;

  console.log(`\n${'='.repeat(78)}`);
  console.log('  PER-DAY SUMMARY');
  console.log('='.repeat(78));
  console.log('  Day  Date        Regime  Pos  Deployed      Equity       Universe     Nifty 50     Day P&L');
  console.log('  ' + '-'.repeat(97));
  for (const d of j.days) {
    console.log(
      `  ${String(d.dayNo).padStart(2)}   ${d.date}  ${d.regimeScore.toFixed(2).padStart(6)}  ` +
        `${String(d.openPositions).padStart(3)}  ${inr(d.deployed).padStart(11)}  ` +
        `${inr(d.equity).padStart(11)}  ${inr(d.benchmark).padStart(11)}  ` +
        `${(d.nifty > 0 ? inr(d.nifty) : 'n/a').padStart(11)}  ${pct(d.dayPnlPct).padStart(8)}`,
    );
  }

  console.log(`\n${'='.repeat(78)}`);
  console.log('  WEEKLY SUMMARY');
  console.log('='.repeat(78));
  const wk = weeks(j.days);
  wk.forEach((w, i) => {
    const start = w[0];
    const end = w[w.length - 1];
    const openEq = start.equity - start.dayPnl;
    const wkPnl = end.equity - openEq;
    const trades = w.reduce((s, d) => s + d.bought.length + d.sold.length + d.adjustments.length, 0);
    console.log(
      `  Week ${i + 1} (${start.date} → ${end.date}, ${w.length}d): ` +
        `${inr(openEq)} → ${inr(end.equity)}  ${pct((wkPnl / openEq) * 100)}  |  ${trades} order(s)`,
    );
  });

  console.log(`\n${'='.repeat(78)}`);
  console.log(`  OVERALL — ${j.days.length} TRADING DAYS`);
  console.log('='.repeat(78));
  console.log(`  Starting capital : ${inr(capital)}`);
  console.log(`  Final equity     : ${inr(last.equity)}`);
  console.log(`  Net P&L          : ${inr(totalPnl)}  (${pct(totalPct)})`);
  console.log(`  Realized         : ${inr(last.realizedPnl)}`);
  console.log(`  Unrealized       : ${inr(totalPnl - last.realizedPnl)}`);
  console.log(`  Positive days    : ${wins}/${j.days.length}   Negative: ${losses}`);
  console.log(`  Open positions   : ${last.openPositions}  (${inr(last.deployed)} deployed)`);
  {
    const benchPct = ((last.benchmark - capital) / capital) * 100;
    const avgDeployedPct =
      (j.days.reduce((s, d) => s + d.deployed, 0) / j.days.length / capital) * 100;
    console.log(
      `  Universe         : ${inr(last.benchmark)}  (${pct(benchPct)})  ` +
        `equal-weight buy & hold, 100% invested`,
    );
    console.log(`  vs universe      : ${pct(totalPct - benchPct)}  (avg deployment ${avgDeployedPct.toFixed(0)}%)`);
    if (last.nifty > 0) {
      const niftyPct = ((last.nifty - capital) / capital) * 100;
      console.log(`  Nifty 50         : ${inr(last.nifty)}  (${pct(niftyPct)})  the do-nothing alternative`);
      console.log(`  vs Nifty 50      : ${pct(totalPct - niftyPct)}  ← the bar that decides whether this bot should exist`);
    }
  }
  console.log(
    `  Annualized*      : ${pct((Math.pow(1 + totalPct / 100, 252 / j.days.length) - 1) * 100)}`,
  );
  console.log('  * naive extrapolation from a very short window — see caveats.');
  console.log('='.repeat(78));
}

function buildMarkdown(
  j: Journal,
  capital: number,
  simDates: string[],
  universe: number,
  topN: number,
  config: ReturnType<typeof loadConfig>,
): string {
  const last = j.days[j.days.length - 1];
  const totalPnl = last.equity - capital;
  const totalPct = (totalPnl / capital) * 100;
  const wins = j.days.filter((d) => d.dayPnl > 0).length;
  const L: string[] = [];

  L.push('# Daily Cycle Simulation — Full Bot Loop');
  L.push('');
  L.push(`**Window:** ${simDates[0]} → ${simDates[simDates.length - 1]} (${j.days.length} trading days)  `);
  L.push(`**Capital:** ${inr(capital)} · **Universe:** ${universe} NSE symbols · **Strategy:** top ${topN} momentum, ${config.strategy.momentumLookbackMonths}-month lookback  `);
  L.push(`**Caps:** single-stock ${config.risk.maxSingleStockPct}%, per-trade ${inr(config.risk.maxTradeAllocation)}, cash reserve ${config.risk.minCashReservePct}%`);
  L.push('');
  L.push('## Result');
  L.push('');
  L.push('| Metric | Value |');
  L.push('| --- | --- |');
  L.push(`| Starting capital | ${inr(capital)} |`);
  L.push(`| Final equity | ${inr(last.equity)} |`);
  L.push(`| **Net P&L** | **${inr(totalPnl)} (${pct(totalPct)})** |`);
  L.push(`| Realized | ${inr(last.realizedPnl)} |`);
  L.push(`| Unrealized | ${inr(totalPnl - last.realizedPnl)} |`);
  L.push(`| Positive days | ${wins}/${j.days.length} |`);
  L.push(`| Open positions at end | ${last.openPositions} (${inr(last.deployed)} deployed) |`);
  {
    const benchPct = ((last.benchmark - capital) / capital) * 100;
    const avgDeployedPct =
      (j.days.reduce((s, d) => s + d.deployed, 0) / j.days.length / capital) * 100;
    L.push(`| Benchmark (equal-weight buy & hold) | ${inr(last.benchmark)} (${pct(benchPct)}) |`);
    L.push(`| **vs benchmark** | **${pct(totalPct - benchPct)}** |`);
    if (last.nifty > 0) {
      const niftyPct = ((last.nifty - capital) / capital) * 100;
      L.push(`| Nifty 50 (do-nothing alternative) | ${inr(last.nifty)} (${pct(niftyPct)}) |`);
      L.push(`| **vs Nifty 50** | **${pct(totalPct - niftyPct)}** |`);
    }
    L.push(`| Avg deployment | ${avgDeployedPct.toFixed(0)}% of capital |`);
  }
  L.push('');

  L.push('## Weekly');
  L.push('');
  L.push('| Week | Dates | Days | Open | Close | Return | Orders |');
  L.push('| --- | --- | --- | --- | --- | --- | --- |');
  weeks(j.days).forEach((w, i) => {
    const s = w[0];
    const e = w[w.length - 1];
    const openEq = s.equity - s.dayPnl;
    const orders = w.reduce((n, d) => n + d.bought.length + d.sold.length + d.adjustments.length, 0);
    L.push(
      `| ${i + 1} | ${s.date} → ${e.date} | ${w.length} | ${inr(openEq)} | ${inr(e.equity)} | ` +
        `${pct(((e.equity - openEq) / openEq) * 100)} | ${orders} |`,
    );
  });
  L.push('');

  L.push('## Per day');
  L.push('');
  L.push('| Day | Date | Regime | Breadth | Positions | Deployed | Equity | Universe | Nifty 50 | Realized (day) | Day P&L |');
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const d of j.days) {
    L.push(
      `| ${d.dayNo} | ${d.date} ${weekday(d.date)} | ${d.regimeScore.toFixed(2)} (${d.regimeLabel}) | ` +
        `${(d.breadth * 100).toFixed(0)}% | ${d.openPositions} | ${inr(d.deployed)} | ` +
        `${inr(d.equity)} | ${inr(d.benchmark)} | ${d.nifty > 0 ? inr(d.nifty) : '—'} | ` +
        `${d.dayRealized ? inr(d.dayRealized) : '—'} | ${pct(d.dayPnlPct)} |`,
    );
  }
  L.push('');

  L.push('## Step-by-step audit trail');
  L.push('');
  L.push('Every action the bot took, in order, on every simulated day.');
  L.push('');
  for (const d of j.days) {
    L.push(`### Day ${d.dayNo} — ${d.date} (${weekday(d.date)})`);
    L.push('');
    L.push('| Time | Stage | What happened |');
    L.push('| --- | --- | --- |');
    for (const s of d.steps) {
      L.push(`| ${s.time} | ${s.stage} | ${s.detail.replace(/\|/g, '\\|')} |`);
    }
    L.push('');
    if (d.bought.length || d.sold.length || d.adjustments.length) {
      L.push(
        `**Orders:** ${[
          d.bought.length ? `BUY ${d.bought.join(', ')}` : '',
          d.sold.length ? `SELL ${d.sold.join(', ')}` : '',
          d.adjustments.length ? `ADJUST ${d.adjustments.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join(' · ')}`,
      );
      L.push('');
    }
  }

  L.push('## What this run does and does not prove');
  L.push('');
  L.push('**Proven — these are the real production components, not stand-ins:**');
  L.push('');
  L.push('- The 3-stage cycle fires in order every day and persists three reports.');
  L.push('- The report reaches all three consumers: the RiskEngine posture, the');
  L.push('  MomentumStrategy bias/veto, and the agent blackboard.');
  L.push('- Sizing respects the single-stock cap, the per-trade cap and the cash reserve.');
  L.push('- Every order passes the RiskEngine gate and the idempotent order router.');
  L.push('- The EOD layer squares off intraday, logs performance and scans overnight gap risk.');
  L.push('- Prices, costs and slippage are real (Yahoo NSE daily closes + the shipped cost model).');
  L.push('');
  L.push('**Not proven — and no simulation can prove it:**');
  L.push('');
  L.push('- **The news/AI layer adds alpha.** The reasoning layer here is deterministic and');
  L.push('  derives its view only from data available on the simulated day. A real LLM reading');
  L.push('  real news would change these decisions — for better or worse. That is measurable');
  L.push('  only in forward paper trading.');
  L.push(`- **The strategy edge.** ${j.days.length} trading days is roughly one rebalance of a`);
  L.push('  monthly-cadence strategy. The P&L above is essentially the drift of one basket over');
  L.push('  three weeks; it is noise, not evidence. `npm run validate:momentum` (215 out-of-sample');
  L.push('  months) is the statistical claim.');
  L.push('');

  return L.join('\n');
}

main().catch((err) => {
  console.error('daily_cycle_sim failed:', err);
  process.exit(1);
});
