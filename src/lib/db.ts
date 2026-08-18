import Database from 'better-sqlite3';
import { initialCategories, initialSources, initialArticles } from './seed-data';
import type { Article, Category, Source, AutomationSetting, AutomationLog } from './types';
import path from 'node:path';

// Initialize SQLite Database (Simulates Cloudflare D1 locally in Node/Astro dev)
const dbPath = path.resolve(process.cwd(), 'naijapulse.db');
const db = new Database(dbPath);

// Enable WAL mode for high performance concurrent reads
db.pragma('journal_mode = WAL');

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
      status TEXT DEFAULT 'published'
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
  `);

  // Seed Categories if empty
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  if (catCount.count === 0) {
    const insertCat = db.prepare(`
      INSERT INTO categories (id, slug, name, description, icon, color, follower_count, display_order)
      VALUES (@id, @slug, @name, @description, @icon, @color, @follower_count, @display_order)
    `);
    for (const cat of initialCategories) {
      insertCat.run(cat);
    }
  }

  // Seed Sources if empty
  const srcCount = db.prepare('SELECT COUNT(*) as count FROM sources').get() as { count: number };
  if (srcCount.count === 0) {
    const insertSrc = db.prepare(`
      INSERT INTO sources (id, name, feed_url, website_url, category_default_id, is_enabled, is_official, trust_score, license_notes, last_fetched_at, fetch_interval_minutes)
      VALUES (@id, @name, @feed_url, @website_url, @category_default_id, @is_enabled, @is_official, @trust_score, @license_notes, @last_fetched_at, @fetch_interval_minutes)
    `);
    for (const src of initialSources) {
      insertSrc.run(src);
    }
  }

  // Seed Articles if empty
  const artCount = db.prepare('SELECT COUNT(*) as count FROM articles').get() as { count: number };
  if (artCount.count === 0) {
    const insertArt = db.prepare(`
      INSERT INTO articles (
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
    insertSetting.run('groq_model', 'llama-3.3-70b-versatile', 'Selected Groq LLM model for Nigerian news editorial restructuring');
    insertSetting.run('groq_api_key', '', 'API Key for Groq Cloud inference');
    insertSetting.run('auto_publish', 'false', 'Automatically publish rewritten articles or hold in draft state for review');
    insertSetting.run('cron_interval_minutes', '30', 'Cloudflare Workers scheduled trigger interval');
    insertSetting.run('ai_prompt_template', `You are an expert Nigerian news editor and fact-checker at NaijaPulse. Rewrite and synthesize this RSS news lead into an original, factual, mobile-optimized news report for Nigerian readers. Maintain journalistic integrity, clear paragraphs, key takeaways, and proper source reference.`, 'System prompt for Groq processing');
    insertSetting.run('duplicate_similarity_threshold', '0.85', 'Threshold for duplicate headline detection');
  }

  // Seed default site settings
  const siteCount = db.prepare('SELECT COUNT(*) as count FROM site_settings').get() as { count: number };
  if (siteCount.count === 0) {
    const insertSite = db.prepare(`INSERT INTO site_settings (key, value) VALUES (?, ?)`);
    insertSite.run('site_name', 'NaijaPulse');
    insertSite.run('site_tagline', 'Your Pulse. Our Nation. Fast. Verified. Unbiased.');
    insertSite.run('contact_email', 'editor@naijapulse.ng');
    insertSite.run('twitter_handle', '@NaijaPulseNg');
    insertSite.run('admin_password', 'admin123'); // Default development admin password
  }

  // Seed initial audit log
  const logCount = db.prepare('SELECT COUNT(*) as count FROM automation_logs').get() as { count: number };
  if (logCount.count === 0) {
    const insertLog = db.prepare(`INSERT INTO automation_logs (id, event_type, source_id, message, level) VALUES (?, ?, ?, ?, ?)`);
    insertLog.run('log_' + Date.now(), 'SYSTEM_INIT', null, 'NaijaPulse database, D1 schemas, permitted RSS sources and initial feeds initialized.', 'info');
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
    query += ` AND c.slug = ?`;
    params.push(options.categorySlug);
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
  return (db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug) as Category) || null;
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
    data.category_default_id || 'cat_politics',
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
    data.category_id || 'cat_politics',
    data.image_url || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80',
    data.image_caption || '',
    data.image_credit || 'NaijaPulse Editorial',
    data.image_license || 'Standard Editorial Use',
    data.author_name || 'NaijaPulse Desk',
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
  
  return {
    totalArticles,
    publishedArticles,
    draftArticles,
    totalSources,
    activeSources,
    totalViews,
  };
}
