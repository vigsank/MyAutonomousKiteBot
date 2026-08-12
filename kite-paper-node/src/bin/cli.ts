#!/usr/bin/env node
/**
 * kite-paper-node CLI — starts a standalone mock server.
 *
 * Usage:
 *   npx kite-paper-node --port=4000 --seed-symbols=RELIANCE,NIFTY50
 */

import * as fs from 'fs';
import { createMockServer } from '../index';
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
  const config: MockEngineConfig = {
    ...fileConfig,
    startingCapital: num(args['starting-capital'], fileConfig.startingCapital ?? 1_000_000),
    ticker: {
      mode: tickerMode as TickerConfig['mode'],
      randomWalk: {
        ...fileConfig.ticker?.randomWalk,
        seedSymbols: seedSymbols ?? fileConfig.ticker?.randomWalk?.seedSymbols,
        volatility: num(args.volatility, fileConfig.ticker?.randomWalk?.volatility ?? 0.002),
        tickIntervalMs: num(args['tick-interval'], fileConfig.ticker?.randomWalk?.tickIntervalMs ?? 1000),
        enableRealismFeatures: bool(
          args['no-realism'] ? false : undefined,
          fileConfig.ticker?.randomWalk?.enableRealismFeatures ?? true
        ),
      },
    },
  };

  const server = await createMockServer({ ...config, server: serverConfig });

  const symbols = server.engine.listSymbols();
  console.log(`\n  kite-paper-node mock server running`);
  console.log(`  REST:  http://${serverConfig.host}:${server.port}`);
  console.log(`  WS:    ws://${serverConfig.host}:${server.port}/ticker`);
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
