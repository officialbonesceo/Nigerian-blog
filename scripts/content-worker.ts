/**
 * Content worker entry for GitHub Actions.
 * Uses the clear TypeScript pipeline (rank → full extract → multi-model rewrite).
 */
import { getD1 } from '../src/lib/runtime-db';
import { runIngestionPipeline } from '../src/lib/automated-ingest-pipeline';

async function main() {
  const maxArticles = Math.min(
    Math.max(parseInt(process.env.MAX_ARTICLES_PER_RUN || '3', 10) || 3, 1),
    5
  );

  console.log('=== 9jaBeacon content worker ===');
  console.log('MAX_ARTICLES_PER_RUN:', maxArticles);
  console.log('Mode: rank all RSS → full-text top N → multi-model rewrite (legal fail-closed)');

  const db = getD1();
  const result = await runIngestionPipeline(db, {
    maxArticles,
    limitPerSource: 8,
  });

  console.log('=== RESULT ===');
  console.log(JSON.stringify(result, null, 2));

  // Soft success: pipeline errors on individual feeds should not always fail the job
  // Hard fail only if nothing could run and we had a pipeline exception
  if (result.errors.some((e) => e.startsWith('Pipeline exception:'))) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('content-worker failed:', err);
  process.exit(1);
});
