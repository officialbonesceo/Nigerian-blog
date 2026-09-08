import type { D1Database } from '@cloudflare/workers-types';
import type { Article, Category, Source, AutomationSetting, AutomationLog, ArticleReport, RejectedArticle } from './types';
import { initialCategories, initialArticles, initialSources } from './seed-data';
import { executeD1Query } from './d1-sync';

let localSqliteDb: any = null;

async function getLocalSqliteDb(): Promise<any> {
  if (localSqliteDb) return localSqliteDb;
  // Only attempt to load local SQLite when running in Node.js (local dev / test server)
  // NEVER bundle or execute native bindings inside Cloudflare Workers or Pages
  if (typeof process !== 'undefined' && process.versions?.node && !process.env.CF_PAGES && !process.env.CLOUDFLARE_PAGES) {
    try {
      const dbPath = './db';
      const mod = await import(/* @vite-ignore */ dbPath);
      localSqliteDb = mod.db;
      return localSqliteDb;
    } catch (err) {
      console.warn('Local SQLite adapter could not be loaded in this environment:', err);
    }
  }
  return null;
}

export type RuntimeLocals = { runtime?: { env?: { DB?: D1Database } } } | Record<string, unknown> | null | undefined;

let localD1Adapter: D1Database | null = null;

function createLocalD1Adapter(): D1Database {
  if (localD1Adapter) return localD1Adapter;

  localD1Adapter = {
    prepare(query: string) {
      let boundArgs: unknown[] = [];
      const stmtObj = {
        bind(...args: unknown[]) {
          boundArgs = args;
          return stmtObj;
        },
        async all<T = unknown>() {
          const db = await getLocalSqliteDb();
          if (!db) return { results: [] as T[], success: true, meta: { changes: 0 } };
          const stmt = db.prepare(query);
          const results = (boundArgs.length ? stmt.all(...boundArgs) : stmt.all()) as T[];
          return { results, success: true, meta: { changes: 0 } };
        },
        async first<T = unknown>(colName?: string) {
          const db = await getLocalSqliteDb();
          if (!db) return null;
          const stmt = db.prepare(query);
          const row = (boundArgs.length ? stmt.get(...boundArgs) : stmt.get()) as Record<string, unknown> | undefined;
          if (!row) return null;
          if (colName) return (row[colName] ?? null) as T;
          return row as T;
        },
        async run() {
          const db = await getLocalSqliteDb();
          if (!db) {
            return {
              success: true,
              meta: { changes: 0, last_row_id: 0, served_by: 'missing-binding-fallback', duration: 0 },
            };
          }
          const stmt = db.prepare(query);
          const info = boundArgs.length ? stmt.run(...boundArgs) : stmt.run();
          return {
            success: true,
            meta: {
              changes: info.changes,
              last_row_id: Number(info.lastInsertRowid),
              served_by: 'local-sqlite',
              duration: 1,
            },
          };
        },
        async raw<T = unknown>() {
          const db = await getLocalSqliteDb();
          if (!db) return [] as T[];
          const stmt = db.prepare(query);
          return (boundArgs.length ? stmt.raw(true).all(...boundArgs) : stmt.raw(true).all()) as T[];
        },
      };
      return stmtObj as any;
    },
    async batch(statements: any[]) {
      const results: any[] = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results as any;
    },
    async exec(query: string) {
      const db = await getLocalSqliteDb();
      if (db) db.exec(query);
      return { count: 1, duration: 1 };
    },
    dump() {
      throw new Error('dump is not supported in local SQLite fallback');
    },
  } as unknown as D1Database;

  return localD1Adapter;
}

