/**
 * Gemini editorial rewrite with per-article FAQ (2–4 Q&As)
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
  const sourceExcerpt = rawExcerpt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
  const sourceOutlet = (input.sourceName || 'Verified Wire').trim();
  const sourceTitle = (input.title || '').trim();

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
8. Also produce 2 to 4 FAQ items (question + answer) a Nigerian reader would ask after this story. Answers must only restate facts already in your article content — never invent new numbers, quotes, or claims.

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
                    description: '2 to 4 reader FAQ items. Questions a Nigerian reader would ask after this story. Answers must use only facts from the rewritten article (no new claims).',
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
    reasons: ['Rewrite failed quality and category gates after 2 attempts (fail-closed)'],
  };
}
