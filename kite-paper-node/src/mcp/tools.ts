/**
 * MCP tool definitions — tool parity with Zerodha's `kite-mcp-server`.
 *
 * Every tool calls a mock-engine service (which produces the same
 * kiteconnect-faithful JSON the REST/SDK modes return). Tool names, params,
 * and response shapes mirror the real Kite MCP server so an AI agent can be
 * pointed at the mock with zero changes.
 */

import { z } from 'zod';
import type { MockEngine } from '../mock-engine';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  errorResult,
  marshalResult,
  safeNumber,
  safeNumberArray,
  safeString,
  safeStringArray,
  toErrorResult,
  validateRequired,
} from './common';
import { paginate } from './pagination';

const EXCHANGES = ['NSE', 'BSE', 'MCX', 'NFO', 'BFO'] as const;
const VARIETIES = ['regular', 'co', 'amo', 'iceberg', 'auction'] as const;
const PRODUCTS = ['CNC', 'NRML', 'MIS', 'MTF'] as const;
const ORDER_TYPES = ['MARKET', 'LIMIT', 'SL', 'SL-M'] as const;
const INTERVALS = ['minute', 'day', '3minute', '5minute', '10minute', '15minute', '30minute', '60minute'] as const;

// Shared param builders (mirror Kite MCP param shapes).
const zInstruments = {
  instruments: z.array(z.string()).describe("Eg. ['NSE:INFY', 'NSE:SBIN']"),
};

const zPagination = {
  from: z.number().optional().describe('Starting index (0-based)'),
  limit: z.number().optional().describe('Max results; when set, response is paginated'),
};

