import type { APIRoute } from 'astro';
import { getD1, getSiteSettings } from '../lib/runtime-db';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals, request }) => {
  let siteBase = '';
  try {
    const db = getD1(locals);
    const settings = await getSiteSettings(db);
    siteBase = (settings.site_url || '').trim();
  } catch {}

  if (!siteBase) {
    try {
      if (url && url.origin && url.origin !== 'null') {
        siteBase = url.origin;
      } else if (request && request.url) {
        siteBase = new URL(request.url).origin;
      }
    } catch {}
  }

  if (!siteBase || siteBase.includes('localhost') || siteBase === 'null') {
    siteBase = 'https://9jabeacon.name.ng';
  }
  siteBase = siteBase.replace(/\/+$/, '');

  const robotsTxt = `
User-agent: *
Allow: /
Disallow: /bonesceo/admin
Disallow: /admin
Disallow: /api/admin/

User-agent: Googlebot
Allow: /

User-agent: Googlebot-News
Allow: /

User-agent: Googlebot-Image
Allow: /

User-agent: Bingbot
Allow: /

User-agent: msnbot
Allow: /

Sitemap: ${siteBase}/sitemap.xml
`.trim();

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
