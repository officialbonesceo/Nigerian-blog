/**
 * 4-Tier Multi-LLM Autonomous News Editorial & Synthesis Engine for 9jaBeacon
 * Supports Cloudflare Workers AI, OpenRouter, Local AI (Ollama/LM Studio/Qwen), Pollinations AI, and Editorial Core.
 * With ULTRA-STRONG category mapping (Money / Sports / World / Naija)
 */

import { decideCategories } from './category-mapper';
import { generateEditorialSvgDataUrl } from './editorial-image';
import { cleanAndFormatArticleHtml } from './content-formatter';
import { cleanRssSnippet } from './rss-parser';

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
  provider?: 'cloudflare_workers_ai' | 'openrouter_ai' | 'local_ai_model' | 'pollinations_ai' | 'editorial_synthesis_engine' | 'factual_wire_engine';
  modelUsed?: string;
  title?: string;
  summary?: string;
  content?: string;
  categoryId?: string;
  secondaryCategoryId?: string;
  readingTimeMinutes?: number;
  tags?: string[];
  keyTakeaways?: string[];
  error?: string;
  traceLogs?: string[];
}

export interface AiCredentialsConfig {
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  cloudflareModel?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  localAiEndpoint?: string; // e.g. http://localhost:11434/v1 or http://127.0.0.1:11434/v1
  localAiModel?: string; // e.g. qwen2.5:3b, qwen2.5:7b, qwen2.5:0.5b, llama3.2:1b
  localAiApiKey?: string;
  pollinationsApiKey?: string;
  customPromptTemplate?: string;
}

export const CLOUDFLARE_MODELS_CASCADE = [
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/qwen/qwen1.5-7b-chat',
  '@cf/qwen/qwen1.5-14b-chat-awq',
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  '@cf/mistral/mistral-7b-instruct-v0.2',
];

export const OPENROUTER_MODELS_CASCADE = [
  'qwen/qwen-2.5-72b-instruct:free',
  'qwen/qwen-2.5-7b-instruct',
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-r1:free',
  'google/gemini-2.0-flash-001',
  'openai/gpt-4o-mini',
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
  'qwen-large',
  'mistral',
  'openai',
  'qwen-coder',
];

const SYSTEM_PROMPT = `You are an Executive Senior Investigative Editor at 9jaBeacon.

YOUR EDITORIAL MANDATE & GOLDEN STANDARD:
Write an authoritative, factual, high-retention news report structured into EXACTLY 3 or 4 substantive paragraphs with context-derived headings (Option A).

ARTICLE STRUCTURE (OPTION A: DYNAMIC STORY-DERIVED SUBHEADINGS):
- Every article MUST consist of 3 to 4 distinct paragraphs.
- EACH paragraph MUST be preceded by its own dynamic, story-derived <h3> heading that reflects the specific subject of that paragraph (e.g., specific names, entities, policies, actions, or developments).
- STRICTLY FORBIDDEN: Do NOT use static, repetitive generic headings such as "The Crux", "Background & Institutional Context", "Socioeconomic Stakes", or "Official Reactions". Every heading must be unique to the story facts.
- STRICT WORD COUNT MANDATE:
  * The entire article MUST contain AT LEAST 300 WORDS of substantive text (strictly 300 to 450 words total).
  * Each of the 3 to 4 paragraphs must contain between 75 and 115 words of rich, comprehensive journalistic prose.
  * Any draft containing fewer than 300 words will be rejected by the editorial quality gate.

STRICT QUALITY MANDATES:
- NO fallback templates, NO boilerplate sentences ("This development is poised to impact governance...", "As this development continues to unfold across Nigeria, key questions remain regarding regulatory oversight...", "The Stakes", "The Stats").
- Never inject Nigerian governance boilerplate into World or Sports stories.
- NO artificial placeholder quotes or fabricated 9jaBeacon desk quotes.
- NO repetitive phrases or bullet list dumps.
- Return strictly factual, well-researched information based on the input story wire.

CATEGORY RULES (choose ONE primary by MAIN topic, not by incidental money words):
- cat_naija_news → Politics, governance, security, police, courts, elections, public institutions, Nigeria-led social issues
- cat_money_hustle → NGX, companies, inflation, FX, CBN, manufacturing data, banking, fiscal/macro as the subject
- cat_sports → Matches, clubs, players, tournaments, Super Eagles, Premier League
- cat_world → Foreign lead with no Nigeria-first angle

Return ONLY valid JSON (no markdown fences, strictly parseable):
{
  "title": "Compelling, factual, non-clickbait headline",
  "summary": "An executive 2-sentence briefing summarizing the core event and its primary significance.",
  "content": "<h3>[Dynamic Story-Derived Subheading 1]</h3><p>[Substantive paragraph 1, 75-110 words]</p><h3>[Dynamic Story-Derived Subheading 2]</h3><p>[Substantive paragraph 2, 75-110 words]</p><h3>[Dynamic Story-Derived Subheading 3]</h3><p>[Substantive paragraph 3, 75-110 words]</p><h3>[Dynamic Story-Derived Subheading 4]</h3><p>[Substantive paragraph 4, 75-110 words]</p>",
  "category_id": "cat_naija_news | cat_money_hustle | cat_sports | cat_world",
  "reading_time_minutes": 2,
  "key_takeaways": [
    "Key verified fact or primary figure",
    "Direct policy or economic impact point",
    "Official stance or regulatory action",
    "Upcoming date or milestone to watch"
  ]
}`;

