/**
 * live_readiness_test.ts — regression tests for Phase E (live-trading
 * readiness): order idempotency (E1), broker reconciliation (E2) and the live
 * order gate (E3).
 *
 * Run:
 *   ENV_FILE=.env.test npx ts-node test/live_readiness_test.ts
 */
import { loadConfig } from '../src/server/AppConfig';
import { Ledger } from '../src/server/Ledger';
import { PaperTrader } from '../src/server/PaperTrader';
import { OrderGuard, istDay, istHourBucket } from '../src/server/OrderGuard';
import { Reconciler } from '../src/server/Reconciler';
import { LiveTrader } from '../src/server/LiveTrader';
import { setLongInterval } from '../src/server/LongInterval';
import { BrokerAccount, BrokerHolding } from '../src/server/BrokerAccount';
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

/** In-memory broker stub implementing the narrow BrokerAccount surface. */
class StubBroker implements BrokerAccount {
  placed: Array<Record<string, unknown>> = [];
  failNext = false;

  constructor(
    private holdings: BrokerHolding[] = [],
    private positions: BrokerHolding[] = [],
    private unreachable = false,
  ) {}

  async getBrokerHoldings(): Promise<BrokerHolding[]> {
    if (this.unreachable) throw new Error('ECONNREFUSED');
    return this.holdings;
  }
  async getBrokerPositions(): Promise<BrokerHolding[]> {
    if (this.unreachable) throw new Error('ECONNREFUSED');
    return this.positions;
  }
  async getAvailableCash(): Promise<number | null> {
    return 100_000;
  }
  async placeOrder(params: any): Promise<string> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('broker rejected');
    }
    this.placed.push(params);
    return `BROKER-${this.placed.length}`;
  }
}

function mkTrade(symbol = 'INFY', qty = 10, price = 1500): TradeRequest {
  return {
    symbol,
    exchange: 'NSE',
    quantity: qty,
    direction: 'LONG',
    entryPrice: price,
    reason: 'test',
    ticketSize: qty * price,
    timestamp: new Date('2026-04-20T04:00:00Z'), // 09:30 IST
    product: 'CNC',
  };
}

function freshLedger(): Ledger {
  const l = new Ledger(':memory:');
  l.runMigrations();
  return l;
}

/* ------------------------------------------------------------------ */
/* E1 — Order idempotency                                              */
/* ------------------------------------------------------------------ */

function testIdempotency() {
  console.log('\n--- E1: order idempotency ---');
  const ledger = freshLedger();
  const guard = new OrderGuard(ledger);
  const trade = mkTrade();

  const k1 = guard.claim(trade, 'REBALANCE_ENTRY');
  assert(k1 !== null, 'first claim wins');

  const k2 = guard.claim(trade, 'REBALANCE_ENTRY');
  assert(k2 === null, 'second identical claim is suppressed');

  // A different intent on the same symbol is a genuinely different decision.
  const k3 = guard.claim(trade, 'REBALANCE_EXIT');
  assert(k3 !== null, 'different intent is not a duplicate');

  // Quantity must NOT be part of the key: a retry that re-sizes slightly is
  // still the same intent and must stay suppressed.
  const resized = { ...trade, quantity: 11, ticketSize: 11 * 1500 };
  assert(
    guard.claim(resized, 'REBALANCE_ENTRY') === null,
    'resized retry of the same intent is still a duplicate',
  );

  // A later day is a new decision.
  const nextDay = { ...trade, timestamp: new Date('2026-04-21T04:00:00Z') };
  assert(guard.claim(nextDay, 'REBALANCE_ENTRY') !== null, 'next day is a new intent');

  // Abandoning releases the claim so a legitimate retry can proceed.
  const ledger2 = freshLedger();
  const guard2 = new OrderGuard(ledger2);
  const kA = guard2.claim(trade, 'REBALANCE_ENTRY')!;
  guard2.settle(kA, 'ABANDONED');
  assert(
    guard2.claim(trade, 'REBALANCE_ENTRY') !== null,
    'abandoned claim is released for retry',
  );

  // `once` runs the body exactly once.
  const ledger3 = freshLedger();
  const guard3 = new OrderGuard(ledger3);
  let runs = 0;
  guard3.once(trade, 'REBALANCE_ENTRY', () => runs++);
  guard3.once(trade, 'REBALANCE_ENTRY', () => runs++);
  assert(runs === 1, 'once() executes the body exactly once');

  // A throwing body releases the claim (no permanent lockout on a transient error).
  const ledger4 = freshLedger();
  const guard4 = new OrderGuard(ledger4);
  try {
    guard4.once(trade, 'REBALANCE_ENTRY', () => {
      throw new Error('boom');
    });
  } catch {
    /* expected */
  }
  assert(
    guard4.claim(trade, 'REBALANCE_ENTRY') !== null,
    'claim released when the body throws',
  );

  // Bucket helpers.
  assert(istDay(new Date('2026-04-20T19:00:00Z')) === '2026-04-21', 'istDay rolls over at IST midnight');
  assert(istHourBucket(new Date('2026-04-20T04:00:00Z')) === '2026-04-20T09', 'istHourBucket is IST hour');

  ledger.close();
  ledger2.close();
  ledger3.close();
  ledger4.close();
}

