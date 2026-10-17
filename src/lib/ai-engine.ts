/**
 * Multi-LLM synthesis for 9jaBeacon.
 * Order: Gemini (if key) → OpenRouter → Cloudflare AI → Groq → Local → Pollinations.
 * Gemini is optional; OpenRouter/Groq/CF work without it.
 */

import { generateEditorialSvgDataUrl } from './editorial-image';
import { cleanAndFormatArticleHtml } from './content-formatter';
import { appendArticleFaq, normalizeFaqItems } from './article-faq';
import { cleanRssSnippet } from './rss-parser';
import { rewriteWithEditorialQuality } from './automated-ingest';
import { categorySlugToId, normalizeCategory } from './editorial-pipeline';
import {
  discoverOpenRouterFreeModels,
  discoverCloudflareModels,
} from './dynamic-model-discovery';

export interface AiSynthesisInput {
  title: string;
  sourceName: string;
  originalUrl?: string;
  description?: string;
  content?: string;
  categoryDefault?: string;
}

export interface AiSynthesisResult {
  success: boolean;
  provider?: 'gemini_ai' | 'cloudflare_workers_ai' | 'openrouter_ai' | 'local_ai_model' | 'pollinations_ai' | 'editorial_synthesis_engine' | 'factual_wire_engine';
  modelUsed?: string;
  title?: string;
  summary?: string;
  content?: string;
  categoryId?: string;
  secondaryCategoryId?: string;
  readingTimeMinutes?: number;
  tags?: string[];
  keyTakeaways?: string[];
  imageSearchKeyword?: string;
  faq?: Array<{ question: string; answer: string }>;
  error?: string;
  traceLogs?: string[];
}

export interface AiCredentialsConfig {
  geminiApiKey?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  cloudflareModel?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  localAiEndpoint?: string;
  localAiModel?: string;
  localAiApiKey?: string;
  pollinationsApiKey?: string;
  customPromptTemplate?: string;
  workingCloudflareModels?: string[];
  workingOpenRouterModels?: string[];
}

export const CLOUDFLARE_MODELS_CASCADE = [
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.2',
];

export const OPENROUTER_MODELS_CASCADE = [
  // Oct 2026 free roster — old llama-3.3/qwen-2.5 free IDs are gone (404)
  'openrouter/free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3.8-27b:free',
  'thinkingmachines/inkling-small:free',
];

export const LOCAL_MODELS_CASCADE = [
  'qwen2.5:3b',
  'qwen2.5:7b',
  'qwen2.5:1.5b',
  'qwen2.5:0.5b',
  'qwen2.5-coder:1.5b',
  'llama3.2:1b',
  'llama3.2:3b',
  'deepseek-r1:1.5b',
];

export const POLLINATIONS_MODELS_CASCADE = [
  'openai',
  'mistral',
  'qwen-coder',
];

