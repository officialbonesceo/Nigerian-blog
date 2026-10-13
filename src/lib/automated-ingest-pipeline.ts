/**
 * Full ingestion pipeline: fetch → rewrite (Gemini → multi-tier AI) → D1 insert → syndicate
 */
import type { D1Database } from '@cloudflare/workers-types';
import {
  normalizeCategory,
  getDeskAttribution,
  categorySlugToId,
} from './editorial-pipeline';
import {
  createArticle,
  invalidateCache,
  recordRejectedArticle,
  getSources,
  getSourceById,
  getAutomationSettings,
  getSiteSettings,
} from './runtime-db';
import type { Article } from './types';
import { resolveEditorialImage } from './editorial-image';
import { postToBluesky, checkIfUrlAlreadyOnBlueskyTimeline } from './bluesky';
import { postToBuffer } from './buffer';
import { postToTumblr, checkIfUrlAlreadyOnTumblrBlog } from './tumblr';
import { postToThreads } from './threads';
import { fetchRss } from './automated-ingest-fetch';
import { rewriteWithEditorialQuality } from './automated-ingest-rewrite';
import { generateBaseSlug } from './automated-ingest-helpers';
import type { IngestionPipelineResult, EditorialRewriteResult } from './automated-ingest-types';

/** Map multi-tier synthesizeNewsArticle result into EditorialRewriteResult shape. */
async function rewriteWithFallback(input: {
  title: string;
  link?: string;
  description?: string;
  content?: string;
  categoryDefault?: string;
  sourceName?: string;
}): Promise<EditorialRewriteResult> {
  const primary = await rewriteWithEditorialQuality(input);
  if (primary.success && primary.title && primary.content) {
    return primary;
  }

  try {
    // Dynamic import avoids static cycle: ai-engine → automated-ingest barrel → pipeline
    const { synthesizeNewsArticle } = await import('./ai-engine');
    const multi = await synthesizeNewsArticle(
      {
        title: input.title,
        sourceName: input.sourceName || 'Wire',
        originalUrl: input.link,
        description: input.description,
        content: input.content,
        categoryDefault: input.categoryDefault,
      },
      {
        geminiApiKey: process.env.GEMINI_API_KEY,
        cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
        openrouterApiKey: process.env.OPENROUTER_API_KEY,
        localAiEndpoint: process.env.LOCAL_AI_ENDPOINT,
        localAiModel: process.env.LOCAL_AI_MODEL,
        pollinationsApiKey: process.env.POLLINATIONS_API_KEY,
      }
    );

    if (multi.success && multi.title && multi.content) {
      const catSlug =
        multi.categoryId === 'cat_money_hustle'
          ? 'business'
          : multi.categoryId === 'cat_sports'
            ? 'sports'
            : multi.categoryId === 'cat_world'
              ? 'world'
              : normalizeCategory(undefined, multi.title, multi.content.replace(/<[^>]+>/g, ' '));

      return {
        success: true,
        title: multi.title,
        summary: multi.summary || multi.title,
        content: multi.content,
        category: catSlug as any,
        tags: multi.tags || ['news', 'nigeria'],
        readingTimeMinutes: multi.readingTimeMinutes || 3,
        imageSearchKeyword: multi.imageSearchKeyword,
        faq: multi.faq,
      };
    }

    const multiErr =
      multi.error || (multi.traceLogs || []).slice(-3).join('; ') || 'Multi-tier synthesis failed';
    return {
      success: false,
      reasons: [...(primary.reasons || ['Gemini rewrite failed']), `Fallback AI: ${multiErr}`],
      rawError: multiErr,
    };
  } catch (fbErr: any) {
    return {
      success: false,
      reasons: [
        ...(primary.reasons || ['Gemini rewrite failed']),
        `Fallback exception: ${fbErr?.message || String(fbErr)}`,
      ],
      rawError: fbErr?.message || String(fbErr),
    };
  }
}

