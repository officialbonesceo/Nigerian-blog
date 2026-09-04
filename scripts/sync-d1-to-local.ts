import { db } from '../src/lib/db';
import { executeD1Query } from '../src/lib/d1-sync';

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
    const defaultCategories = [
      { id: 'cat_naija_news', slug: 'naija-news', name: 'Naija News', description: 'National news, politics, governance & security across Nigeria', icon: 'newspaper', color: '#008751', display_order: 1 },
      { id: 'cat_money_hustle', slug: 'money-hustle', name: 'Money & Hustle', description: 'Business, economy, naira, CBN policy, inflation & wealth creation', icon: 'trending-up', color: '#B45309', display_order: 2 },
      { id: 'cat_sports', slug: 'sports-arena', name: 'Sports Arena', description: 'Football, Super Eagles, Premier League & global sports updates', icon: 'trophy', color: '#047857', display_order: 3 },
      { id: 'cat_world', slug: 'world-diaspora', name: 'World & Diaspora', description: 'International diplomacy, global economy and Africans worldwide', icon: 'globe', color: '#1D4ED8', display_order: 4 },
    ];
    for (const c of defaultCategories) {
      await executeD1Query(
        `INSERT OR IGNORE INTO categories (id, slug, name, description, icon, color, follower_count, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.slug, c.name, c.description, c.icon, c.color, 1250, c.display_order],
        { accountId, apiToken, databaseNameOrId: databaseId }
      ).catch(() => {});
    }
    snapshots.categories = await fetchRows('categories').catch(() => defaultCategories as any);
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
