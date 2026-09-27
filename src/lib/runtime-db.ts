import type { D1Database } from '@cloudflare/workers-types';
import type { Article, Category, Source, AutomationSetting, AutomationLog, ArticleReport, RejectedArticle, ArticleComment } from './types';
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
export async function ensureTablesExist(db: D1Database, force = false) {
  if (tablesChecked && !force) return;
  if (!force) {
    try {
      await Promise.all([
        db.prepare("SELECT 1 FROM articles LIMIT 1").first(),
        db.prepare("SELECT 1 FROM custom_ads LIMIT 1").first(),
        db.prepare("SELECT 1 FROM advert_inquiries LIMIT 1").first(),
        db.prepare("SELECT 1 FROM visitor_analytics LIMIT 1").first(),
        db.prepare("SELECT 1 FROM article_comments LIMIT 1").first(),
      ]);
      tablesChecked = true;
      return;
    } catch {
      // One or more tables are missing; initialize tables in D1
    }
  }

  console.log('Ensuring all database tables exist in D1...');
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
      )`,
      `CREATE TABLE IF NOT EXISTS advert_inquiries (
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
      )`,
      `CREATE TABLE IF NOT EXISTS custom_ads (
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
      )`,
      `CREATE TABLE IF NOT EXISTS visitor_analytics (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        visit_date TEXT NOT NULL,
        page_path TEXT NOT NULL,
        user_agent TEXT,
        referrer TEXT,
        device_type TEXT DEFAULT 'mobile',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS article_comments (
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
      )`,
      `CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, published_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id, published_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug)`,
      `CREATE INDEX IF NOT EXISTS idx_comments_slug_created ON article_comments(article_slug, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_comments_parent ON article_comments(parent_id)`,
      `CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON automation_logs(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_visitor_date ON visitor_analytics(visit_date)`
    ];

    for (const stmt of statements) {
      try {
        await db.prepare(stmt).run();
      } catch (stmtErr) {
        console.warn('Statement warning in D1 init:', stmtErr);
      }
    }

    try { await db.prepare('ALTER TABLE article_comments ADD COLUMN parent_id TEXT DEFAULT NULL').run(); } catch {}
    try { await db.prepare('ALTER TABLE article_comments ADD COLUMN reply_to_user TEXT DEFAULT NULL').run(); } catch {}

    tablesChecked = true;

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

        // Auto-remediation migration: purge live stubs & reclassify Omokri (Fail-closed spec)
        try {
          await db.prepare(`
            UPDATE articles SET status = 'rejected'
            WHERE status = 'published'
              AND (
                slug LIKE '%safrica-silent-as-outrage-trails-killing-of-two-nigerians%'
                OR slug LIKE '%questions-mount-over-what-an-ai-slowdown-would-look-like%'
                OR content LIKE '%compiling further operational updates%'
                OR content LIKE '%Field dispatches and corroborating sources%'
                OR content LIKE '%While pacing AI development might sound like a quick fix%'
                OR (LENGTH(content) > 0 AND LENGTH(content) < 400)
              )
          `).run().catch(() => {});
        } catch {}

        try {
          await db.prepare(`
            UPDATE articles SET 
              category_id = 'cat_naija_news',
              author_name = '9jaBeacon National News Desk',
              author_role = 'Governance, Judiciary & Public Affairs Reporter',
              title = REPLACE(title, 'spoek', 'spoke'),
              summary = REPLACE(summary, 'spoek', 'spoke'),
              content = REPLACE(content, 'spoek', 'spoke')
            WHERE slug LIKE '%there-was-fbi-investigation-but-tinubu-not-involved-omokri%'
          `).run().catch(() => {});
        } catch {}

        try {
          await db.prepare(`
            UPDATE site_settings SET value = 'https://www.9jabeacon.name.ng'
            WHERE key = 'site_url' AND (value = 'https://9jabeacon.name.ng' OR value IS NULL OR value = '')
          `).run().catch(() => {});
        } catch {}

        tablesChecked = true;
      } catch (createErr) {
        console.warn('Could not auto-create missing tables in D1:', createErr);
      }
    }

export function isStubOrRejected(article: any): boolean {
  if (!article) return true;
  if (article.status === 'rejected') return true;
  const slug = (article.slug || '').toLowerCase();
  if (
    slug.includes('safrica-silent-as-outrage-trails-killing-of-two-nigerians') ||
    slug.includes('questions-mount-over-what-an-ai-slowdown-would-look-like')
  ) {
    return true;
  }
  const content = (article.content || '').toLowerCase();
  if (
    content.includes('compiling further operational updates') ||
    content.includes('field dispatches and corroborating sources') ||
    content.includes('while pacing ai development might sound like a quick fix')
  ) {
    return true;
  }
  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (plainText.length > 0 && plainText.length < 400) {
    return true;
  }
  return false;
}

function formatArticle(art: any): Article {
  let catName = art.category_name;
  let catSlug = art.category_slug;
  let title = art.title || '';
  let summary = art.summary || '';
  let content = art.content || '';
  let authorName = art.author_name;
  let authorRole = art.author_role;

  // Typo fix: "spoek" -> "spoke"
  if (title.includes('spoek') || title.includes('Spoek')) {
    title = title.replace(/\bspoek\b/g, 'spoke').replace(/\bSpoek\b/g, 'Spoke');
  }
  if (summary.includes('spoek') || summary.includes('Spoek')) {
    summary = summary.replace(/\bspoek\b/g, 'spoke').replace(/\bSpoek\b/g, 'Spoke');
  }
  if (content.includes('spoek') || content.includes('Spoek')) {
    content = content.replace(/\bspoek\b/g, 'spoke').replace(/\bSpoek\b/g, 'Spoke');
  }

  // Strip generic "Editorial Take" boilerplate (spec #6)
  if (content) {
    content = content
      .replace(/<div[^>]*class="[^"]*editorial-take[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<section[^>]*class="[^"]*editorial-take[^"]*"[^>]*>[\s\S]*?<\/section>/gi, '')
      .replace(/<h3>(?:9jaBeacon\s+)?Editorial Take<\/h3>[\s\S]*?(?=<h[23]|$)/gi, '')
      .replace(/<p>[^<]*As this development continues to unfold across Nigeria,?\s*key questions remain regarding regulatory oversight[^<]*<\/p>/gi, '')
      .replace(/As this development continues to unfold across Nigeria,?\s*key questions remain regarding regulatory oversight[^.\n<]*(\.|\n|<)/gi, '');
  }

  // Reclassify Omokri story to Naija News Desk (spec #3)
  const isOmokri = (art.slug && art.slug.includes('there-was-fbi-investigation-but-tinubu-not-involved-omokri'))
    || (title.toLowerCase().includes('tinubu') && title.toLowerCase().includes('omokri') && title.toLowerCase().includes('fbi'));

  if (isOmokri) {
    catName = 'Naija News';
    catSlug = 'naija-news';
    art.category_id = 'cat_naija_news';
    authorName = '9jaBeacon National News Desk';
    authorRole = 'Governance, Judiciary & Public Affairs Reporter';
  } else {
    // Sports category mis-tagging post-override (spec 26 Sep 2026)
    const isSportsCandidate = art.category_id === 'cat_sports' || art.category_id === 'sports' || catSlug === 'sports' || catName === 'Sports';
    if (isSportsCandidate) {
      const fullText = `${title} ${summary} ${content}`.toLowerCase();
      if (/olori|olu of|royal|royalty|monarch|palace|polygamy|icpc|minister|blockchain|lisk|steel investment|education minister|gym instructor|feminist|activist|divorce|adultery|traditional ruler|alausa/i.test(fullText)) {
        if (/blockchain|lisk|steel investment|crypto|invest|trade|export|firm|bank|equity|economy|fund|capital|dollar|naira|commercial/i.test(fullText)) {
          art.category_id = 'cat_money_hustle';
          catName = 'Business';
          catSlug = 'business';
          authorName = '9jaBeacon Financial Team';
          authorRole = 'Money & Business Desk';
        } else {
          art.category_id = 'cat_naija_news';
          catName = 'Naija News';
          catSlug = 'naija-news';
          authorName = '9jaBeacon National News Desk';
          authorRole = 'Governance, Culture & Public Affairs Reporter';
        }
      }
    }

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
  }

  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return {
    ...art,
    title,
    summary,
    content,
    author_name: authorName,
    author_role: authorRole,
    views_count: art.views_count ?? 0,
    reading_time_minutes: readingTime,
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
      results = res.results.filter((a) => !isStubOrRejected(a)).map(formatArticle);
      if (o.categorySlug) {
        const targetSlug = o.categorySlug === 'money-hustle' ? 'business' : o.categorySlug;
        results = results.filter((a) => a.category_slug === targetSlug || (targetSlug === 'naija-news' && a.category_slug === 'cat_naija_news'));
      }
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
        results = directRes.results.filter((a) => !isStubOrRejected(a)).map(formatArticle);
        if (o.categorySlug) {
          const targetSlug = o.categorySlug === 'money-hustle' ? 'business' : o.categorySlug;
          results = results.filter((a) => a.category_slug === targetSlug || (targetSlug === 'naija-news' && a.category_slug === 'cat_naija_news'));
        }
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
    results = fallback.filter((a) => !isStubOrRejected(a)).slice(o.offset || 0, (o.offset || 0) + (o.limit || 20)).map(formatArticle);
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
    fallback = fallback.filter((a) => !isStubOrRejected(a));
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
      return res.results.filter((a) => !isStubOrRejected(a)).map(formatArticle);
    }
    const directRes = await db.prepare("SELECT * FROM articles WHERE (status='published' OR status IS NULL) AND (title LIKE ? OR summary LIKE ? OR content LIKE ?) ORDER BY published_at DESC LIMIT ?").bind(x, x, x, Math.min(Math.max(limit, 1), 100)).all<Article>();
    if (directRes?.results?.length) {
      return directRes.results.filter((a) => !isStubOrRejected(a)).map(formatArticle);
    }
  } catch {}
  const lower = term.toLowerCase();
  return (initialArticles as Article[]).filter((a) =>
    !isStubOrRejected(a) && (a.title.toLowerCase().includes(lower) || a.summary.toLowerCase().includes(lower))
  ).slice(0, limit).map(formatArticle);
}

const LEGACY_SLUG_MAP: Record<string, string> = {
  'otu-nullifies-unauthorised-recruitment-into-c-8217-river-lg-commission': 'governor-otu-nullifies-unauthorised-recruitment-into-cross-river-lg-commission',
  'north-korea-leader-8217-s-daughter-believed-to-have-younger-sibling': 'north-korean-leaders-daughter-believed-to-have-younger-sibling',
  'north-korean-leader-8217-s-daughter-believed-to-have-younger-sibling-8211-seoul': 'north-korean-leaders-daughter-believed-to-have-younger-sibling',
  'one-d-es-as-building-collapses-during-demolition-in-lagos': 'one-dead-and-two-injured-as-building-collapses-during-demolition-in-lagos',
  'one-dead-two-injured-as-building-collapses-during-demolition-in-lagos': 'one-dead-and-two-injured-as-building-collapses-during-demolition-in-lagos',
  'trump-accused-of-bribery-after-saying-us-citizens-will-receive-5-000-if-republicans-win-midterms': 'trump-faces-ethics-scrutiny-over-5000-cash-promise-linked-to-midterms',
  'trump-says-every-adult-american-would-get-5-000-if-republicans-win-midterms': 'trump-proposes-5000-payment-for-adult-americans-if-republicans-win-midterms',
  'iran-war-won-t-end-until-after-crucial-november-elections-says-trump': 'trump-states-middle-east-conflicts-wont-end-until-after-november-elections',
  'keyamo-seeks-global-oem-partnerships-to-modernise-nigeria-s-aviation-infrastructure': 'keyamo-pursues-global-oem-partnerships-to-modernise-aviation-infrastructure',
  'mutfwang-moves-to-strengthen-plateau-s-state-police-framework': 'governor-mutfwang-moves-to-strengthen-plateau-state-police-framework',
  'see-the-50-innovators-getting-fg-s-n320m-idice-scheme': 'see-the-50-innovators-selected-for-fgs-n320m-idice-tech-grant',
  'techcabal-daily-mtn-scores-a-century': 'techcabal-daily-mtn-reaches-landmark-african-telecom-milestone',
  'iphone-duo-price-release-date-specs-and-features': 'iphone-duo-official-price-release-date-specs-and-features',
  'la-liga-rodri-apologises-after-criticism-over-valencia-remark': 'la-liga-rodri-apologises-after-intense-backlash-over-valencia-remark',
  'lagos-offers-police-officers-free-transport-for-3-months': 'lagos-state-offers-police-officers-free-public-transport-for-3-months',
  '24-die-many-hospitalised-after-consuming-herbal-drinks-in-ondo': '24-dead-several-hospitalised-after-consuming-herbal-mixture-in-ondo',
  'asuu-gives-sokoto-govt-ultimatum-over-unfulfilled-agreement-threatens-strike': 'asuu-issues-ultimatum-to-sokoto-state-government-threatens-strike',
  'nda-set-to-graduate-444-cadets-3-064-postgraduates': 'nigerian-defence-academy-set-to-graduate-444-cadets-and-postgraduates',
  'sokoto-police-warn-parties-against-2027-violence': 'sokoto-police-command-warns-political-parties-against-violence',
  'cbn-keeps-interest-rate-at-26-75-money-hustle': 'cbn-holds-interest-rate-at-26-75-as-naira-stabilizes-across-autonomous-windows',
  'global-green-energy-investment-surpasses-two-trillion-world-summit': 'global-clean-energy-investment-surpasses-2-trillion-at-historic-un-climate-summit',
  'nigerian-fintechs-cross-border-payment-volumes-hit-new-milestone': 'nigerian-fintechs-tap-cross-border-trade-as-instant-fx-settlement-surges-65',
  'nigerias-trade-surplus-hits-n6-3tn-in-q1': 'nigerias-trade-surplus-hits-6-3tn-in-q1-amid-surging-non-oil-agricultural-fertilizer-exports',
  'enrique-hails-dembele-praises-toure-after-psg-s-win-over-bratislava': 'enrique-hails-dembele-and-praises-toure-after-psg-win',
  'spurs-should-be-awarded-2016-17-title-pochettino': 'tottenham-should-have-been-awarded-2016-17-title-pochettino',
  'arsenal-are-passing-every-test-and-odegaard-is-in-form-of-his-life': 'arsenal-passing-every-test-as-odegaard-hits-outstanding-form',
};

export async function getArticleBySlug(db: D1Database, slug: string) {
  const targetSlug = LEGACY_SLUG_MAP[slug] || slug;
  // If slug is one of the purged stubs, reject immediately
  if (
    targetSlug.includes('safrica-silent-as-outrage-trails-killing-of-two-nigerians') ||
    targetSlug.includes('questions-mount-over-what-an-ai-slowdown-would-look-like')
  ) {
    return null;
  }

  try {
    let row = await db.prepare(`${select} WHERE a.slug=? LIMIT 1`).bind(targetSlug).first<Article>();
    if (!row) {
      row = await db.prepare("SELECT * FROM articles WHERE slug=? LIMIT 1").bind(targetSlug).first<Article>();
    }
    // Secondary fallback: check if targetSlug without trailing random suffix exists
    if (!row && /-([a-z0-9]{4,7})$/.test(targetSlug)) {
      const stripped = targetSlug.replace(/-([a-z0-9]{4,7})$/, '');
      row = await db.prepare(`${select} WHERE a.slug LIKE ? LIMIT 1`).bind(`${stripped}%`).first<Article>();
    }
    if (row) {
      if (isStubOrRejected(row)) {
        return null;
      }
      return formatArticle(row);
    }
  } catch (err) {
    console.warn('getArticleBySlug error:', err);
  }
  const fallback = (initialArticles as Article[]).find((a) => a.slug === targetSlug || a.slug === slug);
  if (fallback) {
    if (isStubOrRejected(fallback)) {
      return null;
    }
    return formatArticle(fallback);
  }
  return null;
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
    site_url: 'https://www.9jabeacon.name.ng',
    site_description: "Nigeria's independent digital newsroom. Delivering fast, verified breaking news, politics, economy, tech, and cultural updates.",
    social_facebook_url: 'https://facebook.com/9jabeacon',
    social_tiktok_url: 'https://tiktok.com/@9jabeacon',
    social_youtube_url: 'https://youtube.com/@9jabeacon',
    google_site_verification: 'googlecacc6ec6e0fdcf79',
    bing_site_verification: '',
    yandex_site_verification: '',
    pinterest_site_verification: '',
    baidu_site_verification: '',
    facebook_domain_verification: '',
    custom_head_tags: '',
    monetag_enabled: '0',
    monetag_in_article_zone: '',
    monetag_global_tag: '',
    monetag_ad_code: '',
    monetag_smartlink_url: '',
    monetag_verification: '',
    ads_enabled: '1',
    ad_banner_320x50_key: '68c3e01457bdbc56eeaf6737cd933b72',
    ad_banner_300x250_key: '6605a898998325cc0d10c2c5c77a29d8',
    ad_smartlink_url: 'https://www.profitableratecpmnetwork.com/ip0y1pan?key=406d5b2ea65353486dc2e9a7547d5ead',
    adsterra_enabled: '1',
    adsterra_script_url: 'https://www.highrevenueformat.com/68c3e01457bdbc56eeaf6737cd933b72/invoke.js',
    adsterra_container_id: 'container-68c3e01457bdbc56eeaf6737cd933b72',
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
    reading_time_minutes: Number(input.reading_time_minutes || 2),
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
  const result = (await db.prepare(`UPDATE articles SET ${s.join(',')} WHERE id=?`).bind(...v).run()).meta.changes > 0;
  if (result) {
    invalidateCache();
  }
  return result;
}

export async function deleteArticle(db: D1Database, id: string) {
  const result = (await db.prepare('DELETE FROM articles WHERE id=?').bind(id).run()).meta.changes > 0;
  if (result) {
    invalidateCache();
  }
  return result;
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

export interface AdvertInquiry {
  id: string;
  name: string;
  email: string;
  subject: string;
  company?: string | null;
  budget?: string | null;
  target_url?: string | null;
  message: string;
  status: 'pending' | 'active_ad' | 'replied' | 'archived';
  promoted_headline?: string | null;
  promoted_teaser?: string | null;
  promoted_link?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CustomAd {
  id: string;
  inquiry_id?: string | null;
  title: string;
  teaser?: string | null;
  target_url: string;
  format: string;
  is_active: number;
  impressions: number;
  clicks: number;
  created_at: string;
  updated_at?: string;
}

export async function getAdvertInquiries(db: D1Database): Promise<AdvertInquiry[]> {
  try {
    await ensureTablesExist(db);
    const res = await db.prepare('SELECT * FROM advert_inquiries ORDER BY created_at DESC').all<AdvertInquiry>();
    return res?.results || [];
  } catch (err) {
    console.error('getAdvertInquiries error:', err);
    return [];
  }
}

export async function createAdvertInquiry(
  db: D1Database,
  inquiry: {
    name: string;
    email: string;
    subject: string;
    company?: string | null;
    budget?: string | null;
    target_url?: string | null;
    message: string;
    promoted_headline?: string | null;
    promoted_teaser?: string | null;
    promoted_link?: string | null;
  }
): Promise<{ success: boolean; id: string; error?: string }> {
  try {
    await ensureTablesExist(db);
    const id = 'inq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO advert_inquiries (
        id, name, email, subject, company, budget, target_url, message,
        status, promoted_headline, promoted_teaser, promoted_link, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `).bind(
      id,
      inquiry.name,
      inquiry.email,
      inquiry.subject,
      inquiry.company || null,
      inquiry.budget || null,
      inquiry.target_url || null,
      inquiry.message,
      inquiry.promoted_headline || null,
      inquiry.promoted_teaser || null,
      inquiry.promoted_link || inquiry.target_url || null,
      now,
      now
    ).run();

    await addAutomationLog(
      db,
      'ADVERT_INQUIRY_RECEIVED',
      null,
      `New advertiser inquiry received from ${inquiry.name} (${inquiry.company || 'Direct'}): "${inquiry.subject}"`,
      'info'
    ).catch(() => {});

    return { success: true, id };
  } catch (err: any) {
    console.error('createAdvertInquiry error:', err);
    return { success: false, id: '', error: err?.message || String(err) };
  }
}

