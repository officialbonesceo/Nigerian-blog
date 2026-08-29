import type { D1Database } from '@cloudflare/workers-types';
import type {
  Article,
  Category,
  Source,
  AutomationSetting,
  AutomationLog,
  ArticleReport,
  RejectedArticle,
} from './types';

export type RuntimeLocals = {
  runtime?: { env?: { DB?: D1Database } };
};

export function getD1(locals: RuntimeLocals): D1Database {
  const db = locals.runtime?.env?.DB;
  if (!db) throw new Error('Cloudflare D1 binding DB is not available. Bind the naijablog D1 database as DB.');
  return db;
}

const articleSelect = `
  SELECT a.*, c.name AS category_name, c.slug AS category_slug
  FROM articles a
  LEFT JOIN categories c ON a.category_id = c.id
`;

export async function getArticles(db: D1Database, options: {
  categoryId?: string; categorySlug?: string; limit?: number; offset?: number;
  status?: string; isTopStory?: boolean; isTrending?: boolean; isBreaking?: boolean;
} = {}): Promise<Article[]> {
  let sql = `${articleSelect} WHERE 1=1`;
  const args: unknown[] = [];
  sql += ' AND a.status = ?'; args.push(options.status || 'published');
  if (options.categoryId) { sql += ' AND a.category_id = ?'; args.push(options.categoryId); }
  if (options.categorySlug) { sql += ' AND c.slug = ?'; args.push(options.categorySlug); }
  if (options.isTopStory !== undefined) { sql += ' AND a.is_top_story = ?'; args.push(options.isTopStory ? 1 : 0); }
  if (options.isTrending !== undefined) { sql += ' AND a.is_trending = ?'; args.push(options.isTrending ? 1 : 0); }
  if (options.isBreaking !== undefined) { sql += ' AND a.is_breaking = ?'; args.push(options.isBreaking ? 1 : 0); }
  sql += ' ORDER BY a.published_at DESC LIMIT ? OFFSET ?';
  args.push(Math.min(Math.max(options.limit ?? 20, 1), 200), Math.max(options.offset ?? 0, 0));
  return (await db.prepare(sql).bind(...args).all<Article>()).results;
}

export async function getArticleBySlug(db: D1Database, slug: string): Promise<Article | null> {
  const row = await db.prepare(`${articleSelect} WHERE a.slug = ? LIMIT 1`).bind(slug).first<Article>();
  if (row) {
    // Do not let a view counter block page rendering.
    db.prepare('UPDATE articles SET views_count = COALESCE(views_count, 0) + 1 WHERE id = ?').bind(row.id).run().catch(() => {});
  }
  return row ?? null;
}

export async function getRelatedArticles(db: D1Database, articleId: string, categoryId: string, limit = 3): Promise<Article[]> {
  return (await db.prepare(`${articleSelect} WHERE a.status = 'published' AND a.id != ? AND a.category_id = ? ORDER BY a.published_at DESC LIMIT ?`).bind(articleId, categoryId, limit).all<Article>()).results;
}

export async function getTopStory(db: D1Database): Promise<Article | null> {
  return (await db.prepare(`${articleSelect} WHERE a.status = 'published' AND a.is_top_story = 1 ORDER BY a.published_at DESC LIMIT 1`).first<Article>()) ?? null;
}

export async function getMostReadArticles(db: D1Database, limit = 4): Promise<Article[]> {
  return (await db.prepare(`${articleSelect} WHERE a.status = 'published' ORDER BY a.views_count DESC, a.published_at DESC LIMIT ?`).bind(limit).all<Article>()).results;
}

export async function getBreakingArticles(db: D1Database, limit = 3): Promise<Article[]> {
  return (await db.prepare(`${articleSelect} WHERE a.status = 'published' AND a.is_breaking = 1 ORDER BY a.published_at DESC LIMIT ?`).bind(limit).all<Article>()).results;
}

export async function getCategories(db: D1Database): Promise<Category[]> {
  return (await db.prepare('SELECT * FROM categories ORDER BY display_order ASC, name ASC').all<Category>()).results;
}

