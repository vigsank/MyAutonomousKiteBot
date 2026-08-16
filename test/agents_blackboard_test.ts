/**
 * agents_blackboard_test.ts — regression tests for Phase G: the agent
 * blackboard and the momentum-originates / AI-filters authority model.
 *
 * What this locks down, and why each one is worth a test:
 *
 *  G1 Blackboard mechanics — reads of a missing/failed upstream must return
 *     `null`, never throw. An agent that cannot degrade takes down the pass.
 *  G2 Orchestrator publication — only a `done` agent publishes. A `failed`
 *     agent that published a half-built payload would silently poison every
 *     downstream decision, which is far worse than a skipped downstream.
 *  G3 No recompute — `sentiment` is the only agent that may touch the news
 *     engine. Before the blackboard, four agents each re-queried it for the
 *     same data on every pass.
 *  G4 Authority model — momentum ORIGINATES, AI FILTERS. The strategist must
 *     not be able to propose a symbol the momentum ranking did not produce,
 *     and `execute` must refuse a non-momentum originator even if one somehow
 *     reaches it.
 *  G5 Execution routing — the agentic path must go through LiveTrader so it
 *     inherits idempotency, the live gate and the reconciliation halt.
 *
 * Run:
 *   ENV_FILE=.env.test LOG_LEVEL=silent npx ts-node test/agents_blackboard_test.ts
 */
import { loadConfig, AppConfig } from '../src/server/AppConfig';
import { Ledger } from '../src/server/Ledger';
import { NewsSentimentEngine } from '../src/server/NewsSentimentEngine';
import { MomentumStrategy } from '../src/server/MomentumStrategy';
import { PaperTrader } from '../src/server/PaperTrader';
import { RiskEngine } from '../src/server/RiskEngine';
import { OrderGuard } from '../src/server/OrderGuard';
import { LiveTrader } from '../src/server/LiveTrader';
import { Blackboard, MomentumPayload, RegimePayload, ReportPayload } from '../src/agents/blackboard';
import { getRegistry } from '../src/agents/registry';
import { runPass } from '../src/agents/orchestrator';
import { AgentContext, AgentId, AgentResult, TradeProposal } from '../src/agents/types';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const SYMBOLS = ['AAA', 'BBB', 'CCC'];

function freshLedger(): Ledger {
  const l = new Ledger(':memory:');
  l.runMigrations();
  l.startSession('PAPER');
  return l;
}

/** Seed tradable instruments with a known last price. Tokens never collide. */
let nextToken = 900001;
function seedInstruments(ledger: Ledger, prices: Record<string, number>): void {
  for (const [symbol, price] of Object.entries(prices)) {
    const token = nextToken++;
    ledger.upsertInstrument({
      instrument_token: token,
      exchange_token: String(token),
      tradingsymbol: symbol,
      name: symbol,
      last_price: price,
      tick_size: 0.05,
      lot_size: 1,
      instrument_type: 'EQ',
      segment: 'NSE',
      exchange: 'NSE',
    } as any);
    ledger.updateLastPrice(token, price);
  }
}

/**
 * Stub news engine. Counts `sentimentFor` calls so we can prove the fleet
 * queries the news layer exactly once per symbol per pass.
 */
class StubNews {
  sentimentCalls = 0;
  constructor(
    private readonly scores: Record<string, number> = {},
    private readonly throwOnSentiment = false,
  ) {}
  async fetchArticles(): Promise<any[]> {
    return [];
  }
  async fetchTinyFishArticles(): Promise<any[]> {
    return [];
  }
  async fetchGoogleNewsArticles(): Promise<any[]> {
    return [];
  }
  async sentimentFor(symbol: string): Promise<{ score: number; label: string } | null> {
    this.sentimentCalls++;
    if (this.throwOnSentiment) throw new Error('news layer unavailable');
    const score = this.scores[symbol];
    if (score === undefined) return null;
    return { score, label: score > 0 ? 'bullish' : score < 0 ? 'bearish' : 'neutral' };
  }
}

/**
 * Stub momentum strategy — the fleet consumes `lastRanking()` and `sizeFor()`.
 * `sizeFor` returns a deliberately small, cap-safe size so execution tests
 * exercise the routing rather than the risk rejections (those have their own
 * coverage in risk_regression_test.ts).
 */
