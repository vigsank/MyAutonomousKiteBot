import { AgentId } from "./types";

/** Hard cap on how deep an agent-to-agent (A2A) chain may recurse. */
export const MAX_A2A_DEPTH = 2;

/** A2A order type → downstream agents to invoke. Deterministic per order type. */
export function routerFor(orderType: "BUY" | "SELL" | "OPTION" | "CLOSE"): AgentId[] {
  switch (orderType) {
    case "BUY":
    case "SELL":
      return ["news_feed", "sentiment", "validator", "holdings"];
    case "OPTION":
      return ["news_feed", "sentiment", "holdings"];
    case "CLOSE":
      return ["holdings", "sentiment"];
    default:
      return [];
  }
}
