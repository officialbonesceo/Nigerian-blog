import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ url }) => {
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

Sitemap: ${url.origin}/sitemap.xml
`.trim();

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
