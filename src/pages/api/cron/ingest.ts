import type { APIRoute } from 'astro';
import { getD1 } from '../../../lib/runtime-db';
import { runIngestionPipeline } from '../../../lib/automated-ingest';

export const prerender = false;

function isAuthorized(request: Request): boolean {
  // Kill switch: require secret. No secret configured = refuse all (safer than open).
  const expected =
    (typeof process !== 'undefined' && (process.env?.CRON_SECRET || process.env?.ADMIN_SECRET)) ||
    '';
  if (!expected) return false;
  const auth = request.headers.get('Authorization') || '';
  const headerSecret = request.headers.get('x-cron-secret') || '';
  const url = new URL(request.url);
  const q = url.searchParams.get('secret') || '';
  if (auth === `Bearer ${expected}`) return true;
  if (headerSecret === expected) return true;
  if (q === expected) return true;
  return false;
}

async function handleIngest(locals: any, url: URL) {
  // Global kill switch (env on Pages / Worker)
  if (typeof process !== 'undefined' && process.env?.INGEST_DISABLED === 'true') {
    return {
      success: false,
      error: 'Ingest disabled (INGEST_DISABLED=true)',
      timestamp: new Date().toISOString(),
    };
  }

  const startTime = Date.now();
  const db = getD1(locals);
  const limitParam = url.searchParams.get('limit');
  const sourceParam = url.searchParams.get('sourceId');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 5) : 2;

  const result = await runIngestionPipeline(db, {
    sourceId: sourceParam || undefined,
    limitPerSource: limit,
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  return {
    success: true,
    durationSeconds: Number(durationSec),
    ...result,
    timestamp: new Date().toUTCString(),
  };
}

export const GET: APIRoute = async ({ locals, url, request }) => {
  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  try {
    const data = await handleIngest(locals, url);
    return new Response(JSON.stringify(data, null, 2), {
      status: data.success === false ? 503 : 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || String(err), timestamp: new Date().toISOString() }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ locals, url, request }) => {
  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  try {
    const data = await handleIngest(locals, url);
    return new Response(JSON.stringify(data, null, 2), {
      status: data.success === false ? 503 : 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || String(err), timestamp: new Date().toISOString() }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
