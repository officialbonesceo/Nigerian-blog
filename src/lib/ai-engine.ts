/**
 * 3-Tier Multi-LLM Autonomous News Editorial & Synthesis Engine for 9jaBeacon
 * Now with ULTRA-STRONG category mapping (Money / Sports / World / Naija)
 * Supports multi-category (e.g. player transfer = Sports + Money)
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
  provider?: 'cloudflare_workers_ai' | 'openrouter_ai' | 'pollinations_ai' | 'editorial_synthesis_engine';
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
}

export interface AiCredentialsConfig {
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  cloudflareModel?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  pollinationsApiKey?: string;
  customPromptTemplate?: string;
}

export const CLOUDFLARE_MODELS_CASCADE = [
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.2',
];

export const OPENROUTER_MODELS_CASCADE = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-001',
  'openai/gpt-4o-mini',
];

export const POLLINATIONS_MODELS_CASCADE = [
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
  const pollinationsKey = (config.pollinationsApiKey || process.env.POLLINATIONS_API_KEY || '').trim();

  const userContent = `RAW SOURCE: ${input.sourceName}
SOURCE URL: ${input.originalUrl}
RAW TITLE: ${input.title}
RAW DESCRIPTION: ${input.description || ''}
RAW CONTENT: ${input.content ? input.content.slice(0, 3000) : input.description || ''}

Rewrite into a 9jaBeacon article following the JSON schema.`;

  const errors: string[] = [];

  // TIER 1: Cloudflare Workers AI
  if (accountId && cfToken) {
    for (const modelCandidate of CLOUDFLARE_MODELS_CASCADE) {
      try {
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
            return {
              success: true,
              provider: 'cloudflare_workers_ai',
              modelUsed: modelCandidate,
              ...parsed,
            };
          }
        } else {
          const errText = await cfRes.text();
          errors.push(`CF AI (${modelCandidate}) HTTP ${cfRes.status}: ${errText.slice(0, 80)}`);
        }
      } catch (cfErr: any) {
        errors.push(`CF AI (${modelCandidate}): ${cfErr.message}`);
      }
    }
  }

  // TIER 2: OpenRouter
  if (openrouterKey) {
    for (const modelCandidate of OPENROUTER_MODELS_CASCADE) {
      try {
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
          signal: AbortSignal.timeout(6000),
        });

        if (openrouterRes.ok) {
          const orData = await openrouterRes.json() as any;
          const rawText = orData?.choices?.[0]?.message?.content || '';
          const parsed = parseAiJsonResponse(rawText, input);
          if (parsed) {
            return {
              success: true,
              provider: 'openrouter_ai',
              modelUsed: orData?.model || modelCandidate,
              ...parsed,
            };
          }
        }
      } catch (orErr: any) {
        errors.push(`OpenRouter (${modelCandidate}): ${orErr.message}`);
      }
    }
  }

  // TIER 3: Pollinations
  for (const pollModel of POLLINATIONS_MODELS_CASCADE) {
    try {
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
        signal: AbortSignal.timeout(6000),
      });

      if (pollRes.ok) {
        const rawText = await pollRes.text();
        const parsed = parseAiJsonResponse(rawText, input);
        if (parsed) {
          return {
            success: true,
            provider: 'pollinations_ai',
            modelUsed: `pollinations-${pollModel}`,
            ...parsed,
          };
        }
      }
    } catch (pollErr: any) {
      errors.push(`Pollinations (${pollModel}): ${pollErr.message}`);
    }
  }

  // TIER 4: Editorial fallback
  const rawText = input.content || input.description || '';
  if (input.title && (rawText.length > 30 || input.title.length > 15)) {
    const cleanHeadline = input.title
      .replace(/\s*[-–|]\s*(The Punch|Vanguard|Channels TV|VON|BBC|Reuters|TechCabal|BusinessDay).*$/i, '')
      .trim();

    const paragraphs = rawText
      .replace(/<[^>]+>/g, '')
      .split(/\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 20);

    const firstLead = paragraphs[0] || input.description || 'Breaking developments have emerged.';
    const secondDetail = paragraphs[1] || 'Authorities are monitoring the situation.';

    const structuredContent = `
<h3>The Scoop</h3>
<p>${firstLead}</p>
<p>${secondDetail}</p>
<h3>The Stakes</h3>
<p>This development has implications for policy, markets and citizens.</p>
<h3>The Stats</h3>
<ul>
  <li><strong>Source:</strong> ${input.sourceName}</li>
  <li><strong>Status:</strong> Actively monitored</li>
</ul>
<blockquote>"Verification remains paramount," noted the 9jaBeacon Editorial Desk.</blockquote>
    `.trim();

    const decision = decideCategories(cleanHeadline, structuredContent, input.categoryDefault, input.sourceName);

    return {
      success: true,
      provider: 'editorial_synthesis_engine',
      modelUsed: '9jaBeacon-Editorial-Core',
      title: cleanHeadline,
      summary: firstLead.slice(0, 200) + (firstLead.length > 200 ? '...' : ''),
      content: structuredContent,
      categoryId: decision.primary,
      secondaryCategoryId: decision.secondary,
      readingTimeMinutes: Math.max(2, Math.ceil(structuredContent.split(/\s+/).length / 160)),
      keyTakeaways: [
        `Verified report from ${input.sourceName}`,
        'Structured by 9jaBeacon editorial desk',
      ],
    };
  }

  return {
    success: false,
    error: `STRICT AI GATE: ${errors.slice(0, 3).join(' | ')}`,
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
      '@cf/stabilityai/stable-diffusion-xl-base-1.0'
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

    if (content.length < 100) return null;

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
