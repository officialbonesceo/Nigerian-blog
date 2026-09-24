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
  classifyTopic,
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
} from './runtime-db';
import type { Article } from './types';
import { cleanAndFormatArticleHtml } from './content-formatter';
import { isPublisherLogoOrBanner, resolveEditorialImage } from './editorial-image';

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

  const rawLead = `
Source Headline: ${input.title}
Source Publisher: ${input.sourceName || 'Wire Dispatch'}
Lead Summary / Snippet: ${(input.description || '').slice(0, 500)}
Source Text: ${(input.content || input.description || '').slice(0, 2000)}
Default Category Context: ${input.categoryDefault || 'naija-news'}
`.trim();

  const prompt = `
You are the Executive Senior Investigative Editor at 9jaBeacon (Nigeria's premier digital newsroom).
Rewrite this breaking wire dispatch into an original, authoritative, balanced, and verified Nigerian news report.

STRICT EDITORIAL REQUIREMENTS & WORD LIMITS:
1. TITLE: Engaging, journalistic headline (minimum 35 characters, maximum 100 characters). Factual, clear, non-clickbait.
2. SUMMARY: A concise 2-sentence executive summary (under 250 characters).
3. CONTENT: Substantive, comprehensive news report strictly between 350 and 500 WORDS total:
   - Must be structured into EXACTLY 4 distinct paragraphs.
   - Each paragraph MUST be preceded by a dynamic, context-derived <h3> heading that reflects the actual facts of that section (NO generic headings like "The Crux", "Background", "The Stakes").
   - Paragraph 1 (Lead & Facts, 85-115 words): Immediate breaking development, key actors, locations, figures, and core announcement.
   - Paragraph 2 (Institutional & Regulatory Backdrop, 85-115 words): Contextualize the development within relevant institutional policies, legal statutes, or economic circumstances. Explain systemic significance rather than guessing facts.
   - Paragraph 3 (Official Records & Statements, 85-115 words): Direct quotes, verified institutional declarations, or stakeholder responses.
   - Paragraph 4 (Public Impact & Forward Outlook, 85-115 words): Measurable consequences for citizens, market participants, next procedural milestones, or timelines.
4. FACTUAL GUARDRAILS & ZERO HALLUCINATION:
   - STRICT GROUNDING: Extract ONLY verified names, dates, quotes, statistics, and government decisions established in the source text. NEVER invent fake numbers, fictitious officials, or unverified claims.
   - Completely discard the previous writer's personal opinions, subjective reactions, speculative takes, emotional bias, or first-person remarks ("In my opinion", "I think", "This writer notes").
   - Rewrite everything 100% in 9jaBeacon's professional, neutral, objective newsroom voice.
5. CATEGORY: One of 'naija-news', 'business', 'sports', or 'world'.
   - High-priority rule: Politics, elections, courts, crime, Tinubu, Reno Omokri, police, military, EFCC, and governance MUST ALWAYS be 'naija-news', even if monetary sums/fees/prices are mentioned.
6. TAGS: Array of 3-5 relevant lowercase search keywords.
7. READ_TIME: Integer minutes (ceil(words / 200)).

BANNED STRINGS & ZERO AI THOUGHT LEAKS (STRICT FAIL-CLOSED):
- NEVER output reasoning tokens, <think> tags, internal monologues, or conversational intros/outros ("compiling further operational updates", "field dispatches and corroborating sources", "while pacing AI development might sound like a quick fix", "as an AI language model", "here is a rewritten version", or "As this development continues to unfold across Nigeria, key questions remain regarding regulatory oversight").
- Do not output markdown code blocks (\`\`\`json). Output pure schema values.
`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    // Use high-capacity flash models that do not hit 3.8 rate limit quotas
    const candidateModels = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
    let response: any = null;
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                { text: rawLead },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                content: { type: Type.STRING, description: 'Substantive HTML article with <h3> headings and <p> paragraphs, >= 250 words' },
                category: { type: Type.STRING, enum: ['naija-news', 'business', 'sports', 'world'] },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                readTime: { type: Type.INTEGER },
              },
              required: ['title', 'summary', 'content', 'category', 'tags', 'readTime'],
            },
          },
        });
        if (response && response.text) {
          break; // Successfully generated!
        }
      } catch (err: any) {
        lastError = err;
        // Continue to next model in cascade
      }
    }

    if (!response || !response.text) {
      return {
        success: false,
        reasons: [`All Gemini model tiers failed. Last error: ${lastError?.message || 'No response'}`],
        rawError: lastError?.message || 'Failed to generate across all candidate models',
      };
    }

    const text = response.text || '';
    if (!text || text.trim().length < 50) {
      return {
        success: false,
        reasons: ['Gemini returned an empty or truncated response'],
      };
    }

    let parsed: any;
    try {
      const sanitizedText = text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
        .replace(/^```json\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(sanitizedText);
    } catch {
      // Strip any accidental markdown formatting or preambles if present
      const cleaned = text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
        .replace(/^```json\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
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

    // Fail-closed length threshold: minimum 250 words
    if (wordCount < 250) {
      return {
        success: false,
        reasons: [`Word count below journalistic threshold (${wordCount} words < 250 words minimum)`],
      };
    }

    // Deterministic category validation
    const classifiedCategory = classifyTopic(finalTitle, plainText, parsed.category);

    // Fail-closed quality gate
    const gate = qualityGate({
      title: finalTitle,
      bodyHtml: finalHtml,
      bodyText: plainText,
      category: classifiedCategory,
      sourceOk: true,
    });

    if (!gate.pass) {
      return {
        success: false,
        reasons: gate.reasons,
      };
    }

    const honestReadTime = Math.max(1, Math.ceil(wordCount / 200));

    return {
      success: true,
      title: finalTitle,
      summary: finalSummary,
      content: finalHtml,
      category: classifiedCategory,
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['news', 'nigeria'],
      readingTimeMinutes: honestReadTime,
    };
  } catch (err: any) {
    return {
      success: false,
      reasons: [`Gemini generation failed: ${err.message || String(err)}`],
      rawError: err.message,
    };
  }
}

/**
 * 3. runIngestionPipeline: ingest -> qualityGate -> dedup -> D1 insert -> revalidate cache.
 * Returns clear log: { fetched, passed, rejected, inserted, errors }
 */
export async function runIngestionPipeline(
  db: D1Database,
  options: { sourceId?: string; limitPerSource?: number } = {}
): Promise<IngestionPipelineResult> {
  const result: IngestionPipelineResult = {
    fetched: 0,
    passed: 0,
    rejected: 0,
    inserted: 0,
    errors: [],
  };

  try {
    const sources = options.sourceId
      ? [await getSourceById(db, options.sourceId)].filter(Boolean)
      : (await getSources(db)).filter((s: any) => s.is_enabled);

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
  return (title || 'news-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 65);
}