export async function synthesizeNewsArticle(
  input: AiSynthesisInput,
  config: AiCredentialsConfig = {}
): Promise<AiSynthesisResult> {
  const accountId = (config.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const cfToken = (config.cloudflareApiToken || process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const openrouterKey = (config.openrouterApiKey || process.env.OPENROUTER_API_KEY || '').trim();
  const localEndpoint = (config.localAiEndpoint || process.env.LOCAL_AI_ENDPOINT || '').trim().replace(/\/+$/, '');
  const localModel = (config.localAiModel || process.env.LOCAL_AI_MODEL || 'qwen2.5:3b').trim();
  const localKey = (config.localAiApiKey || process.env.LOCAL_AI_API_KEY || 'ollama').trim();
  const pollinationsKey = (config.pollinationsApiKey || process.env.POLLINATIONS_API_KEY || '').trim();

  const userContent = `RAW SOURCE: ${input.sourceName}
SOURCE URL: ${input.originalUrl}
RAW TITLE: ${input.title}
RAW DESCRIPTION: ${input.description || ''}
RAW CONTENT: ${input.content ? input.content.slice(0, 3000) : input.description || ''}

Rewrite into a 9jaBeacon article following the JSON schema.`;

  const errors: string[] = [];
  const traceLogs: string[] = [];

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
        content: `EDITORIAL REJECTION: Your draft contains only ${currentWordCount} words, which violates our strict quality threshold of 300 words minimum.
Please EXPAND this article to between 320 and 420 words total across 3 to 4 comprehensive paragraphs, each introduced by a story-specific <h3> heading (Option A).
Deepen the factual analysis, explain historical precedents, detail citizen and market impacts, and report verified stakeholder statements.
Output strictly updated JSON matching the schema with at least 300 words of content.`
      }
    ];
    try {
      const expandedRaw = await callModel(expansionMessages);
      if (!expandedRaw) return null;
      return parseAiJsonResponse(expandedRaw, input);
    } catch {
      return null;
    }
  };

  // TIER 1: Cloudflare Workers AI (Llama / Qwen / Mistral)
  if (accountId && cfToken) {
    for (const modelCandidate of CLOUDFLARE_MODELS_CASCADE) {
      try {
        traceLogs.push(`Tier 1: Attempting Cloudflare Workers AI with ${modelCandidate}`);
        const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelCandidate}`;
        const cfRes = await fetch(cfUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
            temperature: 0.3,
            max_tokens: 2800,
          }),
          signal: AbortSignal.timeout(18000),
        });

        if (cfRes.ok) {
          const cfData = await cfRes.json() as any;
          const rawText = cfData?.result?.response || cfData?.response || '';
          let parsed = parseAiJsonResponse(rawText, input);
          if (parsed) {
            if (parsed.wordCount < 300) {
              traceLogs.push(`Tier 1 (${modelCandidate}): Draft contains only ${parsed.wordCount} words (<300 required). Requesting AI expansion...`);
              const expanded = await attemptAiExpansion(rawText, parsed.wordCount, async (msgs) => {
                const retryRes = await fetch(cfUrl, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messages: msgs, temperature: 0.3, max_tokens: 2800 }),
                  signal: AbortSignal.timeout(18000),
                });
                if (!retryRes.ok) return null;
                const d = await retryRes.json() as any;
                return d?.result?.response || d?.response || null;
              });

              if (expanded && expanded.wordCount >= 300) {
                traceLogs.push(`Tier 1 (${modelCandidate}): Expansion successful — expanded from ${parsed.wordCount} to ${expanded.wordCount} words (>=300 threshold satisfied).`);
                parsed = expanded;
              } else {
                const finalWords = expanded ? expanded.wordCount : parsed.wordCount;
                traceLogs.push(`Tier 1 (${modelCandidate}): Expansion failed to reach 300 words (${finalWords} words). Strictly no fallback template permitted.`);
                errors.push(`Tier 1 (${modelCandidate}): Word count strictly below 300 words (${finalWords} words) after expansion attempt.`);
                continue;
              }
            }

            traceLogs.push(`Tier 1 Success: Rewritten by Cloudflare AI (${modelCandidate}) [${parsed.wordCount} words]`);
            return {
              success: true,
              provider: 'cloudflare_workers_ai',
              modelUsed: modelCandidate,
              traceLogs,
              ...parsed,
            };
          } else {
            traceLogs.push(`Tier 1 (${modelCandidate}): Response format did not meet editorial JSON schema`);
          }
        } else {
          const errText = await cfRes.text();
          const errSummary = `CF AI (${modelCandidate}) HTTP ${cfRes.status}: ${errText.slice(0, 80)}`;
          errors.push(errSummary);
          traceLogs.push(`Tier 1 Failed: ${errSummary}`);
        }
      } catch (cfErr: any) {
        const errSummary = `CF AI (${modelCandidate}): ${cfErr.message}`;
        errors.push(errSummary);
        traceLogs.push(`Tier 1 Error: ${errSummary}`);
      }
    }
  } else {
    traceLogs.push('Tier 1 Skipped: Cloudflare Workers AI credentials not configured');
  }

  // TIER 2: OpenRouter AI (Qwen 2.5, DeepSeek R1, Llama 3.3)
  if (openrouterKey) {
    for (const modelCandidate of OPENROUTER_MODELS_CASCADE) {
      try {
        traceLogs.push(`Tier 2: Attempting OpenRouter AI with ${modelCandidate}`);
        const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'HTTP-Referer': 'https://9jabeacon.name.ng',
            'X-Title': '9jaBeacon Verified Nigerian News',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelCandidate,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
            temperature: 0.3,
            max_tokens: 2800,
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(22000),
        });

        if (openrouterRes.ok) {
          const orData = await openrouterRes.json() as any;
          const rawText = orData?.choices?.[0]?.message?.content || '';
          let parsed = parseAiJsonResponse(rawText, input);
          if (parsed) {
            if (parsed.wordCount < 300) {
              traceLogs.push(`Tier 2 (${modelCandidate}): Draft contains only ${parsed.wordCount} words (<300 required). Requesting AI expansion...`);
              const expanded = await attemptAiExpansion(rawText, parsed.wordCount, async (msgs) => {
                const retryRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${openrouterKey}`,
                    'HTTP-Referer': 'https://9jabeacon.name.ng',
                    'X-Title': '9jaBeacon Verified Nigerian News',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: modelCandidate,
                    messages: msgs,
                    temperature: 0.3,
                    max_tokens: 2800,
                    response_format: { type: 'json_object' },
                  }),
                  signal: AbortSignal.timeout(22000),
                });
                if (!retryRes.ok) return null;
                const d = await retryRes.json() as any;
                return d?.choices?.[0]?.message?.content || null;
              });

              if (expanded && expanded.wordCount >= 300) {
                traceLogs.push(`Tier 2 (${modelCandidate}): Expansion successful — expanded from ${parsed.wordCount} to ${expanded.wordCount} words (>=300 threshold satisfied).`);
                parsed = expanded;
              } else {
                const finalWords = expanded ? expanded.wordCount : parsed.wordCount;
                traceLogs.push(`Tier 2 (${modelCandidate}): Expansion failed to reach 300 words (${finalWords} words). Strictly no fallback template permitted.`);
                errors.push(`Tier 2 (${modelCandidate}): Word count strictly below 300 words (${finalWords} words) after expansion attempt.`);
                continue;
              }
            }

            traceLogs.push(`Tier 2 Success: Rewritten by OpenRouter AI (${modelCandidate}) [${parsed.wordCount} words]`);
            return {
              success: true,
              provider: 'openrouter_ai',
              modelUsed: orData?.model || modelCandidate,
              traceLogs,
              ...parsed,
            };
          } else {
            traceLogs.push(`Tier 2 (${modelCandidate}): Invalid JSON or missing title/content`);
          }
        } else {
          const errText = await openrouterRes.text();
          const errSummary = `OpenRouter (${modelCandidate}) HTTP ${openrouterRes.status}: ${errText.slice(0, 80)}`;
          errors.push(errSummary);
          traceLogs.push(`Tier 2 Failed: ${errSummary}`);
        }
      } catch (orErr: any) {
        const errSummary = `OpenRouter (${modelCandidate}): ${orErr.message}`;
        errors.push(errSummary);
        traceLogs.push(`Tier 2 Error: ${errSummary}`);
      }
    }
  } else {
    traceLogs.push('Tier 2 Skipped: OpenRouter API key not configured');
  }

  // TIER 3: Local Downloaded Small AI Models (Ollama / LM Studio / LocalAI - Qwen / Llama)
  if (localEndpoint) {
    const modelsToTry = [localModel, ...LOCAL_MODELS_CASCADE.filter(m => m !== localModel)];
    const cleanBaseUrl = localEndpoint.endsWith('/v1') ? localEndpoint : `${localEndpoint}/v1`;

    for (const localCandidate of modelsToTry.slice(0, 3)) {
      try {
        traceLogs.push(`Tier 3 (Local AI): Attempting local model ${localCandidate} at ${cleanBaseUrl}`);
        const localRes = await fetch(`${cleanBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localKey}`,
            'Content-Type': 'application/json',
          },
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
          const localData = await localRes.json() as any;
          const rawText = localData?.choices?.[0]?.message?.content || '';
          let parsed = parseAiJsonResponse(rawText, input);
          if (parsed) {
            if (parsed.wordCount < 300) {
              traceLogs.push(`Tier 3 (${localCandidate}): Draft contains only ${parsed.wordCount} words (<300 required). Requesting AI expansion...`);
              const expanded = await attemptAiExpansion(rawText, parsed.wordCount, async (msgs) => {
                const retryRes = await fetch(`${cleanBaseUrl}/chat/completions`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${localKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ model: localCandidate, messages: msgs, temperature: 0.2, max_tokens: 2800 }),
                  signal: AbortSignal.timeout(20000),
                });
                if (!retryRes.ok) return null;
                const d = await retryRes.json() as any;
                return d?.choices?.[0]?.message?.content || null;
              });

              if (expanded && expanded.wordCount >= 300) {
                traceLogs.push(`Tier 3 (${localCandidate}): Expansion successful — expanded from ${parsed.wordCount} to ${expanded.wordCount} words (>=300 threshold satisfied).`);
                parsed = expanded;
              } else {
                const finalWords = expanded ? expanded.wordCount : parsed.wordCount;
                traceLogs.push(`Tier 3 (${localCandidate}): Expansion failed to reach 300 words (${finalWords} words). Strictly no fallback template permitted.`);
                errors.push(`Tier 3 (${localCandidate}): Word count strictly below 300 words (${finalWords} words) after expansion attempt.`);
                continue;
              }
            }

            traceLogs.push(`Tier 3 Success: Rewritten locally by ${localCandidate} [${parsed.wordCount} words]`);
            return {
              success: true,
              provider: 'local_ai_model',
              modelUsed: `Local (${localCandidate})`,
              traceLogs,
              ...parsed,
            };
          }
        } else {
          const errText = await localRes.text();
          errors.push(`Local AI (${localCandidate}) HTTP ${localRes.status}: ${errText.slice(0, 60)}`);
          traceLogs.push(`Tier 3 Failed: Local endpoint returned HTTP ${localRes.status}`);
        }
      } catch (localErr: any) {
        errors.push(`Local AI (${localCandidate}): ${localErr.message}`);
        traceLogs.push(`Tier 3 Error: Local endpoint unreachable (${localErr.message})`);
      }
    }
  } else {
    traceLogs.push('Tier 3 Skipped: No local AI endpoint configured (e.g. http://127.0.0.1:11434)');
  }

  // TIER 4: Pollinations AI (Qwen-Coder, Qwen-Large, Mistral, OpenAI)
  for (const pollModel of POLLINATIONS_MODELS_CASCADE) {
    try {
      traceLogs.push(`Tier 4: Attempting Pollinations AI with ${pollModel}`);
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
        let parsed = parseAiJsonResponse(rawText, input);
        if (parsed) {
          if (parsed.wordCount < 300) {
            traceLogs.push(`Tier 4 (${pollModel}): Draft contains only ${parsed.wordCount} words (<300 required). Requesting AI expansion...`);
            const expanded = await attemptAiExpansion(rawText, parsed.wordCount, async (msgs) => {
              const retryRes = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: pollinationsHeaders,
                body: JSON.stringify({ messages: msgs, model: pollModel, jsonMode: true, seed: 42 }),
                signal: AbortSignal.timeout(22000),
              });
              if (!retryRes.ok) return null;
              return await retryRes.text();
            });

            if (expanded && expanded.wordCount >= 300) {
              traceLogs.push(`Tier 4 (${pollModel}): Expansion successful — expanded from ${parsed.wordCount} to ${expanded.wordCount} words (>=300 threshold satisfied).`);
              parsed = expanded;
            } else {
              const finalWords = expanded ? expanded.wordCount : parsed.wordCount;
              traceLogs.push(`Tier 4 (${pollModel}): Expansion failed to reach 300 words (${finalWords} words). Strictly no fallback template permitted.`);
              errors.push(`Tier 4 (${pollModel}): Word count strictly below 300 words (${finalWords} words) after expansion attempt.`);
              continue;
            }
          }

          traceLogs.push(`Tier 4 Success: Rewritten by Pollinations AI (${pollModel}) [${parsed.wordCount} words]`);
          return {
            success: true,
            provider: 'pollinations_ai',
            modelUsed: `Pollinations-${pollModel}`,
            traceLogs,
            ...parsed,
          };
        } else {
          traceLogs.push(`Tier 4 (${pollModel}): Response could not be parsed into JSON`);
        }
      } else {
        traceLogs.push(`Tier 4 (${pollModel}): HTTP ${pollRes.status}`);
        if (pollRes.status === 429) {
          errors.push(`Pollinations (${pollModel}): Rate limited (HTTP 429)`);
          // Apply pacing backoff before attempting next cascade model to prevent consecutive 429s
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } catch (pollErr: any) {
      errors.push(`Pollinations (${pollModel}): ${pollErr.message}`);
      traceLogs.push(`Tier 4 Error (${pollModel}): ${pollErr.message}`);
    }
  }

  // If all AI tiers failed, strictly do NOT generate artificial preset wire articles. Return failure so it is recorded in rejected articles log.
  traceLogs.push('All active AI tiers failed to synthesize article meeting the strict 300-word editorial threshold.');
  return {
    success: false,
    error: `All AI synthesis tiers failed: ${errors.slice(0, 3).join('; ') || 'Content did not meet strict 300-word threshold and could not be expanded'}`,
    traceLogs,
  };
}

