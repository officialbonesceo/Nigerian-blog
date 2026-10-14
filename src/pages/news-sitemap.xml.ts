import type { APIRoute } from 'astro';
import { getD1, getArticles, getSiteSettings } from '../lib/runtime-db';

export const prerender = false;

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, ''');
}

export const GET: APIRoute = async ({ url, locals, request }) => {
  const db = getD1(locals);
  const [articles, settings] = await Promise.all([
    getArticles(db, { limit: 1000 }),
    getSiteSettings(db),
  ]);

  let siteBase = (settings.site_url || '').trim();
  if (!siteBase) {
    try {
      if (url && url.origin && url.origin !== 'null') {
        siteBase = url.origin;
      } else if (request && request.url) {
        siteBase = new URL(request.url).origin;
      }
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

  const siteName = settings.site_name || '9jaBeacon';
  const now = new Date();
  const twoDaysAgoMs = now.getTime() - 48 * 60 * 60 * 1000;

  // Google News: prefer last 48 hours
  let eligibleArticles = articles.filter((a) => {
    const pub = new Date(a.published_at || a.created_at || '');
    return !isNaN(pub.getTime()) && pub.getTime() >= twoDaysAgoMs;
  });

  // Never leave Google News sitemap empty
  if (eligibleArticles.length === 0) {
    eligibleArticles = articles.slice(0, 20);
  } else if (eligibleArticles.length < 5) {
    const extra = articles
      .filter((a) => !eligibleArticles.some((e) => e.id === a.id))
      .slice(0, 5 - eligibleArticles.length);
    eligibleArticles = [...eligibleArticles, ...extra];
  }

  eligibleArticles = eligibleArticles.slice(0, 1000);

  const newsEntries = eligibleArticles
    .map((a) => {
      const pubDate = new Date(a.published_at || a.created_at || now.toISOString());
      const isoDate = !isNaN(pubDate.getTime()) ? pubDate.toISOString() : now.toISOString();
      const modDate = new Date(a.updated_at || a.published_at || isoDate);
      const lastmod = !isNaN(modDate.getTime()) ? modDate.toISOString() : isoDate;
      const titleEsc = escapeXml(a.title);

      return `  <url>\n    <loc>${siteBase}/news/${escapeXml(a.slug)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <news:news>\n      <news:publication>\n        <news:name>${escapeXml(siteName)}</news:name>\n        <news:language>en-NG</news:language>\n      </news:publication>\n      <news:publication_date>${isoDate}</news:publication_date>\n      <news:title>${titleEsc}</news:title>\n    </news:news>\n  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${newsEntries}\n</urlset>`.trim();

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=900, stale-while-revalidate=86400',
    },
  });
};
