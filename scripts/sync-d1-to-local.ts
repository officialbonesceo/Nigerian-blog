import { db } from '../src/lib/db';
import { executeD1Query } from '../src/lib/d1-sync';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE || '';

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

  const normalizedRows = rows.map((row) => normalizeRow(table, row));
  const columns = Object.keys(normalizedRows[0]);
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
    throw new Error('CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN and CLOUDFLARE_D1_DATABASE_ID are required.');
  }

  console.log(`Syncing D1 (${databaseId}) → ephemeral local build database...`);
  const snapshots: Record<string, Row[]> = {};
  for (const table of TABLES) {
    snapshots[table] = await fetchRows(table);
    console.log(`  ${table}: ${snapshots[table].length} rows`);
  }

  if (!snapshots.categories.length) {
    throw new Error('D1 returned zero categories. Refusing to build from local seed data because D1 must remain the source of truth.');
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
