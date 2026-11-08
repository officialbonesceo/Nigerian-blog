/**
 * HARD DISABLED 2026-11-01 (restored this state 2026-11-08)
 * Full pipeline lived here (RSS → rank → AI rewrite → insert).
 * Kept as a stub so old imports do not crash builds, but nothing inserts.
 * Do NOT restore full pipeline until D1 mystery writer is fully isolated.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { IngestionPipelineResult } from './automated-ingest-types';

export async function runIngestionPipeline(
  _db: D1Database,
  _options: { sourceId?: string; categoryId?: string; limitPerSource?: number; maxArticles?: number } = {}
): Promise<IngestionPipelineResult> {
  console.error('[ingest] DISABLED — runIngestionPipeline refuses all work');
  return {
    fetched: 0,
    passed: 0,
    rejected: 0,
    inserted: 0,
    errors: ['ingest pipeline hard-disabled 2026-11-01'],
  };
}
