-- Migration 0002: Add article_comments table with nested replies support
CREATE TABLE IF NOT EXISTS article_comments (
  id TEXT PRIMARY KEY,
  article_slug TEXT NOT NULL,
  article_title TEXT,
  parent_id TEXT DEFAULT NULL,
  reply_to_user TEXT DEFAULT NULL,
  user_name TEXT NOT NULL,
  sentiment TEXT DEFAULT 'perspective',
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'published'
);

CREATE INDEX IF NOT EXISTS idx_comments_slug_created ON article_comments(article_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON article_comments(parent_id);
