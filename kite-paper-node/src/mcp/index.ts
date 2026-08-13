/**
 * kite-paper-node MCP — exposes the mock engine's JIT data via the Model
 * Context Protocol, with tool parity to Zerodha's `kite-mcp-server`.
 */

export { createMcpServer, startMcpStdio, createMcpHttpHandler } from './server';
export type { McpServerOptions } from './server';
export { registerAllTools } from './tools';
export { marshalResult, errorResult, validateRequired, safeString, safeNumber, safeBool, safeStringArray, safeNumberArray, toErrorResult } from './common';
export { parsePagination, applyPagination, createPaginatedResponse, paginate } from './pagination';

import type { MockEngine } from '../mock-engine';
import { createMcpServer, startMcpStdio, createMcpHttpHandler, type McpServerOptions } from './server';

export type McpMode = 'stdio' | 'http' | 'sse' | 'hybrid';

/**
 * Start an MCP server in the given mode.
 * - `stdio`: connect to stdout/stdin (blocks the process; used by local agents).
 * - `http` / `hybrid`: returns an HTTP handler to mount on an express app.
 */
export async function startMcp(
  engine: MockEngine,
  mode: McpMode,
  options: McpServerOptions = {}
): Promise<{ server: ReturnType<typeof createMcpServer>; httpHandler?: (req: any, res: any) => Promise<void> }> {
  if (mode === 'stdio') {
    const server = await startMcpStdio(engine, options);
    return { server };
  }
  return {
    server: createMcpServer(engine, options),
    httpHandler: createMcpHttpHandler(engine, options),
  };
}
