import type { APIRoute } from 'astro';
import { getD1, getArticles, getCategories, getSiteSettings, getVideoArticles } from '../lib/runtime-db';

export const prerender = false;

/** Build XML entities without broken quote literals. */
function escapeXml(unsafe: string): string {
  const a = String.fromCharCode(38); // &
  return String(unsafe || '')
    .replace(/&/g, a + 'amp;')
    .replace(/</g, a + 'lt;')
    .replace(/>/g, a + 'gt;')
    .replace(/"/g, a + 'quot;')
    .replace(/'/g, a + 'apos;');
}

/** SSR fallback only — primary is static public/sitemap.xml after daily content deploy. */
export const GET: APIRoute = async ({ url, locals, request }) => {
  const db = getD1(locals);
  const [articles, categories, settings, videoResult] = await Promise.all([
    getArticles(db, { limit: 200 }),
    getCategories(db),
    getSiteSettings(db),
    getVideoArticles(db, { limit: 50, status: 'published' }),
  ]);
  const videosEnabled = settings.videos_enabled !== '0';
  const videos = videosEnabled ? (videoResult as any)?.videos || [] : [];

  let siteBase = (settings.site_url || '').trim();
  if (!siteBase) {
    try {
      if (url && url.origin && url.origin !== 'null') siteBase = url.origin;
      else if (request && request.url) siteBase = new URL(request.url).origin;
    } catch {}
  }
  if (
    !siteBase ||
    siteBase.includes('localhost') ||
    siteBase === 'null' ||
    siteBase === 'https://9jabeacon.name.ng'
  ) {
    siteBase = 'https://www.9jabeacon.name.ng';
  }
  siteBase = siteBase.replace(/\/+$/, '');

  const seenSlugs = new Set<string>();
  const categoryUrls = categories
    .map((c) => (c.slug === 'money-hustle' ? 'business' : c.slug))
    .filter((slug) => {
      if (seenSlugs.has(slug)) return false;
      seenSlugs.add(slug);
      return true;
    })
    .map(
      (slug) => `
  <url>
    <loc>${siteBase}/category/${escapeXml(slug)}</loc>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`
    )
    .join('');

  const articleUrls = articles
    .map((a) => {
      const d = (a.updated_at || a.published_at || new Date().toISOString()).slice(0, 10);
      return `
  <url>
    <loc>${siteBase}/news/${escapeXml(a.slug)}</loc>
    <lastmod>${d}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
    })
    .join('');

  const videoUrls = videos
    .map((v: any) => {
      const dateStr = (v.published_at || '').split('T')[0] || new Date().toISOString().slice(0, 10);
      return `
  <url>
    <loc>${siteBase}/videos/${escapeXml(v.slug)}</loc>
    <lastmod>${dateStr}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteBase}/</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>${categoryUrls}${articleUrls}${videoUrls}
</urlset>`.trim();

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
};
