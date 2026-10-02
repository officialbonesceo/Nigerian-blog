import type { APIRoute } from 'astro';
import { getD1, getArticleById, getSiteSettings } from '../../../../lib/runtime-db';
import { generateAlgorithmicHooksAndImageIdeas } from '../../../../lib/bluesky';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body = await request.json().catch(() => ({}));
    const siteSettings = await getSiteSettings(db);
    const siteUrl = (siteSettings.site_url || 'https://www.9jabeacon.name.ng').replace(/\/+$/, '');

    let title = body.title || '';
    let summary = body.summary || '';
    let category = body.category || 'naija-news';
    let slug = body.slug || '';
    let canonicalUrl = body.canonicalUrl || '';
    let imageUrl = body.imageUrl || '';

    if (body.article_id) {
      const art = await getArticleById(db, body.article_id);
      if (!art) {
        return new Response(JSON.stringify({ success: false, error: 'Article not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      title = art.title;
      summary = art.summary;
      category = art.category_id || art.category_name || 'naija-news';
      slug = art.slug;
      canonicalUrl = `${siteUrl}/news/${art.slug}`;
      imageUrl = art.image_url;
    }

    if (!title) {
      return new Response(JSON.stringify({ success: false, error: 'Title is required to generate hooks' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const draft = await generateAlgorithmicHooksAndImageIdeas({
      title,
      summary,
      category,
      slug,
      canonicalUrl,
      siteUrl,
    });

    if (imageUrl) {
      draft.cardPreview.imageUrl = imageUrl;
    }

    return new Response(JSON.stringify({
      success: true,
      data: draft,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Failed to craft algorithmic hooks',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
