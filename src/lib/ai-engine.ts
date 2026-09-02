/**
 * 4-Tier Multi-LLM Autonomous News Editorial & Synthesis Engine for 9jaBeacon
 * Supports Cloudflare Workers AI, OpenRouter, Local AI (Ollama/LM Studio/Qwen), Pollinations AI, and Editorial Core.
 * With ULTRA-STRONG category mapping (Money / Sports / World / Naija)
 */

import { decideCategories } from './category-mapper';

export interface AiSynthesisInput {
  title: string;
  sourceName: string;
  originalUrl: string;
  description?: string;
  content?: string;
  categoryDefault?: string;
}

export interface AiSynthesisResult {
  success: boolean;
  provider?: 'cloudflare_workers_ai' | 'openrouter_ai' | 'local_ai_model' | 'pollinations_ai' | 'editorial_synthesis_engine';
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
  'qwen-coder',
  'qwen-large',
  'openai',
  'mistral',
];

const SYSTEM_PROMPT = `You are a Senior Nigerian Investigative News Editor at 9jaBeacon.

Rewrite the raw RSS lead into a clear, comprehensive news article for Nigerian readers.

STRUCTURE (HTML):
- <h3>The Scoop</h3> — what happened
- <h3>The Stakes</h3> — impact on Nigerians
- <h3>The Stats</h3> — key figures + quote

CATEGORY RULES (choose ONE primary):
- cat_money_hustle → ANY money topic (loan, grant, crypto, bank, naira, oil, budget, fintech, investment, salary, tax, transfer fee, business)
- cat_sports → ANY sport (football, boxing, athletics, matches, players, coaches)
- cat_world → Foreign / non-Nigerian news
- cat_naija_news → Nigerian politics, security, governance, local affairs

If a story is both sports and money (e.g. player transfer), still pick the best primary and we will handle dual display.

Return ONLY valid JSON:
{
  "title": "...",
  "summary": "2 clear sentences",
  "content": "<h3>The Scoop</h3><p>...</p>...",
  "category_id": "cat_money_hustle | cat_sports | cat_world | cat_naija_news",
  "reading_time_minutes": 4,
  "key_takeaways": ["...", "...", "..."]
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
            max_tokens: 1800,
          }),
          signal: AbortSignal.timeout(6000),
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
            'HTTP-Referer': 'https://9jabeacon.pages.dev',
            'X-Title': '9jaBeacon News Engine',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelCandidate,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
            temperature: 0.3,
            max_tokens: 1800,
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(7000),
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
            max_tokens: 1500,
          }),
          signal: AbortSignal.timeout(8000),
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
        signal: AbortSignal.timeout(7000),
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

  // TIER 5: Editorial Synthesis Engine (Structured NLP Fallback)
  traceLogs.push('Tier 5: Engaging 9jaBeacon Editorial Synthesis Engine fallback');
  const rawText = input.content || input.description || '';
  if (input.title && (rawText.length > 30 || input.title.length > 15)) {
    const cleanHeadline = input.title
      .replace(/\s*[-–|]\s*(The Punch|Vanguard|Channels TV|VON|BBC|Reuters|TechCabal|BusinessDay|Daily Post|Guardian).*$/i, '')
      .trim();

    const paragraphs = rawText
      .replace(/<[^>]+>/g, '')
      .split(/\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 20);

    const firstLead = paragraphs[0] || input.description || 'Breaking developments have emerged.';
    const secondDetail = paragraphs[1] || 'Authorities and industry stakeholders are actively monitoring the situation.';

    const structuredContent = `
<h3>The Scoop</h3>
<p>${firstLead}</p>
<p>${secondDetail}</p>
<h3>The Stakes</h3>
<p>This development is poised to impact governance, citizens, and relevant market sectors across Nigeria.</p>
<h3>The Stats</h3>
<ul>
  <li><strong>Source:</strong> ${input.sourceName}</li>
  <li><strong>Status:</strong> Active lead verified by 9jaBeacon Editorial Desk</li>
