import type { APIRoute } from 'astro';
import { getD1 } from '../lib/runtime-db';

export const prerender = false;

const BASE = 'https://www.9jabeacon.name.ng';

function esc(s: string) {
  return s.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}

function urlNode(loc: string, lastmod?: string | null, changefreq = 'daily', priority = '0.8') {
  const lm = lastmod ? `\n    <lastmod>${esc(String(lastmod).slice(0, 10))}</lastmod>` : '';
  return `  <url>\n    <loc>${esc(loc)}</loc>${lm}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

export const GET: APIRoute = async ({ locals }) => {
  const staticUrls: string[] = [
    urlNode(`${BASE}/`, null, 'hourly', '1.0'),
    urlNode(`${BASE}/market-rates`, null, 'hourly', '0.9'),
    urlNode(`${BASE}/about`, null, 'weekly', '0.6'),
    urlNode(`${BASE}/contact`, null, 'monthly', '0.5'),
    urlNode(`${BASE}/privacy`, null, 'monthly', '0.4'),
    urlNode(`${BASE}/terms`, null, 'monthly', '0.4'),
    urlNode(`${BASE}/topics`, null, 'weekly', '0.7'),
    urlNode(`${BASE}/category/naija-news`, null, 'daily', '0.85'),
    urlNode(`${BASE}/category/business`, null, 'daily', '0.85'),
    urlNode(`${BASE}/category/sports`, null, 'daily', '0.85'),
    urlNode(`${BASE}/category/world`, null, 'daily', '0.85'),
  ];

  // Home archive pages (static ranges — no DB)
  for (let p = 2; p <= 25; p++) {
    staticUrls.push(urlNode(`${BASE}/page/${p}`, null, 'daily', '0.5'));
  }

  // Category archive pages
  for (const cat of ['naija-news', 'business', 'sports', 'world']) {
    for (let p = 2; p <= 12; p++) {
      staticUrls.push(urlNode(`${BASE}/category/${cat}/page/${p}`, null, 'daily', '0.5'));
    }
  }

  const articleUrls: string[] = [];
  try {
    const db = getD1(locals as any);
    // Lightweight: slug + date only. Cap at 2000 to protect D1 reads.
    const res = await db
      .prepare(
        `SELECT slug, published_at FROM articles
         WHERE status = 'published'
           AND slug IS NOT NULL AND length(slug) > 3
           AND title NOT LIKE '%[stub]%'
         ORDER BY published_at DESC
         LIMIT 2000`
      )
      .all<{ slug: string; published_at: string }>();
    for (const row of res?.results || []) {
      const slug = String(row.slug || '').trim();
      if (!slug || slug.includes('?') || slug.includes('#')) continue;
      articleUrls.push(urlNode(`${BASE}/news/${slug}`, row.published_at, 'daily', '0.9'));
    }
  } catch (e) {
    console.warn('[sitemap] D1 unavailable, static-only', e);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticUrls, ...articleUrls].join('\n')}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800, s-maxage=3600',
    },
  });
};
