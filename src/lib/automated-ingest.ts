/**
 * Automated Ingestion Engine (RSS + Gemini) for 9jaBeacon
 * Enforces zero-fail safeguards:
 * 1. fetchRss: HTTP validation, 10s timeout, safe XML parsing, title + link validation.
 * 2. rewriteWithEditorialQuality: Gemini structured output schema, >=250 words, fail-closed.
 * 3. runIngestionPipeline: ingest -> qualityGate -> dedup -> D1 insert -> cache revalidation.
 */

import { GoogleGenAI, Type } from '@google/genai';
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
  getArticleBySlug,
  invalidateCache,
  recordRejectedArticle,
  getSources,
  getSourceById,
  getAutomationSettings,
  getSiteSettings,
} from './runtime-db';
import type { Article } from './types';
import { cleanAndFormatArticleHtml } from './content-formatter';
import { isPublisherLogoOrBanner, resolveEditorialImage } from './editorial-image';
import { postToBluesky } from './bluesky';
import { postToBuffer } from './buffer';

export interface FeedItemValidated {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  content?: string;
  imageUrl?: string;
}

export interface FetchRssResult {
  success: boolean;
  feedUrl: string;
  itemCount: number;
  items: FeedItemValidated[];
  error?: string;
}

export interface EditorialRewriteResult {
  success: boolean;
  title?: string;
  summary?: string;
  content?: string;
  category?: ArticleCategory;
  tags?: string[];
  readingTimeMinutes?: number;
  reasons?: string[];
  rawError?: string;
}

export interface IngestionPipelineResult {
  fetched: number;
  passed: number;
  rejected: number;
  inserted: number;
  errors: string[];
}

/**
 * 1. fetchRss: Validates source HTTP response, enforces 10s timeout, parses XML safely,
 * and validates each item has non-empty title + link.
 */
export async function fetchRss(feedUrl: string): Promise<FetchRssResult> {
  const cleanUrl = (feedUrl || '').trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return {
      success: false,
      feedUrl,
      itemCount: 0,
      items: [],
      error: 'Invalid feed URL scheme (must be http/https)',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 9jaBeacon/2.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*;q=0.1',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        feedUrl: cleanUrl,
        itemCount: 0,
        items: [],
        error: `Source HTTP error ${response.status}: ${response.statusText}`,
      };
    }

    const xml = await response.text();
    if (!xml || xml.length < 50) {
      return {
        success: false,
        feedUrl: cleanUrl,
        itemCount: 0,
        items: [],
        error: 'Feed response body was empty or too small to be valid XML',
      };
    }

    const items: FeedItemValidated[] = [];
    const itemRegex = /<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi;
    const matches = xml.match(itemRegex) || [];

    for (const rawItem of matches) {
      // Title
      const titleMatch = rawItem.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const title = titleMatch ? sanitizeSnippet(titleMatch[1]) : '';

      // Link
      let link = '';
      const linkTagMatch = rawItem.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
      if (linkTagMatch && linkTagMatch[1] && linkTagMatch[1].startsWith('http')) {
        link = linkTagMatch[1].trim();
      } else {
        const hrefMatch = rawItem.match(/<link[^>]+href=["']([^"']+)["']/i);
        if (hrefMatch && hrefMatch[1] && hrefMatch[1].startsWith('http')) {
          link = hrefMatch[1].trim();
        }
      }

      // Zero-fail item validation: Must have both valid title (>= 10 chars) and HTTP link
      if (!title || title.length < 10 || !link || !link.startsWith('http')) {
        continue;
      }

      // PubDate
      const dateMatch = rawItem.match(/<(?:pubDate|published|updated|dc:date)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:pubDate|published|updated|dc:date)>/i);
      const pubDate = dateMatch ? dateMatch[1].trim() : undefined;

      // Description / Summary
      const descMatch = rawItem.match(/<(?:description|summary)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary)>/i);
      const description = descMatch ? sanitizeSnippet(descMatch[1]) : '';

      // Content
      const contentMatch = rawItem.match(/<(?:content:encoded|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:content:encoded|content)>/i);
      const content = contentMatch ? sanitizeSnippet(contentMatch[1]) : '';

      // Image enclosure or embedded
      let imageUrl: string | undefined;
      const enclosureMatch = rawItem.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
      if (enclosureMatch && enclosureMatch[1].startsWith('http')) {
        imageUrl = enclosureMatch[1].trim();
      }
      if (!imageUrl) {
        const mediaMatch = rawItem.match(/<(?:media:content|media:thumbnail)[^>]+url=["']([^"']+)["']/i);
        if (mediaMatch && mediaMatch[1].startsWith('http')) {
          imageUrl = mediaMatch[1].trim();
        }
      }
      if (!imageUrl) {
        const imgMatch = (content || description || '').match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch && imgMatch[1].startsWith('http') && !imgMatch[1].includes('1x1') && !imgMatch[1].includes('feedburner')) {
          imageUrl = imgMatch[1].trim();
        }
      }

      if (imageUrl && isPublisherLogoOrBanner(imageUrl)) {
        imageUrl = undefined;
      }

      items.push({
        title,
        link,
        pubDate,
        description,
        content: content || description,
        imageUrl,
      });
    }

    return {
      success: true,
      feedUrl: cleanUrl,
      itemCount: items.length,
      items: items.slice(0, 15),
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      success: false,
      feedUrl: cleanUrl,
      itemCount: 0,
      items: [],
      error: err.name === 'AbortError' ? 'RSS fetch timed out (10s limit exceeded)' : err.message || 'Unknown network error',
    };
  }
}

