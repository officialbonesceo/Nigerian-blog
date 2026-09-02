import type { APIRoute } from 'astro';
import { getD1, createArticle, updateArticle, deleteArticle } from '../../../lib/runtime-db';

interface ArticleBody {
  id?: string;
  title?: string;
  content?: string;
  summary?: string;
  category_id?: string;
  image_url?: string;
  image_caption?: string;
  image_credit?: string;
  image_license?: string;
  author_name?: string;
  author_role?: string;
  author_avatar?: string;
  is_top_story?: number;
  is_trending?: number;
  is_breaking?: number;
  reading_time_minutes?: number;
  source_id?: string;
  source_name?: string;
  source_original_url?: string;
  published_at?: string;
  status?: string;
  [key: string]: unknown;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as ArticleBody;
    if (!body.title || !body.content) {
      return new Response(JSON.stringify({ error: 'Title and content are required' }), { status: 400 });
    }
    const article = await createArticle(getD1(locals), body);
    return new Response(JSON.stringify({ success: true, article }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as ArticleBody;
    if (!body.id) {
      return new Response(JSON.stringify({ error: 'Article ID is required' }), { status: 400 });
    }
    const success = await updateArticle(getD1(locals), body.id, body);
    return new Response(JSON.stringify({ success }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    if (!body.id) {
      return new Response(JSON.stringify({ error: 'Article ID is required' }), { status: 400 });
    }
    const success = await deleteArticle(getD1(locals), body.id);
    return new Response(JSON.stringify({ success }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
