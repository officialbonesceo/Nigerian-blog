/**
 * Gemini editorial rewrite with per-article FAQ (2–4 Q&As)
 * Legal posture: transform + attribute; never invent; fail quality gate if thin.
 */
import { GoogleGenAI, Type } from '@google/genai';
import {
  normalizeCategory,
  qualityGate,
  type ArticleCategory,
} from './editorial-pipeline';
import { cleanAndFormatArticleHtml } from './content-formatter';
import { appendArticleFaq, normalizeFaqItems } from './article-faq';
import type { EditorialRewriteResult } from './automated-ingest-types';

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
  const sourceExcerpt = rawExcerpt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000);
  const sourceOutlet = (input.sourceName || 'national media reports').trim();
  const sourceTitle = (input.title || '').trim();

  if (!sourceUrl || !sourceExcerpt || sourceExcerpt.length < 280) {
    return {
      success: false,
      reasons: ['Missing required source_url or source_excerpt before rewrite'],
      rawError: 'Missing source_url or source_excerpt',
    };
  }

  const prompt = `
You write a clear news article for 9jaBeacon based on ONE provided source excerpt.

RULES:
1. Use your own words. Do not copy long phrases from the source.
2. Only include hard facts (names, places, dates, amounts, quotes) that appear in SOURCE_EXCERPT. If a detail is missing, leave it out.
3. Do not invent statistics, quotes, or outcomes.
4. Open with plain attribution, e.g. "According to ${sourceOutlet}..." or "Reports from ${sourceOutlet} say...".
5. Do NOT write "fully verified", "verified wire", "rewritten", "AI-generated", or similar labels in the article body.
6. Do NOT use jargon like "wired from", "ingest", or "pipeline". Write like a normal news desk.
7. Keep any direct quote under 20 words.
8. This is a secondary report based on public reporting — not an original investigation claim.

CATEGORY — pick EXACTLY ONE:
- naija-news — Nigeria politics, courts, police, INEC, security, governors, states
- business — CBN, banks, FX, trade, investment, corporate Nigeria, fintech
- sports — football, athletics, match results, athletes
- world — foreign politics and international events with no Nigeria lead

STYLE:
1. No filler like "Observers anticipate..." or "the situation remains fluid...".
2. No duplicate paragraphs.
3. 2 to 4 FAQ items; answers only restate facts already in your article.
4. About 180–320 words, 3–4 short paragraphs, with simple subheadings when useful.

SOURCE_TITLE: ${sourceTitle}
SOURCE_OUTLET: ${sourceOutlet}
SOURCE_URL: ${sourceUrl}
SOURCE_EXCERPT:
${sourceExcerpt}
`.trim();

  const candidateModels = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
  const ai = new GoogleGenAI({ apiKey });

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
                  content: { type: Type.STRING },
                  category: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  readTime: { type: Type.NUMBER },
                  imageSearchKeyword: { type: Type.STRING },
                  faq: {
                    type: Type.ARRAY,
                    description: '2 to 4 reader FAQ items. Answers only from article facts.',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        question: { type: Type.STRING },
                        answer: { type: Type.STRING },
                      },
                      required: ['question', 'answer'],
                    },
                  },
                },
                required: ['title', 'summary', 'content', 'category', 'tags', 'readTime', 'faq'],
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

      if (plainText.length < 400) {
        if (attempt === 2) {
          return {
            success: false,
            reasons: [`Plain text length insufficient (${plainText.length} chars < 400 chars minimum)`],
          };
        }
        continue;
      }

      const normalizedCategory = normalizeCategory(parsed.category, finalTitle, plainText);

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
        continue;
      }

      const honestReadTime = Math.max(1, Math.ceil(wordCount / 200));

      const faqItems = normalizeFaqItems(Array.isArray(parsed.faq) ? parsed.faq : []);
      const contentWithFaq = appendArticleFaq(finalHtml, faqItems);

      return {
        success: true,
        title: finalTitle,
        summary: finalSummary,
        content: contentWithFaq,
        category: normalizedCategory,
        tags: Array.isArray(parsed.tags) ? parsed.tags : ['news', 'nigeria'],
        readingTimeMinutes: honestReadTime,
        imageSearchKeyword: parsed.imageSearchKeyword ? String(parsed.imageSearchKeyword).trim() : undefined,
        faq: faqItems,
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
    reasons: ['Rewrite failed quality and category gates after 2 attempts'],
  };
}
