import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadConfig } from "../server/AppConfig";
import { Ledger } from "../server/Ledger";
import { LlmManager } from "../server/LlmManager";
import { logger } from "../server/Logger";
import { NewsSentimentEngine } from "../server/NewsSentimentEngine";
import { PaperTrader } from "../server/PaperTrader";
import { RiskEngine } from "../server/RiskEngine";
import { KiteMcpClient } from "../server/KiteMcpClient";
import { runPass } from "./orchestrator";
import { AgentContext } from "./types";

/**
 * Runnable dry-run of the agent orchestration skeleton.
 *
 * Loads config, boots a PAPER Ledger (in DATA_DIR or a temp dir), wires up the
 * LLM + news engine, runs one full pass, prints each agent result, and exits 0.
 * The news/sentiment agents will try real network — any failure is captured as
 * a 'failed' result and never crashes the process.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const dataDir =
    process.env.DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "kite-agents-"));

  const ledger = new Ledger(dataDir);
  ledger.runMigrations();
  ledger.startSession("PAPER");

  const llm = new LlmManager(config.llm);
  const news = new NewsSentimentEngine(config, llm, ledger);

  const symbols = config.watchlist
    .filter((s) => s.enabled)
    .slice(0, 3)
    .map((s) => s.tradingsymbol);

  logger.info({ dataDir, symbols }, "starting agent dry-run");

  // Wire the real risk + paper execution layer so the execute agent can run
  // through the RiskEngine hard gate and the PaperTrader (never real orders).
  const risk = new RiskEngine(config, ledger);
  const trader = new PaperTrader(config, ledger);
  // Read-only Kite MCP client (mock or live) for account data.
  const mcp = new KiteMcpClient(config.mcp);

  const ctx: AgentContext = {
    config,
    ledger,
    news,
    symbols,
    passNumber: 1,
    now: new Date(),
    risk,
    trader,
    mcp,
  };

  const results = await runPass(ctx);

  // eslint-disable-next-line no-console
  console.log(`\n=== agent dry-run (${symbols.length} symbols) ===`);
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`  [${r.id}] ${r.status.padEnd(8)} ${String(r.durationMs).padStart(6)}ms — ${r.summary}`);
  }

  // Dev: run the probe immediately (regardless of IST time) so every test run
  // exercises the probe + persists probe runs / news articles.
  const { runProbe } = await import("./probe");
  // eslint-disable-next-line no-console
  console.log(`\n=== probe dry-run (${symbols.length} symbols) ===`);
  for (const sym of symbols) {
    for (const t of ["pre_open", "mid_session", "pre_close"] as const) {
      const r = await runProbe(ctx, t, sym);
      // eslint-disable-next-line no-console
      console.log(`  [probe:${t}] ${sym} ${r.status.padEnd(8)} ${String(r.durationMs).padStart(6)}ms — ${r.summary}`);
    }
  }

  try {
    ledger.close();
  } catch {
    // closing is best-effort; ignore
  }
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, "agent dry-run failed");
  process.exit(1);
});
