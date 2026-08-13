/**
 * MCP server factory — builds an `McpServer` with all mock tools registered,
 * and provides stdio + HTTP (streamable) transport helpers.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MockEngine } from '../mock-engine';
import { registerAllTools } from './tools';

export interface McpServerOptions {
  /** Comma-separated tool names to omit (Kite MCP parity). */
  excludedTools?: string;
  name?: string;
  version?: string;
}

/** Build an MCP server wired to the given mock engine. */
export function createMcpServer(engine: MockEngine, options: McpServerOptions = {}): McpServer {
  const server = new McpServer({
    name: options.name ?? 'kite-paper-node',
    version: options.version ?? '1.0.0',
  });
  const excluded = new Set(
    (options.excludedTools ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
  registerAllTools(server, engine, excluded);
  return server;
}

/** Start an MCP server over stdio (local agent subprocess). */
export async function startMcpStdio(
  engine: MockEngine,
  options: McpServerOptions = {}
): Promise<McpServer> {
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const server = createMcpServer(engine, options);
  await server.connect(new StdioServerTransport());
  return server;
}

/**
 * Create an HTTP handler for streamable MCP transport. Returns an express
 * middleware-style function `(req, res)` to mount at a path (e.g. `/mcp`).
 */
export function createMcpHttpHandler(
  engine: MockEngine,
  options: McpServerOptions = {}
): (req: any, res: any) => Promise<void> {
  const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
  const sessions = new Map<string, { transport: any; server: McpServer }>();

  return async (req: any, res: any) => {
    const headerSessionId = req.headers['mcp-session-id'];
    let entry = headerSessionId ? sessions.get(String(headerSessionId)) : undefined;

    if (!entry) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        onsessioninitialized: (sid: string) => {
          sessions.set(sid, { transport, server: entry?.server ?? createMcpServer(engine, options) });
        },
      });
      const server = createMcpServer(engine, options);
      entry = { transport, server };
      if (transport.sessionId) sessions.set(String(transport.sessionId), entry);
      await server.connect(transport);
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(String(transport.sessionId));
      };
    }

    try {
      await entry.transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: String(err) }, id: null });
      } else {
        res.end();
      }
    }
  };
}
