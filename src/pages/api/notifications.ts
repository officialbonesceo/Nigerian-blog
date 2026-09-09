import type { APIRoute } from 'astro';
import { getD1, getArticles } from '../../lib/runtime-db';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getD1(locals);
    
    // Fetch top latest stories directly from real D1 database
    const latestStories = await getArticles(db, {
      limit: 8,
      status: 'published',
    });

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
        summary: story.summary,
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
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Failed to fetch database notifications',
        notifications: [],
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
