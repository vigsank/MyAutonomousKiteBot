#!/usr/bin/env node
/**
 * kite-paper-node CLI — starts a standalone mock server.
 *
 * Usage:
 *   npx kite-paper-node --port=4000 --seed-symbols=RELIANCE,NIFTY50
 */

import * as fs from 'fs';
import { createMockServer } from '../index';
import { MockEngine } from '../mock-engine';
import type { MockEngineConfig, ServerConfig, TickerConfig } from '../types';

interface CliArgs {
  [key: string]: string | boolean;
}

// Config file may include a `server` block not present on MockEngineConfig.
interface FileConfig extends MockEngineConfig {
  server?: Partial<ServerConfig>;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) {
      args[arg.slice(2)] = true;
    } else {
      args[arg.slice(2, eq)] = arg.slice(eq + 1);
    }
  }
  return args;
}

function num(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: string | boolean | undefined, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Load config file if provided.
  let fileConfig: FileConfig = {};
  if (typeof args.config === 'string') {
    fileConfig = JSON.parse(fs.readFileSync(args.config, 'utf-8'));
  }

  const seedSymbols = (args['seed-symbols'] as string)?.split(',').filter(Boolean);
  const serverConfig: Partial<ServerConfig> = {
    port: num(args.port, fileConfig.server?.port ?? 4000),
    host: (args.host as string) ?? fileConfig.server?.host ?? '127.0.0.1',
    enableCORS: bool(args['enable-cors'], fileConfig.server?.enableCORS ?? false),
    enableBinaryWS: bool(args['enable-binary-ws'], fileConfig.server?.enableBinaryWS ?? true),
  };

  const tickerMode = (args['ticker-mode'] as string) ?? fileConfig.ticker?.mode ?? 'random-walk';

  // Parse per-instrument volatility scale: "738561:1.5,779521:2.0".
  const volatilityScale: Record<number, number> = {};
  if (typeof args['volatility-scale'] === 'string') {
    for (const pair of args['volatility-scale'].split(',')) {
      const [tok, scale] = pair.split(':');
      const t = Number(tok);
      const s = Number(scale);
      if (Number.isFinite(t) && Number.isFinite(s)) volatilityScale[t] = s;
    }
  }

  // Parse regime probabilities: "trending_up:0.25,trending_down:0.25,ranging:0.35,volatile:0.15".
  const regimeProbabilities: Record<string, number> = {};
  if (typeof args['regime-probabilities'] === 'string') {
    for (const pair of args['regime-probabilities'].split(',')) {
      const [regime, prob] = pair.split(':');
      const p = Number(prob);
      if (regime && Number.isFinite(p)) regimeProbabilities[regime] = p;
    }
  }

  const seedArg = typeof args.seed === 'string' ? Number(args.seed) : undefined;
  const config: MockEngineConfig = {
    ...fileConfig,
    startingCapital: num(args['starting-capital'], fileConfig.startingCapital ?? 1_000_000),
    stateFile: (args['state-file'] as string) ?? fileConfig.stateFile ?? undefined,
    ticker: {
      mode: tickerMode as TickerConfig['mode'],
      randomWalk: {
        ...fileConfig.ticker?.randomWalk,
        seedSymbols: seedSymbols ?? fileConfig.ticker?.randomWalk?.seedSymbols,
        seed: seedArg ?? fileConfig.ticker?.randomWalk?.seed,
        volatility: num(args.volatility, fileConfig.ticker?.randomWalk?.volatility ?? 0.0004),
        volatilityScale: Object.keys(volatilityScale).length
          ? volatilityScale
          : fileConfig.ticker?.randomWalk?.volatilityScale,
        tickIntervalMs: num(args['tick-interval'], fileConfig.ticker?.randomWalk?.tickIntervalMs ?? 1000),
        enableRealismFeatures: bool(
          args['no-realism'] ? false : undefined,
          fileConfig.ticker?.randomWalk?.enableRealismFeatures ?? true
        ),
        regimeSwitchBars: num(args['regime-switch-bars'], fileConfig.ticker?.randomWalk?.regimeSwitchBars ?? 1200),
        regimeProbabilities: Object.keys(regimeProbabilities).length
          ? regimeProbabilities
          : fileConfig.ticker?.randomWalk?.regimeProbabilities,
        regimePersistence: num(args['regime-persistence'], fileConfig.ticker?.randomWalk?.regimePersistence ?? 0.4),
        enableSeasonality: bool(
          args.seasonality === 'false' ? false : undefined,
          fileConfig.ticker?.randomWalk?.enableSeasonality ?? true
        ),
        shockProbability: num(args['shock-probability'], fileConfig.ticker?.randomWalk?.shockProbability ?? 0.02),
        shockSize: num(args['shock-size'], fileConfig.ticker?.randomWalk?.shockSize ?? 0.02),
      },
      historicalReplay: {
        ...fileConfig.ticker?.historicalReplay,
        source: (args['replay-source'] as string) ?? fileConfig.ticker?.historicalReplay?.source,
        replaySpeed: num(args['replay-speed'], fileConfig.ticker?.historicalReplay?.replaySpeed ?? 1),
      },
    },
  };

  const mcpMode = (args['mcp'] as string) ?? 'off';

  // Pure MCP stdio mode: no HTTP server, connect over stdio and block.
  if (mcpMode === 'stdio') {
    const engine = new MockEngine(config);
    if (tickerMode === 'replay' && config.ticker?.historicalReplay?.source) {
      await engine.loadHistoricalReplay(config.ticker.historicalReplay as any);
    }
    const symbols = engine.listSymbols();
    console.error(`[kite-paper-node] MCP (stdio) ready — ${symbols.length} symbols`);
    const { startMcpStdio } = await import('../mcp');
    await startMcpStdio(engine, {
      excludedTools: (args['mcp-exclude'] as string) ?? '',
    });
    return; // process stays alive via stdio
  }

  const server = await createMockServer({ ...config, server: serverConfig });

  // Replay mode: load the historical source and replay it as ticks.
  if (tickerMode === 'replay' && config.ticker?.historicalReplay?.source) {
    server.engine.loadHistoricalReplay(config.ticker.historicalReplay as any).catch((e: any) => {
      console.error('Replay failed:', e?.message ?? e);
    });
  }

  // Mount MCP over HTTP when requested.
  if (mcpMode === 'http' || mcpMode === 'hybrid') {
    const mcpPath = (args['mcp-path'] as string) ?? '/mcp';
    const { createMcpHttpHandler } = await import('../mcp');
    const handler = createMcpHttpHandler(server.engine, {
      excludedTools: (args['mcp-exclude'] as string) ?? '',
    });
    server.rest.use(mcpPath, handler);
  }

  const symbols = server.engine.listSymbols();
  console.log(`\n  kite-paper-node mock server running`);
  console.log(`  REST:  http://${serverConfig.host}:${server.port}`);
  console.log(`  WS:    ws://${serverConfig.host}:${server.port}/ticker`);
  if (mcpMode === 'http' || mcpMode === 'hybrid') {
    console.log(`  MCP:   http://${serverConfig.host}:${server.port}${(args['mcp-path'] as string) ?? '/mcp'}`);
  }
  console.log(`  Symbols: ${symbols.length ? symbols.join(', ') : '(none — use --seed-symbols)'}`);
  console.log(`  Capital: ${server.engine.getLedger().starting_capital}`);
  console.log(`  Press Ctrl+C to stop.\n`);

  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start kite-paper-node:', err?.message ?? err);
  process.exit(1);
});
