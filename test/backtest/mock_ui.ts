/**
 * Mock UI runner — seeds a throwaway SQLite ledger with a large volume of
 * realistic-looking data, boots the dashboard against it, and cleans up on exit.
 *
 * Usage:
 *   npm run build:ui        # build the client once (served by the UI server)
 *   npm run mock:ui         # seed + start UI on http://localhost:3000
 *
 * The mock DB lives in data/mock_ui/ and is deleted when the app is stopped
 * (Ctrl+C / SIGTERM), so your real ledger is never touched.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Ledger } from '../../src/server/Ledger';
import { startUiServer } from '../../src/server/api/server';
import { loadConfig } from '../../src/server/AppConfig';

/* ==================================================================== */
/* Mock universe                                                         */
/* ==================================================================== */

interface MockSymbol {
  symbol: string;
  exchange: string;
  segment: string;
  type: string;
  base: number;
}

const SYMBOLS: MockSymbol[] = [
  { symbol: 'NIFTY', exchange: 'NSE', segment: 'NSE', type: 'IDX', base: 24000 },
  { symbol: 'BANKNIFTY', exchange: 'NSE', segment: 'NSE', type: 'IDX', base: 52000 },
  { symbol: 'RELIANCE', exchange: 'NSE', segment: 'NSE', type: 'EQ', base: 2900 },
  { symbol: 'TCS', exchange: 'NSE', segment: 'NSE', type: 'EQ', base: 4100 },
  { symbol: 'INFY', exchange: 'NSE', segment: 'NSE', type: 'EQ', base: 1800 },
  { symbol: 'HDFCBANK', exchange: 'NSE', segment: 'NSE', type: 'EQ', base: 1650 },
  { symbol: 'SBIN', exchange: 'NSE', segment: 'NSE', type: 'EQ', base: 800 },
  { symbol: 'TATAMOTORS', exchange: 'NSE', segment: 'NSE', type: 'EQ', base: 950 },
];

const MOCK_DIR = path.join(process.cwd(), 'data', 'mock_ui');
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

/* ==================================================================== */
/* Random-walk helpers                                                  */
/* ==================================================================== */

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function iso(ts: number) {
  return new Date(ts).toISOString();
}

