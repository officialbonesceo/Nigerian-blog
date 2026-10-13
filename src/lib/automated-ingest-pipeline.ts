/**
 * Full ingestion pipeline: fetch → rewrite → D1 insert → syndicate
 * See local artifacts/mod/automated-ingest-pipeline.ts for full implementation.
 * This is a temporary stub — full file will be restored in next commit.
 */
export async function runIngestionPipeline(_db: any, _opts?: any): Promise<{
  fetched: number;
  passed: number;
  rejected: number;
  inserted: number;
  errors: string[];
}> {
  return { fetched: 0, passed: 0, rejected: 0, inserted: 0, errors: ['Pipeline full content pending restore'] };
}
