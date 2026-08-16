/**
 * risk_regression_test.ts — regression tests for the RiskEngine fixes made
 * during the review (Initiative 7). Run:
 *   ENV_FILE=.env.test npx ts-node test/risk_regression_test.ts
 */
import { loadConfig, AppConfig } from '../src/server/AppConfig';
import { Ledger } from '../src/server/Ledger';
import { RiskEngine } from '../src/server/RiskEngine';
import { PaperTrader } from '../src/server/PaperTrader';
import { LiveDataService, CorporateAction } from '../src/server/LiveDataService';
import { MomentumStrategy } from '../src/server/MomentumStrategy';
import { TradeRequest } from '../src/server/types';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

function main() {
  const config = loadConfig();
  config.risk.availableCapital = 100_000;
  config.risk.maxSingleStockPct = 50; // isolate riskAtStop (single-stock cap won't interfere)
  config.risk.minCashReservePct = 20;
  config.risk.maxRiskPerTradePct = 1.5;
  config.risk.maxTradeAllocation = 100_000;
  config.risk.maxPortfolioDrawdownPct = 10;
  config.risk.maxMonthlyDrawdownPct = 2;
  config.strategy.stopLossPercent = 4;

  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  const risk = new RiskEngine(config, ledger);

  const mk = (ticketSize: number, stopDistance?: number): TradeRequest => ({
    symbol: 'TEST', exchange: 'NSE', quantity: Math.round(ticketSize / 100),
    direction: 'LONG', entryPrice: 100, reason: 'test', ticketSize,
    timestamp: new Date(), stopDistance,
  });

  // 1. riskAtStop uses the ACTUAL stop distance, not the fixed stopLossPercent.
  //    A 40k ticket with a 1% stop (stopDistance=1) risks 400, well under the
  //    1.5% cap (1500). With the OLD fixed-4% logic it would risk 1600 and block.
  const tightStop = risk.evaluate(mk(40_000, 1));
  assert(tightStop.allowed, 'riskAtStop uses actual stopDistance (40k @ 1% stop allowed)');

  // 2. Without stopDistance, falls back to stopLossPercent (4%): 40k risks 1600 > 1500.
  const noStop = risk.evaluate(mk(40_000));
  assert(!noStop.allowed, 'riskAtStop falls back to stopLossPercent (40k @ 4% blocked)');

  // 3. Single-stock cap: 50% of 100k = 50k. 60k ticket blocked.
  const singleStock = risk.evaluate(mk(60_000));
  assert(!singleStock.allowed, 'single-stock cap blocks 60k (>50k)');

  // 4. Monthly drawdown guard: a large realized loss this month halts trading.
  ledger.raw()
    .prepare(`INSERT INTO instruments (token, tradingsymbol, exchange, segment, instrument_type, name, lot_size, tick_size)
              VALUES (?, ?, 'NSE', 'NSE', 'EQ', ?, 1, 0.05)`)
    .run(9001, 'LOSS', 'LOSS');
  const instId = (ledger.raw().prepare(`SELECT instrument_id FROM instruments WHERE token = 9001`).get() as any).instrument_id;
  ledger.raw()
    .prepare(`INSERT INTO trades (trade_id, instrument_id, direction, quantity, price, ticket_size, pnl, status, reason, created_at)
              VALUES (?, ?, 'LONG', 1, 100, 100, ?, 'FILLED', 'test', ?)`)
    .run('T1', instId, -3_000, new Date().toISOString()); // -3% of 100k this month
  const monthly = risk.evaluate(mk(5_000, 1));
  assert(!monthly.allowed, 'monthly drawdown guard blocks trade (-3% > 2%)');
  assert(monthly.reasons.some((r) => r.includes('Monthly drawdown')), 'reason mentions monthly drawdown');

  ledger.close();
  testSizingRespectsEveryCap();
  testDeploymentDoesNotDecay();
  testVetoedSlotsAreRedistributed();
  testEventBlackout();

  console.log(failures === 0 ? '\nALL RISK REGRESSION TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

/**
 * The strategy must never propose a ticket the RiskEngine is certain to refuse.
 *
 * This exists because it once did, silently, in production. `quantityFor` capped
 * by the single-stock cap only, so with the shipped config (capital 500k, topN 4,
 * single-stock 15%, MAX_TRADE_ALLOCATION 20k) it sized a ~75k ticket that the
 * RiskEngine then rejected on the per-trade cap — every single time. The bot ran
 * cleanly, logged nothing unusual, and could never open a position.
 *
 * The invariant is deliberately stated as a property over a grid rather than one
 * example: whichever cap happens to bind, sizing must respect it, or return 0.
 */
function testSizingRespectsEveryCap() {
  console.log('\n--- sizing must respect whichever cap binds ---');

  // Grids chosen so the binding constraint differs across cases: per-trade cap
  // tightest, single-stock cap tightest, and both loose.
  const cases = [
    { capital: 500_000, maxTrade: 20_000, singlePct: 15, topN: 4, price: 1_500, binding: 'MAX_TRADE_ALLOCATION' },
    { capital: 500_000, maxTrade: 200_000, singlePct: 15, topN: 4, price: 1_500, binding: 'MAX_SINGLE_STOCK_PCT' },
    { capital: 1_000_000, maxTrade: 500_000, singlePct: 50, topN: 4, price: 900, binding: 'equal-weight slice' },
    { capital: 50_000, maxTrade: 20_000, singlePct: 15, topN: 6, price: 2_400, binding: 'price > cap' },
  ];

  for (const c of cases) {
    const config = loadConfig();
    config.risk.availableCapital = c.capital;
    config.risk.maxTradeAllocation = c.maxTrade;
    config.risk.maxSingleStockPct = c.singlePct;
    config.risk.minCashReservePct = 20;
    config.risk.maxPositionWeightPct = 100; // isolate the caps under test
    config.risk.maxRiskPerTradePct = 100;
    config.risk.maxSectorWeightPct = 100;
    config.strategy.momentumTopN = c.topN;

    const ledger = new Ledger(':memory:');
    ledger.runMigrations();
    ledger.startSession('PAPER');
    const risk = new RiskEngine(config, ledger);
    // Only `config`, `ledger` and `risk` participate in sizing; the execution
    // collaborators are deliberately absent so this stays a sizing test.
    const strategy = new MomentumStrategy(config, ledger, risk, null as any, null as any);

    const qty = strategy.sizeFor('TEST', c.price);
    const ticket = qty * c.price;
    const singleStockCap = (c.capital * c.singlePct) / 100;
    const hardCap = Math.min(singleStockCap, c.maxTrade);

    assert(
      qty === 0 || ticket <= hardCap,
      `[${c.binding}] sized ticket ${Math.round(ticket)} is within the binding cap ${Math.round(hardCap)}`,
    );

    if (qty > 0) {
      const decision = risk.evaluate({
        symbol: 'TEST',
        exchange: 'NSE',
        quantity: qty,
        direction: 'LONG',
        entryPrice: c.price,
        reason: 'sizing test',
        ticketSize: ticket,
        timestamp: new Date(),
        stopDistance: 1,
      } as TradeRequest);
      assert(
        decision.allowed,
        `[${c.binding}] the RiskEngine accepts what the strategy sized` +
          (decision.allowed ? '' : ` — ${decision.reasons.join('; ')}`),
      );
    }

    ledger.close();
  }

  // A price above every cap must yield 0, not a forced single share. Rounding a
  // refused trade up to one lot is how a "hard" cap quietly becomes advisory.
  {
    const config = loadConfig();
    config.risk.availableCapital = 100_000;
    config.risk.maxTradeAllocation = 5_000;
    config.risk.maxSingleStockPct = 15;
    const ledger = new Ledger(':memory:');
    ledger.runMigrations();
    ledger.startSession('PAPER');
    const risk = new RiskEngine(config, ledger);
    const strategy = new MomentumStrategy(config, ledger, risk, null as any, null as any);
    assert(
      strategy.sizeFor('PRICEY', 9_000) === 0,
      'a share priced above every cap sizes to 0, not a forced 1',
    );
    ledger.close();
  }
}

/**
 * Deployment must not decay as a rebalance proceeds.
 *
 * `quantityFor` used to size each name as `capital.available / topN`. Because
 * `available` is recomputed from the ledger after every fill, successive buys in
 * one rebalance shrank geometrically (66k, 56k, 46k, 39k, 32k, 27k), deploying
 * ~53% of capital instead of the intended 80% and leaving the last position at
 * 40% the size of the first.
 *
 * It was invisible in normal operation: when the LLM report supplied an
 * allocation (computed once against a fixed base) sizing was correct, so
 * capital efficiency silently depended on the LLM being up.
 *
 * The invariant is stated over the whole rebalance rather than one ticket:
 * equal weight means equal, and the book must actually get invested.
 */
function testDeploymentDoesNotDecay() {
  console.log('\n--- sizing must not shrink as capital is consumed ---');

  const CAPITAL = 500_000;
  const TOP_N = 6;
  const RESERVE_PCT = 20;

  const config = loadConfig();
  config.risk.availableCapital = CAPITAL;
  config.risk.minCashReservePct = RESERVE_PCT;
  config.risk.maxSingleStockPct = 15;
  config.risk.maxTradeAllocation = 100_000;
  config.risk.maxPositionWeightPct = 100;
  config.risk.maxRiskPerTradePct = 100;
  config.risk.maxSectorWeightPct = 100;
  config.strategy.momentumTopN = TOP_N;

  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  ledger.startSession('PAPER');
  const risk = new RiskEngine(config, ledger);
  const strategy = new MomentumStrategy(config, ledger, risk, null as any, null as any);

  // Walk a full rebalance, committing each position to the ledger so the next
  // sizing call sees the reduced `available` — exactly the path that decayed.
  const price = 1_000;
  const tickets: number[] = [];
  for (let i = 0; i < TOP_N; i++) {
    const sym = `SYM${i}`;
    ledger.raw()
      .prepare(
        `INSERT INTO instruments (token, tradingsymbol, exchange, segment, instrument_type, name, lot_size, tick_size)
         VALUES (?, ?, 'NSE', 'NSE', 'EQ', ?, 1, 0.05)`,
      )
      .run(8100 + i, sym, sym);

    const qty = strategy.sizeFor(sym, price);
    tickets.push(qty * price);

    ledger.upsertPosition({
      symbol: sym,
      exchange: 'NSE',
      quantity: qty,
      avgPrice: price,
      entryTime: new Date(),
      direction: 'LONG',
      product: 'CNC',
    });
  }

  const first = tickets[0];
  const last = tickets[tickets.length - 1];
  assert(
    Math.abs(last - first) / first < 0.02,
    `last ticket matches the first (equal weight): first ${Math.round(first)}, last ${Math.round(last)}`,
  );

  const deployedPct = (tickets.reduce((s, t) => s + t, 0) / CAPITAL) * 100;
  assert(
    deployedPct >= 100 - RESERVE_PCT - 2,
    `rebalance deploys the intended ~${100 - RESERVE_PCT}% (got ${deployedPct.toFixed(1)}%)`,
  );

  // And it must still respect the reserve — recovering deployment must never
  // turn into overspending the cash floor.
  assert(
    deployedPct <= 100 - RESERVE_PCT + 0.5,
    `rebalance never breaches the ${RESERVE_PCT}% cash reserve (got ${deployedPct.toFixed(1)}%)`,
  );

  ledger.close();
}

/**
 * A vetoed name must not strand its slice of capital.
 *
 * With topN=6 and two names vetoed by the AI, sizing across 6 slots leaves ~27%
 * of the book in cash for no reason. Sizing across the 4 slots we will actually
 * fill puts that capital to work — still clamped by the single-stock cap, so
 * this widens deployment without widening concentration risk.
 */
function testVetoedSlotsAreRedistributed() {
  console.log('\n--- vetoed slots must not strand capital ---');

  const CAPITAL = 500_000;
  const config = loadConfig();
  config.risk.availableCapital = CAPITAL;
  config.risk.minCashReservePct = 20;
  config.risk.maxSingleStockPct = 15;
  config.risk.maxTradeAllocation = 100_000;
  config.risk.maxPositionWeightPct = 100;
  config.risk.maxRiskPerTradePct = 100;
  config.risk.maxSectorWeightPct = 100;
  config.strategy.momentumTopN = 6;

  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  ledger.startSession('PAPER');
  const risk = new RiskEngine(config, ledger);
  const strategy = new MomentumStrategy(config, ledger, risk, null as any, null as any);

  const price = 1_000;
  const sixWay = strategy.sizeFor('SYM', price, 6) * price;
  const fourWay = strategy.sizeFor('SYM', price, 4) * price;
  const singleStockCap = (CAPITAL * config.risk.maxSingleStockPct) / 100;

  assert(fourWay > sixWay, 'fewer live slots means a larger slice per surviving name');
  assert(
    fourWay <= singleStockCap,
    `redistribution still respects the single-stock cap (${Math.round(fourWay)} <= ${Math.round(singleStockCap)})`,
  );

  ledger.close();
}

/**
 * Phase 4.2 — event blackout. A name with an undiscounted binary event within
 * the blackout window must (a) never be entered and (b) be exited if held, even
 * when it is still in the momentum target.
 */
function testEventBlackout() {
  console.log('\n--- event blackout: skip entries + exit held names before binary events ---');

  const config = loadConfig();
  config.risk.availableCapital = 500_000;
  config.risk.minCashReservePct = 20;
  config.risk.maxSingleStockPct = 15;
  config.risk.maxTradeAllocation = 100_000;
  config.risk.maxPositionWeightPct = 100;
  config.risk.maxRiskPerTradePct = 100;
  config.risk.maxSectorWeightPct = 100;
  config.strategy.momentumTopN = 4;
  config.strategy.eventBlackoutDays = 3;

  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  ledger.startSession('PAPER');
  const risk = new RiskEngine(config, ledger);
  const trader = new PaperTrader(config, ledger);

  // Stub the live-data feed: EVENTSTK has earnings tomorrow; RATINGSTK has a
  // rating action in 2 days; SAFESTK & HELDSAFE have nothing.
  const now = new Date('2024-01-10T00:00:00Z');
  const events: Record<string, CorporateAction> = {
    EVENTSTK: { symbol: 'EVENTSTK', date: '2024-01-11', type: 'EARNINGS' },
    RATINGSTK: { symbol: 'RATINGSTK', date: '2024-01-12', type: 'RATING' },
  };
  const liveData = new LiveDataService();
  (liveData as any).corporateActionFor = (sym: string): CorporateAction | null =>
    events[sym.toUpperCase()] ?? null;

  const strategy = new MomentumStrategy(config, ledger, risk, trader, liveData);

  const symbols = ['SAFESTK', 'EVENTSTK', 'RATINGSTK', 'HELDSAFE', 'HELDEVENT'];
  const price = 1_000;
  for (let i = 0; i < symbols.length; i++) {
    ledger.raw()
      .prepare(
        `INSERT OR IGNORE INTO instruments (token, tradingsymbol, exchange, segment, instrument_type, name, lot_size, tick_size)
         VALUES (?, ?, 'NSE', 'NSE', 'EQ', ?, 1, 0.05)`,
      )
      .run(9200 + i, symbols[i], symbols[i]);
  }
  // HELDEVENT gets an event too (held into it — must be exited).
  events.HELDEVENT = { symbol: 'HELDEVENT', date: '2024-01-12', type: 'EARNINGS' };

  // Seed two held positions: one safe (kept) and one facing a binary event.
  for (const sym of ['HELDSAFE', 'HELDEVENT']) {
    ledger.upsertPosition({
      symbol: sym,
      exchange: 'NSE',
      quantity: 10,
      avgPrice: price,
      entryTime: new Date(),
      direction: 'LONG',
      product: 'CNC',
    });
  }

  const prices = new Map<string, number>(symbols.map((s) => [s, price]));
  // Target keeps both held names + tries to enter the event/safe candidates.
  const target = ['SAFESTK', 'EVENTSTK', 'RATINGSTK', 'HELDSAFE', 'HELDEVENT'];
  const res = strategy.rebalance(now, prices, target);

  assert(res.bought.includes('SAFESTK'), 'a clean candidate is entered');
  assert(
    !res.bought.includes('EVENTSTK') && res.skipped.some((s) => s.startsWith('EVENTSTK')),
    'an entry candidate with upcoming earnings is skipped (blackout)',
  );
  assert(
    !res.bought.includes('RATINGSTK') && res.skipped.some((s) => s.startsWith('RATINGSTK')),
    'a non-earnings binary event (RATING) also blocks entry (generalised)',
  );
  assert(
    res.sold.includes('HELDEVENT'),
    'a HELD name in target is exited ahead of its binary event (blackout)',
  );
  assert(
    !res.sold.includes('HELDSAFE'),
    'a HELD name with no event stays put',
  );

  ledger.close();
}

main();
