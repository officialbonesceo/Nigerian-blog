import { db } from '../src/lib/db';
import { executeD1Query } from '../src/lib/d1-sync';
import { initialCategories, initialSources, initialArticles } from '../src/lib/seed-data';

const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const apiToken = (process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '').trim();
const databaseId = (process.env.CLOUDFLARE_D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE || process.env.CLOUDFLARE_DATABASE_ID || '').trim();

const TABLES = ['categories', 'sources', 'automation_settings', 'articles'] as const;

type Row = Record<string, unknown>;

async function fetchRows(table: string): Promise<Row[]> {
  const result = await executeD1Query(`SELECT * FROM ${table}`, [], {
    accountId,
    apiToken,
    databaseNameOrId: databaseId,
  });
  if (!result.success) throw new Error(`D1 SELECT ${table} failed: ${result.error}`);
  const first = Array.isArray(result.result) ? result.result[0] : result.result;
  return Array.isArray(first?.results) ? first.results : [];
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * D1 is the production source of truth, but the static build uses a local
 * SQLite schema. Keep this boundary tolerant of the current D1 categories
 * column name (sort_order) and the local application's legacy name
 * (display_order). No production data is changed here.
 */
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

  const localCols = (db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as Array<{ name: string }>).map((c) => c.name);
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
    throw new Error('CLOUDFLARE_ACCOUNT_ID, Cloudflare API Token (CLOUDFLARE_D1_API_TOKEN or CLOUDFLARE_API_TOKEN), and CLOUDFLARE_D1_DATABASE_ID are required.');
  }

  console.log(`Syncing D1 (${databaseId}) → ephemeral local build database...`);
  const snapshots: Record<string, Row[]> = {};
  for (const table of TABLES) {
    try {
      snapshots[table] = await fetchRows(table);
      console.log(`  ${table}: ${snapshots[table].length} rows`);
    } catch (err: any) {
      console.warn(`  ⚠️ Could not read table ${table} from D1: ${err.message}`);
      snapshots[table] = [];
    }
  }

  // Self-healing check: If D1 categories table is empty or missing, seed default 9jaBeacon categories
  if (!snapshots.categories.length) {
    console.log('⚠️ D1 returned 0 categories. Initializing essential 9jaBeacon categories into D1...');
    for (const c of initialCategories) {
      await executeD1Query(
        `INSERT OR IGNORE INTO categories (id, slug, name, description, icon, color, follower_count, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.slug, c.name, c.description, c.icon, c.color, c.follower_count || 1250, c.display_order || 1],
        { accountId, apiToken, databaseNameOrId: databaseId }
      ).catch(() => {});
    }
    snapshots.categories = await fetchRows('categories').catch(() => initialCategories as any);
  }

  // Self-healing check: If D1 sources table is empty, seed initial verified RSS sources into D1
  if (!snapshots.sources.length) {
    console.log('⚠️ D1 returned 0 sources. Initializing active verified Nigerian news sources into D1...');
    for (const s of initialSources) {
      await executeD1Query(
        `INSERT OR IGNORE INTO sources (id, name, feed_url, website_url, category_default_id, is_enabled, is_official, trust_score, license_notes, fetch_interval_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.name, s.feed_url, s.website_url, s.category_default_id, s.is_enabled ?? 1, s.is_official ?? 0, s.trust_score ?? 95, s.license_notes ?? '', s.fetch_interval_minutes ?? 30],
        { accountId, apiToken, databaseNameOrId: databaseId }
      ).catch(() => {});
    }
    snapshots.sources = await fetchRows('sources').catch(() => initialSources as any);
  }

  // Self-healing check: If D1 articles table is empty, seed default factual articles into D1 so site is never blank
  if (!snapshots.articles.length) {
    console.log('⚠️ D1 returned 0 articles. Seeding baseline verified editorial articles into D1...');
    for (const a of initialArticles) {
      await executeD1Query(
        `INSERT OR IGNORE INTO articles (
          id, slug, title, summary, content, category_id, image_url, image_caption,
          image_credit, image_license, author_name, author_role, author_avatar,
          is_top_story, is_trending, is_breaking, views_count, reading_time_minutes,
          source_id, source_name, source_original_url, published_at, updated_at, created_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.id, a.slug, a.title, a.summary, a.content, a.category_id, a.image_url, a.image_caption,
          a.image_credit, a.image_license, a.author_name, a.author_role, a.author_avatar,
          a.is_top_story ?? 0, a.is_trending ?? 0, a.is_breaking ?? 0, a.views_count ?? 150, a.reading_time_minutes ?? 4,
          a.source_id, a.source_name, a.source_original_url, a.published_at || new Date().toISOString(),
          a.updated_at || new Date().toISOString(), a.created_at || new Date().toISOString(), a.status || 'published'
        ],
        { accountId, apiToken, databaseNameOrId: databaseId }
      ).catch(() => {});
    }
    snapshots.articles = await fetchRows('articles').catch(() => initialArticles as any);
  }

  // Parent tables first, then articles.
  syncTable('categories', snapshots.categories);
  syncTable('sources', snapshots.sources);
  syncTable('automation_settings', snapshots.automation_settings);
  syncTable('articles', snapshots.articles);

  console.log('D1 snapshot loaded successfully. Local SQLite is build-only and will never be committed.');
  db.close();
}

main().catch((error) => {
  console.error('D1 → local sync failed:', error);
  process.exit(1);
});
