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
  const altEnv: any = (locals as any)?.env;
  
  // 1. Direct standard D1 binding names in Cloudflare Pages & Workers
  const candidates = [
    runtimeEnv?.DB,
    runtimeEnv?.naijablog,
    runtimeEnv?.D1,
    runtimeEnv?.DATABASE,
    runtimeEnv?.database,
    runtimeEnv?.['9jabeacon-db'],
    runtimeEnv?.['9jabeacon-d1'],
    runtimeEnv?.['9jabeacon_db'],
    runtimeEnv?.['9jabeacon_d1'],
    altEnv?.DB,
    altEnv?.naijablog,
    altEnv?.D1,
    altEnv?.DATABASE,
    (globalThis as any)?.__env__?.DB,
    (globalThis as any)?.DB,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && typeof candidate.prepare === 'function') {
      return candidate as D1Database;
    }
  }

  // 2. Duck typing: inspect all properties of runtime.env, altEnv, or locals for an object with .prepare()
  for (const envSource of [runtimeEnv, altEnv, locals]) {
    if (envSource && typeof envSource === 'object') {
      for (const key of Object.keys(envSource)) {
        const candidate = envSource[key];
        if (candidate && typeof candidate === 'object' && typeof candidate.prepare === 'function') {
          return candidate as D1Database;
        }
      }
    }
  }

  // 3. Cloudflare REST API fallback if API secrets are present in environment variables
  const cfAccount = (
    runtimeEnv?.CLOUDFLARE_ACCOUNT_ID ||
    altEnv?.CLOUDFLARE_ACCOUNT_ID ||
    (typeof process !== 'undefined' ? process.env?.CLOUDFLARE_ACCOUNT_ID : '') ||
    ''
  ).trim();
  const cfToken = (
    runtimeEnv?.CLOUDFLARE_D1_API_TOKEN ||
    runtimeEnv?.CLOUDFLARE_API_TOKEN ||
    altEnv?.CLOUDFLARE_D1_API_TOKEN ||
    altEnv?.CLOUDFLARE_API_TOKEN ||
    (typeof process !== 'undefined' ? (process.env?.CLOUDFLARE_D1_API_TOKEN || process.env?.CLOUDFLARE_API_TOKEN) : '') ||
    ''
  ).trim();
  const cfDb = (
    runtimeEnv?.CLOUDFLARE_D1_DATABASE_ID ||
    runtimeEnv?.CLOUDFLARE_D1_DATABASE ||
    runtimeEnv?.CLOUDFLARE_DATABASE_ID ||
    altEnv?.CLOUDFLARE_D1_DATABASE_ID ||
    altEnv?.CLOUDFLARE_D1_DATABASE ||
    (typeof process !== 'undefined' ? (process.env?.CLOUDFLARE_D1_DATABASE_ID || process.env?.CLOUDFLARE_D1_DATABASE || process.env?.CLOUDFLARE_DATABASE_ID) : '') ||
    ''
  ).trim();

  if (cfAccount && cfToken && cfDb) {
    return createRemoteD1RestAdapter(cfAccount, cfToken, cfDb);
  }

  // 4. Local SQLite adapter for local dev / Node.js
  return createLocalD1Adapter();
}

const select = `SELECT a.*,c.name AS category_name,c.slug AS category_slug FROM articles a LEFT JOIN categories c ON a.category_id=c.id`;

// High-Performance In-Memory Query Cache with TTL to drastically lower D1 / Database reads
interface CacheEntry<T> {
  data: T;
  expires: number;
}
const queryCache = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): T | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    queryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
  queryCache.set(key, { data, expires: Date.now() + ttlMs });
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    queryCache.clear();
    return;
  }
  for (const k of queryCache.keys()) {
    if (k.startsWith(prefix)) {
      queryCache.delete(k);
    }
  }
}