function createRemoteD1RestAdapter(accountId: string, apiToken: string, databaseId: string): D1Database {
  return {
    prepare(query: string) {
      let boundArgs: unknown[] = [];
      const stmtObj = {
        bind(...args: unknown[]) {
          boundArgs = args;
          return stmtObj;
        },
        async first<T = unknown>(colName?: string) {
          const res = await executeD1Query(query, boundArgs, { accountId, apiToken, databaseNameOrId: databaseId });
          const firstResult = Array.isArray(res.result) ? res.result[0] : res.result;
          const rows = Array.isArray(firstResult?.results) ? firstResult.results : [];
          if (!rows.length) return null;
          return (colName ? rows[0][colName] : rows[0]) as T;
        },
        async all<T = unknown>() {
          const res = await executeD1Query(query, boundArgs, { accountId, apiToken, databaseNameOrId: databaseId });
          const firstResult = Array.isArray(res.result) ? res.result[0] : res.result;
          const results = (Array.isArray(firstResult?.results) ? firstResult.results : []) as T[];
          return { success: res.success, results, meta: firstResult?.meta || {} };
        },
        async run() {
          const res = await executeD1Query(query, boundArgs, { accountId, apiToken, databaseNameOrId: databaseId });
          const firstResult = Array.isArray(res.result) ? res.result[0] : res.result;
          return { success: res.success, meta: firstResult?.meta || { changes: 1 } };
        },
        async raw<T = unknown>() {
          const res = await executeD1Query(query, boundArgs, { accountId, apiToken, databaseNameOrId: databaseId });
          const firstResult = Array.isArray(res.result) ? res.result[0] : res.result;
          return (Array.isArray(firstResult?.results) ? firstResult.results.map((r: any) => Object.values(r)) : []) as T[];
        },
      };
      return stmtObj as any;
    },
    async batch(statements: any[]) {
      const results: any[] = [];
      for (const s of statements) results.push(await s.run());
      return results as any;
    },
    async exec(query: string) {
      await executeD1Query(query, [], { accountId, apiToken, databaseNameOrId: databaseId });
      return { count: 1, duration: 1 };
    },
    dump() {
      throw new Error('dump is not supported');
    }
  } as unknown as D1Database;
}

export function getD1(locals?: RuntimeLocals): D1Database {
  const runtimeEnv: any = (locals as any)?.runtime?.env || (typeof process !== 'undefined' ? process.env : {});
  
  // 1. Direct standard D1 binding names in Cloudflare Pages
  const envDb = runtimeEnv?.DB || runtimeEnv?.D1 || runtimeEnv?.DATABASE || runtimeEnv?.database || runtimeEnv?.['9jabeacon-db'];
  if (envDb && typeof envDb.prepare === 'function') return envDb;

  // 2. Duck typing: inspect all properties of runtime.env for an object with .prepare()
  if (runtimeEnv && typeof runtimeEnv === 'object') {
    for (const key of Object.keys(runtimeEnv)) {
      if (runtimeEnv[key] && typeof runtimeEnv[key]?.prepare === 'function') {
        return runtimeEnv[key] as D1Database;
      }
    }
  }

  // 3. Cloudflare REST API fallback if API secrets are present
  const cfAccount = (runtimeEnv?.CLOUDFLARE_ACCOUNT_ID || (typeof process !== 'undefined' ? process.env?.CLOUDFLARE_ACCOUNT_ID : '') || '').trim();
  const cfToken = (runtimeEnv?.CLOUDFLARE_D1_API_TOKEN || runtimeEnv?.CLOUDFLARE_API_TOKEN || (typeof process !== 'undefined' ? (process.env?.CLOUDFLARE_D1_API_TOKEN || process.env?.CLOUDFLARE_API_TOKEN) : '') || '').trim();
  const cfDb = (runtimeEnv?.CLOUDFLARE_D1_DATABASE_ID || runtimeEnv?.CLOUDFLARE_D1_DATABASE || (typeof process !== 'undefined' ? (process.env?.CLOUDFLARE_D1_DATABASE_ID || process.env?.CLOUDFLARE_D1_DATABASE) : '') || '').trim();
  if (cfAccount && cfToken && cfDb) {
    return createRemoteD1RestAdapter(cfAccount, cfToken, cfDb);
  }

  // 4. Local SQLite adapter for local dev / Node.js
  return createLocalD1Adapter();
}

const select = `SELECT a.*,c.name AS category_name,c.slug AS category_slug FROM articles a LEFT JOIN categories c ON a.category_id=c.id`;