function stubMomentum(
  candidates: Array<{ symbol: string; momentum: number; inTarget: boolean }>,
  topN = 4,
  sizeShares = 20,
): MomentumStrategy {
  return {
    lastRanking: () => ({
      candidates,
      target: candidates.filter((c) => c.inTarget).map((c) => c.symbol),
      topN,
      computedAt: '2026-08-16T09:00:00.000Z',
    }),
    sizeFor: () => sizeShares,
  } as unknown as MomentumStrategy;
}

function makeCtx(over: Partial<AgentContext> & { ledger: Ledger; config: AppConfig }): AgentContext {
  return {
    news: new StubNews() as unknown as NewsSentimentEngine,
    symbols: SYMBOLS,
    passNumber: 1,
    now: new Date('2026-08-17T04:00:00Z'), // 09:30 IST
    blackboard: new Blackboard(),
    ...over,
  } as AgentContext;
}

/** Run a single registered agent against a context. */
async function runAgent(id: AgentId, ctx: AgentContext): Promise<AgentResult> {
  const agent = getRegistry().get(id);
  if (!agent) throw new Error(`agent ${id} is not registered`);
  return agent.run(ctx);
}

/** Seed a daily report row the `daily_report_context` agent can parse. */
function seedReport(ledger: Ledger, report: unknown): void {
  ledger.recordDailyReport({
    reportType: 'pre_open',
    reportDate: '2026-08-17',
    reportJson: JSON.stringify(report),
    summary: 'test report',
  });
}

/* ------------------------------------------------------------------ */
/* G1 — Blackboard mechanics                                           */
/* ------------------------------------------------------------------ */

function testBlackboardMechanics() {
  console.log('\n--- G1: blackboard mechanics ---');
  const bb = new Blackboard();

  assert(bb.read('sentiment') === null, 'unpublished id reads as null, not undefined');
  assert(bb.sentimentFor('AAA') === null, 'sentimentFor degrades to null with no sentiment');
  assert(bb.keys().length === 0, 'a fresh blackboard is empty');

  bb.publish('sentiment', undefined);
  assert(!bb.has('sentiment'), 'publishing undefined is a no-op (payload-less agent)');

  const sent = { count: 2, avg: 0.25, scores: { AAA: 0.5, BBB: 0 }, labels: {} };
  bb.publish('sentiment', sent);
  assert(bb.sentiment()?.avg === 0.25, 'typed accessor returns the published payload');
  assert(bb.sentimentFor('AAA') === 0.5, 'sentimentFor reads the published score');
  assert(bb.sentimentFor('ZZZ') === null, 'sentimentFor is null for an unscored symbol');
  assert(bb.sentimentFor('BBB') === 0, 'a genuine 0 score is not confused with "missing"');

  // Accessors must map to the right ids — a mis-mapped accessor would silently
  // read another agent's payload and typecheck fine.
  const mom: MomentumPayload = { candidates: [], target: [], topN: 4, computedAt: null };
  bb.publish('momentum_rank', mom);
  assert(bb.momentum()?.topN === 4, 'momentum() reads momentum_rank');
  assert(bb.breadth() === null, 'breadth() is unaffected by other publications');
}

/* ------------------------------------------------------------------ */
/* G2 + G3 — orchestrator publication and no-recompute                 */
/* ------------------------------------------------------------------ */

/** Agents that would hit the network; skipped so the pass is deterministic. */
const NETWORK_AGENTS: AgentId[] = ['news_feed', 'web_search_news'];

async function testPassPublication() {
  console.log('\n--- G2/G3: orchestrator publication + no recompute ---');
  const config = loadConfig();
  const ledger = freshLedger();
  seedInstruments(ledger, { AAA: 100, BBB: 200, CCC: 300 });

  const news = new StubNews({ AAA: 0.5, BBB: -0.5, CCC: 0.05 });
  const ctx = makeCtx({
    config,
    ledger,
    news: news as unknown as NewsSentimentEngine,
    momentum: stubMomentum([
      { symbol: 'AAA', momentum: 0.4, inTarget: true },
      { symbol: 'BBB', momentum: 0.3, inTarget: true },
    ]),
  });

  const results = await runPass(ctx, { skip: new Set(NETWORK_AGENTS) });
  const byId = new Map(results.map((r) => [r.id, r]));

  assert(byId.get('sentiment')?.status === 'done', 'sentiment ran');
  assert(
    news.sentimentCalls === SYMBOLS.length,
    `news layer queried once per symbol (${news.sentimentCalls} calls for ${SYMBOLS.length} symbols)`,
  );
  assert(ctx.blackboard.sentiment() !== null, 'sentiment payload reached the blackboard');
  assert(byId.get('sector_rotation')?.status === 'done', 'sector_rotation ran off the blackboard');
  assert(byId.get('market_breadth')?.status === 'done', 'market_breadth ran off the blackboard');

  const breadth = ctx.blackboard.breadth();
  // AAA bullish, BBB bearish, CCC neutral (|0.05| < 0.1) => (1-1)/3 = 0.
  assert(breadth?.total === 3 && breadth?.breadth === 0, 'breadth derives from the published scores');

  const rotation = ctx.blackboard.rotation();
  assert(
    !!rotation?.bullish.includes('AAA') && !!rotation?.bearish.includes('BBB'),
    'rotation buckets derive from the published scores',
  );

  ledger.close();
}