export async function updateAdvertInquiry(
  db: D1Database,
  id: string,
  updates: Partial<AdvertInquiry>
): Promise<boolean> {
  try {
    await ensureTablesExist(db);
    const sets: string[] = ["updated_at = datetime('now')"];
    const params: any[] = [];
    if (updates.status !== undefined) {
      sets.push('status = ?');
      params.push(updates.status);
    }
    if (updates.promoted_headline !== undefined) {
      sets.push('promoted_headline = ?');
      params.push(updates.promoted_headline);
    }
    if (updates.promoted_teaser !== undefined) {
      sets.push('promoted_teaser = ?');
      params.push(updates.promoted_teaser);
    }
    if (updates.promoted_link !== undefined) {
      sets.push('promoted_link = ?');
      params.push(updates.promoted_link);
    }
    params.push(id);
    await db.prepare(`UPDATE advert_inquiries SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();
    return true;
  } catch (err) {
    console.error('updateAdvertInquiry error:', err);
    return false;
  }
}

export async function deleteAdvertInquiry(db: D1Database, id: string): Promise<boolean> {
  try {
    await ensureTablesExist(db);
    await db.prepare('DELETE FROM advert_inquiries WHERE id = ?').bind(id).run();
    await db.prepare('DELETE FROM custom_ads WHERE inquiry_id = ?').bind(id).run();
    return true;
  } catch (err) {
    console.error('deleteAdvertInquiry error:', err);
    return false;
  }
}

export async function getCustomAds(db: D1Database, onlyActive = false): Promise<CustomAd[]> {
  const cacheKey = `custom_ads_${onlyActive ? 'active' : 'all'}`;
  const cached = getCached<CustomAd[]>(cacheKey);
  if (cached) return cached;

  try {
    await ensureTablesExist(db);
    const sql = onlyActive
      ? 'SELECT * FROM custom_ads WHERE is_active = 1 ORDER BY created_at DESC'
      : 'SELECT * FROM custom_ads ORDER BY created_at DESC';
    const res = await db.prepare(sql).all<CustomAd>();
    const ads = res?.results || [];
    setCached(cacheKey, ads, 60_000);
    return ads;
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('no such table')) {
      console.warn('custom_ads table missing on query, initializing tables...');
      try {
        await ensureTablesExist(db, true);
        const sql = onlyActive
          ? 'SELECT * FROM custom_ads WHERE is_active = 1 ORDER BY created_at DESC'
          : 'SELECT * FROM custom_ads ORDER BY created_at DESC';
        const res = await db.prepare(sql).all<CustomAd>();
        const ads = res?.results || [];
        setCached(cacheKey, ads, 60_000);
        return ads;
      } catch (retryErr) {
        console.error('getCustomAds retry error:', retryErr);
      }
    } else {
      console.error('getCustomAds error:', err);
    }
    return [];
  }
}

export async function createCustomAd(
  db: D1Database,
  ad: {
    inquiry_id?: string | null;
    title: string;
    teaser?: string | null;
    target_url: string;
    format?: string;
  }
): Promise<{ success: boolean; id: string; error?: string }> {
  try {
    await ensureTablesExist(db);
    const id = 'ad_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO custom_ads (id, inquiry_id, title, teaser, target_url, format, is_active, impressions, clicks, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?)
    `).bind(
      id,
      ad.inquiry_id || null,
      ad.title,
      ad.teaser || '',
      ad.target_url,
      ad.format || 'spotlight',
      now,
      now
    ).run();

    if (ad.inquiry_id) {
      await updateAdvertInquiry(db, ad.inquiry_id, {
        status: 'active_ad',
        promoted_headline: ad.title,
        promoted_teaser: ad.teaser,
        promoted_link: ad.target_url,
      });
    }

    invalidateCache('custom_ads');
    return { success: true, id };
  } catch (err: any) {
    console.error('createCustomAd error:', err);
    return { success: false, id: '', error: err?.message || String(err) };
  }
}

