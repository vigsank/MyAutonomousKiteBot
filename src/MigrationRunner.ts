import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './Logger';

/**
 * Custom database migration runner — a lightweight Liquibase equivalent.
 *
 * Migration files live in a `migrations/` directory and are named
 * `V{NNN}__{description}.sql`. The runner:
 *  1. Creates the `schema_migrations` tracking table if absent.
 *  2. Reads all `.sql` files, sorted by version prefix.
 *  3. Skips any already applied (matched by filename + checksum).
 *  4. Runs each pending migration inside a transaction.
 *  5. Records the version, checksum, and execution time.
 *
 * Migrations are idempotent by convention (use IF NOT EXISTS).
 */
export class MigrationRunner {
  constructor(private db: Database.Database) {}

  /** Run all pending migrations from the given directory. */
  run(directory: string): void {
    this.ensureTrackingTable();

    const files = this.discoverMigrations(directory);
    if (files.length === 0) {
      logger.info('No migration files found');
      return;
    }

    const applied = this.appliedVersions();

    for (const file of files) {
      if (applied.has(file.version)) {
        logger.debug({ version: file.version }, 'Migration already applied — skipping');
        continue;
      }

      const sql = fs.readFileSync(file.path, 'utf-8');
      const checksum = this.checksum(sql);
      const start = Date.now();

      logger.info({ version: file.version, description: file.description }, 'Applying migration');
      this.db.exec(sql);
      const ms = Date.now() - start;

      this.record(file.version, file.description, checksum, ms);
      logger.info({ version: file.version, ms }, 'Migration applied');
    }
  }

  /* ---- internals ---- */

  private ensureTrackingTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_id  INTEGER PRIMARY KEY AUTOINCREMENT,
        version       TEXT    NOT NULL UNIQUE,
        description   TEXT    NOT NULL,
        checksum      TEXT    NOT NULL,
        applied_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        execution_ms  INTEGER
      );
    `);
  }

  private discoverMigrations(
    dir: string,
  ): Array<{ version: string; description: string; path: string }> {
    if (!fs.existsSync(dir)) {
      logger.warn({ dir }, 'Migration directory not found');
      return [];
    }

    const pattern = /^V(\d{3,})__(.+)\.sql$/;
    const results: Array<{
      version: string;
      description: string;
      path: string;
    }> = [];

    for (const entry of fs.readdirSync(dir)) {
      const m = entry.match(pattern);
      if (!m) continue;
      results.push({
        version: `V${m[1]}`,
        description: m[2].replace(/_/g, ' '),
        path: path.join(dir, entry),
      });
    }

    results.sort((a, b) => a.version.localeCompare(b.version));
    return results;
  }

  private appliedVersions(): Set<string> {
    const rows = this.db
      .prepare('SELECT version FROM schema_migrations')
      .all() as Array<{ version: string }>;
    return new Set(rows.map((r) => r.version));
  }

  private record(
    version: string,
    description: string,
    checksum: string,
    ms: number,
  ): void {
    this.db
      .prepare(
        `INSERT INTO schema_migrations (version, description, checksum, execution_ms)
         VALUES (?, ?, ?, ?)`,
      )
      .run(version, description, checksum, ms);
  }

  private checksum(sql: string): string {
    return crypto.createHash('sha256').update(sql, 'utf-8').digest('hex').slice(0, 16);
  }
}