async function testFailedUpstreamPublishesNothing() {
  console.log('\n--- G2: a failed agent publishes nothing ---');
  const config = loadConfig();
  const ledger = freshLedger();
  seedInstruments(ledger, { AAA: 100, BBB: 200, CCC: 300 });

  // News layer is down: `sentiment` throws, so it must fail — and crucially,
  // must NOT leave a partial payload behind for downstream agents to trust.
  const news = new StubNews({}, true);
  const ctx = makeCtx({ config, ledger, news: news as unknown as NewsSentimentEngine });

  const results = await runPass(ctx, { skip: new Set(NETWORK_AGENTS) });
  const byId = new Map(results.map((r) => [r.id, r]));

  assert(byId.get('sentiment')?.status === 'failed', 'sentiment failed when the news layer threw');
  assert(ctx.blackboard.sentiment() === null, 'a failed agent leaves the blackboard clean');
  assert(
    byId.get('sector_rotation')?.status === 'skipped',
    'sector_rotation degrades to skipped rather than acting on nothing',
  );
  assert(
    byId.get('market_breadth')?.status === 'skipped',
    'market_breadth degrades to skipped rather than acting on nothing',
  );
  assert(
    results.every((r) => r.status !== 'running' && r.status !== 'idle'),
    'the pass still completes end-to-end with a dead upstream',
  );

  ledger.close();
}

async function testBlackboardIsFreshPerPass() {
  console.log('\n--- G2: blackboards do not leak across passes ---');
  const config = loadConfig();
  const ledger = freshLedger();
  seedInstruments(ledger, { AAA: 100, BBB: 200, CCC: 300 });

  const ctx1 = makeCtx({
    config,
    ledger,
    news: new StubNews({ AAA: 0.9, BBB: 0.9, CCC: 0.9 }) as unknown as NewsSentimentEngine,
  });
  await runPass(ctx1, { skip: new Set(NETWORK_AGENTS) });
  assert(ctx1.blackboard.breadth()?.label === 'risk-on', 'pass 1 reads risk-on');

  // A second pass with its own blackboard must not inherit pass 1's view —
  // stale reasoning is how a bot acts on a market that no longer exists.
  const ctx2 = makeCtx({
    config,
    ledger,
    passNumber: 2,
    news: new StubNews({ AAA: -0.9, BBB: -0.9, CCC: -0.9 }) as unknown as NewsSentimentEngine,
  });
  await runPass(ctx2, { skip: new Set(NETWORK_AGENTS) });
  assert(ctx2.blackboard.breadth()?.label === 'risk-off', 'pass 2 reads risk-off, not pass 1 state');

  ledger.close();
}

/* ------------------------------------------------------------------ */
/* G3b — the LLM report reaches the fleet                              */
/* ------------------------------------------------------------------ */