export function registerAllTools(server: McpServer, engine: MockEngine, excluded: Set<string> = new Set()): void {
  const add = (name: string, description: string, schema: Record<string, any>, handler: (args: Record<string, any>) => any) => {
    if (excluded.has(name)) return;
    server.registerTool(name, { description, inputSchema: schema }, async (args: any) => {
      try {
        return await handler(args ?? {});
      } catch (err) {
        return toErrorResult(err);
      }
    });
  };

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  add(
    'login',
    'Login to Kite API. In mock mode this always succeeds; returns a mock login confirmation.',
    {},
    () => marshalResult({ message: 'Already logged in as Paper Trader (mock)' })
  );

  // -------------------------------------------------------------------------
  // GET tools
  // -------------------------------------------------------------------------
  add('get_profile', 'Retrieve the user profile information.', {}, () =>
    marshalResult(engine.userService.getProfile())
  );

  add(
    'get_margins',
    'Get margins.',
    { segment: z.enum(['equity', 'commodity']).optional() },
    (args) => {
      const seg = safeString(args.segment, '');
      return marshalResult(seg ? engine.marginService.getMarginsForSegment(seg) : engine.marginService.getMargins());
    }
  );

  add('get_holdings', 'Get holdings for the current user.', zPagination, (args) =>
    marshalResult(paginate(engine.holdingService.getHoldings(), args))
  );

  add('get_positions', 'Get current positions.', zPagination, (args) => {
    const positions = engine.positionService.getPositions();
    const out: Record<string, any> = {};
    for (const key of ['net', 'day'] as const) {
      const list = positions[key];
      const params = paginate(list, args);
      out[key] = params;
    }
    return marshalResult(out);
  });

  add('get_trades', 'Get trading history.', zPagination, (args) =>
    marshalResult(paginate(engine.getTrades(), args))
  );

  add('get_orders', 'Get all orders.', zPagination, (args) =>
    marshalResult(paginate(engine.orderService.getOrders(), args))
  );

  add(
    'get_order_history',
    'Get order history for a specific order.',
    { order_id: z.union([z.number(), z.string()]).describe('Order ID') },
    (args) => {
      const err = validateRequired(args, ['order_id']);
      if (err) return errorResult(err);
      return marshalResult(engine.orderService.getOrderHistory(safeString(args.order_id, '')));
    }
  );

  add(
    'get_order_trades',
    'Get trades for a specific order.',
    { order_id: z.union([z.number(), z.string()]).describe('Order ID') },
    (args) => {
      const err = validateRequired(args, ['order_id']);
      if (err) return errorResult(err);
      return marshalResult(engine.orderService.getOrderTrades(safeString(args.order_id, '')));
    }
  );

  add('get_gtts', 'Get all active GTT orders.', zPagination, (args) =>
    marshalResult(paginate(engine.gttService.getGTTs(), args))
  );

  add('get_mf_holdings', 'Get mutual fund holdings.', {}, () => marshalResult([]));

  // -------------------------------------------------------------------------
  // Market data tools (JIT)
  // -------------------------------------------------------------------------
  add('get_quotes', 'Get market data quotes for a list of instruments.', zInstruments, (args) => {
    const instruments = safeStringArray(args.instruments);
    if (instruments.length === 0) return errorResult('At least one instrument must be specified');
    return marshalResult(engine.quoteService.getQuote(instruments));
  });

  add(
    'search_instruments',
    'Search instruments. Supports pagination.',
    {
      query: z.string().describe('Search query'),
      filter_on: z.enum(['id', 'name', 'isin', 'tradingsymbol', 'underlying']).optional(),
      ...zPagination,
    },
    (args) => {
      const err = validateRequired(args, ['query']);
      if (err) return errorResult(err);
      const query = safeString(args.query, '');
      const filterOn = safeString(args.filter_on, 'id');
      const all = engine.pool.getInstruments();
      const lower = query.toLowerCase();
      let out = all;
      if (filterOn === 'underlying') {
        const symbol = query.includes(':') ? query.split(':')[1] : query;
        out = all.filter(
          (i) =>
            (i.segment === 'NFO' || i.segment === 'BFO') &&
            i.tradingsymbol.toUpperCase().startsWith(symbol.toUpperCase())
        );
      } else {
        out = all.filter((i) => {
          switch (filterOn) {
            case 'name':
              return i.name.toLowerCase().includes(lower);
            case 'tradingsymbol':
              return i.tradingsymbol.toLowerCase().includes(lower);
            case 'isin':
              return i.exchange_token.includes(lower);
            case 'id':
            default:
              return `${i.exchange}:${i.tradingsymbol}`.toLowerCase().includes(lower);
          }
        });
      }
      return marshalResult(paginate(out, args));
    }
  );

  add(
    'get_historical_data',
    'Get historical price data for an instrument.',
    {
      instrument_token: z.number().describe('Instrument token'),
      from_date: z.string().describe('From date in YYYY-MM-DD HH:MM:SS format'),
      to_date: z.string().describe('To date in YYYY-MM-DD HH:MM:SS format'),
      interval: z.enum(INTERVALS).describe('Candle interval'),
      continuous: z.boolean().optional(),
      oi: z.boolean().optional(),
    },
    (args) => {
      const err = validateRequired(args, ['instrument_token', 'from_date', 'to_date', 'interval']);
      if (err) return errorResult(err);
      const token = safeNumber(args.instrument_token, 0);
      const from = new Date(safeString(args.from_date, '').replace(' ', 'T'));
      const to = new Date(safeString(args.to_date, '').replace(' ', 'T'));
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return errorResult('Failed to parse date, use format YYYY-MM-DD HH:MM:SS');
      }
      return marshalResult(engine.historicalService.getHistoricalData(token, args.interval, from, to));
    }
  );

  add('get_ltp', 'Get latest trading prices for a list of instruments.', zInstruments, (args) => {
    const instruments = safeStringArray(args.instruments);
    if (instruments.length === 0) return errorResult('At least one instrument must be specified');
    return marshalResult(engine.quoteService.getLTP(instruments));
  });

  add('get_ohlc', 'Get OHLC data for a list of instruments.', zInstruments, (args) => {
    const instruments = safeStringArray(args.instruments);
    if (instruments.length === 0) return errorResult('At least one instrument must be specified');
    return marshalResult(engine.quoteService.getOHLC(instruments));
  });

  // -------------------------------------------------------------------------
  // POST tools
  // -------------------------------------------------------------------------
  add(
    'place_order',
    'Place an order.',
    {
      variety: z.enum(VARIETIES).default('regular'),
      exchange: z.enum(EXCHANGES).default('NSE'),
      tradingsymbol: z.string(),
      transaction_type: z.enum(['BUY', 'SELL']),
      quantity: z.number().min(1),
      product: z.enum(PRODUCTS),
      order_type: z.enum(ORDER_TYPES),
      price: z.number().optional(),
      validity: z.enum(['DAY', 'IOC', 'TTL']).optional(),
      validity_ttl: z.number().optional(),
      disclosed_quantity: z.number().optional(),
      trigger_price: z.number().optional(),
      iceberg_legs: z.number().optional(),
      iceberg_quantity: z.number().optional(),
      tag: z.string().max(20).optional(),
    },
    (args) => {
      const err = validateRequired(args, ['tradingsymbol', 'transaction_type', 'quantity', 'product', 'order_type']);
      if (err) return errorResult(err);
      const result = engine.orderService.placeOrder(safeString(args.variety, 'regular') as any, {
        exchange: safeString(args.exchange, 'NSE') as any,
        tradingsymbol: safeString(args.tradingsymbol, ''),
        transaction_type: safeString(args.transaction_type, '') as any,
        quantity: safeNumber(args.quantity, 0),
        product: safeString(args.product, '') as any,
        order_type: safeString(args.order_type, '') as any,
        price: safeNumber(args.price, 0) || undefined,
        validity: safeString(args.validity, 'DAY') as any,
        disclosed_quantity: safeNumber(args.disclosed_quantity, 0) || undefined,
        trigger_price: safeNumber(args.trigger_price, 0) || undefined,
        tag: safeString(args.tag, '') || undefined,
      });
      return marshalResult(result);
    }
  );

  add(
    'modify_order',
    'Modify an order.',
    {
      variety: z.enum(VARIETIES).default('regular'),
      order_id: z.union([z.number(), z.string()]),
      quantity: z.number().optional(),
      price: z.number().optional(),
      order_type: z.enum(ORDER_TYPES).optional(),
      validity: z.enum(['DAY', 'IOC', 'TTL']).optional(),
      disclosed_quantity: z.number().optional(),
      trigger_price: z.number().optional(),
    },
    (args) => {
      const err = validateRequired(args, ['order_id']);
      if (err) return errorResult(err);
      const result = engine.orderService.modifyOrder(
        safeString(args.variety, 'regular') as any,
        safeString(args.order_id, ''),
        {
          quantity: safeNumber(args.quantity, 0) || undefined,
          price: safeNumber(args.price, 0) || undefined,
          order_type: safeString(args.order_type, '') as any || undefined,
          validity: safeString(args.validity, '') as any || undefined,
          disclosed_quantity: safeNumber(args.disclosed_quantity, 0) || undefined,
          trigger_price: safeNumber(args.trigger_price, 0) || undefined,
        }
      );
      return marshalResult(result);
    }
  );

  add(
    'cancel_order',
    'Cancel an order.',
    {
      variety: z.enum(VARIETIES).default('regular'),
      order_id: z.union([z.number(), z.string()]),
    },
    (args) => {
      const err = validateRequired(args, ['order_id']);
      if (err) return errorResult(err);
      return marshalResult(engine.orderService.cancelOrder(safeString(args.variety, 'regular') as any, safeString(args.order_id, '')));
    }
  );

  add(
    'place_gtt_order',
    'Place a GTT (Good Till Triggered) order.',
    {
      instrument_token: z.number(),
      exchange: z.enum(EXCHANGES),
      tradingsymbol: z.string(),
      trigger_values: z.array(z.number()),
      orders: z.array(
        z.object({
          exchange: z.string(),
          tradingsymbol: z.string(),
          transaction_type: z.enum(['BUY', 'SELL']),
          quantity: z.number(),
          order_type: z.enum(ORDER_TYPES),
          product: z.enum(['CNC', 'NRML', 'MIS']),
          price: z.number(),
        })
      ),
    },
    (args) => {
      const err = validateRequired(args, ['instrument_token', 'exchange', 'tradingsymbol', 'trigger_values', 'orders']);
      if (err) return errorResult(err);
      const trigger = engine.gttService.createTrigger({
        instrument_token: safeNumber(args.instrument_token, 0),
        exchange: safeString(args.exchange, 'NSE'),
        tradingsymbol: safeString(args.tradingsymbol, ''),
        trigger_values: safeNumberArray(args.trigger_values),
        orders: (args.orders ?? []).map((o: any) => ({
          exchange: safeString(o.exchange, ''),
          tradingsymbol: safeString(o.tradingsymbol, ''),
          transaction_type: safeString(o.transaction_type, ''),
          quantity: safeNumber(o.quantity, 0),
          order_type: safeString(o.order_type, ''),
          product: safeString(o.product, ''),
          price: safeNumber(o.price, 0),
        })),
      });
      return marshalResult({ trigger_id: trigger.id });
    }
  );

  add(
    'modify_gtt_order',
    'Modify a GTT order.',
    {
      trigger_id: z.union([z.number(), z.string()]),
      trigger_values: z.array(z.number()).optional(),
    },
    (args) => {
      const err = validateRequired(args, ['trigger_id']);
      if (err) return errorResult(err);
      const trigger = engine.gttService.modifyTrigger(safeString(args.trigger_id, ''), {
        trigger_values: args.trigger_values !== undefined ? safeNumberArray(args.trigger_values) : undefined,
      });
      return marshalResult({ trigger_id: trigger.id });
    }
  );

  add(
    'delete_gtt_order',
    'Delete a GTT order.',
    { trigger_id: z.union([z.number(), z.string()]) },
    (args) => {
      const err = validateRequired(args, ['trigger_id']);
      if (err) return errorResult(err);
      engine.gttService.deleteGTT(safeString(args.trigger_id, ''));
      return marshalResult({ trigger_id: safeString(args.trigger_id, '') });
    }
  );
}
