/**
 * indmoney_test.ts — unit tests for the INDmoney (INDstocks) integration:
 *   - pure mapping functions (scrip codes, intervals, status, product, etc.)
 *   - broker-order snapshot persistence (V017)
 *
 * Run: ENV_FILE=.env.test npx ts-node test/indmoney_test.ts
 */
import {
  scripCode,
  wsInstrument,
  toIndInterval,
  maxRangeMs,
  normalizeOrderStatus,
  securityIdToToken,
  toIndProduct,
  toIndOrderType,
  toIndValidity,
  toIndSegment,
  algoIdFor,
  toRemarks,
} from '../src/server/brokers/indmoneyMapping';
import { isTokenError } from '../src/server/brokers/IndMoneyClient';
import {
  IndMoneyRateLimiter,
  IndRateStore,
  istDayKey,
} from '../src/server/brokers/IndMoneyRateLimiter';
import { Ledger } from '../src/server/Ledger';

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
/* Scrip codes                                                         */
/* ------------------------------------------------------------------ */

assert(scripCode('NSE', 3045) === 'NSE_3045', 'REST scrip code uses underscore');
assert(scripCode('BSE', 500112) === 'BSE_500112', 'BSE scrip code uses BSE prefix');
assert(wsInstrument('NSE', 2885) === 'NSE:2885', 'WS instrument uses colon');
assert(wsInstrument('BSE', 500325) === 'BSE:500325', 'BSE WS instrument uses colon');

/* ------------------------------------------------------------------ */
/* Interval mapping                                                    */
/* ------------------------------------------------------------------ */

assert(toIndInterval('minute') === '1minute', 'minute → 1minute');
assert(toIndInterval('5minute') === '5minute', '5minute → 5minute');
assert(toIndInterval('hour') === '60minute', 'hour → 60minute');
assert(toIndInterval('day') === '1day', 'day → 1day');
assert(toIndInterval('week') === '1week', 'week → 1week');
assert(toIndInterval('month') === '1month', 'month → 1month');
assert(toIndInterval('unknown') === '1day', 'unknown interval falls back to 1day');

/* ------------------------------------------------------------------ */
/* Max range (pagination)                                             */
/* ------------------------------------------------------------------ */

assert(maxRangeMs('day') === 365 * 24 * 60 * 60 * 1000, '1day max range = 1 year');
assert(maxRangeMs('5minute') === 7 * 24 * 60 * 60 * 1000, 'intraday max range = 7 days');
assert(maxRangeMs('60minute') === 15 * 24 * 60 * 60 * 1000, 'hourly max range = 15 days');

/* ------------------------------------------------------------------ */
/* Order status normalization                                          */
/* ------------------------------------------------------------------ */

assert(normalizeOrderStatus('SUCCESS') === 'FILLED', 'SUCCESS → FILLED');
assert(normalizeOrderStatus('PARTIALLY FILLED') === 'PARTIAL', 'PARTIALLY FILLED → PARTIAL');
assert(normalizeOrderStatus('CANCELLED') === 'CANCELLED', 'CANCELLED → CANCELLED');
assert(normalizeOrderStatus('ABORTED') === 'CANCELLED', 'ABORTED → CANCELLED');
assert(normalizeOrderStatus('EXPIRED') === 'EXPIRED', 'EXPIRED → EXPIRED');
assert(normalizeOrderStatus('FAILED') === 'FAILED', 'FAILED → FAILED');
assert(normalizeOrderStatus('O-PENDING') === 'PENDING', 'O-PENDING → PENDING');
assert(normalizeOrderStatus('INITIATED') === 'OPEN', 'INITIATED → OPEN');
assert(normalizeOrderStatus('QUEUED') === 'OPEN', 'QUEUED → OPEN');

/* ------------------------------------------------------------------ */
/* security_id → token                                                 */
/* ------------------------------------------------------------------ */