async function testReportContext() {
  console.log('\n--- G3: the daily report reaches the fleet ---');
  const config = loadConfig();
  const ledger = freshLedger();

  const noReport = await runAgent('daily_report_context', makeCtx({ config, ledger }));
  assert(noReport.status === 'skipped', 'no report yet => skipped, not failed');

  seedReport(ledger, {
    market_regime: { overall_sentiment: 'BULLISH_CONSTRUCTIVE', regime_score: 0.65 },
    capital_management: { recommended_cash_reserve_pct: 25 },
    portfolio_recommendations: [
      { symbol: 'AAA', action_bias: 'BUY_ACCUMULATE', suggested_allocation_inr: 150000 },
      { symbol: 'BBB', action_bias: 'AVOID' },
    ],
  });

  const ctx = makeCtx({ config, ledger });
  const r = await runAgent('daily_report_context', ctx);
  assert(r.status === 'done', 'report parsed');
  const payload = r.payload as ReportPayload;
  assert(payload.regimeScore === 0.65, 'regime score extracted');
  assert(payload.bias.AAA === 'BUY_ACCUMULATE' && payload.bias.BBB === 'AVOID', 'per-symbol bias extracted');
  assert(payload.suggestedAllocation.AAA === 150000, 'suggested allocation extracted (advisory only)');
  assert(payload.recommendedCashReservePct === 25, 'cash reserve extracted');

  // Malformed JSON must be reported, not silently treated as "no view".
  ledger.recordDailyReport({
    reportType: 'mid_session',
    reportDate: '2026-08-17',
    reportJson: '{not json',
  });
  const bad = await runAgent('daily_report_context', makeCtx({ config, ledger }));
  assert(bad.status === 'failed', 'unparseable report is failed, not silently empty');

  ledger.close();
}

/* ------------------------------------------------------------------ */
/* G4 — the authority model                                            */
/* ------------------------------------------------------------------ */

async function testScreenerUsesMomentum() {
  console.log('\n--- G4: screener shortlists from momentum, not the watchlist ---');
  const config = loadConfig();
  const ledger = freshLedger();

  // No momentum ranking on the blackboard => nothing to screen. The old
  // behaviour was `watchlist.slice(0, 5)`, i.e. a shortlist unrelated to signal.
  const empty = await runAgent('screener', makeCtx({ config, ledger }));
  assert(empty.status === 'skipped', 'no momentum ranking => screener skips');

  const ctx = makeCtx({ config, ledger });
  ctx.blackboard.publish('momentum_rank', {
    candidates: [
      { symbol: 'AAA', momentum: 0.4, inTarget: true },
      { symbol: 'BBB', momentum: 0.1, inTarget: false },
    ],
    target: ['AAA'],
    topN: 4,
    computedAt: null,
  } as MomentumPayload);

  const open = await runAgent('screener', ctx);
  const openList = (open.payload as { shortlist: string[] }).shortlist;
  assert(openList.join(',') === 'AAA,BBB', 'neutral posture screens the full momentum ranking');

  // Risk-off must tighten to existing targets, not reach for new names.
  const ctxOff = makeCtx({ config, ledger });
  ctxOff.blackboard.publish('momentum_rank', ctx.blackboard.momentum());
  ctxOff.blackboard.publish('regime', {
    posture: 'risk-off',
    breadth: -0.5,
    regimeScore: -0.5,
    avgSentiment: -0.5,
    notes: [],
  } as RegimePayload);
  const off = await runAgent('screener', ctxOff);
  const offList = (off.payload as { shortlist: string[] }).shortlist;
  assert(offList.join(',') === 'AAA', 'risk-off narrows the shortlist to current targets');

  ledger.close();
}

async function testStrategistCannotOriginate() {
  console.log('\n--- G4: the strategist cannot originate outside momentum ---');
  const config = loadConfig();
  const ledger = freshLedger();
  seedInstruments(ledger, { AAA: 100, BBB: 200, CCC: 300 });

  // ZZZ is wildly bullish on news but absent from the momentum ranking. It must
  // never become an executable proposal — only a shadow row.
  seedInstruments(ledger, { ZZZ: 50 });
  const ctx = makeCtx({
    config,
    ledger,
    symbols: [...SYMBOLS, 'ZZZ'],
    momentum: stubMomentum([{ symbol: 'AAA', momentum: 0.4, inTarget: true }]),
  });
  ctx.blackboard.publish('momentum_rank', ctx.momentum!.lastRanking());
  ctx.blackboard.publish('sentiment', {
    count: 4,
    avg: 0.5,
    scores: { AAA: 0.3, BBB: 0.1, CCC: 0.1, ZZZ: 0.95 },
    labels: {},
  });

  const r = await runAgent('strategist', ctx);
  const proposal = r.payload as TradeProposal | null;
  assert(proposal !== null && proposal.symbol === 'AAA', 'proposal comes from the momentum target');
  assert(proposal?.originator === 'MOMENTUM', 'executable proposals are always MOMENTUM-originated');

  const shadows = ledger.getAgentProposals(100, 'AI_COMPOSITE');
  assert(
    shadows.some((s) => s.symbol === 'ZZZ'),
    'the AI-originated idea is recorded as a shadow proposal',
  );
  assert(
    shadows.every((s) => s.executed === 0 && s.outcome === 'SHADOW'),
    'no shadow proposal is ever marked executed',
  );

  ledger.close();
}

