/**
 * generate_market_data.ts — generates the full financial-year (Apr–Mar) market
 * data JSON files the bot's algo directly consumes, into the parent project's
 * data/ directory.
 *
 * These are STATIC reference datasets the bot reads (economic calendar,
 * corporate actions, FII/DII, sectors, index constituents). They live in the
 * parent project (not kite-paper-node) because Zerodha Kite does not provide
 * them in live trading.
 *
 * Usage:
 *   npx ts-node scripts/generate_market_data.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FY_START = '2026-04-01';
const FY_END = '2027-03-31';

/** Curated sector map for major NSE stocks (default OTHER). */
const SECTOR_MAP: Record<string, string> = {
  RELIANCE: 'ENERGY', TATASTEEL: 'METALS', INFY: 'IT', HDFCBANK: 'BANK',
  TCS: 'IT', SBIN: 'BANK', ITC: 'FMCG', HINDUNILVR: 'FMCG', ICICIBANK: 'BANK',
  KOTAKBANK: 'BANK', AXISBANK: 'BANK', HCLTECH: 'IT', WIPRO: 'IT', ONGC: 'ENERGY',
  NTPC: 'POWER', TATAMOTORS: 'AUTO', MARUTI: 'AUTO', 'M&M': 'AUTO', NESTLEIND: 'FMCG',
  BHARTIARTL: 'TELECOM', TITAN: 'CONSUMER', ULTRACEMCO: 'CEMENT', ADANIENT: 'CONGLOMERATE',
  ADANIPORTS: 'INFRA', SUNPHARMA: 'PHARMA', DRREDDY: 'PHARMA', CIPLA: 'PHARMA',
  DIVISLAB: 'PHARMA', LT: 'INFRA', HINDALCO: 'METALS', JSWSTEEL: 'METALS',
  COALINDIA: 'ENERGY', POWERGRID: 'POWER', BAJFINANCE: 'FINANCE', BAJAJFINSV: 'FINANCE',
  HDFCLIFE: 'INSURANCE', SBILIFE: 'INSURANCE', ICICIPRULI: 'INSURANCE',
  ASIANPAINT: 'CONSUMER', GRASIM: 'CEMENT', TATACONSUM: 'FMCG', TECHM: 'IT',
  LTIM: 'IT', PERSISTENT: 'IT', COFORGE: 'IT', MPHL: 'IT', TATAPOWER: 'POWER',
  ADANIGREEN: 'POWER', TATACHEM: 'CHEMICALS', UPL: 'CHEMICALS', PIIND: 'CHEMICALS',
  SRF: 'CHEMICALS', DEEPAKNTR: 'CHEMICALS', ATUL: 'CHEMICALS', NAVINFLUOR: 'CHEMICALS',
  AMBUJACEM: 'CEMENT', ACC: 'CEMENT', SHREECEM: 'CEMENT', DALBHARAT: 'CEMENT',
  INDUSINDBK: 'BANK', FEDERALBNK: 'BANK', BANDHANBNK: 'BANK', IDFCFIRSTB: 'BANK',
  AUROPHARMA: 'PHARMA', LUPIN: 'PHARMA', ZYDUSLIFE: 'PHARMA', BIOCON: 'PHARMA',
  ALKEM: 'PHARMA', TORNTPHARM: 'PHARMA', LAURUSLABS: 'PHARMA', GLENMARK: 'PHARMA',
  APOLLOHOSP: 'HEALTHCARE', MAXHEALTH: 'HEALTHCARE', FORTIS: 'HEALTHCARE',
  METROPOLIS: 'HEALTHCARE', EICHERMOT: 'AUTO', HEROMOTOCO: 'AUTO',
  'BAJAJ-AUTO': 'AUTO', TVSMOTOR: 'AUTO', ASHOKLEY: 'AUTO', MOTHERSON: 'AUTO',
  BOSCHLTD: 'AUTO', MRF: 'AUTO', APOLLOTYRE: 'AUTO', CEATLTD: 'AUTO',
  JUBLFOOD: 'CONSUMER', DEVYANI: 'CONSUMER', VBL: 'CONSUMER', BRITANNIA: 'FMCG',
  DABUR: 'FMCG', MARICO: 'FMCG', GODREJCP: 'FMCG', COLPAL: 'CONSUMER',
  PIDILITIND: 'CHEMICALS', PAGEIND: 'CONSUMER', TRENT: 'CONSUMER', ABFRL: 'CONSUMER',
  PVRINOX: 'MEDIA', ZEEL: 'MEDIA', SUNTV: 'MEDIA', NETWORK18: 'MEDIA',
  IRCTC: 'INFRA', IRFC: 'FINANCE', RVNL: 'INFRA', NBCC: 'INFRA', LICHSGFIN: 'FINANCE',
  CHOLAFIN: 'FINANCE', MUTHOOTFIN: 'FINANCE', MANAPPURAM: 'FINANCE', SHRIRAMFIN: 'FINANCE',
  PFC: 'FINANCE', RECLTD: 'FINANCE', CANFINHOME: 'FINANCE', BAJAJHLDNG: 'FINANCE',
  HDFCAMC: 'FINANCE', 'NAM-INDIA': 'FINANCE', UTIAMC: 'FINANCE', 'MCDOWELL-N': 'CONSUMER',
  UNITEDBREW: 'CONSUMER', RADICO: 'CONSUMER', GMRAIRPORT: 'INFRA', DELHIVERY: 'LOGISTICS',
  BLUEDART: 'LOGISTICS', CONCOR: 'LOGISTICS', TCI: 'LOGISTICS', MAHINDLOG: 'LOGISTICS',
  AARTIIND: 'CHEMICALS', DIXON: 'ELECTRONICS', VOLTAS: 'ELECTRONICS', BLUESTARCO: 'ELECTRONICS',
  WHIRLPOOL: 'ELECTRONICS', CROMPTON: 'ELECTRONICS', HAVELS: 'ELECTRONICS', AMBER: 'ELECTRONICS',
  SYNGENE: 'PHARMA', LAXMIMACH: 'CAPITAL_GOODS', BHEL: 'CAPITAL_GOODS', SIEMENS: 'CAPITAL_GOODS',
  ABB: 'CAPITAL_GOODS', CUMMINSIND: 'CAPITAL_GOODS', THERMAX: 'CAPITAL_GOODS',
  KEI: 'CAPITAL_GOODS', POLYCAB: 'CAPITAL_GOODS', HAVELLS: 'ELECTRONICS', FINPIPE: 'CAPITAL_GOODS',
  SUPREMEIND: 'CAPITAL_GOODS', ASTRAZEN: 'PHARMA', GLAND: 'PHARMA', JBCHEPHARM: 'PHARMA',
  INOXWIND: 'POWER', SUZLON: 'POWER', BOROLTD: 'CHEMICALS', DEEPAKFERT: 'CHEMICALS',
  CHAMBLFERT: 'CHEMICALS', COROMANDEL: 'CHEMICALS', GNFC: 'CHEMICALS', RCF: 'CHEMICALS',
  FACT: 'CHEMICALS', NATIONALUM: 'METALS', NMDC: 'METALS', VEDL: 'METALS',
  HINDZINC: 'METALS', SAIL: 'METALS', JINDALSTEL: 'METALS', JINDALSAW: 'METALS',
  RATNAMANI: 'METALS', APLAPOLLO: 'METALS', TUBEINVEST: 'METALS', WELCORP: 'METALS',
  ADANIPOWER: 'POWER', JSWENERGY: 'POWER', NHPC: 'POWER', SJVN: 'POWER',
  TORNTPOWER: 'POWER', CESC: 'POWER', KALPATPOWR: 'POWER', NLCINDIA: 'POWER',
  OIL: 'ENERGY', IOC: 'ENERGY', BPCL: 'ENERGY', HPCL: 'ENERGY', GAIL: 'ENERGY',
  PETRONET: 'ENERGY', IGL: 'ENERGY', MGL: 'ENERGY', GUJGASLTD: 'ENERGY',
  INDHOTEL: 'HOTELS', LEMONTREE: 'HOTELS', CHALET: 'HOTELS', EIHOTEL: 'HOTELS',
  IRB: 'INFRA', KNR: 'INFRA', PNCINFRA: 'INFRA', HGINFRA: 'INFRA', LTTS: 'IT',
  TATAELXSI: 'IT', CYIENT: 'IT', KPITTECH: 'IT', ZENSARTECH: 'IT', INTELLECT: 'IT',
  BSOFT: 'IT', HEXAWARE: 'IT', MINDTREE: 'IT', ORACLECORP: 'IT', TANLA: 'IT',
  DATAPATTNS: 'IT', NEWGEN: 'IT', PNB: 'BANK', BANKBARODA: 'BANK', CANBK: 'BANK',
  UNIONBANK: 'BANK', INDIANB: 'BANK', BANKINDIA: 'BANK', CENTRALBK: 'BANK',
  MAHABANK: 'BANK', PNBHOUSING: 'FINANCE', AUBANK: 'BANK', RBLBANK: 'BANK',
  YESBANK: 'BANK', IDFCBANK: 'BANK', KARURVYSYA: 'BANK', SOUTHBANK: 'BANK',
  FINEORG: 'CHEMICALS', VINATIORGA: 'CHEMICALS', BALKRISIND: 'AUTO', EXIDEIND: 'AUTO',
  AMARAJABAT: 'AUTO', ESCORTS: 'AUTO', SONACOMS: 'AUTO',
  UNOMINDA: 'AUTO', SUPRAJIT: 'AUTO', ENDURANCE: 'AUTO', BATAINDIA: 'CONSUMER',
  METROBRAND: 'CONSUMER', CAMPUS: 'CONSUMER', KAJARIA: 'CONSUMER', GILLETTE: 'CONSUMER',
  PROZONER: 'CONSUMER', HINDCOPPER: 'METALS', NALCO: 'METALS',
  MOIL: 'METALS', GRAPHITE: 'METALS', HEG: 'METALS', CARBORUNIV: 'CAPITAL_GOODS',
  GRINDWELL: 'CAPITAL_GOODS', CGPOWER: 'CAPITAL_GOODS', VGUARD: 'ELECTRONICS',
  ORIENTELEC: 'ELECTRONICS', SYMPHONY: 'ELECTRONICS', TTKPRESTIG: 'CONSUMER',
  BAJAJELEC: 'ELECTRONICS', KAYNES: 'ELECTRONICS', RATEGAIN: 'IT', BIRLACORPN: 'CONGLOMERATE',
  ADANIENSOL: 'POWER',
  ADANIENERGY: 'POWER', ADANITRANS: 'POWER',
  NUVAMA: 'FINANCE', SBI: 'BANK',
};