export async function getArticles(
  db: D1Database,
  o: { categoryId?: string; categorySlug?: string; limit?: number; offset?: number; status?: string; isTopStory?: boolean; isTrending?: boolean; isBreaking?: boolean } = {}
): Promise<Article[]> {
  let q = `${select} WHERE (a.status=? OR a.status IS NULL)`;
  const v: unknown[] = [o.status || 'published'];
  if (o.categoryId) { q += ' AND a.category_id=?'; v.push(o.categoryId); }
  if (o.categorySlug) { q += ' AND c.slug=?'; v.push(o.categorySlug); }
  if (o.isTopStory !== undefined) { q += ' AND a.is_top_story=?'; v.push(o.isTopStory ? 1 : 0); }
  if (o.isTrending !== undefined) { q += ' AND a.is_trending=?'; v.push(o.isTrending ? 1 : 0); }
  if (o.isBreaking !== undefined) { q += ' AND a.is_breaking=?'; v.push(o.isBreaking ? 1 : 0); }
  q += ' ORDER BY a.published_at DESC LIMIT ? OFFSET ?';
  v.push(Math.min(Math.max(o.limit ?? 20, 1), 200), Math.max(o.offset ?? 0, 0));

  let results: Article[] = [];
  try {
    const res = await db.prepare(q).bind(...v).all<Article>();
    results = (res?.results || []).map((art) => ({
      ...art,
      views_count: art.views_count ?? 0,
      category_name: art.category_name || 'General News',
      category_slug: art.category_slug || 'naija-news',
    }));
  } catch (err) {
    console.warn('getArticles query warning:', err);
  }

  if (!results.length && (!o.status || o.status === 'published')) {
    let fallback = [...initialArticles] as Article[];
    if (o.categoryId) fallback = fallback.filter((a) => a.category_id === o.categoryId);
    if (o.categorySlug) fallback = fallback.filter((a) => a.category_slug === o.categorySlug || a.category_id === o.categorySlug);
    if (o.isTopStory !== undefined) fallback = fallback.filter((a) => Boolean(a.is_top_story) === Boolean(o.isTopStory));
    if (o.isTrending !== undefined) fallback = fallback.filter((a) => Boolean(a.is_trending) === Boolean(o.isTrending));
    if (o.isBreaking !== undefined) fallback = fallback.filter((a) => Boolean(a.is_breaking) === Boolean(o.isBreaking));
    results = fallback.slice(o.offset || 0, (o.offset || 0) + (o.limit || 20));
  }
  return results;
}

export async function searchArticles(db: D1Database, term: string, limit = 50) {
  const q = `${select} WHERE (a.status='published' OR a.status IS NULL) AND (a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ?) ORDER BY a.published_at DESC LIMIT ?`;
  const x = `%${term.replace(/[%_]/g, '\\$&')}%`;
  try {
    const res = await db.prepare(q).bind(x, x, x, Math.min(Math.max(limit, 1), 100)).all<Article>();
    if (res?.results?.length) {
      return res.results.map((art) => ({
        ...art,
        views_count: art.views_count ?? 0,
        category_name: art.category_name || 'General News',
        category_slug: art.category_slug || 'naija-news',
      }));
    }
  } catch {}
  const lower = term.toLowerCase();
  return (initialArticles as Article[]).filter((a) =>
    a.title.toLowerCase().includes(lower) || a.summary.toLowerCase().includes(lower)
  ).slice(0, limit);
}

export async function getArticleBySlug(db: D1Database, slug: string) {
  try {
    const row = await db.prepare(`${select} WHERE a.slug=? LIMIT 1`).bind(slug).first<Article>();
    if (row) {
      db.prepare('UPDATE articles SET views_count=COALESCE(views_count,0)+1 WHERE id=?').bind(row.id).run().catch(() => {});
      return {
        ...row,
        views_count: (row.views_count ?? 0) + 1,
        category_name: row.category_name || 'General News',
        category_slug: row.category_slug || 'naija-news',
      };
    }
  } catch {}
  const fallback = (initialArticles as Article[]).find((a) => a.slug === slug);
  return fallback ? { ...fallback, views_count: fallback.views_count ?? 0 } : null;
}

