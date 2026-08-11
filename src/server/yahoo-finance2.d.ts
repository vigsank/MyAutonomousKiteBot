declare module 'yahoo-finance2' {
  interface HistoricalQuery {
    period1: Date | number;
    period2: Date | number;
    interval: string;
  }
  interface HistoricalResult {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    adjclose?: number;
    volume?: number;
  }
  interface QuoteResult {
    symbol: string;
    regularMarketPrice?: number;
    regularMarketTime?: number;
    [key: string]: unknown;
  }
  class YahooFinance {
    constructor(options?: Record<string, unknown>);
    chart(
      symbol: string,
      options: { period1: Date | number; period2: Date | number; interval: string },
    ): Promise<{ quotes?: Array<{
      date: Date; open: number; high: number; low: number; close: number; volume?: number;
    }>; meta?: Record<string, unknown> }>;
    historical(query: string, options: HistoricalQuery): Promise<HistoricalResult[]>;
    quote(symbols: string | string[]): Promise<QuoteResult | QuoteResult[]>;
  }
  export default YahooFinance;
}
