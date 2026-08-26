import type { APIRoute } from 'astro';
import { createArticleReport } from '../../lib/db';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { article_id, article_title, article_slug, reason, details, reporter_email } = body;

    if (!article_id || !reason) {
      return new Response(JSON.stringify({ success: false, error: 'Article ID and reason are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const report = createArticleReport({
      article_id,
      article_title,
      article_slug,
      reason,
      details,
      reporter_email,
    });

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
