/**
 * sim_12m_sip.ts — 12-month SIP momentum simulation
 *
 * Reads _1d.csv files directly from kite-paper-node/data.
 * Starts with ₹10,000. Adds ₹10,000 every month for 12 months.
 * Runs the validated momentum strategy (12-month lookback, skip-1,
 * hysteresis band=8, topN=5) on the full NSE watchlist.
 *
 * Usage:
 *   ENV_FILE=.env.test npx ts-node test/backtest/sim_12m_sip.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { resolveDataDir } from './_dataDir';

// ── constants ──────────────────────────────────────────────────────────────
const DATA_DIR    = resolveDataDir();
const OUT_FILE    = path.join(__dirname, 'results/sim_12m_sip_report.md');
const TOP_N       = 5;
const BAND        = 8;          // hysteresis band (validated OOS setting)
const LOOKBACK    = 12;         // months
const SKIP        = 1;          // skip-1 month
const MONTHLY_SIP = 10_000;     // ₹ added each month
const ONE_WAY_COST = 0.00155;   // 0.155% one-way (brokerage+STT+slippage)
const STCG_RATE   = 0.20;       // short-term capital gains tax

interface ClosePoint { date: string; close: number; }
interface Holding    { value: number; cost: number; entryDate: string; }

// ── CSV loader ────────────────────────────────────────────────────────────
function loadCsv(symbol: string): ClosePoint[] {
  const file = path.join(DATA_DIR, `${symbol}_1d.csv`);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').slice(1);
  const pts: ClosePoint[] = [];
  for (const line of lines) {
    const cols = line.split(',');
    const ts   = cols[1]?.trim();
    const cl   = parseFloat(cols[6]?.trim() ?? '');
    if (!ts || !Number.isFinite(cl) || cl <= 0) continue;
    pts.push({ date: ts.slice(0, 10), close: cl });
  }
  return pts.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function closeOnOrBefore(pts: ClosePoint[], date: string): number | null {
  let last: number | null = null;
  for (const p of pts) {
    if (p.date <= date) last = p.close;
    else break;
  }
  return last;
}

function addMonths(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

// ── momentum ranker (adaptive lookback) ────────────────────────────────────
// Uses the longest available lookback up to LOOKBACK months, minimum 2 months.
// This lets the strategy deploy from month 3 onwards instead of waiting 13 months.
function rankMomentum(
  closes: Map<string, ClosePoint[]>,
  asOf: string,
): Array<{ symbol: string; mom: number }> {
  const scored: Array<{ symbol: string; mom: number; lookback: number }> = [];
  for (const [sym, pts] of closes) {
    // Try the full validated lookback first, then fall back progressively
    for (let lb = LOOKBACK; lb >= 2; lb--) {
      const start = closeOnOrBefore(pts, addMonths(asOf, -(lb + SKIP)));
      const end   = closeOnOrBefore(pts, addMonths(asOf, -SKIP));
      if (start && end && start > 0) {
        scored.push({ symbol: sym, mom: end / start - 1, lookback: lb });
        break;
      }
    }
  }
  return scored.sort((a, b) => b.mom - a.mom);
}

function selectWithHysteresis(
  ranked: Array<{ symbol: string; mom: number }>,
  held: Set<string>,
): string[] {
  const rank = new Map(ranked.map((s, i) => [s.symbol, i]));
  const target = new Set<string>();
  // incumbents keep their seat while inside the wider band
  for (const sym of held) {
    const r = rank.get(sym);
    if (r !== undefined && r < TOP_N + BAND) target.add(sym);
  }
  // fill remaining slots from top
  for (const s of ranked) {
    if (target.size >= TOP_N) break;
    target.add(s.symbol);
  }
  // if over-full, drop worst-ranked incumbents
  if (target.size > TOP_N) {
    const ordered = [...target].sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999));
    return ordered.slice(0, TOP_N);
  }
  return [...target];
}

// ── main simulation ─────────────────────────────────────────────────────────
function main(): void {
  // 1. load all _1d.csv files
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('_1d.csv'));
  const closes = new Map<string, ClosePoint[]>();
  for (const f of files) {
    const sym = f.replace('_1d.csv', '');
    const pts = loadCsv(sym);
    if (pts.length >= 20) closes.set(sym, pts);
  }
  console.log(`Loaded ${closes.size} symbols from CSVs.`);

  // 2. sorted trading dates
  const allDatesSet = new Set<string>();
  for (const pts of closes.values()) for (const p of pts) allDatesSet.add(p.date);
  const allDates = [...allDatesSet].sort();
  const FIRST_DATE = allDates[0];
  const LAST_DATE  = allDates[allDates.length - 1];
  console.log(`Date range: ${FIRST_DATE} → ${LAST_DATE} (${allDates.length} trading days)`);

  // 3. rebalance dates = first trading day of each calendar month,
  //    BUT only from the first month where we have >= 2 months of price
  //    history (so momentum ranking is computable on Day 1 of the SIP).
  //    Everything before that is lookback data, not trading months.
  const allMonthStarts: string[] = [];
  let prevMonth = '';
  for (const d of allDates) {
    const mo = d.slice(0, 7);
    if (mo !== prevMonth) { allMonthStarts.push(d); prevMonth = mo; }
  }

  // Find the first month-start where at least 2 months of prior data exist.
  const csvStart = allDates[0];
  const rebalDates: string[] = [];
  for (const d of allMonthStarts) {
    const csvStartDt = new Date(csvStart + 'T00:00:00Z');
    const dDt        = new Date(d + 'T00:00:00Z');
    const monthsAvail = (dDt.getUTCFullYear() - csvStartDt.getUTCFullYear()) * 12
                      + (dDt.getUTCMonth() - csvStartDt.getUTCMonth());
    if (monthsAvail >= 2) rebalDates.push(d);
  }
  console.log(`CSV starts:      ${csvStart} (used as lookback baseline)`);
  console.log(`SIP Month 1:     ${rebalDates[0]} (first month with enough history to rank)`);
  console.log(`Trading months:  ${rebalDates.length}`);
  console.log(`Rebalance dates: ${rebalDates.join(', ')}\n`);

  // 4. simulate
  let cash = 0;
  // holdings[sym].value is marked to the PREVIOUS rebalance date's close
  // (updated by the carry step at end of each month)
  const holdings = new Map<string, Holding>();
  let totalDeposited = 0;
  let totalTax = 0;

  const monthRows: string[] = [];
  const perDayLog: string[] = [];

  for (let mi = 0; mi < rebalDates.length; mi++) {
    const rebalDate = rebalDates[mi];
    const nextDate  = rebalDates[mi + 1] ?? LAST_DATE;

    // ── SIP deposit ──────────────────────────────────────────────────────
    cash += MONTHLY_SIP;
    totalDeposited += MONTHLY_SIP;

    // ── equity at start of this month (holdings already carried forward) ─
    const equityStart = cash + [...holdings.values()].reduce((s, h) => s + h.value, 0);

    // ── momentum ranking ─────────────────────────────────────────────────
    const ranked   = rankMomentum(closes, rebalDate);
    const heldSyms = new Set(holdings.keys());
    const target   = ranked.length >= TOP_N
      ? selectWithHysteresis(ranked, heldSyms)
      : ranked.slice(0, Math.min(TOP_N, ranked.length)).map(r => r.symbol);
    const targetSet = new Set(target);

    // ── sell exits ───────────────────────────────────────────────────────
    const sells: string[] = [];
    for (const [sym, h] of [...holdings]) {
      if (targetSet.has(sym)) continue;
      const px = closeOnOrBefore(closes.get(sym) ?? [], rebalDate);
      if (!px || px <= 0) continue;
      const realized = h.value - h.cost;
      if (realized > 0) totalTax += realized * STCG_RATE;
      cash += h.value * (1 - ONE_WAY_COST);
      holdings.delete(sym);
      sells.push(sym);
    }

    // ── buy entries (equal-weight across target slots) ───────────────────
    const equityAfterSells = cash + [...holdings.values()].reduce((s, h) => s + h.value, 0);
    const newSlots  = target.filter(s => !holdings.has(s)).length;
    const heldSlots = holdings.size;
    const totalSlots = heldSlots + newSlots;
    const perName   = totalSlots > 0 ? equityAfterSells / totalSlots : 0;

    const buys: string[] = [];
    for (const sym of target) {
      if (holdings.has(sym)) continue; // already held
      const px = closeOnOrBefore(closes.get(sym) ?? [], rebalDate);
      if (!px || px <= 0) continue;
      const spend = Math.min(perName, cash);
      if (spend < 50) { continue; }
      cash -= spend * (1 + ONE_WAY_COST);
      holdings.set(sym, { value: spend, cost: spend, entryDate: rebalDate });
      buys.push(sym);
    }

    // ── carry holdings to end of month ───────────────────────────────────
    for (const [sym, h] of holdings) {
      const p0 = closeOnOrBefore(closes.get(sym) ?? [], rebalDate);
      const p1 = closeOnOrBefore(closes.get(sym) ?? [], nextDate);
      if (p0 && p1 && p0 > 0) h.value *= p1 / p0;
    }

    const equityEnd    = cash + [...holdings.values()].reduce((s, h) => s + h.value, 0);
    const monthReturn  = equityStart > 0 ? (equityEnd - equityStart) / equityStart : 0;
    const heldNames    = [...holdings.keys()].join(', ') || '(none)';

    // ── month table row ──────────────────────────────────────────────────
    monthRows.push(
      `| ${mi + 1} | ${rebalDate} | ${nextDate} ` +
      `| ₹${MONTHLY_SIP.toLocaleString('en-IN')} ` +
      `| ₹${totalDeposited.toLocaleString('en-IN')} ` +
      `| ${buys.join(', ') || '—'} ` +
      `| ${sells.join(', ') || '—'} ` +
      `| ${heldNames} ` +
      `| ${(monthReturn * 100).toFixed(2)}% ` +
      `| ₹${Math.round(equityEnd).toLocaleString('en-IN')} |`
    );

    // ── per-month detail ─────────────────────────────────────────────────
    perDayLog.push(`\n### Month ${mi + 1} — ${rebalDate} → ${nextDate}`);
    perDayLog.push(`- **SIP deposit this month:** ₹${MONTHLY_SIP.toLocaleString('en-IN')}  |  **Total invested so far:** ₹${totalDeposited.toLocaleString('en-IN')}`);
    perDayLog.push(`- **Portfolio value at month start (after deposit):** ₹${Math.round(equityStart).toLocaleString('en-IN')}`);
    const top5 = ranked.slice(0, 5).map((r: any, i: number) => `${i + 1}. ${r.symbol} (${(r.mom * 100).toFixed(1)}%, ${r.lookback}m)`).join(', ');
    perDayLog.push(`- **Top-5 momentum scores (12m lookback, skip-1):** ${top5}`);
    perDayLog.push(`- **Selected portfolio:** ${target.join(', ') || '(none — insufficient lookback data)'}`);
    if (buys.length)  perDayLog.push(`- **Bought:** ${buys.join(', ')}`);
    if (sells.length) perDayLog.push(`- **Sold:** ${sells.join(', ')}`);
    if (!buys.length && !sells.length) perDayLog.push(`- **No changes** (all holdings retained by hysteresis)`);
    perDayLog.push(`- **Month return:** ${(monthReturn * 100).toFixed(2)}%`);
    perDayLog.push(`- **Portfolio value at month end:** ₹${Math.round(equityEnd).toLocaleString('en-IN')}`);
    perDayLog.push(`- **Open positions:** ${heldNames}`);
  }

  // 5. final mark-to-market
  const finalEquity = cash + [...holdings.values()].reduce((s, h) => s + h.value, 0);
  const unrealizedGain = [...holdings.values()].reduce((s, h) => s + (h.value - h.cost), 0);
  const totalGain   = finalEquity - totalDeposited;
  const netAfterTax = finalEquity - totalTax;

  // 6. build report
  const lines: string[] = [];
  lines.push('# 12-Month SIP Momentum Simulation Report');
  lines.push('');
  lines.push('> **Strategy:** Cross-sectional momentum | up to 12-month lookback (adaptive: uses all available history, min 2 months) | skip-1 month | top-5 | hysteresis band 8');
  lines.push(`> **SIP:** ₹10,000/month × ${rebalDates.length} months (Month 1 = ${rebalDates[0]}, first month with rankable history) | **Total invested:** ₹${totalDeposited.toLocaleString('en-IN')}`);
  lines.push(`> **Lookback baseline:** CSV data from ${FIRST_DATE} used as price history; SIP starts when 2+ months of history are available`);
  lines.push(`> **Data:** Real NSE daily closes from kite-paper-node CSVs (${FIRST_DATE} → ${LAST_DATE})`);
  lines.push(`> **Costs:** ${(ONE_WAY_COST * 100).toFixed(3)}% one-way (brokerage + STT + slippage)`);
  lines.push(`> **Tax:** STCG 20% on realized gains at point of sale`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| Total invested (SIP) | ₹${totalDeposited.toLocaleString('en-IN')} |`);
  lines.push(`| Final portfolio value | ₹${Math.round(finalEquity).toLocaleString('en-IN')} |`);
  lines.push(`| Total gain / loss | ₹${Math.round(totalGain).toLocaleString('en-IN')} (${((totalGain / totalDeposited) * 100).toFixed(2)}%) |`);
  lines.push(`| Tax paid on realized gains | ₹${Math.round(totalTax).toLocaleString('en-IN')} |`);
  lines.push(`| Net value after realized tax | ₹${Math.round(netAfterTax).toLocaleString('en-IN')} |`);
  lines.push(`| Unrealized gain (still open) | ₹${Math.round(unrealizedGain).toLocaleString('en-IN')} |`);
  lines.push(`| Months simulated | ${rebalDates.length} |`);
  lines.push('');
  lines.push('## Per-Month Table');
  lines.push('');
  lines.push('| Mo | Rebal date | End date | Deposit | Invested | Buys | Sells | Holdings | Return | Value |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of monthRows) lines.push(r);
  lines.push('');
  lines.push('## Per-Month Detail');
  for (const l of perDayLog) lines.push(l);
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- **No idle cash at start.** The SIP begins on the first month where enough price history');
  lines.push('  exists to compute momentum rankings. All prior CSV data serves as lookback baseline only.');
  lines.push('- The adaptive lookback grows from 2 months in Month 1 toward 12 months by Month 11.');
  lines.push('  Rankings improve in quality each month as more history accumulates.');
  lines.push('- Small early tickets (Month 1 = \u20b910k across 5 names = \u20b92k each) have higher cost%.');
  lines.push('  This is real: small capital means costs bite harder — confirms GoLiveLadder \u20b925k minimum.');
  lines.push('- Tax is charged only on realized gains at point of sale.');
  lines.push('- Hysteresis band=8 keeps incumbents ranked within 1–13 to reduce turnover and costs.');

  const report = lines.join('\n');
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, report);
  console.log(report);
  console.log(`\n✔ Report written to: ${OUT_FILE}`);
}


main();
