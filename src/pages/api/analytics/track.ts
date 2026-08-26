import type { APIRoute } from 'astro';
import { logVisitorSession } from '../../../lib/db';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { session_id, page_path, user_agent, referrer, device_type } = body;

    if (!session_id || !page_path) {
      return new Response(JSON.stringify({ success: false }), { status: 400 });
    }

    logVisitorSession({
      session_id,
      page_path,
      user_agent,
      referrer,
      device_type: device_type || 'mobile',
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false }), { status: 500 });
  }
};
