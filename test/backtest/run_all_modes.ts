/**
 * Run the optimizer across multiple sweep modes (quick/mid/large/xl) and save
 * a per-mode report. This is the "simulation test setup for all modes".
 *
 * Usage:
 *   npx ts-node test/backtest/run_all_modes.ts
 *
 * Env:
 *   MODES     = "quick,mid,large"   (which modes to run; default quick,mid,large)
 *   OPT_DAYS  = 60                  (history window for each run)
 *   OPT_FOLDS = 4                   (walk-forward folds)
 *
 * Each mode writes data/optimization_<mode>.csv (plus equity curves for the
 * top combos). NOTE: 'xl' is very heavy (6300 combos) — run it separately.
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const modes = (process.env.MODES || 'quick,mid,large')
  .split(',')
  .map((m) => m.trim().toLowerCase())
  .filter((m) => ['quick', 'mid', 'large', 'xl'].includes(m));

const days = process.env.OPT_DAYS || '60';
const dataDir = path.join(process.cwd(), 'data');

if (modes.length === 0) {
  console.error('No valid modes selected. Use MODES="quick,mid,large,xl".');
  process.exit(1);
}

console.log('======================================================');
console.log('  RUN ALL OPTIMIZER MODES');
console.log(`  Modes: ${modes.join(', ')} | Days: ${days}`);
console.log('======================================================');

for (const mode of modes) {
  console.log(`\n=== Running mode: ${mode.toUpperCase()} ===`);
  const env = { ...process.env, OPT_MODE: mode, OPT_DAYS: days };
  try {
    execSync(`npx ts-node test/backtest/optimize.ts --${mode}`, {
      env,
      stdio: 'inherit',
    });
    const src = path.join(dataDir, 'optimization_report.csv');
    const dst = path.join(dataDir, `optimization_${mode}.csv`);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log(`  Saved: ${dst}`);
    }
  } catch (err: any) {
    console.error(`  Mode ${mode} failed: ${err?.message ?? err}`);
  }
}

console.log('\nDone. Per-mode reports in data/optimization_<mode>.csv');
