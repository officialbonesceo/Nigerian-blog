import type { APIRoute } from 'astro';

export const prerender = false;

function gone() {
  return new Response(
    JSON.stringify({ success: false, error: 'Cron ingest disabled' }),
    { status: 410, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
  );
}

export const GET: APIRoute = async () => gone();
export const POST: APIRoute = async () => gone();
