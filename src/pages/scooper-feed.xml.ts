import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * D1-free fallback. Prefer static public/rss.xml after deploy.
 * Crawlers hitting this URL must not scan articles table.
 */
export const GET: APIRoute = async () => {
  const base = 'https://www.9jabeacon.name.ng';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>9jaBeacon</title>
    <link>${base}</link>
    <description>Verified Nigerian news. Full item list is served from static public/rss.xml when available.</description>
    <language>en-NG</language>
    <atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml" />
  </channel>
</rss>`;
  return new Response(xml.trim(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
};
