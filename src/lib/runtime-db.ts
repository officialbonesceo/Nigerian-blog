import type { D1Database } from '@cloudflare/workers-types';
import type { Article, Category, Source, AutomationSetting, AutomationLog, ArticleReport, RejectedArticle, ArticleComment, VideoArticle, VideoQueryOptions, Publisher } from './types';
import { initialCategories, initialArticles, initialSources, initialVideos } from './seed-data';
import { INITIAL_PUBLISHERS } from './publishers-data';
import { executeD1Query } from './d1-sync';

export type RuntimeLocals = { runtime?: { env?: { DB?: D1Database } } } | Record<string, unknown> | null | undefined;

const queryCache = new Map<string, { data: any; expires: number }>();
export function getCached<T>(key: string): T | null {
  const e = queryCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) {
    queryCache.delete(key);
    return null;
  }
  return e.data as T;
}
export function setCached<T>(key: string, data: T, ttlMs: number): void {
  queryCache.set(key, { data, expires: Date.now() + ttlMs });
}
export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    queryCache.clear();
    return;
  }
  for (const k of queryCache.keys()) if (k.startsWith(prefix)) queryCache.delete(k);
}

export function getD1(locals?: RuntimeLocals): D1Database {
  const runtimeEnv: any = (locals as any)?.runtime?.env || (typeof process !== 'undefined' ? process.env : {});
  const altEnv: any = (locals as any)?.env;
  const candidates = [runtimeEnv?.DB, runtimeEnv?.naijablog, altEnv?.DB, (globalThis as any)?.DB];
  for (const c of candidates) {
    if (c && typeof c === 'object' && typeof c.prepare === 'function') return c as D1Database;
  }
  for (const envSource of [runtimeEnv, altEnv, locals]) {
    if (envSource && typeof envSource === 'object') {
      for (const key of Object.keys(envSource)) {
        const candidate = (envSource as any)[key];
        if (candidate && typeof candidate === 'object' && typeof candidate.prepare === 'function') {
          return candidate as D1Database;
        }
      }
    }
  }
  const cfAccount = (runtimeEnv?.CLOUDFLARE_ACCOUNT_ID || process.env?.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const cfToken = (
    runtimeEnv?.CLOUDFLARE_D1_API_TOKEN ||
    runtimeEnv?.CLOUDFLARE_API_TOKEN ||
    process.env?.CLOUDFLARE_D1_API_TOKEN ||
    process.env?.CLOUDFLARE_API_TOKEN ||
    ''
  ).trim();
  const cfDb = (runtimeEnv?.CLOUDFLARE_D1_DATABASE_ID || process.env?.CLOUDFLARE_D1_DATABASE_ID || '').trim();
  if (cfAccount && cfToken && cfDb) {
    return {
      prepare(query: string) {
        let boundArgs: unknown[] = [];
        const stmtObj: any = {
          bind(...args: unknown[]) {
            boundArgs = args;
            return stmtObj;
          },
          async first<T = unknown>(colName?: string) {
            const res = await executeD1Query(query, boundArgs, {
              accountId: cfAccount,
              apiToken: cfToken,
              databaseNameOrId: cfDb,
            });
            const firstResult = Array.isArray(res.result) ? res.result[0] : res.result;
            const rows = Array.isArray(firstResult?.results) ? firstResult.results : [];
            if (!rows.length) return null;
            return (colName ? rows[0][colName] : rows[0]) as T;
          },
          async all<T = unknown>() {
            const res = await executeD1Query(query, boundArgs, {
              accountId: cfAccount,
              apiToken: cfToken,
              databaseNameOrId: cfDb,
            });
            const firstResult = Array.isArray(res.result) ? res.result[0] : res.result;
            return {
              success: res.success,
              results: (Array.isArray(firstResult?.results) ? firstResult.results : []) as T[],
              meta: firstResult?.meta || {},
            };
          },
          async run() {
            const res = await executeD1Query(query, boundArgs, {
              accountId: cfAccount,
              apiToken: cfToken,
              databaseNameOrId: cfDb,
            });
            const firstResult = Array.isArray(res.result) ? res.result[0] : res.result;
            return { success: res.success, meta: firstResult?.meta || { changes: 1 } };
          },
        };
        return stmtObj;
      },
      async batch() {
        return [];
      },
      async exec() {
        return { count: 0, duration: 0 };
      },
      dump() {
        throw new Error('dump not supported');
      },
    } as unknown as D1Database;
  }
  throw new Error('D1 binding not available');
}

const LIST_SELECT = `SELECT a.id, a.slug, a.title, a.summary, a.category_id, a.image_url,
  a.author_name, a.is_top_story, a.is_trending, a.is_breaking, a.views_count,
  a.reading_time_minutes, a.published_at, a.updated_at, a.status,
  c.name AS category_name, c.slug AS category_slug
  FROM articles a LEFT JOIN categories c ON a.category_id = c.id`;

const DETAIL_SELECT = `SELECT a.id, a.slug, a.title, a.summary, a.content, a.category_id, a.image_url,
  a.image_caption, a.image_credit, a.author_name, a.author_role,
  a.is_top_story, a.is_trending, a.is_breaking, a.views_count,
  a.reading_time_minutes, a.source_name, a.source_original_url,
  a.published_at, a.updated_at, a.status,
  c.name AS category_name, c.slug AS category_slug
  FROM articles a LEFT JOIN categories c ON a.category_id = c.id`;

function formatArticle(row: any): Article {
  return {
    ...row,
    is_top_story: Number(row.is_top_story || 0),
    is_trending: Number(row.is_trending || 0),
    is_breaking: Number(row.is_breaking || 0),
    views_count: Number(row.views_count || 0),
    reading_time_minutes: Number(row.reading_time_minutes || 4),
  } as Article;
}

export function isStubOrRejected(row: any): boolean {
  const t = String(row?.title || '').toLowerCase();
  const s = String(row?.status || '').toLowerCase();
  return s === 'rejected' || s === 'draft' || t.includes('[stub]') || t.includes('placeholder');
}

let tablesChecked = false;
export async function ensureTablesExist(db: D1Database, force = false) {
  if (tablesChecked && !force) return;
  tablesChecked = true;
}

export async function getArticleBySlug(db: D1Database, slug: string) {
  const cacheKey = `article_slug:${slug}`;
  const cached = getCached<Article | null>(cacheKey);
  if (cached !== null && cached !== undefined) return cached;
  try {
    const row = await db.prepare(`${DETAIL_SELECT} WHERE a.slug = ? AND a.status = 'published' LIMIT 1`).bind(slug).first<any>();
    if (row) {
      if (isStubOrRejected(row)) {
        setCached(cacheKey, null, 60000);
        return null;
      }
      const formatted = formatArticle(row);
      setCached(cacheKey, formatted, 180000);
      return formatted;
    }
    setCached(cacheKey, null, 30000);
  } catch (err) {
    console.warn('getArticleBySlug error:', err);
  }
  return null;
}

export async function getRelatedArticles(db: D1Database, id: string, categoryId: string, limit = 5) {
  const relKey = `related:${id}:${categoryId}:${limit}`;
  const relCached = getCached<Article[]>(relKey);
  if (relCached) return relCached;
  try {
    const res = await db
      .prepare(
        `${LIST_SELECT} WHERE a.status = 'published' AND a.id != ? AND a.category_id = ? ORDER BY a.published_at DESC LIMIT ?`
      )
      .bind(id, categoryId, Math.min(limit, 6))
      .all<any>();
    const items = (res?.results || []).map(formatArticle);
    setCached(relKey, items, 300000);
    return items;
  } catch {
    return [];
  }
}

export async function getArticles(
  db: D1Database,
  o: {
    categoryId?: string;
    categorySlug?: string;
    limit?: number;
    offset?: number;
    status?: string;
    isTopStory?: boolean;
    isTrending?: boolean;
    isBreaking?: boolean;
  } = {}
): Promise<Article[]> {
  const limit = Math.min(o.limit || 20, 20);
  const offset = o.offset || 0;
  const cacheKey = `articles:${o.categoryId || o.categorySlug || 'all'}:${limit}:${offset}:${o.isTopStory}:${o.isTrending}:${o.isBreaking}`;
  const cached = getCached<Article[]>(cacheKey);
  if (cached) return cached;
  try {
    let q = `${LIST_SELECT} WHERE a.status = 'published'`;
    const v: unknown[] = [];
    if (o.categoryId) {
      q += ' AND a.category_id = ?';
      v.push(o.categoryId);
    }
    if (o.categorySlug) {
      // business is canonical; old money/hustle/money-hustle aliases still resolve
      if (['business', 'money-hustle', 'money', 'hustle'].includes(o.categorySlug)) {
        q += " AND (c.slug = 'business' OR c.slug = 'money-hustle' OR a.category_id = 'cat_money_hustle')";
      } else {
        q += ' AND c.slug = ?';
        v.push(o.categorySlug);
      }
    }
    if (o.isTopStory) q += ' AND a.is_top_story = 1';
    if (o.isTrending) q += ' AND a.is_trending = 1';
    if (o.isBreaking) q += ' AND a.is_breaking = 1';
    q += ' ORDER BY a.published_at DESC LIMIT ? OFFSET ?';
    v.push(limit, offset);
    const res = await db.prepare(q).bind(...v).all<any>();
    const list = (res?.results || []).map(formatArticle);
    setCached(cacheKey, list, 180000);
    return list;
  } catch {
    return [];
  }
}

export async function getSiteSettings(db: D1Database): Promise<Record<string, string>> {
  const defaults: Record<string, string> = {
    site_name: '9jaBeacon',
    site_url: 'https://www.9jabeacon.name.ng',
    site_description: 'A Nigerian news blog.',
  };
  const cached = getCached<Record<string, string>>('site_settings');
  if (cached) return cached;
  try {
    const res = await db.prepare('SELECT key, value FROM site_settings').all<{ key: string; value: string }>();
    const out = { ...defaults };
    for (const row of res?.results || []) out[row.key] = row.value;
    setCached('site_settings', out, 600000);
    return out;
  } catch {
    setCached('site_settings', defaults, 120000);
    return defaults;
  }
}

export async function getCategories(db: D1Database): Promise<Category[]> {
  const cached = getCached<Category[]>('categories');
  if (cached) return cached;
  try {
    const res = await db.prepare('SELECT id, name, slug FROM categories').all<Category>();
    let list = res?.results || (initialCategories as Category[]);
    // Normalize display: never expose money/hustle in UI
    list = list.map((c) => {
      if (c.slug === 'money-hustle' || c.slug === 'money' || c.slug === 'hustle' || c.id === 'cat_money_hustle') {
        return { ...c, name: 'Business', slug: 'business' };
      }
      return c;
    });
    setCached('categories', list, 600000);
    return list;
  } catch {
    return initialCategories as Category[];
  }
}

const recentLoggedSessions = new Map<string, number>();
const recentViewIncrements = new Map<string, number>();

function sanitizeReferrer(ref: string | null | undefined): string {
  if (!ref) return '';
  try {
    const u = new URL(ref);
    return (u.origin + u.pathname).slice(0, 250);
  } catch {
    return '';
  }
}

export async function logVisitorSession(db: D1Database, input: Record<string, unknown>) {
  const pagePath = String(input.page_path || '');
  if (pagePath.startsWith('/bonesceo') || pagePath.startsWith('/admin')) return;
  const ua = String(input.user_agent || '').toLowerCase();
  if (ua.includes('bot') || ua.includes('crawl') || ua.includes('spider')) return;

  const sessionKey = `${input.session_id}_${pagePath}`;
  const now = Date.now();
  const lastTime = recentLoggedSessions.get(sessionKey);
  if (lastTime && now - lastTime < 3600000) return;
  recentLoggedSessions.set(sessionKey, now);
  try {
    await db
      .prepare(
        'INSERT INTO visitor_analytics(id, session_id, visit_date, page_path, user_agent, referrer, device_type) VALUES(?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        `visit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        String(input.session_id || ''),
        new Date().toISOString().slice(0, 10),
        pagePath.slice(0, 250),
        String(input.user_agent || '').slice(0, 120),
        sanitizeReferrer(String(input.referrer || '')),
        String(input.device_type || 'mobile')
      )
      .run();
  } catch {}
}

export async function incrementArticleView(db: D1Database, id: string) {
  const now = Date.now();
  const last = recentViewIncrements.get(id);
  if (last && now - last < 120000) return;
  recentViewIncrements.set(id, now);
  try {
    await db.prepare('UPDATE articles SET views_count = COALESCE(views_count, 0) + 1 WHERE id = ?').bind(id).run();
  } catch {}
}

export async function createArticle(db: D1Database, article: Record<string, unknown>) {
  try {
    const cols = Object.keys(article);
    const placeholders = cols.map(() => '?').join(',');
    await db
      .prepare(`INSERT INTO articles (${cols.join(',')}) VALUES (${placeholders})`)
      .bind(...cols.map((c) => article[c]))
      .run();
    invalidateCache();
    return true;
  } catch (err) {
    console.error('createArticle', err);
    return false;
  }
}

export async function recordRejectedArticle(db: D1Database, data: Record<string, unknown>) {
  try {
    await db
      .prepare(
        'INSERT INTO rejected_articles(id, source_id, source_name, original_title, original_url, raw_content, rejection_reason, ai_tier_failures, status, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)'
      )
      .bind(
        `rej_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        data.source_id || null,
        data.source_name || null,
        data.original_title || '',
        data.original_url || '',
        data.raw_content || null,
        data.rejection_reason || '',
        data.ai_tier_failures || null,
        'rejected',
        new Date().toISOString()
      )
      .run();
  } catch {}
}

export async function getSources(db: D1Database): Promise<Source[]> {
  try {
    const res = await db.prepare('SELECT * FROM sources').all<Source>();
    return res?.results || [];
  } catch {
    return [];
  }
}

export async function getSourceById(db: D1Database, id: string) {
  try {
    return await db.prepare('SELECT * FROM sources WHERE id=? LIMIT 1').bind(id).first<Source>();
  } catch {
    return null;
  }
}

export async function getAutomationSettings(db: D1Database): Promise<AutomationSetting[]> {
  try {
    const res = await db.prepare('SELECT * FROM automation_settings').all<AutomationSetting>();
    return res?.results || [];
  } catch {
    return [];
  }
}

export async function getMostReadArticles(db: D1Database, limit = 10) {
  return getArticles(db, { limit });
}
export async function getBreakingArticles(db: D1Database, limit = 5) {
  return getArticles(db, { limit, isBreaking: true });
}
export async function getTopStory(db: D1Database) {
  const list = await getArticles(db, { limit: 1, isTopStory: true });
  return list[0] || null;
}

/** Canonical category lookup — money/hustle aliases resolve to Business. */
export async function getCategoryBySlug(db: D1Database, slug: string) {
  try {
    const raw = (slug || '').toLowerCase().trim();
    const aliases = ['business', 'money-hustle', 'money', 'hustle'];
    if (aliases.includes(raw)) {
      const row =
        (await db.prepare("SELECT id, name, slug FROM categories WHERE slug = 'business' OR slug = 'money-hustle' OR id = 'cat_money_hustle' LIMIT 1").first<Category>()) ||
        null;
      if (row) return { ...row, name: 'Business', slug: 'business' };
      return { id: 'cat_money_hustle', name: 'Business', slug: 'business' } as Category;
    }
    return await db.prepare('SELECT id, name, slug FROM categories WHERE slug=? LIMIT 1').bind(raw).first<Category>();
  } catch {
    return null;
  }
}

export async function getArticleById(db: D1Database, id: string) {
  try {
    const row = await db.prepare(`${DETAIL_SELECT} WHERE a.id=? LIMIT 1`).bind(id).first<any>();
    return row ? formatArticle(row) : null;
  } catch {
    return null;
  }
}

export async function searchArticles(db: D1Database, q: string, limit = 20) {
  try {
    const res = await db
      .prepare(`${LIST_SELECT} WHERE a.status = 'published' AND a.title LIKE ? ORDER BY a.published_at DESC LIMIT ?`)
      .bind(`%${q}%`, Math.min(limit, 20))
      .all<any>();
    return (res?.results || []).map(formatArticle);
  } catch {
    return [];
  }
}

export async function getArticlesWithCount(db: D1Database, o: any = {}) {
  const articles = await getArticles(db, o);
  return { articles, total: articles.length };
}

export async function getAutomationLogs() { return []; }
export async function addAutomationLog() { return true; }
export async function updateAutomationSetting() { return true; }
export async function getRejectedArticles() { return []; }
export async function getArticleReports() { return []; }
export async function createArticleReport() { return true; }
export async function updateArticleReportStatus() { return true; }
export async function getArticleComments() { return []; }
export async function createArticleComment() { return true; }
export async function likeArticleComment() { return true; }
export async function getCustomAds() { return []; }
export async function createCustomAd() { return true; }
export async function deleteCustomAd() { return true; }
export async function toggleCustomAd() { return true; }
export async function getAdvertInquiries() { return []; }
export async function createAdvertInquiry() { return true; }
export async function updateAdvertInquiry() { return true; }
export async function deleteAdvertInquiry() { return true; }
export async function getAnalyticsMetrics() { return {}; }
export async function getAdminDashboardStats() { return {}; }
export async function getDatabaseDiagnostics() { return {}; }
export async function getDatabaseStorageStats() { return {}; }
export async function cleanAndVacuumDatabase() { return true; }
export async function updateArticle() { return true; }
export async function deleteArticle() { return true; }
export async function createSource() { return true; }
export async function updateSource() { return true; }
export async function deleteSource() { return true; }
export async function getPublishers() { return INITIAL_PUBLISHERS || []; }
export async function getPublisherById() { return null; }
export async function getPublisherBySlug() { return null; }
export async function createPublisher() { return true; }
export async function updatePublisher() { return true; }
export async function deletePublisher() { return true; }
export async function togglePublisherStatus() { return true; }
export async function getVideoArticles() { return { videos: [] }; }
export async function getVideoArticleById() { return null; }
export async function getVideoArticleBySlug() { return null; }
export async function createVideoArticle() { return true; }
export async function updateVideoArticle() { return true; }
export async function deleteVideoArticle() { return true; }
export async function incrementVideoViews() { return true; }
export async function updateSiteSetting() { return true; }
