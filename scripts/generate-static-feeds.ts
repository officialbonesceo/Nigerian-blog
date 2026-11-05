/**
 * Build static RSS + sitemaps into public/ from local SQLite (after sync-cache).
 * Served as static files on Cloudflare Pages → 0 D1 reads for bot traffic.
 */
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../src/lib/db';

const SITE = 'https://www.9jabeacon.name.ng';
const SITE_NAME = '9jaBeacon';

function esc(s: string): string {
  return String(s || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
}

type Art = {
  slug: string;
  title: string;
  summary: string;
  content: string;
  category_id: string;
  image_url: string | null;
  image_caption: string | null;
  image_credit: string | null;
  author_name: string | null;
  source_original_url: string | null;
  published_at: string | null;
  updated_at: string | null;
  status: string | null;
};

function loadArticles(limit: number): Art[] {
  return db
    .prepare(
      `SELECT slug, title, summary, content, category_id, image_url, image_caption, image_credit,
              author_name, source_original_url, published_at, updated_at, status
       FROM articles
       WHERE status = 'published' OR status IS NULL
       ORDER BY published_at DESC
       LIMIT ?`
    )
    .all(limit) as Art[];
}

function catSlug(id: string): string {
  if (id === 'cat_money_hustle') return 'business';
  if (id === 'cat_sports') return 'sports';
  if (id === 'cat_world') return 'world';
  return 'naija-news';
}

function writeRss(articles: Art[]) {
  const items = articles.slice(0, 50).map((a) => {
    const url = `${SITE}/news/${encodeURIComponent(a.slug)}`;
    const pub = a.published_at ? new Date(a.published_at).toUTCString() : new Date().toUTCString();
    const img =
      a.image_url && a.image_url.startsWith('http') ? a.image_url : `${SITE}/favicon.svg`;
    const body = a.content || `<p>${esc(a.summary || a.title)}</p>`;
    return `
    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pub}</pubDate>
      <dc:creator><![CDATA[${a.author_name || '9jaBeacon Desk'}]]></dc:creator>
      <category><![CDATA[${catSlug(a.category_id)}]]></category>
      <description><![CDATA[${a.summary || a.title}]]></description>
      <content:encoded><![CDATA[${body}]]></content:encoded>
      <enclosure url="${esc(img)}" length="1048576" type="image/jpeg" />
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>9jaBeacon - Nigerian News RSS</title>
    <link>${SITE}</link>
    <description>Verified Nigerian news — 9jaBeacon</description>
    <language>en-NG</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
    ${items.join('')}
  </channel>
</rss>`.trim();
}

function writeSitemap(articles: Art[]) {
  const cats = ['naija-news', 'business', 'sports', 'world'];
  const catUrls = cats
    .map(
      (s) => `
  <url>
    <loc>${SITE}/category/${s}</loc>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`
    )
    .join('');

  const artUrls = articles
    .slice(0, 500)
    .map((a) => {
      const d = (a.updated_at || a.published_at || new Date().toISOString()).slice(0, 10);
      return `
  <url>
    <loc>${SITE}/news/${esc(a.slug)}</loc>
    <lastmod>${d}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}/</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE}/market-rates</loc>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${SITE}/about</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>${catUrls}${artUrls}
</urlset>`.trim();
}

function writeNewsSitemap(articles: Art[]) {
  const now = Date.now();
  const twoDays = 48 * 60 * 60 * 1000;
  let recent = articles.filter((a) => {
    const t = new Date(a.published_at || '').getTime();
    return !isNaN(t) && now - t <= twoDays;
  });
  if (recent.length < 5) recent = articles.slice(0, 20);
  recent = recent.slice(0, 100);

  const entries = recent
    .map((a) => {
      const iso = a.published_at
        ? new Date(a.published_at).toISOString()
        : new Date().toISOString();
      return `
  <url>
    <loc>${SITE}/news/${esc(a.slug)}</loc>
    <lastmod>${iso}</lastmod>
    <news:news>
      <news:publication>
        <news:name>${esc(SITE_NAME)}</news:name>
        <news:language>en-NG</news:language>
      </news:publication>
      <news:publication_date>${iso}</news:publication_date>
      <news:title>${esc(a.title)}</news:title>
    </news:news>
  </url>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${entries}
</urlset>`.trim();
}

function main() {
  const outDir = path.resolve(process.cwd(), 'public');
  fs.mkdirSync(outDir, { recursive: true });

  const articles = loadArticles(500);
  console.log(`[static-feeds] loaded ${articles.length} articles from local SQLite`);

  fs.writeFileSync(path.join(outDir, 'rss.xml'), writeRss(articles), 'utf8');
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), writeSitemap(articles), 'utf8');
  fs.writeFileSync(path.join(outDir, 'news-sitemap.xml'), writeNewsSitemap(articles), 'utf8');
  fs.writeFileSync(path.join(outDir, 'scooper-feed.xml'), writeRss(articles), 'utf8');

  console.log('[static-feeds] wrote public/rss.xml, sitemap.xml, news-sitemap.xml, scooper-feed.xml');
  db.close();
}

main();
