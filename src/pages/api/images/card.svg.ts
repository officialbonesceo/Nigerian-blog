import type { APIRoute } from 'astro';
import { generateEditorialSvgString } from '../../../lib/editorial-image';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const title = url.searchParams.get('title') || '9jaBeacon News Wire';
  const category = url.searchParams.get('cat') || url.searchParams.get('category') || 'cat_naija_news';
  const source = url.searchParams.get('source') || '9jaBeacon Editorial Desk';

  const svgContent = generateEditorialSvgString({
    title,
    category,
    sourceName: source,
    width: 1200,
    height: 675,
  });

  return new Response(svgContent, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
    },
  });
};
