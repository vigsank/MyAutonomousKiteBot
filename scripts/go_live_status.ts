#!/usr/bin/env ts-node
/**
 * go_live_status.ts — Phase 5 operator dashboard. Prints the pre-committed kill
 * criteria (5.1) evaluated against the live/paper ledger, plus the capital
 * ladder (5.2) and a recommended stage. Read this BEFORE moving real money.
 *
 * Usage:
 *   npm run status:golive
 *   LADDER_STAGE=LIVE_25K npm run status:golive
 */
import 'dotenv/config';
import { loadConfig } from '../src/server/AppConfig';
import { Ledger } from '../src/server/Ledger';
import {
  evaluateKillCriteria,
  recommendLadderStage,
  CAPITAL_LADDER,
  DEFAULT_KILL_CRITERIA,
  LadderStage,
} from '../src/server/GoLiveLadder';

function main(): void {
  const config = loadConfig();
  const ledger = new Ledger(config.dataDir);
  ledger.runMigrations();

  const monthlyPnl = ledger.realizedPnlByMonth();
  const realized = ledger.cumulativeRealizedPnl();
  // Portfolio drawdown proxy: worst cumulative loss vs capital. (A true
  // peak-to-trough series is future work; this is the conservative floor.)
  const drawdownPct = (Math.abs(Math.min(0, realized)) / config.risk.availableCapital) * 100;

  const kill = evaluateKillCriteria({ monthlyPnl, drawdownPct }, DEFAULT_KILL_CRITERIA);
  const stage = (process.env.LADDER_STAGE as LadderStage) ?? 'PAPER';
  const rec = recommendLadderStage(stage, kill);

  console.log('\nGo-live status (Phase 5)');
  console.log('='.repeat(64));
  console.log(`Cumulative realized P&L : ₹${realized.toFixed(0)}`);
  console.log(`Drawdown proxy          : ${drawdownPct.toFixed(1)}% (ceiling ${DEFAULT_KILL_CRITERIA.maxDrawdownPct}%)`);
  console.log(`Consecutive losing mths : ${kill.consecutiveLosingMonths} (limit ${DEFAULT_KILL_CRITERIA.maxConsecutiveLosingMonths})`);
  console.log(`Months of P&L history   : ${monthlyPnl.length}`);
  console.log('-'.repeat(64));
  console.log(`KILL CRITERIA           : ${kill.killed ? 'BREACHED' : 'clear'}`);
  for (const b of kill.breaches) console.log(`  - ${b}`);
  console.log('-'.repeat(64));
  console.log('Capital ladder (advance on evidence, never on a good month):');
  for (const rung of CAPITAL_LADDER) {
    console.log(`  ${rung.stage.padEnd(9)} ₹${String(rung.capitalInr).padStart(7)}  ${rung.entryGate}`);
  }
  console.log('-'.repeat(64));
  console.log(`Current stage (LADDER_STAGE): ${stage}`);
  console.log(`Recommendation              : ${rec.recommendedStage}`);
  console.log(`  ${rec.rationale}`);
  console.log('='.repeat(64));
}

main();
