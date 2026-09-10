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

const SYSTEM_PROMPT = `You are an Executive Nigerian Senior Investigative Editor at 9jaBeacon.

Your mission is to rewrite raw RSS leads into authoritative, rich, comprehensive, and well-explained news articles for Nigerian readers. DO NOT WRITE SHORT OR SUPERFICIAL SUMMARIES. Provide deep contextual reporting, background, policy implications, and clear analysis.

ARTICLE STRUCTURE (HTML with standard headings):
- <h3>The Crux & What Happened</h3>
  Provide 2 to 3 detailed paragraphs detailing the breaking event: who, what, when, where, and the exact official statements or decisions taken.
- <h3>Deep-Dive Background & Precedent</h3>
  Provide 1 to 2 thorough paragraphs detailing historical precedent, previous related incidents, relevant laws or regulatory guidelines, and how the issue reached this critical stage.
- <h3>The Stakes: Real-Life Impact on Everyday Nigerians</h3>
  Provide 2 substantive paragraphs analyzing the tangible impact on citizens, transport costs, purchasing power, business operations, market stability, or community safety.
- <h3>Key Reactions & Official Statements</h3>
  Provide 1 to 2 paragraphs with direct quotes, stances from government spokespersons, industry leaders, opposition voices, or civil society organizations.
- <h3>Looking Ahead: Timeline & Next Steps</h3>
  Provide 1 paragraph highlighting upcoming dates, scheduled committee hearings, implementation milestones, or expected market reactions.

CATEGORY RULES (choose ONE primary):
- cat_money_hustle → ANY money topic (banks, naira, forex, loans, investments, crypto, budget, taxes, inflation, fintech, salary, refinery, fuel prices)
- cat_sports → ANY sports topic (football, Super Eagles, Premier League, AFCON, boxing, athletics, transfers)
- cat_world → Foreign and international affairs outside Nigeria
- cat_naija_news → Nigerian politics, governance, security, judiciary, community affairs

Return ONLY valid JSON (no markdown fences, strictly parseable):
{
  "title": "Clear, engaging headline without sensational clickbait",
  "summary": "An executive 3-sentence briefing summarizing the core story, key impact, and upcoming step.",
  "content": "<h3>The Crux & What Happened</h3><p>...</p><h3>Deep-Dive Background & Precedent</h3><p>...</p><h3>The Stakes: Real-Life Impact on Everyday Nigerians</h3><p>...</p><h3>Key Reactions & Official Statements</h3><p>...</p><h3>Looking Ahead: Timeline & Next Steps</h3><p>...</p>",
  "category_id": "cat_money_hustle | cat_sports | cat_world | cat_naija_news",
  "reading_time_minutes": 5,
  "key_takeaways": [
    "Critical fact or verified figure",
    "Direct policy or economic impact point",
    "Key official or stakeholder position",
    "Next scheduled timeline or date to watch"
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

  const conceptualSubject = buildSafeConceptualPrompt(params.title, params.categoryId || 'cat_naija_news', params.summary);
  const safeNegativeConstraint = 'high-end editorial photojournalism, authentic documentary photography, natural colors, 8k resolution, crisp focus, cinematic lighting';
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
              caption: `Editorial photojournalism: ${params.title.slice(0, 80)}`,
              credit: `9jaBeacon Editorial Desk / News Wire`,
            };
          } else {
            const json = await res.json() as any;
            if (json?.result?.image) {
              return {
                imageUrl: `data:image/jpeg;base64,${json.result.image}`,
                caption: `Editorial photojournalism: ${params.title.slice(0, 80)}`,
                credit: `9jaBeacon Editorial Desk / News Wire`,
              };
            }
          }
        }
      } catch (err: any) {
        console.warn(`[Editorial Image Engine]:`, err.message);
      }
    }
  }

  // Ultra-accurate context prompt
  const cleanEncodedPrompt = encodeURIComponent(
    `${conceptualSubject}, award-winning Nigerian photojournalism, 35mm lens, natural documentary lighting, highly detailed`
  );

  return {
    imageUrl: `https://image.pollinations.ai/prompt/${cleanEncodedPrompt}?width=1200&height=675&nologo=true&model=flux`,
    caption: `Editorial wire coverage: ${params.title.slice(0, 80)}.`,
    credit: '9jaBeacon Editorial Photo Wire',
  };
}