/* ------------------------------------------------------------------ */
/* E2 — Broker reconciliation                                          */
/* ------------------------------------------------------------------ */

async function testReconciliation() {
  console.log('\n--- E2: broker reconciliation ---');
  const config = loadConfig();
  config.live.haltOnDrift = true;

  // Clean: ledger and broker agree.
  {
    const ledger = freshLedger();
    const trader = new PaperTrader(config, ledger);
    trader.execute(mkTrade('INFY', 10, 1500));
    const pos = ledger.getOpenPositions()[0];
    const broker = new StubBroker([
      { symbol: 'INFY', exchange: 'NSE', quantity: 10, averagePrice: pos.avgPrice, lastPrice: 1500 },
    ]);
    const rec = new Reconciler(config, ledger, broker);
    const res = await rec.reconcile();
    assert(res.ok && res.findings.length === 0, 'matching book reconciles clean');
    assert(!rec.shouldHalt, 'clean reconciliation does not halt trading');
    ledger.close();
  }

  // Quantity mismatch.
  {
    const ledger = freshLedger();
    const trader = new PaperTrader(config, ledger);
    trader.execute(mkTrade('INFY', 10, 1500));
    const broker = new StubBroker([
      { symbol: 'INFY', exchange: 'NSE', quantity: 7, averagePrice: 1500, lastPrice: 1500 },
    ]);
    const rec = new Reconciler(config, ledger, broker);
    const res = await rec.reconcile();
    assert(
      !res.ok && res.findings.some((f) => f.issue === 'QUANTITY_MISMATCH'),
      'quantity mismatch is detected',
    );
    assert(rec.shouldHalt, 'drift halts trading when HALT_ON_DRIFT is on');
    assert(
      ledger.getRecentReconciliations(10).some((r) => r.status === 'DRIFT'),
      'drift is persisted to reconciliation_log',
    );
    ledger.close();
  }

  // Missing at broker.
  {
    const ledger = freshLedger();
    const trader = new PaperTrader(config, ledger);
    trader.execute(mkTrade('TCS', 5, 4000));
    const rec = new Reconciler(config, ledger, new StubBroker([]));
    const res = await rec.reconcile();
    assert(
      res.findings.some((f) => f.issue === 'MISSING_AT_BROKER'),
      'position absent at the broker is detected',
    );
    ledger.close();
  }

  // Missing in ledger (manual trade in the Kite app).
  {
    const ledger = freshLedger();
    const broker = new StubBroker([
      { symbol: 'WIPRO', exchange: 'NSE', quantity: 50, averagePrice: 400, lastPrice: 410 },
    ]);
    const rec = new Reconciler(config, ledger, broker);
    const res = await rec.reconcile();
    assert(
      res.findings.some((f) => f.issue === 'MISSING_IN_LEDGER'),
      'untracked broker holding is detected',
    );
    ledger.close();
  }

  // Broker unreachable => inconclusive, and must NOT halt (transient blips
  // should not take the bot offline).
  {
    const ledger = freshLedger();
    const rec = new Reconciler(config, ledger, new StubBroker([], [], true));
    const res = await rec.reconcile();
    assert(res.inconclusive, 'unreachable broker yields an inconclusive result');
    assert(!rec.shouldHalt, 'inconclusive reconciliation does not halt trading');
    ledger.close();
  }
}