assert(securityIdToToken('2885') === 2885, 'numeric security_id maps to token');
assert(securityIdToToken('500112') === 500112, 'BSE security_id maps to token');
assert(securityIdToToken('abc') === null, 'non-numeric security_id → null');
assert(securityIdToToken('') === null, 'empty security_id → null');
assert(securityIdToToken('0') === null, 'zero security_id → null');

/* ------------------------------------------------------------------ */
/* Product / order type / validity / segment                           */
/* ------------------------------------------------------------------ */

assert(toIndProduct('CNC') === 'CNC', 'CNC → CNC');
assert(toIndProduct('MIS') === 'INTRADAY', 'MIS → INTRADAY');
assert(toIndOrderType('LIMIT') === 'LIMIT', 'LIMIT → LIMIT');
assert(toIndOrderType('MARKET') === 'MARKET', 'MARKET → MARKET');
assert(toIndValidity('IOC') === 'IOC', 'IOC → IOC');
assert(toIndValidity('DAY') === 'DAY', 'DAY → DAY');
assert(toIndSegment('NSE') === 'EQUITY', 'NSE → EQUITY segment');
assert(algoIdFor('NSE', '99999', '9999999999999999') === '99999', 'NSE algo_id');
assert(algoIdFor('BSE', '99999', '9999999999999999') === '9999999999999999', 'BSE algo_id');
assert(toRemarks('x'.repeat(150)).length === 100, 'remarks truncated to 100 chars');

/* ------------------------------------------------------------------ */
/* Token-expiry detection                                              */
/* ------------------------------------------------------------------ */

assert(isTokenError(401, null) === true, 'HTTP 401 → token error');
assert(isTokenError(403, null) === true, 'HTTP 403 → token error');
assert(isTokenError(400, { error_type: 'TokenException' }) === true, 'TokenException → token error');
assert(isTokenError(400, { message: 'Invalid token' }) === true, 'Invalid token message → token error');
assert(isTokenError(400, { message: 'Insufficient margin' }) === false, 'margin error is NOT a token error');
assert(isTokenError(500, null) === false, 'HTTP 500 is NOT a token error');

/* ------------------------------------------------------------------ */
/* Broker-order snapshot persistence (V017)                            */
/* ------------------------------------------------------------------ */

{
  const ledger = new Ledger(':memory:');
  ledger.runMigrations();

  ledger.recordBrokerOrderSnapshot({
    broker: 'indmoney',
    tradeId: 't-1',
    symbol: 'INFY',
    exchange: 'NSE',
    side: 'BUY',
    quantity: 10,
    product: 'CNC',
    orderType: 'MARKET',
    price: 1850,
    intent: 'REBALANCE_BUY',
    payloadJson: JSON.stringify({ txn_type: 'BUY', exchange: 'NSE', qty: 10 }),
    status: 'STUBBED',
  });

  const rows = ledger.getBrokerOrderSnapshots();
  assert(rows.length === 1, 'snapshot persisted');
  assert(rows[0].broker === 'indmoney', 'broker recorded');
  assert(rows[0].symbol === 'INFY', 'symbol recorded');
  assert(rows[0].side === 'BUY', 'side recorded');
  assert(rows[0].quantity === 10, 'quantity recorded');
  assert(rows[0].intent === 'REBALANCE_BUY', 'intent recorded');
  assert(rows[0].status === 'STUBBED', 'status defaults to STUBBED');
  assert(rows[0].payloadJson.includes('txn_type'), 'payload JSON stored');
}

/* ------------------------------------------------------------------ */
/* Rate limiter (token bucket, daily budget, circuit breaker)          */
/* ------------------------------------------------------------------ */

class MemStore implements IndRateStore {
  private m = new Map<string, number>();
  getDailyCount(k: string): number {
    return this.m.get(k) ?? 0;
  }
  setDailyCount(k: string, c: number): void {
    this.m.set(k, c);
  }
}