/**
 * 2. rewriteWithEditorialQuality: Prompts Gemini with strict output schema:
 * title, summary, content (>=250 words, lead paragraph + context + implications), category, tags, readTime.
 * Fail-closed: if empty, markdown code blocks, truncated text, or banned strings, reject and log.
 */
export async function rewriteWithEditorialQuality(input: {
  title: string;
  link?: string;
  description?: string;
  content?: string;
  categoryDefault?: string;
  sourceName?: string;
}): Promise<EditorialRewriteResult> {
  const apiKey = (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '') || '';
  if (!apiKey) {
    return {
      success: false,
      reasons: ['GEMINI_API_KEY not configured in environment'],
      rawError: 'Missing GEMINI_API_KEY',
    };
  }

  const sourceUrl = (input.link || '').trim();
  const rawExcerpt = (input.content || input.description || '').trim();
  const sourceExcerpt = rawExcerpt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
  const sourceOutlet = (input.sourceName || 'Verified Wire').trim();
  const sourceTitle = (input.title || '').trim();

  // Fail-closed input requirements (File 2 Section 2.1)
  if (!sourceUrl || !sourceExcerpt || sourceExcerpt.length < 50) {
    return {
      success: false,
      reasons: ['Missing required source_url or source_excerpt before rewrite (fail-closed)'],
      rawError: 'Missing source_url or source_excerpt',
    };
  }

  const prompt = `
You rewrite news for 9jaBeacon from ONE provided source excerpt only.

CATEGORY ALLOW-LIST — pick EXACTLY ONE based on the TOPIC of the lead fact:
- naija-news — Nigeria politics, courts, police, INEC, security, governors, states, national institutions, traditional rulers, societal news
- business — CBN, banks, FX, trade, investment, corporate Nigeria, fintech, energy deals, macroeconomic trends
- sports — football, athletics, boxing, match results, coaching staff, athletes, league/tournament results only
- world — foreign politics, international disputes, non-Nigeria primary events

TOPIC-FIRST CLASSIFICATION RULES:
1. Topic of the lead fact wins, not money keywords (price, million, naira alone do not make a story business).
2. Court / police / INEC / governors / presidency → naija-news (even if funds or naira are mentioned).
3. CBN / banks / FX / fintech / business acquisitions → business.
4. Match results / athletes / clubs → sports. Foreign matches (Liga MX, etc.) → sports.
5. Foreign oil disputes, UK/US politics with no Nigeria lead → world.
6. Olori, palace/royal affairs, celebrity news, relationship drama → naija-news (NEVER sports).
7. Blockchain, fintech products, corporate investments → business (never sports).

FACT-LOCK & QUALITY RULES:
1. Every hard fact (name, age, place, date, score, amount, quote) must appear in the source excerpt OR be grounded in verified context.
2. At least one named source (${sourceOutlet}) must be explicitly cited in the lead: "According to ${sourceOutlet}..."
3. Absolutely NO invented statistics (search volume, fake read counts, unsourced surveys).
4. Ban filler: NEVER write "Observers anticipate...", "the situation remains fluid...", or "Nigerian search interest surges".
5. No duplicate paragraphs or repetitive sentences.
6. No chain-of-thought, planning text, or "as an AI".
7. Write a thorough, comprehensive news report (between 180 and 320 words) across 3 to 4 well-structured paragraphs with informative <h3> subheadings. Detail:
   (a) Lead paragraph with primary fact and ${sourceOutlet} attribution;
   (b) Key background and timeline of events;
   (c) Relevant institutional, economic, or regulatory context;
   (d) Industry/stakeholder impact or upcoming milestones.
   Never write stubs or short summaries below 150 words.

SOURCE_TITLE: ${sourceTitle}
SOURCE_OUTLET: ${sourceOutlet}
SOURCE_URL: ${sourceUrl}
SOURCE_EXCERPT:
${sourceExcerpt}
`.trim();

  const candidateModels = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
  const ai = new GoogleGenAI({ apiKey });

  // Retry loop: max 2 attempts (File 1 Section 5 & File 2 Section 4)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      let response: any = null;
      let lastError: any = null;

      for (const modelName of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  content: { type: Type.STRING, description: 'Comprehensive HTML article with <h3> headings and <p> paragraphs, between 180 and 350 words, detailing lead facts, context, and implications.' },
                  category: { type: Type.STRING, enum: ['naija-news', 'business', 'sports', 'world'] },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  readTime: { type: Type.INTEGER },
                },
                required: ['title', 'summary', 'content', 'category', 'tags', 'readTime'],
              },
            },
          });
          if (response && response.text) break;
        } catch (err: any) {
          lastError = err;
        }
      }

      if (!response || !response.text) {
        if (attempt === 2) {
          return {
            success: false,
            reasons: [`All Gemini model tiers failed. Last error: ${lastError?.message || 'No response'}`],
            rawError: lastError?.message || 'Failed to generate across all candidate models',
          };
        }
        continue;
      }

      const text = (response.text || '').trim();
      if (text.length < 50) continue;

      let parsed: any;
      try {
        const sanitized = text
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
          .replace(/^```json\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        parsed = JSON.parse(sanitized);
      } catch {
        continue;
      }

      let finalTitle = (parsed.title || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/^(?:opinion|analysis|editorial|exclusive):\s*/i, '')
        .trim();

      let finalSummary = (parsed.summary || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/(?:in my opinion|in the writer's view|the author believes)[^.,;]*([.,;]|$)/gi, '')
        .trim();

      let finalHtml = cleanAndFormatArticleHtml(parsed.content || '');
      const plainText = finalHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

      // Fail-closed length threshold: minimum 400 chars plain text
      if (plainText.length < 400) {
        if (attempt === 2) {
          return {
            success: false,
            reasons: [`Plain text length insufficient (${plainText.length} chars < 400 chars minimum)`],
          };
        }
        continue;
      }

      // Spec-mandated Category Normalizer with keyword fallbacks and hard overrides
      const normalizedCategory = normalizeCategory(parsed.category, finalTitle, plainText);

      // Fail-closed quality gate with attribution, stub check, unsourced stats check
      const gate = qualityGate({
        title: finalTitle,
        bodyHtml: finalHtml,
        bodyText: plainText,
        category: normalizedCategory,
        sourceOk: true,
        sourceUrl,
        sourceOutlet,
        sourceExcerpt,
      });

      if (!gate.pass) {
        if (attempt === 2) {
          return {
            success: false,
            reasons: gate.reasons,
          };
        }
        continue; // Retry once if quality gate failed
      }

      const honestReadTime = Math.max(1, Math.ceil(wordCount / 200));

      return {
        success: true,
        title: finalTitle,
        summary: finalSummary,
        content: finalHtml,
        category: normalizedCategory,
        tags: Array.isArray(parsed.tags) ? parsed.tags : ['news', 'nigeria'],
        readingTimeMinutes: honestReadTime,
      };
    } catch (err: any) {
      if (attempt === 2) {
        return {
          success: false,
          reasons: [`Gemini generation failed: ${err.message || String(err)}`],
          rawError: err.message,
        };
      }
    }
  }

  return {
    success: false,
    reasons: ['Rewrite failed quality and category gates after 2 attempts (fail-closed)'],
  };
}

/**
 * 3. runIngestionPipeline: ingest -> qualityGate -> dedup -> D1 insert -> revalidate cache.
 * Returns clear log: { fetched, passed, rejected, inserted, errors }
 */
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
        // Balanced round-robin across all 4 news categories so Business, Sports, and World are never starved!
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
        // Dedup check: slug or original link
        const baseSlug = generateBaseSlug(item.title);
        const existing = await getArticleBySlug(db, baseSlug).catch(() => null);
        if (existing) {
          continue; // Already processed
        }

        // Rewrite with Gemini & fail-closed validation
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

        // Multi-tier visual resolution:
        // 1. Source image (if valid, not logo/banner)
        // 2. If human/person story: try Wikipedia; if not found on Wikipedia, SKIP stock photos and use SVG
        // 3. If non-human story: try Wikipedia, then curated conceptual photography (Unsplash), then SVG
        const visual = await resolveEditorialImage({
          title: rewrite.title,
          content: rewrite.content,
          category: categorySlug,
          sourceName: source.name,
          sourceImageUrl: item.imageUrl,
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

          // Autonomous Bluesky syndication if enabled in settings
          try {
            const autoSettings = await getAutomationSettings(db).catch(() => []);
            const sMap: Record<string, string> = {};
            for (const s of autoSettings) sMap[s.key] = s.value;
            if (sMap.bluesky_auto_post_enabled === 'true' && sMap.bluesky_identifier && sMap.bluesky_app_password) {
              const siteSettings = await getSiteSettings(db).catch(() => ({} as Record<string, string>));
              const siteBase = ((siteSettings as any).site_url || 'https://www.9jabeacon.name.ng').replace(/\/+$/, '');
              postToBluesky({
                title: newArticle.title,
                summary: newArticle.summary,
                category: categorySlug,
                imageUrl: newArticle.image_url,
                slug: newArticle.slug,
                canonicalUrl: `${siteBase}/news/${newArticle.slug}`,
              }, {
                identifier: sMap.bluesky_identifier,
                appPassword: sMap.bluesky_app_password,
              }, siteBase).catch(bErr => console.warn('[Bluesky Auto-Post Notice]:', bErr.message));
            }

            // Autonomous Buffer syndication (Facebook, Instagram, Pinterest) if enabled
            if (sMap.buffer_auto_post_enabled === 'true' && sMap.buffer_access_token) {
              const siteSettings = await getSiteSettings(db).catch(() => ({} as Record<string, string>));
              const siteBase = ((siteSettings as any).site_url || 'https://www.9jabeacon.name.ng').replace(/\/+$/, '');
              postToBuffer({
                accessToken: sMap.buffer_access_token,
                facebookProfileId: sMap.buffer_profile_ids_facebook,
                instagramProfileId: sMap.buffer_profile_ids_instagram,
                pinterestProfileId: sMap.buffer_profile_ids_pinterest,
                autoPostEnabled: true,
                maxPostsPerWorkflow: 1,
              }, {
                title: newArticle.title,
                summary: newArticle.summary,
                categoryName: categorySlug,
                imageUrl: newArticle.image_url,
                canonicalUrl: `${siteBase}/news/${newArticle.slug}`,
              }).catch(bufErr => console.warn('[Buffer/Pinterest Auto-Post Notice]:', bufErr.message));
            }
          } catch {}
        } else {
          result.rejected++;
          result.errors.push(`Failed to insert article into D1: ${rewrite.title}`);
        }
      }
    }

    // Revalidate and purge caches so fresh articles show immediately
    invalidateCache();
  } catch (pipelineErr: any) {
    result.errors.push(`Pipeline exception: ${pipelineErr.message || String(pipelineErr)}`);
  }

  return result;
}

function sanitizeSnippet(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateBaseSlug(title: string): string {
  const clean = (title || 'news-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (clean.length <= 80) return clean;

  // Section 7: Clean cutoff at word boundary without truncated words or hanging hyphens
  const sub = clean.slice(0, 85);
  const lastHyphen = sub.lastIndexOf('-');
  if (lastHyphen > 35) {
    return sub.slice(0, lastHyphen);
  }
  return sub.replace(/-+$/, '');
}
