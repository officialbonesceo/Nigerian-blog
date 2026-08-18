import type { APIRoute } from 'astro';
import { getSources, getSourceById, createArticle, addAutomationLog, updateSource } from '../../../lib/db';
import { fetchAndParseRssFeed } from '../../../lib/rss-parser';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const sourceId = body.source_id;

    const sourcesToCrawl = sourceId ? [getSourceById(sourceId)].filter(Boolean) : getSources().filter(s => s.is_enabled);

    let totalIngested = 0;
    const results = [];

    for (const source of sourcesToCrawl) {
      if (!source) continue;
      addAutomationLog('CRAWL_TRIGGERED', source.id, `Manual crawl triggered for source: ${source.name}`, 'info');

      const parsed = await fetchAndParseRssFeed(source.feed_url);
      if (!parsed.success || !parsed.items) {
        addAutomationLog('CRAWL_ERROR', source.id, `Failed to parse feed: ${parsed.error}`, 'error');
        results.push({ source: source.name, success: false, error: parsed.error });
        continue;
      }

      let ingestedFromSource = 0;
      for (const item of parsed.items.slice(0, 2)) {
        try {
          createArticle({
            title: item.title,
            summary: item.description,
            content: item.content || `<p>${item.description}</p>`,
            category_id: source.category_default_id || 'cat_politics',
            image_url: item.enclosureUrl || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80',
            image_credit: source.name,
            image_license: source.license_notes || 'Editorial Attribution',
            source_id: source.id,
            source_name: source.name,
            source_original_url: item.link,
            author_name: item.author || 'NaijaPulse Ingest',
            status: 'published',
          });
          ingestedFromSource++;
          totalIngested++;
        } catch (itemErr: any) {
          // Ignore unique constraint/duplicate
        }
      }

      updateSource(source.id, { last_fetched_at: new Date().toISOString() });
      addAutomationLog('CRAWL_COMPLETE', source.id, `Completed ingestion for ${source.name}: ${ingestedFromSource} new stories added.`, 'info');
      results.push({ source: source.name, success: true, count: ingestedFromSource });
    }

    return new Response(JSON.stringify({ success: true, totalIngested, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
