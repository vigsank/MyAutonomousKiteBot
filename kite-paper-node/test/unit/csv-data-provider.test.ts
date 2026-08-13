import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CsvDataProvider } from '../../src/market/csv-data-provider';

const SAMPLE = `instrument_token,timestamp,last_price,open,high,low,close,volume,bid,ask,buy_quantity,sell_quantity
738561,2026-08-10T09:15:00.000Z,100,100,101,99,100,1000,100,100,500,500
738561,2026-08-10T09:16:00.000Z,101,100,102,100,101,1200,101,101,600,600
738561,2026-08-11T09:15:00.000Z,102,101,103,101,102,1100,102,102,550,550
738561,2026-08-11T09:16:00.000Z,103,102,104,102,103,1300,103,103,650,650
738561,2026-08-12T09:15:00.000Z,104,103,105,103,104,1400,104,104,700,700
738561,2026-08-12T09:16:00.000Z,105,104,106,104,105,1500,105,105,750,750
`;

describe('CsvDataProvider', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpn-csv-'));
    fs.writeFileSync(path.join(dir, 'RELIANCE_1min.csv'), SAMPLE);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loads CSVs and reports data presence', () => {
    const p = new CsvDataProvider(dir);
    p.load();
    expect(p.hasData(738561)).toBe(true);
    expect(p.hasData(999999)).toBe(false);
  });

  it('getLatestTick returns the latest day (live)', () => {
    const p = new CsvDataProvider(dir);
    p.load();
    const tick = p.getLatestTick(738561)!;
    // Latest day is 2026-08-12; last row close = 105.
    expect(tick.last_price).toBe(105);
    expect(tick.exchange_timestamp!.toISOString().slice(0, 10)).toBe('2026-08-12');
  });

  it('getHistoricalData returns only days before the latest day', () => {
    const p = new CsvDataProvider(dir);
    p.load();
    const candles = p.getHistoricalData(
      738561,
      'minute',
      new Date('2026-08-10T00:00:00Z'),
      new Date('2026-08-12T23:59:59Z')
    );
    // 4 rows from 08-10 and 08-11 (latest day 08-12 excluded).
    expect(candles.length).toBe(4);
    for (const c of candles) {
      expect(c[0].slice(0, 10)).not.toBe('2026-08-12');
    }
  });

  it('aggregates finer data up to a requested interval', () => {
    const p = new CsvDataProvider(dir);
    p.load();
    const candles = p.getHistoricalData(
      738561,
      '5minute',
      new Date('2026-08-10T00:00:00Z'),
      new Date('2026-08-12T23:59:59Z')
    );
    // 2 days × 1 bucket each (2 rows per day aggregate into 1 5-min candle).
    expect(candles.length).toBe(2);
  });
});
