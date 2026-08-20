/**
 * 9jaBeacon Cloudflare Worker: Scheduled RSS Ingestion & Groq AI Editorial Synthesizer
 * Triggered periodically via Cloudflare Cron Triggers (e.g. every 30 minutes)
 * Stores ingested & synthesized news directly into Cloudflare D1
 */
import type { WorkerEnv, ScheduledController, ExecutionContext } from './types';
import { parseXmlFeed } from './rss-parser';

export default {
  // Cloudflare Cron Trigger Handler
  async scheduled(event: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    console.log(`[9jaBeacon Cron] Starting automated RSS ingestion at ${new Date(event.scheduledTime).toISOString()}`);
    ctx.waitUntil(runIngestionPipeline(env));
  },

  // HTTP API Worker Handler (for manual trigger or health checks)
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        service: '9jaBeacon Cloudflare Ingestion Worker', 
        status: 'healthy',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Manual Crawl Trigger endpoint
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
        message: '9jaBeacon RSS Ingestion Pipeline queued successfully' 
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
    // 1. Fetch enabled sources ordered by oldest fetched
    const { results: sources } = await env.DB.prepare(
      'SELECT * FROM sources WHERE is_enabled = 1 ORDER BY last_fetched_at ASC LIMIT 6'
    ).all();

    if (!sources || sources.length === 0) {
      console.log('[9jaBeacon Ingest] No active sources found to crawl.');
      return;
    }

    for (const source of sources as any[]) {
      try {
        console.log(`[9jaBeacon Ingest] Fetching source: ${source.name} (${source.feed_url})`);

        // 2. Fetch live RSS feed
        const res = await fetch(source.feed_url, {
          headers: { 
            'User-Agent': '9jaBeacon-Bot/1.0 (+https://9jabeacon.pages.dev; news@9jabeacon.ng)',
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
          // Check for duplicate link or title
          const existing = await env.DB.prepare(
            'SELECT id FROM articles WHERE source_original_url = ? OR title = ?'
          ).bind(item.link, item.title).first();

          if (existing) {
            continue; // Already saved
          }

          // 3. Process with Groq API (llama-3.1-8b-instant) or format clean editorial draft
          let rewrittenTitle = item.title;
          let summary = item.description.slice(0, 220) + (item.description.length > 220 ? '...' : '');
          let rewrittenContent = item.content || `<p>${item.description}</p>`;

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

          // 4. Save article into Cloudflare D1
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
            item.enclosureUrl || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80',
            source.name,
            source.license_notes || 'Editorial Attribution',
            '9jaBeacon Desk',
            'Editorial Contributor',
            source.id,
            source.name,
            item.link,
            'published'
          ).run();

          newArticlesCount++;
          await logEvent(env, 'ARTICLE_INGESTED', source.id, `Ingested story: "${rewrittenTitle}"`, 'info');
        }

        // Update last_fetched_at timestamp
        await env.DB.prepare('UPDATE sources SET last_fetched_at = datetime("now") WHERE id = ?').bind(source.id).run();
        console.log(`[9jaBeacon Ingest] Successfully ingested ${newArticlesCount} stories from ${source.name}`);

      } catch (err: any) {
        console.error(`[9jaBeacon Ingest Error] Source ${source.name}:`, err);
        await logEvent(env, 'SOURCE_ERROR', source.id, err.message, 'error');
      }
    }
  } catch (globalErr: any) {
    console.error('[9jaBeacon Ingest Global Error]', globalErr);
  }
}

async function synthesizeWithGroq(
  apiKey: string,
  title: string,
  lead: string,
  modelName: string = 'llama-3.1-8b-instant'
): Promise<{ title: string; summary: string; content: string } | null> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert Nigerian news editor at 9jaBeacon. Rewrite this breaking news story clearly in well-structured HTML paragraphs (<p>, <h3>, <blockquote>) with zero clickbait or fluff. Return valid JSON only with fields: title, summary, content.',
          },
          {
            role: 'user',
            content: `Headline: ${title}\nLead Content: ${lead}`,
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
