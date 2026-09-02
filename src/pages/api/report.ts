import type { APIRoute } from 'astro';
import { getD1, createArticleReport } from '../../lib/runtime-db';

interface ReportBody {
  article_id?: string;
  article_title?: string;
  article_slug?: string;
  reason?: string;
  details?: string;
  reporter_email?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const b = (await request.json().catch(() => ({}))) as ReportBody;
    if (!b.article_id || !b.reason) {
      return new Response(JSON.stringify({ success: false, error: 'Article ID and reason are required.' }), { status: 400 });
    }
    const report = await createArticleReport(getD1(locals), b as Record<string, unknown>);
    return new Response(JSON.stringify({ success: true, report }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
  }
};