let tablesChecked = false;
export async function ensureTablesExist(db: D1Database) {
  if (tablesChecked) return;
  try {
    await db.prepare("SELECT 1 FROM articles LIMIT 1").first();
    tablesChecked = true;
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('no such table')) {
      console.log('Initializing missing database tables in D1...');
      try {
        const statements = [
          `CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            icon TEXT DEFAULT 'newspaper',
            color TEXT DEFAULT '#008751',
            follower_count INTEGER DEFAULT 1250,
            display_order INTEGER DEFAULT 0
          )`,
          `CREATE TABLE IF NOT EXISTS sources (
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
          )`,
          `CREATE TABLE IF NOT EXISTS articles (
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
            author_name TEXT DEFAULT '9jaBeacon Editorial Team',
            author_role TEXT DEFAULT 'Editorial Contributor',
            author_avatar TEXT,
            is_top_story INTEGER DEFAULT 0,
            is_trending INTEGER DEFAULT 0,
            is_breaking INTEGER DEFAULT 0,
            views_count INTEGER DEFAULT 0,
            reading_time_minutes INTEGER DEFAULT 4,
            source_id TEXT,
            source_name TEXT,
            source_original_url TEXT,
            published_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            created_at TEXT DEFAULT (datetime('now')),
            status TEXT DEFAULT 'published'
          )`,
          `CREATE TABLE IF NOT EXISTS automation_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            description TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
          )`,
          `CREATE TABLE IF NOT EXISTS automation_logs (
            id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            source_id TEXT,
            message TEXT NOT NULL,
            status TEXT DEFAULT 'info',
            created_at TEXT DEFAULT (datetime('now'))
          )`,
          `CREATE TABLE IF NOT EXISTS article_reports (
            id TEXT PRIMARY KEY,
            article_id TEXT NOT NULL,
            article_title TEXT,
            article_slug TEXT,
            reason TEXT NOT NULL,
            details TEXT,
            reporter_email TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT (datetime('now'))
          )`,
          `CREATE TABLE IF NOT EXISTS rejected_articles (
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
          )`,
          `CREATE TABLE IF NOT EXISTS site_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
          )`
        ];

        for (const stmt of statements) {
          try {
            await db.prepare(stmt).run();
          } catch (stmtErr) {
            console.warn('Statement failed in D1 init:', stmtErr);
          }
        }

        // Seed default categories
        for (const cat of initialCategories) {
          await db.prepare(`INSERT OR IGNORE INTO categories (id, slug, name, description, icon, color, follower_count, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            cat.id, cat.slug, cat.name, cat.description, cat.icon, cat.color, cat.follower_count || 1250, cat.display_order || 0
          ).run().catch(() => {});
        }

        // Seed default sources
        for (const src of initialSources) {
          await db.prepare(`INSERT OR IGNORE INTO sources (id, name, feed_url, website_url, category_default_id, is_enabled, is_official, trust_score, license_notes, last_fetched_at, fetch_interval_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            src.id, src.name, src.feed_url, src.website_url, src.category_default_id, src.is_enabled ?? 1, src.is_official ?? 0, src.trust_score ?? 95, src.license_notes ?? '', src.last_fetched_at ?? null, src.fetch_interval_minutes ?? 30
          ).run().catch(() => {});
        }

        // Seed initial articles if empty
        for (const art of initialArticles) {
          await db.prepare(`INSERT OR IGNORE INTO articles (
            id, slug, title, summary, content, category_id, image_url, image_caption,
            image_credit, image_license, author_name, author_role, author_avatar,
            is_top_story, is_trending, is_breaking, views_count, reading_time_minutes,
            source_id, source_name, source_original_url, published_at, updated_at, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            art.id, art.slug, art.title, art.summary, art.content, art.category_id, art.image_url, art.image_caption,
            art.image_credit, art.image_license, art.author_name, art.author_role, art.author_avatar,
            art.is_top_story || 0, art.is_trending || 0, art.is_breaking || 0, art.views_count || 0, art.reading_time_minutes || 4,
            art.source_id, art.source_name, art.source_original_url, art.published_at || new Date().toISOString(), art.updated_at || new Date().toISOString(), art.status || 'published'
          ).run().catch(() => {});
        }

        tablesChecked = true;
      } catch (createErr) {
        console.warn('Could not auto-create missing tables in D1:', createErr);
      }
    }
  }
}

function formatArticle(art: any): Article {
  let catName = art.category_name;
  let catSlug = art.category_slug;
  if (!catName || catName === 'Money Hustle' || art.category_id === 'cat_money_hustle' || art.category_id === 'business') {
    if (art.category_id === 'cat_money_hustle' || art.category_id === 'business' || catSlug === 'business' || catSlug === 'money-hustle') {
      catName = 'Business';
      catSlug = 'business';
    } else if (art.category_id === 'cat_sports' || catSlug === 'sports') {
      catName = 'Sports';
      catSlug = 'sports';
    } else if (art.category_id === 'cat_world' || catSlug === 'world') {
      catName = 'World';
      catSlug = 'world';
    } else {
      catName = catName || 'Naija News';
      catSlug = catSlug || 'naija-news';
    }
  }
  return {
    ...art,
    views_count: art.views_count ?? 0,
    category_name: catName,
    category_slug: catSlug,
  };
}

export async function getArticles(
  db: D1Database,
  o: { categoryId?: string; categorySlug?: string; limit?: number; offset?: number; status?: string; isTopStory?: boolean; isTrending?: boolean; isBreaking?: boolean } = {}
): Promise<Article[]> {
  await ensureTablesExist(db);
  let q = `${select} WHERE (a.status=? OR a.status IS NULL)`;
  const v: unknown[] = [o.status || 'published'];
  if (o.categoryId) { q += ' AND a.category_id=?'; v.push(o.categoryId); }
  if (o.categorySlug) {
    if (o.categorySlug === 'business' || o.categorySlug === 'money-hustle') {
      q += " AND (c.slug='business' OR c.slug='money-hustle' OR a.category_id='cat_money_hustle' OR a.category_id='cat_business')";
    } else {
      q += ' AND c.slug=?';
      v.push(o.categorySlug);
    }
  }
  if (o.isTopStory !== undefined) { q += ' AND a.is_top_story=?'; v.push(o.isTopStory ? 1 : 0); }
  if (o.isTrending !== undefined) { q += ' AND a.is_trending=?'; v.push(o.isTrending ? 1 : 0); }
  if (o.isBreaking !== undefined) { q += ' AND a.is_breaking=?'; v.push(o.isBreaking ? 1 : 0); }
  q += ' ORDER BY a.published_at DESC LIMIT ? OFFSET ?';
  v.push(Math.min(Math.max(o.limit ?? 20, 1), 200), Math.max(o.offset ?? 0, 0));

  let results: Article[] = [];
  try {
    const res = await db.prepare(q).bind(...v).all<Article>();
    if (res?.results?.length) {
      results = res.results.map(formatArticle);
    }
  } catch (err) {
    console.warn('getArticles query warning:', err);
  }

  // Resilient fallback: direct query without join in case categories table is empty or had schema mismatch
  if (!results.length) {
    try {
      let directQ = "SELECT * FROM articles WHERE (status=? OR status IS NULL)";
      const directV: unknown[] = [o.status || 'published'];
      if (o.categoryId) { directQ += ' AND category_id=?'; directV.push(o.categoryId); }
      if (o.categorySlug) {
        if (o.categorySlug === 'business' || o.categorySlug === 'money-hustle') {
          directQ += " AND (category_id='cat_money_hustle' OR category_id='cat_business' OR category_id='business')";
        } else if (o.categorySlug === 'sports') {
          directQ += " AND (category_id='cat_sports' OR category_id='sports')";
        } else if (o.categorySlug === 'world') {
          directQ += " AND (category_id='cat_world' OR category_id='world')";
        } else {
          directQ += " AND (category_id='cat_naija_news' OR category_id='naija-news')";
        }
      }
      if (o.isTopStory !== undefined) { directQ += ' AND is_top_story=?'; directV.push(o.isTopStory ? 1 : 0); }
      if (o.isTrending !== undefined) { directQ += ' AND is_trending=?'; directV.push(o.isTrending ? 1 : 0); }
      if (o.isBreaking !== undefined) { directQ += ' AND is_breaking=?'; directV.push(o.isBreaking ? 1 : 0); }
      directQ += ' ORDER BY published_at DESC LIMIT ? OFFSET ?';
      directV.push(Math.min(Math.max(o.limit ?? 20, 1), 200), Math.max(o.offset ?? 0, 0));

      const directRes = await db.prepare(directQ).bind(...directV).all<Article>();
      if (directRes?.results?.length) {
        results = directRes.results.map(formatArticle);
      }
    } catch (directErr) {
      console.warn('getArticles direct query warning:', directErr);
    }
  }

  if (!results.length && (!o.status || o.status === 'published')) {
    let fallback = [...initialArticles] as Article[];
    if (o.categoryId) fallback = fallback.filter((a) => a.category_id === o.categoryId);
    if (o.categorySlug) {
      if (o.categorySlug === 'business' || o.categorySlug === 'money-hustle') {
        fallback = fallback.filter((a) => a.category_slug === 'business' || a.category_slug === 'money-hustle' || a.category_id === 'cat_money_hustle');
      } else {
        fallback = fallback.filter((a) => a.category_slug === o.categorySlug || a.category_id === o.categorySlug);
      }
    }
    if (o.isTopStory !== undefined) fallback = fallback.filter((a) => Boolean(a.is_top_story) === Boolean(o.isTopStory));
    if (o.isTrending !== undefined) fallback = fallback.filter((a) => Boolean(a.is_trending) === Boolean(o.isTrending));
    if (o.isBreaking !== undefined) fallback = fallback.filter((a) => Boolean(a.is_breaking) === Boolean(o.isBreaking));
    results = fallback.slice(o.offset || 0, (o.offset || 0) + (o.limit || 20)).map(formatArticle);
  }
  return results;
}

export async function getArticlesWithCount(
  db: D1Database,
  o: { categoryId?: string; search?: string; limit?: number; offset?: number; status?: string } = {}
): Promise<{ articles: Article[]; total: number }> {
  await ensureTablesExist(db);
  const limit = Math.min(Math.max(o.limit ?? 15, 1), 100);
  const offset = Math.max(o.offset ?? 0, 0);

  let whereClauses: string[] = ["(status=? OR status IS NULL)"];
  const params: unknown[] = [o.status || 'published'];

  if (o.categoryId) {
    whereClauses.push('category_id=?');
    params.push(o.categoryId);
  }

  if (o.search) {
    whereClauses.push('(title LIKE ? OR summary LIKE ? OR source_name LIKE ?)');
    const term = `%${o.search}%`;
    params.push(term, term, term);
  }

  const whereSql = whereClauses.join(' AND ');

  let total = 0;
  try {
    const countRes = await db.prepare(`SELECT COUNT(*) as count FROM articles WHERE ${whereSql}`).bind(...params).first<{ count: number }>();
    total = countRes?.count || 0;
  } catch (err) {
    console.warn('Count query warning:', err);
  }

  let articles: Article[] = [];
  try {
    const fetchParams = [...params, limit, offset];
    const res = await db.prepare(`SELECT * FROM articles WHERE ${whereSql} ORDER BY published_at DESC LIMIT ? OFFSET ?`).bind(...fetchParams).all<Article>();
    if (res?.results?.length) {
      articles = res.results.map(formatArticle);
    }
  } catch (err) {
    console.warn('Fetch articles query warning:', err);
  }

  if (articles.length === 0 && total === 0) {
    let fallback = [...initialArticles] as Article[];
    if (o.categoryId) fallback = fallback.filter(a => a.category_id === o.categoryId);
    if (o.search) {
      const s = o.search.toLowerCase();
      fallback = fallback.filter(a => a.title?.toLowerCase().includes(s) || a.summary?.toLowerCase().includes(s));
    }
    total = fallback.length;
    articles = fallback.slice(offset, offset + limit).map(formatArticle);
  }

  return { articles, total };
}

export async function searchArticles(db: D1Database, term: string, limit = 50) {
  const q = `${select} WHERE (a.status='published' OR a.status IS NULL) AND (a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ?) ORDER BY a.published_at DESC LIMIT ?`;
  const x = `%${term.replace(/[%_]/g, '\\$&')}%`;
  try {
    const res = await db.prepare(q).bind(x, x, x, Math.min(Math.max(limit, 1), 100)).all<Article>();
    if (res?.results?.length) {
      return res.results.map(formatArticle);
    }
    const directRes = await db.prepare("SELECT * FROM articles WHERE (status='published' OR status IS NULL) AND (title LIKE ? OR summary LIKE ? OR content LIKE ?) ORDER BY published_at DESC LIMIT ?").bind(x, x, x, Math.min(Math.max(limit, 1), 100)).all<Article>();
    if (directRes?.results?.length) {
      return directRes.results.map(formatArticle);
    }
  } catch {}
  const lower = term.toLowerCase();
  return (initialArticles as Article[]).filter((a) =>
    a.title.toLowerCase().includes(lower) || a.summary.toLowerCase().includes(lower)
  ).slice(0, limit).map(formatArticle);
}

export async function getArticleBySlug(db: D1Database, slug: string) {
  try {
    let row = await db.prepare(`${select} WHERE a.slug=? LIMIT 1`).bind(slug).first<Article>();
    if (!row) {
      row = await db.prepare("SELECT * FROM articles WHERE slug=? LIMIT 1").bind(slug).first<Article>();
    }
    if (row) {
      return formatArticle(row);
    }
  } catch (err) {
    console.warn('getArticleBySlug error:', err);
  }
  const fallback = (initialArticles as Article[]).find((a) => a.slug === slug);
  return fallback ? formatArticle(fallback) : null;
}

export async function getArticleById(db: D1Database, id: string) {
  try {
    let row = await db.prepare(`${select} WHERE a.id=? LIMIT 1`).bind(id).first<Article>();
    if (!row) {
      row = await db.prepare("SELECT * FROM articles WHERE id=? LIMIT 1").bind(id).first<Article>();
    }
    if (row) {
      return formatArticle(row);
    }
  } catch (err) {
    console.warn('getArticleById error:', err);
  }
  const fallback = (initialArticles as Article[]).find((a) => a.id === id);
  return fallback ? formatArticle(fallback) : null;
}

const recentViewIncrements = new Map<string, number>();
export async function incrementArticleView(db: D1Database, id: string) {
  const now = Date.now();
  const last = recentViewIncrements.get(id);
  // Debounce writes within 2 seconds for the exact same article ID per worker
  if (last && now - last < 2000) {
    return;
  }
  recentViewIncrements.set(id, now);
  try {
    await db.prepare('UPDATE articles SET views_count=COALESCE(views_count,0)+1 WHERE id=?').bind(id).run();
    invalidateCache('most_read');
  } catch {}
}

export async function getRelatedArticles(db: D1Database, id: string, categoryId: string, limit = 5) {
  try {
    const res = await db.prepare(`${select} WHERE (a.status='published' OR a.status IS NULL) AND a.id!=? AND a.category_id=? ORDER BY a.published_at DESC LIMIT ?`).bind(id, categoryId, limit).all<Article>();
    let list = (res?.results || []).map(formatArticle);
    if (list.length < limit) {
      const existingIds = [id, ...list.map((a) => a.id)];
      const placeholders = existingIds.map(() => '?').join(',');
      const more = await db.prepare(`${select} WHERE (a.status='published' OR a.status IS NULL) AND a.id NOT IN (${placeholders}) ORDER BY a.published_at DESC LIMIT ?`).bind(...existingIds, limit - list.length).all<Article>();
      if (more?.results?.length) {
        list = list.concat(more.results.map(formatArticle));
      }
    }
    if (list.length > 0) return list.slice(0, limit);
  } catch {}
  const filtered = (initialArticles as Article[]).filter((a) => a.id !== id && a.category_id === categoryId);
  const remaining = (initialArticles as Article[]).filter((a) => a.id !== id && a.category_id !== categoryId);
  return [...filtered, ...remaining].slice(0, limit).map(formatArticle);
}

export async function getTopStory(db: D1Database) {
  const cached = getCached<Article>('top_story');
  if (cached) return cached;

  await ensureTablesExist(db);
  let result: Article | null = null;
  try {
    // 1. First get the latest published article
    const latest = await db.prepare(`${select} WHERE (a.status='published' OR a.status IS NULL) ORDER BY a.published_at DESC LIMIT 1`).first<Article>();
    
    // 2. Check if there is an article explicitly flagged as top story
    const topRow = await db.prepare(`${select} WHERE (a.status='published' OR a.status IS NULL) AND a.is_top_story=1 ORDER BY a.published_at DESC LIMIT 1`).first<Article>();
    
    if (topRow && latest) {
      const topTime = new Date(topRow.published_at).getTime();
      const latestTime = new Date(latest.published_at).getTime();
      // If top story is fresh (within 24 hours of latest article), feature it
      if (latestTime - topTime < 24 * 60 * 60 * 1000) {
        result = formatArticle(topRow);
      } else {
        result = formatArticle(latest);
      }
    } else if (latest) {
      result = formatArticle(latest);
    } else if (topRow) {
      result = formatArticle(topRow);
    } else {
      // 3. Resilient direct query on articles table without join
      const directRow = await db.prepare("SELECT * FROM articles WHERE (status='published' OR status IS NULL) ORDER BY published_at DESC LIMIT 1").first<Article>();
      if (directRow) result = formatArticle(directRow);
    }
  } catch (err) {
    console.warn('getTopStory query error:', err);
  }
  if (!result) {
    const fallback = (initialArticles as Article[]).find((a) => a.is_top_story === 1) || (initialArticles as Article[])[0] || null;
    result = fallback ? formatArticle(fallback) : null;
  }
  if (result) {
    setCached('top_story', result, 45000); // 45s cache
  }
  return result;
}

export async function getMostReadArticles(db: D1Database, limit = 5) {
  const cacheKey = `most_read_${limit}`;
  const cached = getCached<Article[]>(cacheKey);
  if (cached) return cached;

  await ensureTablesExist(db);
  let list: Article[] = [];
  try {
    // Dynamic popularity score: actual views + real-time breaking/trending weighting + recency
    const res = await db.prepare(`
      ${select} 
      WHERE (a.status='published' OR a.status IS NULL) 
      ORDER BY (
        COALESCE(a.views_count, 0) + 
        (CASE WHEN a.is_breaking = 1 THEN 85 WHEN a.is_top_story = 1 THEN 65 WHEN a.is_trending = 1 THEN 50 ELSE 0 END)
      ) DESC, a.published_at DESC 
      LIMIT ?
    `).bind(limit).all<Article>();

    if (res?.results?.length) {
      list = res.results.map(formatArticle);
    } else {
      const directRes = await db.prepare(`
        SELECT * FROM articles 
        WHERE (status='published' OR status IS NULL) 
        ORDER BY (
          COALESCE(views_count, 0) + 
          (CASE WHEN is_breaking = 1 THEN 85 WHEN is_top_story = 1 THEN 65 WHEN is_trending = 1 THEN 50 ELSE 0 END)
        ) DESC, published_at DESC 
        LIMIT ?
      `).bind(limit).all<Article>();

      if (directRes?.results?.length) {
        list = directRes.results.map(formatArticle);
      }
    }
  } catch {}

  if (!list.length) {
    list = [...(initialArticles as Article[])]
      .sort((a, b) => {
        const scoreA = (a.views_count || 0) + (a.is_breaking ? 85 : 0) + (a.is_top_story ? 65 : 0) + (a.is_trending ? 50 : 0);
        const scoreB = (b.views_count || 0) + (b.is_breaking ? 85 : 0) + (b.is_top_story ? 65 : 0) + (b.is_trending ? 50 : 0);
        return scoreB - scoreA;
      })
      .slice(0, limit)
      .map(formatArticle);
  }

  setCached(cacheKey, list, 45000); // 45s cache to minimize D1 reads
  return list;
}

export async function getBreakingArticles(db: D1Database, limit = 3) {
  const cacheKey = `breaking_${limit}`;
  const cached = getCached<Article[]>(cacheKey);
  if (cached) return cached;

  await ensureTablesExist(db);
  let list: Article[] = [];
  try {
    const res = await db.prepare(`${select} WHERE (a.status='published' OR a.status IS NULL) AND a.is_breaking=1 ORDER BY a.published_at DESC LIMIT ?`).bind(limit).all<Article>();
    if (res?.results?.length) {
      list = res.results.map((art) => ({ ...formatArticle(art), category_name: 'Breaking News' }));
    } else {
      const latestRes = await db.prepare(`${select} WHERE (a.status='published' OR a.status IS NULL) ORDER BY a.published_at DESC LIMIT ?`).bind(limit).all<Article>();
      if (latestRes?.results?.length) {
        list = latestRes.results.map((art) => ({ ...formatArticle(art), category_name: 'Breaking News' }));
      } else {
        const directRes = await db.prepare("SELECT * FROM articles WHERE (status='published' OR status IS NULL) ORDER BY published_at DESC LIMIT ?").bind(limit).all<Article>();
        if (directRes?.results?.length) {
          list = directRes.results.map((art) => ({ ...formatArticle(art), category_name: 'Breaking News' }));
        }
      }
    }
  } catch {}

  setCached(cacheKey, list, 45000);
  return list;
}

export async function getCategories(db: D1Database) {
  const cached = getCached<Category[]>('categories');
  if (cached) return cached;

  try {
    const rows = await db.prepare('SELECT * FROM categories').all<any>();
    if (rows?.results?.length) {
      const res = rows.results.sort((a: any, b: any) => Number(a.display_order ?? a.sort_order ?? 0) - Number(b.display_order ?? b.sort_order ?? 0) || String(a.name).localeCompare(String(b.name))) as Category[];
      setCached('categories', res, 300000); // 5 min cache
      return res;
    }
  } catch {}
  setCached('categories', initialCategories, 300000);
  return initialCategories;
}

export async function getCategoryBySlug(db: D1Database, slug: string) {
  const searchSlugs = (slug === 'business' || slug === 'money-hustle') ? ['business', 'money-hustle'] : [slug];
  for (const s of searchSlugs) {
    try {
      const row = await db.prepare('SELECT * FROM categories WHERE slug=? LIMIT 1').bind(s).first<Category>();
      if (row) {
        if (s === 'money-hustle' || slug === 'business') {
          return { ...row, name: 'Business', slug: 'business' };
        }
        return row;
      }
    } catch {}
  }
  const found = initialCategories.find((c) => c.slug === slug || ((slug === 'business' || slug === 'money-hustle') && (c.slug === 'business' || c.slug === 'money-hustle')));
  if (found && (slug === 'business' || found.slug === 'money-hustle')) {
    return { ...found, name: 'Business', slug: 'business' };
  }
  return found ?? null;
}

export async function getSiteSettings(db: D1Database): Promise<Record<string, string>> {
  const cached = getCached<Record<string, string>>('site_settings');
  if (cached) return cached;

  const defaults: Record<string, string> = {
    site_name: '9jaBeacon',
    site_url: 'https://9jabeacon.name.ng',
    site_description: 'Fast, verified Nigerian news and useful updates.',
    social_facebook_url: 'https://facebook.com/9jabeacon',
    social_tiktok_url: 'https://tiktok.com/@9jabeacon',
    social_youtube_url: 'https://youtube.com/@9jabeacon',
    google_site_verification: 'googlecacc6ec6e0fdcf79',
  };
  try {
    const res = await db.prepare('SELECT key, value FROM site_settings').all<{ key: string; value: string }>();
    const r = res?.results || [];
    const custom = Object.fromEntries(r.map((x) => [x.key, x.value]));
    const finalSettings = { ...defaults, ...custom };
    setCached('site_settings', finalSettings, 300000); // 5 min cache
    return finalSettings;
  } catch {
    return defaults;
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
    views_count: Number(
      input.views_count !== undefined && input.views_count !== null && Number(input.views_count) > 0
        ? input.views_count
        : (85 + Math.floor(Math.random() * 55))
    ),
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
    invalidateCache();
  } catch (err: any) {
    console.warn('createArticle insert failed, retrying basic insert:', err.message);
    await db.prepare(`INSERT OR REPLACE INTO articles (id, slug, title, summary, content, category_id, image_url, published_at, status) VALUES (?,?,?,?,?,?,?,?,?)`).bind(
      f.id, f.slug, f.title, f.summary, f.content, f.category_id, f.image_url, f.published_at, f.status
    ).run().catch(() => {});
    invalidateCache();
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
  try {
    await db.prepare("INSERT INTO automation_settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k, v).run();
  } catch {
    await db.prepare("INSERT OR REPLACE INTO automation_settings(key, value) VALUES(?, ?)").bind(k, v).run().catch(() => {});
  }
}

export async function updateSiteSetting(db: D1Database, k: string, v: string) {
  try {
    await db.prepare("INSERT INTO site_settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k, v).run();
  } catch (err) {
    await db.prepare("INSERT OR REPLACE INTO site_settings(key, value) VALUES(?, ?)").bind(k, v).run().catch(() => {});
  }
  invalidateCache('site_settings');
}

const recentLoggedSessions = new Map<string, number>();
export async function logVisitorSession(db: D1Database, input: Record<string, unknown>) {
  const sessionKey = `${input.session_id}_${input.page_path}`;
  const now = Date.now();
  const lastTime = recentLoggedSessions.get(sessionKey);
  // Debounce writes: only log the same session + path once every 10 minutes to save D1 write limits
  if (lastTime && (now - lastTime) < 600000) {
    return;
  }
  recentLoggedSessions.set(sessionKey, now);
  if (recentLoggedSessions.size > 1000) {
    for (const [k, t] of recentLoggedSessions.entries()) {
      if (now - t > 600000) recentLoggedSessions.delete(k);
    }
  }

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

export async function getDatabaseDiagnostics(locals?: RuntimeLocals) {
  const runtimeEnv: any = (locals as any)?.runtime?.env || (typeof process !== 'undefined' ? process.env : {});
  const altEnv: any = (locals as any)?.env;
  
  const hasDirectBinding = Boolean(
    runtimeEnv?.DB || runtimeEnv?.naijablog || runtimeEnv?.D1 || runtimeEnv?.DATABASE ||
    altEnv?.DB || altEnv?.naijablog || (globalThis as any)?.DB
  );

  const cfAccount = Boolean(runtimeEnv?.CLOUDFLARE_ACCOUNT_ID || process.env?.CLOUDFLARE_ACCOUNT_ID);
  const cfToken = Boolean(runtimeEnv?.CLOUDFLARE_D1_API_TOKEN || runtimeEnv?.CLOUDFLARE_API_TOKEN || process.env?.CLOUDFLARE_D1_API_TOKEN || process.env?.CLOUDFLARE_API_TOKEN);
  const cfDb = Boolean(runtimeEnv?.CLOUDFLARE_D1_DATABASE_ID || runtimeEnv?.CLOUDFLARE_D1_DATABASE || runtimeEnv?.CLOUDFLARE_DATABASE_ID || process.env?.CLOUDFLARE_D1_DATABASE_ID);
  const hasRestApiSecrets = cfAccount && cfToken && cfDb;

  const db = getD1(locals);
  let mode: 'cloudflare_d1_binding' | 'cloudflare_d1_rest' | 'local_sqlite' = 'local_sqlite';
  if (hasDirectBinding) mode = 'cloudflare_d1_binding';
  else if (hasRestApiSecrets) mode = 'cloudflare_d1_rest';

  let articleCount = 0;
  let latestArticle: { id: string; title: string; published_at: string; source_name?: string } | null = null;
  let sourceCount = 0;
  let queryError: string | null = null;

  try {
    await ensureTablesExist(db);
    const c = await db.prepare("SELECT COUNT(*) as count FROM articles WHERE status='published' OR status IS NULL").first<{ count: number }>();
    articleCount = c?.count ?? 0;
    const latest = await db.prepare("SELECT id, title, published_at, source_name FROM articles WHERE status='published' OR status IS NULL ORDER BY published_at DESC LIMIT 1").first<any>();
    if (latest) latestArticle = latest;
    const s = await db.prepare("SELECT COUNT(*) as count FROM sources").first<{ count: number }>();
    sourceCount = s?.count ?? 0;
  } catch (err: any) {
    queryError = err?.message || String(err);
  }

  return {
    mode,
    hasDirectBinding,
    hasRestApiSecrets,
    articleCount,
    sourceCount,
    latestArticle,
    queryError,
    activeRuntime: typeof process !== 'undefined' && process.release?.name === 'node' ? 'Node.js / Local' : 'Cloudflare Workers / Pages',
  };
}
