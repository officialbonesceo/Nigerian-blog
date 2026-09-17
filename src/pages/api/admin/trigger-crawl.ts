import type { APIRoute } from 'astro';
import {
  getD1,
  getSources,
  getSourceById,
  createArticle,
  addAutomationLog,
  updateSource,
  getAutomationSettings,
  getSiteSettings,
  recordRejectedArticle,
} from '../../../lib/runtime-db';
import { fetchAndParseRssFeed } from '../../../lib/rss-parser';
import { synthesizeNewsArticle, generateEditorialNewsImage, type AiCredentialsConfig } from '../../../lib/ai-engine';
import { isPublisherLogoOrBanner } from '../../../lib/editorial-image';
import { postToBuffer, type BufferConfig } from '../../../lib/buffer';
import { submitUrlToBing, submitToIndexNow } from '../../../lib/bing-api';

interface TriggerCrawlBody {
  source_id?: string;
  limit_per_source?: number;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const workflowStartTime = Date.now();
  const sessionLogs: Array<{ action: string; source?: string; message: string; status: 'info' | 'warning' | 'error'; timestamp: string }> = [];

  const recordLog = async (db: any, action: string, sourceId: string | null, sourceName: string, message: string, status: 'info' | 'warning' | 'error' = 'info') => {
    const timestamp = new Date().toISOString();
    sessionLogs.push({ action, source: sourceName, message, status, timestamp });
    await addAutomationLog(db, action, sourceId, message, status).catch(() => {});
  };

