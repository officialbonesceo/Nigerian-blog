import type { APIRoute } from 'astro';
import { getD1, getDatabaseStorageStats, cleanAndVacuumDatabase } from '../../../lib/runtime-db';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getD1(locals);
    const stats = await getDatabaseStorageStats(db);
    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Database inspection failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body = (await request.json().catch(() => ({}))) as {
      action?: 'clean_logs' | 'clean_analytics' | 'clean_rejected' | 'vacuum' | 'full_optimization';
    };

    const action = body.action || 'full_optimization';

    let options = {
      cleanLogs: true,
      cleanAnalytics: true,
      cleanRejected: true,
      runVacuum: true,
    };

    if (action === 'clean_logs') {
      options = { cleanLogs: true, cleanAnalytics: false, cleanRejected: false, runVacuum: true };
    } else if (action === 'clean_analytics') {
      options = { cleanLogs: false, cleanAnalytics: true, cleanRejected: false, runVacuum: true };
    } else if (action === 'clean_rejected') {
      options = { cleanLogs: false, cleanAnalytics: false, cleanRejected: true, runVacuum: true };
    } else if (action === 'vacuum') {
      options = { cleanLogs: false, cleanAnalytics: false, cleanRejected: false, runVacuum: true };
    }

    const cleanResult = await cleanAndVacuumDatabase(db, options);
    const newStats = await getDatabaseStorageStats(db);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Database optimization and space reclamation completed successfully.',
        actionTaken: action,
        cleanResult,
        stats: newStats,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Database cleanup execution failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
