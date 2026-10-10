import type { APIRoute } from 'astro';
import { getD1, getArticleById, getSiteSettings, addAutomationLog, updateArticle } from '../../../lib/runtime-db';
import { postToTumblr } from '../../../lib/tumblr';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body: any = await request.json().catch(() => ({}));

    // Retrieve Tumblr credentials from server environment or automation settings
    const blogIdentifier = (
      body.blogIdentifier ||
      (typeof process !== 'undefined' ? (process.env?.TUMBLR_BLOG_IDENTIFIER || process.env?.TUMBLR_BLOG_NAME) : '') ||
      (locals as any)?.runtime?.env?.TUMBLR_BLOG_IDENTIFIER ||
      ''
    ).trim();

    const token = (
      body.token ||
      (typeof process !== 'undefined' ? (process.env?.TUMBLR_TOKEN || process.env?.TUMBLR_ACCESS_TOKEN) : '') ||
      (locals as any)?.runtime?.env?.TUMBLR_TOKEN ||
      ''
    ).trim();

    const consumerKey = (
      body.consumerKey ||
      (typeof process !== 'undefined' ? process.env?.TUMBLR_CONSUMER_KEY : '') ||
      (locals as any)?.runtime?.env?.TUMBLR_CONSUMER_KEY ||
      ''
    ).trim();

    const consumerSecret = (
      body.consumerSecret ||
      (typeof process !== 'undefined' ? process.env?.TUMBLR_CONSUMER_SECRET : '') ||
      (locals as any)?.runtime?.env?.TUMBLR_CONSUMER_SECRET ||
      ''
    ).trim();

    const tokenSecret = (
      body.tokenSecret ||
      (typeof process !== 'undefined' ? process.env?.TUMBLR_TOKEN_SECRET : '') ||
      (locals as any)?.runtime?.env?.TUMBLR_TOKEN_SECRET ||
      ''
    ).trim();

    if (!blogIdentifier) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing Tumblr Blog Identifier (e.g. 9jabeacon.tumblr.com). Set TUMBLR_BLOG_IDENTIFIER in GitHub Secrets or server environment.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!token && !consumerKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing Tumblr API credentials. Configure TUMBLR_CONSUMER_KEY, TUMBLR_CONSUMER_SECRET, TUMBLR_TOKEN, TUMBLR_TOKEN_SECRET or TUMBLR_ACCESS_TOKEN in GitHub Secrets or server environment.',
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

    const result = await postToTumblr({
      title,
      summary,
      canonicalUrl,
      imageUrl,
      category,
      blogIdentifier,
      token,
      consumerKey,
      consumerSecret,
      tokenSecret,
    });

    if (result.success) {
      if (body.articleId) {
        try {
          await updateArticle(db, body.articleId, {
            syndicated_tumblr: 1,
            syndicated_tumblr_at: new Date().toISOString(),
          });
        } catch {}
      }

      try {
        await addAutomationLog(
          db,
          'TUMBLR_PUBLISH_SUCCESS',
          body.articleId || 'admin_api',
          `Dispatched story to Tumblr (${blogIdentifier}): ${result.postUrl || result.postId}`,
          'info'
        );
      } catch {}

      return new Response(JSON.stringify({
        success: true,
        postId: result.postId,
        postUrl: result.postUrl,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: result.error || 'Failed to post to Tumblr',
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Server error while dispatching to Tumblr',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
