/**
 * indmoney_tinyfish_momentum.ts — the AI-backed flow end-to-end on live data:
 *
 *   1. TinyFish (live web search) → fetch recent news for each liquid Nifty 50
 *      stock, then the LLM scores each into a sentiment score [-1, +1].
 *   2. Pick the top 5 by AI sentiment (most bullish news).
 *   3. INDmoney (INDstocks) → fetch real daily history for those 5.
 *   4. Momentum signal → rank them by trailing 12-month momentum (skip 1).
 *
 * Run:
 *   ENV_FILE=.env npx ts-node test/backtest/indmoney_tinyfish_momentum.ts
 */

import { loadConfig } from '../../src/server/AppConfig';
import { LlmManager } from '../../src/server/LlmManager';
import { NewsSentimentEngine } from '../../src/server/NewsSentimentEngine';
import { Ledger } from '../../src/server/Ledger';
import { IndMoneyStreamer } from '../../src/server/brokers/IndMoneyStreamer';
import { IndMoneyClient } from '../../src/server/brokers/IndMoneyClient';
import { rankByMomentum, MomentumInput } from '../../src/server/signals/momentum';

/** Liquid Nifty 50 constituents (NSE tickers) — the "top Nifty" universe. */
const NIFTY_LIQUID = [
  'RELIANCE', 'HDFCBANK', 'ICICIBANK', 'INFY', 'TCS', 'SBIN', 'BHARTIARTL',
  'KOTAKBANK', 'LT', 'AXISBANK', 'ITC', 'HINDUNILVR', 'BAJFINANCE', 'MARUTI',
  'SUNPHARMA', 'TITAN', 'TATASTEEL', 'TATAMOTORS', 'WIPRO', 'HCLTECH',
];

const LOOKBACK_MONTHS = 12;
const SKIP_MONTHS = 1;
const DATA_YEARS = 2;

async function main(): Promise<void> {
  const config = loadConfig();

  console.log('==============================================================');
  console.log('  AI-BACKED FLOW: TinyFish news → AI sentiment → INDmoney momentum');
  console.log('==============================================================');

  // --- 0. Verify the INDmoney token before doing any work -------------------
  const probe = new IndMoneyClient({
    accessToken: config.broker.indmoney.accessToken,
    baseUrl: config.broker.indmoney.baseUrl,
    timeoutMs: config.broker.indmoney.timeoutMs,
  });
  const tokenOk = await probe.verifyToken();
  if (!tokenOk) {
    console.error('\n❌ INDmoney token is invalid/expired. Regenerate it (24h) and retry.');
    process.exit(1);
  }
  console.log('    INDmoney token: OK');

  // --- 1. TinyFish + AI: score each Nifty stock's news sentiment ------------
  const llm = new LlmManager(config.llm);
  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  const news = new NewsSentimentEngine(config, llm, ledger);
  console.log(`    LLM: ${config.llm.provider} / ${config.llm.activeModel} (configured: ${llm.configured})`);

  console.log(`\n[1] TinyFish + AI: scoring ${NIFTY_LIQUID.length} liquid Nifty stocks...`);
  const scored: Array<{ symbol: string; score: number; label: string; summary: string }> = [];
  for (const sym of NIFTY_LIQUID) {
    const s = await news.sentimentFor(sym);
    if (!s) continue;
    scored.push({ symbol: sym, score: s.score, label: s.label, summary: s.summary });
    process.stdout.write(
      `    ${sym.padEnd(12)} ${s.score.toFixed(2).padStart(6)} (${s.label.padEnd(7)}) ${s.summary.slice(0, 60)}\n`,
    );
  }
  scored.sort((a, b) => b.score - a.score);
  const top5 = scored.slice(0, 5);

  console.log('\n    Top 5 Nifty stocks by AI sentiment:');
  for (const m of top5) {
    console.log(`      ${m.symbol.padEnd(12)} ${m.score.toFixed(2)} (${m.label})`);
  }

  // --- 2. INDmoney: fetch real daily history for the 5 ----------------------
  console.log('\n[2] INDmoney: loading instruments + fetching daily history...');
  const streamer = new IndMoneyStreamer(config);
  await streamer.loadInstruments('NSE');

  const to = new Date();
  const from = new Date(to.getTime() - DATA_YEARS * 365 * 24 * 60 * 60 * 1000);

  const inputs: MomentumInput[] = [];
  for (const m of top5) {
    const inst = streamer.findInstrument(m.symbol, 'NSE');
    if (!inst) {
      console.warn(`    ${m.symbol}: not in INDstocks master (skipped)`);
      continue;
    }
    const candles = await streamer.getHistoricalData(inst.instrument_token, 'day', from, to);
    const closes = candles.map((c) => ({
      date: c.date.toISOString().slice(0, 10),
      close: c.close,
    }));
    if (closes.length < 60) {
      console.warn(`    ${m.symbol}: insufficient history (${closes.length} days)`);
      continue;
    }
    inputs.push({ symbol: m.symbol, closes });
    console.log(`    ${m.symbol}: ${closes.length} daily closes fetched`);
  }

  // --- 3. Momentum: rank the 5 by trailing 12-month momentum ----------------
  console.log('\n[3] Momentum ranking (12m lookback, skip 1):');
  const ranked = rankByMomentum(inputs, LOOKBACK_MONTHS, SKIP_MONTHS);
  if (ranked.length === 0) {
    console.error('    No momentum scores computed.');
    process.exit(1);
  }
  for (const r of ranked) {
    console.log(`    ${r.symbol.padEnd(12)} momentum ${(r.momentum * 100).toFixed(1).padStart(7)}%`);
  }

  console.log('\n==============================================================');
  console.log(`  Top momentum pick: ${ranked[0].symbol} (${(ranked[0].momentum * 100).toFixed(1)}%)`);
  console.log('==============================================================');
}

main().catch((err) => {
  console.error('indmoney_tinyfish_momentum failed:', err);
  process.exit(1);
});