const SYSTEM_PROMPT = `You are an Executive Senior Investigative Editor at 9jaBeacon (Nigeria's digital newsroom).

YOUR EDITORIAL MANDATE & GOLDEN STANDARD:
Write an authoritative, factual, high-retention news report structured into EXACTLY 4 substantive paragraphs with context-derived headings.

ARTICLE STRUCTURE (OPTION A: DYNAMIC STORY-DERIVED SUBHEADINGS):
- Every article MUST consist of EXACTLY 4 distinct paragraphs.
- EACH paragraph MUST be preceded by its own dynamic, story-derived <h3> heading that reflects the specific facts of that paragraph.
- STRICTLY FORBIDDEN: Do NOT use static, repetitive generic headings such as "The Crux", "Background & Institutional Context", "Socioeconomic Stakes", or "Official Reactions".
- STRICT WORD COUNT: The article MUST contain between 400 and 700 WORDS total.

CATEGORIES — pick EXACTLY ONE:
- naija-news — Nigeria politics, security, society, culture, royalty, local incidents, government
- business — economy, companies, markets, CBN, investment, trade, fintech, corporate news
- sports — matches, athletes, clubs, leagues, tournaments, sports transfers only
- world — primarily foreign/international stories without a strong Nigeria-lead angle

HARD EDITORIAL & FACT-CHECK RULES:
1. Every hard fact must appear in the source excerpt OR be omitted.
2. Do NOT invent statistics, police ranks, case numbers, or quotes.
3. First or second paragraph MUST attribute: "According to [SOURCE_OUTLET]...".
4. Spelling of names must match the source excerpt exactly.
5. Prefer news tone: what happened, who said it, what happens next.
6. Output CATEGORY as exactly one of: naija-news, business, sports, world
7. ZERO AI THOUGHTS: Never leak reasoning tokens or conversational intros/outros.

Return ONLY valid JSON (no markdown fences, strictly parseable):
{
  "title": "Compelling, factual, non-clickbait headline",
  "summary": "An executive 2-sentence briefing summarizing the core event and its primary significance.",
  "content": "<h3>[Dynamic Story-Derived Subheading 1]</h3><p>[Substantive paragraph 1]</p><h3>[Dynamic Story-Derived Subheading 2]</h3><p>[Substantive paragraph 2]</p><h3>[Dynamic Story-Derived Subheading 3]</h3><p>[Substantive paragraph 3]</p><h3>[Dynamic Story-Derived Subheading 4]</h3><p>[Substantive paragraph 4]</p>",
  "category": "naija-news | business | sports | world",
  "reading_time_minutes": 3,
  "key_takeaways": ["Key verified fact", "Direct impact point", "Official stance", "Upcoming milestone"],
  "image_search_keyword": "2 to 4 precise English visual keywords",
  "faq": [
    {"question": "A specific question a Nigerian reader would ask after this story", "answer": "Answer using ONLY facts already in your article content — never invent numbers, quotes, or claims"}
  ]
}

FAQ RULES:
- Include 2 to 4 FAQ items in the faq array.
- Questions must be ones a real reader would ask about THIS story.
- Answers must only restate facts already present in your content field — zero new claims.
`;

