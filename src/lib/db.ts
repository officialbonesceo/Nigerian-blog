import Database from 'better-sqlite3';
import { initialCategories, initialSources, initialArticles, initialVideos } from './seed-data';
import type { Article, Category, Source, AutomationSetting, AutomationLog, ArticleReport, RejectedArticle, VideoArticle } from './types';

import path from 'node:path';
import fs from 'node:fs';

// Initialize SQLite Database (Simulates Cloudflare D1 locally in Node/Astro dev)
const dbPath = path.resolve(process.cwd(), '9jabeacon.db');

function openDatabase() {
  try {
    const instance = new Database(dbPath);
    instance.pragma('journal_mode = WAL');
    return instance;
  } catch (err: any) {
    if (err?.code === 'SQLITE_CORRUPT' || String(err).includes('malformed')) {
      console.warn('[Database] Database file was corrupted, resetting clean database...');
      try {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
        if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
      } catch {}
      const instance = new Database(dbPath);
      instance.pragma('journal_mode = WAL');
      return instance;
    }
    throw err;
  }
}

export const db = openDatabase();

// Execute migrations and initial seed setup
function initDatabase() {
  db.exec(`
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
      created_at TEXT DEFAULT (datetime('now'))
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
      author_name TEXT DEFAULT '9jaBeacon Desk',
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
      status TEXT DEFAULT 'published'
    );

    CREATE TABLE IF NOT EXISTS article_reports (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL,
      article_title TEXT,
      article_slug TEXT,
      reason TEXT NOT NULL,
      details TEXT,
      reporter_email TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rejected_articles (
      id TEXT PRIMARY KEY,
      source_id TEXT,
      source_name TEXT,
      original_title TEXT NOT NULL,
      original_url TEXT NOT NULL,
      raw_content TEXT,
      rejection_reason TEXT NOT NULL,
      ai_tier_failures TEXT,
      status TEXT DEFAULT 'rejected',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS visitor_analytics (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      page_path TEXT NOT NULL,
      user_agent TEXT,
      referrer TEXT,
      device_type TEXT DEFAULT 'mobile',
      created_at TEXT DEFAULT (datetime('now'))
    );

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
      event_type TEXT,
      action TEXT,
      source_id TEXT,
      message TEXT NOT NULL,
      level TEXT DEFAULT 'info',
      status TEXT DEFAULT 'info',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS advert_inquiries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      company TEXT,
      budget TEXT,
      target_url TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      promoted_headline TEXT,
      promoted_teaser TEXT,
      promoted_link TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS custom_ads (
      id TEXT PRIMARY KEY,
      inquiry_id TEXT,
      title TEXT NOT NULL,
      teaser TEXT,
      target_url TEXT NOT NULL,
      format TEXT DEFAULT 'spotlight',
      is_active INTEGER DEFAULT 1,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

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

    CREATE TABLE IF NOT EXISTS video_articles (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      video_url TEXT NOT NULL,
      video_type TEXT DEFAULT 'youtube',
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

    CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
    CREATE INDEX IF NOT EXISTS idx_comments_slug_created ON article_comments(article_slug, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_parent ON article_comments(parent_id);
    CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON automation_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_visitor_date ON visitor_analytics(visit_date);
    CREATE INDEX IF NOT EXISTS idx_videos_slug ON video_articles(slug);
    CREATE INDEX IF NOT EXISTS idx_videos_published ON video_articles(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_videos_category ON video_articles(category_id);
    CREATE INDEX IF NOT EXISTS idx_videos_featured ON video_articles(is_featured);
  `);


  try { db.prepare(`ALTER TABLE article_comments ADD COLUMN parent_id TEXT DEFAULT NULL`).run(); } catch {}
  try { db.prepare(`ALTER TABLE article_comments ADD COLUMN reply_to_user TEXT DEFAULT NULL`).run(); } catch {}
  try { db.prepare(`ALTER TABLE automation_logs ADD COLUMN action TEXT`).run(); } catch {}
  try { db.prepare(`ALTER TABLE automation_logs ADD COLUMN status TEXT DEFAULT 'info'`).run(); } catch {}
  try { db.prepare(`ALTER TABLE automation_logs ADD COLUMN event_type TEXT`).run(); } catch {}
  try { db.prepare(`ALTER TABLE automation_logs ADD COLUMN level TEXT DEFAULT 'info'`).run(); } catch {}
  try { db.prepare(`ALTER TABLE articles ADD COLUMN syndicated_bluesky INTEGER DEFAULT 0`).run(); } catch {}
  try { db.prepare(`ALTER TABLE articles ADD COLUMN syndicated_tumblr INTEGER DEFAULT 0`).run(); } catch {}
  try { db.prepare(`ALTER TABLE articles ADD COLUMN syndicated_threads INTEGER DEFAULT 0`).run(); } catch {}
  try { db.prepare(`ALTER TABLE articles ADD COLUMN syndicated_buffer INTEGER DEFAULT 0`).run(); } catch {}
  try { db.prepare(`ALTER TABLE articles ADD COLUMN syndicated_bluesky_at TEXT`).run(); } catch {}
  try { db.prepare(`ALTER TABLE articles ADD COLUMN syndicated_tumblr_at TEXT`).run(); } catch {}
  try { db.prepare(`ALTER TABLE articles ADD COLUMN syndicated_threads_at TEXT`).run(); } catch {}
  try { db.prepare(`ALTER TABLE articles ADD COLUMN syndicated_buffer_at TEXT`).run(); } catch {}

  // Seed/Upsert Categories
  const insertCat = db.prepare(`
    INSERT INTO categories (id, slug, name, description, icon, color, follower_count, display_order)
    VALUES (@id, @slug, @name, @description, @icon, @color, @follower_count, @display_order)
    ON CONFLICT(id) DO UPDATE SET
      slug=excluded.slug,
      name=excluded.name,
      description=excluded.description,
      icon=excluded.icon,
      color=excluded.color,
      follower_count=excluded.follower_count,
      display_order=excluded.display_order
  `);
  for (const cat of initialCategories) {
    insertCat.run(cat);
  }

  // Seed/Upsert Sources
  const insertSrc = db.prepare(`
    INSERT INTO sources (id, name, feed_url, website_url, category_default_id, is_enabled, is_official, trust_score, license_notes, last_fetched_at, fetch_interval_minutes)
    VALUES (@id, @name, @feed_url, @website_url, @category_default_id, @is_enabled, @is_official, @trust_score, @license_notes, @last_fetched_at, @fetch_interval_minutes)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      feed_url=excluded.feed_url,
      website_url=excluded.website_url,
      category_default_id=excluded.category_default_id,
      trust_score=excluded.trust_score,
      license_notes=excluded.license_notes
  `);
  for (const src of initialSources) {
    insertSrc.run(src);
  }

  // Clean up and normalize any legacy/misaligned category IDs into the 4 primary desks
  try {
    db.prepare(`UPDATE articles SET category_id = 'cat_naija_news' WHERE category_id IN ('cat_politics', 'cat_national', 'cat_crime', 'cat_metro') OR category_id IS NULL OR category_id = ''`).run();
    db.prepare(`UPDATE articles SET category_id = 'cat_money_hustle' WHERE category_id IN ('cat_business', 'cat_economy', 'cat_tech', 'cat_energy', 'cat_hustle')`).run();
    db.prepare(`UPDATE articles SET category_id = 'cat_sports' WHERE category_id IN ('cat_football', 'sports', 'football')`).run();
    db.prepare(`UPDATE articles SET category_id = 'cat_world' WHERE category_id IN ('cat_global', 'cat_diaspora', 'world', 'global')`).run();
  } catch {}

  // Seed default articles if completely empty
  const articlesCount = db.prepare('SELECT COUNT(*) as count FROM articles').get() as { count: number };
  if (articlesCount.count === 0 && initialArticles && initialArticles.length > 0) {
    const insertArt = db.prepare(`
      INSERT OR IGNORE INTO articles (
        id, slug, title, summary, content, category_id, image_url, image_caption,
        image_credit, image_license, author_name, author_role, author_avatar,
        is_top_story, is_trending, is_breaking, views_count, reading_time_minutes,
        source_id, source_name, source_original_url, published_at, updated_at, status
      ) VALUES (
        @id, @slug, @title, @summary, @content, @category_id, @image_url, @image_caption,
        @image_credit, @image_license, @author_name, @author_role, @author_avatar,
        @is_top_story, @is_trending, @is_breaking, @views_count, @reading_time_minutes,
        @source_id, @source_name, @source_original_url, @published_at, @updated_at, @status
      )
    `);
    for (const art of initialArticles) {
      insertArt.run(art);
    }
  }

  // Seed default automation settings
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM automation_settings').get() as { count: number };
  if (settingsCount.count === 0) {
    const insertSetting = db.prepare(`INSERT INTO automation_settings (key, value, description) VALUES (?, ?, ?)`);
    insertSetting.run('cloudflare_account_id', '', 'Cloudflare Account ID for Tier 1 Primary Workers AI');
    insertSetting.run('cloudflare_api_token', '', 'Cloudflare API Token with Workers AI read/write permission');
    insertSetting.run('cloudflare_ai_model', '@cf/meta/llama-3.1-8b-instruct', 'Primary Cloudflare Workers AI model');
    insertSetting.run('openrouter_model', 'meta-llama/llama-3.3-70b-instruct:free', 'Selected active OpenRouter model for Tier 2 Fallback');
    insertSetting.run('openrouter_api_key', '', 'API Key for OpenRouter multi-model inference');
    insertSetting.run('pollinations_api_key', '', 'Optional API Token for Tier 3 Pollinations AI');
    insertSetting.run('buffer_access_token', '', 'Buffer Access Token for social multi-channel auto-posting');
    insertSetting.run('buffer_profile_ids_facebook', '', 'Buffer Profile ID for Facebook Page');
    insertSetting.run('buffer_profile_ids_instagram', '', 'Buffer Profile ID for Instagram Business Profile');
    insertSetting.run('buffer_profile_ids_pinterest', '', 'Buffer Profile ID for Pinterest Board');
    insertSetting.run('buffer_auto_post_enabled', 'true', 'Enable autonomous posting of rewritten articles to Buffer');
    insertSetting.run('buffer_max_posts_per_workflow', '5', 'Maximum stories posted to Facebook/Instagram/Pinterest per workflow run (default: 5)');
    insertSetting.run('auto_publish', 'true', 'Automatically publish rewritten articles or hold in draft state for review');
    insertSetting.run('cron_interval_minutes', '30', 'Scheduled automation ingestion trigger interval in minutes');
    insertSetting.run('ai_prompt_template', `You are an expert Nigerian news editor and fact-checker at 9jaBeacon. Rewrite and synthesize this RSS news lead into an original, factual, mobile-optimized news report for Nigerian readers. Maintain journalistic integrity, clear paragraphs, key takeaways, and proper source reference.`, 'System prompt for news synthesis');
    insertSetting.run('duplicate_similarity_threshold', '0.85', 'Threshold for duplicate headline detection');
  } else {
    // Ensure new keys exist if updating an existing database
    const insertSettingOrIgnore = db.prepare(`INSERT OR IGNORE INTO automation_settings (key, value, description) VALUES (?, ?, ?)`);
    insertSettingOrIgnore.run('cloudflare_account_id', '', 'Cloudflare Account ID for Tier 1 Primary Workers AI');
    insertSettingOrIgnore.run('cloudflare_api_token', '', 'Cloudflare API Token with Workers AI read/write permission');
    insertSettingOrIgnore.run('cloudflare_ai_model', '@cf/meta/llama-3.1-8b-instruct', 'Primary Cloudflare Workers AI model');
    insertSettingOrIgnore.run('openrouter_model', 'meta-llama/llama-3.3-70b-instruct:free', 'Selected active OpenRouter model for Tier 2 Fallback');
    insertSettingOrIgnore.run('openrouter_api_key', '', 'API Key for OpenRouter multi-model inference');
    insertSettingOrIgnore.run('pollinations_api_key', '', 'Optional API Token for Tier 3 Pollinations AI');
    insertSettingOrIgnore.run('buffer_access_token', '', 'Buffer Access Token for social multi-channel auto-posting');
    insertSettingOrIgnore.run('buffer_profile_ids_facebook', '', 'Buffer Profile ID for Facebook Page');
    insertSettingOrIgnore.run('buffer_profile_ids_instagram', '', 'Buffer Profile ID for Instagram Business Profile');
    insertSettingOrIgnore.run('buffer_profile_ids_pinterest', '', 'Buffer Profile ID for Pinterest Board');
    insertSettingOrIgnore.run('buffer_auto_post_enabled', 'true', 'Enable autonomous posting of rewritten articles to Buffer');
    insertSettingOrIgnore.run('buffer_max_posts_per_workflow', '5', 'Maximum stories posted to Facebook/Instagram/Pinterest per workflow run (default: 5)');
    insertSettingOrIgnore.run('bluesky_identifier', '', 'Bluesky Handle or Username (e.g. 9jabeacon.bsky.social)');
    insertSettingOrIgnore.run('bluesky_app_password', '', 'Bluesky App Password generated in Settings (xxxx-xxxx-xxxx-xxxx)');
    insertSettingOrIgnore.run('bluesky_auto_post_enabled', 'true', 'Enable automatic publishing of synthesized articles to Bluesky');
    insertSettingOrIgnore.run('tumblr_blog_identifier', '', 'Tumblr Blog Identifier (e.g. 9jabeacon.tumblr.com)');
    insertSettingOrIgnore.run('tumblr_auto_post_enabled', 'true', 'Enable automatic publishing of synthesized articles to Tumblr');
    insertSettingOrIgnore.run('threads_user_id', '', 'Meta Threads User ID');
    insertSettingOrIgnore.run('threads_auto_post_enabled', 'true', 'Enable automatic publishing of synthesized articles to Threads');
    insertSettingOrIgnore.run('media_automation_enabled', 'true', 'Master toggle defaulting all media post syndication channels to true');
  }

  // Seed default site settings
  const siteCount = db.prepare('SELECT COUNT(*) as count FROM site_settings').get() as { count: number };
  if (siteCount.count === 0) {
    const insertSite = db.prepare(`INSERT INTO site_settings (key, value) VALUES (?, ?)`);
    insertSite.run('site_name', '9jaBeacon');
    insertSite.run('site_tagline', 'Your Trusted Light on Nigerian News. Fast. Verified. Unbiased.');
    insertSite.run('contact_email', 'officialbonesceo@gmail.com');
    insertSite.run('admin_email', 'officialbonesceo@gmail.com');
    insertSite.run('twitter_handle', '@9jaBeacon');
    insertSite.run('admin_password', 'BonesCeo@9jaBeacon2026!');
    insertSite.run('ads_enabled', '1');
    insertSite.run('ad_banner_320x50_key', '68c3e01457bdbc56eeaf6737cd933b72');
    insertSite.run('ad_banner_300x250_key', '6605a898998325cc0d10c2c5c77a29d8');
    insertSite.run('ad_smartlink_url', 'https://www.profitableratecpmnetwork.com/ip0y1pan?key=406d5b2ea65353486dc2e9a7547d5ead');
    insertSite.run('monetag_enabled', '0');
    insertSite.run('adsterra_enabled', '1');
    insertSite.run('adsterra_script_url', 'https://www.highrevenueformat.com/68c3e01457bdbc56eeaf6737cd933b72/invoke.js');
    insertSite.run('adsterra_container_id', 'container-68c3e01457bdbc56eeaf6737cd933b72');
  } else {
    const updateAdminEmail = db.prepare(`INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`);
    updateAdminEmail.run('admin_email', 'officialbonesceo@gmail.com');
    const insertSettingOrReplace = db.prepare(`INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`);
    insertSettingOrReplace.run('ads_enabled', '1');
    insertSettingOrReplace.run('ad_banner_320x50_key', '68c3e01457bdbc56eeaf6737cd933b72');
    insertSettingOrReplace.run('ad_banner_300x250_key', '6605a898998325cc0d10c2c5c77a29d8');
    insertSettingOrReplace.run('ad_smartlink_url', 'https://www.profitableratecpmnetwork.com/ip0y1pan?key=406d5b2ea65353486dc2e9a7547d5ead');
    insertSettingOrReplace.run('monetag_enabled', '0');
    insertSettingOrReplace.run('adsterra_enabled', '1');
    insertSettingOrReplace.run('adsterra_script_url', 'https://www.highrevenueformat.com/68c3e01457bdbc56eeaf6737cd933b72/invoke.js');
    insertSettingOrReplace.run('adsterra_container_id', 'container-68c3e01457bdbc56eeaf6737cd933b72');
  }

  // Seed sample advert inquiry if empty so admin can test 1-click advertising immediately
  const inquiryCount = db.prepare('SELECT COUNT(*) as count FROM advert_inquiries').get() as { count: number };
  if (inquiryCount.count === 0) {
    const insertInquiry = db.prepare(`
      INSERT INTO advert_inquiries (id, name, email, subject, company, budget, target_url, message, status, promoted_headline, promoted_teaser, promoted_link, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    insertInquiry.run(
      'inq_sample_flutterwave',
      'Tunde Adeyemi',
      'partnerships@fintechgrowth.ng',
      'Featured Fintech Banner & Native Sponsorship',
      'FintechGrowth Africa',
      '$500 - $1,000 / month',
      'https://www.profitableratecpmnetwork.com/ip0y1pan?key=406d5b2ea65353486dc2e9a7547d5ead',
      'Hello 9jaBeacon Editorial Team, we are looking to place native sponsored spotlight cards and in-article banners on high-traffic business and finance articles. We want to promote instant dollar-to-naira cross-border trade settlements.',
      'pending',
      'Fast Multi-Currency Settlements for African Businesses',
      'Empower your cross-border ventures with instant zero-fee settlement across 30+ African corridors.',
      'https://www.profitableratecpmnetwork.com/ip0y1pan?key=406d5b2ea65353486dc2e9a7547d5ead'
    );
  }

  // Seed initial video news if empty
  try {
    const videoCount = (db.prepare('SELECT COUNT(*) as count FROM video_articles').get() as { count: number })?.count || 0;
    if (videoCount === 0) {
      const insertVideo = db.prepare(`
        INSERT INTO video_articles (id, slug, title, summary, video_url, video_type, thumbnail_url, duration_seconds, category_id, views_count, is_featured, status, source_name, source_channel_url, published_at, created_at, updated_at)
        VALUES (@id, @slug, @title, @summary, @video_url, @video_type, @thumbnail_url, @duration_seconds, @category_id, @views_count, @is_featured, @status, @source_name, @source_channel_url, @published_at, @created_at, @updated_at)
      `);
      for (const v of initialVideos) {
        try {
          insertVideo.run(v);
        } catch (vErr) {
          console.warn('[Database] Seed video warning:', v.id, vErr);
        }
      }
    }
  } catch (err) {
    console.warn('[Database] video_articles init check error:', err);
  }

  // Seed initial audit log
  const logCount = db.prepare('SELECT COUNT(*) as count FROM automation_logs').get() as { count: number };
  if (logCount.count === 0) {
    const insertLog = db.prepare(`INSERT INTO automation_logs (id, event_type, source_id, message, level) VALUES (?, ?, ?, ?, ?)`);
    insertLog.run('log_' + Date.now(), 'SYSTEM_INIT', null, '9jaBeacon database initialized with verified RSS wires, real-time analytics & reports tracking.', 'info');
  }
}

initDatabase();

// --- Query Functions ---

export function getArticles(options?: {
  categoryId?: string;
  categorySlug?: string;
  limit?: number;
  offset?: number;
  status?: string;
  isTopStory?: boolean;
  isTrending?: boolean;
  isBreaking?: boolean;
}): Article[] {
  let query = `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  const status = options?.status || 'published';
  query += ` AND a.status = ?`;
  params.push(status);

  if (options?.categoryId) {
    query += ` AND a.category_id = ?`;
    params.push(options.categoryId);
  }

  if (options?.categorySlug) {
    const norm = options.categorySlug.toLowerCase().trim();
    if (norm === 'naija-news' || norm === 'politics' || norm === 'national') {
      query += ` AND (c.slug = 'naija-news' OR a.category_id IN ('cat_naija_news', 'cat_politics'))`;
    } else if (norm === 'money-hustle' || norm === 'business' || norm === 'economy' || norm === 'tech' || norm === 'energy' || norm === 'hustle') {
      query += ` AND (c.slug = 'money-hustle' OR a.category_id IN ('cat_money_hustle', 'cat_business', 'cat_economy', 'cat_tech', 'cat_energy'))`;
    } else if (norm === 'sports') {
      query += ` AND (c.slug = 'sports' OR a.category_id = 'cat_sports')`;
    } else if (norm === 'world' || norm === 'global') {
      query += ` AND (c.slug = 'world' OR a.category_id = 'cat_world')`;
    } else {
      query += ` AND c.slug = ?`;
      params.push(norm);
    }
  }

  if (options?.isTopStory !== undefined) {
    query += ` AND a.is_top_story = ?`;
    params.push(options.isTopStory ? 1 : 0);
  }

  if (options?.isTrending !== undefined) {
    query += ` AND a.is_trending = ?`;
    params.push(options.isTrending ? 1 : 0);
  }

  if (options?.isBreaking !== undefined) {
    query += ` AND a.is_breaking = ?`;
    params.push(options.isBreaking ? 1 : 0);
  }

  query += ` ORDER BY a.published_at DESC`;

  if (options?.limit) {
    query += ` LIMIT ?`;
    params.push(options.limit);
    if (options.offset) {
      query += ` OFFSET ?`;
      params.push(options.offset);
    }
  }

  return db.prepare(query).all(...params) as Article[];
}

export function getArticleBySlug(slug: string): Article | null {
  const query = `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.slug = ?
    LIMIT 1
  `;
  const article = db.prepare(query).get(slug) as Article | undefined;
  if (article) {
    // Increment view count asynchronously
    try {
      db.prepare('UPDATE articles SET views_count = views_count + 1 WHERE id = ?').run(article.id);
    } catch {}
    return article;
  }
  return null;
}

export function getTopStory(): Article | null {
  const query = `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published'
    ORDER BY a.is_top_story DESC, a.published_at DESC
    LIMIT 1
  `;
  return (db.prepare(query).get() as Article) || null;
}

export function getTrendingArticles(limit: number = 4): Article[] {
  const query = `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published' AND a.is_trending = 1
    ORDER BY a.views_count DESC, a.published_at DESC
    LIMIT ?
  `;
  return db.prepare(query).all(limit) as Article[];
}

export function getBreakingArticles(limit: number = 3): Article[] {
  const query = `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published' AND a.is_breaking = 1
    ORDER BY a.published_at DESC
    LIMIT ?
  `;
  return db.prepare(query).all(limit) as Article[];
}

export function getMostReadArticles(limit: number = 5): Article[] {
  const query = `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published'
    ORDER BY a.views_count DESC
    LIMIT ?
  `;
  return db.prepare(query).all(limit) as Article[];
}

export function getRelatedArticles(articleId: string, categoryId: string, limit: number = 3): Article[] {
  const query = `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published' AND a.id != ? AND a.category_id = ?
    ORDER BY a.published_at DESC
    LIMIT ?
  `;
  return db.prepare(query).all(articleId, categoryId, limit) as Article[];
}

export function searchArticles(queryStr: string, categoryId?: string, limit: number = 20): Article[] {
  let query = `
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published'
  `;
  const params: any[] = [];

  if (queryStr.trim()) {
    query += ` AND (a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ?)`;
    const searchPattern = `%${queryStr.trim()}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  if (categoryId) {
    query += ` AND a.category_id = ?`;
    params.push(categoryId);
  }

  query += ` ORDER BY a.published_at DESC LIMIT ?`;
  params.push(limit);

  return db.prepare(query).all(...params) as Article[];
}

export function getCategories(): Category[] {
  return db.prepare('SELECT * FROM categories ORDER BY display_order ASC').all() as Category[];
}

export function getCategoryBySlug(slug: string): Category | null {
  const normalizedSlug = slug.toLowerCase().trim();
  const slugAliases: Record<string, string> = {
    'politics': 'naija-news',
    'national': 'naija-news',
    'business': 'money-hustle',
    'economy': 'money-hustle',
    'tech': 'money-hustle',
    'energy': 'money-hustle',
    'hustle': 'money-hustle',
    'global': 'world',
    'international': 'world',
  };
  const targetSlug = slugAliases[normalizedSlug] || normalizedSlug;
  return (db.prepare('SELECT * FROM categories WHERE slug = ?').get(targetSlug) as Category) || null;
}

export function getSources(): Source[] {
  const query = `
    SELECT s.*, c.name as category_name
    FROM sources s
    LEFT JOIN categories c ON s.category_default_id = c.id
    ORDER BY s.is_official DESC, s.trust_score DESC
  `;
  return db.prepare(query).all() as Source[];
}

export function getSourceById(id: string): Source | null {
  return (db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as Source) || null;
}

export function createSource(data: Partial<Source>): Source {
  const id = 'src_' + Math.random().toString(36).substring(2, 9);
  const stmt = db.prepare(`
    INSERT INTO sources (id, name, feed_url, website_url, category_default_id, is_enabled, is_official, trust_score, license_notes, fetch_interval_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.name || 'Custom RSS Feed',
    data.feed_url || '',
    data.website_url || '',
    data.category_default_id || 'cat_naija_news',
    data.is_enabled ? 1 : 0,
    data.is_official ? 1 : 0,
    data.trust_score || 90.0,
    data.license_notes || 'RSS feed permitted for metadata reference and editorial synthesis.',
    data.fetch_interval_minutes || 30
  );
  addAutomationLog('SOURCE_CREATED', id, `Added new source: ${data.name} (${data.feed_url})`, 'info');
  return getSourceById(id)!;
}

export function updateSource(id: string, data: Partial<Source>): Source | null {
  const current = getSourceById(id);
  if (!current) return null;

  const stmt = db.prepare(`
    UPDATE sources
    SET name = ?, feed_url = ?, website_url = ?, category_default_id = ?, is_enabled = ?, is_official = ?, trust_score = ?, license_notes = ?, fetch_interval_minutes = ?
    WHERE id = ?
  `);
  stmt.run(
    data.name ?? current.name,
    data.feed_url ?? current.feed_url,
    data.website_url ?? current.website_url,
    data.category_default_id ?? current.category_default_id,
    data.is_enabled !== undefined ? (data.is_enabled ? 1 : 0) : current.is_enabled,
    data.is_official !== undefined ? (data.is_official ? 1 : 0) : current.is_official,
    data.trust_score ?? current.trust_score,
    data.license_notes ?? current.license_notes,
    data.fetch_interval_minutes ?? current.fetch_interval_minutes,
    id
  );
  addAutomationLog('SOURCE_UPDATED', id, `Updated source settings: ${data.name || current.name}`, 'info');
  return getSourceById(id);
}

export function deleteSource(id: string): boolean {
  const current = getSourceById(id);
  if (!current) return false;
  db.prepare('DELETE FROM sources WHERE id = ?').run(id);
  addAutomationLog('SOURCE_DELETED', id, `Removed source feed: ${current.name}`, 'warning');
  return true;
}

export function createArticle(data: Partial<Article>): Article {
  const id = 'art_' + Math.random().toString(36).substring(2, 9);
  const slug = data.slug || (data.title || 'news-article').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + id.slice(-4);
  
  const stmt = db.prepare(`
    INSERT INTO articles (
      id, slug, title, summary, content, category_id, image_url, image_caption,
      image_credit, image_license, author_name, author_role, author_avatar,
      is_top_story, is_trending, is_breaking, views_count, reading_time_minutes,
      source_id, source_name, source_original_url, status, published_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
    )
  `);

  stmt.run(
    id,
    slug,
    data.title || 'Untitled Story',
    data.summary || '',
    data.content || '',
    data.category_id || 'cat_naija_news',
    data.image_url || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80',
    data.image_caption || '',
    data.image_credit || '9jaBeacon Editorial',
    data.image_license || 'Standard Editorial Use',
    data.author_name || '9jaBeacon Desk',
    data.author_role || 'Staff Reporter',
    data.author_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    data.is_top_story ? 1 : 0,
    data.is_trending ? 1 : 0,
    data.is_breaking ? 1 : 0,
    data.views_count || 10,
    data.reading_time_minutes || 4,
    data.source_id || null,
    data.source_name || 'Direct Editorial',
    data.source_original_url || '',
    data.status || 'published'
  );

  addAutomationLog('ARTICLE_CREATED', id, `Article published: "${data.title}"`, 'info');
  return getArticleBySlug(slug)!;
}

export function updateArticle(id: string, data: Partial<Article>): boolean {
  const stmt = db.prepare(`
    UPDATE articles
    SET title = COALESCE(?, title),
        summary = COALESCE(?, summary),
        content = COALESCE(?, content),
        category_id = COALESCE(?, category_id),
        image_url = COALESCE(?, image_url),
        image_caption = COALESCE(?, image_caption),
        image_credit = COALESCE(?, image_credit),
        image_license = COALESCE(?, image_license),
        author_name = COALESCE(?, author_name),
        is_top_story = COALESCE(?, is_top_story),
        is_trending = COALESCE(?, is_trending),
        is_breaking = COALESCE(?, is_breaking),
        status = COALESCE(?, status),
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(
    data.title ?? null,
    data.summary ?? null,
    data.content ?? null,
    data.category_id ?? null,
    data.image_url ?? null,
    data.image_caption ?? null,
    data.image_credit ?? null,
    data.image_license ?? null,
    data.author_name ?? null,
    data.is_top_story !== undefined ? (data.is_top_story ? 1 : 0) : null,
    data.is_trending !== undefined ? (data.is_trending ? 1 : 0) : null,
    data.is_breaking !== undefined ? (data.is_breaking ? 1 : 0) : null,
    data.status ?? null,
    id
  );
  return true;
}

export function deleteArticle(id: string): boolean {
  db.prepare('DELETE FROM articles WHERE id = ?').run(id);
  addAutomationLog('ARTICLE_DELETED', id, `Article deleted: ${id}`, 'warning');
  return true;
}

// --- Report System Functions ---

export function createArticleReport(data: { article_id: string; article_title?: string; article_slug?: string; reason: string; details?: string; reporter_email?: string }): ArticleReport {
  const id = 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const stmt = db.prepare(`
    INSERT INTO article_reports (id, article_id, article_title, article_slug, reason, details, reporter_email, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `);
  stmt.run(id, data.article_id, data.article_title || '', data.article_slug || '', data.reason, data.details || '', data.reporter_email || '');
  addAutomationLog('ARTICLE_REPORTED', data.article_id, `Report received for "${data.article_title || data.article_id}": ${data.reason}`, 'warning');
  return db.prepare('SELECT * FROM article_reports WHERE id = ?').get(id) as ArticleReport;
}

export function getArticleReports(status?: string, limit: number = 50): ArticleReport[] {
  let query = 'SELECT * FROM article_reports';
  const params: any[] = [];
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  return db.prepare(query).all(...params) as ArticleReport[];
}

export function updateArticleReportStatus(id: string, status: 'resolved' | 'dismissed'): boolean {
  db.prepare("UPDATE article_reports SET status = ? WHERE id = ?").run(status, id);
  return true;
}

// --- Rejected Articles (Stories AI did not understand / couldn't parse) ---

export function recordRejectedArticle(data: { source_id?: string; source_name?: string; original_title: string; original_url: string; raw_content?: string; rejection_reason: string; ai_tier_failures?: string }): RejectedArticle {
  const id = 'rej_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const stmt = db.prepare(`
    INSERT INTO rejected_articles (id, source_id, source_name, original_title, original_url, raw_content, rejection_reason, ai_tier_failures, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rejected', datetime('now'))
  `);
  stmt.run(id, data.source_id || null, data.source_name || '', data.original_title, data.original_url, data.raw_content || '', data.rejection_reason, data.ai_tier_failures || '');
  return db.prepare('SELECT * FROM rejected_articles WHERE id = ?').get(id) as RejectedArticle;
}

export function getRejectedArticles(limit: number = 50): RejectedArticle[] {
  return db.prepare('SELECT * FROM rejected_articles ORDER BY created_at DESC LIMIT ?').all(limit) as RejectedArticle[];
}

// --- Visitor & Analytics Tracking ---

export function logVisitorSession(data: { session_id: string; page_path: string; user_agent?: string; referrer?: string; device_type?: string }): void {
  const today = new Date().toISOString().split('T')[0];
  const id = 'vis_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  db.prepare(`
    INSERT INTO visitor_analytics (id, session_id, visit_date, page_path, user_agent, referrer, device_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, data.session_id, today, data.page_path, data.user_agent || '', data.referrer || '', data.device_type || 'mobile');
}

export function getAnalyticsMetrics() {
  const today = new Date().toISOString().split('T')[0];

  // Daily unique active users today
  const dailyUsersToday = (db.prepare('SELECT COUNT(DISTINCT session_id) as count FROM visitor_analytics WHERE visit_date = ?').get(today) as { count: number }).count || 0;
  
  // Total all-time distinct visitors
  const allTimeUniqueVisitors = (db.prepare('SELECT COUNT(DISTINCT session_id) as count FROM visitor_analytics').get() as { count: number }).count || 0;

  // Page hits today
  const totalPageViewsToday = (db.prepare('SELECT COUNT(*) as count FROM visitor_analytics WHERE visit_date = ?').get(today) as { count: number }).count || 0;

  // Most trending / popular articles
  const trendingStories = db.prepare(`
    SELECT title, slug, views_count, category_id, published_at 
    FROM articles 
    WHERE status = 'published' 
    ORDER BY views_count DESC, published_at DESC 
    LIMIT 6
  `).all() as { title: string; slug: string; views_count: number; category_id: string; published_at: string }[];

  // Articles fetched in the last 24 hours
  const newlyFetched24h = (db.prepare(`
    SELECT COUNT(*) as count FROM articles 
    WHERE datetime(created_at) >= datetime('now', '-1 day')
  `).get() as { count: number }).count || 0;

  // Tools & infrastructure breakdown
  const toolStats = [
    { name: 'Cloudflare Workers AI', tier: 'Tier 1 Primary AI', status: 'Operational', model: '@cf/meta/llama-3.1-8b-instruct' },
    { name: 'Groq Cloud Inference', tier: 'Tier 2 Fast Fallback', status: 'Operational', model: 'llama-3.1-8b-instant' },
    { name: 'Pollinations AI Serverless', tier: 'Tier 3 Failsafe', status: 'Operational', model: 'serverless-text-turbo' },
    { name: 'SQLite / Cloudflare D1 Sync', tier: 'High-Performance WAL Engine', status: 'Active (WAL Enabled)', model: 'Native D1 DB' },
    { name: 'rss-parser XML & Media Engine', tier: 'Syndication Ingestor', status: 'Connected', model: 'RSS 2.0 / Atom' },
  ];

  return {
    dailyUsersToday,
    allTimeUniqueVisitors,
    totalPageViewsToday,
    trendingStories,
    newlyFetched24h,
    toolStats,
  };
}

export function getAutomationSettings(): AutomationSetting[] {
  return db.prepare('SELECT * FROM automation_settings').all() as AutomationSetting[];
}

export function updateAutomationSetting(key: string, value: string): void {
  db.prepare(`
    INSERT INTO automation_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value);
  addAutomationLog('SETTINGS_UPDATED', undefined, `Automation setting '${key}' updated`, 'info');
}

export function getSiteSettings(): Record<string, string> {
  const rows = db.prepare('SELECT * FROM site_settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  return settings;
}

export function updateSiteSetting(key: string, value: string): void {
  db.prepare(`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value);
}

export function getAutomationLogs(limit: number = 30): AutomationLog[] {
  const query = `
    SELECT l.*, s.name as source_name
    FROM automation_logs l
    LEFT JOIN sources s ON l.source_id = s.id
    ORDER BY l.created_at DESC
    LIMIT ?
  `;
  return db.prepare(query).all(limit) as AutomationLog[];
}

export function addAutomationLog(event_type: string, source_id?: string, message: string = '', level: 'info' | 'warning' | 'error' = 'info'): void {
  const id = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  db.prepare(`
    INSERT INTO automation_logs (id, event_type, source_id, message, level, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(id, event_type, source_id || null, message, level);
}

export function getAdminDashboardStats() {
  const totalArticles = (db.prepare('SELECT COUNT(*) as count FROM articles').get() as { count: number }).count;
  const publishedArticles = (db.prepare("SELECT COUNT(*) as count FROM articles WHERE status = 'published'").get() as { count: number }).count;
  const draftArticles = (db.prepare("SELECT COUNT(*) as count FROM articles WHERE status = 'draft'").get() as { count: number }).count;
  const totalSources = (db.prepare('SELECT COUNT(*) as count FROM sources').get() as { count: number }).count;
  const activeSources = (db.prepare('SELECT COUNT(*) as count FROM sources WHERE is_enabled = 1').get() as { count: number }).count;
  const totalViews = (db.prepare('SELECT SUM(views_count) as count FROM articles').get() as { count: number | null }).count || 0;
  const pendingReports = (db.prepare("SELECT COUNT(*) as count FROM article_reports WHERE status = 'pending'").get() as { count: number }).count || 0;
  const totalRejected = (db.prepare("SELECT COUNT(*) as count FROM rejected_articles").get() as { count: number }).count || 0;
  let totalVideos = 0;
  try {
    totalVideos = (db.prepare("SELECT COUNT(*) as count FROM video_articles").get() as { count: number }).count || 0;
  } catch {}
  
  return {
    totalArticles,
    publishedArticles,
    draftArticles,
    totalSources,
    activeSources,
    totalViews,
    pendingReports,
    totalRejected,
    totalVideos,
  };
}

// --- Video Articles Functions ---

export function getVideoArticles(options?: {
  limit?: number;
  offset?: number;
  categoryId?: string;
  featuredOnly?: boolean;
  search?: string;
  status?: string;
}): { videos: VideoArticle[]; total: number } {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;
  const status = options?.status ?? 'published';

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status !== 'all') {
    conditions.push('v.status = ?');
    params.push(status);
  }

  if (options?.categoryId) {
    conditions.push('v.category_id = ?');
    params.push(options.categoryId);
  }

  if (options?.featuredOnly) {
    conditions.push('v.is_featured = 1');
  }

  if (options?.search) {
    conditions.push('(v.title LIKE ? OR v.summary LIKE ?)');
    params.push(`%${options.search}%`, `%${options.search}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const totalRow = db.prepare(`SELECT COUNT(*) as count FROM video_articles v ${whereClause}`).get(...params) as { count: number };
    const total = totalRow?.count || 0;

    const query = `
      SELECT v.*, c.name as category_name, c.slug as category_slug
      FROM video_articles v
      LEFT JOIN categories c ON v.category_id = c.id
      ${whereClause}
      ORDER BY v.is_featured DESC, v.published_at DESC
      LIMIT ? OFFSET ?
    `;

    const videos = db.prepare(query).all(...params, limit, offset) as VideoArticle[];
    return { videos, total };
  } catch (err) {
    console.warn('[Database] getVideoArticles error:', err);
    return { videos: initialVideos, total: initialVideos.length };
  }
}

export function getVideoArticleBySlug(slug: string): VideoArticle | null {
  try {
    const query = `
      SELECT v.*, c.name as category_name, c.slug as category_slug
      FROM video_articles v
      LEFT JOIN categories c ON v.category_id = c.id
      WHERE v.slug = ?
    `;
    const video = db.prepare(query).get(slug) as VideoArticle | undefined;
    return video || initialVideos.find(v => v.slug === slug) || null;
  } catch (err) {
    console.warn('[Database] getVideoArticleBySlug error:', err);
    return initialVideos.find(v => v.slug === slug) || null;
  }
}

export function getVideoArticleById(id: string): VideoArticle | null {
  try {
    const query = `
      SELECT v.*, c.name as category_name, c.slug as category_slug
      FROM video_articles v
      LEFT JOIN categories c ON v.category_id = c.id
      WHERE v.id = ?
    `;
    const video = db.prepare(query).get(id) as VideoArticle | undefined;
    return video || null;
  } catch (err) {
    console.warn('[Database] getVideoArticleById error:', err);
    return null;
  }
}

export function createVideoArticle(data: Partial<VideoArticle>): VideoArticle {
  const id = data.id || 'vid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();
  const slug = data.slug || (data.title || 'video')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 80);

  const videoRecord: VideoArticle = {
    id,
    slug,
    title: data.title || 'Untitled Video',
    summary: data.summary || '',
    video_url: data.video_url || '',
    video_type: (data.video_type as any) || 'youtube',
    thumbnail_url: data.thumbnail_url || 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80',
    duration_seconds: data.duration_seconds || 0,
    category_id: data.category_id || 'cat_naija_news',
    views_count: data.views_count || 0,
    is_featured: data.is_featured ? 1 : 0,
    status: data.status || 'published',
    source_name: data.source_name || '9jaBeacon Video Desk',
    source_channel_url: data.source_channel_url || null,
    published_at: data.published_at || now,
    created_at: now,
    updated_at: now,
  };

  db.prepare(`
    INSERT INTO video_articles (
      id, slug, title, summary, video_url, video_type, thumbnail_url,
      duration_seconds, category_id, views_count, is_featured, status,
      source_name, source_channel_url, published_at, created_at, updated_at
    ) VALUES (
      @id, @slug, @title, @summary, @video_url, @video_type, @thumbnail_url,
      @duration_seconds, @category_id, @views_count, @is_featured, @status,
      @source_name, @source_channel_url, @published_at, @created_at, @updated_at
    )
  `).run(videoRecord);

  return videoRecord;
}

export function updateVideoArticle(id: string, data: Partial<VideoArticle>): boolean {
  const existing = getVideoArticleById(id);
  if (!existing) return false;

  const now = new Date().toISOString();
  const updated = {
    ...existing,
    ...data,
    updated_at: now,
  };

  db.prepare(`
    UPDATE video_articles SET
      title = @title,
      summary = @summary,
      video_url = @video_url,
      video_type = @video_type,
      thumbnail_url = @thumbnail_url,
      duration_seconds = @duration_seconds,
      category_id = @category_id,
      is_featured = @is_featured,
      status = @status,
      source_name = @source_name,
      source_channel_url = @source_channel_url,
      updated_at = @updated_at
    WHERE id = @id
  `).run(updated);

  return true;
}

export function deleteVideoArticle(id: string): boolean {
  try {
    const res = db.prepare('DELETE FROM video_articles WHERE id = ?').run(id);
    return res.changes > 0;
  } catch (err) {
    console.warn('[Database] deleteVideoArticle error:', err);
    return false;
  }
}

export function incrementVideoViews(idOrSlug: string): void {
  try {
    db.prepare('UPDATE video_articles SET views_count = views_count + 1 WHERE id = ? OR slug = ?').run(idOrSlug, idOrSlug);
  } catch (err) {
    console.warn('[Database] incrementVideoViews error:', err);
  }
}

