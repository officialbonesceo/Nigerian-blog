/**
 * 9jaBeacon Cloudflare Worker: Scheduled RSS Ingestion & 3-Tier Multi-Model AI Engine
 * Triggered periodically via Cloudflare Cron Triggers (e.g. every 30 minutes)
 * Stores ingested & synthesized news directly into Cloudflare D1
 * Image generation with Flux-1-Schnell (Strict No-Human Policy)
 */
import type { WorkerEnv, ScheduledController, ExecutionContext } from './types';
import { parseXmlFeed } from './rss-parser';

// Verified active multi-model fallback cascades
const CF_MODELS_CASCADE = [
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.2',
  '@cf/qwen/qwen1.5-14b-chat-awq',
];

const OPENROUTER_MODELS_CASCADE = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'deepseek/deepseek-r1:free',
  'qwen/qwen-2.5-72b-instruct',
  'google/gemini-2.0-flash-001',
  'openai/gpt-4o-mini',
];

const POLLINATIONS_MODELS_CASCADE = [
  'openai',
  'mistral',
  'llama',
  'searchgpt',
];

export default {
  // Cloudflare Cron Trigger Handler
  async scheduled(event: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    console.log(`[9jaBeacon Cron] Automated RSS ingestion at ${new Date(event.scheduledTime).toISOString()}`);
    ctx.waitUntil(runIngestionPipeline(env));
  },

  // HTTP API Worker Handler (for manual trigger or health checks)
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        service: '9jaBeacon Cloudflare Ingestion Worker', 
        status: 'healthy',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/api/cron/trigger' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      const expectedSecret = env.ADMIN_SECRET;

      if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      ctx.waitUntil(runIngestionPipeline(env));
      return new Response(JSON.stringify({ 
        success: true, 
        message: '9jaBeacon RSS Ingestion Pipeline queued' 
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

async function runIngestionPipeline(env: WorkerEnv): Promise<void> {
  if (!env.DB) {
    console.warn('[9jaBeacon Ingest] D1 Database binding "DB" is not present.');
    return;
  }

  try {
    const { results: sources } = await env.DB.prepare(
      'SELECT * FROM sources WHERE is_enabled = 1 ORDER BY last_fetched_at ASC LIMIT 6'
    ).all();

    if (!sources || sources.length === 0) {
      return;
    }

    for (const source of sources as any[]) {
      try {
        const res = await fetch(source.feed_url, {
          headers: { 
            'User-Agent': '9jaBeacon-Bot/2.0 (+https://9jabeacon.pages.dev; news@9jabeacon.ng)',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
          },
        });

        if (!res.ok) {
          await logEvent(env, 'CRAWL_FAILED', source.id, `HTTP ${res.status}: ${res.statusText}`, 'warning');
          continue;
        }

        const xml = await res.text();
        const items = parseXmlFeed(xml);

        let newArticlesCount = 0;
        for (const item of items.slice(0, 3)) {
          const existing = await env.DB.prepare(
            'SELECT id FROM articles WHERE source_original_url = ? OR title = ?'
          ).bind(item.link, item.title).first();

          if (existing) {
            continue;
          }

          // 3-Tier Multi-Model AI synthesis
          const aiResult = await synthesizeArticle(env, item.title, item.description, item.content);
          if (!aiResult) {
            const rejId = 'rej_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
            await env.DB.prepare(`
              INSERT INTO rejected_articles (
                id, source_id, source_name, original_title, original_url, raw_content,
                rejection_reason, ai_tier_failures, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `).bind(
              rejId,
              source.id,
              source.name,
              item.title,
              item.link,
              item.description,
              'All AI model tiers failed to rewrite feed lead',
              'Cloudflare -> OpenRouter -> Pollinations (Failed)'
            ).run();
            continue;
          }

          const articleId = 'art_' + Math.random().toString(36).substring(2, 9);
          const slug = generateSlug(aiResult.title) + '-' + articleId.slice(-4);

          let imageUrl = item.enclosureUrl;
          if (!imageUrl) {
            imageUrl = await generateImage(env, source.category_default_id || 'cat_politics');
          }

          await env.DB.prepare(`
            INSERT INTO articles (
              id, slug, title, summary, content, category_id,
              image_url, image_credit, image_license,
              author_name, author_role, source_id, source_name,
              source_original_url, published_at, updated_at, status
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?
            )
          `).bind(
            articleId,
            slug,
            aiResult.title,
            aiResult.summary,
            aiResult.content,
            source.category_default_id || 'cat_politics',
            imageUrl,
            source.name,
            source.license_notes || 'Editorial Attribution',
            '9jaBeacon Editorial Desk',
            'Editorial Bureau',
            source.id,
            source.name,
            item.link,
            'published'
          ).run();

          newArticlesCount++;
          await logEvent(env, 'ARTICLE_INGESTED', source.id, `Ingested story: "${aiResult.title}"`, 'info');
        }

        await env.DB.prepare('UPDATE sources SET last_fetched_at = datetime("now") WHERE id = ?').bind(source.id).run();
      } catch (err: any) {
        await logEvent(env, 'SOURCE_ERROR', source.id, err.message, 'error');
      }
    }
  } catch (globalErr: any) {
    console.error('[9jaBeacon Ingest Global Error]', globalErr);
  }
}

async function synthesizeArticle(
  env: WorkerEnv,
  title: string,
  lead: string,
  fullContent?: string
): Promise<{ title: string; summary: string; content: string } | null> {
  const prompt = `You are a Senior Nigerian News Editor at 9jaBeacon. Rewrite this breaking news story clearly in well-structured HTML paragraphs (<h3>The Scoop</h3>, <h3>The Stakes</h3>, <h3>The Stats</h3>) with zero fluff. Return valid JSON only with fields: title, summary, content.
Raw Title: ${title}
Raw Details: ${fullContent || lead}`;

  // Tier 1: Cloudflare Workers AI Cascades (1a -> 1b -> 1c -> 1d -> 1e)
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
    for (const cfModel of CF_MODELS_CASCADE) {
      try {
        const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${cfModel}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1500,
          }),
        });

        if (cfRes.ok) {
          const cfData = await cfRes.json() as any;
          const text = cfData?.result?.response || cfData?.response || '';
          const parsed = parseJson(text);
          if (parsed?.title && parsed?.content) return parsed;
        }
      } catch {}
    }
  }

  // Tier 2: OpenRouter Multi-Model Fallback Cascades (2a -> 2h)
  if (env.OPENROUTER_API_KEY) {
    for (const orModel of OPENROUTER_MODELS_CASCADE) {
      try {
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://9jabeacon.pages.dev',
            'X-Title': '9jaBeacon News Worker',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: orModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1500,
            response_format: { type: 'json_object' },
          }),
        });

        if (orRes.ok) {
          const orData = await orRes.json() as any;
          const text = orData?.choices?.[0]?.message?.content || '';
          const parsed = parseJson(text);
          if (parsed?.title && parsed?.content) return parsed;
        }
      } catch {}
    }
  }

  // Tier 3: Pollinations Serverless AI Cascades (3a -> 3d)
  for (const pollModel of POLLINATIONS_MODELS_CASCADE) {
    try {
      const pollRes = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          model: pollModel,
          jsonMode: true,
          seed: 42,
        }),
      });
      if (pollRes.ok) {
        const text = await pollRes.text();
        const parsed = parseJson(text);
        if (parsed?.title && parsed?.content) return parsed;
      }
    } catch {}
  }

  return null;
}

