import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MockEngine } from '../../src/mock-engine';
import { createMcpServer } from '../../src/mcp/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const KITE_MCP_TOOL_NAMES = [
  'login', 'get_profile', 'get_margins', 'get_holdings', 'get_positions',
  'get_trades', 'get_orders', 'get_order_history', 'get_order_trades',
  'get_gtts', 'get_mf_holdings', 'get_quotes', 'search_instruments',
  'get_historical_data', 'get_ltp', 'get_ohlc', 'place_order', 'modify_order',
  'cancel_order', 'place_gtt_order', 'modify_gtt_order', 'delete_gtt_order',
];

/** Extract the JSON text from an MCP tool result. */
const textOf = (res: any): string => (res.content as Array<{ text: string }>)[0].text;

describe('MCP mock server', () => {
  let engine: MockEngine;
  let client: Client;
  let server: ReturnType<typeof createMcpServer>;

  beforeEach(async () => {
    engine = new MockEngine({ startingCapital: 1_000_000 });
    engine.addSymbol('RELIANCE', { basePrice: 2500 });

    server = createMcpServer(engine);
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    await server.connect(serverT);

    client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientT);
  });

  afterEach(async () => {
    await client?.close();
    await server?.close();
    engine?.destroy();
  });

  it('exposes all 22 Kite MCP tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(KITE_MCP_TOOL_NAMES.slice().sort());
  });

  it('returns a JIT quote via get_quotes with real Kite fields', async () => {
    const res = await client.callTool({ name: 'get_quotes', arguments: { instruments: ['NSE:RELIANCE'] } });
    const quote = JSON.parse(textOf(res))['NSE:RELIANCE'];
    expect(typeof quote.last_price).toBe('number');
    expect(quote).toHaveProperty('net_change');
    expect(Array.isArray(quote.depth.buy)).toBe(true);
  });

  it('returns JIT historical data via get_historical_data', async () => {
    const res = await client.callTool({
      name: 'get_historical_data',
      arguments: {
        instrument_token: 738561,
        from_date: '2025-01-01 09:15:00',
        to_date: '2025-01-01 10:15:00',
        interval: 'minute',
      },
    });
    const data = JSON.parse(textOf(res));
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toHaveProperty('close');
  });

  it('places, fills, and reads positions through MCP tools', async () => {
    const placed = await client.callTool({
      name: 'place_order',
      arguments: {
        tradingsymbol: 'RELIANCE', exchange: 'NSE', transaction_type: 'BUY',
        quantity: 10, product: 'MIS', order_type: 'LIMIT', price: 2400,
      },
    });
    const { order_id } = JSON.parse(textOf(placed));
    expect(typeof order_id).toBe('string');

    engine.emitTick({ instrument_token: 738561, last_price: 2400 });

    const positions = await client.callTool({ name: 'get_positions', arguments: {} });
    const body = JSON.parse(textOf(positions));
    expect(body.net.length).toBe(1);
    expect(body.net[0].quantity).toBe(10);
  });

  it('returns login confirmation', async () => {
    const res = await client.callTool({ name: 'login', arguments: {} });
    expect(JSON.parse(textOf(res)).message).toContain('Already logged in');
  });

  it('returns an isError result for an unknown instrument', async () => {
    const res = await client.callTool({ name: 'get_ltp', arguments: { instruments: ['NSE:UNKNOWN'] } });
    expect(res.isError).toBe(true);
    expect(JSON.parse(textOf(res)).error_type).toBe('InputException');
  });

  it('paginates list tools when limit is set', async () => {
    for (let i = 0; i < 5; i++) {
      await client.callTool({
        name: 'place_order',
        arguments: {
          tradingsymbol: 'RELIANCE', exchange: 'NSE', transaction_type: 'BUY',
          quantity: 1, product: 'MIS', order_type: 'LIMIT', price: 2400 + i,
        },
      });
    }
    const res = await client.callTool({ name: 'get_orders', arguments: { from: 0, limit: 2 } });
    const body = JSON.parse(textOf(res));
    expect(body.data.length).toBe(2);
    expect(body.pagination.total).toBe(5);
    expect(body.pagination.returned).toBe(2);
  });
});