/* ------------------------------------------------------------------ */
/* E3 — Live order gate                                                */
/* ------------------------------------------------------------------ */

async function testLiveGate() {
  console.log('\n--- E3: live order gate ---');
  const base = loadConfig();

  const build = (overrides: Partial<typeof base.live>, broker: StubBroker | null) => {
    const config = { ...base, live: { ...base.live, ...overrides } };
    const ledger = freshLedger();
    const trader = new PaperTrader(config, ledger);
    const guard = new OrderGuard(ledger);
    const rec = new Reconciler(config, ledger, broker);
    const live = new LiveTrader(config, ledger, trader, guard, broker, rec);
    return { config, ledger, live, rec, broker };
  };

  // Default: paper. No broker call, but the ledger still records the trade.
  {
    const broker = new StubBroker();
    const { live, ledger } = build({ allowLiveOrders: false }, broker);
    const fill = live.execute(mkTrade(), 'REBALANCE_ENTRY');
    assert(live.mode === 'PAPER', 'defaults to PAPER mode');
    assert(fill !== null, 'paper trade executes');
    assert(broker.placed.length === 0, 'PAPER mode never calls the broker');
    assert(ledger.getOpenPositions().length === 1, 'paper ledger is still the record');
    ledger.close();
  }

  // allowLiveOrders alone is not enough — shadow mode defaults on.
  {
    const broker = new StubBroker();
    const { live, ledger } = build({ allowLiveOrders: true, shadowMode: true }, broker);
    live.execute(mkTrade(), 'REBALANCE_ENTRY');
    assert(live.mode === 'SHADOW', 'allowLiveOrders alone yields SHADOW mode');
    assert(broker.placed.length === 0, 'SHADOW mode builds but does not send the order');
    ledger.close();
  }

  // Both switches thrown => real order sent.
  {
    const broker = new StubBroker();
    const { live, ledger } = build(
      { allowLiveOrders: true, shadowMode: false, maxLiveOrderValue: 100_000 },
      broker,
    );
    live.execute(mkTrade(), 'REBALANCE_ENTRY');
    await new Promise((r) => setTimeout(r, 10)); // placeOrder is fire-and-log
    assert(live.mode === 'LIVE', 'both switches thrown yields LIVE mode');
    assert(broker.placed.length === 1, 'LIVE mode sends exactly one order');
    assert(broker.placed[0].tradingsymbol === 'INFY', 'broker payload carries the symbol');
    ledger.close();
  }

  // Blast-radius cap blocks an oversized order even if risk approved it.
  {
    const broker = new StubBroker();
    const { live, ledger } = build(
      { allowLiveOrders: true, shadowMode: false, maxLiveOrderValue: 1_000 },
      broker,
    );
    const fill = live.execute(mkTrade('INFY', 10, 1500), 'REBALANCE_ENTRY');
    assert(fill === null, 'oversized live order is blocked');
    assert(broker.placed.length === 0, 'blocked order never reaches the broker');
    assert(ledger.getOpenPositions().length === 0, 'blocked order does not touch the ledger');
    ledger.close();
  }

  // Reconciliation drift halts new orders.
  {
    const broker = new StubBroker([
      { symbol: 'WIPRO', exchange: 'NSE', quantity: 50, averagePrice: 400, lastPrice: 410 },
    ]);
    const { live, rec, ledger } = build(
      { allowLiveOrders: true, shadowMode: false, haltOnDrift: true },
      broker,
    );
    await rec.reconcile();
    assert(rec.shouldHalt, 'drift detected before trading');
    const fill = live.execute(mkTrade(), 'REBALANCE_ENTRY');
    assert(fill === null, 'drifted book blocks new orders');
    ledger.close();
  }

  // Idempotency holds through LiveTrader.
  {
    const broker = new StubBroker();
    const { live, ledger } = build(
      { allowLiveOrders: true, shadowMode: false, maxLiveOrderValue: 100_000, haltOnDrift: false },
      broker,
    );
    live.execute(mkTrade(), 'REBALANCE_ENTRY');
    const second = live.execute(mkTrade(), 'REBALANCE_ENTRY');
    await new Promise((r) => setTimeout(r, 10));
    assert(second === null, 'duplicate submit through LiveTrader is suppressed');
    assert(broker.placed.length === 1, 'broker receives the order only once');
    ledger.close();
  }

  // A broker failure is recorded as drift rather than silently ignored.
  {
    const broker = new StubBroker();
    broker.failNext = true;
    const { live, ledger } = build(
      { allowLiveOrders: true, shadowMode: false, maxLiveOrderValue: 100_000, haltOnDrift: false },
      broker,
    );
    live.execute(mkTrade(), 'REBALANCE_ENTRY');
    await new Promise((r) => setTimeout(r, 20));
    assert(
      ledger.getRecentReconciliations(10).some((r) => r.status === 'ERROR'),
      'failed live order is logged for reconciliation',
    );
    ledger.close();
  }
}

