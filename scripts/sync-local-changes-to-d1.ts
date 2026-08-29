import { db } from '../src/lib/db';
import { executeD1Query } from '../src/lib/d1-sync';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE || '';
const LOOKBACK_HOURS = 24;

type Row = Record<string, unknown>;

type D1ResultRow = Record<string, unknown>;

async function run(sql: string, params: unknown[] = []) {
  const result = await executeD1Query(sql, params, {
    accountId,
    apiToken,
    databaseNameOrId: databaseId,
  });
  if (!result.success) throw new Error(result.error || 'D1 query failed');
  return result.result;
}

function value(row: Row, key: string) {
  return row[key] ?? null;
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function tableColumns(table: string): Promise<Set<string>> {
  const result = await run(`PRAGMA table_info(${quoteIdentifier(table)})`);
  const first = Array.isArray(result) ? result[0] : result;
  const rows = Array.isArray(first?.results) ? first.results as D1ResultRow[] : [];
  return new Set(rows.map((row) => String(row.name)));
}

async function tableExists(table: string): Promise<boolean> {
  const result = await run(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
    [table],
  );
  const first = Array.isArray(result) ? result[0] : result;
  return Array.isArray(first?.results) && first.results.length > 0;
}

/**
 * D1 is the production source of truth. The local SQLite database is only a
 * temporary ingestion cache. D1 schemas have changed over time (for example,
 * some deployments do not have articles.created_at), so never assume the
 * local schema is identical to the remote schema. We only send columns that
 * actually exist in D1.
 */
async function insertMissing(table: string, preferredColumns: string[], rows: Row[]) {
  if (!rows.length) return 0;
  if (!(await tableExists(table))) {
    console.log(`☁️ D1 table ${table} does not exist; skipping optional write.`);
    return 0;
  }

  const remoteColumns = await tableColumns(table);
  const columns = preferredColumns.filter((column) => remoteColumns.has(column));
  if (!columns.includes('id')) {
    throw new Error(`D1 table ${table} does not expose the required id column.`);
  }

  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT OR IGNORE INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${placeholders})`;
  let inserted = 0;

  for (const row of rows) {
    const params = columns.map((column) => value(row, column));
    const result = await executeD1Query(sql, params, {
      accountId,
      apiToken,
      databaseNameOrId: databaseId,
    });
    if (!result.success) throw new Error(`D1 insert into ${table} failed: ${result.error}`);
    inserted++;
  }
  return inserted;
}

async function getRemoteSourceIds(): Promise<Set<string>> {
  if (!(await tableExists('sources'))) return new Set();
  const result = await run('SELECT id FROM sources');
  const first = Array.isArray(result) ? result[0] : result;
  const rows = Array.isArray(first?.results) ? first.results as D1ResultRow[] : [];
  return new Set(rows.map((row) => String(row.id)));
}

async function main() {
  if (!accountId || !apiToken || !databaseId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN and CLOUDFLARE_D1_DATABASE_ID are required.');
  }

  // The ingestion engine uses SQLite for its Node.js runtime. This is the
  // controlled write-through boundary: only recent rows are sent to D1.
  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  const articles = db.prepare('SELECT * FROM articles WHERE created_at >= ? ORDER BY created_at ASC').all(cutoff) as Row[];
  const rejections = db.prepare('SELECT * FROM rejected_articles WHERE created_at >= ? ORDER BY created_at ASC').all(cutoff) as Row[];
  const logs = db.prepare('SELECT * FROM automation_logs WHERE created_at >= ? ORDER BY created_at ASC').all(cutoff) as Row[];
  const sources = db.prepare('SELECT id, last_fetched_at FROM sources WHERE last_fetched_at >= ?').all(cutoff) as Row[];

  console.log(`☁️ D1 write-through: ${articles.length} recent articles, ${rejections.length} rejections, ${logs.length} logs, ${sources.length} source timestamps.`);

  await run('SELECT 1');

  // D1 currently has a smaller source set than the historical local seed list.
  // Preserve the article even when its old source row is absent by nulling the
  // optional source_id; source_name/source_original_url still retain attribution.
  const remoteSourceIds = await getRemoteSourceIds();
  const articleRows = articles.map((row) => {
    if (row.source_id && remoteSourceIds.size && !remoteSourceIds.has(String(row.source_id))) {
      return { ...row, source_id: null };
    }
    return row;
  });

  const articleColumns = [
    'id','slug','title','summary','content','category_id','image_url','image_caption',
    'image_credit','image_license','author_name','author_role','author_avatar',
    'is_top_story','is_trending','is_breaking','views_count','reading_time_minutes',
    'source_id','source_name','source_original_url','published_at','updated_at','created_at','status'
  ];
  const rejectionColumns = [
    'id','source_id','source_name','original_title','original_url','raw_content',
    'rejection_reason','ai_tier_failures','status','created_at'
  ];
  const logColumns = ['id','event_type','source_id','message','level','created_at'];

  const articleCount = await insertMissing('articles', articleColumns, articleRows);
  const rejectionCount = await insertMissing('rejected_articles', rejectionColumns, rejections);
  const logCount = await insertMissing('automation_logs', logColumns, logs);

  if (await tableExists('sources')) {
    const sourceColumns = await tableColumns('sources');
    if (sourceColumns.has('last_fetched_at') && sourceColumns.has('id')) {
      for (const source of sources) {
        await run('UPDATE sources SET last_fetched_at = ? WHERE id = ?', [value(source, 'last_fetched_at'), value(source, 'id')]);
      }
    }
  }

  console.log(`✅ D1 write-through complete: ${articleCount} article rows checked, ${rejectionCount} rejection rows checked, ${logCount} log rows checked.`);
  db.close();
}

main().catch((error) => {
  console.error('❌ Local → D1 sync failed:', error);
  try { db.close(); } catch {}
  process.exit(1);
});
