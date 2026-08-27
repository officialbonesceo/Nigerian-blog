import type { APIRoute } from 'astro';
import { generateBrandedSvg } from '../../lib/fallback-image';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const title = url.searchParams.get('title') || 'Your Trusted Light on Nigerian News';
  const category = url.searchParams.get('category') || '9jaBeacon Verified';

  const svg = generateBrandedSvg({
    title,
    category,
  });

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
    },
  });
};