  try {
    const db = getD1(locals);
    const body = (await request.json().catch(() => ({}))) as TriggerCrawlBody;
    const sourceId = body.source_id;
    const limitPerSource = Math.min(Math.max(Number(body.limit_per_source || 4), 1), 10);

    const autoSettings = await getAutomationSettings(db);
    const siteSettings = await getSiteSettings(db);
    const settingsMap: Record<string, string> = { ...siteSettings };
    for (const s of autoSettings) {
      settingsMap[s.key] = s.value;
    }

    const aiConfig: AiCredentialsConfig = {
      cloudflareAccountId: settingsMap.cloudflare_account_id,
      cloudflareApiToken: settingsMap.cloudflare_api_token,
      cloudflareModel: settingsMap.cloudflare_ai_model || '@cf/meta/llama-3.1-8b-instruct',
      openrouterApiKey: settingsMap.openrouter_api_key,
      openrouterModel: settingsMap.openrouter_model || 'qwen/qwen-2.5-72b-instruct:free',
      localAiEndpoint: settingsMap.local_ai_endpoint || '',
      localAiModel: settingsMap.local_ai_model || 'qwen2.5:3b',
      localAiApiKey: settingsMap.local_ai_api_key || 'ollama',
      pollinationsApiKey: settingsMap.pollinations_api_key,
    };

    const bufferConfig: BufferConfig = {
      accessToken: (settingsMap.buffer_access_token || (typeof process !== 'undefined' ? process.env?.BUFFER_ACCESS_TOKEN : '') || '').trim(),
      facebookProfileId: (settingsMap.buffer_profile_ids_facebook || (typeof process !== 'undefined' ? process.env?.BUFFER_FACEBOOK_PROFILE_ID : '') || '').trim(),
      instagramProfileId: (settingsMap.buffer_profile_ids_instagram || (typeof process !== 'undefined' ? process.env?.BUFFER_INSTAGRAM_PROFILE_ID : '') || '').trim(),
      autoPostEnabled: settingsMap.buffer_auto_post_enabled === 'true' || settingsMap.buffer_auto_post_enabled === '1',
      maxPostsPerWorkflow: Math.max(Number(settingsMap.buffer_max_posts_per_workflow || 5), 1),
    };
    let bufferPostsSent = 0;

    const sourcesToCrawl = sourceId
      ? [await getSourceById(db, sourceId)].filter((s): s is NonNullable<typeof s> => Boolean(s))
      : (await getSources(db)).filter((s: any) => s.is_enabled);

    await recordLog(
      db,
      'WORKFLOW_START',
      null,
      'System',
      `Starting autonomous ingestion across ${sourcesToCrawl.length} source(s). AI Waterfall: [1] Cloudflare -> [2] OpenRouter (Qwen/DeepSeek) -> [3] Local AI (${aiConfig.localAiModel} @ ${aiConfig.localAiEndpoint}) -> [4] Pollinations. (Strict AI generation with modular section resilience)`,
      'info'
    );

    let totalIngested = 0;
    let totalRejectedNoAi = 0;
    const results = [];

    for (const source of sourcesToCrawl) {
      if (!source) continue;
      const sourceStartTime = Date.now();

      await recordLog(
        db,
        'CRAWL_FETCH',
        source.id,
        source.name,
        `Fetching latest RSS feed from: ${source.feed_url}`,
        'info'
      );

      const parsed = await fetchAndParseRssFeed(source.feed_url);
      if (!parsed.success || !parsed.items || parsed.items.length === 0) {
        const errorMsg = parsed.error || 'No items found in feed';
        await recordLog(db, 'CRAWL_ERROR', source.id, source.name, `Failed to parse feed: ${errorMsg}`, 'error');
        await recordRejectedArticle(db, {
          source_id: source.id,
          source_name: source.name,
          original_title: `Feed fetch error for ${source.name}`,
          original_url: source.feed_url,
          rejection_reason: `RSS Feed XML was unreadable or empty: ${errorMsg}`,
          ai_tier_failures: 'Feed Parse Failed',
        });
        results.push({ source: source.name, success: false, error: errorMsg });
        continue;
      }

      await recordLog(
        db,
        'FEED_PARSED',
        source.id,
        source.name,
        `Parsed ${parsed.items.length} raw leads from ${source.name}. Processing top ${limitPerSource} items for AI synthesis.`,
        'info'
      );

      let ingestedFromSource = 0;
      let rejectedFromSource = 0;

      for (const item of parsed.items.slice(0, limitPerSource)) {
        const rawTitle = (item.title || 'Untitled Lead').trim();

        await recordLog(
          db,
          'AI_SYNTHESIS_START',
          source.id,
          source.name,
          `Initiating AI synthesis for lead: "${rawTitle.slice(0, 50)}..."`,
          'info'
        );

        try {
          // 4-TIER MULTI-LLM SYNTHESIS (Cloudflare -> OpenRouter Qwen -> Local Qwen -> Pollinations -> Editorial Core)
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

          // Only log trace messages for debugging if synthesis failed, preventing false warning flood
          if (!aiResult.success && aiResult.traceLogs && aiResult.traceLogs.length > 0) {
            // Keep full trace in rejected articles table, record concise summary in logs
            const lastError = aiResult.traceLogs.filter(t => t.includes('Error') || t.includes('Failed')).pop() || 'AI synthesis incomplete';
            await recordLog(
              db,
              'AI_SYNTHESIS_RETRY',
              source.id,
              source.name,
              `[${rawTitle.slice(0, 35)}...] Fallback exhausted: ${lastError}`,
              'info'
            );
          }

          if (!aiResult.success || !aiResult.title || !aiResult.content) {
            rejectedFromSource++;
            totalRejectedNoAi++;
            const failureDetail = aiResult.error || 'All AI tiers & editorial engine were unable to synthesize valid article content';
            await recordRejectedArticle(db, {
              source_id: source.id,
              source_name: source.name,
              original_title: item.title || 'Untitled Lead',
              original_url: item.link || source.website_url,
              raw_content: item.description || item.content || '',
              rejection_reason: failureDetail,
              ai_tier_failures: (aiResult.traceLogs || []).join(' -> '),
            });
            await recordLog(
              db,
              'ARTICLE_REJECTED',
              source.id,
              source.name,
              `Rejected lead "${rawTitle.slice(0, 45)}...": Logged in Unresolved/Rejected Queue. Reason: ${failureDetail}`,
              'warning'
            );
            continue;
          }

          const categoryId = aiResult.categoryId || source.category_default_id || 'cat_naija_news';

          // Image handling & validation: Strictly reject publisher logos and avatars
          let finalImageUrl = item.enclosureUrl;
          if (finalImageUrl && isPublisherLogoOrBanner(finalImageUrl)) {
            finalImageUrl = undefined;
          }

          let imageCaption = `Synthesized report based on wire from ${source.name}.`;
          let imageCredit = source.name;

          if (!finalImageUrl) {
            await recordLog(
              db,
              'IMAGE_GENERATION',
              source.id,
              source.name,
              `No authentic story photo found (or was publisher logo). Generating crisp 9jaBeacon editorial SVG vector card.`,
              'info'
            );
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

          let authorName = '9jaBeacon Editorial Team';
          let authorRole = 'National Affairs & Governance Desk';

          if (categoryId === 'cat_money_hustle' || categoryId === 'cat_business') {
            authorName = '9jaBeacon Finance Team';
            authorRole = 'Markets, Banking & Economy Desk';
          } else if (categoryId === 'cat_sports') {
            authorName = '9jaBeacon Sports Desk';
            authorRole = 'Sports & Athletics Desk';
          } else if (categoryId === 'cat_world') {
            authorName = '9jaBeacon World News Desk';
            authorRole = 'Global Foreign Affairs Desk';
          }

          const publishedArticle = await createArticle(db, {
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
            author_name: authorName,
            author_role: authorRole,
            is_top_story: 0,
            is_trending: 1,
            is_breaking: 0,
            reading_time_minutes: aiResult.readingTimeMinutes || 3,
            status: 'published',
          });

          ingestedFromSource++;
          totalIngested++;

          // Autonomous Buffer Social Posting (up to 5 per workflow)
          if (
            publishedArticle &&
            bufferConfig.autoPostEnabled &&
            bufferConfig.accessToken &&
            bufferPostsSent < bufferConfig.maxPostsPerWorkflow
          ) {
            try {
              const siteDomain = (settingsMap.site_url || 'https://9jabeacon.name.ng').replace(/\/+$/, '');
              const canonicalUrl = `${siteDomain}/news/${publishedArticle.slug}`;
              const categoryName = categoryId === 'cat_money_hustle' ? 'Business' : categoryId === 'cat_sports' ? 'Sports' : categoryId === 'cat_world' ? 'World' : 'Naija News';

              const postRes = await postToBuffer(bufferConfig, {
                title: publishedArticle.title,
                summary: publishedArticle.summary || aiResult.summary || '',
                categoryName,
                canonicalUrl,
                imageUrl: finalImageUrl,
              });

              if (postRes.success) {
                bufferPostsSent++;
                await recordLog(
                  db,
                  'BUFFER_POST',
                  source.id,
                  source.name,
                  `[Buffer Social Auto-Post ${bufferPostsSent}/${bufferConfig.maxPostsPerWorkflow}] Successfully dispatched to Facebook & Instagram: "${publishedArticle.title.slice(0, 45)}..."`,
                  'info'
                );
              } else {
                await recordLog(
                  db,
                  'BUFFER_NOTICE',
                  source.id,
                  source.name,
                  `Buffer dispatch skipped: ${postRes.error}`,
                  'warning'
                );
              }
            } catch (bufErr: any) {
              await recordLog(
                db,
                'BUFFER_ERROR',
                source.id,
                source.name,
                `Buffer dispatch error: ${bufErr.message}`,
                'warning'
              );
            }
          }

          // Automated Bing Webmaster & IndexNow Submission
          const bingApiKey = (settingsMap.bing_api_key || '').trim();
          const bingAutoSubmit = settingsMap.bing_auto_submit_enabled === '1' || settingsMap.bing_auto_submit_enabled === 'true';
          if (publishedArticle && bingApiKey && bingAutoSubmit) {
            try {
              const siteDomain = (settingsMap.site_url || 'https://9jabeacon.name.ng').replace(/\/+$/, '');
              const canonicalUrl = `${siteDomain}/news/${publishedArticle.slug}`;
              const bingRes = await submitUrlToBing(canonicalUrl, {
                apiKey: bingApiKey,
                siteUrl: siteDomain,
              });

              if (bingRes.success) {
                await recordLog(
                  db,
                  'BING_SUBMIT',
                  source.id,
                  source.name,
                  `[Bing Automated Indexing] URL submitted successfully: ${canonicalUrl}`,
                  'info'
                );
              } else {
                await recordLog(
                  db,
                  'BING_NOTICE',
                  source.id,
                  source.name,
                  `Bing URL submission notice: ${bingRes.message}`,
                  'warning'
                );
              }

              // IndexNow companion ping
              const indexNowKey = (settingsMap.indexnow_key || bingApiKey).trim();
              if (indexNowKey) {
                const host = new URL(siteDomain).hostname;
                await submitToIndexNow([canonicalUrl], { host, key: indexNowKey }).catch(() => {});
              }
            } catch (bingErr: any) {
              await recordLog(
                db,
                'BING_ERROR',
                source.id,
                source.name,
                `Bing automated submission error: ${bingErr.message}`,
                'warning'
              );
            }
          }

          await recordLog(
            db,
            'ARTICLE_PUBLISHED',
            source.id,
            source.name,
            `Successfully published "${aiResult.title.slice(0, 50)}..." in category [${categoryId}] via [${aiResult.provider} / ${aiResult.modelUsed}]`,
            'info'
          );
        } catch (itemErr: any) {
          await recordLog(
            db,
            'ITEM_SKIPPED',
            source.id,
            source.name,
            `Duplicate or insert conflict on item: ${rawTitle.slice(0, 40)} (${itemErr.message})`,
            'info'
          );
        }
      }

      await updateSource(db, source.id, { last_fetched_at: new Date().toISOString() });
      const sourceElapsedMs = Date.now() - sourceStartTime;

      await recordLog(
        db,
        'SOURCE_COMPLETED',
        source.id,
        source.name,
        `Finished ${source.name} in ${(sourceElapsedMs / 1000).toFixed(1)}s: ${ingestedFromSource} rewritten & published, ${rejectedFromSource} rejected.`,
        'info'
      );

      results.push({
        source: source.name,
        success: true,
        published: ingestedFromSource,
        rejectedNoAi: rejectedFromSource,
        durationMs: sourceElapsedMs,
      });
    }

    const totalElapsedSec = ((Date.now() - workflowStartTime) / 1000).toFixed(1);
    await recordLog(
      db,
      'WORKFLOW_SUMMARY',
      null,
      'System',
      `Workflow complete in ${totalElapsedSec}s: Ingested & published ${totalIngested} rewritten news articles. ${totalRejectedNoAi} rejected leads logged.`,
      'info'
    );

    return new Response(JSON.stringify({
      success: true,
      totalIngested,
      totalRejectedNoAi,
      durationSeconds: Number(totalElapsedSec),
      results,
      logs: sessionLogs,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
      logs: sessionLogs,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

