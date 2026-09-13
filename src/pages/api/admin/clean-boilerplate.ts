import type { APIRoute } from 'astro';
import { getD1, getArticles, deleteArticle, updateArticle } from '../../../lib/runtime-db';
import { generateEditorialSvgDataUrl, isPublisherLogoOrBanner } from '../../../lib/editorial-image';

export const prerender = false;

const CORRUPTED_SIGNATURES = [
  'shifting geopolitical currents',
  'State regulatory bodies, industry analysts',
  'balancing macroeconomic austerity with grassroots survival',
  'Nigerian sports administration and athletic competition operate at an intense intersection',
  'complex governance matrix, where federal policies',
  'macroeconomic austerity with grassroots survival',
];

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body = (await request.json().catch(() => ({}))) as {
      action?: 'scan' | 'purge' | 'fix_images' | 'resynthesize';
      limit?: number;
    };

    const action = body.action || 'scan';
    const limit = Math.min(body.limit || 500, 1000);

    // Retrieve articles
    const allArticles = await getArticles(db, { limit });
    
    // Identify corrupted or nonsense articles
    const corrupted = allArticles.filter((a: any) => {
      const content = a.content || '';
      return CORRUPTED_SIGNATURES.some(sig => content.includes(sig));
    });

    // Identify articles with bad or blurry images (pollinations, publisher logos)
    const badImages = allArticles.filter((a: any) => {
      const img = a.image_url || '';
      return img.includes('image.pollinations.ai') || isPublisherLogoOrBanner(img);
    });

    if (action === 'scan') {
      return new Response(
        JSON.stringify({
          success: true,
          totalArticles: allArticles.length,
          corruptedArticlesCount: corrupted.length,
          badImagesCount: badImages.length,
          corruptedIds: corrupted.map((a: any) => ({ id: a.id, title: a.title, slug: a.slug })),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'purge') {
      let deletedCount = 0;
      for (const a of corrupted) {
        await deleteArticle(db, a.id);
        deletedCount++;
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'purge',
          deletedCount,
          remainingArticles: allArticles.length - deletedCount,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'fix_images') {
      let fixedCount = 0;
      for (const a of badImages) {
        const svgUrl = generateEditorialSvgDataUrl({
          title: a.title,
          category: a.category_id || 'cat_naija_news',
          sourceName: a.source_name || '9jaBeacon Wire',
        });
        await updateArticle(db, a.id, {
          image_url: svgUrl,
          image_credit: '9jaBeacon Editorial Visual Desk',
        });
        fixedCount++;
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'fix_images',
          fixedCount,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
