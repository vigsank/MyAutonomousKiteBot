/**
 * StatePersistence — optional SQLite-backed persistence for the mock engine.
 *
 * By default kite-paper-node is in-memory (a fresh server starts with no orders
 * or positions). When a `stateFile` is provided, this module serialises the
 * engine's StateSnapshot to a local SQLite database so the mock behaves like a
 * real Zerodha backend that survives restarts: orders, positions, holdings,
 * margins, ledger and GTT triggers are restored on the next boot.
 *
 * Uses `better-sqlite3` (resolves via the parent project's node_modules). It is
 * an *optional* integration — if the module is not installed, persistence is
 * silently disabled and the engine stays in-memory.
 */

import type { StateSnapshot } from '../types';

type Database = {
  prepare(sql: string): {
    get(...args: unknown[]): unknown;
    run(...args: unknown[]): { changes: number };
    all(...args: unknown[]): unknown[];
  };
};

let loadBetterSqlite3: (() => { default: (file: string) => Database }) | null = null;

/** Try to resolve better-sqlite3; returns null when unavailable (opt-out). */
function getDb(file: string): Database | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('better-sqlite3');
    const ctor = mod.default ?? mod;
    return ctor(file) as Database;
  } catch {
    return null;
  }
}

export class StatePersistence {
  private db: Database | null;

  constructor(private readonly file: string | null) {
    this.db = this.file ? getDb(this.file) : null;
    if (this.file && this.db) {
      this.initSchema();
    }
  }

  get enabled(): boolean {
    return this.db !== null;
  }

  private initSchema(): void {
    this.db!.prepare(
      `CREATE TABLE IF NOT EXISTS state_snapshot (
         id       INTEGER PRIMARY KEY CHECK (id = 1),
         data     TEXT NOT NULL,
         updated_at TEXT NOT NULL DEFAULT (datetime('now'))
       )`,
    ).run();
  }

  /** Restore the persisted snapshot, or null when none exists / disabled. */
  load(): StateSnapshot | null {
    if (!this.db) return null;
    try {
      const row = this.db
        .prepare(`SELECT data FROM state_snapshot WHERE id = 1`)
        .get() as { data: string } | undefined;
      if (!row) return null;
      const parsed = JSON.parse(row.data) as StateSnapshot;
      return parsed;
    } catch {
      return null;
    }
  }

  /** Persist a snapshot. No-op when disabled. */
  save(snapshot: StateSnapshot): void {
    if (!this.db) return;
    try {
      this.db
        .prepare(
          `INSERT INTO state_snapshot (id, data, updated_at)
           VALUES (1, ?, datetime('now'))
           ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`,
        )
        .run(JSON.stringify(snapshot));
    } catch {
      /* best-effort persistence — never throw into the trading path */
    }
  }

  close(): void {
    this.db = null;
  }
}
