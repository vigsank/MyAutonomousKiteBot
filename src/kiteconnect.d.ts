/**
 * Minimal type declarations for the `kiteconnect` npm package (Zerodha Kite
 * Connect v3 SDK). The package ships no TypeScript types, so we declare only
 * the surface we use.
 */
declare module 'kiteconnect' {
  export interface KiteConnectOptions {
    api_key: string;
    access_token?: string;
    root?: string;
    debug?: boolean;
    timeout?: number;
  }

  export class KiteConnect {
    constructor(options: KiteConnectOptions);
    getHistoricalData(
      instrumentToken: number,
      interval: string,
      from: Date,
      to: Date,
      continuous?: boolean,
      oi?: boolean,
    ): Promise<unknown[]>;
    getInstruments(exchange?: string): Promise<unknown[]>;
    getQuote(
      symbols: string | string[],
    ): Promise<Record<string, any> | undefined>;
  }

  export interface KiteTickerOptions {
    api_key: string;
    access_token: string;
  }

  export class KiteTicker {
    constructor(options: KiteTickerOptions);
    MODE_FULL: string;
    connect(): void;
    subscribe(tokens: number[]): void;
    setMode(mode: string, tokens: number[]): void;
    autoReconnect(enable: boolean, maxRetries?: number, intervalSec?: number): void;
    close(): void;
    on(event: string, listener: (...args: any[]) => void): void;
  }
}
