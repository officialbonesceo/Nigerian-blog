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
  try {
    const db = getD1(locals);
    // Small limit — primary feed is static public/rss.xml after content run deploy
    const [articles, settings] = await Promise.all([
      getArticles(db, { limit: 40, status: 'published' }),
      getSiteSettings(db),
    ]);

    let origin = (settings.site_url || '').trim();
    if (!origin) {
      try {
        if (url && url.origin && url.origin !== 'null') origin = url.origin;
        else if (request && request.url) origin = new URL(request.url).origin;
      } catch {}
    }
    if (
      !origin ||
      origin.includes('localhost') ||
      origin === 'null' ||
      origin === 'https://9jabeacon.name.ng'
    ) {
      origin = 'https://www.9jabeacon.name.ng';
    }
    origin = origin.replace(/\/+$/, '');

    const pathname = url && url.pathname ? url.pathname : '/rss.xml';
    const feedSelfUrl = `${origin}${pathname}`;

    const itemsXml = articles
      .map((art) => {
        const articleUrl = `${origin}/news/${encodeURIComponent(art.slug)}`;
        const pubDate = art.published_at
          ? new Date(art.published_at).toUTCString()
          : new Date().toUTCString();
        const imageUrl = art.image_url || `${origin}/favicon.svg`;
        const categoryName = art.category_name || 'Naija News';
        const cleanContent = art.content || `<p>${escapeXml(art.summary || art.title)}</p>`;
        const author = art.author_name || '9jaBeacon Editorial Desk';

        return `
    <item>
      <title><![CDATA[${art.title}]]></title>
      <link>${articleUrl}</link>
      <guid isPermaLink="true">${articleUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator><![CDATA[${author}]]></dc:creator>
      <category><![CDATA[${categoryName}]]></category>
      <description><![CDATA[${art.summary || art.title}]]></description>
      <content:encoded><![CDATA[${cleanContent}]]></content:encoded>
      <enclosure url="${escapeXml(imageUrl)}" length="1048576" type="image/jpeg" />
    </item>`;
      })
      .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>9jaBeacon - Phoenix Browser, Scooper News & RSS Feed</title>
    <link>${origin}</link>
    <description>Verified Nigerian breaking news syndication feed for 9jaBeacon.</description>
    <language>en-NG</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${feedSelfUrl}" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`;

    return new Response(xml.trim(), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        // Long cache: bots should mostly hit edge; static public/ is preferred after deploy
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      },
    });
  } catch (err: any) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>9jaBeacon</title><description>Error: ${escapeXml(err.message)}</description></channel></rss>`,
      {
        status: 500,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      }
    );
  }
};