/** Nifty 50 constituents (approximate). */
const NIFTY_50 = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
  'BHARTIARTL', 'KOTAKBANK', 'LT', 'AXISBANK', 'TITAN', 'BAJFINANCE', 'MARUTI',
  'SUNPHARMA', 'TATAMOTORS', 'ULTRACEMCO', 'HCLTECH', 'WIPRO', 'ADANIENT', 'ADANIPORTS',
  'NTPC', 'ONGC', 'POWERGRID', 'TATASTEEL', 'M&M', 'NESTLEIND', 'BAJAJFINSV', 'HINDALCO',
  'JSWSTEEL', 'TECHM', 'ASIANPAINT', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'GRASIM', 'TATACONSUM',
  'APOLLOHOSP', 'EICHERMOT', 'HEROMOTOCO', 'BAJAJ-AUTO', 'COALINDIA', 'INDUSINDBK',
  'SBILIFE', 'HDFCLIFE', 'LTIM', 'BPCL', 'TATAPOWER', 'BRITANNIA',
];

/** Bank Nifty constituents (approximate). */
const BANK_NIFTY = [
  'HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'INDUSINDBK', 'BANKBARODA',
  'PNB', 'FEDERALBNK', 'BANDHANBNK', 'IDFCFIRSTB', 'AUBANK', 'RBLBANK', 'YESBANK',
  'IDFCBANK', 'UNIONBANK', 'CANBK', 'INDIANB', 'BANKINDIA', 'SOUTHBANK',
];

