import type { APIRoute } from 'astro';
import { GET as ingestGet, POST as ingestPost } from './ingest';

export const prerender = false;
export const GET: APIRoute = (ctx) => ingestGet(ctx);
export const POST: APIRoute = (ctx) => ingestPost(ctx);