export async function generateEditorialNewsImage(
  params: { title: string; categoryId?: string; summary?: string },
  _config: AiCredentialsConfig = {}
): Promise<{ imageUrl: string; caption: string; credit: string }> {
  // Always produce a pristine, crisp vector SVG editorial card
  // This guarantees zero blurry/distorted AI hallucinations, zero watermarks, and instant loading
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
} | null {
  if (!rawText) return null;

  try {
    let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    const obj = JSON.parse(cleaned);

    if (!obj.title || typeof obj.title !== 'string' || obj.title.trim().length < 5) {
      return null;
    }

    const summary = cleanRssSnippet(obj.summary || obj.description || fallbackInput.description || '');
    let content = obj.content || '';
    content = cleanAndFormatArticleHtml(content);

    // Initial sanity gate: minimum 80 words and at least 2 distinct paragraphs to be candidate for parsing
    const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
    const paragraphCount = (content.match(/<p>/gi) || []).length;

    if (wordCount < 80 || paragraphCount < 2) {
      return null;
    }

    // ULTRA-STRONG category decision
    const decision = decideCategories(
      obj.title,
      plainText + ' ' + summary,
      obj.category_id || fallbackInput.categoryDefault,
      fallbackInput.sourceName
    );

    // Honest reading time based on 200 wpm standard
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    const takeaways = Array.isArray(obj.key_takeaways)
      ? obj.key_takeaways.map((t: any) => String(t).trim()).filter(Boolean)
      : [];

    return {
      title: obj.title.trim(),
      summary: summary.trim(),
      content: content.trim(),
      categoryId: decision.primary,
      secondaryCategoryId: decision.secondary,
      readingTimeMinutes: readingTime,
      keyTakeaways: takeaways,
      wordCount,
      paragraphCount,
    };
  } catch {
    return null;
  }
}

