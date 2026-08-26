import type { APIRoute } from 'astro';
import { getArticleReports, updateArticleReportStatus, getRejectedArticles } from '../../../lib/db';

export const GET: APIRoute = async ({ url }) => {
  try {
    const type = url.searchParams.get('type') || 'reports';
    if (type === 'rejected') {
      const rejected = getRejectedArticles(50);
      return new Response(JSON.stringify({ success: true, rejected }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const reports = getArticleReports(undefined, 50);
    return new Response(JSON.stringify({ success: true, reports }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { id, status } = body;

    if (!id || !status) {
      return new Response(JSON.stringify({ success: false, error: 'Report ID and status required.' }), {
        status: 400,
      });
    }

    const success = updateArticleReportStatus(id, status);
    return new Response(JSON.stringify({ success }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
