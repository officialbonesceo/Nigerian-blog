import type { APIRoute } from 'astro';
import { getVerifiedMarketRates } from '../../lib/market-rates';

export const GET: APIRoute = async () => {
  try {
    const data = await getVerifiedMarketRates();
    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=180, s-maxage=300',
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
