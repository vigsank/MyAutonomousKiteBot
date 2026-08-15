/**
 * News-source probe — tests TinyFish search (+ page fetch) and Google News RSS
 * for one symbol, and writes TWO separate reports:
 *   test/probe_results/tinyfish_report.txt
 *   test/probe_results/rss_report.txt
 *
 * Usage: npx ts-node test/news_probe.ts [SYMBOL]
 */
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../src/server/AppConfig';
import { Ledger } from '../src/server/Ledger';
import { LlmManager } from '../src/server/LlmManager';
import { NewsSentimentEngine } from '../src/server/NewsSentimentEngine';

const OUT_DIR = path.join(process.cwd(), 'test', 'probe_results');

async function main(): Promise<void> {
  const symbol = (process.argv[2] || 'RELIANCE').toUpperCase();
  const config = loadConfig();
  const ledger = new Ledger(':memory:');
  ledger.runMigrations();
  const llm = new LlmManager(config.llm);
  const news = new NewsSentimentEngine(config, llm, ledger);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // =====================================================================
  // REPORT 1 — TinyFish (search + per-page content via Fetch API)
  // =====================================================================
  const tf: string[] = [];
  tf.push(`TinyFish probe report — symbol: ${symbol}`);
  tf.push(`TINYFISH enabled=${config.tinyfish.enabled} (key len=${config.tinyfish.apiKey.length})`);
  tf.push('='.repeat(70));

  const tfStart = Date.now();
  const tfArticles = await news.fetchTinyFishArticles(symbol);
  tf.push(`\n### SEARCH RESULTS — ${tfArticles.length} article(s) in ${Date.now() - tfStart}ms`);
  if (tfArticles.length === 0) tf.push('  (no results — check TINYFISH_API_KEY / network)');

  for (let i = 0; i < tfArticles.length; i++) {
    const a = tfArticles[i];
    tf.push(`\n[${i + 1}] ${a.title}`);
    tf.push(`    link: ${a.link}`);
    tf.push(`    summary: ${(a.summary ?? '').slice(0, 300)}`);
    tf.push(`    pubDate: ${a.pubDate ?? 'n/a'}`);

    // Continuation: fetch the page content via TinyFish Fetch API.
    tf.push(`    --- page content (TinyFish Fetch) ---`);
    const pageStart = Date.now();
    const content = await news.fetchPage(a.link);
    if (content) {
      const excerpt = content.replace(/\s+/g, ' ').trim().slice(0, 600);
      tf.push(`    fetched in ${Date.now() - pageStart}ms, ${content.length} chars`);
      tf.push(`    excerpt: ${excerpt}`);
    } else {
      tf.push(`    (fetch failed / no content in ${Date.now() - pageStart}ms)`);
    }
  }

  const tfFile = path.join(OUT_DIR, 'tinyfish_report.txt');
  fs.writeFileSync(tfFile, tf.join('\n'), 'utf-8');

  // =====================================================================
  // REPORT 2 — Google News RSS
  // =====================================================================
  const rss: string[] = [];
  rss.push(`Google News RSS probe report — symbol: ${symbol}`);
  rss.push('='.repeat(70));

  const gnStart = Date.now();
  const gnArticles = await news.fetchGoogleNewsArticles(symbol);
  rss.push(`\n### RSS RESULTS — ${gnArticles.length} article(s) in ${Date.now() - gnStart}ms`);
  if (gnArticles.length === 0) rss.push('  (no results — feed may be blocked)');

  for (let i = 0; i < gnArticles.length; i++) {
    const a = gnArticles[i];
    rss.push(`\n[${i + 1}] ${a.title}`);
    rss.push(`    link: ${a.link}`);
    rss.push(`    summary: ${(a.summary ?? '').slice(0, 300)}`);
    rss.push(`    pubDate: ${a.pubDate ?? 'n/a'}`);

    // Continuation: fetch the real page content via TinyFish Fetch API.
    rss.push(`    --- page content (TinyFish Fetch) ---`);
    const pageStart = Date.now();
    const content = await news.fetchPage(a.link);
    if (content) {
      const excerpt = content.replace(/\s+/g, ' ').trim().slice(0, 600);
      rss.push(`    fetched in ${Date.now() - pageStart}ms, ${content.length} chars`);
      rss.push(`    excerpt: ${excerpt}`);
    } else {
      rss.push(`    (fetch failed / no content in ${Date.now() - pageStart}ms)`);
    }
  }

  const rssFile = path.join(OUT_DIR, 'rss_report.txt');
  fs.writeFileSync(rssFile, rss.join('\n'), 'utf-8');

  console.log(`Wrote TinyFish report: ${tfFile}`);
  console.log(`Wrote RSS report:      ${rssFile}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
