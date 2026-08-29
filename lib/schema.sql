-- SocmedInsight schema

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accounts (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  platform           TEXT NOT NULL CHECK(platform IN ('instagram','tiktok')),
  handle             TEXT NOT NULL,
  scrape_enabled     INTEGER NOT NULL DEFAULT 0,
  scrape_url         TEXT,
  last_scraped_at    TEXT,
  last_scrape_status TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(platform, handle)
);
CREATE INDEX IF NOT EXISTS idx_accounts_platform ON accounts(platform);

CREATE TABLE IF NOT EXISTS scrape_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  scraped_at    TEXT NOT NULL DEFAULT (datetime('now')),
  status        TEXT NOT NULL,
  posts_found   INTEGER NOT NULL DEFAULT 0,
  posts_updated INTEGER NOT NULL DEFAULT 0,
  error         TEXT
);
CREATE INDEX IF NOT EXISTS idx_scrape_log_account ON scrape_log(account_id, scraped_at DESC);

CREATE TABLE IF NOT EXISTS profile_insight (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id        INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date              TEXT NOT NULL,
  visit_per_day     INTEGER NOT NULL DEFAULT 0,
  reach_per_day     INTEGER NOT NULL DEFAULT 0,
  followers         INTEGER NOT NULL DEFAULT 0,
  followers_growth  INTEGER NOT NULL DEFAULT 0,
  new_followers     INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, date)
);
CREATE INDEX IF NOT EXISTS idx_pi_account_date ON profile_insight(account_id, date);

CREATE TABLE IF NOT EXISTS content_insight (
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
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ci_account_date ON content_insight(account_id, post_date);
CREATE INDEX IF NOT EXISTS idx_ci_account_eng ON content_insight(account_id, engagement DESC);
CREATE INDEX IF NOT EXISTS idx_ci_account_reach ON content_insight(account_id, reach DESC);
CREATE INDEX IF NOT EXISTS idx_ci_account_plays ON content_insight(account_id, plays DESC);
CREATE INDEX IF NOT EXISTS idx_ci_account_rate ON content_insight(account_id, engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_ci_created ON content_insight(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ci_title ON content_insight(account_id, title COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS demographics (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  week_start   TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK(kind IN ('age','gender','city','active_day')),
  label        TEXT NOT NULL,
  value        REAL NOT NULL,
  UNIQUE(account_id, week_start, kind, label)
);
CREATE INDEX IF NOT EXISTS idx_demo_lookup ON demographics(account_id, week_start, kind);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  meta       TEXT,
  at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at DESC);

CREATE TABLE IF NOT EXISTS login_attempts (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  email    TEXT NOT NULL,
  ip       TEXT NOT NULL,
  success  INTEGER NOT NULL,
  at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_email_at ON login_attempts(email, at DESC);
CREATE INDEX IF NOT EXISTS idx_login_ip_at ON login_attempts(ip, at DESC);

CREATE TABLE IF NOT EXISTS account_content_goals (
  account_id            INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  primary_goal          TEXT NOT NULL CHECK(primary_goal IN ('growth','engagement','reach','awareness','leads','sales')),
  target_audience       TEXT NOT NULL,
  brand_voice           TEXT NOT NULL,
  content_pillars       TEXT NOT NULL DEFAULT '[]',
  keywords              TEXT NOT NULL DEFAULT '[]',
  preferred_formats     TEXT NOT NULL DEFAULT '["video"]',
  preferred_days        TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
  audience_active_hours TEXT NOT NULL DEFAULT '[]',
  posts_per_week        INTEGER NOT NULL DEFAULT 3 CHECK(posts_per_week BETWEEN 1 AND 14),
  timezone              TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  additional_context    TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trend_research_runs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id       INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  query            TEXT NOT NULL,
  keywords         TEXT NOT NULL DEFAULT '[]',
  status           TEXT NOT NULL CHECK(status IN ('running','completed','failed')),
  provider_summary TEXT NOT NULL DEFAULT '{}',
  evidence_count   INTEGER NOT NULL DEFAULT 0,
  error            TEXT,
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  started_at       TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_trend_runs_account ON trend_research_runs(account_id, started_at DESC);

CREATE TABLE IF NOT EXISTS trend_evidence (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id           INTEGER NOT NULL REFERENCES trend_research_runs(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,
  source_name      TEXT NOT NULL,
  title            TEXT NOT NULL,
  url              TEXT NOT NULL,
  excerpt          TEXT,
  published_at     TEXT,
  popularity_score REAL NOT NULL DEFAULT 0,
  raw_metrics      TEXT NOT NULL DEFAULT '{}',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_id, url)
);
CREATE INDEX IF NOT EXISTS idx_trend_evidence_run ON trend_evidence(run_id, popularity_score DESC);

CREATE TABLE IF NOT EXISTS content_ideas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id       INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  research_run_id  INTEGER REFERENCES trend_research_runs(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  hook             TEXT NOT NULL,
  fresh_angle      TEXT NOT NULL,
  content_type     TEXT NOT NULL CHECK(content_type IN ('carousel','video','kombinasi')),
  category         TEXT NOT NULL,
  why_factor       TEXT NOT NULL,
  content_outline  TEXT NOT NULL,
  call_to_action   TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'ide' CHECK(status IN ('ide','dikembangkan','siap','terjadwal','terbit','diarsipkan')),
  recommended_at   TEXT,
  schedule_reason  TEXT,
  confidence_score REAL NOT NULL DEFAULT 0,
  source_ids       TEXT NOT NULL DEFAULT '[]',
  ai_model         TEXT NOT NULL,
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  published_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_content_ideas_account ON content_ideas(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_ideas_status ON content_ideas(account_id, status, recommended_at);
CREATE INDEX IF NOT EXISTS idx_content_ideas_schedule ON content_ideas(account_id, recommended_at);
