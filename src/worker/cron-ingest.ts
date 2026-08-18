/**
 * Cloudflare Worker: Scheduled RSS Ingestion & Groq AI Editorial Synthesizer
 * Triggered periodically via Cloudflare Cron Triggers (e.g. every 30 minutes)
 */

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; meta: any; results?: T[] }>;
  all<T = unknown>(): Promise<{ success: boolean; results: T[] }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export interface WorkerEnv {
  DB: D1Database;
  GROQ_API_KEY?: string;
  ENVIRONMENT?: string;
}

export default {
  // Cloudflare Cron Trigger Handler
  async scheduled(event: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    console.log(`[Cron Trigger] Starting automated RSS ingestion at ${new Date(event.scheduledTime).toISOString()}`);
    ctx.waitUntil(runIngestionPipeline(env));
  },

  // HTTP API Worker Handler (for manual trigger or health checks)
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/cron/trigger' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      // Protect endpoint
      if (!authHeader?.includes('Bearer')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }

      ctx.waitUntil(runIngestionPipeline(env));
      return new Response(JSON.stringify({ status: 'Ingestion pipeline queued successfully' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ name: 'NaijaPulse Ingest Worker', status: 'healthy' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

async function runIngestionPipeline(env: WorkerEnv): Promise<void> {
  if (!env.DB) {
    console.warn('[Ingest] D1 Database binding DB is not present in local mode.');
    return;
  }

  try {
    // 1. Fetch enabled sources
    const { results: sources } = await env.DB.prepare(
      'SELECT * FROM sources WHERE is_enabled = 1 ORDER BY last_fetched_at ASC LIMIT 5'
    ).all();

    for (const source of sources as any[]) {
      try {
        console.log(`[Ingest] Processing source: ${source.name} (${source.feed_url})`);
        
        // 2. Fetch RSS feed XML
        const res = await fetch(source.feed_url, {
          headers: { 'User-Agent': 'NaijaPulse-Cloudflare-Bot/1.0' },
        });

        if (!res.ok) {
          await logEvent(env, 'CRAWL_FAILED', source.id, `Failed with HTTP ${res.status}: ${res.statusText}`, 'warning');
          continue;
        }

        const xml = await res.text();
        const items = extractRssItems(xml);

        for (const item of items.slice(0, 3)) {
          // Check for duplicate slug or title
          const existing = await env.DB.prepare(
            'SELECT id FROM articles WHERE source_original_url = ? OR title = ?'
          ).bind(item.link, item.title).first();

          if (existing) {
            continue; // Duplicate already indexed
          }

          // 3. Process with Groq API (if API Key provided) or format clean editorial draft
          let rewrittenContent = item.description;
          let rewrittenTitle = item.title;
          let summary = item.description.slice(0, 200) + '...';

          if (env.GROQ_API_KEY) {
            const aiResult = await synthesizeWithGroq(env.GROQ_API_KEY, item.title, item.description);
            if (aiResult) {
              rewrittenTitle = aiResult.title;
              summary = aiResult.summary;
              rewrittenContent = aiResult.content;
            }
          }

          const articleId = 'art_' + Math.random().toString(36).substring(2, 9);
          const slug = generateSlug(rewrittenTitle) + '-' + articleId.slice(-4);

          // 4. Save to Cloudflare D1
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
            rewrittenTitle,
            summary,
            rewrittenContent,
            source.category_default_id || 'cat_politics',
            item.imageUrl || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80',
            source.name,
            source.license_notes || 'Editorial Attribution',
            'NaijaPulse Desk',
            'Automated Synthesis',
            source.id,
            source.name,
            item.link,
            'published'
          ).run();

          await logEvent(env, 'ARTICLE_INGESTED', source.id, `Ingested: "${rewrittenTitle}"`, 'info');
        }

        // Update last_fetched_at timestamp
        await env.DB.prepare('UPDATE sources SET last_fetched_at = datetime("now") WHERE id = ?').bind(source.id).run();

      } catch (err: any) {
        console.error(`[Ingest Error] Source ${source.name}:`, err);
        await logEvent(env, 'SOURCE_ERROR', source.id, err.message, 'error');
      }
    }
  } catch (globalErr: any) {
    console.error('[Ingest Global Error]', globalErr);
  }
}

async function synthesizeWithGroq(apiKey: string, title: string, lead: string): Promise<{ title: string; summary: string; content: string } | null> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert Nigerian news editor at NaijaPulse. Rewrite the news story cleanly in proper HTML paragraphs (<p>, <h3>, <blockquote>) with zero marketing fluff. Return JSON format with fields: title, summary, content.',
          },
          {
            role: 'user',
            content: `Headline: ${title}\nLead Text: ${lead}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json() as any;
    const parsed = JSON.parse(data.choices[0].message.content);
    return {
      title: parsed.title || title,
      summary: parsed.summary || lead,
      content: parsed.content || `<p>${lead}</p>`,
    };
  } catch {
    return null;
  }
}

function extractRssItems(xml: string): Array<{ title: string; link: string; description: string; imageUrl?: string }> {
  const items: any[] = [];
  const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const itemXml of matches) {
    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    if (titleMatch && linkMatch) {
      items.push({
        title: titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        link: linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        description: descMatch ? descMatch[1].replace(/<[^>]*>?/gm, '').trim() : '',
      });
    }
  }
  return items;
}

function generateSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

async function logEvent(env: WorkerEnv, eventType: string, sourceId: string | undefined, message: string, level: string): Promise<void> {
  try {
    const logId = 'log_' + Date.now();
    await env.DB.prepare(
      'INSERT INTO automation_logs (id, event_type, source_id, message, level, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))'
    ).bind(logId, eventType, sourceId || null, message, level).run();
  } catch {}
}