export async function synthesizeNewsArticle(
  input: AiSynthesisInput,
  config: AiCredentialsConfig = {}
): Promise<AiSynthesisResult> {
  const geminiKey = (config.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  const accountId = (config.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const cfToken = (config.cloudflareApiToken || process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const openrouterKey = (config.openrouterApiKey || process.env.OPENROUTER_API_KEY || '').trim();
  const localEndpoint = (config.localAiEndpoint || process.env.LOCAL_AI_ENDPOINT || '').trim().replace(/\/+$/, '');
  const localModel = (config.localAiModel || process.env.LOCAL_AI_MODEL || 'qwen2.5:3b').trim();
  const localKey = (config.localAiApiKey || process.env.LOCAL_AI_API_KEY || 'ollama').trim();
  const pollinationsKey = (config.pollinationsApiKey || process.env.POLLINATIONS_API_KEY || '').trim();

  const userContent = `RAW SOURCE: ${input.sourceName}\nSOURCE URL: ${input.originalUrl}\nRAW TITLE: ${input.title}\nRAW DESCRIPTION: ${input.description || ''}\nRAW CONTENT: ${input.content ? input.content.slice(0, 3000) : input.description || ''}\n\nRewrite into a 9jaBeacon article following the JSON schema.`;

  const errors: string[] = [];
  const traceLogs: string[] = [];

  // TIER 0: Google Gemini AI (optional)
  if (geminiKey) {
    try {
      traceLogs.push('Tier 0: Attempting Google Gemini AI Flash Cascade');
      const geminiRewrite = await rewriteWithEditorialQuality({
        title: input.title,
        link: input.originalUrl,
        description: input.description,
        content: input.content,
        categoryDefault: input.categoryDefault,
        sourceName: input.sourceName,
      });

      if (geminiRewrite.success && geminiRewrite.title && geminiRewrite.content) {
        const catId = geminiRewrite.category ? categorySlugToId(geminiRewrite.category) : (input.categoryDefault || 'cat_naija_news');
        traceLogs.push(`Tier 0 (Gemini Flash): Successfully synthesized "${geminiRewrite.title.slice(0, 40)}..."`);
        return {
          success: true,
          provider: 'gemini_ai',
          modelUsed: 'gemini-3.5-flash',
          title: geminiRewrite.title,
          summary: geminiRewrite.summary || input.description || geminiRewrite.title,
          content: geminiRewrite.content,
          categoryId: catId,
          readingTimeMinutes: geminiRewrite.readingTimeMinutes || 4,
          tags: geminiRewrite.tags || [],
          faq: geminiRewrite.faq,
          traceLogs,
        };
      } else {
        const reasons = (geminiRewrite.reasons || []).join('; ') || geminiRewrite.rawError || 'Validation failed';
        traceLogs.push(`Tier 0 Warning (Gemini Flash): ${reasons}`);
        errors.push(`Gemini Flash: ${reasons}`);
      }
    } catch (geminiErr: any) {
      traceLogs.push(`Tier 0 Error (Gemini): ${geminiErr.message}`);
      errors.push(`Gemini: ${geminiErr.message}`);
    }
  } else {
    traceLogs.push('Tier 0 skipped: GEMINI_API_KEY not set (using OpenRouter/CF/Groq fallbacks)');
  }

  const attemptAiExpansion = async (
    rawText: string,
    currentWordCount: number,
    callModel: (messages: Array<{ role: string; content: string }>) => Promise<string | null>
  ): Promise<ReturnType<typeof parseAiJsonResponse>> => {
    const expansionMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
      { role: 'assistant', content: rawText },
      {
        role: 'user',
        content: `EDITORIAL QUALITY GATE: Your draft contains only ${currentWordCount} words. EXPAND to between 500 and 800 words across 4 to 6 detailed sections with story-specific <h3> headings. Keep or improve the "faq" array (2–4 Q&As). Answers must only restate facts already in your content. Output strictly updated JSON matching the schema with at least 400 words of content and a valid faq array.`,
      },
    ];
    try {
      const expandedRaw = await callModel(expansionMessages);
      if (!expandedRaw) return null;
      return parseAiJsonResponse(expandedRaw, input);
    } catch {
      return null;
    }
  };

  // TIER 1: OpenRouter (primary when Gemini absent)
  if (openrouterKey) {
    const modelsToTry = [
      ...(config.workingOpenRouterModels || []),
      ...(config.openrouterModel ? [config.openrouterModel] : []),
      ...OPENROUTER_MODELS_CASCADE,
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);

    for (const modelCandidate of modelsToTry) {
      try {
        traceLogs.push(`Tier 1 (OpenRouter): Attempting ${modelCandidate}`);
        const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://www.9jabeacon.name.ng',
            'X-Title': '9jaBeacon',
          },
          body: JSON.stringify({
            model: modelCandidate,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
            temperature: 0.2,
            max_tokens: 2800,
          }),
          signal: AbortSignal.timeout(45000),
        });

        if (openrouterRes.ok) {
          const orData = (await openrouterRes.json()) as any;
          const rawText = orData?.choices?.[0]?.message?.content || '';
          let parsed = parseAiJsonResponse(rawText, input);
          if (parsed) {
            if (parsed.wordCount < 180) {
              const expanded = await attemptAiExpansion(rawText, parsed.wordCount, async (msgs) => {
                const retryRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${openrouterKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://www.9jabeacon.name.ng',
                    'X-Title': '9jaBeacon',
                  },
                  body: JSON.stringify({ model: modelCandidate, messages: msgs, temperature: 0.2, max_tokens: 2800 }),
                  signal: AbortSignal.timeout(45000),
                });
                if (!retryRes.ok) return null;
                const d = (await retryRes.json()) as any;
                return d?.choices?.[0]?.message?.content || null;
              });
              if (expanded && expanded.wordCount >= 180) parsed = expanded;
              else {
                errors.push(`Tier 1 (${modelCandidate}): Content too sparse (${parsed.wordCount}w)`);
                continue;
              }
            }
            traceLogs.push(`Tier 1 Success: OpenRouter (${modelCandidate}) [${parsed.wordCount} words]`);
            return { success: true, provider: 'openrouter_ai', modelUsed: orData?.model || modelCandidate, traceLogs, ...parsed };
          }
          errors.push(`OpenRouter (${modelCandidate}): JSON parse/quality failed raw=${String(rawText).slice(0, 120).replace(/\s+/g, ' ')}`);
        } else {
          const errBody = await openrouterRes.text().catch(() => '');
          errors.push(`OpenRouter (${modelCandidate}) HTTP ${openrouterRes.status}: ${errBody.slice(0, 120)}`);
        }
      } catch (orErr: any) {
        errors.push(`OpenRouter (${modelCandidate}): ${orErr.message}`);
      }
    }
  } else {
    traceLogs.push('Tier 1 skipped: OPENROUTER_API_KEY not set');
  }

  // TIER 2: Cloudflare Workers AI (secondary)
  if (accountId && cfToken) {
    const modelsToTry = [
      ...(config.workingCloudflareModels || []),
      ...(config.cloudflareModel ? [config.cloudflareModel] : []),
      ...CLOUDFLARE_MODELS_CASCADE,
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 2);

    for (const modelCandidate of modelsToTry) {
      try {
        traceLogs.push(`Tier 2 (CF Workers AI): Attempting ${modelCandidate}`);
        const cfRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelCandidate}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cfToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userContent },
              ],
              max_tokens: 2800,
            }),
            signal: AbortSignal.timeout(20000),
          }
        );

        if (cfRes.ok) {
          const cfData = (await cfRes.json()) as any;
          const rawText = cfData?.result?.response || cfData?.response || '';
          let parsed = parseAiJsonResponse(rawText, input);
          if (parsed) {
            if (parsed.wordCount < 120) {
              errors.push(`Tier 2 (${modelCandidate}): Word count below 120 (${parsed.wordCount})`);
              continue;
            }
            traceLogs.push(`Tier 2 Success: ${modelCandidate} [${parsed.wordCount} words]`);
            return { success: true, provider: 'cloudflare_workers_ai', modelUsed: modelCandidate, traceLogs, ...parsed };
          }
          errors.push(`CF (${modelCandidate}): parse failed raw=${String(rawText).slice(0, 160).replace(/\s+/g, ' ')}`);
        } else {
          errors.push(`CF (${modelCandidate}) HTTP ${cfRes.status}`);
        }
      } catch (cfErr: any) {
        errors.push(`CF (${modelCandidate}): ${cfErr.message}`);
      }
    }
  }

  // TIER 2b: Groq (optional)
  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  if (groqKey) {
    const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'];
    for (const modelCandidate of groqModels.slice(0, 2)) {
      try {
        traceLogs.push(`Tier 2b (Groq): Attempting ${modelCandidate}`);
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelCandidate,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
            temperature: 0.2,
            max_tokens: 2800,
          }),
          signal: AbortSignal.timeout(25000),
        });
        if (groqRes.ok) {
          const gData = (await groqRes.json()) as any;
          const rawText = gData?.choices?.[0]?.message?.content || '';
          const parsed = parseAiJsonResponse(rawText, input);
          if (parsed && parsed.wordCount >= 180) {
            traceLogs.push(`Tier 2b Success: Groq (${modelCandidate}) [${parsed.wordCount} words]`);
            return { success: true, provider: 'openrouter_ai', modelUsed: `groq/${modelCandidate}`, traceLogs, ...parsed };
          }
        } else {
          errors.push(`Groq (${modelCandidate}) HTTP ${groqRes.status}`);
        }
      } catch (gErr: any) {
        errors.push(`Groq (${modelCandidate}): ${gErr.message}`);
      }
    }
  }

  // TIER 3: Local AI
  if (localEndpoint) {
    const modelsToTry = [localModel, ...LOCAL_MODELS_CASCADE.filter((m) => m !== localModel)].slice(0, 3);
    const cleanBaseUrl = localEndpoint.endsWith('/v1') ? localEndpoint : `${localEndpoint}/v1`;

    for (const localCandidate of modelsToTry) {
      try {
        traceLogs.push(`Tier 3 (Local AI): ${localCandidate}`);
        const localRes = await fetch(`${cleanBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: localCandidate,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
            temperature: 0.2,
            max_tokens: 2800,
          }),
          signal: AbortSignal.timeout(20000),
        });

        if (localRes.ok) {
          const localData = (await localRes.json()) as any;
          const rawText = localData?.choices?.[0]?.message?.content || '';
          let parsed = parseAiJsonResponse(rawText, input);
          if (parsed && parsed.wordCount >= 180) {
            traceLogs.push(`Tier 3 Success: ${localCandidate} [${parsed.wordCount} words]`);
            return { success: true, provider: 'local_ai_model', modelUsed: `Local (${localCandidate})`, traceLogs, ...parsed };
          }
        }
      } catch (localErr: any) {
        errors.push(`Local AI (${localCandidate}): ${localErr.message}`);
      }
    }
  }

  // TIER 4: Pollinations
  for (const pollModel of POLLINATIONS_MODELS_CASCADE.slice(0, 2)) {
    try {
      traceLogs.push(`Tier 4 (Pollinations): ${pollModel}`);
      const pollinationsHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (pollinationsKey) pollinationsHeaders['Authorization'] = `Bearer ${pollinationsKey}`;

      const pollRes = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: pollinationsHeaders,
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
          model: pollModel,
          jsonMode: true,
          seed: 42,
        }),
        signal: AbortSignal.timeout(22000),
      });

      if (pollRes.ok) {
        const rawText = await pollRes.text();
        const parsed = parseAiJsonResponse(rawText, input);
        if (parsed && parsed.wordCount >= 180) {
          traceLogs.push(`Tier 4 Success: Pollinations (${pollModel}) [${parsed.wordCount} words]`);
          return { success: true, provider: 'pollinations_ai', modelUsed: pollModel, traceLogs, ...parsed };
        }
      } else {
        errors.push(`Pollinations (${pollModel}) HTTP ${pollRes.status}`);
      }
    } catch (pErr: any) {
      errors.push(`Pollinations (${pollModel}): ${pErr.message}`);
    }
  }

  return {
    success: false,
    error: `All AI synthesis tiers failed: ${errors.slice(0, 10).join('; ') || 'Content did not meet threshold'}`,
    traceLogs,
  };
}

export async function generateEditorialNewsImage(
  params: { title: string; categoryId?: string; summary?: string },
  _config: AiCredentialsConfig = {}
): Promise<{ imageUrl: string; caption: string; credit: string }> {
  const svgDataUrl = generateEditorialSvgDataUrl({
    title: params.title,
    category: params.categoryId || 'cat_naija_news',
    sourceName: '9jaBeacon News Wire',
    width: 1200,
    height: 675,
  });
  return {
    imageUrl: svgDataUrl,
    caption: `Editorial vector dispatch: ${params.title.slice(0, 80)}`,
    credit: '9jaBeacon Editorial Visual Desk',
  };
}

function parseAiJsonResponse(
  rawText: string,
  fallbackInput: AiSynthesisInput
): {
  title: string;
  summary: string;
  content: string;
  categoryId: string;
  secondaryCategoryId?: string;
  readingTimeMinutes: number;
  keyTakeaways: string[];
  wordCount: number;
  paragraphCount: number;
  imageSearchKeyword?: string;
  faq?: Array<{ question: string; answer: string }>;
} | null {
  if (!rawText) return null;

  try {
    let cleaned = rawText
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/(?:^|\n)\s*(?:Thinking Process|Thought Process|Model Thought|Internal Reasoning):[\s\S]*?(?=\n\s*\n|\{|$)/gi, '')
      .replace(/```json\s*/gi, '')
      .replace(/```\s*$/gi, '')
      .trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    const obj = JSON.parse(cleaned);

    let rawTitle = (obj.title || '').trim();
    rawTitle = rawTitle.replace(/<[^>]*>/g, '').replace(/^(?:opinion|analysis|editorial|exclusive):\s*/i, '').trim();
    if (!rawTitle || rawTitle.length < 5) return null;

    let summary = cleanRssSnippet(obj.summary || obj.description || fallbackInput.description || '');
    summary = summary.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/(?:in my opinion|in the writer's view|the author believes)[^.,;]*([.,;]|$)/gi, '').trim();

    let content = obj.content || '';
    content = cleanAndFormatArticleHtml(content);

    let rawFaq: unknown = obj.faq;
    const faq = normalizeFaqItems(Array.isArray(rawFaq) ? rawFaq : []);
    if (faq.length) {
      content = appendArticleFaq(content, faq);
    }

    const plain = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
    if (wordCount < 80) return null;

    const catSlug = normalizeCategory(obj.category, rawTitle, plain);
    const categoryId = categorySlugToId(catSlug);

    return {
      title: rawTitle,
      summary: summary || rawTitle,
      content,
      categoryId,
      readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
      keyTakeaways: Array.isArray(obj.key_takeaways) ? obj.key_takeaways.map(String).slice(0, 6) : [],
      wordCount,
      paragraphCount: (content.match(/<p[\s>]/gi) || []).length,
      imageSearchKeyword: obj.image_search_keyword ? String(obj.image_search_keyword).trim() : undefined,
      faq,
    };
  } catch {
    return null;
  }
}
