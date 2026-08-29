/**
 * indmoney_preopen_report.ts — verify the pre-open report now combines AI
 * sentiment + momentum (from live INDmoney data).
 *
 * Run:
 *   ENV_FILE=.env npx ts-node test/backtest/indmoney_preopen_report.ts
 */

import { loadConfig } from '../../src/server/AppConfig';
import { LlmManager } from '../../src/server/LlmManager';
import { NewsSentimentEngine } from '../../src/server/NewsSentimentEngine';
import { Ledger } from '../../src/server/Ledger';
import { RiskEngine } from '../../src/server/RiskEngine';
import { PaperTrader } from '../../src/server/PaperTrader';
import { DailyReportEngine } from '../../src/server/DailyReportEngine';
import { IndMoneyStreamer } from '../../src/server/brokers/IndMoneyStreamer';
import { computeMomentumMap } from '../../src/server/MomentumDataService';

const SYMBOLS = ['TITAN', 'BHARTIARTL', 'LT', 'WIPRO', 'SUNPHARMA'];

async function main(): Promise<void> {
  const config = loadConfig();
  const streamer = new IndMoneyStreamer(config);
  if (!streamer.isConfigured) {
    console.error('INDMONEY_ACCESS_TOKEN not set');
    process.exit(1);
  }
  await streamer.loadInstruments('NSE');

  const llm = new LlmManager(config.llm);
  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  const news = new NewsSentimentEngine(config, llm, ledger);
  const risk = new RiskEngine(config, ledger);
  const trader = new PaperTrader(config, ledger);
  const report = new DailyReportEngine(config, ledger, news, risk, llm);

  console.log('Computing momentum map from INDmoney...');
  const momentum = await computeMomentumMap(streamer, SYMBOLS, config.strategy.momentumLookbackMonths, 1);
  for (const [sym, mom] of momentum) {
    console.log(`  ${sym.padEnd(12)} momentum ${(mom * 100).toFixed(1)}%`);
  }

  console.log('\nGenerating pre-open report (AI sentiment + momentum)...');
  const r = await report.generate('pre_open', SYMBOLS, new Date(), undefined, momentum);
  if (!r) {
    console.error('Report generation returned null');
    process.exit(1);
  }

  console.log('\n=== PRE-OPEN REPORT ===');
  console.log(`Regime: ${r.market_regime.overall_sentiment} (${r.market_regime.regime_score})`);
  console.log(`Catalyst: ${r.market_regime.primary_catalyst}`);
  console.log(`Stocks to watch: ${r.stocks_to_watch.join(', ')}`);
  console.log('\nRecommendations:');
  for (const rec of r.portfolio_recommendations) {
    console.log(
      `  ${rec.symbol.padEnd(12)} ${rec.action_bias.padEnd(16)} sentiment ${rec.sentiment_score.toFixed(2)}  qty ${rec.suggested_quantity}  ₹${rec.suggested_allocation_inr}`,
    );
  }
  console.log(`\nSummary: ${r.summary}`);
}

main().catch((err) => {
  console.error('indmoney_preopen_report failed:', err);
  process.exit(1);
});
