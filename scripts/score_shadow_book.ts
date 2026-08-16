#!/usr/bin/env ts-node
/**
 * score_shadow_book.ts — Phase 4.1 report. Answers "would the AI have made
 * money?" from the accumulated shadow book (agent_proposals + persisted
 * candles), split by originator so MOMENTUM (executed) and AI_COMPOSITE
 * (shadow-only) are directly comparable.
 *
 * This is the ONLY honest path to ever promoting the AI from filter to
 * originator (Phase 4.3): let it log hypothetical entries now, and grade them on
 * realized forward returns over 12–18 months of live/paper running.
 *
 * Usage:
 *   npm run score:shadow            # 21-trading-day horizon
 *   HORIZON_DAYS=42 npm run score:shadow
 */
import 'dotenv/config';
import { loadConfig } from '../src/server/AppConfig';
import { Ledger } from '../src/server/Ledger';
import { decideAiAuthority } from '../src/server/AiAuthorityPolicy';

function main(): void {
  const config = loadConfig();
  const ledger = new Ledger(config.dataDir);
  ledger.runMigrations();

  const horizon = Number(process.env.HORIZON_DAYS ?? 21) || 21;
  const scores = ledger.scoreShadowBook(horizon);

  console.log(`\nShadow-book scoring (${horizon}-day forward horizon)`);
  console.log('='.repeat(64));
  if (scores.length === 0) {
    console.log('No scorable proposals yet. The book grows as the bot runs and');
    console.log('persists forward candles — re-run after some live/paper history.');
    return;
  }
  console.log(
    'Originator'.padEnd(16) +
      'Scored'.padStart(8) +
      'HitRate'.padStart(10) +
      'AvgRet'.padStart(10) +
      'TotalRet'.padStart(12),
  );
  console.log('-'.repeat(64));
  for (const s of scores) {
    console.log(
      s.originator.padEnd(16) +
        String(s.scored).padStart(8) +
        `${(s.hitRate * 100).toFixed(0)}%`.padStart(10) +
        `${s.avgReturnPct >= 0 ? '+' : ''}${s.avgReturnPct.toFixed(2)}%`.padStart(10) +
        `${s.totalReturnPct >= 0 ? '+' : ''}${s.totalReturnPct.toFixed(2)}%`.padStart(12),
    );
  }
  console.log('='.repeat(64));

  const ai = scores.find((s) => s.originator === 'AI_COMPOSITE');
  const mom = scores.find((s) => s.originator === 'MOMENTUM');
  if (ai && mom) {
    // Phase 4.3 — formal, written promote/hold/retire rule (no indefinite limbo).
    const decision = decideAiAuthority(scores, ledger.shadowBookMonths());
    console.log(`\nAI authority verdict (Phase 4.3): ${decision.verdict}`);
    console.log(decision.rationale);
    console.log(
      '(Advisory. Acting on PROMOTE/RETIRE is a deliberate, human-audited step — Phase 5 ladder.)',
    );
  }
}

main();
