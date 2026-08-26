import type { APIRoute } from 'astro';
import { getArticles, getCategories } from '../lib/db';

export const GET: APIRoute = ({ url }) => {
  const articles = getArticles({ limit: 100 });
  const categories = getCategories();
  const origin = url.origin;

  const urls = [
    `
    <url>
      <loc>${origin}/</loc>
      <changefreq>hourly</changefreq>
      <priority>1.0</priority>
    </url>
    `,
    ...categories.map((cat) => `
    <url>
      <loc>${origin}/category/${cat.slug}</loc>
      <changefreq>hourly</changefreq>
      <priority>0.8</priority>
    </url>
    `),
    ...articles.map((art) => `
    <url>
      <loc>${origin}/news/${art.slug}</loc>
      <lastmod>${new Date(art.updated_at || art.published_at).toISOString()}</lastmod>
      <changefreq>daily</changefreq>
      <priority>0.9</priority>
    </url>
    `),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`.trim();

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
