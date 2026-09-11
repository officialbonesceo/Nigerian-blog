import type { APIRoute } from 'astro';
import { GET as getScooperFeed } from './scooper-feed.xml';

export const prerender = false;
export const GET: APIRoute = async (context) => {
  return getScooperFeed(context);
};
