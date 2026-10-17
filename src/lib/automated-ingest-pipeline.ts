/**
 * Ingestion pipeline (efficiency + legal posture):
 * 1) Fetch all enabled RSS feeds (cheap)
 * 2) Dedup against DB
 * 3) Rank candidates locally (trend/recency/trust) — NO AI
 * 4) Take global top N (default 3)
 * 5) Full-page extract for those N only
 * 6) Multi-model rewrite only if source text is sufficient
 * 7) Insert + optional syndicate
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
import { rankCandidates, type RankableItem } from './ingest-ranker';
import { fetchFullArticleText } from './article-full-fetch';

/** Minimum plain-source characters before we allow AI rewrite (legal fail-closed). */
const MIN_SOURCE_CHARS = 280;

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

async function isDuplicate(
  db: D1Database,
  cleanLink: string,
  cleanTitle: string,
  baseSlug: string
): Promise<boolean> {
  if (cleanLink) {
    const matchUrl = await db
      .prepare('SELECT id FROM articles WHERE source_original_url = ? LIMIT 1')
      .bind(cleanLink)
      .first<{ id: string }>()
      .catch(() => null);
    if (matchUrl) return true;
    const matchRej = await db
      .prepare('SELECT id FROM rejected_articles WHERE original_url = ? LIMIT 1')
      .bind(cleanLink)
      .first<{ id: string }>()
      .catch(() => null);
    if (matchRej) return true;
  }
  if (cleanTitle) {
    const matchTitle = await db
      .prepare('SELECT id FROM articles WHERE LOWER(title) = LOWER(?) LIMIT 1')
      .bind(cleanTitle)
      .first<{ id: string }>()
      .catch(() => null);
    if (matchTitle) return true;
  }
  const matchSlug = await db
    .prepare('SELECT id FROM articles WHERE slug = ? OR slug LIKE ? LIMIT 1')
    .bind(baseSlug, `${baseSlug}-%`)
    .first<{ id: string }>()
    .catch(() => null);
  return !!matchSlug;
}

export async function runIngestionPipeline(
  db: D1Database,
  options: { sourceId?: string; categoryId?: string; limitPerSource?: number; maxArticles?: number } = {}
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
        sources = allEnabled;
      }
    }

    const envMax = parseInt(process.env.MAX_ARTICLES_PER_RUN || '3', 10);
    const maxArticles = Math.min(Math.max(options.maxArticles || envMax || 3, 1), 5);
    // Per-feed parse cap (still cheap); ranking picks global winners
    const perFeedCap = Math.min(Math.max(options.limitPerSource || 8, 3), 15);

    const pool: RankableItem[] = [];

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

      for (const item of feedRes.items.slice(0, perFeedCap)) {
        const cleanLink = (item.link || '').trim();
        const cleanTitle = (item.title || '').trim();
        if (!cleanLink || !cleanTitle) continue;
        const baseSlug = generateBaseSlug(cleanTitle);
        if (await isDuplicate(db, cleanLink, cleanTitle, baseSlug)) continue;

        pool.push({
          title: cleanTitle,
          link: cleanLink,
          description: item.description,
          content: item.content,
          pubDate: item.pubDate,
          imageUrl: item.imageUrl,
          sourceId: source.id,
          sourceName: source.name,
          categoryDefaultId: source.category_default_id,
          trustScore: typeof source.trust_score === 'number' ? source.trust_score : 90,
        });
      }
    }

    const ranked = rankCandidates(pool, maxArticles);
    console.log(
      `[ingest] pool=${pool.length} rankedTop=${ranked.length} maxArticles=${maxArticles} fetchedRssItems=${result.fetched}`
    );
    for (const r of ranked) {
      console.log(`  score=${r.score} ${r.reasons.join(',')} | ${r.title.slice(0, 70)}`);
    }

    for (const item of ranked) {
      const baseSlug = generateBaseSlug(item.title);

      // Full article extract for shortlist only
      const full = await fetchFullArticleText(item.link, { timeoutMs: 12000, maxChars: 8000 });
      const rssExcerpt = `${item.content || item.description || ''}`
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      let sourceBody = '';
      if (full.success && full.text.length >= MIN_SOURCE_CHARS) {
        sourceBody = full.text;
      } else if (rssExcerpt.length >= MIN_SOURCE_CHARS) {
        sourceBody = rssExcerpt;
      } else {
        // LEGAL FAIL-CLOSED: do not invent a long article from a thin teaser
        result.rejected++;
        const reason = `Insufficient source text for safe rewrite (full=${full.wordCount}w rss=${rssExcerpt.length}c err=${full.error || 'n/a'})`;
        await recordRejectedArticle(db, {
          source_id: item.sourceId,
          source_name: item.sourceName,
          original_title: item.title,
          original_url: item.link,
          raw_content: rssExcerpt.slice(0, 1500),
          rejection_reason: reason,
          ai_tier_failures: reason,
        }).catch(() => {});
        result.errors.push(`${item.sourceName}: ${reason}`);
        continue;
      }

      // Cap body sent to AI (cost + focus)
      const aiBody = sourceBody.slice(0, 6000);

      const rewrite = await rewriteWithFallback({
        title: item.title,
        link: item.link,
        description: rssExcerpt.slice(0, 500),
        content: aiBody,
        categoryDefault: item.categoryDefaultId,
        sourceName: item.sourceName,
      });

      if (!rewrite.success || !rewrite.title || !rewrite.content) {
        result.rejected++;
        const reasonStr = (rewrite.reasons || ['Synthesis failed']).join('; ');
        await recordRejectedArticle(db, {
          source_id: item.sourceId,
          source_name: item.sourceName,
          original_title: item.title,
          original_url: item.link,
          raw_content: aiBody.slice(0, 2000),
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
        sourceName: item.sourceName,
        sourceImageUrl: item.imageUrl,
        aiKeyword: rewrite.imageSearchKeyword,
      });

      // Attribution footer (legal transparency)
      const attrNote = `<p class="source-attr"><em>Reporting based on public reporting from ${item.sourceName}. <a href="${item.link}" rel="noopener noreferrer nofollow" target="_blank">Original source</a>.</em></p>`;
      let finalContent = rewrite.content;
      if (!/original source/i.test(finalContent)) {
        finalContent = `${finalContent}\n${attrNote}`;
      }

      const newArticle: Article = {
        id: `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        slug: uniqueSlug,
        title: rewrite.title,
        summary: rewrite.summary || rewrite.title,
        content: finalContent,
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
        source_id: item.sourceId,
        source_name: item.sourceName,
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

    invalidateCache();
  } catch (pipelineErr: any) {
    result.errors.push(`Pipeline exception: ${pipelineErr.message || String(pipelineErr)}`);
  }

  return result;
}
