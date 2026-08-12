import { AppConfig } from './AppConfig';
import { logger } from './Logger';
import { HistoricalDataProvider, LiveDataProvider } from './MarketDataProvider';
import {
  Candle,
  Instrument,
  Quote,
  Segment,
  Tick,
} from './types';

/**
 * Resolve the Kite SDK classes.
 *
 * When PAPER_TRADING=true, use the local kite-paper-node mock (drop-in
 * replacement) instead of the real kiteconnect SDK. The mock exposes the
 * same API surface (MockKiteConnect/MockKiteTicker extend the real classes).
 *
 * `kite-paper-node` is used locally (not yet published to npm) via a
 * relative require to its compiled `dist/`. Build it once with:
 *   cd kite-paper-node && npm run build
 */
function resolveKiteSdk(): {
  KiteConnect: new (opts: any) => any;
  KiteTicker: new (opts: any) => any;
} {
  if (process.env.PAPER_TRADING === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mock = require('../../kite-paper-node/dist');
    return {
      KiteConnect: mock.KiteConnect ?? mock.MockKiteConnect,
      KiteTicker: mock.KiteTicker ?? mock.MockKiteTicker,
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('kiteconnect');
}

const { KiteConnect, KiteTicker } = resolveKiteSdk();

/**
 * Wraps the Zerodha Kite Connect REST SDK and KiteTicker websocket.
 *
 * - getHistoricalData uses KiteConnect directly.
 * - getInstruments fetches the master list (option chains built manually).
 * - KiteTicker streams real-time ticks.
 *
 * KiteStreamer serves as BOTH the LIVE provider (websocket ticks) and the
 * BACKTEST provider (real historical data) when Kite credentials are present.
 *
 * Note: Kite Connect v3 API methods use positional arguments. See the
 * configuration docs for exact signatures.
 */
export class KiteStreamer implements HistoricalDataProvider, LiveDataProvider {
  readonly name = 'kite';
  private kite: InstanceType<typeof KiteConnect>;
  private ticker: InstanceType<typeof KiteTicker> | null = null;
  private instruments: Map<number, Instrument> = new Map();

  constructor(private readonly config: AppConfig) {
    this.kite = new KiteConnect({
      api_key: config.kite.apiKey,
      access_token: config.kite.accessToken,
      root: config.kite.root,
      timeout: 15000,
    });
  }

  /** True when API credentials are configured. */
  get isConfigured(): boolean {
    return this.config.kite.apiKey.length > 0 && this.config.kite.accessToken.length > 0;
  }

  /* ------------------------------------------------------------ */
  /* REST                                                          */
  /* ------------------------------------------------------------ */

  /**
   * Fetch historical OHLC candles. Kite v3 signature is positional:
   * getHistoricalData(instrument_token, interval, from_date, to_date,
   * continuous?, oi?).
   */
  async getHistoricalData(
    instrumentToken: number,
    interval: string,
    from: Date,
    to: Date,
  ): Promise<Candle[]> {
    const data = await this.kite.getHistoricalData(
      instrumentToken,
      interval,
      from,
      to,
    );
    if (!Array.isArray(data)) {
      logger.warn({ instrumentToken, interval }, 'Kite historical data is not an array');
      return [];
    }
    return (data as any[])
      .filter((c: any) => c && typeof c.date !== 'undefined' && typeof c.close === 'number')
      .map((c: any) => ({
        date: new Date(c.date),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume ?? 0,
      }));
  }

  /**
   * Load the full instrument master list for an exchange (e.g. 'NSE' or 'NFO').
   * Merges into the existing map so multiple exchanges can coexist (NSE equity
   * for the watchlist + NFO for options). Call once per exchange at startup.
   */
  async loadInstruments(exchange: Segment = 'NFO'): Promise<void> {
    const rows = await this.kite.getInstruments(exchange);
    for (const r of rows as any[]) {
      this.instruments.set(Number(r.instrument_token), {
        instrument_token: Number(r.instrument_token),
        exchange_token: r.exchange_token,
        tradingsymbol: r.tradingsymbol,
        name: r.name ?? '',
        last_price: r.last_price ?? 0,
        expiry: r.expiry ? new Date(r.expiry) : undefined,
        strike: r.strike ?? undefined,
        tick_size: r.tick_size,
        lot_size: r.lot_size,
        instrument_type: r.instrument_type,
        segment: r.segment,
        exchange: r.exchange,
      });
    }
    logger.info({ count: this.instruments.size, exchange }, 'Instruments loaded');
  }

  /** Find an instrument by its trading symbol + segment. */
  findInstrument(tradingsymbol: string, exchange: Segment): Instrument | null {
    for (const inst of this.instruments.values()) {
      if (
        inst.tradingsymbol === tradingsymbol &&
        (inst.exchange === exchange || inst.segment === exchange)
      ) {
        return inst;
      }
    }
    return null;
  }

  getInstrument(token: number): Instrument | null {
    return this.instruments.get(token) ?? null;
  }

  /** Build an option chain by filtering the NFO master list. */
  optionChain(
    underlying: string,
    instrumentType: 'CE' | 'PE',
    expiry?: Date,
  ): Instrument[] {
    const out: Instrument[] = [];
    for (const inst of this.instruments.values()) {
      if (inst.segment !== 'NFO') continue;
      if (!inst.tradingsymbol.startsWith(underlying)) continue;
      if (inst.instrument_type !== instrumentType) continue;
      if (expiry && inst.expiry && inst.expiry.getTime() !== expiry.getTime()) {
        continue;
      }
      out.push(inst);
    }
    return out;
  }

  /** Fetch a live quote using 'exchange:tradingsymbol' format. */
  async getQuote(symbol: string, exchange: Segment): Promise<Quote | null> {
    const key = `${exchange}:${symbol}`;
    const res = await this.kite.getQuote(key);
    const q = res?.[key];
    if (!q) return null;
    return {
      instrument_token: q.instrument_token,
      timestamp: q.timestamp ? new Date(q.timestamp) : undefined,
      last_price: q.last_price,
      volume: q.volume,
      average_price: q.average_price,
      oi: q.oi,
      ohlc: q.ohlc,
      change: q.net_change, // real Kite returns `net_change`, not `change`
    };
  }

  /* ------------------------------------------------------------ */
  /* WebSocket ticks                                               */
  /* ------------------------------------------------------------ */

  /**
   * Start streaming ticks. onTick is called with coalesced ticks as they
   * arrive. Handles reconnect with the KiteTicker auto-reconnect API.
   */
  startTicker(tokens: number[], onTick: (ticks: Tick[]) => void): void {
    if (this.ticker) return;

    this.ticker = new KiteTicker({
      api_key: this.config.kite.apiKey,
      access_token: this.config.kite.accessToken,
    });

    this.ticker.connect();

    this.ticker.on('connect', () => {
      logger.info({ tokens: tokens.length }, 'Ticker connected, subscribing');
      this.ticker?.subscribe(tokens);
      this.ticker?.setMode(this.ticker.MODE_FULL, tokens);
    });

    this.ticker.on('ticks', (ticks: any[]) => {
      const mapped: Tick[] = ticks.map((t) => ({
        instrument_token: t.instrument_token,
        last_price: t.last_price,
        volume_traded: t.volume_traded,
        oi: t.oi,
        change: t.change,
        ohlc: t.ohlc,
        exchange_timestamp: t.exchange_timestamp
          ? new Date(t.exchange_timestamp)
          : undefined,
      }));
      onTick(mapped);
    });

    this.ticker.on('error', (err: any) => {
      logger.error({ err: err?.message }, 'Ticker error');
    });

    this.ticker.on('close', () => {
      logger.warn('Ticker closed');
    });

    this.ticker.on('disconnect', () => {
      logger.warn('Ticker disconnected');
    });

    // Interval is in seconds per the SDK.
    this.ticker.autoReconnect(true, 30, 5);
  }

  stopTicker(): void {
    if (this.ticker) {
      this.ticker.close?.();
      this.ticker = null;
    }
  }
}