export async function getRelatedArticles(db: D1Database, id: string, categoryId: string, limit = 3) {
  try {
    const res = await db.prepare(`${select} WHERE (a.status='published' OR a.status IS NULL) AND a.id!=? AND a.category_id=? ORDER BY a.published_at DESC LIMIT ?`).bind(id, categoryId, limit).all<Article>();
    if (res?.results?.length) {
      return res.results.map((art) => ({
        ...art,
        views_count: art.views_count ?? 0,
        category_name: art.category_name || 'General News',
      }));
    }
  } catch {}
  return (initialArticles as Article[]).filter((a) => a.id !== id && a.category_id === categoryId).slice(0, limit);
}

export async function getTopStory(db: D1Database) {
  try {
    const row = await db.prepare(`${select} WHERE (a.status='published' OR a.status IS NULL) AND (a.is_top_story=1 OR a.is_trending=1) ORDER BY a.published_at DESC LIMIT 1`).first<Article>();
    if (row) {
      return {
        ...row,
        views_count: row.views_count ?? 0,
        category_name: row.category_name || 'Top News',
      };
    }
  } catch {}
  const fallback = (initialArticles as Article[]).find((a) => a.is_top_story === 1) || (initialArticles as Article[])[0] || null;
  return fallback ? { ...fallback, views_count: fallback.views_count ?? 0 } : null;
}

export async function getMostReadArticles(db: D1Database, limit = 4) {
  try {
    const res = await db.prepare(`${select} WHERE (a.status='published' OR a.status IS NULL) ORDER BY a.views_count DESC, a.published_at DESC LIMIT ?`).bind(limit).all<Article>();
    if (res?.results?.length) {
      return res.results.map((art) => ({
        ...art,
        views_count: art.views_count ?? 0,
        category_name: art.category_name || 'General News',
      }));
    }
  } catch {}
  return [...(initialArticles as Article[])].sort((a, b) => (b.views_count || 0) - (a.views_count || 0)).slice(0, limit);
}

export async function getBreakingArticles(db: D1Database, limit = 3) {
  try {
    const res = await db.prepare(`${select} WHERE (a.status='published' OR a.status IS NULL) AND a.is_breaking=1 ORDER BY a.published_at DESC LIMIT ?`).bind(limit).all<Article>();
    if (res?.results?.length) {
      return res.results.map((art) => ({
        ...art,
        views_count: art.views_count ?? 0,
        category_name: art.category_name || 'Breaking News',
      }));
    }
  } catch {}
  return (initialArticles as Article[]).filter((a) => a.is_breaking === 1).slice(0, limit);
}

export async function getCategories(db: D1Database) {
  try {
    const rows = await db.prepare('SELECT * FROM categories').all<any>();
    if (rows?.results?.length) {
      return rows.results.sort((a: any, b: any) => Number(a.display_order ?? a.sort_order ?? 0) - Number(b.display_order ?? b.sort_order ?? 0) || String(a.name).localeCompare(String(b.name))) as Category[];
    }
  } catch {}
  return initialCategories;
}

export async function getCategoryBySlug(db: D1Database, slug: string) {
  try {
    const row = await db.prepare('SELECT * FROM categories WHERE slug=? LIMIT 1').bind(slug).first<Category>();
    if (row) return row;
  } catch {}
  return initialCategories.find((c) => c.slug === slug) ?? null;
}

export async function getSiteSettings(db: D1Database): Promise<Record<string, string>> {
  try {
    const res = await db.prepare('SELECT key, value FROM site_settings').all<{ key: string; value: string }>();
    const r = res?.results || [];
    return Object.fromEntries(r.map((x) => [x.key, x.value]));
  } catch {
    return {
      site_name: '9jaBeacon',
      site_url: 'https://9jabeacon.pages.dev',
      site_description: 'Fast, verified Nigerian news and useful updates.'
    };
  }
}

export async function getAutomationSettings(db: D1Database) {
  try {
    const res = await db.prepare('SELECT * FROM automation_settings ORDER BY key').all<AutomationSetting>();
    return res?.results || [];
  } catch {
    return [];
  }
}

