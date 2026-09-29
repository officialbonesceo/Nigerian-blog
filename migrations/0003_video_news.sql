-- Cloudflare D1 Migration: 0003_video_news.sql
-- Video Articles table for 9jaBeacon Video Hub & Autonomous Broadcasting

CREATE TABLE IF NOT EXISTS video_articles (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  video_url TEXT NOT NULL,
  video_type TEXT DEFAULT 'youtube', -- 'youtube', 'mp4', 'vimeo', 'hls'
  thumbnail_url TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  category_id TEXT DEFAULT 'cat_naija_news',
  views_count INTEGER DEFAULT 0,
  is_featured INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published',
  source_name TEXT NOT NULL,
  source_channel_url TEXT,
  published_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX IF NOT EXISTS idx_videos_slug ON video_articles(slug);
CREATE INDEX IF NOT EXISTS idx_videos_published ON video_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_category ON video_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_videos_featured ON video_articles(is_featured);
