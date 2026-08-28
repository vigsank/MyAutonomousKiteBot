import * as fs from 'fs';
import * as path from 'path';
import { logger } from './Logger';

/**
 * LiveDataService — reads the parent project's own market-context data files
 * (NOT served by kite-paper-node). Provides the data the deferred pieces need:
 *   - Economic calendar (B1)
 *   - Corporate actions (B2)
 *   - FII/DII institutional flows (B5)
 *
 * These are static reference datasets generated into the parent's `data/` dir
 * (see scripts/generate_market_data.ts) because Zerodha Kite does not provide
 * them in live trading.
 */

export interface EconomicEvent {
  date: string;
  event: string;
  impact: string;
}

export interface CorporateAction {
  symbol: string;
  date: string;
  type: string;
}

export interface FiiDii {
  date: string;
  fii: number;
  dii: number;
}

export class LiveDataService {
  private readonly dir: string;

  constructor(dataDir = 'data') {
    this.dir = dataDir;
  }

  /** Upcoming economic events on/after a date (B1). */
  upcomingEvents(fromDate: string): EconomicEvent[] {
    const events = this.readJson<{ events: EconomicEvent[] }>('economic_calendar.json')?.events ?? [];
    return events
      .filter((e) => e.date >= fromDate)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  /** Corporate action for a symbol, or null (B2). */
  corporateActionFor(symbol: string): CorporateAction | null {
    const actions = this.readJson<{ actions: CorporateAction[] }>('corporate_actions.json')?.actions ?? [];
    return actions.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase()) ?? null;
  }

  /** Latest FII/DII flows (B5). */
  fiiDii(): FiiDii | null {
    const data = this.readJson<{ fii: { date: string; net_crore: number }; dii: { date: string; net_crore: number } }>('fii_dii.json');
    if (!data) return null;
    return { date: data.fii.date, fii: data.fii.net_crore, dii: data.dii.net_crore };
  }

  /** Read a JSON file from the live provider's data dir (best-effort). */
  private readJson<T>(file: string): T | null {
    try {
      const p = path.join(this.dir, file);
      if (!fs.existsSync(p)) return null;
      return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
    } catch (err) {
      logger.warn({ file, err: err?.message }, 'LiveDataService read failed');
      return null;
    }
  }
}
