import type { APIRoute } from 'astro';
import { getD1, getSources, createSource, updateSource, deleteSource } from '../../../lib/runtime-db';

interface SourceBody {
  id?: string;
  name?: string;
  feed_url?: string;
  website_url?: string;
  category_default_id?: string;
  is_enabled?: number;
  is_official?: number;
  trust_score?: number;
  license_notes?: string;
  fetch_interval_minutes?: number;
  [key: string]: unknown;
}

export const GET: APIRoute = async ({ locals }) =>
  new Response(JSON.stringify({ sources: await getSources(getD1(locals)) }), {
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const b = (await request.json().catch(() => ({}))) as SourceBody;
    if (!b.name || !b.feed_url) {
      return new Response(JSON.stringify({ error: 'Name and RSS feed URL are required' }), { status: 400 });
    }
    const source = await createSource(getD1(locals), b);
    return new Response(JSON.stringify({ success: true, source }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const b = (await request.json().catch(() => ({}))) as SourceBody;
    if (!b.id) {
      return new Response(JSON.stringify({ error: 'Source ID is required' }), { status: 400 });
    }
    const source = await updateSource(getD1(locals), b.id, b);
    return new Response(JSON.stringify({ success: true, source }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const b = (await request.json().catch(() => ({}))) as { id?: string };
    if (!b.id) {
      return new Response(JSON.stringify({ error: 'Source ID is required' }), { status: 400 });
    }
    const success = await deleteSource(getD1(locals), b.id);
    return new Response(JSON.stringify({ success }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
