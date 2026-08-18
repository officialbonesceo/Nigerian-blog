import type { APIRoute } from 'astro';
import { getSources, createSource, updateSource, deleteSource } from '../../../lib/db';

export const GET: APIRoute = async () => {
  const sources = getSources();
  return new Response(JSON.stringify({ sources }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body.name || !body.feed_url) {
      return new Response(JSON.stringify({ error: 'Name and RSS feed URL are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const source = createSource(body);
    return new Response(JSON.stringify({ success: true, source }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body.id) {
      return new Response(JSON.stringify({ error: 'Source ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updated = updateSource(body.id, body);
    return new Response(JSON.stringify({ success: true, source: updated }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body.id) {
      return new Response(JSON.stringify({ error: 'Source ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const success = deleteSource(body.id);
    return new Response(JSON.stringify({ success }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