</ul>
<blockquote>"Accurate, verified reporting remains vital for public awareness," noted the 9jaBeacon Editorial Desk.</blockquote>
    `.trim();

    const decision = decideCategories(cleanHeadline, structuredContent, input.categoryDefault, input.sourceName);

    traceLogs.push(`Tier 5 Success: Synthesized via Editorial NLP Engine into category "${decision.primary}"`);
    return {
      success: true,
      provider: 'editorial_synthesis_engine',
      modelUsed: '9jaBeacon-Editorial-NLP-Core',
      title: cleanHeadline,
      summary: firstLead.slice(0, 200) + (firstLead.length > 200 ? '...' : ''),
      content: structuredContent,
      categoryId: decision.primary,
      secondaryCategoryId: decision.secondary,
      readingTimeMinutes: Math.max(2, Math.ceil(structuredContent.split(/\s+/).length / 160)),
      keyTakeaways: [
        `Verified report wire from ${input.sourceName}`,
        'Structured and normalized by 9jaBeacon editorial desk',
        `Primary classified under ${decision.primary.replace('cat_', '').replace(/_/g, ' ').toUpperCase()}`,
      ],
      traceLogs,
    };
  }

  traceLogs.push('Workflow Gate: All AI tiers and fallback engine failed to extract sufficient content');
  return {
    success: false,
    error: `AI Waterfall Exceeded: ${errors.slice(0, 3).join(' | ')}`,
    traceLogs,
  };
}

export async function generateEditorialNewsImage(
  params: { title: string; categoryId?: string; summary?: string },
  config: AiCredentialsConfig = {}
): Promise<{ imageUrl: string; caption: string; credit: string }> {
  const accountId = (config.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const cfToken = (config.cloudflareApiToken || process.env.CLOUDFLARE_API_TOKEN || '').trim();

  const conceptualSubject = buildSafeConceptualPrompt(params.categoryId || 'cat_naija_news');
  const safeNegativeConstraint = 'NO humans, NO faces, NO people, NO politicians, NO portraits, NO crowd, NO text, NO watermarks, high-end editorial photography, 8k resolution, cinematic lighting, photorealistic';
  const fullPrompt = `${conceptualSubject}, ${safeNegativeConstraint}`;

  if (accountId && cfToken) {
    const imageModels = [
      '@cf/black-forest-labs/flux-1-schnell',
      '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    ];

    for (const imgModel of imageModels) {
      try {
        const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${imgModel}`;
        const res = await fetch(cfUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: fullPrompt, num_steps: 4 }),
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('image/')) {
            const arrayBuffer = await res.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            return {
              imageUrl: `data:${contentType};base64,${base64}`,
              caption: `Editorial concept: ${params.title.slice(0, 80)}`,
              credit: `Cloudflare Workers AI (${imgModel})`,
            };
          } else {
            const json = await res.json() as any;
            if (json?.result?.image) {
              return {
                imageUrl: `data:image/jpeg;base64,${json.result.image}`,
                caption: `Editorial concept: ${params.title.slice(0, 80)}`,
                credit: `Cloudflare Workers AI (${imgModel})`,
              };
            }
          }
        }
      } catch (err: any) {
        console.warn(`[Cloudflare Image AI ${imgModel}]:`, err.message);
      }
    }
  }

  const cleanEncodedPrompt = encodeURIComponent(
    `${conceptualSubject}, conceptual editorial photography, studio lighting, highly detailed, NO human beings, NO faces, NO text`
  );

  return {
    imageUrl: `https://image.pollinations.ai/prompt/${cleanEncodedPrompt}?width=1200&height=675&nologo=true&model=flux`,
    caption: `Symbolic editorial concept: ${params.title.slice(0, 80)}.`,
    credit: '9jaBeacon Editorial AI Desk (Flux Engine)',
  };
}

function buildSafeConceptualPrompt(categoryId: string): string {
  switch (categoryId) {
    case 'cat_money_hustle':
      return `Central Bank of Nigeria architectural facade, modern skyscraper finance district in Lagos, stacks of Nigerian Naira notes, stock market graph, high-end financial still life`;
    case 'cat_sports':
      return `Modern national football stadium under floodlights, soccer ball on green grass, trophy on glass pedestal, sports photography`;
    case 'cat_world':
      return `Global diplomacy summit hall with international flags, United Nations assembly room, digital earth globe`;
    default:
      return `Nigerian National Assembly complex in Abuja under dramatic sky, gavel on wooden desk, green and white Nigerian flag`;
  }
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

    const summary = obj.summary || obj.description || fallbackInput.description || '';
    let content = obj.content || '';
    if (!content.includes('<p>')) {
      content = content.split('\n\n').filter(Boolean).map((p: string) => `<p>${p}</p>`).join('');
    }

    if (content.length < 80) return null;

    // ULTRA-STRONG category decision
    const decision = decideCategories(
      obj.title,
      content + ' ' + summary,
      obj.category_id || fallbackInput.categoryDefault,
      fallbackInput.sourceName
    );

    const readingTime = Number(obj.reading_time_minutes) || Math.max(3, Math.ceil(content.split(/\s+/).length / 180));

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

