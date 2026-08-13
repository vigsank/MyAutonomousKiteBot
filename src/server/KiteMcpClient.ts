import { logger } from './Logger';

/**
 * Minimal, dependency-free, READ-ONLY MCP client for the official Zerodha Kite
 * MCP server (https://github.com/zerodha/kite-mcp-server).
 *
 * Safety design (defense-in-depth):
 *   - A HARD-CODED allowlist restricts this client to read-only tools
 *     (quotes, LTP, OHLC, historical data, search, profile, margins,
 *     holdings, positions, MF holdings, orders, trades, GTTs). Anything else
 *     is refused before any network I/O happens, so an LLM can never use this
 *     client to place orders, modify positions, or otherwise mutate state.
 *   - `callTool` NEVER throws: it returns `null` on disabled config, a
 *     disallowed tool, a transport failure, or a timeout. Callers must treat
 *     `null` as "no data".
 *
 * Auth note:
 *   - The HOSTED endpoint (https://mcp.kite.trade) requires interactive OAuth
 *     login and is therefore not headless-friendly.
 *   - For automated / headless operation, run the SELF-HOSTED MCP server
 *     (see the official repo) which authenticates with an API key + access
 *     token and exposes a plain HTTP URL this client can talk to.
 *
 * Transport: MCP "streamable HTTP" — JSON-RPC 2.0 over POST to `url`. The
 * client sends `initialize`, persists the `Mcp-Session-Id` response header,
 * echoes it back, then issues `tools/call`. Responses may be `application/json`
 * OR `text/event-stream` (SSE); both are handled.
 *
 * Uses ONLY the global `fetch` available in Node 22 — no npm dependencies and
 * no MCP SDK. Timeouts use AbortController with `config.timeoutMs`.
 */

/** Read-only Kite MCP connection settings (mirrors AppConfig.mcp). */
export interface KiteMcpConfig {
  enabled: boolean;
  url: string;
  timeoutMs: number;
}

/** JSON-RPC result wrapper produced by the MCP server. */
interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number | string | null;
  result?: unknown;
  error?: { code?: number; message?: string } | null;
}

/** MCP tool result content block. */
interface ContentBlock {
  type?: string;
  text?: string;
}

const READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
  'get_quotes',
  'get_ltp',
  'get_ohlc',
  'get_historical_data',
  'search_instruments',
  'get_profile',
  'get_margins',
  'get_holdings',
  'get_positions',
  'get_mf_holdings',
  'get_orders',
  'get_trades',
  'get_order_history',
  'get_order_trades',
  'get_gtts',
]);

const PROTOCOL_VERSION = '2025-06-18';

export class KiteMcpClient {
  private sessionId: string | null = null;
  private initialized = false;
  private nextId = 1;

  constructor(private readonly config: KiteMcpConfig) {}

  /** Whether this client is enabled by config. */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Call a read-only Kite MCP tool. Returns a compact rendered string of the
   * result, or `null` on any failure / when disabled / for non-read-only tools.
   * Never throws.
   */
  async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<string | null> {
    if (!this.config.enabled) return null;
    if (!READ_ONLY_TOOLS.has(name)) return null;

    try {
      const ok = await this.initialize();
      if (!ok) return null;

      const payload = await this.post('tools/call', {
        name,
        arguments: args,
      });
      if (payload === null) return null;

      return this.render(this.extractResult(payload));
    } catch (err) {
      logger.warn({ err, tool: name }, 'KiteMcpClient.callTool failed');
      return null;
    }
  }

  /** Convenience: latest price for a single tradingsymbol. */
  getLtp(symbol: string): Promise<string | null> {
    return this.callTool('get_ltp', { instruments: [symbol] });
  }

  /** Convenience: quotes for one or more tradingsymbols. */
  getQuotes(symbols: string[]): Promise<string | null> {
    return this.callTool('get_quotes', { symbols });
  }

  /** Convenience: current open positions. */
  getPositions(): Promise<string | null> {
    return this.callTool('get_positions', {});
  }

  /** Convenience: historical OHLC candles for an instrument token. */
  getHistoricalData(
    token: number,
    interval: string,
    from: string,
    to: string,
  ): Promise<string | null> {
    return this.callTool('get_historical_data', {
      instrumentToken: token,
      interval,
      from,
      to,
    });
  }

  /**
   * Establish the MCP session by sending `initialize`. Returns false if the
   * server could not be reached / did not respond.
   */
  private async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    const payload = await this.post('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'MyAutonomousKiteBot',
        version: '1.0.0',
      },
    });
    if (payload === null) return false;

    this.initialized = true;
    return true;
  }

  /**
   * POST a JSON-RPC request to the MCP URL. Persists and echoes the
   * `Mcp-Session-Id` header, applies the configured timeout, and returns the
   * parsed JSON (or `null` on any failure). Never throws.
   */
  private async post(method: string, params: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      };
      if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;

      const res = await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: this.nextId++,
          method,
          params,
        }),
        signal: controller.signal,
      });

      const sessionId = res.headers.get('Mcp-Session-Id');
      if (sessionId) this.sessionId = sessionId;

      const text = await res.text();
      const contentType = (res.headers.get('Content-Type') ?? '').toLowerCase();

      if (contentType.includes('text/event-stream')) return this.parseSse(text);

      if (contentType.includes('application/json')) {
        try {
          return JSON.parse(text);
        } catch {
          logger.warn({ method }, 'KiteMcpClient: non-JSON body with JSON content-type');
          return text;
        }
      }

      // Fallback: try to parse regardless of content-type.
      const trimmed = text.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          return JSON.parse(trimmed);
        } catch {
          // fall through to raw text
        }
      }
      return text;
    } catch (err) {
      logger.warn({ err, method }, 'KiteMcpClient.post failed');
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Parse a `text/event-stream` body: split frames on blank lines, extract
   * `data:` lines, JSON.parse each, and return the last successfully parsed
   * value (or the raw data string if it is not JSON).
   */
  private parseSse(text: string): unknown {
    let last: unknown = null;

    for (const frame of text.split(/\r?\n\r?\n/)) {
      let data = '';
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith('data:')) {
          const value = line.slice(5).trim();
          data = data ? `${data}\n${value}` : value;
        }
      }
      if (!data) continue;
      try {
        last = JSON.parse(data);
      } catch {
        last = data;
      }
    }

    return last;
  }

  /**
   * Unwrap the meaningful MCP tool result from a JSON-RPC payload: prefer
   * concatenated `result.content[].text`, then `result`, then the payload.
   */
  private extractResult(payload: unknown): unknown {
    if (payload && typeof payload === 'object') {
      const rpc = payload as JsonRpcResponse;
      if (rpc.result && typeof rpc.result === 'object') {
        const result = rpc.result as { content?: ContentBlock[]; error?: unknown };
        if (Array.isArray(result.content)) {
          const texts = result.content
            .filter((block) => block && typeof block.text === 'string')
            .map((block) => block.text as string);
          if (texts.length > 0) return texts.join('\n');
        }
        if (result.error !== undefined) return result.error;
        return rpc.result;
      }
      if (rpc.error) return rpc.error;
    }
    return payload;
  }

  /** Render a value as a compact string. */
  private render(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
  }
}
