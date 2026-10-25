/**
 * 9jaBeacon ingest worker — HARD DISABLED 2026-10-25
 * No scheduled or HTTP path writes to D1 until re-enabled deliberately.
 * Redeploy: cd workers && npx wrangler deploy
 */
import type { WorkerEnv, ScheduledController, ExecutionContext } from './types';

export default {
  async scheduled(_event: ScheduledController, env: WorkerEnv, _ctx: ExecutionContext): Promise<void> {
    console.log('[9jaBeacon Cron] DISABLED — refusing scheduled ingest');
    if (env.INGEST_DISABLED !== 'false') return;
  },

  async fetch(request: Request, env: WorkerEnv, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          service: '9jaBeacon Cloudflare Ingestion Worker',
          status: 'disabled',
          ingest: false,
          timestamp: new Date().toISOString(),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // All trigger paths refuse
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Ingest worker disabled. Use GitHub Actions only after D1 is fixed.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  },
};
