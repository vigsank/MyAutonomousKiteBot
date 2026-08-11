import * as http from 'http';
import { OpenBBProvider } from '../../src/providers/OpenBBProvider';

// Mock OpenBB server returning the documented historical REST shape.
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      results: [
        { date: '2024-01-01', open: 100, high: 102, low: 99, close: 101.5, volume: 1000 },
        { date: '2024-01-02', open: 101.5, high: 103, low: 100, close: 102, volume: 1200 },
        { date: '2024-01-03', open: 102, high: 104, low: 101, close: 103, volume: 1100 },
      ],
      provider: 'yfinance',
      warnings: [],
    }),
  );
});

async function main() {
  await new Promise<void>((r) => server.listen(6910, r));
  process.env.OPENBB_BASE_URL = 'http://127.0.0.1:6910';

  const p = new OpenBBProvider();
  p.loadInstruments();
  const inst = p.findInstrument('INFY', 'NSE');
  console.log(`Provider: ${p.name}, configured=${p.isConfigured}, token=${inst?.instrument_token}`);

  const candles = await p.getHistoricalData(
    inst!.instrument_token,
    '5minute',
    new Date('2024-01-01'),
    new Date('2024-01-05'),
  );
  console.log(`Fetched ${candles.length} candles:`);
  for (const c of candles) {
    console.log(`  ${c.date.toISOString().slice(0, 10)} O=${c.open} H=${c.high} L=${c.low} C=${c.close} V=${c.volume}`);
  }

  server.close();
  process.exit(candles.length === 3 ? 0 : 1);
}
main().catch((e) => { console.error(e); server.close(); process.exit(1); });
