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

function looksLikeBot(ua: string | undefined): boolean {
  if (!ua) return false;
  const s = ua.toLowerCase();
  return /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|wget|curl|python-requests|scrapy/i.test(s);
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const b = (await request.json().catch(() => ({}))) as TrackBody;
    if (!b.session_id || !b.page_path) {
      return new Response(JSON.stringify({ success: false, message: 'Missing session or path' }), {
        status: 400,
      });
    }

    // Skip bot noise — protects write quota without affecting real readers
    if (looksLikeBot(b.user_agent || request.headers.get('user-agent') || '')) {
      return new Response(JSON.stringify({ success: true, skipped: 'bot' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getD1(locals);

    // Session path log is debounced in logVisitorSession (30 min per session+path)
    await logVisitorSession(db, b as Record<string, unknown>);

    // View counters debounced in incrementArticleView (30s per article per isolate)
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
