import type { APIRoute } from 'astro';
import { getD1, getMostReadArticles } from '../../../lib/runtime-db';

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const limitParam = Number(url.searchParams.get('limit') || 5);
    const limit = Math.min(Math.max(1, limitParam), 10);
    const db = getD1(locals);
    const articles = await getMostReadArticles(db, limit);

    return new Response(JSON.stringify({ success: true, articles }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch most read articles' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
