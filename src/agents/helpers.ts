import { logger } from "../server/Logger";
import { AgentContext, AgentDef, AgentId, AgentResult } from "./types";

/** Shared result helper so every agent reports consistent fields. */
export function result(id: AgentId, status: AgentResult["status"], startMs: number, summary: string, payload?: unknown): AgentResult {
  return {
    id,
    status,
    startedAt: new Date(startMs),
    durationMs: Date.now() - startMs,
    summary,
    payload,
  };
}

/**
 * Wraps a run so any thrown error becomes a 'failed' result instead of
 * propagating. The inner run may return an explicit `status` (e.g. 'skipped');
 * otherwise it defaults to 'done'.
 */
export async function guarded(
  id: AgentId,
  name: string,
  startMs: number,
  run: (ctx: AgentContext) => Promise<{ summary: string; payload?: unknown; status?: AgentResult["status"] } | string>,
  ctx: AgentContext,
): Promise<AgentResult> {
  try {
    const out = await run(ctx);
    if (typeof out === "string") {
      return result(id, "done", startMs, out);
    }
    return result(id, out.status ?? "done", startMs, out.summary, out.payload);
  } catch (err) {
    logger.warn({ id, err }, `Agent ${name} failed`);
    return result(id, "failed", startMs, `${id}: ${String(err)}`);
  }
}

/** Build an AgentDef with the guarded wrapper pre-applied. */
export function def(
  id: AgentId,
  name: string,
  domain: string,
  parallel: boolean,
  deps: AgentId[],
  run: (ctx: AgentContext) => Promise<{ summary: string; payload?: unknown; status?: AgentResult["status"] } | string>,
): AgentDef {
  return {
    id,
    name,
    domain,
    parallel,
    deps,
    run: (ctx) => guarded(id, name, Date.now(), run, ctx),
  };
}
