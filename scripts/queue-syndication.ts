/**
 * Write syndication/pending/{slug}.json for new articles.
 * Dedup is FILE-based only (pending + history.jsonl) — no automation_logs / D1 flags.
 */
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../src/lib/db';

const SITE = 'https://www.9jabeacon.name.ng';
const PENDING = path.resolve(process.cwd(), 'syndication/pending');
const HISTORY = path.resolve(process.cwd(), 'syndication/history.jsonl');

function alreadyKnown(slug: string): boolean {
  const pendingPath = path.join(PENDING, `${slug}.json`);
  if (fs.existsSync(pendingPath)) return true;
  if (fs.existsSync(HISTORY)) {
    const lines = fs.readFileSync(HISTORY, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        if (j.slug === slug) return true;
      } catch {}
    }
  }
  return false;
}

function main() {
  fs.mkdirSync(PENDING, { recursive: true });
  fs.mkdirSync(path.dirname(HISTORY), { recursive: true });
  if (!fs.existsSync(HISTORY)) fs.writeFileSync(HISTORY, '', 'utf8');

  const limit = Math.min(Math.max(parseInt(process.env.QUEUE_LIMIT || '3', 10) || 3, 1), 10);
  const rows = db
    .prepare(
      `SELECT id, slug, title, summary, category_id, image_url, published_at
       FROM articles
       WHERE status = 'published' OR status IS NULL
       ORDER BY published_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
      id: string;
      slug: string;
      title: string;
      summary: string;
      category_id: string;
      image_url: string | null;
      published_at: string | null;
    }>;

  let written = 0;
  for (const a of rows) {
    if (!a.slug) continue;
    if (alreadyKnown(a.slug)) {
      console.log(`[queue] skip known ${a.slug}`);
      continue;
    }
    const payload = {
      id: a.id,
      slug: a.slug,
      title: a.title,
      summary: a.summary || a.title,
      category_id: a.category_id,
      image_url: a.image_url,
      published_at: a.published_at,
      url: `${SITE}/news/${a.slug}`,
      queued_at: new Date().toISOString(),
      channels: ['bluesky', 'threads', 'tumblr', 'indexnow'],
    };
    fs.writeFileSync(path.join(PENDING, `${a.slug}.json`), JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[queue] pending → ${a.slug}`);
    written++;
  }

  console.log(`[queue] wrote ${written} pending file(s)`);
  try {
    db.close();
  } catch {}
}

main();
