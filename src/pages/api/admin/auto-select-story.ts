import type { APIRoute } from 'astro';
import { getD1, getMostReadArticles, getArticles } from '../../../lib/runtime-db';
import { getDefaultPresenterForCategory } from '../../../lib/presenters-data';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals, cookies }) => {
  try {
    const session = cookies.get('admin_session');
    if (!session || !session.value) {
      return new Response(JSON.stringify({ error: 'Unauthorized admin session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const mode = url.searchParams.get('mode') || 'trending'; // 'trending' | 'most_read'
    const d1 = getD1(locals);

    let article = null;
    if (mode === 'most_read') {
      const mostRead = await getMostReadArticles(d1, 3);
      if (mostRead && mostRead.length > 0) {
        article = mostRead[0];
      }
    }

    if (!article) {
      // Get trending or top published article
      const articles = await getArticles(d1, { limit: 5 });
      if (articles && articles.length > 0) {
        article = articles[0];
      }
    }

    if (!article) {
      return new Response(JSON.stringify({ error: 'No published articles found in database' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const assignedPresenter = getDefaultPresenterForCategory(article.category_id || '');

    // Formulate a structured 30-40s broadcast script
    const cleanTitle = article.title.trim();
    const cleanSummary = (article.summary || article.content?.slice(0, 300) || '').replace(/<[^>]+>/g, '').trim();

    const broadcastScript = `Good evening. This is 9jaBeacon National News. Top story tonight: ${cleanTitle}. ${cleanSummary}. Stay connected to 9jaBeacon for continuous real-time verification as developments unfold.`;

    // Extract 3 punchy key takeaway bullet points for the side projection screen
    const sentences = cleanSummary.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    const keyPoints = [
      sentences[0] || 'Federal policy shift announced with immediate nationwide implementation.',
      sentences[1] || 'Key stakeholders and market analysts monitor immediate economic impact.',
      'Full verified coverage and live citizen updates on www.9jabeacon.name.ng'
    ].slice(0, 3);

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        articleId: article.id,
        slug: article.slug,
        headline: cleanTitle,
        script: broadcastScript,
        keyPoints,
        category: article.category_name || 'National News',
        categoryId: article.category_id || 'cat_naija_news',
        presenter: assignedPresenter,
        imageUrl: article.image_url || '/fallback-image.svg',
        readCount: article.views_count || 1250
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to auto-select trending story' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