export async function getSources(db: D1Database) {
  try {
    const res = await db.prepare('SELECT s.*, c.name AS category_name FROM sources s LEFT JOIN categories c ON s.category_default_id=c.id ORDER BY s.name').all<Source>();
    if (res?.results && res.results.length > 0) return res.results;
  } catch {}
  return initialSources as Source[];
}

export async function getSourceById(db: D1Database, id: string) {
  try {
    return await db.prepare('SELECT s.*, c.name AS category_name FROM sources s LEFT JOIN categories c ON s.category_default_id=c.id WHERE s.id=? LIMIT 1').bind(id).first<Source>();
  } catch {
    return (initialSources as Source[]).find((s) => s.id === id) || null;
  }
}

export async function getAutomationLogs(db: D1Database, limit = 35) {
  try {
    const res = await db.prepare('SELECT l.*, s.name AS source_name FROM automation_logs l LEFT JOIN sources s ON l.source_id=s.id ORDER BY l.created_at DESC LIMIT ?').bind(limit).all<AutomationLog>();
    return res?.results || [];
  } catch {
    return [];
  }
}

export async function addAutomationLog(db: D1Database, action: string, sourceId: string | null, message: string, status: 'info' | 'warning' | 'error' = 'info') {
  try {
    const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.prepare('INSERT INTO automation_logs (id, action, source_id, message, status) VALUES (?, ?, ?, ?, ?)').bind(id, action, sourceId, message, status).run();
  } catch {}
}

export async function getArticleReports(db: D1Database, limit = 50) {
  try {
    const res = await db.prepare('SELECT * FROM article_reports ORDER BY created_at DESC LIMIT ?').bind(limit).all<ArticleReport>();
    return res?.results || [];
  } catch {
    return [];
  }
}

export async function getRejectedArticles(db: D1Database, limit = 50) {
  try {
    const res = await db.prepare('SELECT r.*, s.name AS source_name FROM rejected_articles r LEFT JOIN sources s ON r.source_id=s.id ORDER BY r.created_at DESC LIMIT ?').bind(limit).all<RejectedArticle>();
    return res?.results || [];
  } catch {
    return [];
  }
}

