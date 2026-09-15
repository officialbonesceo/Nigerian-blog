import type { APIRoute } from 'astro';
import { getD1, getArticles, getSiteSettings } from '../lib/runtime-db';

export const prerender = false;

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ url, locals, request }) => {
  try {
    const db = getD1(locals);
    const [articles, settings] = await Promise.all([
      getArticles(db, { limit: 50, status: 'published' }),
      getSiteSettings(db),
    ]);

    let origin = (settings.site_url || '').trim();
    if (!origin) {
      try {
        if (url && url.origin && url.origin !== 'null') {
          origin = url.origin;
        } else if (request && request.url) {
          origin = new URL(request.url).origin;
        }
      } catch {}
    }
    if (!origin || origin.includes('localhost') || origin === 'null') {
      origin = 'https://9jabeacon.name.ng';
    }
    origin = origin.replace(/\/+$/, '');

    const itemsXml = articles.map((art) => {
      const articleUrl = `${origin}/news/${encodeURIComponent(art.slug)}`;
      const pubDate = art.published_at ? new Date(art.published_at).toUTCString() : new Date().toUTCString();
      const imageUrl = art.image_url || `${origin}/favicon.svg`;
      const categoryName = art.category_name || 'Naija News';
      const cleanContent = art.content || `<p>${escapeXml(art.summary || art.title)}</p>`;

      return `
    <item>
      <title><![CDATA[${art.title}]]></title>
      <link>${articleUrl}</link>
      <guid isPermaLink="true">${articleUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator><![CDATA[9jaBeacon Editorial Desk]]></dc:creator>
      <category><![CDATA[${categoryName}]]></category>
      <description><![CDATA[${art.summary || art.title}]]></description>
      <content:encoded><![CDATA[${cleanContent}]]></content:encoded>
      <enclosure url="${escapeXml(imageUrl)}" length="1048576" type="image/jpeg" />
      <media:content url="${escapeXml(imageUrl)}" medium="image" type="image/jpeg">
        <media:title><![CDATA[${art.image_caption || art.title}]]></media:title>
        <media:credit><![CDATA[${art.image_credit || '9jaBeacon Wire'}]]></media:credit>
      </media:content>
    </item>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>9jaBeacon - Phoenix Browser &amp; Scooper News Feed</title>
    <link>${origin}</link>
    <description>Verified Nigerian breaking news, politics, business, sports, and world events syndication feed for Phoenix Browser and Scooper News.</description>
    <language>en-NG</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${origin}/scooper-feed.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${origin}/favicon.svg</url>
      <title>9jaBeacon</title>
      <link>${origin}</link>
    </image>
    ${itemsXml}
  </channel>
</rss>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=120, s-maxage=300',
        'X-Syndication-Partner': 'Scooper-PhoenixBrowser-v2',
      },
    });
  } catch (err: any) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>9jaBeacon</title><description>Error generating syndication feed</description></channel></rss>`,
      {
        status: 500,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      }
    );
  }
};
