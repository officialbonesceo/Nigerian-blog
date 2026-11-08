/**
 * HARD DISABLED 2026-11-08
 * Full pipeline restored briefly 2026-11-07 then disabled again after
 * unexpected multi-article D1 inserts that did not match GitHub Actions runs.
 * Stub keeps imports/builds working; nothing inserts.
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
    errors: ['ingest pipeline hard-disabled 2026-11-08'],
  };
}
