import { AgentDef, AgentId } from "./types";
import { buildDomainAgents as buildA } from "./domainA";
import { buildDomainAgents as buildB } from "./domainB";
import { buildDomainAgents as buildC } from "./domainC";
import { buildDomainAgents as buildD } from "./domainD";
import { buildDomainAgents as buildE } from "./domainE";
import { buildDomainAgents as buildF } from "./domainF";
import { buildDomainAgents as buildG } from "./domainG";
import { buildDomainAgents as buildH } from "./domainH";
import { buildHoldingsReviewAgent } from "./holdingsReview";

/**
 * Agent registry — the full fleet (domains A–H) from the plan.
 *
 * Each domain file exports its agents; this module combines them into a single
 * Map keyed by AgentId. Every agent's `run` is wrapped by `def` so it never
 * throws — a failure becomes a `failed` result and the pass continues.
 */
function buildRegistry(): Map<AgentId, AgentDef> {
  const registry = new Map<AgentId, AgentDef>();
  const all = [
    ...buildA(),
    ...buildB(),
    ...buildC(),
    ...buildD(),
    ...buildE(),
    ...buildF(),
    ...buildG(),
    ...buildH(),
    buildHoldingsReviewAgent(),
  ];
  for (const agent of all) {
    if (registry.has(agent.id)) {
      // Duplicate id — keep the first (defensive; should not happen).
      continue;
    }
    registry.set(agent.id, agent);
  }
  return registry;
}

export function getRegistry(): Map<AgentId, AgentDef> {
  return buildRegistry();
}
