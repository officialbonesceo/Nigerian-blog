import type { APIRoute } from 'astro';
import { getVerifiedMarketRates } from '../../lib/market-rates';

export const prerender = false;

/**
 * Live FX JSON. Short cache so Google can re-crawl often while clients stay fresh.
 * HTML page /market-rates is the indexable surface; this API powers the live UI.
 */
export const GET: APIRoute = async () => {
  try {
    const data = await getVerifiedMarketRates();
    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // 60s browser / 120s edge — fresh enough for rates, stable enough for crawlers
        'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
        'CDN-Cache-Control': 'public, max-age=120',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Failed to verify rates' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }
    );
  }
};