export async function toggleCustomAd(db: D1Database, id: string, isActive: boolean): Promise<boolean> {
  try {
    await ensureTablesExist(db);
    await db.prepare("UPDATE custom_ads SET is_active = ?, updated_at = datetime('now') WHERE id = ?").bind(isActive ? 1 : 0, id).run();
    invalidateCache('custom_ads');
    return true;
  } catch (err) {
    console.error('toggleCustomAd error:', err);
    return false;
  }
}

export async function deleteCustomAd(db: D1Database, id: string): Promise<boolean> {
  try {
    await ensureTablesExist(db);
    await db.prepare('DELETE FROM custom_ads WHERE id = ?').bind(id).run();
    invalidateCache('custom_ads');
    return true;
  } catch (err) {
    console.error('deleteCustomAd error:', err);
    return false;
  }
}

/**
 * Comments Database Layer: Retrieves reader comments from local SQLite / Cloudflare D1
 */
export async function getArticleComments(db: D1Database, articleSlug: string): Promise<ArticleComment[]> {
  try {
    await ensureTablesExist(db);
    const { results } = await db
      .prepare('SELECT * FROM article_comments WHERE article_slug = ? AND status = "published" ORDER BY created_at ASC LIMIT 300')
      .bind(articleSlug)
      .all<ArticleComment>();
    return (results || []).map((row: any) => ({
      id: row.id,
      article_slug: row.article_slug,
      article_title: row.article_title || '',
      parent_id: row.parent_id || null,
      reply_to_user: row.reply_to_user || null,
      user_name: row.user_name,
      sentiment: row.sentiment || 'perspective',
      content: row.content,
      likes_count: Number(row.likes_count) || 0,
      created_at: row.created_at,
      status: row.status || 'published',
      replies: []
    }));
  } catch (err) {
    console.error('getArticleComments error:', err);
    return [];
  }
}

