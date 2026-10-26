import type { APIRoute } from 'astro';

export const prerender = false;

/** Permanently disabled — was open on production and burned account-wide D1 quota. */
function gone() {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Ingest endpoint disabled. Use GitHub Actions only when explicitly re-enabled.',
    }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    }
  );
}

export const GET: APIRoute = async () => gone();
export const POST: APIRoute = async () => gone();
