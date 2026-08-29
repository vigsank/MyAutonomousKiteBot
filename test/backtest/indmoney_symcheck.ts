/**
 * indmoney_symcheck.ts — debug symbol resolution against the INDstocks master.
 * Loads the NSE instrument CSV and checks which watchlist symbols resolve, and
 * prints close/NSE-standard matches for the ones that don't.
 *
 * Run: BACKTEST_PROVIDER=indmoney npx ts-node test/backtest/indmoney_symcheck.ts
 */
import { loadConfig } from '../../src/server/AppConfig';
import { IndMoneyStreamer } from '../../src/server/brokers/IndMoneyStreamer';

async function main(): Promise<void> {
  const config = loadConfig();
  const streamer = new IndMoneyStreamer(config);
  if (!streamer.isConfigured) {
    console.error('INDMONEY_ACCESS_TOKEN not set');
    process.exit(1);
  }
  await streamer.loadInstruments('NSE');

  const symbols = config.watchlist.filter((s) => s.enabled).map((s) => s.tradingsymbol);
  const notFound: string[] = [];
  for (const sym of symbols) {
    if (!streamer.findInstrument(sym, 'NSE')) notFound.push(sym);
  }
  console.log(`Resolved ${symbols.length - notFound.length}/${symbols.length}; not found: ${notFound.length}`);

  // NSE-standard symbol candidates for the common mismatches.
  const candidates: Record<string, string[]> = {
    INFOSYS: ['INFY', 'INFOSYS'],
    REC: ['RECLTD', 'REC'],
    SHREEBACEM: ['SHREECEM', 'SHREEBACEM'],
    LTIM: ['LTIM', 'LTIMINDIA'],
  };

  for (const sym of notFound) {
    const inst = streamer.findInstrument(sym, 'NSE');
    if (inst) {
      console.log(`  ${sym}: actually FOUND (token ${inst.instrument_token})`);
      continue;
    }
    const alts = candidates[sym] ?? [sym];
    const tried = alts.map((c) => {
      const i = streamer.findInstrument(c, 'NSE');
      return i ? `${c}->${i.instrument_token}` : `${c}->(none)`;
    });
    // Prefix-match against the loaded master to reveal the real symbol format.
    const base = sym.slice(0, 5);
    const map = (streamer as any).instruments as Map<number, any>;
    const close = [...map.values()]
      .filter((i) => i.tradingsymbol.toUpperCase().includes(base.toUpperCase()))
      .slice(0, 8)
      .map((i) => `${i.tradingsymbol}(${i.security_id})`);
    console.log(`  ${sym}: not found | candidates: ${tried.join(', ')} | master contains: ${close.join(', ') || '(none)'}`);
  }

  // Raw CSV probe: confirm whether the concerning symbols are truly absent.
  const raw = await fetch(
    `${config.broker.indmoney.baseUrl}/market/instruments?source=equity`,
    { headers: { Authorization: config.broker.indmoney.accessToken } },
  );
  const csv = await raw.text();
  console.log('\nRaw CSV probes (TRADING_SYMBOL column):');
  for (const probe of ['HDFCBANK', 'WIPRO', 'YESBANK', 'ZYDUSLIFE', 'TATAMOT', 'ZOMATO', 'GMRINFRA', 'GUJGASLTD', 'JSWELEC', 'LTIM', 'BERGEPAINT']) {
    const lines = csv.split(/\r?\n/).filter((l) => l.includes(probe));
    const sample = lines
      .slice(0, 1)
      .map((l) => l.split(',').map((c) => c.trim()).slice(0, 8).join('|'))
      .join('  ::  ');
    console.log(`  ${probe}: ${lines.length} row(s)  [${sample}]`);
  }
  // Show first and last few TRADING_SYMBOLs to assess alphabetical completeness.
  const cols = csv.split(/\r?\n/).filter((l) => l.trim()).slice(1).map((l) => l.split(',')[5]?.trim()).filter(Boolean);
  console.log(`\nTotal data rows: ${cols.length}`);
  console.log(`First 3 symbols: ${cols.slice(0, 3).join(', ')}`);
  console.log(`Last 3 symbols:  ${cols.slice(-3).join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