export async function getCategoryBySlug(db: D1Database, slug: string): Promise<Category | null> {
  return (await db.prepare('SELECT * FROM categories WHERE slug = ? LIMIT 1').bind(slug).first<Category>()) ?? null;
}

export async function getSiteSettings(db: D1Database): Promise<Record<string, string>> {
  const rows = (await db.prepare('SELECT key, value FROM site_settings').all<{ key: string; value: string }>()).results;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function getAutomationSettings(db: D1Database): Promise<AutomationSetting[]> {
  return (await db.prepare('SELECT * FROM automation_settings ORDER BY key').all<AutomationSetting>()).results;
}

export async function getSources(db: D1Database): Promise<Source[]> {
  return (await db.prepare('SELECT s.*, c.name AS category_name FROM sources s LEFT JOIN categories c ON s.category_default_id = c.id ORDER BY s.name').all<Source>()).results;
}

export async function getAutomationLogs(db: D1Database, limit = 35): Promise<AutomationLog[]> {
  return (await db.prepare('SELECT l.*, s.name AS source_name FROM automation_logs l LEFT JOIN sources s ON l.source_id = s.id ORDER BY l.created_at DESC LIMIT ?').bind(limit).all<AutomationLog>()).results;
}

export async function getArticleReports(db: D1Database, status?: string, limit = 50): Promise<ArticleReport[]> {
  if (status) return (await db.prepare('SELECT * FROM article_reports WHERE status = ? ORDER BY created_at DESC LIMIT ?').bind(status, limit).all<ArticleReport>()).results;
  return (await db.prepare('SELECT * FROM article_reports ORDER BY created_at DESC LIMIT ?').bind(limit).all<ArticleReport>()).results;
}

export async function getRejectedArticles(db: D1Database, limit = 50): Promise<RejectedArticle[]> {
  return (await db.prepare('SELECT r.*, s.name AS source_name FROM rejected_articles r LEFT JOIN sources s ON r.source_id = s.id ORDER BY r.created_at DESC LIMIT ?').bind(limit).all<RejectedArticle>()).results;
}

export async function getAnalyticsMetrics(db: D1Database) {
  const [today, total, unique, topPages] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM visitor_analytics WHERE visit_date = date('now')").first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) AS count FROM visitor_analytics').first<{ count: number }>(),
    db.prepare('SELECT COUNT(DISTINCT session_id) AS count FROM visitor_analytics').first<{ count: number }>(),
    db.prepare('SELECT page_path, COUNT(*) AS views FROM visitor_analytics GROUP BY page_path ORDER BY views DESC LIMIT 10').all<{ page_path: string; views: number }>(),
  ]);
  return { todayVisits: today?.count ?? 0, totalVisits: total?.count ?? 0, uniqueVisitors: unique?.count ?? 0, topPages: topPages.results };
}

export async function getAdminDashboardStats(db: D1Database) {
  const [articles, sources, reports, rejected, views] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM articles WHERE status = 'published'").first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) AS count FROM sources WHERE is_enabled = 1').first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM article_reports WHERE status = 'pending'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM rejected_articles WHERE status = 'rejected'").first<{ count: number }>(),
    db.prepare('SELECT COALESCE(SUM(views_count), 0) AS count FROM articles').first<{ count: number }>(),
  ]);
  return { publishedArticles: articles?.count ?? 0, enabledSources: sources?.count ?? 0, pendingReports: reports?.count ?? 0, rejectedArticles: rejected?.count ?? 0, articleViews: views?.count ?? 0 };
}

