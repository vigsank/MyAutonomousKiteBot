import * as crypto from "crypto";
import { AppConfig } from "./AppConfig";
import { Ledger } from "./Ledger";
import { NewsSentimentEngine } from "./NewsSentimentEngine";
import { RiskEngine } from "./RiskEngine";
import { PaperTrader } from "./PaperTrader";
import { logger } from "./Logger";
import { scheduleLoop, ScheduleLoopHandle } from "../agents/orchestrator";
import { runProbe, ProbeRunType } from "../agents/probe";
import { AgentContext } from "../agents/types";
import { istMinutes } from "../agents/scheduler";
import { KiteMcpClient } from "./KiteMcpClient";

/** How often the probe scheduler checks the IST clock. */
const PROBE_TICK_MS = 60 * 1000;
/** Cadence pass is held off until 75 min after the IST open (see scheduler). */
const HOLD_WINDOW_MIN = 75;

interface AgentsRuntimeOptions {
  config: AppConfig;
  ledger: Ledger;
  news: NewsSentimentEngine;
  risk: RiskEngine;
  trader: PaperTrader;
  symbols: string[];
}

/** The three scheduled probe windows, keyed by their config time. */
interface ProbeWindow {
  runType: ProbeRunType;
  time: string;
}

/**
 * Server-side agent runtime: owns the 10-minute cadence pass loop and the
 * IST-time probe scheduler. Both are started via `start()` and torn down via
 * `stop()`. The runtime is intentionally self-contained and never throws — a
 * failure to schedule or a thrown probe is logged and swallowed so it can never
 * crash the bot boot or the live tick loop.
 */
export class AgentsRuntime {
  private readonly opts: AgentsRuntimeOptions;
  private passLoop: ScheduleLoopHandle | null = null;
  private probeTimer: NodeJS.Timeout | null = null;
  private readonly firedProbes = new Set<string>();
  private lastProbeDayKey = "";
  /** Read-only Kite MCP client (mock or live) for account data. */
  private readonly mcp: KiteMcpClient;

  constructor(opts: AgentsRuntimeOptions) {
    this.opts = opts;
    this.mcp = new KiteMcpClient(opts.config.mcp);
  }

  /** Build a fresh AgentContext with the shared domain engines wired in. */
  private makeContext(now: Date, probeRunId?: string): AgentContext {
    return {
      config: this.opts.config,
      ledger: this.opts.ledger,
      news: this.opts.news,
      symbols: this.opts.symbols,
      passNumber: 1,
      now,
      risk: this.opts.risk,
      trader: this.opts.trader,
      mcp: this.mcp,
      probeRunId,
    };
  }

  start(): void {
    const agents = this.opts.config.agents;
    if (!agents.enabled) {
      logger.info("Agents disabled (AGENTS_ENABLED=false)");
      return;
    }

    // Cadence pass loop (10 min by default).
    scheduleLoop({
      config: this.opts.config,
      ledger: this.opts.ledger,
      news: this.opts.news,
      symbols: this.opts.symbols,
      intervalMs: agents.intervalMs,
      holdWindowMin: HOLD_WINDOW_MIN,
      risk: this.opts.risk,
      trader: this.opts.trader,
    })
      .then((handle) => {
        this.passLoop = handle;
      })
      .catch((err: any) => {
        logger.error({ err: err?.message }, "Agent cadence loop failed to start");
      });

    // Probe scheduler — every 60s, fire each probe once per type per day.
    this.probeTimer = setInterval(() => this.tickProbes(), PROBE_TICK_MS);

    // Dev mode: run the probe immediately on start, regardless of IST time.
    if (agents.probeAlways) {
      logger.info('AGENTS_PROBE_ALWAYS=true — firing probe immediately');
      this.fireProbeNow();
    }

    logger.info(
      {
        intervalMs: agents.intervalMs,
        probePreOpen: agents.probePreOpen,
        probeMidSession: agents.probeMidSession,
        probePreClose: agents.probePreClose,
      },
      "Agents runtime started",
    );
  }

  stop(): void {
    if (this.probeTimer !== null) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
    if (this.passLoop !== null) {
      try {
        this.passLoop.stop();
      } catch (err: any) {
        logger.warn({ err: err?.message }, "Error stopping agent cadence loop");
      }
      this.passLoop = null;
    }
  }

  private tickProbes(): void {
    const now = new Date();
    const minute = istMinutes(now);
    const dayKey = now.toISOString().slice(0, 10); // once per UTC day

    // Prune yesterday's fired keys when the day rolls over.
    if (this.lastProbeDayKey !== dayKey) {
      this.firedProbes.clear();
      this.lastProbeDayKey = dayKey;
    }

    // Skip non-trading days (NSE is closed Sat/Sun IST).
    if (isWeekendIST(now)) {
      return;
    }

    const windows: ProbeWindow[] = [
      { runType: "pre_open", time: this.opts.config.agents.probePreOpen },
      { runType: "mid_session", time: this.opts.config.agents.probeMidSession },
      { runType: "pre_close", time: this.opts.config.agents.probePreClose },
    ];

    for (const w of windows) {
      const target = minutesOfDay(w.time);
      if (minute < target || minute >= target + 1) continue;
      const firedKey = `${dayKey}:${w.runType}`;
      if (this.firedProbes.has(firedKey)) continue;
      this.firedProbes.add(firedKey);
      this.fireProbe(w.runType);
    }
  }

  private fireProbe(runType: ProbeRunType): void {
    for (const symbol of this.opts.symbols) {
      // Run asynchronously; each probe is fire-and-forget and never throws.
      const ctx = this.makeContext(new Date(), crypto.randomUUID());
      runProbe(ctx, runType, symbol)
        .then((result) => {
          logger.info(
            { runType, symbol, status: result.status, durationMs: result.durationMs },
            "probe complete",
          );
        })
        .catch((err: any) => {
          logger.error({ runType, symbol, err: err?.message }, "probe failed");
        });
    }
  }

  /** Dev helper: fire all three probe types once, regardless of IST time. */
  private fireProbeNow(): void {
    const types: ProbeRunType[] = ["pre_open", "mid_session", "pre_close"];
    for (const t of types) this.fireProbe(t);
  }
}

/** Convert an 'HH:MM' time string to minutes-of-day (0..1439). */
function minutesOfDay(time: string): number {
  const [h, m] = time.split(":").map((p) => Number(p));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** True when `now` (IST) falls on a weekend — NSE is closed Sat/Sun. */
function isWeekendIST(now: Date): boolean {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}
