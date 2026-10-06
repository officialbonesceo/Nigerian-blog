import type { APIRoute } from 'astro';
import { getD1, getArticles, getCategories, getSiteSettings, getVideoArticles } from '../lib/runtime-db';

export const prerender = false;

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ url, locals, request }) => {
  const db = getD1(locals);
  const [articles, categories, settings, videoResult] = await Promise.all([
    getArticles(db, { limit: 1500 }),
    getCategories(db),
    getSiteSettings(db),
    getVideoArticles(db, { limit: 300, status: 'published' }),
  ]);
  const videosEnabled = settings.videos_enabled !== '0';
  const videos = videosEnabled ? (videoResult.videos || []) : [];


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
  if (!siteBase || siteBase.includes('localhost') || siteBase === 'null' || siteBase === 'https://9jabeacon.name.ng') {
    siteBase = 'https://www.9jabeacon.name.ng';
  }
  siteBase = siteBase.replace(/\/+$/, '');
  const siteName = settings.site_name || '9jaBeacon';

  const categoryUrls = categories.map(c => `
  <url>
    <loc>${siteBase}/category/${escapeXml(c.slug)}</loc>
    <changefreq>hourly</changefreq>
    <priority>0.85</priority>
  </url>`).join('');

  const now = new Date();
  const twoDaysAgoMs = now.getTime() - (48 * 60 * 60 * 1000);

  const articleUrls = articles.map(a => {
    const rawDate = a.updated_at || a.published_at;
    let isoDate = now.toISOString();
    let isRecentNews = false;

    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        isoDate = d.toISOString();
        if (d.getTime() > twoDaysAgoMs) {
          isRecentNews = true;
        }
      }
    }

    const titleEsc = escapeXml(a.title);
    const imageUrl = a.image_url && a.image_url.startsWith('http') ? escapeXml(a.image_url) : `${siteBase}/favicon.svg`;

    // Google News tags for articles published in the last 48 hours
    const newsBlock = isRecentNews ? `
    <news:news>
      <news:publication>
        <news:name>${escapeXml(siteName)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${isoDate}</news:publication_date>
      <news:title>${titleEsc}</news:title>
    </news:news>` : '';

    return `
  <url>
    <loc>${siteBase}/news/${escapeXml(a.slug)}</loc>
    <lastmod>${isoDate.split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>${newsBlock}
    <image:image>
      <image:loc>${imageUrl}</image:loc>
      <image:title>${titleEsc}</image:title>
    </image:image>
  </url>`;
  }).join('');

  const videoUrls = videos.map(v => {
    const rawDate = v.published_at || now.toISOString();
    const dateStr = rawDate.split('T')[0];
    const titleEsc = escapeXml(v.title);
    const descEsc = escapeXml(v.summary);
    const thumbEsc = escapeXml(v.thumbnail_url);
    const playerLoc = escapeXml(v.video_url);

    return `
  <url>
    <loc>${siteBase}/videos/${escapeXml(v.slug)}</loc>
    <lastmod>${dateStr}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
    <video:video>
      <video:thumbnail_loc>${thumbEsc}</video:thumbnail_loc>
      <video:title>${titleEsc}</video:title>
      <video:description>${descEsc}</video:description>
      <video:player_loc>${playerLoc}</video:player_loc>
      <video:duration>${v.duration_seconds || 300}</video:duration>
      <video:publication_date>${rawDate}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>
  </url>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url>
    <loc>${siteBase}/</loc>
    <changefreq>always</changefreq>
    <priority>1.0</priority>
  </url>${videosEnabled ? `
  <url>
    <loc>${siteBase}/videos</loc>
    <changefreq>hourly</changefreq>
    <priority>0.95</priority>
  </url>` : ''}
  <url>
    <loc>${siteBase}/market-rates</loc>
    <changefreq>hourly</changefreq>
    <priority>0.95</priority>
  </url>
  <url>
    <loc>${siteBase}/about</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${siteBase}/contact</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${siteBase}/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${siteBase}/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${siteBase}/disclaimer</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>${categoryUrls}${articleUrls}${videoUrls}
</urlset>`.trim();


  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};
