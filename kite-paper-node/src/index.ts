/**
 * kite-paper-node — public entry point.
 *
 * Exports the drop-in mock classes, the mock engine singleton, the standalone
 * server factory, and all public types.
 */

export { MockEngine } from './mock-engine';
export { MockKiteConnect, getDefaultEngine } from './mock-kite-connect';
export { MockKiteTicker } from './mock-kite-ticker';
export { RestServer } from './server/rest-server';
export { WSServer } from './server/ws-server';
export { BinaryPacker } from './server/binary-packer';
export { GeneratorPool } from './market/generator-pool';
export { RandomWalkGenerator } from './market/random-walk-generator';
export { HistoricalReplayEngine } from './market/historical-replay';
export { TickHistoryBuffer } from './market/tick-history-buffer';
export { createPRNG } from './utils/random';
export { resolveConfig, DEFAULT_CONFIG } from './utils/config';
export { KiteError } from './types';

export * from './types';

import { MockEngine } from './mock-engine';
import { getDefaultEngine } from './mock-kite-connect';
import { RestServer } from './server/rest-server';
import { WSServer } from './server/ws-server';
import { BinaryPacker } from './server/binary-packer';
import type { MockEngineConfig, ServerConfig } from './types';

/** The global mock engine singleton (shared with the mock SDK classes). */
export const mockEngine = getDefaultEngine();

export interface CreateMockServerOptions extends MockEngineConfig {
  server?: Partial<ServerConfig>;
}

export interface MockServer {
  engine: MockEngine;
  rest: RestServer;
  ws: WSServer;
  port: number;
  stop(): Promise<void>;
}

/**
 * Start a standalone mock server (REST + WebSocket) on the given port.
 */
export async function createMockServer(
  options: CreateMockServerOptions = {}
): Promise<MockServer> {
  const engine = new MockEngine(options);
  const serverConfig: ServerConfig = {
    port: options.server?.port ?? 4000,
    host: options.server?.host ?? '127.0.0.1',
    enableCORS: options.server?.enableCORS ?? false,
    enableBinaryWS: options.server?.enableBinaryWS ?? true,
  };

  const rest = new RestServer(
    {
      orderService: engine.orderService,
      positionService: engine.positionService,
      holdingService: engine.holdingService,
      marginService: engine.marginService,
      quoteService: engine.quoteService,
      historicalService: engine.historicalService,
      userService: engine.userService,
      gttService: engine.gttService,
      pool: engine.pool,
      engine,
    },
    serverConfig
  );

  const port = await rest.start();
  const ws = new WSServer(engine.bus, new BinaryPacker(), {
    enableBinaryWS: serverConfig.enableBinaryWS,
  });
  ws.attach(rest.getHttpServer());

  return {
    engine,
    rest,
    ws,
    port,
    async stop() {
      ws.close();
      await rest.stop();
      engine.destroy();
    },
  };
}
