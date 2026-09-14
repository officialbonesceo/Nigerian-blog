import type { APIRoute } from 'astro';
import { getD1, getArticleById, updateArticle, getAutomationSettings } from '../../../lib/runtime-db';
import { synthesizeNewsArticle } from '../../../lib/ai-engine';
import { generateEditorialSvgDataUrl, isPublisherLogoOrBanner } from '../../../lib/editorial-image';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getD1(locals);
    const body = (await request.json().catch(() => ({}))) as {
      article_id?: string;
      custom_instruction?: string;
      rewrite_mode?: 'fresh_from_headline' | 'full';
    };

    if (!body.article_id) {
      return new Response(JSON.stringify({ error: 'Article ID is required' }), { status: 400 });
    }

    const article = await getArticleById(db, body.article_id);
    if (!article) {
      return new Response(JSON.stringify({ error: 'Article not found' }), { status: 404 });
    }

    const autoSettings = await getAutomationSettings(db);
    const settingsMap: Record<string, string> = {};
    for (const s of autoSettings) {
      settingsMap[s.key] = s.value;
    }

    const aiConfig = {
      openrouterApiKey: settingsMap.openrouter_api_key,
      openrouterModel: settingsMap.openrouter_model,
      cloudflareAccountId: settingsMap.cloudflare_account_id,
      cloudflareApiToken: settingsMap.cloudflare_api_token,
      cloudflareModel: settingsMap.cloudflare_ai_model,
      localAiEndpoint: settingsMap.local_ai_endpoint,
      localAiModel: settingsMap.local_ai_model,
    };

    // Determine content fed into the AI synthesizer based on rewrite_mode
    const isFreshFromHeadline = body.rewrite_mode === 'fresh_from_headline';
    const rawWireContent = isFreshFromHeadline
      ? `Investigative Wire Dispatch: Focus purely on this verified headline: "${article.title}". ${body.custom_instruction ? `EDITORIAL INSTRUCTION FROM ADMIN: ${body.custom_instruction}` : ''}`
      : `${article.content || article.summary || article.title} ${body.custom_instruction ? `\n\nEDITORIAL INSTRUCTION FROM ADMIN: ${body.custom_instruction}` : ''}`;

    // Synthesize authentic news content strictly grounded on the article's real topic
    const aiResult = await synthesizeNewsArticle(
      {
        title: article.title,
        sourceName: article.source_name || 'Verified Wire',
        originalUrl: (article as any).original_url || (article as any).source_url || '',
        description: isFreshFromHeadline ? article.title : (article.summary || article.title),
        content: rawWireContent,
        categoryDefault: article.category_id || 'cat_naija_news',
      },
      aiConfig
    );

    if (!aiResult.success) {
      return new Response(
        JSON.stringify({
          error: aiResult.error || 'Failed to re-synthesize article',
          traceLogs: aiResult.traceLogs,
        }),
        { status: 500 }
      );
    }

    // Determine clean image
    let newImageUrl = article.image_url;
    if (!newImageUrl || isPublisherLogoOrBanner(newImageUrl) || newImageUrl.includes('pollinations.ai')) {
      newImageUrl = generateEditorialSvgDataUrl({
        title: aiResult.title || article.title,
        category: aiResult.categoryId || article.category_id || 'cat_naija_news',
        sourceName: article.source_name || '9jaBeacon Wire',
      });
    }

    await updateArticle(db, article.id, {
      title: aiResult.title || article.title,
      summary: aiResult.summary || article.summary,
      content: aiResult.content,
      category_id: aiResult.categoryId || article.category_id,
      image_url: newImageUrl,
      image_credit: '9jaBeacon Verified Wire',
      reading_time_minutes: aiResult.readingTimeMinutes || 3,
      updated_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        article_id: article.id,
        updatedTitle: aiResult.title || article.title,
        modelUsed: aiResult.modelUsed,
        traceLogs: aiResult.traceLogs,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
