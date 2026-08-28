import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolve the directory holding the real NSE historical CSVs served by
 * `kite-paper-node` (now a separate repo/package).
 *
 * Resolution order:
 *   1. `KITE_PAPER_DATA_DIR` env var (explicit override).
 *   2. A sibling checkout `../../../kite-paper-node/data` (post-split layout).
 *   3. The in-parent `../../kite-paper-node/data` (pre-split / transition layout).
 *
 * This removes the hardcoded `../../kite-paper-node/data` relative paths that
 * coupled the parent repo to a specific on-disk location of the mock.
 */
export function resolveDataDir(): string {
  const env = process.env.KITE_PAPER_DATA_DIR;
  if (env && env.trim() !== '') return env.trim();

  const sibling = path.join(__dirname, '..', '..', '..', 'kite-paper-node', 'data');
  if (fs.existsSync(sibling)) return sibling;

  const inParent = path.join(__dirname, '..', '..', 'kite-paper-node', 'data');
  return inParent;
}
