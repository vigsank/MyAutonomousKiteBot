import { logger } from "../server/Logger";
import { getRegistry } from "./registry";
import { withinHoldWindow } from "./scheduler";
import { Blackboard } from "./blackboard";
import { AgentContext, AgentDef, AgentId, AgentResult } from "./types";

/**
 * Publish a completed agent's payload to the blackboard so downstream agents
 * read it instead of recomputing (G2/G3). Only a `done` agent publishes: a
 * `failed` agent that published a half-built payload would silently poison
 * every downstream decision.
 */
function publishDone(ctx: AgentContext, r: AgentResult): void {
  if (r.status === "done" && r.payload !== undefined) {
    ctx.blackboard.publish(r.id, r.payload);
  }
}

/** Run every agent's `run` safely; a thrown error becomes a 'failed' result. */
async function runSafe(agent: AgentDef, ctx: AgentContext): Promise<AgentResult> {
  const start = Date.now();
  try {
    return await agent.run(ctx);
  } catch (err) {
    logger.warn({ id: agent.id, err }, `Agent ${agent.name} threw`);
    return {
      id: agent.id,
      status: "failed",
      startedAt: new Date(start),
      durationMs: Date.now() - start,
      summary: `${agent.id}: ${String(err)}`,
    };
  }
}

/**
 * Run a single pass over the whole registry, respecting `parallel` and `deps`:
 *   - parallel agents with all deps satisfied run concurrently (Promise.all);
 *   - sequential agents run one at a time, in dependency order.
 * Never throws — a failing agent is marked 'failed' and the pass continues.
 */
export async function runPass(
  ctx: AgentContext,
  opts?: { skip?: Set<AgentId> },
): Promise<AgentResult[]> {
  const registry = getRegistry();
  const skip = opts?.skip ?? new Set<AgentId>();
  const all = [...registry.values()];

  // Skipped agents become immediate 'skipped' results (their deps still resolve).
  const skippedResults: AgentResult[] = [];
  const active = all.filter((a) => {
    if (skip.has(a.id)) {
      skippedResults.push({
        id: a.id,
        status: "skipped",
        startedAt: new Date(),
        durationMs: 0,
        summary: `${a.id}: skipped (hold window)`,
      });
      return false;
    }
    return true;
  });
  const resultMap = new Map<AgentId, AgentResult>(skippedResults.map((r) => [r.id, r]));
  const pending = new Set<AgentId>(active.map((a) => a.id));

  // An agent is ready when every dep has RESOLVED and none of them FAILED.
  // A pending (not-yet-run) dep means "wait", not "skip".
  const depFailed = (d: AgentId): boolean => resultMap.get(d)?.status === "failed";
  const ready = (): AgentDef[] =>
    active.filter(
      (a) => pending.has(a.id) && a.deps.every((d) => resultMap.has(d)) && !a.deps.some(depFailed),
    );

  // Agents whose dependency FAILED can never become ready — degrade to skipped.
  const degradeSkipped = (): void => {
    for (const id of pending) {
      const a = active.find((x) => x.id === id);
      if (a && a.deps.some(depFailed)) {
        resultMap.set(id, {
          id,
          status: "skipped",
          startedAt: new Date(),
          durationMs: 0,
          summary: `${id}: skipped (dependency failed)`,
        });
        pending.delete(id);
      }
    }
  };

  while (pending.size > 0) {
    degradeSkipped();
    if (pending.size === 0) break;
    const readyNow = ready();
    if (readyNow.length === 0) {
      // Unresolvable dependency cycle / unmet deps — mark the rest failed.
      for (const id of pending) {
        resultMap.set(id, {
          id,
          status: "failed",
          startedAt: new Date(),
          durationMs: 0,
          summary: `${id}: unmet dependencies (no progress)`,
        });
      }
      break;
    }

    // Phase: run all ready parallel agents concurrently.
    const parallelBatch = readyNow.filter((a) => a.parallel);
    await Promise.all(
      parallelBatch.map(async (a) => {
        const r = await runSafe(a, ctx);
        publishDone(ctx, r);
        resultMap.set(a.id, r);
        pending.delete(a.id);
      }),
    );

    // Phase: run all newly-ready sequential agents one at a time.
    const sequentialBatch = ready().filter((a) => !a.parallel);
    for (const a of sequentialBatch) {
      const r = await runSafe(a, ctx);
      publishDone(ctx, r);
      resultMap.set(a.id, r);
      pending.delete(a.id);
    }
  }

  return all.map((a) => resultMap.get(a.id)!);
}

export interface ScheduleLoopOptions {
  config: AgentContext["config"];
  ledger: AgentContext["ledger"];
  news: AgentContext["news"];
  symbols: string[];
  intervalMs: number;
  holdWindowMin: number;
  /** Wire the real risk/execution layer so the cadence `execute` can run. */
  risk?: AgentContext["risk"];
  trader?: AgentContext["trader"];
}

export interface ScheduleLoopHandle {
  stop: () => void;
}

/**
 * Run `runPass` on a `setInterval` cadence with a safety cap.
 *
 * While the market is in the hold window (see scheduler.withinHoldWindow) the
 * real `execute`/`strategist` actions are skipped and reported as 'skipped'.
 * This is a self-contained skeleton — it is NOT wired into the running server.
 */
export async function scheduleLoop(opts: ScheduleLoopOptions): Promise<ScheduleLoopHandle> {
  const maxRuns = 10; // safety guard so an unattended loop can't run forever
  let passNumber = 0;
  let running = false;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const stop = (): void => {
    stopped = true;
    if (timer !== null) clearInterval(timer);
  };

  const tick = async (): Promise<void> => {
    if (stopped || running) return;
    if (passNumber >= maxRuns) {
      stop();
      return;
    }
    running = true;
    passNumber += 1;
    const now = new Date();
    try {
      const ctx: AgentContext = {
        config: opts.config,
        ledger: opts.ledger,
        news: opts.news,
        symbols: opts.symbols,
        passNumber,
        now,
        risk: opts.risk,
        trader: opts.trader,
        blackboard: new Blackboard(),
      };
      // Gate BEFORE running: in the hold window, never invoke strategist/execute.
      const hold = withinHoldWindow(now, opts.holdWindowMin);
      const skip = new Set<AgentId>();
      if (hold) {
        skip.add("strategist");
        skip.add("execute");
      }
      const results = await runPass(ctx, { skip });
      logger.info(
        {
          pass: passNumber,
          hold,
          results: results.map((r) => ({
            id: r.id,
            status: r.status,
            summary: r.summary,
          })),
        },
        "agent pass complete",
      );
    } catch (err) {
      logger.error({ pass: passNumber, err }, "agent pass failed");
    } finally {
      running = false;
    }
  };

  timer = setInterval(tick, opts.intervalMs);
  // Kick off the first pass immediately rather than waiting a full interval.
  void tick();

  return { stop };
}
