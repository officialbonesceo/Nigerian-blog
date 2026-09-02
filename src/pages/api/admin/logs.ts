import type { APIRoute } from 'astro';
import { getD1, getAutomationLogs } from '../../../lib/runtime-db';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 60), 1), 200);
    const logs = await getAutomationLogs(db, limit);

    return new Response(JSON.stringify({
      success: true,
      logs,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ locals }) => {
  try {
    const db = getD1(locals);
    await db.prepare('DELETE FROM automation_logs').run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Automation logs cleared successfully',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
