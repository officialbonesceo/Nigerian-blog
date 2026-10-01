import type { APIRoute } from 'astro';
import { getD1, addAutomationLog } from '../../../lib/runtime-db';
import { runIngestionPipeline } from '../../../lib/automated-ingest';

interface TriggerCrawlBody {
  source_id?: string;
  category_id?: string;
  limit_per_source?: number;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const workflowStartTime = Date.now();
  const sessionLogs: Array<{ action: string; source?: string; message: string; status: 'info' | 'warning' | 'error'; timestamp: string }> = [];

  const recordLog = async (db: any, action: string, sourceId: string | null, sourceName: string, message: string, status: 'info' | 'warning' | 'error' = 'info') => {
    const timestamp = new Date().toISOString();
    sessionLogs.push({ action, source: sourceName, message, status, timestamp });
    await addAutomationLog(db, action, sourceId, message, status).catch(() => {});
  };

  try {
    const db = getD1(locals);
    const body = (await request.json().catch(() => ({}))) as TriggerCrawlBody;
    
    // Check if source_id is actually a category ID (e.g. cat_money_hustle)
    let sourceId = body.source_id;
    let categoryId = body.category_id;
    if (sourceId && sourceId.startsWith('cat_')) {
      categoryId = sourceId;
      sourceId = undefined;
    }

    const limitPerSource = Math.min(Math.max(Number(body.limit_per_source || 3), 1), 10);
    const targetLabel = sourceId ? `Source ${sourceId}` : (categoryId ? `Category ${categoryId}` : 'Balanced Multi-Category');

    await recordLog(
      db,
      'WORKFLOW_START',
      sourceId || categoryId || null,
      'System',
      `Starting automated ingestion workflow (${targetLabel}). Limit: ${limitPerSource} per feed.`,
      'info'
    );

    const pipelineResult = await runIngestionPipeline(db, {
      sourceId,
      categoryId,
      limitPerSource,
    });

    for (const err of pipelineResult.errors) {
      await recordLog(db, 'PIPELINE_NOTICE', null, 'Ingestion', err, 'warning');
    }

    const totalElapsedSec = ((Date.now() - workflowStartTime) / 1000).toFixed(1);
    await recordLog(
      db,
      'WORKFLOW_COMPLETE',
      null,
      'System',
      `Ingested ${pipelineResult.inserted} articles (${pipelineResult.fetched} fetched, ${pipelineResult.passed} passed gate, ${pipelineResult.rejected} rejected) in ${totalElapsedSec}s.`,
      'info'
    );

    return new Response(JSON.stringify({
      success: true,
      totalIngested: pipelineResult.inserted,
      totalRejectedNoAi: pipelineResult.rejected,
      durationSeconds: Number(totalElapsedSec),
      results: [pipelineResult],
      logs: sessionLogs,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || String(err),
      logs: sessionLogs,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