export async function recordRejectedArticle(db: D1Database, data: Record<string, unknown>) {
  try {
    const id = `rej_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.prepare('INSERT INTO rejected_articles (id, source_id, source_name, original_title, original_url, raw_content, rejection_reason, ai_tier_failures) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
      id,
      String(data.source_id || ''),
      String(data.source_name || ''),
      String(data.original_title || ''),
      String(data.original_url || ''),
      String(data.raw_content || ''),
      String(data.rejection_reason || ''),
      String(data.ai_tier_failures || '')
    ).run();
  } catch {}
}

export async function getAnalyticsMetrics(db: D1Database) {
  try {
    const [t, total, u, p] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS count FROM visitor_analytics WHERE visit_date=date('now')").first<{ count: number }>().catch(() => ({ count: 0 })),
      db.prepare('SELECT COUNT(*) AS count FROM visitor_analytics').first<{ count: number }>().catch(() => ({ count: 0 })),
      db.prepare('SELECT COUNT(DISTINCT session_id) AS count FROM visitor_analytics').first<{ count: number }>().catch(() => ({ count: 0 })),
      db.prepare('SELECT page_path, COUNT(*) AS views FROM visitor_analytics GROUP BY page_path ORDER BY views DESC LIMIT 10').all<{ page_path: string; views: number }>().catch(() => ({ results: [] })),
    ]);
    return {
      todayVisits: (t as any)?.count ?? 0,
      totalVisits: (total as any)?.count ?? 0,
      uniqueVisitors: (u as any)?.count ?? 0,
      topPages: (p as any)?.results || [],
    };
  } catch {
    return { todayVisits: 0, totalVisits: 0, uniqueVisitors: 0, topPages: [] };
  }
}

export async function getAdminDashboardStats(db: D1Database) {
  try {
    const [a, s, r, j, v] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS count FROM articles WHERE status='published' OR status IS NULL").first<{ count: number }>().catch(() => ({ count: 0 })),
      db.prepare('SELECT COUNT(*) AS count FROM sources WHERE is_enabled=1').first<{ count: number }>().catch(() => ({ count: 0 })),
      db.prepare("SELECT COUNT(*) AS count FROM article_reports WHERE status='pending'").first<{ count: number }>().catch(() => ({ count: 0 })),
      db.prepare("SELECT COUNT(*) AS count FROM rejected_articles WHERE status='rejected'").first<{ count: number }>().catch(() => ({ count: 0 })),
      db.prepare('SELECT COALESCE(SUM(views_count), 0) AS count FROM articles').first<{ count: number }>().catch(() => ({ count: 0 })),
    ]);
    const pubCount = (a as any)?.count ?? 0;
    const srcCount = (s as any)?.count ?? 0;
    const viewsCount = (v as any)?.count ?? 0;
    return {
      publishedArticles: pubCount > 0 ? pubCount : initialArticles.length,
      enabledSources: srcCount > 0 ? srcCount : initialSources.length,
      pendingReports: (r as any)?.count ?? 0,
      rejectedArticles: (j as any)?.count ?? 0,
      articleViews: viewsCount,
    };
  } catch {
    return {
      publishedArticles: initialArticles.length,
      enabledSources: initialSources.length,
      pendingReports: 0,
      rejectedArticles: 0,
      articleViews: 0,
    };
  }
}

export async function createArticle(db: D1Database, input: Record<string, unknown>) {
  const id = String(input.id || `art_${Date.now()}`);
  const slug = String(input.slug || String(input.title || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180));
  const f: any = {
    id,
    slug,
    title: String(input.title || ''),
    summary: String(input.summary || ''),
    content: String(input.content || ''),
    category_id: String(input.category_id || 'cat_naija_news'),
    image_url: input.image_url ? String(input.image_url) : null,
    image_caption: input.image_caption ? String(input.image_caption) : null,
    image_credit: input.image_credit ? String(input.image_credit) : null,
    image_license: input.image_license ? String(input.image_license) : null,
    author_name: String(input.author_name || '9jaBeacon Editorial Team'),
    author_role: String(input.author_role || 'Editorial Desk'),
    author_avatar: input.author_avatar ? String(input.author_avatar) : null,
    is_top_story: Number(input.is_top_story || 0),
    is_trending: Number(input.is_trending || 0),
    is_breaking: Number(input.is_breaking || 0),
    views_count: Number(input.views_count || 0),
    reading_time_minutes: Number(input.reading_time_minutes || 4),
    source_id: input.source_id ? String(input.source_id) : null,
    source_name: input.source_name ? String(input.source_name) : null,
    source_original_url: input.source_original_url ? String(input.source_original_url) : null,
    published_at: String(input.published_at || new Date().toISOString()),
    updated_at: new Date().toISOString(),
    status: String(input.status || 'published'),
  };
  try {
    await db.prepare(`INSERT OR REPLACE INTO articles (id, slug, title, summary, content, category_id, image_url, image_caption, image_credit, image_license, author_name, author_role, author_avatar, is_top_story, is_trending, is_breaking, views_count, reading_time_minutes, source_id, source_name, source_original_url, published_at, updated_at, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...Object.values(f)).run();
  } catch (err: any) {
    console.warn('createArticle insert failed, retrying basic insert:', err.message);
    await db.prepare(`INSERT OR REPLACE INTO articles (id, slug, title, summary, content, category_id, image_url, published_at, status) VALUES (?,?,?,?,?,?,?,?,?)`).bind(
      f.id, f.slug, f.title, f.summary, f.content, f.category_id, f.image_url, f.published_at, f.status
    ).run().catch(() => {});
  }
  return getArticleBySlug(db, slug);
}

