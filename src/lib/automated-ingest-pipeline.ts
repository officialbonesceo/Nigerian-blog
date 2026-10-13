/**
 * Full ingestion pipeline: fetch → rewrite → D1 insert → syndicate
 * Full implementation restored from local artifacts.
 */
import type { D1Database } from '@cloudflare/workers-types';
import {
  normalizeCategory,
  qualityGate,
  getDeskAttribution,
  categorySlugToId,
  type ArticleCategory,
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
import { isPublisherLogoOrBanner, resolveEditorialImage } from './editorial-image';
import { postToBluesky, checkIfUrlAlreadyOnBlueskyTimeline } from './bluesky';
import { postToBuffer } from './buffer';
import { postToTumblr, checkIfUrlAlreadyOnTumblrBlog } from './tumblr';
import { postToThreads } from './threads';
import { fetchRss } from './automated-ingest-fetch';
import { rewriteWithEditorialQuality } from './automated-ingest-rewrite';
import { generateBaseSlug } from './automated-ingest-helpers';
import type { IngestionPipelineResult } from './automated-ingest-types';

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

      const feedRes = await fetchRss(source.feed_url);
      if (!feedRes.success || !feedRes.items.length) {
        result.errors.push(`Source ${source.name}: ${feedRes.error || 'No items'}`);
        continue;
      }

      result.fetched += feedRes.items.length;

      for (const item of feedRes.items.slice(0, limit)) {
        const cleanLink = (item.link || '').trim();
        const cleanTitle = (item.title || '').trim();
        const baseSlug = generateBaseSlug(cleanTitle);

        if (cleanLink) {
          const matchUrl = await db.prepare('SELECT id FROM articles WHERE source_original_url = ? LIMIT 1').bind(cleanLink).first<{ id: string }>().catch(() => null);
          if (matchUrl) continue;
          const matchRej = await db.prepare('SELECT id FROM rejected_articles WHERE original_url = ? LIMIT 1').bind(cleanLink).first<{ id: string }>().catch(() => null);
          if (matchRej) continue;
        }

        if (cleanTitle) {
          const matchTitle = await db.prepare('SELECT id FROM articles WHERE LOWER(title) = LOWER(?) LIMIT 1').bind(cleanTitle).first<{ id: string }>().catch(() => null);
          if (matchTitle) continue;
        }

        const matchSlug = await db.prepare('SELECT id FROM articles WHERE slug = ? OR slug LIKE ? LIMIT 1').bind(baseSlug, `${baseSlug}-%`).first<{ id: string }>().catch(() => null);
        if (matchSlug) continue;

        const rewrite = await rewriteWithEditorialQuality({
          title: item.title,
          link: item.link,
          description: item.description,
          content: item.content,
          categoryDefault: source.category_default_id,
          sourceName: source.name,
        });

        if (!rewrite.success || !rewrite.title || !rewrite.content) {
          result.rejected++;
          const reasons = rewrite.reasons || [rewrite.rawError || 'Rewrite failed'];
          try {
            await recordRejectedArticle(db, {
              title: cleanTitle,
              original_url: cleanLink,
              source_name: source.name,
              reasons: reasons.join('; '),
            });
          } catch {}
          continue;
        }

        result.passed++;

        const catId = rewrite.category ? categorySlugToId(rewrite.category) : (source.category_default_id || 'cat_naija_news');
        const slug = `${baseSlug}-${Date.now().toString(36).slice(-5)}`;

        let imageUrl = item.imageUrl;
        if (!imageUrl || isPublisherLogoOrBanner(imageUrl)) {
          try {
            const resolved = await resolveEditorialImage({
              title: rewrite.title,
              categoryId: catId,
              keyword: rewrite.imageSearchKeyword,
            });
            imageUrl = resolved?.url;
          } catch {}
        }

        try {
          const article = await createArticle(db, {
            title: rewrite.title,
            slug,
            summary: rewrite.summary || '',
            content: rewrite.content,
            category_id: catId,
            source_name: source.name,
            source_original_url: cleanLink,
            image_url: imageUrl,
            reading_time_minutes: rewrite.readingTimeMinutes || 3,
            tags: rewrite.tags || [],
            status: 'published',
          } as any);

          if (article) {
            result.inserted++;
          }
        } catch (insertErr: any) {
          result.errors.push(`Insert failed for ${cleanTitle.slice(0, 40)}: ${insertErr.message}`);
          result.rejected++;
        }
      }
    }

    invalidateCache();
  } catch (pipelineErr: any) {
    result.errors.push(`Pipeline exception: ${pipelineErr.message || String(pipelineErr)}`);
  }

  return result;
}