export async function createArticle(db: D1Database, input: Record<string, unknown>) {
  const id = String(input.id || `art_${Date.now()}`);
  const slug = String(input.slug || String(input.title || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180));
  const fields = {
    id, slug, title: String(input.title || ''), summary: String(input.summary || ''), content: String(input.content || ''),
    category_id: String(input.category_id || 'cat_naija_news'), image_url: input.image_url ? String(input.image_url) : null,
    image_caption: input.image_caption ? String(input.image_caption) : null, image_credit: input.image_credit ? String(input.image_credit) : null,
    image_license: input.image_license ? String(input.image_license) : null, author_name: String(input.author_name || '9jaBeacon Editorial Team'),
    author_role: String(input.author_role || 'Editorial Desk'), author_avatar: input.author_avatar ? String(input.author_avatar) : null,
    is_top_story: Number(input.is_top_story || 0), is_trending: Number(input.is_trending || 0), is_breaking: Number(input.is_breaking || 0),
    views_count: Number(input.views_count || 0), reading_time_minutes: Number(input.reading_time_minutes || 4), source_id: input.source_id ? String(input.source_id) : null,
    source_name: input.source_name ? String(input.source_name) : null, source_original_url: input.source_original_url ? String(input.source_original_url) : null,
    published_at: String(input.published_at || new Date().toISOString()), updated_at: new Date().toISOString(), status: String(input.status || 'published'),
  };
  await db.prepare(`INSERT INTO articles (id,slug,title,summary,content,category_id,image_url,image_caption,image_credit,image_license,author_name,author_role,author_avatar,is_top_story,is_trending,is_breaking,views_count,reading_time_minutes,source_id,source_name,source_original_url,published_at,updated_at,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...Object.values(fields)).run();
  return await getArticleBySlug(db, slug);
}

export async function updateArticle(db: D1Database, id: string, input: Record<string, unknown>) {
  const allowed = ['title','slug','summary','content','category_id','image_url','image_caption','image_credit','image_license','author_name','author_role','author_avatar','is_top_story','is_trending','is_breaking','reading_time_minutes','source_id','source_name','source_original_url','published_at','status'];
  const sets: string[] = []; const values: unknown[] = [];
  for (const key of allowed) if (key in input) { sets.push(`${key} = ?`); values.push(input[key]); }
  if (!sets.length) return false;
  sets.push("updated_at = datetime('now')"); values.push(id);
  const result = await db.prepare(`UPDATE articles SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  return result.meta.changes > 0;
}

export async function deleteArticle(db: D1Database, id: string) {
  const result = await db.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}

export async function createSource(db: D1Database, input: Record<string, unknown>) {
  const id = String(input.id || `src_${Date.now()}`);
  await db.prepare(`INSERT INTO sources (id,name,feed_url,website_url,category_default_id,is_enabled,is_official,trust_score,license_notes,fetch_interval_minutes) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id,String(input.name),String(input.feed_url),String(input.website_url || ''),String(input.category_default_id || 'cat_naija_news'),Number(input.is_enabled ?? 1),Number(input.is_official ?? 0),Number(input.trust_score ?? 90),String(input.license_notes || ''),Number(input.fetch_interval_minutes || 30)).run();
  return (await db.prepare('SELECT * FROM sources WHERE id = ?').bind(id).first<Source>()) ?? null;
}

export async function updateSource(db: D1Database, id: string, input: Record<string, unknown>) {
  const allowed = ['name','feed_url','website_url','category_default_id','is_enabled','is_official','trust_score','license_notes','fetch_interval_minutes'];
  const sets: string[] = []; const values: unknown[] = [];
  for (const key of allowed) if (key in input) { sets.push(`${key} = ?`); values.push(input[key]); }
  if (!sets.length) return null;
  values.push(id); await db.prepare(`UPDATE sources SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  return (await db.prepare('SELECT * FROM sources WHERE id = ?').bind(id).first<Source>()) ?? null;
}

export async function deleteSource(db: D1Database, id: string) {
  const result = await db.prepare('DELETE FROM sources WHERE id = ?').bind(id).run(); return result.meta.changes > 0;
}

export async function updateAutomationSetting(db: D1Database, key: string, value: string) {
  await db.prepare("INSERT INTO automation_settings (key,value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind(key,value).run();
}

export async function updateSiteSetting(db: D1Database, key: string, value: string) {
  await db.prepare("INSERT INTO site_settings (key,value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind(key,value).run();
}