export async function updateArticle(db: D1Database, id: string, input: Record<string, unknown>) {
  const allowed = ['title', 'slug', 'summary', 'content', 'category_id', 'image_url', 'image_caption', 'image_credit', 'image_license', 'author_name', 'author_role', 'author_avatar', 'is_top_story', 'is_trending', 'is_breaking', 'reading_time_minutes', 'source_id', 'source_name', 'source_original_url', 'published_at', 'status'];
  const s: string[] = [], v: unknown[] = [];
  for (const k of allowed) {
    if (k in input) { s.push(`${k}=?`); v.push(input[k]); }
  }
  if (!s.length) return false;
  s.push("updated_at=datetime('now')");
  v.push(id);
  return (await db.prepare(`UPDATE articles SET ${s.join(',')} WHERE id=?`).bind(...v).run()).meta.changes > 0;
}

export async function deleteArticle(db: D1Database, id: string) {
  return (await db.prepare('DELETE FROM articles WHERE id=?').bind(id).run()).meta.changes > 0;
}

export async function createSource(db: D1Database, input: Record<string, unknown>) {
  const id = String(input.id || `src_${Date.now()}`);
  await db.prepare('INSERT INTO sources (id, name, feed_url, website_url, category_default_id, is_enabled, is_official, trust_score, license_notes, fetch_interval_minutes) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(
    id, String(input.name), String(input.feed_url), String(input.website_url || ''), String(input.category_default_id || 'cat_naija_news'), Number(input.is_enabled ?? 1), Number(input.is_official ?? 0), Number(input.trust_score ?? 90), String(input.license_notes || ''), Number(input.fetch_interval_minutes || 30)
  ).run();
  return db.prepare('SELECT * FROM sources WHERE id=?').bind(id).first<Source>();
}

export async function updateSource(db: D1Database, id: string, input: Record<string, unknown>) {
  const allowed = ['name', 'feed_url', 'website_url', 'category_default_id', 'is_enabled', 'is_official', 'trust_score', 'license_notes', 'fetch_interval_minutes'];
  const s: string[] = [], v: unknown[] = [];
  for (const k of allowed) {
    if (k in input) { s.push(`${k}=?`); v.push(input[k]); }
  }
  if (!s.length) return null;
  v.push(id);
  await db.prepare(`UPDATE sources SET ${s.join(',')} WHERE id=?`).bind(...v).run();
  return db.prepare('SELECT * FROM sources WHERE id=?').bind(id).first<Source>();
}

export async function deleteSource(db: D1Database, id: string) {
  return (await db.prepare('DELETE FROM sources WHERE id=?').bind(id).run()).meta.changes > 0;
}

export async function updateAutomationSetting(db: D1Database, k: string, v: string) {
  await db.prepare("INSERT INTO automation_settings(key, value, updated_at) VALUES(?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')").bind(k, v).run();
}

export async function updateSiteSetting(db: D1Database, k: string, v: string) {
  await db.prepare("INSERT INTO site_settings(key, value, updated_at) VALUES(?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')").bind(k, v).run();
}

export async function logVisitorSession(db: D1Database, input: Record<string, unknown>) {
  try {
    await db.prepare('INSERT INTO visitor_analytics(id, session_id, visit_date, page_path, user_agent, referrer, device_type) VALUES(?, ?, ?, ?, ?, ?, ?)').bind(
      `visit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      String(input.session_id),
      new Date().toISOString().slice(0, 10),
      String(input.page_path),
      input.user_agent ? String(input.user_agent) : null,
      input.referrer ? String(input.referrer) : null,
      String(input.device_type || 'mobile')
    ).run();
  } catch {}
}

export async function createArticleReport(db: D1Database, input: Record<string, unknown>) {
  const id = `report_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await db.prepare('INSERT INTO article_reports(id, article_id, article_title, article_slug, reason, details, reporter_email) VALUES(?, ?, ?, ?, ?, ?, ?)').bind(
    id, String(input.article_id), input.article_title ? String(input.article_title) : null, input.article_slug ? String(input.article_slug) : null, String(input.reason), input.details ? String(input.details) : null, input.reporter_email ? String(input.reporter_email) : null
  ).run();
  return db.prepare('SELECT * FROM article_reports WHERE id=?').bind(id).first<ArticleReport>();
}

export async function updateArticleReportStatus(db: D1Database, id: string, status: string) {
  return (await db.prepare('UPDATE article_reports SET status=? WHERE id=?').bind(status, id).run()).meta.changes > 0;
}
