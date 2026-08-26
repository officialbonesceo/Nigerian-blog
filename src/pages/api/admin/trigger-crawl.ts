import type { APIRoute } from 'astro';
import { getSources, getSourceById, createArticle, addAutomationLog, updateSource, getAutomationSettings, recordRejectedArticle } from '../../../lib/db';
import { fetchAndParseRssFeed } from '../../../lib/rss-parser';
import { synthesizeNewsArticle, generateEditorialNewsImage, type AiCredentialsConfig } from '../../../lib/ai-engine';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const sourceId = body.source_id;

    const autoSettings = getAutomationSettings();
    const settingsMap: Record<string, string> = {};
    for (const s of autoSettings) {
      settingsMap[s.key] = s.value;
    }

    const aiConfig: AiCredentialsConfig = {
      cloudflareAccountId: settingsMap.cloudflare_account_id,
      cloudflareApiToken: settingsMap.cloudflare_api_token,
      cloudflareModel: settingsMap.cloudflare_ai_model || '@cf/meta/llama-3.1-8b-instruct',
      openrouterApiKey: settingsMap.openrouter_api_key,
      openrouterModel: settingsMap.openrouter_model || 'meta-llama/llama-3.3-70b-instruct:free',
      pollinationsApiKey: settingsMap.pollinations_api_key,
    };

    const sourcesToCrawl = sourceId ? [getSourceById(sourceId)].filter(Boolean) : getSources().filter((s: any) => s.is_enabled);

    let totalIngested = 0;
    let totalRejectedNoAi = 0;
    const results = [];

    for (const source of sourcesToCrawl) {
      if (!source) continue;
      addAutomationLog('CRAWL_TRIGGERED', source.id, `Manual crawl triggered for source: ${source.name}`, 'info');

      const parsed = await fetchAndParseRssFeed(source.feed_url);
      if (!parsed.success || !parsed.items) {
        addAutomationLog('CRAWL_ERROR', source.id, `Failed to parse feed: ${parsed.error}`, 'error');
        recordRejectedArticle({
          source_id: source.id,
          source_name: source.name,
          original_title: `Feed parse error for ${source.name}`,
          original_url: source.feed_url,
          rejection_reason: `RSS Feed XML was unreadable or malformed: ${parsed.error}`,
          ai_tier_failures: 'Feed Parse Failed',
        });
        results.push({ source: source.name, success: false, error: parsed.error });
        continue;
      }

      let ingestedFromSource = 0;
      let rejectedFromSource = 0;

      for (const item of parsed.items.slice(0, 4)) {
        try {
          // STRICT 3-TIER AI SYNTHESIS
          const aiResult = await synthesizeNewsArticle(
            {
              title: item.title,
              sourceName: source.name,
              originalUrl: item.link,
              description: item.description,
              content: item.content,
              categoryDefault: source.category_default_id,
            },
            aiConfig
          );

          // STRICT SAFETY GATE: No AI rewrite = Record in rejected news queue & Prohibit publishing
          if (!aiResult.success || !aiResult.title || !aiResult.content) {
            rejectedFromSource++;
            totalRejectedNoAi++;
            recordRejectedArticle({
              source_id: source.id,
              source_name: source.name,
              original_title: item.title || 'Untitled Lead',
              original_url: item.link || source.website_url,
              raw_content: item.description || item.content || '',
              rejection_reason: aiResult.error || 'AI Synthesis Failed: Content unclear or unparseable by all 3 LLM tiers',
              ai_tier_failures: `Tier 1: Cloudflare -> Tier 2: OpenRouter -> Tier 3: Pollinations (${aiResult.error || 'No response'})`,
            });
            addAutomationLog(
              'AI_GATE_REJECTED',
              source.id,
              `Story "${(item.title || '').slice(0, 45)}..." recorded in Unresolved/Rejected tab: AI could not verify/synthesize.`,
              'warning'
            );
            continue;
          }

          const categoryId = aiResult.categoryId || source.category_default_id || 'cat_naija_news';

          // Image generation handling
          let finalImageUrl = item.enclosureUrl;
          let imageCaption = `Synthesized report based on wire from ${source.name}.`;
          let imageCredit = source.name;

          if (!finalImageUrl) {
            const genImg = await generateEditorialNewsImage(
              {
                title: aiResult.title,
                categoryId,
                summary: aiResult.summary,
              },
              aiConfig
            );
            finalImageUrl = genImg.imageUrl;
            imageCaption = genImg.caption;
            imageCredit = genImg.credit;
          }

          createArticle({
            title: aiResult.title,
            summary: aiResult.summary || item.description,
            content: aiResult.content,
            category_id: categoryId,
            image_url: finalImageUrl,
            image_caption: imageCaption,
            image_credit: imageCredit,
            image_license: source.license_notes || 'Editorial Fair Attribution',
            source_id: source.id,
            source_name: source.name,
            source_original_url: item.link,
            author_name: '9jaBeacon Editorial Desk',
            author_role: `Synthesized with ${aiResult.provider === 'cloudflare_workers_ai' ? 'Cloudflare Workers AI' : aiResult.provider === 'openrouter_ai' ? 'OpenRouter AI (' + aiResult.modelUsed + ')' : 'Pollinations AI'}`,
            is_top_story: 0,
            is_trending: 1,
            is_breaking: 0,
            reading_time_minutes: aiResult.readingTimeMinutes || 3,
            status: 'published',
          });

          ingestedFromSource++;
          totalIngested++;

          addAutomationLog(
            'ARTICLE_PUBLISHED',
            source.id,
            `Synthesized & published "${aiResult.title.slice(0, 45)}..." via ${aiResult.provider}`,
            'info'
          );
        } catch {
          // Ignore unique duplicate constraint
        }
      }

      updateSource(source.id, { last_fetched_at: new Date().toISOString() });
      addAutomationLog('CRAWL_COMPLETE', source.id, `Completed ingestion for ${source.name}: ${ingestedFromSource} published, ${rejectedFromSource} logged in rejected queue.`, 'info');
      results.push({
        source: source.name,
        success: true,
        published: ingestedFromSource,
        rejectedNoAi: rejectedFromSource,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      totalIngested,
      totalRejectedNoAi,
      results,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