/**
 * Persists a new comment into SQLite / Cloudflare D1 (migration ready)
 */
export async function createArticleComment(
  db: D1Database,
  data: {
    id?: string;
    article_slug: string;
    article_title?: string;
    parent_id?: string | null;
    reply_to_user?: string | null;
    user_name: string;
    sentiment?: string;
    content: string;
  }
): Promise<{ success: boolean; comment?: ArticleComment; error?: string }> {
  try {
    await ensureTablesExist(db);
    const id = data.id || ('cmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
    const cleanName = (data.user_name || 'Verified Reader').trim().slice(0, 60);
    const cleanContent = (data.content || '').trim().slice(0, 1500);
    const sentiment = ['agree', 'disagree', 'neutral', 'perspective'].includes(data.sentiment || '')
      ? data.sentiment
      : 'perspective';

    if (cleanName.length < 2) {
      return { success: false, error: 'Name must be at least 2 characters.' };
    }
    if (cleanContent.length < 3) {
      return { success: false, error: 'Perspective commentary must be at least 3 characters.' };
    }

    const createdAt = new Date().toISOString();
    const parentId = data.parent_id || null;
    const replyToUser = data.reply_to_user ? data.reply_to_user.slice(0, 60) : null;

    await db.prepare(`
      INSERT INTO article_comments (
        id, article_slug, article_title, parent_id, reply_to_user, user_name, sentiment, content, likes_count, created_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'published')
    `).bind(
      id,
      data.article_slug,
      data.article_title || '',
      parentId,
      replyToUser,
      cleanName,
      sentiment,
      cleanContent,
      createdAt
    ).run();

    const newComment: ArticleComment = {
      id,
      article_slug: data.article_slug,
      article_title: data.article_title || '',
      parent_id: parentId,
      reply_to_user: replyToUser,
      user_name: cleanName,
      sentiment: sentiment as any,
      content: cleanContent,
      likes_count: 0,
      created_at: createdAt,
      status: 'published',
      replies: []
    };

    return { success: true, comment: newComment };
  } catch (err: any) {
    console.error('createArticleComment error:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Upvotes a comment in SQLite / Cloudflare D1
 */
export async function likeArticleComment(db: D1Database, commentId: string): Promise<boolean> {
  try {
    await ensureTablesExist(db);
    await db.prepare('UPDATE article_comments SET likes_count = likes_count + 1 WHERE id = ?').bind(commentId).run();
    return true;
  } catch (err) {
    console.error('likeArticleComment error:', err);
    return false;
  }
}

