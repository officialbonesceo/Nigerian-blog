import type { APIRoute } from 'astro';
import { getD1, getAutomationSettings } from '../../../../lib/runtime-db';

const PUBLIC_BSKY_API = 'https://public.api.bsky.app';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const db = getD1(locals);

    // Resolve handle: query param -> server env -> DB settings -> fallback default
    let handle = url.searchParams.get('handle') || '';
    if (!handle) {
      handle = (
        (typeof process !== 'undefined' ? process.env?.BLUESKY_IDENTIFIER : '') ||
        (locals as any)?.runtime?.env?.BLUESKY_IDENTIFIER ||
        ''
      ).trim();
    }
    if (!handle) {
      const autoSettings = await getAutomationSettings(db);
      for (const s of autoSettings) {
        if (s.key === 'bluesky_identifier' && s.value) {
          handle = s.value.trim();
          break;
        }
      }
    }
    if (!handle) {
      handle = '9jabeacon.bsky.social';
    }

    const cleanHandle = handle.replace(/^@/, '').trim();

    // 1. Fetch Profile Metrics
    const profileRes = await fetch(
      `${PUBLIC_BSKY_API}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(cleanHandle)}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!profileRes.ok) {
      const errData = await profileRes.json().catch(() => ({}));
      return new Response(JSON.stringify({
        success: false,
        error: errData.message || `Profile not found on Bluesky (${profileRes.status})`,
      }), {
        status: profileRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const profileData = await profileRes.json();

    // 2. Fetch Recent Feed & Engagement Telemetry
    let feedItems: any[] = [];
    let totalLikes = 0;
    let totalReposts = 0;
    let totalReplies = 0;
    let totalQuotes = 0;

    try {
      const feedRes = await fetch(
        `${PUBLIC_BSKY_API}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(cleanHandle)}&limit=30`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (feedRes.ok) {
        const feedData = await feedRes.json();
        const rawFeed = Array.isArray(feedData.feed) ? feedData.feed : [];

        feedItems = rawFeed.map((item: any) => {
          const post = item.post || {};
          const record = post.record || {};
          const likes = post.likeCount || 0;
          const reposts = post.repostCount || 0;
          const replies = post.replyCount || 0;
          const quotes = post.quoteCount || 0;

          totalLikes += likes;
          totalReposts += reposts;
          totalReplies += replies;
          totalQuotes += quotes;

          const rkey = post.uri ? post.uri.split('/').pop() : '';
          const postUrl = `https://bsky.app/profile/${cleanHandle}/post/${rkey}`;

          return {
            uri: post.uri,
            cid: post.cid,
            postUrl,
            text: record.text || '',
            createdAt: record.createdAt || post.indexedAt,
            likes,
            reposts,
            replies,
            quotes,
            embedTitle: post.embed?.external?.title || null,
            embedUri: post.embed?.external?.uri || null,
            embedThumb: post.embed?.external?.thumb || null,
          };
        });
      }
    } catch (feedErr: any) {
      console.warn('[Bluesky Analytics Feed Notice]:', feedErr.message);
    }

    const totalInteractions = totalLikes + totalReposts + totalReplies + totalQuotes;
    const postCountSample = feedItems.length;
    const avgEngagementPerPost = postCountSample > 0 ? (totalInteractions / postCountSample).toFixed(1) : '0';

    return new Response(JSON.stringify({
      success: true,
      data: {
        handle: profileData.handle,
        displayName: profileData.displayName || profileData.handle,
        did: profileData.did,
        avatar: profileData.avatar || null,
        banner: profileData.banner || null,
        description: profileData.description || '',
        followersCount: profileData.followersCount || 0,
        followsCount: profileData.followsCount || 0,
        postsCount: profileData.postsCount || 0,
        indexedAt: profileData.indexedAt,
        aggregates: {
          sampledPosts: postCountSample,
          totalLikes,
          totalReposts,
          totalReplies,
          totalQuotes,
          totalInteractions,
          avgEngagementPerPost,
        },
        recentBroadcasts: feedItems,
      },
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15', // 15-second cache for instant freshness
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Internal server error while fetching Bluesky channel analytics',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
