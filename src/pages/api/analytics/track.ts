import type { APIRoute } from 'astro';
import { getD1, logVisitorSession } from '../../../lib/runtime-db';

interface TrackBody {
  session_id?: string;
  page_path?: string;
  user_agent?: string;
  referrer?: string;
  device_type?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const b = (await request.json().catch(() => ({}))) as TrackBody;
    if (!b.session_id || !b.page_path) {
      return new Response(JSON.stringify({ success: false }), { status: 400 });
    }
    await logVisitorSession(getD1(locals), b as Record<string, unknown>);
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ success: false }), { status: 500 });
  }
};
