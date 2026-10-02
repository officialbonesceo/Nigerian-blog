import type { APIRoute } from 'astro';
import { getD1, getArticleById, getAutomationSettings, getSiteSettings, addAutomationLog } from '../../../../lib/runtime-db';
import { postToBluesky } from '../../../../lib/bluesky';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body = await request.json().catch(() => ({}));
    
    // Retrieve Bluesky credentials from DB
    const autoSettings = await getAutomationSettings(db);
    const settingsMap: Record<string, string> = {};
    for (const s of autoSettings) settingsMap[s.key] = s.value;

    const identifier = body.identifier || settingsMap.bluesky_identifier || '';
    const appPassword = body.appPassword || settingsMap.bluesky_app_password || '';

    if (!identifier || !appPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Bluesky credentials not configured. Please save your Handle and App Password first.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const siteSettings = await getSiteSettings(db);
    const siteUrl = (siteSettings.site_url || 'https://www.9jabeacon.name.ng').replace(/\/+$/, '');

    let articlePayload: any = null;

    if (body.article_id) {
      const art = await getArticleById(db, body.article_id);
      if (!art) {
        return new Response(JSON.stringify({ success: false, error: 'Article not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      articlePayload = {
        title: art.title,
        summary: art.summary,
        category: art.category_id || art.category_name,
        imageUrl: art.image_url,
        slug: art.slug,
        canonicalUrl: `${siteUrl}/news/${art.slug}`,
        customText: body.customText || undefined,
      };
    } else if (body.title && body.summary) {
      articlePayload = {
        title: body.title,
        summary: body.summary,
        category: body.category || 'naija-news',
        imageUrl: body.imageUrl || null,
        slug: body.slug || 'test-dispatch',
        canonicalUrl: body.canonicalUrl || `${siteUrl}/`,
        customText: body.customText || undefined,
      };
    } else {
      // Test broadcast dispatch
      articlePayload = {
        title: '9jaBeacon Newsroom Live Connection Test',
        summary: 'Autonomous news syndication test broadcast from 9jaBeacon. Connecting verified public interest journalism to the AT Protocol network.',
        category: 'business',
        slug: '',
        canonicalUrl: siteUrl,
        customText: body.customText || undefined,
      };
    }

    const postResult = await postToBluesky(articlePayload, { identifier, appPassword }, siteUrl);

    if (postResult.success) {
      await addAutomationLog(
        db,
        'BLUESKY_PUBLISH_SUCCESS',
        null,
        `Successfully posted to Bluesky: "${articlePayload.title.slice(0, 60)}..." -> ${postResult.postUrl}`,
        'info'
      ).catch(() => {});

      return new Response(JSON.stringify({
        success: true,
        postUrl: postResult.postUrl,
        uri: postResult.uri,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      await addAutomationLog(
        db,
        'BLUESKY_PUBLISH_ERROR',
        null,
        `Failed to post to Bluesky: ${postResult.error}`,
        'error'
      ).catch(() => {});

      return new Response(JSON.stringify({
        success: false,
        error: postResult.error || 'Failed to post to Bluesky',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Internal server error while publishing to Bluesky.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