/** Add months to a date string. */
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Generate the full-FY economic calendar (recurring events). */
function generateEconomicCalendar(): Array<{ date: string; event: string; impact: string }> {
  const events: Array<{ date: string; event: string; impact: string }> = [];
  let d = new Date(FY_START + 'T00:00:00Z');
  const end = new Date(FY_END + 'T00:00:00Z');

  // Monthly recurring events.
  while (d <= end) {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = (n: number) => new Date(Date.UTC(y, m, n)).toISOString().slice(0, 10);
    events.push({ date: day(10), event: 'US CPI (inflation)', impact: 'HIGH' });
    events.push({ date: day(12), event: 'India CPI (inflation)', impact: 'MEDIUM' });
    events.push({ date: day(1), event: 'US ISM Manufacturing PMI', impact: 'MEDIUM' });
    events.push({ date: day(15), event: 'India WPI (inflation)', impact: 'LOW' });
    d = new Date(Date.UTC(y, m + 1, 1));
  }

  // Quarterly India GDP.
  for (const [m, day] of [[4, 30], [7, 31], [10, 31], [1, 31]] as const) {
    events.push({ date: new Date(Date.UTC(2026, m, day)).toISOString().slice(0, 10), event: 'India GDP (quarterly)', impact: 'MEDIUM' });
  }

  // RBI monetary policy (approx every 2 months).
  for (const [m, day] of [[3, 5], [5, 7], [7, 9], [9, 11], [11, 13], [1, 15]] as const) {
    events.push({ date: new Date(Date.UTC(2026, m, day)).toISOString().slice(0, 10), event: 'RBI monetary policy decision', impact: 'HIGH' });
  }

  // US FOMC (approx every 6 weeks).
  for (const [m, day] of [[4, 28], [6, 9], [7, 21], [9, 1], [10, 13], [11, 24], [1, 5], [2, 16]] as const) {
    events.push({ date: new Date(Date.UTC(2026, m, day)).toISOString().slice(0, 10), event: 'US FOMC meeting', impact: 'HIGH' });
  }

  // US Non-farm payrolls (1st Friday of each month).
  for (let m = 3; m <= 14; m++) {
    const firstFriday = new Date(Date.UTC(2026, m, 1));
    while (firstFriday.getUTCDay() !== 5) firstFriday.setUTCDate(firstFriday.getUTCDate() + 1);
    events.push({ date: firstFriday.toISOString().slice(0, 10), event: 'US Non-farm payrolls', impact: 'HIGH' });
  }

  return events
    .filter((e) => e.date >= FY_START && e.date <= FY_END)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Generate quarterly earnings dates for each watchlist symbol across the FY. */
function generateCorporateActions(symbols: string[]): Array<{ symbol: string; date: string; type: string }> {
  const actions: Array<{ symbol: string; date: string; type: string }> = [];
  // Quarterly earnings windows (Q4 Apr-May, Q1 Jul-Aug, Q2 Oct-Nov, Q3 Jan-Feb).
  const windows: Array<[number, number]> = [
    [3, 20], [4, 20], // Q4 (Apr-May)
    [6, 20], [7, 20], // Q1 (Jul-Aug)
    [9, 20], [10, 20], // Q2 (Oct-Nov)
    [0, 20], [1, 20], // Q3 (Jan-Feb)
  ];
  for (const sym of symbols) {
    for (const [m, day] of windows) {
      actions.push({
        symbol: sym,
        date: new Date(Date.UTC(2026, m, day)).toISOString().slice(0, 10),
        type: 'EARNINGS',
      });
    }
  }
  return actions;
}

/** Generate daily FII/DII flows for the FY (deterministic pseudo-random). */
function generateFiiDii(): { fii: { date: string; net_crore: number }; dii: { date: string; net_crore: number }; history: Array<{ date: string; fii: number; dii: number }> } {
  const history: Array<{ date: string; fii: number; dii: number }> = [];
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let d = new Date(FY_START + 'T00:00:00Z');
  const end = new Date(FY_END + 'T00:00:00Z');
  while (d <= end) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      const fii = Math.round((rnd() - 0.45) * 3000);
      const dii = Math.round((0.5 - rnd()) * 2500);
      history.push({ date: d.toISOString().slice(0, 10), fii, dii });
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const last = history[history.length - 1];
  return {
    fii: { date: last.date, net_crore: last.fii },
    dii: { date: last.date, net_crore: last.dii },
    history,
  };
}

function main(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // Read the watchlist for symbols.
  const watchlist = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'watchlist.json'), 'utf-8'));
  const symbols = (watchlist.symbols ?? []).map((s: any) => s.tradingsymbol);

  // Sectors.
  const sectors = { sectors: symbols.map((sym: string) => ({ symbol: sym, sector: SECTOR_MAP[sym] ?? 'OTHER' })) };
  fs.writeFileSync(path.join(DATA_DIR, 'sectors.json'), JSON.stringify(sectors, null, 2));

  // Economic calendar.
  const calendar = { events: generateEconomicCalendar() };
  fs.writeFileSync(path.join(DATA_DIR, 'economic_calendar.json'), JSON.stringify(calendar, null, 2));

  // Corporate actions.
  const actions = { actions: generateCorporateActions(symbols) };
  fs.writeFileSync(path.join(DATA_DIR, 'corporate_actions.json'), JSON.stringify(actions, null, 2));

  // FII/DII.
  fs.writeFileSync(path.join(DATA_DIR, 'fii_dii.json'), JSON.stringify(generateFiiDii(), null, 2));

  // Index constituents.
  const constituents = { nifty_50: NIFTY_50, bank_nifty: BANK_NIFTY };
  fs.writeFileSync(path.join(DATA_DIR, 'index_constituents.json'), JSON.stringify(constituents, null, 2));

  console.log(`Generated market data into ${DATA_DIR}:`);
  console.log(`  sectors.json: ${sectors.sectors.length} symbols`);
  console.log(`  economic_calendar.json: ${calendar.events.length} events (FY ${FY_START} → ${FY_END})`);
  console.log(`  corporate_actions.json: ${actions.actions.length} actions`);
  console.log(`  fii_dii.json: generated`);
  console.log(`  index_constituents.json: Nifty 50 (${NIFTY_50.length}), Bank Nifty (${BANK_NIFTY.length})`);
}

main();
