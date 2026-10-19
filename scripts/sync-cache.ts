import { db } from '../src/lib/db';
import { executeD1Query } from '../src/lib/d1-sync';
import { initialCategories, initialSources, initialArticles } from '../src/lib/seed-data';

const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const apiToken = (process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '').trim();
const databaseId = (
  process.env.CLOUDFLARE_D1_DATABASE_ID ||
  process.env.CLOUDFLARE_D1_DATABASE ||
  process.env.CLOUDFLARE_DATABASE_ID ||
  ''
).trim();

/** Cap rows pulled from D1 so Actions don't burn the daily free quota. */
const MAX_ARTICLES_PULL = 40;
const MAX_LOGS_PULL = 20;

type Row = Record<string, unknown>;

async function fetchRows(sql: string, params: unknown[] = []): Promise<Row[]> {
  const result = await executeD1Query(sql, params, {
    accountId,
    apiToken,
    databaseNameOrId: databaseId,
  });
  if (!result.success) throw new Error(`D1 query failed: ${result.error}`);
  const first = Array.isArray(result.result) ? result.result[0] : result.result;
  return Array.isArray(first?.results) ? first.results : [];
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function normalizeRow(table: string, row: Row): Row {
  if (table !== 'categories') return row;
  const normalized = { ...row };
  if ('sort_order' in normalized && !('display_order' in normalized)) {
    normalized.display_order = normalized.sort_order;
    delete normalized.sort_order;
  }
  return normalized;
}

function syncTable(table: string, rows: Row[]) {
  db.prepare(`DELETE FROM ${quoteIdentifier(table)}`).run();
  if (!rows.length) return;

  const localCols = (
    db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as Array<{ name: string }>
  ).map((c) => c.name);
  const normalizedRows = rows.map((row) => normalizeRow(table, row));
  const rawCols = Object.keys(normalizedRows[0]);
  const columns = rawCols.filter((col) => localCols.includes(col));
  if (!columns.length) return;

  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${placeholders})`;
  const insert = db.prepare(sql);
  const transaction = db.transaction(() => {
    for (const row of normalizedRows) insert.run(columns.map((column) => row[column] ?? null));
  });
  transaction();
}

async function main() {
  if (!accountId || !apiToken || !databaseId) {
    throw new Error(
      'CLOUDFLARE_ACCOUNT_ID, Cloudflare API Token, and CLOUDFLARE_D1_DATABASE_ID are required.'
    );
  }

  console.log(`Syncing D1 (${databaseId}) → local cache (capped pulls)...`);

  let categories: Row[] = [];
  let sources: Row[] = [];
  let automationSettings: Row[] = [];
  let articles: Row[] = [];

  try {
    categories = await fetchRows('SELECT * FROM categories');
    console.log(`  categories: ${categories.length}`);
  } catch (e: any) {
    console.warn(`  categories skip: ${e.message}`);
  }

  try {
    sources = await fetchRows('SELECT * FROM sources');
    console.log(`  sources: ${sources.length}`);
  } catch (e: any) {
    console.warn(`  sources skip: ${e.message}`);
  }

  try {
    automationSettings = await fetchRows('SELECT * FROM automation_settings');
    console.log(`  automation_settings: ${automationSettings.length}`);
  } catch (e: any) {
    console.warn(`  automation_settings skip: ${e.message}`);
  }

  // CRITICAL: never SELECT * entire articles table — that alone can burn millions of rows_read
  try {
    articles = await fetchRows(
      `SELECT id, slug, title, summary, content, category_id, image_url, image_caption, image_credit,
              image_license, author_name, author_role, is_top_story, is_trending, is_breaking,
              views_count, reading_time_minutes, source_id, source_name, source_original_url,
              published_at, updated_at, created_at, status,
              syndicated_bluesky, syndicated_tumblr, syndicated_threads, syndicated_buffer
       FROM articles
       WHERE status = 'published' OR status IS NULL
       ORDER BY published_at DESC
       LIMIT ?`,
      [MAX_ARTICLES_PULL]
    );
    console.log(`  articles: ${articles.length} (capped at ${MAX_ARTICLES_PULL})`);
  } catch (e: any) {
    console.warn(`  articles skip: ${e.message}`);
  }

  if (!categories.length) {
    console.log('Seeding categories into D1...');
    for (const c of initialCategories) {
      await executeD1Query(
        `INSERT OR IGNORE INTO categories (id, slug, name, description, icon, color, follower_count, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.slug, c.name, c.description, c.icon, c.color, c.follower_count || 1250, c.display_order || 1],
        { accountId, apiToken, databaseNameOrId: databaseId }
      ).catch(() => {});
    }
    categories = await fetchRows('SELECT * FROM categories').catch(() => initialCategories as any);
  }

  if (!sources.length) {
    console.log('Seeding sources into D1...');
    for (const s of initialSources) {
      await executeD1Query(
        `INSERT OR IGNORE INTO sources (id, name, feed_url, website_url, category_default_id, is_enabled, is_official, trust_score, license_notes, fetch_interval_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.name,
          s.feed_url,
          s.website_url,
          s.category_default_id,
          s.is_enabled ?? 1,
          s.is_official ?? 0,
          s.trust_score ?? 95,
          s.license_notes ?? '',
          s.fetch_interval_minutes ?? 30,
        ],
        { accountId, apiToken, databaseNameOrId: databaseId }
      ).catch(() => {});
    }
    sources = await fetchRows('SELECT * FROM sources').catch(() => initialSources as any);
  }

  if (!articles.length) {
    console.log('Seeding baseline articles...');
    for (const a of initialArticles.slice(0, 10)) {
      await executeD1Query(
        `INSERT OR IGNORE INTO articles (
          id, slug, title, summary, content, category_id, image_url, image_caption,
          image_credit, image_license, author_name, author_role, author_avatar,
          is_top_story, is_trending, is_breaking, views_count, reading_time_minutes,
          source_id, source_name, source_original_url, published_at, updated_at, created_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.id,
          a.slug,
          a.title,
          a.summary,
          a.content,
          a.category_id,
          a.image_url,
          a.image_caption,
          a.image_credit,
          a.image_license,
          a.author_name,
          a.author_role,
          a.author_avatar,
          a.is_top_story ?? 0,
          a.is_trending ?? 0,
          a.is_breaking ?? 0,
          a.views_count ?? 150,
          a.reading_time_minutes ?? 4,
          a.source_id,
          a.source_name,
          a.source_original_url,
          a.published_at || new Date().toISOString(),
          a.updated_at || new Date().toISOString(),
          a.created_at || new Date().toISOString(),
          a.status || 'published',
        ],
        { accountId, apiToken, databaseNameOrId: databaseId }
      ).catch(() => {});
    }
    articles = await fetchRows(
      `SELECT * FROM articles ORDER BY published_at DESC LIMIT ?`,
      [MAX_ARTICLES_PULL]
    ).catch(() => initialArticles as any);
  }

  db.pragma('foreign_keys = OFF');
  try {
    syncTable('categories', categories);
    syncTable('sources', sources);
    syncTable('automation_settings', automationSettings);
    syncTable('articles', articles);
  } finally {
    db.pragma('foreign_keys = ON');
  }

  console.log('D1 snapshot loaded (capped). Local SQLite is build-only.');
  db.close();
}

main().catch((error) => {
  console.error('D1 → local sync failed:', error);
  process.exit(1);
});
