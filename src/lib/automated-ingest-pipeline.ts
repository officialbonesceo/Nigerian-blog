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

function isInfrastructureFailure(reason: string): boolean {
  const r = (reason || '').toLowerCase();
  return (
    r.includes('gemini_api_key') ||
    r.includes('missing gemini') ||
    r.includes('not configured') ||
    r.includes('openrouter') ||
    r.includes('all gemini model tiers failed') ||
    r.includes('multi-tier synthesis failed') ||
    r.includes('all ai synthesis') ||
    r.includes('fallback exception') ||
    r.includes('rate limit') ||
    r.includes('429') ||
    r.includes('quota') ||
    r.includes('timeout') ||
    r.includes('network') ||
    r.includes('gemini skipped')
  );
}

async function rewriteWithFallback(input: {
  title: string;
  link?: string;
  description?: string;
  content?: string;
  categoryDefault?: string;
  sourceName?: string;
}): Promise<EditorialRewriteResult> {
  const hasGemini = !!(typeof process !== 'undefined' && process.env?.GEMINI_API_KEY);
  const hasOpenRouter = !!(typeof process !== 'undefined' && process.env?.OPENROUTER_API_KEY);
  if (!hasGemini) {
    console.warn('[ingest] GEMINI_API_KEY is empty — using OpenRouter/CF/Groq multi-tier');
  }
  if (!hasOpenRouter && !hasGemini) {
    console.warn('[ingest] No GEMINI or OPENROUTER key visible in env');
  }

  let primaryReasons: string[] = [];
  if (hasGemini) {
    const primary = await rewriteWithEditorialQuality(input);
    if (primary.success && primary.title && primary.content) {
      return primary;
    }
    primaryReasons = primary.reasons || ['Gemini rewrite failed'];
    console.warn('[ingest] primary rewrite failed:', primaryReasons.join('; '));
  } else {
    primaryReasons = ['Gemini skipped (no API key)'];
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
      console.log('[ingest] multi-tier success via', multi.provider, multi.modelUsed);
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
      multi.error || (multi.traceLogs || []).slice(-5).join('; ') || 'Multi-tier synthesis failed';
    console.warn('[ingest] multi-tier failed:', multiErr);
    if (multi.traceLogs?.length) {
      console.warn('[ingest] tier traces:', multi.traceLogs.slice(-8).join(' | '));
    }
    return {
      success: false,
      reasons: [...primaryReasons, `Fallback AI: ${multiErr}`],
      rawError: multiErr,
    };
  } catch (fbErr: any) {
    console.warn('[ingest] multi-tier exception:', fbErr?.message || fbErr);
    return {
      success: false,
      reasons: [...primaryReasons, `Fallback exception: ${fbErr?.message || String(fbErr)}`],
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
  // Prefer indexed equality only — never LOWER() or leading-wildcard LIKE (full scans).
  const idx = (globalThis as any).__9jaLocalDedup;
  if (process.env.USE_LOCAL_DEDUP === 'true' && idx) {
    const normU = (u: string) => (u || '').trim().split('#')[0].replace(/\/$/, '').toLowerCase();
    const normT = (t: string) => (t || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (cleanLink && idx.urls?.has(normU(cleanLink))) return true;
    if (cleanTitle && idx.titles?.has(normT(cleanTitle))) return true;
    if (baseSlug && idx.slugs?.has(String(baseSlug).toLowerCase())) return true;
  }

  if (cleanLink) {
    const matchUrl = await db
      .prepare('SELECT id FROM articles WHERE source_original_url = ? LIMIT 1')
      .bind(cleanLink)
      .first<{ id: string }>()
      .catch(() => null);
    if (matchUrl) return true;
    const matchRej = await db
      .prepare(
        'SELECT id, rejection_reason FROM rejected_articles WHERE original_url = ? ORDER BY created_at DESC LIMIT 1'
      )
      .bind(cleanLink)
      .first<{ id: string; rejection_reason?: string }>()
      .catch(() => null);
    if (matchRej) {
      if (isInfrastructureFailure(matchRej.rejection_reason || '')) {
        return false;
      }
      return true;
    }
  }
  if (cleanTitle) {
    // Exact title match only (indexed-friendly)
    const matchTitle = await db
      .prepare('SELECT id FROM articles WHERE title = ? LIMIT 1')
      .bind(cleanTitle)
      .first<{ id: string }>()
      .catch(() => null);
    if (matchTitle) return true;
  }
  // Exact slug only — random suffix on insert makes LIKE prefix scans unnecessary
  if (baseSlug) {
    const matchSlug = await db
      .prepare('SELECT id FROM articles WHERE slug = ? LIMIT 1')
      .bind(baseSlug)
      .first<{ id: string }>()
      .catch(() => null);
    if (matchSlug) return true;
  }
  return false;
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
        result.rejected++;
        const reason = `Insufficient source text for safe rewrite (full=${full.wordCount}w rss=${rssExcerpt.length}c err=${full.error || 'n/a'})`;
        console.warn('[ingest] REJECT thin source:', item.title.slice(0, 60), reason);
        await recordRejectedArticle(db, {
          source_id: item.sourceId,
          source_name: item.sourceName,
          original_title: item.title,
          original_url: item.link,
          raw_content: rssExcerpt.slice(0, 1500),
          rejection_reason: reason,
          ai_tier_failures: reason,
        }).catch(() => {});
        result.errors.push(`REJECT ${item.sourceName}: ${reason} | ${item.title.slice(0, 80)}`);
        continue;
      }

      const aiBody = sourceBody.slice(0, 6000);
      console.log(
        `[ingest] rewriting: ${item.title.slice(0, 60)} (sourceChars=${aiBody.length} fullOk=${full.success})`
      );

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
        console.warn('[ingest] REJECT rewrite:', item.title.slice(0, 60), reasonStr);
        result.errors.push(`REJECT rewrite ${item.sourceName}: ${reasonStr} | ${item.title.slice(0, 80)}`);

        if (!isInfrastructureFailure(reasonStr)) {
          await recordRejectedArticle(db, {
            source_id: item.sourceId,
            source_name: item.sourceName,
            original_title: item.title,
            original_url: item.link,
            raw_content: aiBody.slice(0, 2000),
            rejection_reason: reasonStr,
            ai_tier_failures: rewrite.rawError || reasonStr,
          }).catch(() => {});
        } else {
          console.warn('[ingest] soft-fail (infra) — will retry next run:', reasonStr.slice(0, 120));
        }
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

      const attrNote =
        '<p class="source-attr"><em>Reporting based on public reporting from ' +
        item.sourceName +
        '. <a href="' +
        item.link +
        '" rel="noopener noreferrer nofollow" target="_blank">Original source</a>.</em></p>';
      let finalContent = rewrite.content;
      if (!/original source/i.test(finalContent)) {
        finalContent = finalContent + attrNote;
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
        console.log('[ingest] INSERT', uniqueSlug, '| image:', (visual.imageUrl || '').slice(0, 60));
      }
    }

    invalidateCache();
  } catch (pipelineErr: any) {
    result.errors.push(`Pipeline exception: ${pipelineErr.message || String(pipelineErr)}`);
  }

  return result;
}
