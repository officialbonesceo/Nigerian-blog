import type { APIRoute } from 'astro';
import { getD1, logVisitorSession, incrementArticleView } from '../../../lib/runtime-db';

interface TrackBody {
  session_id?: string;
  page_path?: string;
  article_id?: string;
  user_agent?: string;
  referrer?: string;
  device_type?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const b = (await request.json().catch(() => ({}))) as TrackBody;
    if (!b.session_id || !b.page_path) {
      return new Response(JSON.stringify({ success: false, message: 'Missing session or path' }), { status: 400 });
    }
    
    const db = getD1(locals);
    
    // Log genuine human visit
    await logVisitorSession(db, b as Record<string, unknown>);

    // If an article ID is provided and this is a genuine read, increment read counter
    if (b.article_id) {
      await incrementArticleView(db, b.article_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ success: false }), { status: 500 });
  }
};
