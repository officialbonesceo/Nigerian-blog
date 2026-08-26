import type { APIRoute } from 'astro';
import { getAnalyticsMetrics } from '../../../lib/db';

export const GET: APIRoute = async () => {
  try {
    const analytics = getAnalyticsMetrics();
    return new Response(JSON.stringify({ success: true, analytics }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
