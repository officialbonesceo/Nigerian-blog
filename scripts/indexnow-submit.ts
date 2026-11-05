/**
 * Submit URLs to Bing IndexNow.
 * Key file must be live at: https://www.9jabeacon.name.ng/{KEY}.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../src/lib/db';

const SITE = 'https://www.9jabeacon.name.ng';
const HOST = 'www.9jabeacon.name.ng';
const KEY = (process.env.INDEXNOW_KEY || '70f499f3fc3c41878432eab0610cb2cf').trim();
const KEY_LOCATION = `${SITE}/${KEY}.txt`;

async function submit(urls: string[]) {
  const unique = [...new Set(urls.filter((u) => u && u.startsWith('http')))].slice(0, 100);
  if (!unique.length) {
    console.log('[indexnow] no urls to submit');
    return;
  }

  const body = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: unique,
  };

  console.log(`[indexnow] submitting ${unique.length} url(s)...`);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  const text = await res.text().catch(() => '');
  console.log(`[indexnow] status=${res.status} body=${text.slice(0, 200)}`);
  if (!res.ok && res.status !== 202) {
    throw new Error(`IndexNow failed: ${res.status}`);
  }
}

function loadRecentSlugs(limit: number): string[] {
  try {
    const rows = db
      .prepare(
        `SELECT slug FROM articles
         WHERE status = 'published' OR status IS NULL
         ORDER BY published_at DESC LIMIT ?`
      )
      .all(limit) as Array<{ slug: string }>;
    return rows.map((r) => r.slug).filter(Boolean);
  } catch (e: any) {
    console.warn('[indexnow] sqlite read failed:', e?.message || e);
    return [];
  }
}

function loadPendingQueue(): string[] {
  const dir = path.resolve(process.cwd(), 'syndication/pending');
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      if (j.url) out.push(j.url);
      else if (j.slug) out.push(`${SITE}/news/${j.slug}`);
    } catch {}
  }
  return out;
}

async function main() {
  const fromArg = process.argv.slice(2).filter((a) => a.startsWith('http'));
  let urls = fromArg;

  if (!urls.length) {
    urls = loadPendingQueue();
  }
  if (!urls.length) {
    urls = loadRecentSlugs(5).map((s) => `${SITE}/news/${s}`);
  }

  // Always include homepage + news sitemap for crawl hint
  urls.push(`${SITE}/`);
  urls.push(`${SITE}/news-sitemap.xml`);

  await submit(urls);
  try {
    db.close();
  } catch {}
}

main().catch((e) => {
  console.error('[indexnow] fatal', e);
  process.exit(1);
});