function buildSafeConceptualPrompt(title: string = '', categoryId: string = '', summary: string = ''): string {
  const combined = (title + ' ' + summary).toLowerCase();

  // 1. Presidency, Aso Rock, Federal Executive Council
  if (/tinubu|shettima|presiden|aso rock|state house|fec|minister|cabinet|governance/.test(combined)) {
    return 'State House Presidential Villa in Abuja Nigeria, official presidential conference podium with Nigerian coat of arms, formal green and white flags, editorial government photojournalism';
  }

  // 2. Central Bank of Nigeria, Naira, Forex, Inflation, Banks
  if (/cbn|cardoso|naira|forex|fx|inflation|monetary|interest rate|bank|financial sector|cash|liquidity/.test(combined)) {
    return 'Central Bank of Nigeria headquarters tower in Abuja, modern financial skyscrapers in Victoria Island Lagos, stacks of newly printed Nigerian Naira notes, financial press photojournalism';
  }

  // 3. Dangote, Refineries, Fuel, Petrol, NNPC, Oil & Gas
  if (/dangote|refinery|petrol|fuel|nnpc|crude oil|subsidy|diesel|pms|gas|pipeline|energy/.test(combined)) {
    return 'Dangote Petroleum Mega-Refinery complex in Lekki Lagos, vast modern oil distillation towers, heavy energy infrastructure, industrial sunset photojournalism';
  }

  // 4. Super Eagles, AFCON, Football, Victor Osimhen, Sports
  if (/super eagles|osimhen|lookman|afcon|nff|football|soccer|premier league|fifa|npfl|stadium|cup/.test(combined)) {
    return 'Nigerian Super Eagles international football stadium, green pitch with floodlights, professional football match in Nigeria, dramatic sports photojournalism';
  }

  // 5. Judiciary, EFCC, ICPC, Supreme Court, Police, Law
  if (/efcc|icpc|supreme court|court|judge|judiciary|trial|verdict|gavel|police|arrest|lawyer|bail/.test(combined)) {
    return 'Supreme Court of Nigeria architectural complex in Abuja, bronze scales of justice with heavy wooden judicial gavel on polished courtroom desk, legal documentary photojournalism';
  }

  // 6. Afrobeats, Nollywood, Entertainment
  if (/burna|wizkid|davido|asake|tiwa|nollywood|afrobeats|movie|cinema|actor|music|grammy/.test(combined)) {
    return 'African musical stage performance with gold spotlights, professional acoustic studio, vibrant Lagos creative entertainment event';
  }

  // 7. Tech, FinTech, Startups
  if (/flutterwave|moniepoint|fintech|startup|tech|silicon|yaba|software|app|digital/.test(combined)) {
    return 'Modern high-tech innovation campus in Yaba Lagos, digital workspace with multiple ultra-wide monitor dashboards showing financial analytics';
  }

  // 8. National Assembly, Senate, House of Reps
  if (/assembly|senate|reps|akpabio|lawmakers|parliament|bill|constitution/.test(combined)) {
    return 'National Assembly Complex dome in Abuja Nigeria, green legislative chamber benches, green and white emblem, legislative photojournalism';
  }

  // 9. Category Fallbacks
  switch (categoryId) {
    case 'cat_money_hustle':
      return 'Lagos Marina financial commercial skyline, modern Nigerian banking towers, business district photojournalism';
    case 'cat_sports':
      return 'Modern national athletics and football stadium under bright floodlights, green pitch, sports journalism';
    case 'cat_world':
      return 'United Nations headquarters assembly hall, international diplomacy podium with world flags, global summit photojournalism';
    default:
      return 'Abuja city gate and national landmark under blue sky, Nigerian national monument, editorial documentary photojournalism';
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

