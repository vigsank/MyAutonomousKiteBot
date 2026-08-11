/**
 * Test the live AI pipeline: Ollama LLM + Tavily search + RSS sentiment.
 * Usage: npx ts-node test/backtest/test_live_pipeline.ts
 */
import { loadConfig } from '../../src/server/AppConfig';
import { LlmManager } from '../../src/server/LlmManager';
import { NewsSentimentEngine } from '../../src/server/NewsSentimentEngine';
import { Ledger } from '../../src/server/Ledger';

async function main() {
  const config = loadConfig();
  console.log('=== CONFIG ===');
  console.log(`LLM provider: ${config.llm.provider} | model: ${config.llm.activeModel}`);
  console.log(`LLM configured: ${config.llm.enabled}`);
  console.log(`Tavily configured: ${config.tavily.enabled}`);
  console.log(`Backtest provider: ${process.env.BACKTEST_PROVIDER || 'yahoo'}`);

  const llm = new LlmManager(config.llm);
  const ledger = new Ledger(':memory:');
  ledger.runMigrations();

  // 1. Test Ollama directly.
  console.log('\n=== 1. OLLAMA TEST ===');
  try {
    const reply = await llm.chat('Reply with the single word: OK');
    console.log(`Ollama replied: ${reply.slice(0, 100)}`);
  } catch (e: any) {
    console.error('Ollama FAILED:', e?.message ?? e);
  }

  const news = new NewsSentimentEngine(config, llm, ledger);

  // 2. Test Tavily search.
  console.log('\n=== 2. TAVILY SEARCH TEST ===');
  try {
    const articles = await news.fetchTavilyArticles('INFY');
    console.log(`Tavily returned ${articles.length} articles for INFY:`);
    for (const a of articles.slice(0, 3)) {
      console.log(`  - ${a.title} (${a.source})`);
    }
  } catch (e: any) {
    console.error('Tavily FAILED:', e?.message ?? e);
  }

  // 3. Test full sentiment (RSS + Tavily + Ollama).
  console.log('\n=== 3. FULL SENTIMENT (RSS + Tavily + Ollama) ===');
  try {
    const res = await news.sentimentFor('INFY');
    console.log(`Symbol: ${res?.symbol}`);
    console.log(`Score: ${res?.score} | Label: ${res?.label}`);
    console.log(`Summary: ${res?.summary}`);
    console.log(`Sources: ${res?.sources.length}`);
  } catch (e: any) {
    console.error('Sentiment FAILED:', e?.message ?? e);
  }

  console.log('\n=== DONE ===');
}
main().catch((e) => { console.error(e); process.exit(1); });
