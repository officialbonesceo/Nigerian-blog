import { db } from '../src/lib/db';
import { executeD1Query } from '../src/lib/d1-sync';

const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const apiToken = (process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '').trim();
const databaseId = (process.env.CLOUDFLARE_D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE || process.env.CLOUDFLARE_DATABASE_ID || '').trim();

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
    throw new Error('CLOUDFLARE_ACCOUNT_ID, Cloudflare API Token (CLOUDFLARE_D1_API_TOKEN or CLOUDFLARE_API_TOKEN), and CLOUDFLARE_D1_DATABASE_ID are required.');
  }

  // Query all local articles. Using INSERT OR IGNORE guarantees that existing
  // articles are preserved while all new synthesized articles are reliably inserted.
  const articles = db.prepare('SELECT * FROM articles ORDER BY published_at DESC').all() as Row[];
  const rejections = db.prepare('SELECT * FROM rejected_articles ORDER BY created_at DESC LIMIT 50').all() as Row[];
  const logs = db.prepare('SELECT * FROM automation_logs ORDER BY created_at DESC LIMIT 50').all() as Row[];
  const sources = db.prepare('SELECT id, last_fetched_at FROM sources WHERE last_fetched_at IS NOT NULL').all() as Row[];

  console.log(`☁️ D1 write-through: ${articles.length} local articles, ${rejections.length} rejections, ${logs.length} logs, ${sources.length} sources to verify.`);

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

  // Ensure syndication tracking columns exist in remote D1 articles table
  try { await run(`ALTER TABLE articles ADD COLUMN syndicated_bluesky INTEGER DEFAULT 0`); } catch {}
  try { await run(`ALTER TABLE articles ADD COLUMN syndicated_tumblr INTEGER DEFAULT 0`); } catch {}
  try { await run(`ALTER TABLE articles ADD COLUMN syndicated_threads INTEGER DEFAULT 0`); } catch {}
  try { await run(`ALTER TABLE articles ADD COLUMN syndicated_buffer INTEGER DEFAULT 0`); } catch {}
  try { await run(`ALTER TABLE articles ADD COLUMN syndicated_bluesky_at TEXT`); } catch {}
  try { await run(`ALTER TABLE articles ADD COLUMN syndicated_tumblr_at TEXT`); } catch {}
  try { await run(`ALTER TABLE articles ADD COLUMN syndicated_threads_at TEXT`); } catch {}
  try { await run(`ALTER TABLE articles ADD COLUMN syndicated_buffer_at TEXT`); } catch {}

  const articleColumns = [
    'id','slug','title','summary','content','category_id','image_url','image_caption',
    'image_credit','image_license','author_name','author_role','author_avatar',
    'is_top_story','is_trending','is_breaking','views_count','reading_time_minutes',
    'source_id','source_name','source_original_url','published_at','updated_at','created_at','status',
    'syndicated_bluesky','syndicated_tumblr','syndicated_threads','syndicated_buffer',
    'syndicated_bluesky_at','syndicated_tumblr_at','syndicated_threads_at','syndicated_buffer_at'
  ];
  const rejectionColumns = [
    'id','source_id','source_name','original_title','original_url','raw_content',
    'rejection_reason','ai_tier_failures','status','created_at'
  ];
  const logColumns = ['id','event_type','source_id','message','level','created_at'];

  const articleCount = await insertMissing('articles', articleColumns, articleRows);

  // Synchronize and persist social syndication flags (Tumblr, Bluesky) to upstream Cloudflare D1
  console.log('📡 Synchronizing social syndication flags (Tumblr, Bluesky) to upstream Cloudflare D1...');
  let updatedSyndication = 0;
  for (const art of articleRows) {
    const synTumblr = value(art, 'syndicated_tumblr');
    const synBluesky = value(art, 'syndicated_bluesky');
    const synThreads = value(art, 'syndicated_threads');
    const synBuffer = value(art, 'syndicated_buffer');
    if (synTumblr === 1 || synBluesky === 1 || synThreads === 1 || synBuffer === 1) {
      try {
        await run(
          `UPDATE articles SET 
             syndicated_tumblr = MAX(COALESCE(syndicated_tumblr, 0), ?),
             syndicated_tumblr_at = COALESCE(?, syndicated_tumblr_at),
             syndicated_bluesky = MAX(COALESCE(syndicated_bluesky, 0), ?),
             syndicated_bluesky_at = COALESCE(?, syndicated_bluesky_at),
             syndicated_threads = MAX(COALESCE(syndicated_threads, 0), ?),
             syndicated_threads_at = COALESCE(?, syndicated_threads_at),
             syndicated_buffer = MAX(COALESCE(syndicated_buffer, 0), ?),
             syndicated_buffer_at = COALESCE(?, syndicated_buffer_at)
           WHERE id = ? OR slug = ?`,
          [
            synTumblr ?? 0,
            value(art, 'syndicated_tumblr_at'),
            synBluesky ?? 0,
            value(art, 'syndicated_bluesky_at'),
            synThreads ?? 0,
            value(art, 'syndicated_threads_at'),
            synBuffer ?? 0,
            value(art, 'syndicated_buffer_at'),
            value(art, 'id'),
            value(art, 'slug')
          ]
        );
        updatedSyndication++;
      } catch {}
    }
  }
  console.log(`📡 Remote D1 syndication status saved: ${updatedSyndication} articles updated.`);

  // Synchronize and heal images on existing articles in remote Cloudflare D1
  console.log('🖼️ Verifying and healing article images in upstream Cloudflare D1...');
  let updatedImages = 0;
  for (const art of articleRows) {
    const img = value(art, 'image_url');
    if (img && typeof img === 'string' && img.startsWith('https://')) {
      try {
        await run(
          `UPDATE articles SET 
             image_url = ?, 
             image_caption = COALESCE(image_caption, ?), 
             image_credit = COALESCE(image_credit, ?) 
           WHERE id = ? 
             AND (image_url IS NULL OR image_url = '' OR image_url LIKE '%wikimedia.org%' OR image_url LIKE '%channelstv.com%' OR image_url LIKE '%legit.ng%')`,
          [img, value(art, 'image_caption'), value(art, 'image_credit'), value(art, 'id')]
        );
        updatedImages++;
      } catch {}
    }
  }
  console.log(`🖼️ Remote D1 image check complete: ${updatedImages} article images verified/healed.`);

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