/* ------------------------------------------------------------------ */
/* Scheduler safety — long-period timers                               */
/* ------------------------------------------------------------------ */

async function testLongInterval() {
  console.log('\n--- Scheduler: long-period timers ---');

  // The bug this guards against: Node clamps any setInterval delay above
  // ~24.8 days to 1 ms, so a "monthly" rebalance would fire ~1000x/second.
  {
    let fired = 0;
    const MONTHLY = 30 * 24 * 60 * 60 * 1000; // overflows a 32-bit delay
    const h = setLongInterval('overflow-check', MONTHLY, () => {
      fired++;
    }, MONTHLY);
    await new Promise((r) => setTimeout(r, 120));
    h.stop();
    assert(fired === 0, 'a 30-day period does not overflow into an immediate loop');
  }

  // The initial delay is still honoured normally.
  {
    let fired = 0;
    const h = setLongInterval('initial-delay', 60_000, () => {
      fired++;
    }, 20);
    await new Promise((r) => setTimeout(r, 80));
    h.stop();
    assert(fired === 1, 'the first run happens after the initial delay');
  }

  // stop() actually stops it.
  {
    let fired = 0;
    const h = setLongInterval('stoppable', 20, () => {
      fired++;
    }, 10);
    await new Promise((r) => setTimeout(r, 50));
    h.stop();
    const atStop = fired;
    await new Promise((r) => setTimeout(r, 60));
    assert(fired === atStop, 'stop() halts further runs');
    assert(atStop > 0, 'it did run before being stopped');
  }

  // Re-entrancy: a task slower than its period must not stack up.
  {
    let concurrent = 0;
    let maxConcurrent = 0;
    const h = setLongInterval(
      'slow-task',
      10,
      async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 40));
        concurrent--;
      },
      5,
    );
    await new Promise((r) => setTimeout(r, 200));
    h.stop();
    assert(maxConcurrent === 1, 'a slow task never overlaps itself');
  }

  // A throwing task is logged, not fatal, and the schedule survives.
  {
    let fired = 0;
    const h = setLongInterval(
      'throwing-task',
      15,
      () => {
        fired++;
        throw new Error('boom');
      },
      5,
    );
    await new Promise((r) => setTimeout(r, 90));
    h.stop();
    assert(fired > 1, 'the schedule continues after a task throws');
  }
}

async function main() {
  testIdempotency();
  await testReconciliation();
  await testLiveGate();
  await testLongInterval();

  console.log(
    failures === 0
      ? '\nAll live-readiness (Phase E) tests passed.'
      : `\n${failures} test(s) FAILED.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
