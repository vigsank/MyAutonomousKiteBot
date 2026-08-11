/**
 * Use Tavily to research a robust, sector-diversified Indian stock watchlist
 * (equities + options). Prints findings; the results are used to build
 * data/watchlist.json.
 * Usage: npx ts-node test/backtest/research_watchlist.ts
 */
import { loadConfig } from '../../src/AppConfig';
import { tavily } from '@tavily/core';

async function main() {
  const config = loadConfig();
  if (!config.tavily.enabled) {
    console.error('Tavily not configured. Set TAVILY_API_KEY in .env');
    process.exit(1);
  }
  const client = tavily({ apiKey: config.tavily.apiKey });

  const queries = [
    'top NSE stocks by sector 2025 IT banking pharma auto FMCG energy metals India',
    'most liquid NSE stocks for options trading F&O list',
    'NSE options symbol format CE PE expiry strike example',
  ];

  for (const q of queries) {
    console.log(`\n=== QUERY: ${q} ===`);
    try {
      const res = await client.search(q, {
        searchDepth: 'advanced',
        maxResults: 5,
        topic: 'general',
        includeAnswer: true,
      });
      if (res.answer) console.log(`ANSWER: ${res.answer.slice(0, 500)}`);
      for (const r of res.results ?? []) {
        console.log(`- ${r.title}`);
        console.log(`  ${(r.content || '').slice(0, 300)}`);
      }
    } catch (e: any) {
      console.error('Tavily failed:', e?.message ?? e);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