async function testAiVetoAndTilt() {
  console.log('\n--- G4: AI vetoes and shrinks, never upsizes ---');
  const config = loadConfig();
  const ledger = freshLedger();
  seedInstruments(ledger, { AAA: 100, BBB: 200 });

  const ranking = [
    { symbol: 'AAA', momentum: 0.4, inTarget: true },
    { symbol: 'BBB', momentum: 0.3, inTarget: true },
  ];

  // 1. Report AVOID vetoes the top momentum name; the next one is taken.
  {
    const ctx = makeCtx({ config, ledger, symbols: ['AAA', 'BBB'], momentum: stubMomentum(ranking) });
    ctx.blackboard.publish('momentum_rank', ctx.momentum!.lastRanking());
    ctx.blackboard.publish('daily_report_context', {
      regimeScore: 0.2,
      overallSentiment: 'NEUTRAL',
      bias: { AAA: 'AVOID' },
      suggestedAllocation: {},
      recommendedCashReservePct: null,
      createdAt: '2026-08-17T03:30:00Z',
    } as ReportPayload);
    const r = await runAgent('strategist', ctx);
    const p = r.payload as TradeProposal | null;
    assert(p?.symbol === 'BBB', 'a report AVOID vetoes that candidate');
  }

  // 2. Strongly negative sentiment vetoes; every candidate vetoed => no trade.
  {
    const ctx = makeCtx({ config, ledger, symbols: ['AAA', 'BBB'], momentum: stubMomentum(ranking) });
    ctx.blackboard.publish('momentum_rank', ctx.momentum!.lastRanking());
    ctx.blackboard.publish('sentiment', {
      count: 2,
      avg: -0.8,
      scores: { AAA: -0.8, BBB: -0.8 },
      labels: {},
    });
    const r = await runAgent('strategist', ctx);
    assert(r.payload !== null && (r.payload as any).vetoes?.length === 2, 'strong negative news vetoes all candidates');
    assert(r.summary.includes('vetoed'), 'the veto is reported, not silent');
  }

  // 3. Tilt shrinks on soft-negative sentiment and never exceeds 1.
  {
    const ctxClean = makeCtx({ config, ledger, symbols: ['AAA'], momentum: stubMomentum([ranking[0]]) });
    ctxClean.blackboard.publish('momentum_rank', ctxClean.momentum!.lastRanking());
    const clean = (await runAgent('strategist', ctxClean)).payload as TradeProposal;

    const ctxSoft = makeCtx({ config, ledger, symbols: ['AAA'], momentum: stubMomentum([ranking[0]]) });
    ctxSoft.blackboard.publish('momentum_rank', ctxSoft.momentum!.lastRanking());
    ctxSoft.blackboard.publish('sentiment', { count: 1, avg: -0.1, scores: { AAA: -0.1 }, labels: {} });
    const soft = (await runAgent('strategist', ctxSoft)).payload as TradeProposal;

    assert(clean.aiTilt === 1, 'a clean read leaves size untouched (tilt 1)');
    assert(soft.aiTilt < 1 && soft.aiTilt > 0, `soft-negative news shrinks size (tilt ${soft.aiTilt})`);
    assert(soft.quantity < clean.quantity, 'the shrink actually reaches quantity');

    // A very bullish read must not be able to upsize beyond the untouched size.
    const ctxHot = makeCtx({ config, ledger, symbols: ['AAA'], momentum: stubMomentum([ranking[0]]) });
    ctxHot.blackboard.publish('momentum_rank', ctxHot.momentum!.lastRanking());
    ctxHot.blackboard.publish('sentiment', { count: 1, avg: 0.99, scores: { AAA: 0.99 }, labels: {} });
    ctxHot.blackboard.publish('daily_report_context', {
      regimeScore: 1,
      overallSentiment: 'VERY_BULLISH',
      bias: { AAA: 'BUY_ACCUMULATE' },
      suggestedAllocation: {},
      recommendedCashReservePct: null,
      createdAt: '2026-08-17T03:30:00Z',
    } as ReportPayload);
    const hot = (await runAgent('strategist', ctxHot)).payload as TradeProposal;
    assert(hot.aiTilt <= 1, 'the AI can never tilt above 1 (no AI-driven upsizing)');
    assert(hot.quantity <= clean.quantity, 'maximum bullishness cannot enlarge the position');
  }

  ledger.close();
}

