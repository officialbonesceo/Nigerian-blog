-- Cloudflare D1 Migration: 0001_initial.sql
-- NaijaPulse Schema: Categories, Sources, Articles, Automation, Logs, Settings

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'newspaper',
  color TEXT DEFAULT '#008751',
  follower_count INTEGER DEFAULT 1250,
  display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  website_url TEXT NOT NULL,
  category_default_id TEXT,
  is_enabled INTEGER DEFAULT 1,
  is_official INTEGER DEFAULT 0,
  trust_score REAL DEFAULT 95.0,
  license_notes TEXT,
  last_fetched_at TEXT,
  fetch_interval_minutes INTEGER DEFAULT 30,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_default_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  category_id TEXT NOT NULL,
  image_url TEXT,
  image_caption TEXT,
  image_credit TEXT,
  image_license TEXT,
  author_name TEXT DEFAULT 'NaijaPulse Desk',
  author_role TEXT DEFAULT 'Editorial Contributor',
  author_avatar TEXT,
  is_top_story INTEGER DEFAULT 0,
  is_trending INTEGER DEFAULT 0,
  is_breaking INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 120,
  reading_time_minutes INTEGER DEFAULT 4,
  source_id TEXT,
  source_name TEXT,
  source_original_url TEXT,
  published_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'published',
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_top ON articles(is_top_story);
CREATE INDEX IF NOT EXISTS idx_articles_trending ON articles(is_trending);

CREATE TABLE IF NOT EXISTS automation_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  source_id TEXT,
  message TEXT NOT NULL,
  level TEXT DEFAULT 'info',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TEXT DEFAULT (datetime('now'))
);
