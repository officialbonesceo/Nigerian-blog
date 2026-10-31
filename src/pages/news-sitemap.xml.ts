import type { APIRoute } from 'astro';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const prerender = false;

/**
 * Prefer static public/news-sitemap.xml (0 D1).
 * If the static file is missing at runtime, return a minimal valid news sitemap
 * so GSC never sees an empty urlset ("Missing XML tag").
 */
export const GET: APIRoute = async () => {
  try {
    const staticPath = join(process.cwd(), 'public', 'news-sitemap.xml');
    if (existsSync(staticPath)) {
      const body = readFileSync(staticPath, 'utf8');
      if (body.includes('<news:news>')) {
        return new Response(body, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          },
        });
      }
    }
  } catch {
    /* fall through */
  }

  const base = 'https://www.9jabeacon.name.ng';
  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>${base}/</loc>
    <lastmod>${now}</lastmod>
    <news:news>
      <news:publication>
        <news:name>9jaBeacon</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${now}</news:publication_date>
      <news:title>9jaBeacon Nigerian News</news:title>
    </news:news>
  </url>
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
};