export async function runIngestionPipeline(
  db: D1Database,
  options: { sourceId?: string; categoryId?: string; limitPerSource?: number } = {}
): Promise<IngestionPipelineResult> {
  const result: IngestionPipelineResult = {
    fetched: 0,
    passed: 0,
    rejected: 0,
    inserted: 0,
    errors: [],
  };

  try {
    let sources: any[] = [];
    if (options.sourceId) {
      const src = await getSourceById(db, options.sourceId);
      if (src) sources.push(src);
    } else {
      const allEnabled = (await getSources(db)).filter((s: any) => s.is_enabled);
      if (options.categoryId) {
        sources = allEnabled.filter((s: any) => s.category_default_id === options.categoryId);
      } else {
        const byCategory: Record<string, any[]> = {
          cat_money_hustle: [],
          cat_sports: [],
          cat_world: [],
          cat_naija_news: [],
        };
        for (const s of allEnabled) {
          const catKey = s.category_default_id || 'cat_naija_news';
          if (byCategory[catKey]) {
            byCategory[catKey].push(s);
          } else {
            byCategory.cat_naija_news.push(s);
          }
        }
        const interleaved: any[] = [];
        const keys = ['cat_money_hustle', 'cat_sports', 'cat_world', 'cat_naija_news'];
        const maxLen = Math.max(...keys.map((k) => byCategory[k].length), 0);
        for (let i = 0; i < maxLen; i++) {
          for (const k of keys) {
            if (byCategory[k][i]) interleaved.push(byCategory[k][i]);
          }
        }
        sources = interleaved.length ? interleaved : allEnabled;
      }
    }

    const limit = Math.min(Math.max(options.limitPerSource || 3, 1), 10);

    for (const source of sources) {
      if (!source || !source.feed_url) continue;

      const feedUrlLower = String(source.feed_url || '').toLowerCase();
      if (
        feedUrlLower.includes('reuters.com') &&
        (feedUrlLower.includes('/africa') || feedUrlLower.includes('reutersafrica'))
      ) {
        result.errors.push(`Source ${source.name}: skipped (known-dead Reuters Africa feed URL)`);
        continue;
      }

      const feedRes = await fetchRss(source.feed_url);
      if (!feedRes.success || !feedRes.items.length) {
        const errMsg = feedRes.error || 'No items';
        if (/404|not found/i.test(errMsg)) {
          result.errors.push(`Source ${source.name}: dead feed (${errMsg}) — disable in admin`);
        } else {
          result.errors.push(`Source ${source.name}: ${errMsg}`);
        }
        continue;
      }

      result.fetched += feedRes.items.length;

      for (const item of feedRes.items.slice(0, limit)) {
        const cleanLink = (item.link || '').trim();
        const cleanTitle = (item.title || '').trim();
        const baseSlug = generateBaseSlug(cleanTitle);

        if (cleanLink) {
          const matchUrl = await db
            .prepare('SELECT id FROM articles WHERE source_original_url = ? LIMIT 1')
            .bind(cleanLink)
            .first<{ id: string }>()
            .catch(() => null);
          if (matchUrl) continue;
          const matchRej = await db
            .prepare('SELECT id FROM rejected_articles WHERE original_url = ? LIMIT 1')
            .bind(cleanLink)
            .first<{ id: string }>()
            .catch(() => null);
          if (matchRej) continue;
        }

        if (cleanTitle) {
          const matchTitle = await db
            .prepare('SELECT id FROM articles WHERE LOWER(title) = LOWER(?) LIMIT 1')
            .bind(cleanTitle)
            .first<{ id: string }>()
            .catch(() => null);
          if (matchTitle) continue;
        }

        const matchSlug = await db
          .prepare('SELECT id FROM articles WHERE slug = ? OR slug LIKE ? LIMIT 1')
          .bind(baseSlug, `${baseSlug}-%`)
          .first<{ id: string }>()
          .catch(() => null);
        if (matchSlug) continue;

        const rewrite = await rewriteWithFallback({
          title: item.title,
          link: item.link,
          description: item.description,
          content: item.content,
          categoryDefault: source.category_default_id,
          sourceName: source.name,
        });

        if (!rewrite.success || !rewrite.title || !rewrite.content) {
          result.rejected++;
          const reasonStr = (rewrite.reasons || ['Synthesis failed']).join('; ');
          await recordRejectedArticle(db, {
            source_id: source.id,
            source_name: source.name,
            original_title: item.title,
            original_url: item.link,
            raw_content: item.content || item.description || '',
            rejection_reason: reasonStr,
            ai_tier_failures: rewrite.rawError || reasonStr,
          }).catch(() => {});
          continue;
        }

        result.passed++;

        const categorySlug = rewrite.category || 'naija-news';
        const categoryId = categorySlugToId(categorySlug);
        const desk = getDeskAttribution(categorySlug);
        const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

        const visual = await resolveEditorialImage({
          title: rewrite.title,
          content: rewrite.content,
          category: categorySlug,
          sourceName: source.name,
          sourceImageUrl: item.imageUrl,
          aiKeyword: rewrite.imageSearchKeyword,
        });

        const newArticle: Article = {
          id: `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          slug: uniqueSlug,
          title: rewrite.title,
          summary: rewrite.summary || rewrite.title,
          content: rewrite.content,
          category_id: categoryId,
          image_url: visual.imageUrl,
          image_caption: visual.imageCaption,
          image_credit: visual.imageCredit,
          image_license: visual.imageLicense,
          author_name: desk.authorName,
          author_role: desk.authorRole,
          author_avatar: '/editorial/naija-news-team.svg',
          is_top_story: 0,
          is_trending: 0,
          is_breaking: 0,
          views_count: 0,
          reading_time_minutes: rewrite.readingTimeMinutes || 3,
          source_id: source.id,
          source_name: source.name,
          source_original_url: item.link,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'published',
        };

        const inserted = await createArticle(db, newArticle as unknown as Record<string, unknown>);
        if (inserted) {
          result.inserted++;

          try {
            const autoSettings = await getAutomationSettings(db).catch(() => []);
            const sMap: Record<string, string> = {};
            for (const s of autoSettings) sMap[s.key] = s.value;
            const siteSettings = await getSiteSettings(db).catch(() => ({} as Record<string, string>));
            const siteBase = ((siteSettings as any).site_url || 'https://www.9jabeacon.name.ng').replace(
              /\/+$/,
              ''
            );
            const canonicalUrl = `${siteBase}/news/${newArticle.slug}`;

            const bskyAuto =
              sMap.bluesky_auto_post_enabled !== 'false' &&
              process.env.BLUESKY_AUTO_POST_ENABLED !== 'false';
            const bskyId =
              sMap.bluesky_identifier ||
              (typeof process !== 'undefined' ? process.env?.BLUESKY_IDENTIFIER : '');
            const bskyPass =
              sMap.bluesky_app_password ||
              (typeof process !== 'undefined' ? process.env?.BLUESKY_APP_PASSWORD : '');
            if (bskyAuto && bskyId && bskyPass) {
              checkIfUrlAlreadyOnBlueskyTimeline(bskyId, newArticle.slug, newArticle.title)
                .then(async (liveCheck) => {
                  if (liveCheck.exists) {
                    try {
                      await db
                        .prepare(
                          'UPDATE articles SET syndicated_bluesky = 1, syndicated_bluesky_at = ? WHERE slug = ?'
                        )
                        .bind(new Date().toISOString(), newArticle.slug)
                        .run();
                    } catch {}
                    return;
                  }
                  const bRes = await postToBluesky(
                    {
                      title: newArticle.title,
                      summary: newArticle.summary,
                      category: categorySlug,
                      imageUrl: newArticle.image_url,
                      slug: newArticle.slug,
                      canonicalUrl,
                    },
                    { identifier: bskyId, appPassword: bskyPass },
                    siteBase
                  );
                  if (bRes.success) {
                    try {
                      await db
                        .prepare(
                          'UPDATE articles SET syndicated_bluesky = 1, syndicated_bluesky_at = ? WHERE slug = ?'
                        )
                        .bind(new Date().toISOString(), newArticle.slug)
                        .run();
                    } catch {}
                  }
                })
                .catch(() => {});
            }

            const bufferToken = sMap.buffer_access_token || process.env.BUFFER_ACCESS_TOKEN;
            if (sMap.buffer_auto_post_enabled !== 'false' && bufferToken) {
              postToBuffer(
                {
                  title: newArticle.title,
                  summary: newArticle.summary,
                  url: canonicalUrl,
                  imageUrl: newArticle.image_url,
                },
                bufferToken
              ).catch(() => {});
            }

            const tumblrBlog = sMap.tumblr_blog_name || process.env.TUMBLR_BLOG_NAME;
            const tumblrKey = sMap.tumblr_api_key || process.env.TUMBLR_API_KEY;
            if (sMap.tumblr_auto_post_enabled !== 'false' && tumblrBlog && tumblrKey) {
              checkIfUrlAlreadyOnTumblrBlog(tumblrBlog, newArticle.slug)
                .then(async (exists) => {
                  if (exists) return;
                  await postToTumblr(
                    {
                      title: newArticle.title,
                      summary: newArticle.summary,
                      url: canonicalUrl,
                      imageUrl: newArticle.image_url,
                    },
                    { blogName: tumblrBlog, apiKey: tumblrKey }
                  );
                })
                .catch(() => {});
            }

            const threadsToken = sMap.threads_access_token || process.env.THREADS_ACCESS_TOKEN;
            if (sMap.threads_auto_post_enabled !== 'false' && threadsToken) {
              postToThreads(
                {
                  title: newArticle.title,
                  summary: newArticle.summary,
                  url: canonicalUrl,
                },
                threadsToken
              ).catch(() => {});
            }
          } catch (synErr: any) {
            console.warn('[Ingest Syndication]', synErr?.message || synErr);
          }
        }
      }
    }

    invalidateCache();
  } catch (pipelineErr: any) {
    result.errors.push(`Pipeline exception: ${pipelineErr.message || String(pipelineErr)}`);
  }

  return result;
}
