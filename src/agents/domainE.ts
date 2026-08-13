import { def } from "./helpers";
import { AgentContext, AgentDef } from "./types";

/**
 * Domain E — portfolio & risk context agents.
 *
 * E1 holdings_exposure : total notional exposure and per-symbol exposure.
 * E2 margins_capital   : used capital vs available capital, free margin.
 * E3 correlation       : concentration note (stub) + position count / max exposure.
 * E4 drawdown_monitor  : current drawdown vs max daily drawdown, breach flag.
 *
 * All agents are parallel with no dependencies and never throw (guarded by `def`).
 */

export function buildDomainAgents(): AgentDef[] {
  return [
    def(
      "holdings_exposure",
      "Holdings Exposure",
      "E",
      true,
      [],
      async (ctx: AgentContext) => {
        const positions = ctx.ledger.getOpenPositions();
        const exposure: Record<string, number> = {};
        let total = 0;
        for (const p of positions) {
          const notional = p.quantity * p.avgPrice;
          exposure[p.symbol] = (exposure[p.symbol] ?? 0) + notional;
          total += notional;
        }
        return {
          summary: `holdings_exposure: ${positions.length} open position(s); total notional ${total.toFixed(2)}.`,
          payload: { total, exposure },
        };
      },
    ),

    def(
      "margins_capital",
      "Margins & Capital",
      "E",
      true,
      [],
      async (ctx: AgentContext) => {
        const used = ctx.ledger.usedCapital();
        const available = ctx.config.risk.availableCapital;
        const free = available - used;
        return {
          summary: `margins_capital: used ${used.toFixed(2)} of ${available.toFixed(2)}; free margin ${free.toFixed(2)}.`,
          payload: { used, available, free },
        };
      },
    ),

    def(
      "correlation",
      "Correlation & Concentration",
      "E",
      true,
      [],
      async (ctx: AgentContext) => {
        const positions = ctx.ledger.getOpenPositions();
        const exposure: Record<string, number> = {};
        for (const p of positions) {
          exposure[p.symbol] = (exposure[p.symbol] ?? 0) + p.quantity * p.avgPrice;
        }
        let maxExposure = 0;
        let maxSymbol = "";
        for (const [symbol, notional] of Object.entries(exposure)) {
          if (notional > maxExposure) {
            maxExposure = notional;
            maxSymbol = symbol;
          }
        }
        return {
          summary: `correlation: code (stub); ${positions.length} open position(s), max single-position exposure ${maxExposure.toFixed(2)} (${maxSymbol || "none"}).`,
          payload: { note: "code (stub)", openPositions: positions.length, maxExposure, maxSymbol },
        };
      },
    ),

    def(
      "drawdown_monitor",
      "Drawdown Monitor",
      "E",
      true,
      [],
      async (ctx: AgentContext) => {
        const drawdown = ctx.ledger.currentDrawdown();
        const max = ctx.config.risk.maxDailyDrawdown;
        const breached = drawdown > max;
        return {
          summary: `drawdown_monitor: current ${drawdown.toFixed(2)} vs max ${max.toFixed(2)}; ${breached ? "BREACHED" : "within limit"}.`,
          payload: { drawdown, max, breached },
        };
      },
    ),
  ];
}
