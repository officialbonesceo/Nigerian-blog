import type { APIRoute } from 'astro';
import { getD1, getArticleById, getAutomationSettings, getSiteSettings, addAutomationLog, getAutomationLogs } from '../../../../lib/runtime-db';
import { postToBluesky, checkIfUrlAlreadyOnBlueskyTimeline } from '../../../../lib/bluesky';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body: any = await request.json().catch(() => ({}));
    const isForce = body.force === true;
    
    // Retrieve Bluesky credentials from Server Environment (.env) or DB
    const envIdentifier = (
      (typeof process !== 'undefined' ? process.env?.BLUESKY_IDENTIFIER : '') ||
      (locals as any)?.runtime?.env?.BLUESKY_IDENTIFIER ||
      (import.meta as any).env?.BLUESKY_IDENTIFIER ||
      ''
    ).trim();

    const envAppPassword = (
      (typeof process !== 'undefined' ? process.env?.BLUESKY_APP_PASSWORD : '') ||
      (locals as any)?.runtime?.env?.BLUESKY_APP_PASSWORD ||
      (import.meta as any).env?.BLUESKY_APP_PASSWORD ||
      ''
    ).trim();

    const autoSettings = await getAutomationSettings(db);
    const settingsMap: Record<string, string> = {};
    for (const s of autoSettings) settingsMap[s.key] = s.value;

    const identifier = (body.identifier || envIdentifier || settingsMap.bluesky_identifier || '').trim();
    const appPassword = (body.appPassword || envAppPassword || settingsMap.bluesky_app_password || '').trim();

    if (!identifier || !appPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Bluesky credentials not configured. Please set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD in your server environment (.env).',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const siteSettings = await getSiteSettings(db);
    const siteUrl = (siteSettings.site_url || 'https://www.9jabeacon.name.ng').replace(/\/+$/, '');

    let articlePayload: any = null;
    let targetArticleId: string | null = null;

    if (body.article_id) {
      const art = await getArticleById(db, body.article_id);
      if (!art) {
        return new Response(JSON.stringify({ success: false, error: 'Article not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      targetArticleId = art.id;

      // Deduplication check: verify if previously published
      if (!isForce) {
        const logs = await getAutomationLogs(db, 100).catch(() => []);
        const already = logs.find((l: any) => 
          l.event_type === 'BLUESKY_PUBLISH_SUCCESS' && 
          (l.source_id === art.id || (l.message && l.message.includes(art.slug)))
        );
        if (already) {
          const matchedUrl = already.message?.match(/https:\/\/bsky\.app\/profile\/[^\s]+/)?.[0];
          return new Response(JSON.stringify({
            success: true,
            alreadyPublished: true,
            postUrl: matchedUrl || undefined,
            message: `Story was already broadcasted to Bluesky. Enable 'Force Re-broadcast' to republish.`,
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Live timeline verification
        const liveCheck = await checkIfUrlAlreadyOnBlueskyTimeline(identifier, art.slug);
        if (liveCheck.exists) {
          return new Response(JSON.stringify({
            success: true,
            alreadyPublished: true,
            postUrl: liveCheck.postUrl,
            message: `Story was detected as already active on your Bluesky timeline.`,
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
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
      if (!isForce && body.slug) {
        const liveCheck = await checkIfUrlAlreadyOnBlueskyTimeline(identifier, body.slug);
        if (liveCheck.exists) {
          return new Response(JSON.stringify({
            success: true,
            alreadyPublished: true,
            postUrl: liveCheck.postUrl,
            message: `Post with matching link already exists on your Bluesky timeline.`,
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
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
        targetArticleId,
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
        targetArticleId,
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
