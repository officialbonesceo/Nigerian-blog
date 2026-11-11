import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * D1-free fallback. Prefer static public/sitemap.xml after deploy.
 */
export const GET: APIRoute = async () => {
  const base = 'https://www.9jabeacon.name.ng';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>
  <url><loc>${base}/category/naija-news</loc><changefreq>daily</changefreq><priority>0.85</priority></url>
  <url><loc>${base}/category/business</loc><changefreq>daily</changefreq><priority>0.85</priority></url>
  <url><loc>${base}/category/sports</loc><changefreq>daily</changefreq><priority>0.85</priority></url>
  <url><loc>${base}/category/world</loc><changefreq>daily</changefreq><priority>0.85</priority></url>
  <url><loc>${base}/market-rates</loc><changefreq>daily</changefreq><priority>0.8</priority></url>
  <url><loc>${base}/about</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>
</urlset>`;
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
};
