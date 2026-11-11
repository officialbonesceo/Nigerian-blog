import type { APIRoute } from 'astro';

export const prerender = false;

/** Prefer static public/news-sitemap.xml. This is a tiny valid fallback. */
const BODY = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://www.9jabeacon.name.ng/</loc>
    <lastmod>2026-11-11T00:00:00Z</lastmod>
    <news:news>
      <news:publication>
        <news:name>9jaBeacon</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>2026-11-11T00:00:00Z</news:publication_date>
      <news:title>9jaBeacon Nigerian news blog</news:title>
    </news:news>
  </url>
</urlset>`;

export const GET: APIRoute = async () => {
  return new Response(BODY, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
};
