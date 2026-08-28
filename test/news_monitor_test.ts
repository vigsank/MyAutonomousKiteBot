import { loadConfig } from '../src/server/AppConfig';
import { Ledger } from '../src/server/Ledger';
import { RiskEngine } from '../src/server/RiskEngine';
import { PaperTrader } from '../src/server/PaperTrader';
import { LiveDataService } from '../src/server/LiveDataService';
import { MomentumStrategy } from '../src/server/MomentumStrategy';
import { NewsMonitorEngine } from '../src/server/NewsMonitorEngine';
import { NewsSentimentEngine } from '../src/server/NewsSentimentEngine';
import { LlmManager } from '../src/server/LlmManager';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('ok: ' + msg);
  }
}

function setup() {
  const config = loadConfig();
  config.risk.availableCapital = 1_000_000;
  config.strategy.momentumTopN = 4;
  config.newsMonitor.enabled = true;
  config.newsMonitor.sentimentExitThreshold = -0.5;
  config.newsMonitor.opportunisticEnabled = true;
  config.newsMonitor.opportunisticPartialPct = 50;
  config.risk.maxSingleStockPct = 100;
  config.risk.maxTradeAllocation = 1_000_000;
  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  const risk = new RiskEngine(config, ledger);
  const trader = new PaperTrader(config, ledger);
  const liveData = new LiveDataService();
  const strategy = new MomentumStrategy(config, ledger, risk, trader, liveData);
  const llm = new LlmManager(config.llm);
  const news = new NewsSentimentEngine(config, llm, ledger);
  const monitor = new NewsMonitorEngine(config, ledger, news, strategy);
  return { config, ledger, risk, trader, strategy, news, monitor };
}

function registerInstrument(ledger: Ledger, symbol: string, price: number) {
  ledger.raw()
    .prepare(`INSERT OR IGNORE INTO instruments (token, tradingsymbol, exchange, segment, instrument_type, name, lot_size, tick_size)
              VALUES (?, ?, 'NSE', 'NSE', 'EQ', ?, 1, 0.05)`)
    .run(7000 + Math.abs(symbol.length * 7), symbol, symbol);
  ledger.raw().prepare(`UPDATE instruments SET last_price = ? WHERE tradingsymbol = ?`).run(price, symbol);
}

function main() {
  /* --- Seen-article store --- */
  {
    const { ledger } = setup();
    assert(ledger.recordSeenArticle('ACME', 'http://a/1', 't1') === true, 'first seen article is new');
    assert(ledger.recordSeenArticle('ACME', 'http://a/1', 't1') === false, 'duplicate article is not new');
    assert(ledger.isArticleSeen('ACME', 'http://a/1') === true, 'isArticleSeen true after record');
    assert(ledger.isArticleSeen('ACME', 'http://a/2') === false, 'unseen article is not seen');
    assert(ledger.recordSeenArticle('OTHER', 'http://a/1', 't1') === true, 'same url different symbol is new');
  }

  /* --- NewsMonitorEngine.decide (pure) --- */
  {
    const { ledger, trader, monitor } = setup();
    registerInstrument(ledger, 'ACME', 100);
    // Open a held position via the trader (handles instrument_id lookup).
    trader.execute({ symbol: 'ACME', exchange: 'NSE', quantity: 10, direction: 'LONG', entryPrice: 100, reason: 'open', ticketSize: 1000, timestamp: new Date(), product: 'CNC' });
    assert(ledger.getPosition('ACME', 'NSE') !== null, 'position is held for decide test');
    // Held + negative sentiment -> EXIT
    const d1 = monitor.decide('ACME', -0.8, new Date());
    assert(d1.action === 'EXIT', 'held + negative sentiment -> EXIT');
    // Held + positive sentiment -> NONE
    const d2 = monitor.decide('ACME', 0.5, new Date());
    assert(d2.action === 'NONE', 'held + positive sentiment -> NONE');
  }

  /* --- MomentumStrategy.defensiveExit closes a held position --- */
  {
    const { ledger, trader, strategy } = setup();
    registerInstrument(ledger, 'ACME', 100);
    trader.execute({ symbol: 'ACME', exchange: 'NSE', quantity: 10, direction: 'LONG', entryPrice: 100, reason: 'open', ticketSize: 1000, timestamp: new Date(), product: 'CNC' });
    assert(ledger.getPosition('ACME', 'NSE') !== null, 'position is open before defensive exit');
    const ok = strategy.defensiveExit('ACME', 100, new Date(), 'test news exit');
    assert(ok === true, 'defensiveExit returns true');
    assert(ledger.getPosition('ACME', 'NSE') === null, 'position is closed after defensive exit');
  }

  /* --- MomentumStrategy.opportunisticEntry opens a partial position --- */
  {
    const { ledger, strategy } = setup();
    registerInstrument(ledger, 'ACME', 100);
    const ok = strategy.opportunisticEntry('ACME', 100, new Date(), 'test opportunistic');
    assert(ok === true, 'opportunisticEntry returns true');
    const pos = ledger.getPosition('ACME', 'NSE');
    assert(pos !== null, 'position is open after opportunistic entry');
    // Full slot = 80% of 1M / 4 = 200k -> 2000 shares; partial 50% -> 1000.
    assert(pos!.quantity === 1000, `opportunistic entry is partial (got ${pos!.quantity}, want 1000)`);
  }

  console.log(failures === 0 ? '\nALL NEWS-MONITOR TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
