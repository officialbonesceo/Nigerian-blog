import type { APIRoute } from 'astro';
import { getD1, addAutomationLog } from '../../../lib/runtime-db';
import { runIngestionPipeline } from '../../../lib/automated-ingest';

export const prerender = false;

async function handleIngest(locals: any, url: URL) {
  const startTime = Date.now();
  const db = getD1(locals);
  const limitParam = url.searchParams.get('limit');
  const sourceParam = url.searchParams.get('sourceId');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 5) : 2;

  await addAutomationLog(
    db,
    'CRON_TRIGGER_START',
    sourceParam || null,
    `Automated cron ingest triggered (limit: ${limit})`,
    'info'
  ).catch(() => {});

  const result = await runIngestionPipeline(db, {
    sourceId: sourceParam || undefined,
    limitPerSource: limit,
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  await addAutomationLog(
    db,
    'CRON_TRIGGER_COMPLETE',
    null,
    `Cron workflow finished in ${durationSec}s. Fetched: ${result.fetched}, Passed: ${result.passed}, Inserted: ${result.inserted}, Rejected: ${result.rejected}`,
    result.errors.length ? 'warning' : 'info'
  ).catch(() => {});

  return {
    success: true,
    durationSeconds: Number(durationSec),
    ...result,
    timestamp: new Date().toISOString(),
  };
}

export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const data = await handleIngest(locals, url);
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || String(err),
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const POST: APIRoute = async ({ locals, url }) => {
  try {
    const data = await handleIngest(locals, url);
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || String(err),
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
