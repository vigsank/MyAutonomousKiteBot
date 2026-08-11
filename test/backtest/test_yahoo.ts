import { YahooFinanceProvider } from '../../src/server/providers/YahooFinanceProvider';

async function main() {
  const p = new YahooFinanceProvider();
  p.loadInstruments();
  const inst = p.findInstrument('INFY', 'NSE');
  const to = new Date();
  const from = new Date(to.getTime() - 10 * 24 * 60 * 60 * 1000);
  console.log(`Provider: ${p.name}, configured=${p.isConfigured}`);
  console.log(`Instrument: ${inst?.tradingsymbol} token=${inst?.instrument_token}`);
  try {
    const candles = await p.getHistoricalData(inst!.instrument_token, '5minute', from, to);
    console.log(`Fetched ${candles.length} 5-min candles for INFY.NS`);
    if (candles.length) {
      const first = candles[0], last = candles[candles.length - 1];
      console.log(`  first: ${first.date.toISOString()} close=${first.close}`);
      console.log(`  last:  ${last.date.toISOString()} close=${last.close}`);
    }
  } catch (e: any) {
    console.error('Fetch failed:', e?.message ?? e);
  }
}
main();
