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

const SYSTEM_PROMPT = `You are an Executive Nigerian Senior Investigative Editor at 9jaBeacon.

YOUR EDITORIAL MANDATE & GOLDEN STANDARD:
Write an authoritative, factual, high-retention news report structured into EXACTLY 3 or 4 paragraphs.

ARTICLE STRUCTURE (STRICTLY 3 OR 4 PARAGRAPHS):
Every article MUST consist of 3 to 4 distinct paragraphs, where EACH paragraph is introduced by its own unobtrusive native banner heading (<h3>).
Every paragraph MUST contain between 65 and 95 words (minimum 65 words per paragraph, roughly 3 to 4 comprehensive journalistic sentences). The entire report MUST be between 280 and 380 words in total.

REQUIRED 4-PARAGRAPH FORMAT (HTML with <h3> headings):
1. <h3>The Crux: What Happened & Verified Facts</h3>
   Paragraph 1 (70 to 90 words): The breaking core development. State who, what, when, where, official confirmations, and the immediate verified sequence of events without fluff.
2. <h3>Background & Institutional Context</h3>
   Paragraph 2 (75 to 95 words): Precedent, historical context, relevant Nigerian laws or international background, and previous milestones explaining how this event unfolded.
3. <h3>Socioeconomic Stakes & Real-Life Impact</h3>
   Paragraph 3 (75 to 95 words): Direct, tangible implications for everyday Nigerian citizens, market prices, transport, governance, security, or community welfare.
4. <h3>Official Reactions & What to Watch</h3>
   Paragraph 4 (65 to 85 words): Verified stances from government officials, industry leaders, or key stakeholders, concluded by upcoming dates, scheduled hearings, or next steps to watch.

STRICT QUALITY MANDATES:
- NO fallback templates, NO boilerplate sentences ("This development is poised to impact governance...", "The Stakes", "The Stats").
- NO artificial placeholder quotes or fabricated 9jaBeacon desk quotes.
- NO repetitive phrases or bullet list dumps.
- Do NOT output thin content under 240 words total.
- Return strictly factual, well-researched information based on the input story wire.

CATEGORY RULES (choose ONE primary):
- cat_money_hustle → ANY money, finance, banking, naira, forex, loans, crypto, inflation, business, fuel
- cat_sports → ANY sports, football, athletics, transfers, Super Eagles, Premier League
- cat_world → Foreign and international affairs outside Nigeria
- cat_naija_news → Nigerian politics, security, governance, judiciary, community affairs

Return ONLY valid JSON (no markdown fences, strictly parseable):
{
  "title": "Compelling, factual, non-clickbait headline",
  "summary": "An executive 2-sentence briefing summarizing the core event and its primary significance.",
  "content": "<h3>The Crux: What Happened & Verified Facts</h3><p>...</p><h3>Background & Institutional Context</h3><p>...</p><h3>Socioeconomic Stakes & Real-Life Impact</h3><p>...</p><h3>Official Reactions & What to Watch</h3><p>...</p>",
  "category_id": "cat_money_hustle | cat_sports | cat_world | cat_naija_news",
  "reading_time_minutes": 3,
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
          const parsed = parseAiJsonResponse(rawText, input);
          if (parsed) {
            traceLogs.push(`Tier 1 Success: Rewritten by Cloudflare AI (${modelCandidate})`);
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
          const parsed = parseAiJsonResponse(rawText, input);
          if (parsed) {
            traceLogs.push(`Tier 2 Success: Rewritten by OpenRouter AI (${modelCandidate})`);
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
          const parsed = parseAiJsonResponse(rawText, input);
          if (parsed) {
            traceLogs.push(`Tier 3 Success: Rewritten locally by ${localCandidate}`);
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
        const parsed = parseAiJsonResponse(rawText, input);
        if (parsed) {
          traceLogs.push(`Tier 4 Success: Rewritten by Pollinations AI (${pollModel})`);
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
      }
    } catch (pollErr: any) {
      errors.push(`Pollinations (${pollModel}): ${pollErr.message}`);
      traceLogs.push(`Tier 4 Error (${pollModel}): ${pollErr.message}`);
    }
  }

  // If all AI tiers failed, do not generate artificial preset wire articles. Return strict failure so the user/admin can rewrite or investigate.
  traceLogs.push('All active AI tiers failed to synthesize article.');
  return {
    success: false,
    error: `All AI synthesis tiers failed: ${errors.slice(0, 3).join('; ') || 'No AI providers available'}`,
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

    // Strict quality gate: minimum 180 words and at least 3 distinct paragraphs
    const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
    const paragraphCount = (content.match(/<p>/gi) || []).length;

    if (wordCount < 180 || paragraphCount < 3) {
      return null;
    }

    // ULTRA-STRONG category decision
    const decision = decideCategories(
      obj.title,
      plainText + ' ' + summary,
      obj.category_id || fallbackInput.categoryDefault,
      fallbackInput.sourceName
    );

    const readingTime = Number(obj.reading_time_minutes) || Math.max(2, Math.ceil(wordCount / 160));

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
    };
  } catch {
    return null;
  }
}

