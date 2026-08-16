/**
 * execution_test.ts — regression tests for PaperTrader position accounting.
 *
 * These exist because a partial exit did not work. `applyReportAdjustments`
 * issues TRIM_25 / TRIM_50 as an opposite-direction request for a *slice* of
 * the position, but PaperTrader closed the WHOLE position on any opposite
 * direction and ignored `request.quantity`. Every trim silently became a full
 * exit. In live mode it was worse: LiveTrader forwards `request.quantity` to
 * the broker, so the broker sold 50% while the ledger recorded a 100% exit —
 * a real position the bot no longer believed it held.
 *
 * Run: ENV_FILE=.env.test npx ts-node test/execution_test.ts
 */
import { loadConfig } from '../src/server/AppConfig';
import { Ledger } from '../src/server/Ledger';
import { PaperTrader } from '../src/server/PaperTrader';
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
function near(a: number, b: number, tol: number, msg: string) {
  assert(Math.abs(a - b) <= tol, `${msg} (got ${a.toFixed(2)}, want ~${b.toFixed(2)})`);
}

function setup() {
  const config = loadConfig();
  // Zero-cost, zero-slippage so the arithmetic under test is exact.
  config.costs.slippageBps = 0;
  config.costs.brokerageBps = 0;
  config.costs.brokerageMax = 0;
  config.costs.statutoryBps = 0;
  config.costs.gstPct = 0;

  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  ledger.raw()
    .prepare(
      `INSERT INTO instruments (token, tradingsymbol, exchange, segment, instrument_type, name, lot_size, tick_size)
       VALUES (?, ?, 'NSE', 'NSE', 'EQ', ?, 1, 0.05)`,
    )
    .run(7001, 'ACME', 'ACME');

  return { config, ledger, trader: new PaperTrader(config, ledger) };
}

const req = (
  direction: 'LONG' | 'SHORT',
  quantity: number,
  entryPrice: number,
  reason = 'test',
): TradeRequest => ({
  symbol: 'ACME',
  exchange: 'NSE',
  quantity,
  direction,
  entryPrice,
  reason,
  ticketSize: quantity * entryPrice,
  timestamp: new Date(),
  product: 'CNC',
});

function main() {
  console.log('--- partial exit (TRIM) must reduce, not close ---');
  {
    const { ledger, trader } = setup();
    trader.execute(req('LONG', 100, 1_000)); // open 100 @ 1000

    // TRIM_50 at 1100: sell 50, book (1100-1000)*50 = 5000, keep 50 open.
    const fill = trader.execute(req('SHORT', 50, 1_100, 'report: TRIM_50'));

    assert(fill.quantity === 50, 'fill reports the trimmed quantity, not the position size');
    near(fill.pnl, 5_000, 0.01, 'realized P&L is booked on the sold slice only');

    const pos = ledger.getPosition('ACME');
    assert(pos !== null, 'position survives a partial exit');
    assert(pos?.quantity === 50, 'remaining quantity is 50');
    near(pos?.avgPrice ?? 0, 1_000, 0.01, 'avg price is unchanged by a partial exit');
    near(ledger.cumulativeRealizedPnl(), 5_000, 0.01, 'ledger realized P&L matches the fill');
    ledger.close();
  }

  console.log('\n--- full exit still closes the position ---');
  {
    const { ledger, trader } = setup();
    trader.execute(req('LONG', 100, 1_000));
    const fill = trader.execute(req('SHORT', 100, 1_100, 'report: EXIT_FULL'));

    assert(fill.quantity === 100, 'full exit fills the whole position');
    near(fill.pnl, 10_000, 0.01, 'full exit books the whole gain');
    assert(ledger.getPosition('ACME') === null, 'position is closed');
    ledger.close();
  }

  console.log('\n--- an oversized sell cannot flip long into short ---');
  {
    const { ledger, trader } = setup();
    trader.execute(req('LONG', 40, 1_000));
    // Ask to sell 100 when only 40 are held. NSE CNC cannot short; the excess
    // must be dropped, not turned into a -60 position.
    const fill = trader.execute(req('SHORT', 100, 1_050));

    assert(fill.quantity === 40, 'sell is clamped to the held quantity');
    near(fill.pnl, 2_000, 0.01, 'P&L is booked on 40 shares, not 100');
    assert(ledger.getPosition('ACME') === null, 'position is flat, not short');
    ledger.close();
  }

  console.log('\n--- successive trims accumulate correctly ---');
  {
    const { ledger, trader } = setup();
    trader.execute(req('LONG', 100, 1_000));
    trader.execute(req('SHORT', 25, 1_100, 'TRIM_25')); // +2500, 75 left
    trader.execute(req('SHORT', 25, 1_200, 'TRIM_25')); // +5000, 50 left

    const pos = ledger.getPosition('ACME');
    assert(pos?.quantity === 50, 'two 25-share trims leave 50 open');
    near(ledger.cumulativeRealizedPnl(), 7_500, 0.01, 'realized P&L accumulates across trims');
    ledger.close();
  }

  console.log('\n--- adding to a position re-averages and books nothing ---');
  {
    const { ledger, trader } = setup();
    trader.execute(req('LONG', 100, 1_000));
    const add = trader.execute(req('LONG', 100, 1_200, 'BUY_ACCUMULATE'));

    assert(add.pnl === 0, 'an add books no realized P&L');
    const pos = ledger.getPosition('ACME');
    assert(pos?.quantity === 200, 'quantity is the sum of both legs');
    near(pos?.avgPrice ?? 0, 1_100, 0.01, 'avg price is the weighted average');
    ledger.close();
  }

  console.log('\n--- eodStats is scoped to the day it is asked about ---');
  {
    const { ledger, trader } = setup();
    const open = req('LONG', 10, 1_000);
    open.timestamp = new Date('2026-03-02T09:45:00.000Z');
    trader.execute(open);

    const exit = req('SHORT', 10, 1_100);
    exit.timestamp = new Date('2026-03-05T09:45:00.000Z');
    trader.execute(exit);

    near(ledger.eodStats('2026-03-05').realizedPnl, 1_000, 0.01, 'the exit day reports its P&L');
    near(ledger.eodStats('2026-03-02').realizedPnl, 0, 0.01, 'the entry day reports none');
    near(ledger.eodStats('2026-03-06').realizedPnl, 0, 0.01, 'a later day does not inherit it');
    near(ledger.cumulativeRealizedPnl(), 1_000, 0.01, 'cumulative spans every day');
    ledger.close();
  }

  console.log(failures === 0 ? '\nALL EXECUTION TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
