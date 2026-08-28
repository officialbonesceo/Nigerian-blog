import { db } from '../src/lib/db';
import { executeD1Query } from '../src/lib/d1-sync';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE || '';
const LOOKBACK_HOURS = 24;

type Row = Record<string, unknown>;

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

async function insertMissing(table: string, columns: string[], rows: Row[]) {
  if (!rows.length) return 0;
  let inserted = 0;
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  for (const row of rows) {
    const result = await executeD1Query(sql, columns.map((column) => value(row, column)), {
      accountId,
      apiToken,
      databaseNameOrId: databaseId,
    });
    if (!result.success) throw new Error(`D1 insert into ${table} failed: ${result.error}`);
    inserted++;
  }
  return inserted;
}

async function main() {
  if (!accountId || !apiToken || !databaseId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN and CLOUDFLARE_D1_DATABASE_ID are required.');
  }

  // The ingestion engine currently uses SQLite for its Node.js runtime. This
  // step is the controlled write-through boundary: only rows created/changed
  // during the current automation window are sent to D1. D1 remains canonical.
  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  const articles = db.prepare('SELECT * FROM articles WHERE created_at >= ? ORDER BY created_at ASC').all(cutoff) as Row[];
  const rejections = db.prepare('SELECT * FROM rejected_articles WHERE created_at >= ? ORDER BY created_at ASC').all(cutoff) as Row[];
  const logs = db.prepare('SELECT * FROM automation_logs WHERE created_at >= ? ORDER BY created_at ASC').all(cutoff) as Row[];
  const sources = db.prepare('SELECT id, last_fetched_at FROM sources WHERE last_fetched_at >= ?').all(cutoff) as Row[];

  console.log(`☁️ D1 write-through: ${articles.length} recent articles, ${rejections.length} rejections, ${logs.length} logs, ${sources.length} source timestamps.`);

  await run('SELECT 1');

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

  const articleCount = await insertMissing('articles', articleColumns, articles);
  const rejectionCount = await insertMissing('rejected_articles', rejectionColumns, rejections);
  const logCount = await insertMissing('automation_logs', logColumns, logs);

  for (const source of sources) {
    await run('UPDATE sources SET last_fetched_at = ? WHERE id = ?', [value(source, 'last_fetched_at'), value(source, 'id')]);
  }

  console.log(`✅ D1 write-through complete: ${articleCount} article rows checked, ${rejectionCount} rejection rows checked, ${logCount} log rows checked.`);
  db.close();
}

main().catch((error) => {
  console.error('❌ Local → D1 sync failed:', error);
  try { db.close(); } catch {}
  process.exit(1);
});
