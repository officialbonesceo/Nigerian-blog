import type { APIRoute } from 'astro';
import { getD1, createArticle, updateArticle, deleteArticle, getArticlesWithCount, getArticleById, getSiteSettings } from '../../../lib/runtime-db';
import { submitUrlToBing, submitToIndexNow } from '../../../lib/bing-api';

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

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const db = getD1(locals);

    const singleId = url.searchParams.get('id');
    if (singleId) {
      const article = await getArticleById(db, singleId);
      if (!article) {
        return new Response(JSON.stringify({ error: 'Article not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, article }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '15', 10)));
    const offset = (page - 1) * limit;
    const categoryId = url.searchParams.get('category_id') || undefined;
    const search = url.searchParams.get('search') || undefined;

    const { articles, total } = await getArticlesWithCount(db, {
      limit,
      offset,
      categoryId,
      search,
    });

    return new Response(
      JSON.stringify({
        success: true,
        articles,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as ArticleBody;
    if (!body.title || !body.content) {
      return new Response(JSON.stringify({ error: 'Title and content are required' }), { status: 400 });
    }
    const db = getD1(locals);
    const article = await createArticle(db, body);

    // Automated Bing Submission if article is published
    let bingSubmission = null;
    if (article && (article.status === 'published' || !article.status)) {
      try {
        const settings = await getSiteSettings(db);
        const bingKey = (settings.bing_api_key || '').trim();
        const autoSubmit = settings.bing_auto_submit_enabled === '1' || settings.bing_auto_submit_enabled === 'true';

        if (bingKey && autoSubmit) {
          const siteUrl = (settings.site_url || 'https://9jabeacon.name.ng').replace(/\/+$/, '');
          const articleUrl = `${siteUrl}/news/${article.slug}`;
          bingSubmission = await submitUrlToBing(articleUrl, {
            apiKey: bingKey,
            siteUrl,
          });

          // Also submit to IndexNow protocol
          const indexNowKey = (settings.indexnow_key || bingKey).trim();
          if (indexNowKey) {
            const host = new URL(siteUrl).hostname;
            await submitToIndexNow([articleUrl], { host, key: indexNowKey }).catch(() => {});
          }
        }
      } catch (bingErr) {
        console.warn('Bing automated submission error on manual publish:', bingErr);
      }
    }

    return new Response(JSON.stringify({ success: true, article, bing: bingSubmission }), {
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
    const url = new URL(request.url);
    let id = url.searchParams.get('id');

    if (!id) {
      const body = (await request.json().catch(() => ({}))) as { id?: string };
      id = body?.id || null;
    }

    if (!id) {
      return new Response(JSON.stringify({ error: 'Article ID is required' }), { status: 400 });
    }
    const success = await deleteArticle(getD1(locals), id);
    return new Response(JSON.stringify({ success }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
