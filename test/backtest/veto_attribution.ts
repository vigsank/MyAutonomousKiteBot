/**
 * veto_attribution.ts — did the AI veto add or destroy value?
 *
 * The daily-cycle sim's reasoning layer vetoed 2 of the 6 momentum picks and
 * held them out for the whole window. That is the AI exercising exactly the
 * authority the design grants it. This script measures the cost: what the full
 * top-6 basket returned versus the 4 names that survived the veto.
 *
 * Usage: ENV_FILE=.env.test LOG_LEVEL=silent npx ts-node test/backtest/veto_attribution.ts
 */
import { loadConfig } from '../../src/server/AppConfig';
import { createHistoricalProvider } from '../../src/server/providers/factory';
import { ClosePoint } from '../../src/server/signals/momentum';

const START = process.env.START ?? '2026-07-27';
const END = process.env.END ?? '2026-08-14';
const TARGET = (process.env.TARGET ?? 'ADANIPOWER,ADANIENSOL,CUMMINSIND,BHARATFORG,BHEL,ADANIGREEN').split(',');
const VETOED = (process.env.VETOED ?? 'ADANIPOWER,ADANIGREEN').split(',');

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

async function main(): Promise<void> {
  const config = loadConfig();
  const provider = createHistoricalProvider(config);
  const to = new Date();
  const from = new Date(to.getTime() - 3 * 365 * 24 * 60 * 60 * 1000);

  const rets = new Map<string, number>();
  for (const sym of TARGET) {
    const inst = provider.findInstrument(sym, 'NSE');
    if (!inst) continue;
    const candles = await provider.getHistoricalData(inst.instrument_token, 'day', from, to);
    const pts: ClosePoint[] = candles
      .map((c) => ({ date: c.date.toISOString().slice(0, 10), close: c.close }))
      .filter((p) => Number.isFinite(p.close) && p.close > 0)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const at = (d: string): number | null => {
      let last: number | null = null;
      for (const p of pts) {
        if (p.date > d) break;
        last = p.close;
      }
      return last;
    };
    const p0 = at(START);
    const p1 = at(END);
    if (p0 && p1) rets.set(sym, ((p1 - p0) / p0) * 100);
  }

  const held = TARGET.filter((s) => !VETOED.includes(s) && rets.has(s));
  const blocked = VETOED.filter((s) => rets.has(s));
  const avg = (xs: string[]) => (xs.length ? xs.reduce((s, x) => s + rets.get(x)!, 0) / xs.length : 0);

  console.log(`\nVeto attribution — ${START} → ${END}\n${'='.repeat(56)}`);
  console.log('\n  Symbol        Return    Verdict');
  console.log('  ' + '-'.repeat(44));
  for (const sym of TARGET) {
    if (!rets.has(sym)) continue;
    const tag = VETOED.includes(sym) ? 'VETOED by AI' : 'held';
    console.log(`  ${sym.padEnd(13)} ${pct(rets.get(sym)!).padStart(7)}   ${tag}`);
  }

  const fullBasket = avg(TARGET.filter((s) => rets.has(s)));
  const heldOnly = avg(held);
  const vetoedOnly = avg(blocked);

  console.log(`\n  Full top-6 basket (no veto) : ${pct(fullBasket)}`);
  console.log(`  Survived the veto (4 names) : ${pct(heldOnly)}`);
  console.log(`  Vetoed names (2)            : ${pct(vetoedOnly)}`);
  console.log(`\n  Veto contribution           : ${pct(heldOnly - fullBasket)}`);
  console.log(
    `  ${heldOnly > fullBasket
      ? 'The AI veto ADDED value over this window.'
      : 'The AI veto DESTROYED value over this window.'}\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
