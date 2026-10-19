import { db } from '../src/lib/db';
import { executeD1Query } from '../src/lib/d1-sync';

const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const apiToken = (process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '').trim();
const databaseId = (process.env.CLOUDFLARE_D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE || process.env.CLOUDFLARE_DATABASE_ID || '').trim();

/** Cap D1 API calls per run so we don't burn the whole daily quota. */
const MAX_ARTICLE_WRITES = 25;
const MAX_IMAGE_HEALS = 15;
const MAX_SYNDICATION_UPDATES = 20;

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
  const rows = Array.isArray(first?.results) ? (first.results as D1ResultRow[]) : [];
  return new Set(rows.map((row) => String(row.name)));
}

async function tableExists(table: string): Promise<boolean> {
  const result = await run(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
    [table]
  );
  const first = Array.isArray(result) ? result[0] : result;
  return Array.isArray(first?.results) && first.results.length > 0;
}

async function insertMissing(table: string, preferredColumns: string[], rows: Row[]) {
  if (!rows.length) return 0;
  if (!(await tableExists(table))) {
    console.log(`D1 table ${table} does not exist; skipping optional write.`);
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
  const rows = Array.isArray(first?.results) ? (first.results as D1ResultRow[]) : [];
  return new Set(rows.map((row) => String(row.id)));
}

async function main() {
  if (!accountId || !apiToken || !databaseId) {
    throw new Error(
      'CLOUDFLARE_ACCOUNT_ID, Cloudflare API Token, and CLOUDFLARE_D1_DATABASE_ID are required.'
    );
  }

  // Only recent local rows — full-table write-through was burning D1 quota every run.
  const articles = db
    .prepare('SELECT * FROM articles ORDER BY published_at DESC LIMIT ?')
    .all(MAX_ARTICLE_WRITES) as Row[];
  const rejections = db
    .prepare('SELECT * FROM rejected_articles ORDER BY created_at DESC LIMIT 20')
    .all() as Row[];
  const logs = db
    .prepare('SELECT * FROM automation_logs ORDER BY created_at DESC LIMIT 20')
    .all() as Row[];
  const sources = db
    .prepare('SELECT id, last_fetched_at FROM sources WHERE last_fetched_at IS NOT NULL')
    .all() as Row[];

  console.log(
    `D1 write-through (capped): ${articles.length} recent articles, ${rejections.length} rejections, ${logs.length} logs, ${sources.length} sources.`
  );

  await run('SELECT 1');

  const remoteSourceIds = await getRemoteSourceIds();
  const articleRows = articles.map((row) => {
    if (row.source_id && remoteSourceIds.size && !remoteSourceIds.has(String(row.source_id))) {
      return { ...row, source_id: null };
    }
    return row;
  });

  try {
    await run(`ALTER TABLE articles ADD COLUMN syndicated_bluesky INTEGER DEFAULT 0`);
  } catch {}
  try {
    await run(`ALTER TABLE articles ADD COLUMN syndicated_tumblr INTEGER DEFAULT 0`);
  } catch {}
  try {
    await run(`ALTER TABLE articles ADD COLUMN syndicated_threads INTEGER DEFAULT 0`);
  } catch {}
  try {
    await run(`ALTER TABLE articles ADD COLUMN syndicated_buffer INTEGER DEFAULT 0`);
  } catch {}
  try {
    await run(`ALTER TABLE articles ADD COLUMN syndicated_bluesky_at TEXT`);
  } catch {}
  try {
    await run(`ALTER TABLE articles ADD COLUMN syndicated_tumblr_at TEXT`);
  } catch {}
  try {
    await run(`ALTER TABLE articles ADD COLUMN syndicated_threads_at TEXT`);
  } catch {}
  try {
    await run(`ALTER TABLE articles ADD COLUMN syndicated_buffer_at TEXT`);
  } catch {}

  const articleColumns = [
    'id',
    'slug',
    'title',
    'summary',
    'content',
    'category_id',
    'image_url',
    'image_caption',
    'image_credit',
    'image_license',
    'author_name',
    'author_role',
    'author_avatar',
    'is_top_story',
    'is_trending',
    'is_breaking',
    'views_count',
    'reading_time_minutes',
    'source_id',
    'source_name',
    'source_original_url',
    'published_at',
    'updated_at',
    'created_at',
    'status',
    'syndicated_bluesky',
    'syndicated_tumblr',
    'syndicated_threads',
    'syndicated_buffer',
    'syndicated_bluesky_at',
    'syndicated_tumblr_at',
    'syndicated_threads_at',
    'syndicated_buffer_at',
  ];
  const rejectionColumns = [
    'id',
    'source_id',
    'source_name',
    'original_title',
    'original_url',
    'raw_content',
    'rejection_reason',
    'ai_tier_failures',
    'status',
    'created_at',
  ];
  const logColumns = ['id', 'event_type', 'source_id', 'message', 'level', 'created_at'];

  const articleCount = await insertMissing('articles', articleColumns, articleRows);

  console.log('Syncing syndication flags (capped)...');
  let updatedSyndication = 0;
  for (const art of articleRows) {
    if (updatedSyndication >= MAX_SYNDICATION_UPDATES) break;
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
            value(art, 'slug'),
          ]
        );
        updatedSyndication++;
      } catch {}
    }
  }
  console.log(`Syndication flags updated: ${updatedSyndication}`);

  // Image heal: only a few recent rows, only when image is empty/broken
  console.log('Image heal (capped)...');
  let updatedImages = 0;
  for (const art of articleRows.slice(0, MAX_IMAGE_HEALS)) {
    const img = value(art, 'image_url');
    if (img && typeof img === 'string' && img.startsWith('https://')) {
      try {
        await run(
          `UPDATE articles SET
             image_url = ?,
             image_caption = COALESCE(image_caption, ?),
             image_credit = COALESCE(image_credit, ?)
           WHERE id = ?
             AND (image_url IS NULL OR image_url = '' OR image_url LIKE '%channelstv.com%' OR image_url LIKE '%legit.ng%')`,
          [img, value(art, 'image_caption'), value(art, 'image_credit'), value(art, 'id')]
        );
        updatedImages++;
      } catch {}
    }
  }
  console.log(`Image heal attempted: ${updatedImages}`);

  const rejectionCount = await insertMissing('rejected_articles', rejectionColumns, rejections);
  const logCount = await insertMissing('automation_logs', logColumns, logs);

  if (await tableExists('sources')) {
    const sourceColumns = await tableColumns('sources');
    if (sourceColumns.has('last_fetched_at') && sourceColumns.has('id')) {
      for (const source of sources.slice(0, 10)) {
        await run('UPDATE sources SET last_fetched_at = ? WHERE id = ?', [
          value(source, 'last_fetched_at'),
          value(source, 'id'),
        ]);
      }
    }
  }

  console.log(
    `D1 write-through complete: ${articleCount} article rows, ${rejectionCount} rejections, ${logCount} logs.`
  );
  db.close();
}

main().catch((error) => {
  console.error('Local → D1 sync failed:', error);
  try {
    db.close();
  } catch {}
  process.exit(1);
});
