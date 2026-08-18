import type { APIRoute } from 'astro';
import { fetchAndParseRssFeed } from '../../../lib/rss-parser';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const feedUrl = body.feed_url;

    if (!feedUrl) {
      return new Response(JSON.stringify({ error: 'Feed URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await fetchAndParseRssFeed(feedUrl);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
