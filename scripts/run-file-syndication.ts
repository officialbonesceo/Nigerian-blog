/**
 * File-based social syndication.
 * Reads syndication/pending/*.json, posts to enabled channels, deletes the
 * pending file, appends one line to syndication/history.jsonl.
 * NO database automation_logs / syndicated_* flag checks.
 */
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://www.9jabeacon.name.ng';
const PENDING = path.resolve(process.cwd(), 'syndication/pending');
const HISTORY = path.resolve(process.cwd(), 'syndication/history.jsonl');

type Item = {
  id?: string;
  slug: string;
  title: string;
  summary?: string;
  category_id?: string;
  image_url?: string | null;
  url?: string;
  channels?: string[];
};

function listPending(): string[] {
  if (!fs.existsSync(PENDING)) return [];
  return fs
    .readdirSync(PENDING)
    .filter((n) => n.endsWith('.json'))
    .map((n) => path.join(PENDING, n));
}

function appendHistory(entry: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(HISTORY), { recursive: true });
  fs.appendFileSync(HISTORY, JSON.stringify(entry) + '\n', 'utf8');
}

async function postBluesky(item: Item): Promise<{ ok: boolean; detail?: string }> {
  const identifier = (process.env.BLUESKY_IDENTIFIER || '').trim();
  const appPassword = (process.env.BLUESKY_APP_PASSWORD || '').trim();
  if (!identifier || !appPassword) return { ok: false, detail: 'missing bluesky secrets' };
  if ((process.env.BLUESKY_AUTO_POST_ENABLED || 'true').toLowerCase() === 'false') {
    return { ok: false, detail: 'bluesky disabled' };
  }
  try {
    const { postToBluesky } = await import('../src/lib/bluesky');
    const result = await postToBluesky(
      {
        title: item.title,
        summary: item.summary || item.title,
        category: item.category_id,
        imageUrl: item.image_url || undefined,
        slug: item.slug,
        canonicalUrl: item.url || `${SITE}/news/${item.slug}`,
      },
      { identifier, appPassword },
      SITE
    );
    if (result.success) return { ok: true, detail: result.postUrl || result.uri };
    return { ok: false, detail: result.error || 'bluesky failed' };
  } catch (e: any) {
    return { ok: false, detail: e?.message || String(e) };
  }
}

async function postThreads(item: Item): Promise<{ ok: boolean; detail?: string }> {
  if (!(process.env.THREADS_ACCESS_TOKEN || '').trim()) {
    return { ok: false, detail: 'missing threads token' };
  }
  if ((process.env.THREADS_AUTO_POST_ENABLED || 'true').toLowerCase() === 'false') {
    return { ok: false, detail: 'threads disabled' };
  }
  try {
    // Prefer dedicated script API if present; otherwise soft-skip
    const modPath = path.resolve(process.cwd(), 'scripts/broadcast-threads.ts');
    if (!fs.existsSync(modPath)) return { ok: false, detail: 'broadcast-threads missing' };
    process.env.TARGET_SLUG = item.slug;
    process.env.FORCE_BROADCAST = 'true';
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync('npx', ['tsx', 'scripts/broadcast-threads.ts'], {
      env: process.env,
      encoding: 'utf8',
      timeout: 120_000,
    });
    if (r.status === 0) return { ok: true, detail: 'threads ok' };
    return { ok: false, detail: (r.stderr || r.stdout || 'threads fail').slice(0, 300) };
  } catch (e: any) {
    return { ok: false, detail: e?.message || String(e) };
  }
}

async function postTumblr(item: Item): Promise<{ ok: boolean; detail?: string }> {
  if (!(process.env.TUMBLR_CONSUMER_KEY || '').trim() && !(process.env.TUMBLR_ACCESS_TOKEN || '').trim()) {
    return { ok: false, detail: 'missing tumblr secrets' };
  }
  if ((process.env.TUMBLR_AUTO_POST_ENABLED || 'true').toLowerCase() === 'false') {
    return { ok: false, detail: 'tumblr disabled' };
  }
  try {
    process.env.TARGET_SLUG = item.slug;
    process.env.FORCE_BROADCAST = 'true';
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync('npx', ['tsx', 'scripts/broadcast-tumblr.ts'], {
      env: process.env,
      encoding: 'utf8',
      timeout: 120_000,
    });
    if (r.status === 0) return { ok: true, detail: 'tumblr ok' };
    return { ok: false, detail: (r.stderr || r.stdout || 'tumblr fail').slice(0, 300) };
  } catch (e: any) {
    return { ok: false, detail: e?.message || String(e) };
  }
}

async function submitIndexNow(url: string): Promise<{ ok: boolean; detail?: string }> {
  const KEY = (process.env.INDEXNOW_KEY || '70f499f3fc3c41878432eab0610cb2cf').trim();
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'www.9jabeacon.name.ng',
        key: KEY,
        keyLocation: `${SITE}/${KEY}.txt`,
        urlList: [url, `${SITE}/`],
      }),
    });
    return { ok: res.ok || res.status === 202, detail: `status ${res.status}` };
  } catch (e: any) {
    return { ok: false, detail: e?.message || String(e) };
  }
}

async function processOne(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const item = JSON.parse(raw) as Item;
  if (!item.slug || !item.title) {
    console.warn('[synd] invalid pending file', filePath);
    fs.unlinkSync(filePath);
    return;
  }

  const channels = item.channels?.length
    ? item.channels
    : ['bluesky', 'threads', 'tumblr', 'indexnow'];
  const results: Record<string, { ok: boolean; detail?: string }> = {};

  console.log(`\n[synd] ${item.slug}`);

  if (channels.includes('bluesky')) {
    results.bluesky = await postBluesky(item);
    console.log('  bluesky:', results.bluesky);
  }
  if (channels.includes('threads')) {
    results.threads = await postThreads(item);
    console.log('  threads:', results.threads);
  }
  if (channels.includes('tumblr')) {
    results.tumblr = await postTumblr(item);
    console.log('  tumblr:', results.tumblr);
  }
  if (channels.includes('indexnow')) {
    const url = item.url || `${SITE}/news/${item.slug}`;
    results.indexnow = await submitIndexNow(url);
    console.log('  indexnow:', results.indexnow);
  }

  appendHistory({
    slug: item.slug,
    title: item.title,
    url: item.url || `${SITE}/news/${item.slug}`,
    posted_at: new Date().toISOString(),
    results,
  });

  // Always remove pending file after attempt (prevents infinite re-posts).
  // Re-queue manually if a channel must be retried.
  fs.unlinkSync(filePath);
  console.log(`[synd] removed pending ${path.basename(filePath)}`);
}

async function main() {
  const files = listPending();
  if (!files.length) {
    console.log('[synd] no pending files');
    return;
  }
  console.log(`[synd] ${files.length} pending file(s)`);
  // Cap per run to avoid spam
  const max = Math.min(files.length, parseInt(process.env.SYND_MAX || '3', 10) || 3);
  for (const f of files.slice(0, max)) {
    try {
      await processOne(f);
    } catch (e: any) {
      console.error('[synd] failed', f, e?.message || e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
