import type { APIRoute } from 'astro';

export const prerender = false;

/** Disabled — prevented accidental / external ingest while D1 quota is critical. */
export const POST: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Crawl/ingest is disabled until D1 is stable. Re-enable in repo deliberately.',
    }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  );
};

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ success: false, error: 'Disabled' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' },
  });
};
