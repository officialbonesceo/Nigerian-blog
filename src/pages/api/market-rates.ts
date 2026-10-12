import type { APIRoute } from 'astro';
import { getVerifiedMarketRates } from '../../lib/market-rates';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const data = await getVerifiedMarketRates();
    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Failed to verify rates' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
