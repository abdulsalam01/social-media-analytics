import type { Client } from "@libsql/client";

/**
 * Canonical schema for a brand-new database. Tables and indexes are applied in
 * explicit write batches so Turso commits the complete migration before the
 * initializer exits.
 */
const TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     email         TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     name          TEXT NOT NULL,
     role          TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')),
     created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS accounts (
     id                 INTEGER PRIMARY KEY AUTOINCREMENT,
     name               TEXT NOT NULL,
     platform           TEXT NOT NULL CHECK(platform IN ('instagram','tiktok')),
     handle             TEXT NOT NULL,
     scrape_enabled     INTEGER NOT NULL DEFAULT 0,
     scrape_url         TEXT,
     last_scraped_at    TEXT,
     last_scrape_status TEXT,
     created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     UNIQUE(platform, handle)
   )`,
  `CREATE TABLE IF NOT EXISTS profile_insight (
     id                INTEGER PRIMARY KEY AUTOINCREMENT,
     account_id        INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
     date              TEXT NOT NULL,
     visit_per_day     INTEGER NOT NULL DEFAULT 0,
     reach_per_day     INTEGER NOT NULL DEFAULT 0,
     followers         INTEGER NOT NULL DEFAULT 0,
     followers_growth  INTEGER NOT NULL DEFAULT 0,
     new_followers     INTEGER NOT NULL DEFAULT 0,
     created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     UNIQUE(account_id, date)
   )`,
  `CREATE TABLE IF NOT EXISTS content_insight (
     id              INTEGER PRIMARY KEY AUTOINCREMENT,
     account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
     post_date       TEXT NOT NULL,
     title           TEXT,
     link            TEXT,
     shortcode       TEXT,
     profile_visit   INTEGER NOT NULL DEFAULT 0,
     likes           INTEGER NOT NULL DEFAULT 0,
     comments        INTEGER NOT NULL DEFAULT 0,
     shares          INTEGER NOT NULL DEFAULT 0,
     saves           INTEGER NOT NULL DEFAULT 0,
     reposts         INTEGER NOT NULL DEFAULT 0,
     follows         INTEGER NOT NULL DEFAULT 0,
     reach           INTEGER NOT NULL DEFAULT 0,
     impression      INTEGER NOT NULL DEFAULT 0,
     plays           INTEGER NOT NULL DEFAULT 0,
     engagement      INTEGER NOT NULL DEFAULT 0,
     engagement_rate REAL    NOT NULL DEFAULT 0,
     scrape_enabled  INTEGER NOT NULL DEFAULT 1,
     created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS demographics (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
     week_start   TEXT NOT NULL,
     kind         TEXT NOT NULL CHECK(kind IN ('age','gender','city','active_day')),
     label        TEXT NOT NULL,
     value        REAL NOT NULL,
     UNIQUE(account_id, week_start, kind, label)
   )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
     action     TEXT NOT NULL,
     entity     TEXT NOT NULL,
     entity_id  INTEGER,
     meta       TEXT,
     at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
     id       INTEGER PRIMARY KEY AUTOINCREMENT,
     email    TEXT NOT NULL,
     ip       TEXT NOT NULL,
     success  INTEGER NOT NULL,
     at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS scrape_log (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
     scraped_at    TEXT NOT NULL DEFAULT (datetime('now')),
     status        TEXT NOT NULL,
     posts_found   INTEGER NOT NULL DEFAULT 0,
     posts_updated INTEGER NOT NULL DEFAULT 0,
     error         TEXT
   )`,
] as const;

const ADDITIVE_COLUMNS = [
  { table: "accounts", column: "scrape_enabled", definition: "scrape_enabled INTEGER NOT NULL DEFAULT 0" },
  { table: "accounts", column: "scrape_url", definition: "scrape_url TEXT" },
  { table: "accounts", column: "last_scraped_at", definition: "last_scraped_at TEXT" },
  { table: "accounts", column: "last_scrape_status", definition: "last_scrape_status TEXT" },
  { table: "profile_insight", column: "new_followers", definition: "new_followers INTEGER NOT NULL DEFAULT 0" },
  { table: "profile_insight", column: "updated_at", definition: "updated_at TEXT" },
  { table: "content_insight", column: "title", definition: "title TEXT" },
  { table: "content_insight", column: "shortcode", definition: "shortcode TEXT" },
  { table: "content_insight", column: "reposts", definition: "reposts INTEGER NOT NULL DEFAULT 0" },
  { table: "content_insight", column: "scrape_enabled", definition: "scrape_enabled INTEGER NOT NULL DEFAULT 1" },
  { table: "content_insight", column: "updated_at", definition: "updated_at TEXT" },
] as const;

const INDEX_STATEMENTS = [
  "CREATE INDEX IF NOT EXISTS idx_accounts_platform ON accounts(platform)",
  "CREATE INDEX IF NOT EXISTS idx_pi_account_date ON profile_insight(account_id, date)",
  "CREATE INDEX IF NOT EXISTS idx_ci_account_date ON content_insight(account_id, post_date)",
  "CREATE INDEX IF NOT EXISTS idx_ci_account_eng ON content_insight(account_id, engagement DESC)",
  "CREATE INDEX IF NOT EXISTS idx_ci_account_reach ON content_insight(account_id, reach DESC)",
  "CREATE INDEX IF NOT EXISTS idx_ci_account_plays ON content_insight(account_id, plays DESC)",
  "CREATE INDEX IF NOT EXISTS idx_ci_account_rate ON content_insight(account_id, engagement_rate DESC)",
  "CREATE INDEX IF NOT EXISTS idx_ci_created ON content_insight(account_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_ci_title ON content_insight(account_id, title COLLATE NOCASE)",
  "CREATE INDEX IF NOT EXISTS idx_demo_lookup ON demographics(account_id, week_start, kind)",
  "CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_login_email_at ON login_attempts(email, at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_login_ip_at ON login_attempts(ip, at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_scrape_log_account ON scrape_log(account_id, scraped_at DESC)",
] as const;

let migrationPromise: Promise<void> | null = null;

async function getColumnNames(client: Client, table: string): Promise<Set<string>> {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return new Set(result.rows.map((row) => String(row.name)));
}

/** Apply the complete idempotent schema and commit every migration batch. */
export function ensureSchema(client: Client): Promise<void> {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    await client.batch([...TABLE_STATEMENTS], "write");

    const columnsByTable = new Map<string, Set<string>>();
    const alterStatements: string[] = [];
    for (const migration of ADDITIVE_COLUMNS) {
      let columns = columnsByTable.get(migration.table);
      if (!columns) {
        columns = await getColumnNames(client, migration.table);
        columnsByTable.set(migration.table, columns);
      }
      if (!columns.has(migration.column)) {
        alterStatements.push(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.definition}`);
        columns.add(migration.column);
      }
    }
    if (alterStatements.length) await client.batch(alterStatements, "write");

    await client.batch([...INDEX_STATEMENTS], "write");
    await client.batch(
      [
        "UPDATE profile_insight SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''",
        "UPDATE content_insight SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''",
      ],
      "write"
    );
  })();

  return migrationPromise;
}
