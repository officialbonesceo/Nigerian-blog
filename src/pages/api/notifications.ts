import type { APIRoute } from 'astro';
import { getD1, getArticles } from '../../lib/runtime-db';
import { initialArticles } from '../../lib/seed-data';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getD1(locals);
    
    // Fetch top latest stories directly from real D1 database
    let latestStories = await getArticles(db, {
      limit: 10,
      status: 'published',
    });

    if (!latestStories || latestStories.length === 0) {
      latestStories = (initialArticles as any[]).slice(0, 8);
    }

    const notifications = latestStories.map((story) => {
      let timeStr = 'Recent';
      if (story.published_at) {
        try {
          const diffMinutes = Math.floor((Date.now() - new Date(story.published_at).getTime()) / (1000 * 60));
          if (diffMinutes < 60) {
            timeStr = `${Math.max(diffMinutes, 1)}m ago`;
          } else if (diffMinutes < 1440) {
            timeStr = `${Math.floor(diffMinutes / 60)}h ago`;
          } else {
            timeStr = `${Math.floor(diffMinutes / 1440)}d ago`;
          }
        } catch {}
      }

      return {
        id: `notif_${story.id}`,
        article_id: story.id,
        title: story.title,
        summary: story.summary || 'Breaking update from 9jaBeacon news desk.',
        url: `/news/${story.slug}`,
        category: story.category_name || 'Naija News',
        category_slug: story.category_slug || 'naija-news',
        is_breaking: Boolean(story.is_breaking),
        is_top_story: Boolean(story.is_top_story),
        time: timeStr,
        published_at: story.published_at,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        source: 'd1_database',
        count: notifications.length,
        notifications,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30, s-maxage=60',
        },
      }
    );
  } catch (err: any) {
    const fallbackList = (initialArticles as any[]).slice(0, 6).map((story) => ({
      id: `notif_${story.id}`,
      article_id: story.id,
      title: story.title,
      summary: story.summary || 'Breaking update from 9jaBeacon news desk.',
      url: `/news/${story.slug}`,
      category: story.category_name || 'Naija News',
      category_slug: story.category_slug || 'naija-news',
      is_breaking: Boolean(story.is_breaking),
      is_top_story: Boolean(story.is_top_story),
      time: 'Just now',
      published_at: story.published_at,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        source: 'fallback_catalog',
        count: fallbackList.length,
        notifications: fallbackList,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