async function runRateLimiterTests(): Promise<void> {
  // 27. Token bucket: perSecond=5 allows 5 immediate, 6th halts (maxWaitMs=0).
  {
    const limiter = new IndMoneyRateLimiter({ perSecond: 5, perDay: 1000, maxWaitMs: 0 });
    for (let i = 0; i < 5; i++) {
      assert((await limiter.waitForSlot()) === true, `token ${i + 1} allowed`);
    }
    assert((await limiter.waitForSlot()) === false, '6th request halts (per-second backlog)');
    assert(limiter.currentState === 'HALTED', 'state is HALTED after backlog');
  }

  // 28. Per-day budget: perDay=3 halts on the 4th (sticky).
  {
    const limiter = new IndMoneyRateLimiter({ perSecond: 100, perDay: 3, maxWaitMs: 0 });
    for (let i = 0; i < 3; i++) {
      assert((await limiter.waitForSlot()) === true, `day ${i + 1} allowed`);
    }
    assert((await limiter.waitForSlot()) === false, '4th request halts (per-day)');
    assert(limiter.currentState === 'HALTED', 'state is HALTED');
    assert((limiter.haltReason ?? '').includes('per-day'), 'halt reason is per-day');
  }

  // 29. Reactive 429 halt: 3 consecutive 429s halt; reset clears.
  {
    const limiter = new IndMoneyRateLimiter({ haltOn429: true, halt429Threshold: 3 });
    limiter.record429();
    limiter.record429();
    assert(limiter.currentState !== 'HALTED', 'not halted after 2 429s');
    limiter.record429();
    assert(limiter.currentState === 'HALTED', 'halted after 3 429s');
    limiter.reset();
    assert(limiter.currentState === 'OK', 'reset clears halt');
  }

  // 30. recordSuccess resets the 429 streak.
  {
    const limiter = new IndMoneyRateLimiter({ haltOn429: true, halt429Threshold: 3 });
    limiter.record429();
    limiter.record429();
    limiter.recordSuccess();
    limiter.record429();
    limiter.record429();
    assert(limiter.currentState !== 'HALTED', 'success resets the 429 streak');
  }

  // 31. Daily reset: advancing to the next IST day clears a sticky halt.
  {
    let now = Date.parse('2026-01-01T00:00:00Z');
    const clock = () => now;
    const limiter = new IndMoneyRateLimiter({ perSecond: 100, perDay: 2, maxWaitMs: 0 }, clock);
    await limiter.waitForSlot();
    await limiter.waitForSlot();
    assert((await limiter.waitForSlot()) === false, 'halted at per-day');
    now += 24 * 60 * 60 * 1000; // next day
    assert((await limiter.waitForSlot()) === true, 'new day resets the budget');
    assert(limiter.currentState === 'OK', 'state back to OK');
  }

  // 32. Persistence: the daily count survives a new limiter instance.
  {
    const store = new MemStore();
    const limiter1 = new IndMoneyRateLimiter({ perSecond: 100, perDay: 1000 });
    limiter1.configure({}, store);
    await limiter1.waitForSlot();
    await limiter1.waitForSlot();
    assert(store.getDailyCount(istDayKey(Date.now())) === 2, 'store persisted 2');
    const limiter2 = new IndMoneyRateLimiter({ perSecond: 100, perDay: 1000 });
    limiter2.configure({}, store);
    assert(limiter2.dailyCount === 2, 'new limiter reloads persisted count');
  }

  // 33. WARN state at warnPct of the daily budget.
  {
    const limiter = new IndMoneyRateLimiter({ perSecond: 1000, perDay: 100, warnPct: 80 });
    for (let i = 0; i < 80; i++) await limiter.waitForSlot();
    assert(limiter.currentState === 'WARN', 'WARN at 80% of daily budget');
  }
}

runRateLimiterTests().then(() => {
  console.log(failures === 0 ? '\nALL INDMONEY TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
});