function dateOnly(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Generate `n` OHLCV candles as a random walk from `base`. */
function genCandles(base: number, n: number, startTs: number, stepMs: number) {
  const out: { ts: number; open: number; high: number; low: number; close: number; volume: number }[] = [];
  let price = base;
  for (let i = 0; i < n; i++) {
    const open = price;
    const close = Math.max(1, open + (Math.random() - 0.5) * base * 0.004);
    const high = Math.max(open, close) * (1 + Math.random() * 0.003);
    const low = Math.min(open, close) * (1 - Math.random() * 0.003);
    const volume = Math.floor(rand(1000, 20000));
    out.push({ ts: startTs + i * stepMs, open, high, low, close, volume });
    price = close;
  }
  return out;
}

/* ==================================================================== */
/* Seeding                                                               */
/* ==================================================================== */

function seed(db: ReturnType<Ledger['raw']>) {
  const insert = db.transaction(() => {
    // --- Instruments ---------------------------------------------------
    const insInst = db.prepare(
      `INSERT INTO instruments (token, tradingsymbol, exchange, segment, instrument_type, name, lot_size, tick_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const instIds = new Map<string, number>();
    SYMBOLS.forEach((s, i) => {
      const token = 100000 + i;
      const res = insInst.run(token, s.symbol, s.exchange, s.segment, s.type, s.symbol, 1, 0.05);
      instIds.set(s.symbol, Number(res.lastInsertRowid));
    });

    // --- Watchlist -----------------------------------------------------
    const insWatch = db.prepare(
      `INSERT INTO watchlist (instrument_id, quantity, enabled) VALUES (?, ?, 1)`,
    );
    for (const s of SYMBOLS) insWatch.run(instIds.get(s.symbol)!, 1);

    // --- Candles (5min for 3 symbols, daily for all) --------------------
    const insCandle = db.prepare(
      `INSERT INTO candles (instrument_id, interval, open, high, low, close, volume, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const fiveMin = 5 * 60 * 1000;
    for (const s of SYMBOLS.slice(0, 3)) {
      const id = instIds.get(s.symbol)!;
      const candles = genCandles(s.base, 800, NOW - 800 * fiveMin, fiveMin);
      for (const c of candles) {
        insCandle.run(id, '5minute', c.open, c.high, c.low, c.close, c.volume, iso(c.ts));
      }
    }
    for (const s of SYMBOLS) {
      const id = instIds.get(s.symbol)!;
      const candles = genCandles(s.base, 120, NOW - 120 * DAY, DAY);
      for (const c of candles) {
        insCandle.run(id, 'day', c.open, c.high, c.low, c.close, c.volume, iso(c.ts));
      }
    }

    // --- Ticks (live ticker) -------------------------------------------
    const insTick = db.prepare(
      `INSERT INTO ticks (instrument_id, last_price, volume_traded, oi, change, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const s of SYMBOLS) {
      const id = instIds.get(s.symbol)!;
      let price = s.base;
      for (let i = 0; i < 600; i++) {
        price = Math.max(1, price + (Math.random() - 0.5) * s.base * 0.001);
        insTick.run(id, price, Math.floor(rand(1000, 50000)), Math.floor(rand(0, 50000)), rand(-2, 2), iso(NOW - (600 - i) * 1000));
      }
    }

    // --- Positions (open) ----------------------------------------------
    const insPos = db.prepare(
      `INSERT INTO positions (instrument_id, quantity, avg_price, direction, entry_time, status)
       VALUES (?, ?, ?, ?, ?, 'OPEN')`,
    );
    const openPositions = [
      { sym: 'RELIANCE', qty: 20, price: 2880, dir: 'LONG' },
      { sym: 'TCS', qty: 15, price: 4050, dir: 'LONG' },
      { sym: 'INFY', qty: 30, price: 1820, dir: 'LONG' },
      { sym: 'HDFCBANK', qty: 25, price: 1680, dir: 'LONG' },
      { sym: 'SBIN', qty: 60, price: 810, dir: 'SHORT' },
      { sym: 'TATAMOTORS', qty: 40, price: 960, dir: 'LONG' },
    ];
    for (const p of openPositions) {
      insPos.run(instIds.get(p.sym)!, p.qty, p.price, p.dir, iso(NOW - rand(1, 4) * DAY));
    }

    // --- Orders ---------------------------------------------------------
    const insOrder = db.prepare(
      `INSERT INTO orders (order_id, instrument_id, side, quantity, price, ticket_size, status, variety, order_type, product, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'regular', 'MARKET', 'CNC', ?, ?)`,
    );
    for (let i = 0; i < 300; i++) {
      const s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const status = ['FILLED', 'FILLED', 'FILLED', 'REJECTED', 'PENDING'][Math.floor(Math.random() * 5)];
      const qty = Math.floor(rand(5, 50));
      const price = s.base * rand(0.98, 1.02);
      insOrder.run(
        `ORD-${String(i + 1).padStart(5, '0')}`,
        instIds.get(s.symbol)!,
        side,
        qty,
        price,
        0.05,
        status,
        `Mock ${side.toLowerCase()} order`,
        iso(NOW - rand(0, 30) * DAY),
      );
    }

    // --- Trades ---------------------------------------------------------
    const insTrade = db.prepare(
      `INSERT INTO trades (trade_id, instrument_id, direction, quantity, price, ticket_size, pnl, status, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'FILLED', ?, ?)`,
    );
    for (let i = 0; i < 300; i++) {
      const s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const dir = Math.random() > 0.5 ? 'LONG' : 'SHORT';
      const qty = Math.floor(rand(5, 50));
      const price = s.base * rand(0.98, 1.02);
      const pnl = (Math.random() - 0.42) * qty * s.base * 0.01;
      insTrade.run(
        `TRD-${String(i + 1).padStart(5, '0')}`,
        instIds.get(s.symbol)!,
        dir,
        qty,
        price,
        0.05,
        pnl,
        `Mock ${dir.toLowerCase()} fill`,
        iso(NOW - rand(0, 30) * DAY),
      );
    }

    // --- Signals --------------------------------------------------------
    const insSignal = db.prepare(
      `INSERT INTO signals (instrument_id, direction, rsi_value, price, sentiment_score, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (let i = 0; i < 300; i++) {
      const s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const dir = ['LONG', 'SHORT', 'NEUTRAL'][Math.floor(Math.random() * 3)];
      const rsi = Math.floor(rand(20, 80));
      insSignal.run(
        instIds.get(s.symbol)!,
        dir,
        rsi,
        s.base * rand(0.98, 1.02),
        rand(-1, 1),
        `RSI ${rsi} ${dir === 'LONG' ? 'oversold bounce' : dir === 'SHORT' ? 'overbought fade' : 'range-bound'}`,
        iso(NOW - rand(0, 30) * DAY),
      );
    }

    // --- Risk events ----------------------------------------------------
    const insRisk = db.prepare(
      `INSERT INTO risk_events (instrument_id, event_type, details, created_at)
       VALUES (?, ?, ?, ?)`,
    );
    const riskTypes = ['DRAWDOWN', 'ALLOCATION', 'CIRCUIT_BREAKER', 'COOLDOWN', 'CAPITAL_LIMIT'];
    for (let i = 0; i < 200; i++) {
      const s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const type = riskTypes[Math.floor(Math.random() * riskTypes.length)];
      insRisk.run(
        instIds.get(s.symbol)!,
        type,
        `Mock risk gate: ${type.toLowerCase()} triggered for ${s.symbol}`,
        iso(NOW - rand(0, 30) * DAY),
      );
    }

    // --- Notifications --------------------------------------------------
    const insNotif = db.prepare(
      `INSERT INTO notifications (channel, severity, title, body, metadata, telegram_sent)
       VALUES ('DB', ?, ?, ?, ?, 0)`,
    );
    const severities = ['INFO', 'TRADE', 'WARN', 'SENTIMENT', 'APPROVAL', 'ERROR'];
    for (let i = 0; i < 200; i++) {
      const sev = severities[Math.floor(Math.random() * severities.length)];
      const s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      insNotif.run(sev, `Mock ${sev.toLowerCase()} event`, `Simulated ${sev.toLowerCase()} notification for ${s.symbol}`, null);
    }

    // --- Daily summary (equity curve) -----------------------------------
    const insDaily = db.prepare(
      `INSERT INTO daily_summary (date, starting_capital, ending_capital, realized_pnl, unrealized_pnl, total_trades, winning_trades, losing_trades, win_rate, max_drawdown)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    let capital = 500000;
    for (let i = 0; i < 120; i++) {
      const start = capital;
      const trades = Math.floor(rand(2, 8));
      const winning = Math.floor(trades * rand(0.4, 0.7));
      const losing = trades - winning;
      const realized = winning * rand(1500, 5000) - losing * rand(1000, 3500);
      capital += realized;
      const winRate = trades ? (winning / trades) * 100 : 0;
      const maxDd = Math.max(0, rand(0, 0.02) * capital);
      insDaily.run(
        dateOnly(NOW - (120 - i) * DAY),
        start,
        capital,
        realized,
        rand(-2000, 2000),
        trades,
        winning,
        losing,
        winRate,
        maxDd,
      );
    }

    // --- Health checks --------------------------------------------------
    const insHealth = db.prepare(
      `INSERT INTO health_checks (component, status, latency_ms, details, checked_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const components = ['KITE_STREAMER', 'LLM', 'TELEGRAM', 'NEWS', 'TAVILY'];
    for (let i = 0; i < 50; i++) {
      const comp = components[Math.floor(Math.random() * components.length)];
      const status = ['OK', 'OK', 'OK', 'DEGRADED'][Math.floor(Math.random() * 4)];
      insHealth.run(comp, status, Math.floor(rand(5, 200)), `Mock ${comp} check`, iso(NOW - i * 5 * 60 * 1000));
    }

    // --- Session --------------------------------------------------------
    db.prepare(
      `INSERT INTO sessions (session_type, started_at, status, metadata) VALUES ('PAPER', ?, 'ACTIVE', 'mock')`,
    ).run(iso(NOW - 2 * DAY));
  });

  insert();
}

/* ==================================================================== */
/* Main                                                                 */
/* ==================================================================== */

async function main() {
  // Ensure the client is built so the UI server can serve it.
  const clientIndex = path.join(process.cwd(), 'src', 'client', 'dist', 'index.html');
  if (!fs.existsSync(clientIndex)) {
    console.error(
      'Client not built. Run `npm run build:ui` first, then `npm run mock:ui`.',
    );
    process.exit(1);
  }

  // Fresh mock data dir — a dedicated SQLite file that acts as a separate
  // schema. The main `data/ledger.db` is never opened or written.
  fs.rmSync(MOCK_DIR, { recursive: true, force: true });
  fs.mkdirSync(MOCK_DIR, { recursive: true });

  const ledger = new Ledger(MOCK_DIR);
  ledger.runMigrations();
  seed(ledger.raw());

  // Point the config's watchlist at the mock universe.
  const config = loadConfig();
  config.watchlist = SYMBOLS.map((s) => ({
    tradingsymbol: s.symbol,
    exchange: s.exchange as 'NSE',
    quantity: 1,
    enabled: true,
  }));

  // schema='' → the UI reads the mock file's own (main) schema, which is
  // entirely separate from the real bot's `data/ledger.db`.
  const ui = await startUiServer(config, ledger, '');

  const port = process.env.UI_PORT || '3000';
  const host = process.env.UI_HOST || '0.0.0.0';
  console.log('\n==================================================');
  console.log('  MOCK DASHBOARD READY');
  console.log(`  Open:  http://localhost:${port}`);
  console.log('  Data:  seeded mock ledger (deleted on exit)');
  console.log('  Stop:  Ctrl+C');
  console.log('==================================================\n');

  let cleaning = false;
  const shutdown = async () => {
    if (cleaning) return;
    cleaning = true;
    console.log('\nStopping mock UI and cleaning up...');
    await ui.close();
    ledger.close();
    fs.rmSync(MOCK_DIR, { recursive: true, force: true });
    console.log('Mock data removed. Goodbye.');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Mock UI failed:', err);
  process.exit(1);
});
