import type { APIRoute } from 'astro';
import { getD1, getArticleById, getAutomationSettings, getSiteSettings, addAutomationLog } from '../../../lib/runtime-db';
import { postToThreads } from '../../../lib/threads';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body: any = await request.json().catch(() => ({}));

    // Retrieve Threads credentials from request, environment, or settings
    const userId = (
      body.userId ||
      (typeof process !== 'undefined' ? process.env?.THREADS_USER_ID : '') ||
      (locals as any)?.runtime?.env?.THREADS_USER_ID ||
      ''
    ).trim();

    const accessToken = (
      body.accessToken ||
      (typeof process !== 'undefined' ? process.env?.THREADS_ACCESS_TOKEN : '') ||
      (locals as any)?.runtime?.env?.THREADS_ACCESS_TOKEN ||
      ''
    ).trim();

    if (!userId || !accessToken) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing Threads User ID or Access Token. Configure THREADS_USER_ID and THREADS_ACCESS_TOKEN in GitHub Secrets or server environment.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const siteSettings = await getSiteSettings(db);
    const siteUrl = (siteSettings.site_url || 'https://www.9jabeacon.name.ng').replace(/\/+$/, '');

    let title = body.title || 'Central Bank of Nigeria Reports FX Liquidity Surge to $1.2B';
    let summary = body.summary || 'Foreign exchange inflows in Nigeria reached a multi-month high following structural liquidity reforms.';
    let canonicalUrl = body.canonicalUrl || `${siteUrl}/market-rates`;
    let imageUrl = body.imageUrl || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&auto=format&fit=crop&q=80';
    let category = body.category || 'Economy & Markets';

    if (body.articleId) {
      const art = await getArticleById(db, body.articleId);
      if (art) {
        title = art.title;
        summary = art.summary || '';
        canonicalUrl = `${siteUrl}/news/${art.slug}`;
        imageUrl = art.image_url || imageUrl;
        category = art.category_id || category;
      }
    }

    const result = await postToThreads({
      title,
      summary,
      canonicalUrl,
      imageUrl,
      category,
      userId,
      accessToken,
    });

    if (result.success) {
      try {
        await addAutomationLog(
          db,
          'THREADS_PUBLISH_SUCCESS',
          'admin_api',
          `Dispatched story to Meta Threads (${userId}): ${result.postUrl || result.threadId}`,
          'info'
        );
      } catch {}

      return new Response(JSON.stringify({
        success: true,
        threadId: result.threadId,
        postUrl: result.postUrl,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: result.error || 'Failed to post to Meta Threads',
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Server error while dispatching to Meta Threads',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
