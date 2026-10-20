import type { APIRoute } from 'astro';
import { GET as getScooperFeed } from './scooper-feed.xml';

/**
 * Prefer static public/rss.xml once Pages has deployed the committed feed.
 * This SSR handler remains as a long-cached fallback so the URL never breaks.
 */
export const prerender = false;
export const GET: APIRoute = async (context) => {
  return getScooperFeed(context);
};
