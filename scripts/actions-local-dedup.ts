/**
 * Dedup set for GitHub Actions ingest — uses local SQLite + public/rss.xml.
 * Avoids remote D1 SELECT storms during candidate filtering.
 */
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../src/lib/db';

export type LocalDedupIndex = {
  urls: Set<string>;
  titles: Set<string>;
  slugs: Set<string>;
};

function normTitle(t: string): string {
  return (t || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normUrl(u: string): string {
  return (u || '').trim().split('#')[0].replace(/\/$/, '').toLowerCase();
}

export function buildLocalDedupIndex(): LocalDedupIndex {
  const urls = new Set<string>();
  const titles = new Set<string>();
  const slugs = new Set<string>();

  try {
    const rows = db
      .prepare(
        `SELECT slug, title, source_original_url FROM articles
         ORDER BY published_at DESC LIMIT 800`
      )
      .all() as Array<{ slug: string; title: string; source_original_url: string | null }>;
    for (const r of rows) {
      if (r.slug) slugs.add(r.slug.toLowerCase());
      if (r.title) titles.add(normTitle(r.title));
      if (r.source_original_url) urls.add(normUrl(r.source_original_url));
    }
  } catch (e: any) {
    console.warn('[local-dedup] sqlite read failed:', e?.message || e);
  }

  try {
    const rssPath = path.resolve(process.cwd(), 'public/rss.xml');
    if (fs.existsSync(rssPath)) {
      const xml = fs.readFileSync(rssPath, 'utf8');
      const linkRe = /<link>([^<]+)<\/link>/gi;
      const titleRe = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([^<]*)<\/title>/gi;
      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(xml))) {
        const u = m[1].trim();
        if (u.includes('/news/')) urls.add(normUrl(u));
      }
      while ((m = titleRe.exec(xml))) {
        const t = (m[1] || m[2] || '').trim();
        if (t && !t.includes('9jaBeacon')) titles.add(normTitle(t));
      }
    }
  } catch (e: any) {
    console.warn('[local-dedup] rss parse failed:', e?.message || e);
  }

  console.log(
    `[local-dedup] index urls=${urls.size} titles=${titles.size} slugs=${slugs.size}`
  );
  return { urls, titles, slugs };
}

export function localIsDuplicate(
  index: LocalDedupIndex,
  link: string,
  title: string,
  baseSlug: string
): boolean {
  if (link && index.urls.has(normUrl(link))) return true;
  if (title && index.titles.has(normTitle(title))) return true;
  const s = (baseSlug || '').toLowerCase();
  if (s && index.slugs.has(s)) return true;
  for (const existing of index.slugs) {
    if (existing === s || existing.startsWith(s + '-')) return true;
  }
  return false;
}
