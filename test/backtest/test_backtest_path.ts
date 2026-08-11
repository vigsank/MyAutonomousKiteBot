/**
 * Quick self-test for the onCandle (backtest) path.
 * Feeds synthetic OHLC candles through MarketAgent.onCandle and verifies
 * trades are produced. Usage: npx ts-node src/test_backtest_path.ts
 */
import { loadConfig } from '../../src/server/AppConfig';
import { Ledger } from '../../src/server/Ledger';
import { RiskEngine } from '../../src/server/RiskEngine';
import { PaperTrader } from '../../src/server/PaperTrader';
import { MarketAgent } from '../../src/server/MarketAgent';
import { NotificationService } from '../../src/server/NotificationService';
import { NewsSentimentEngine } from '../../src/server/NewsSentimentEngine';
import { LlmManager } from '../../src/server/LlmManager';
import { TelegramHITL } from '../../src/server/TelegramHITL';
import { OptionsEngine } from '../../src/server/OptionsEngine';
import { OptionsTrader } from '../../src/server/OptionsTrader';
import { Candle } from '../../src/server/types';

class MockStreamer {
  getInstrument(token: number) {
    return token === 1000 ? { tradingsymbol: 'TEST', exchange: 'NSE' } : null;
  }
  get isConfigured() { return true; }
  findInstrument() { return { instrument_token: 1000 }; }
  async loadInstruments() {}
}

async function main() {
  const config = loadConfig();
  config.watchlist = [{ tradingsymbol: 'TEST', exchange: 'NSE' as const, quantity: 10, enabled: true }];
  config.risk.availableCapital = 100_000;
  config.risk.maxTradeAllocation = 100_000;
  config.risk.autoTradeTicketThreshold = 100_000;
  config.strategy.tradeCooldownMinutes = 0;
  config.strategy.skipFirstMinutes = 0;
  config.strategy.skipLastMinutes = 0;
  config.strategy.maxSimultaneousEntries = 5;
  config.strategy.volumeConfirmMultiplier = 0;
  // Raise ADX threshold so this synthetic oscillating test isn't blocked —
  // verifying the onCandle execution mechanics (not the regime filter).
  config.strategy.adxTrendThreshold = 60;

  const ledger = new Ledger('/tmp/bt-test');
  ledger.runMigrations();
  const notify = new NotificationService(ledger.raw(), config);
  const risk = new RiskEngine(config, ledger);
  const trader = new PaperTrader(config, ledger);
  const llm = new LlmManager(config.llm);
  const telegram = new TelegramHITL(config, llm, notify);
  const news = new NewsSentimentEngine(config, llm);
  const optionsTrader = new OptionsTrader(config, new OptionsEngine(config));
  const agent = new MarketAgent(config, new MockStreamer() as any, ledger, risk, trader, telegram, news, notify, optionsTrader);

  // Generate an oscillating candle series.
  const start = 1000;
  const candles: Candle[] = [];
  for (let i = 0; i < 120; i++) {
    const phase = (i / 120) * 2.5 * Math.PI * 2;
    const close = start + Math.sin(phase) * 70;
    candles.push({
      date: new Date('2026-01-01T10:00:00Z'),
      open: close - 1,
      high: close + 5,
      low: close - 5,
      close,
      volume: 100000,
    });
  }

  await agent.warmup('TEST', candles.slice(0, 30));
  for (let i = 30; i < candles.length; i++) {
    agent.onCandle('TEST', candles[i], candles[i].date);
  }

  // Diagnostic: what RSI/ADX values were seen?
  const rsi = (agent as any).rsiValues?.get('TEST');
  const adx = (agent as any).adxValues?.get('TEST');
  const atr = (agent as any).atrValues?.get('TEST');
  console.log(`Final indicators: RSI=${rsi?.toFixed(1)} ADX=${adx?.toFixed(1)} ATR=${atr?.toFixed(1)}`);
  console.log(`Volume samples: ${((agent as any).volumeSamples?.get('TEST') ?? []).length}`);
  const signals = ledger.raw().prepare(`SELECT direction, rsi_value, price, reason FROM signals`).all() as any[];
  console.log(`Signals recorded: ${signals.length}`);
  for (const s of signals.slice(0, 8)) console.log(`  SIGNAL ${s.direction} RSI=${s.rsi_value?.toFixed(1)} @${s.price} — ${(s.reason ?? '').slice(0, 80)}`);

  const trades = ledger.raw().prepare(`SELECT * FROM trades`).all() as any[];
  const riskEvents = ledger.raw().prepare(`SELECT details FROM risk_events`).all() as any[];
  console.log(`Risk events: ${riskEvents.length}`);
  for (const r of riskEvents.slice(0, 5)) console.log(`  BLOCKED: ${r.details}`);
  console.log(`\nTrades produced via onCandle: ${trades.length}`);
  for (const t of trades) {
    console.log(`  ${t.direction} ${t.quantity} @ ${t.price} pnl=${t.pnl} — ${t.reason}`);
  }
  console.log(trades.length > 0 ? '\n✅ onCandle backtest path works.' : '\n❌ No trades produced.');
  ledger.close();
  process.exit(trades.length > 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