/* ------------------------------------------------------------------ */
/* G5 — execution routing                                              */
/* ------------------------------------------------------------------ */

function makeLiveTrader(config: AppConfig, ledger: Ledger): { lt: LiveTrader; paper: PaperTrader } {
  const paper = new PaperTrader(config, ledger);
  const guard = new OrderGuard(ledger);
  const lt = new LiveTrader(config, ledger, paper, guard, null, null);
  return { lt, paper };
}

async function testExecuteRoutesThroughLiveTrader() {
  console.log('\n--- G5: execute routes through LiveTrader ---');
  const config = loadConfig();
  const ledger = freshLedger();
  seedInstruments(ledger, { AAA: 100 });

  const risk = new RiskEngine(config, ledger);
  const { lt } = makeLiveTrader(config, ledger);

  const ctx = makeCtx({
    config,
    ledger,
    symbols: ['AAA'],
    risk,
    liveTrader: lt,
    momentum: stubMomentum([{ symbol: 'AAA', momentum: 0.4, inTarget: true }]),
  });
  ctx.blackboard.publish('momentum_rank', ctx.momentum!.lastRanking());

  await runAgent('strategist', ctx);
  const first = await runAgent('execute', ctx);
  assert(first.status === 'done', `execute completed (${first.summary})`);
  assert(first.summary.includes('executed'), 'the order actually filled through LiveTrader');
  assert(ledger.getOpenPositions().length === 1, 'the fill opened exactly one position');

  const recorded = ledger.getAgentProposals(10, 'MOMENTUM');
  assert(recorded.length > 0, 'the executed proposal is recorded for later attribution');
  assert(recorded[0].executed === 1 && recorded[0].outcome === 'FILLED', 'the row records the fill');

  // Idempotency must reach the agentic path: the identical intent, replayed in
  // the same pass, must not become a second order.
  const replay = await runAgent('execute', ctx);
  assert(replay.status === 'skipped', `a replayed intent does not re-fire (${replay.summary})`);
  assert(
    ledger.getOpenPositions().length === 1,
    'the replay did not double the position',
  );

  ledger.close();
}

async function testExecuteRefusesAiOriginator() {
  console.log('\n--- G5: execute refuses a non-momentum originator ---');
  const config = loadConfig();
  const ledger = freshLedger();
  seedInstruments(ledger, { AAA: 100 });

  const risk = new RiskEngine(config, ledger);
  const { lt } = makeLiveTrader(config, ledger);

  // Build a legitimate momentum proposal first, then corrupt the originator in
  // the module-level hand-off. This simulates a future regression where some
  // other code path hands `execute` an AI-originated proposal.
  const ctx = makeCtx({
    config,
    ledger,
    symbols: ['AAA'],
    risk,
    liveTrader: lt,
    momentum: stubMomentum([{ symbol: 'AAA', momentum: 0.4, inTarget: true }]),
  });
  ctx.blackboard.publish('momentum_rank', ctx.momentum!.lastRanking());
  const proposal = (await runAgent('strategist', ctx)).payload as TradeProposal;
  proposal.originator = 'AI_COMPOSITE'; // mutates the object `execute` will read

  const r = await runAgent('execute', ctx);
  assert(r.status === 'skipped', 'an AI-originated proposal is refused, not executed');
  assert(r.summary.includes('AI_COMPOSITE'), 'the refusal names the offending originator');
  assert(
    ledger.getAgentProposals(10, 'AI_COMPOSITE').some((p) => p.executed === 0),
    'the refused proposal is still recorded as a shadow row',
  );
  assert(ledger.getOpenPositions().length === 0, 'no position was opened by the refused proposal');

  ledger.close();
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  testBlackboardMechanics();
  await testPassPublication();
  await testFailedUpstreamPublishesNothing();
  await testBlackboardIsFreshPerPass();
  await testReportContext();
  await testScreenerUsesMomentum();
  await testStrategistCannotOriginate();
  await testAiVetoAndTilt();
  await testExecuteRoutesThroughLiveTrader();
  await testExecuteRefusesAiOriginator();

  console.log(`\n${failures === 0 ? 'ALL AGENT/BLACKBOARD TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