async function generateImage(env: WorkerEnv, _categoryId: string): Promise<string> {
  const safeConcept = `Nigerian architectural landmark, financial currency graph, tech server microchip, legal court gavel, modern football stadium, clean conceptual still life, high-end editorial photography, 8k resolution, NO humans, NO faces, NO people, NO portraits, NO text`;

  // Try Cloudflare Flux-1-Schnell if credentials available
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
    try {
      const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: safeConcept,
          num_steps: 4,
        }),
      });
      if (cfRes.ok) {
        const arrayBuffer = await cfRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return `data:image/jpeg;base64,${base64}`;
      }
    } catch {}
  }

  // Fallback to Pollinations Flux
  const cleanPrompt = encodeURIComponent(safeConcept);
  return `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1200&height=675&nologo=true&model=flux`;
}

function parseJson(raw: string): { title: string; summary: string; content: string } | null {
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last !== -1) {
      const parsed = JSON.parse(cleaned.substring(first, last + 1));
      return {
        title: parsed.title || '',
        summary: parsed.summary || '',
        content: parsed.content || '',
      };
    }
  } catch {}
  return null;
}

function generateSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

async function logEvent(
  env: WorkerEnv,
  eventType: string,
  sourceId: string | undefined,
  message: string,
  level: string
): Promise<void> {
  try {
    const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    await env.DB.prepare(
      'INSERT INTO automation_logs (id, event_type, source_id, message, level, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))'
    ).bind(logId, eventType, sourceId || null, message, level).run();
  } catch {}
}
